"""
Interview API Router
--------------------
Endpoints:
  POST /api/interviews/start          – create session + run research pipeline
  GET  /api/interviews/{id}           – get interview state
  POST /api/interviews/{id}/answer    – submit an answer, get next question
  POST /api/interviews/{id}/complete  – mark interview done
  POST /api/interviews/{id}/end       – end early, generate report based on answers so far
"""

from __future__ import annotations

from typing import Any
from research import get_research_profile,save_research_profile
from fastapi import APIRouter, Depends, HTTPException
from pipeline import ResearchPipeline
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from agents.registry import blueprint_generator,feedback_agent
from graph.interview_graph import InterviewState,get_compiled_graph
from schemas.interiew import StartInterviewRequest, StartInterviewResponse, SubmitAnswerRequest, SubmitAnswerResponse
from db.postgres import Report, get_db, Interview, Question, Response

router = APIRouter(prefix="/api/interviews", tags=["interviews"])

# ── Helpers ────────────────────────────────────────────────────────────────────

def _graph_config(interview_id: int) -> dict:
    """LangGraph thread config - one thread per interview session."""
    return {"configurable":{"thread_id":str(interview_id)}}

async def _get_interview_or_404(interview_id: int, db: AsyncSession) -> Interview:
    """Fetch interview from DB or raise 404."""
    interview = await db.get(Interview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/start", response_model=StartInterviewResponse)
async def start_interview(
    body: StartInterviewRequest,
    db: AsyncSession = Depends(get_db),
) -> StartInterviewResponse:
    """
    1. Check ResearchProfile cache
    2. Run pipeline if cache miss
    3. Generate blueprint
    4. Initialize LangGraph state → retrieve context → generate first question
    5. Persist Interview + Question to DB
    """
    company=body.company
    role=body.role
    
    profile = await get_research_profile(db, company, role)

    if profile:
        print("[api] Research profile found in DB, skipping pipeline.")
        extracted={
            "skills": profile.skills,
            "technologies": profile.technologies,
            "topics": profile.topics,
            "rounds": profile.rounds,
            "behavioral_patterns": profile.behavioral_patterns,
            "key_insights": profile.key_insights,
            "dsa_questions": profile.dsa_questions,
            "difficulty": profile.difficulty,
        }
    else:
        print("[api] No research profile found, running pipeline.")
        pipeline=ResearchPipeline()
        result = await pipeline.run(company, role)
        extracted = result["extracted"]
        await save_research_profile(db, company, role, extracted)

    difficulty = extracted.get("difficulty", "Medium")
    blueprint = await blueprint_generator.generate(
        company=company,
        role=role,
        skills=extracted.get("skills", []),
        topics=extracted.get("topics", []),
        rounds=extracted.get("rounds", []),
        dsa_questions=extracted.get("dsa_questions", []),
        difficulty=difficulty,
    )
    
    interview = Interview(
        user_id=body.user_id,
        company=company,
        role=role,
        difficulty=difficulty,
        blueprint=blueprint,
        status="in_progress",
    )

    db.add(interview)
    await db.flush()

    initial_state: InterviewState = {
        "company": company,
        "role": role,
        "difficulty": difficulty,
        "username": body.username,
        "blueprint": blueprint,
        "context": "",
        "current_question": "",
        "current_question_type": "",
        "current_section": "",
        "current_focus_area": "",
        "current_acknowledgment": "",
        "current_answer": "",
        "evaluation": {},
        "previous_questions": [],
        "qa_history": [],
        "llm_suggests_wrap_up": False,
        "interview_complete": False,
    }

    config = _graph_config(interview.id)
    compiled_graph = get_compiled_graph()
    state = await compiled_graph.ainvoke(initial_state, config=config)

    first_question = state["current_question"]
    question_type = state.get("current_question_type", "screening")
    section_name = state.get("current_section", "General")

    question = Question(
        interview_id=interview.id,
        question=first_question,
        section=section_name,
        question_type=question_type,
        order_index=0,
    )

    db.add(question)
    await db.flush()

    return StartInterviewResponse(
        interview_id=interview.id,
        first_question=first_question,
        blueprint=blueprint,
    )


@router.get("/{interview_id}")
async def get_interview(
    interview_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get the current state of an interview session."""
    interview = await _get_interview_or_404(interview_id, db)

    result = await db.execute(
        select(Question)
        .where(Question.interview_id == interview_id)
        .order_by(Question.order_index.desc())
    )

    questions = result.scalars().all()

    history = []
    for q in questions:
        response_result = await db.execute(
            select(Response).where(Response.question_id == q.id)
        )
        response = response_result.scalar_one_or_none()
        history.append({
            "question": q.question,
            "answer": response.answer if response else None,
            "question_type": q.question_type,
            "section": q.section,
            "evaluation": response.evaluation if response else None,
        })

    latest_question = questions[-1] if questions else None

    return {
        "id": interview.id,
        "company": interview.company,
        "role": interview.role,
        "difficulty": interview.difficulty,
        "status": interview.status,
        "blueprint": interview.blueprint,
        "current_question": latest_question.question if latest_question else None,
        "current_question_type": latest_question.question_type if latest_question else None,
        "current_section": latest_question.section if latest_question else None,
        "history": history,
    }


@router.post("/{interview_id}/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    interview_id: int,
    body: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db),
) -> SubmitAnswerResponse:
    """
    1. Load current graph state via checkpointer
    2. Inject user answer into state
    3. Run evaluate_answer → adjust_difficulty → store_result
    4. If not complete: run retrieve_context → generate_question
    5. Persist Response + next Question to DB
    """
    interview = await _get_interview_or_404(interview_id, db)
    if interview.status == "completed":
        raise HTTPException(status_code=400, detail="Interview already completed")

    config = _graph_config(interview.id)
    compiled_graph = get_compiled_graph()
    current_state = await compiled_graph.aget_state(config)
    if not current_state or not current_state.values or "blueprint" not in current_state.values:
        raise HTTPException(status_code=410, detail="This interview's session state was lost (likely due to a server restart). Please start a new interview.")
    
    await compiled_graph.aupdate_state(config, {"current_answer": body.answer})

    final_state = await compiled_graph.ainvoke(None, config=config)

    evaluation = final_state.get("evaluation", {})
    interview_complete = final_state.get("interview_complete", False)

    result = await db.execute(
        select(Question)
        .where(Question.interview_id == interview.id)
        .order_by(Question.order_index.desc())
        .limit(1)
    )

    last_question = result.scalar_one_or_none()
    if last_question:
        response = Response(
            question_id=last_question.id,
            answer=body.answer,
            score=evaluation.get("score"),
            evaluation=evaluation,
            feedback=evaluation.get("brief_feedback", "")
        )
        db.add(response)
        await db.flush()
    
    next_question = None
    next_section = None
    next_acknowledgment = None

    if not interview_complete:
        next_q_type = final_state.get("current_question_type", "screening")
        next_q_text = final_state.get("current_question", "N/A")
        section_name = final_state.get("current_section", "General")
        next_acknowledgment = final_state.get("current_acknowledgment", "")
        order_index = len(final_state.get("previous_questions", []))
        next_question_row=Question(
            interview_id=interview.id,
            question=next_q_text,
            section=section_name,
            question_type=next_q_type,
            order_index=order_index
        )
        db.add(next_question_row)
        await db.flush()
        next_question = next_q_text
        next_section = section_name
    else:
        interview.status = "completed"


    return SubmitAnswerResponse(
        evaluation=evaluation,
        next_question=next_question,
        next_section=next_section,
        next_acknowledgment=next_acknowledgment,
        interview_complete=interview_complete,
    )


@router.post("/{interview_id}/complete")
async def complete_interview(
    interview_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Generate final feedback report and store in DB.
    Can be called explicitly or is triggered automatically when all questions answered.
    """
    interview = await  _get_interview_or_404(interview_id, db)

    config = _graph_config(interview.id)
    compiled_graph = get_compiled_graph()
    graph_state = await compiled_graph.aget_state(config)
    qa_history = graph_state.values.get("qa_history", []) if graph_state else []

    report_data = await feedback_agent.generate_report(company=interview.company, role=interview.role, qa_pairs=qa_history)

    report = Report(
        interview_id=interview_id,
        overall_score=report_data.get("overall_score", 0),
        report_json=report_data,
    )
    db.add(report)
    interview.status = "completed"
    await db.flush()

    return {"message": "Interview completed", "interview_id": interview_id,"overall_score": report_data.get("overall_score", 0)}

@router.post("/{interview_id}/end")
async def end_interview_early(
    interview_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    End an in-progress interview early and generate a report based on
    whatever questions were answered so far.
    """
    interview = await  _get_interview_or_404(interview_id, db)
    if interview.status == "completed":
        raise HTTPException(status_code=400, detail="Interview already completed")
    compiled_graph = get_compiled_graph()
    config = _graph_config(interview.id)
    graph_state = await compiled_graph.aget_state(config)
    qa_history = graph_state.values.get("qa_history", []) if graph_state else []

    if not qa_history:
        raise HTTPException(status_code=400, detail="No questions answered yet, cannot generate report")
    
    await compiled_graph.aupdate_state(config, {"interview_complete": True})

    report_data = await feedback_agent.generate_report(company=interview.company, role=interview.role, qa_pairs=qa_history)

    report = Report(
        interview_id=interview_id,
        overall_score=report_data.get("overall_score", 0),
        report_json=report_data,
    )

    db.add(report)
    interview.status = "completed"
    await db.flush()

    return {
        "message": "Interview ended early",
        "interview_id": interview_id,
        "questions_answered": len(qa_history),
        "overall_score": report_data.get("overall_score", 0),
    }

@router.get("")
async def list_interviews(
    user_id:int,
    db: AsyncSession = Depends(get_db)
) -> list[dict[str,Any]]:
    """List all the interviews for a given user,most recent first"""
    result = await db.execute(
        select(Interview)
        .where(Interview.user_id == user_id)
        .order_by(Interview.created_at.desc())
    )
    interviews = result.scalars().all()

    out = []
    for interview in interviews:
        report_result = await db.execute(
            select(Report.overall_score).where(Report.interview_id == interview.id)
        )
        overall_score = report_result.scalar_one_or_none()
        skills:list[str]=[]
        for section in (interview.blueprint or {}).get("sections",[]):
            skills.extend(section.get("focus_areas",[])[:2])
        out.append({
            "id": interview.id,
            "company": interview.company,
            "role": interview.role,
            "date": interview.created_at.isoformat(),
            "score": overall_score,
            "status": interview.status,
            "skills": skills[:4]
        })
    return out