"""
Interview API Router
--------------------
Endpoints:
  POST /api/interviews/start          – create session + run research pipeline
  GET  /api/interviews/{id}           – get interview state
  POST /api/interviews/{id}/answer    – submit an answer, get next question
  POST /api/interviews/{id}/complete  – mark interview done
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.postgres import get_db, Interview, Question, Response

router = APIRouter(prefix="/api/interviews", tags=["interviews"])


# ── Request / Response Schemas ─────────────────────────────────────────────────

class StartInterviewRequest(BaseModel):
    user_id: int
    company: str
    role: str
    difficulty: str = "medium"


class StartInterviewResponse(BaseModel):
    interview_id: int
    first_question: str
    blueprint: dict[str, Any]


class SubmitAnswerRequest(BaseModel):
    answer: str


class SubmitAnswerResponse(BaseModel):
    evaluation: dict[str, Any]
    next_question: str | None
    interview_complete: bool


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/start", response_model=StartInterviewResponse)
async def start_interview(
    body: StartInterviewRequest,
    db: AsyncSession = Depends(get_db),
) -> StartInterviewResponse:
    """
    Launch research pipeline → build knowledge base → generate blueprint
    → return first question.
    """
    # TODO: 1. Run TavilySearch + FirecrawlAgent
    # TODO: 2. Run ExtractorAgent on results
    # TODO: 3. Upsert into VectorStore
    # TODO: 4. Generate blueprint via BlueprintGenerator
    # TODO: 5. Run InterviewerAgent.generate_question()

    blueprint: dict[str, Any] = {
        "interview_type": "technical",
        "sections": [
            {"name": "Screening", "questions": 2},
            {"name": "Coding", "questions": 3},
            {"name": "Role Specific", "questions": 4},
            {"name": "Behavioral", "questions": 2},
        ],
    }

    interview = Interview(
        user_id=body.user_id,
        company=body.company,
        role=body.role,
        difficulty=body.difficulty,
        blueprint=blueprint,
        status="in_progress",
    )
    db.add(interview)
    await db.flush()

    first_question = f"Tell me about yourself and why you're interested in the {body.role} role at {body.company}."

    question = Question(
        interview_id=interview.id,
        question=first_question,
        section="Screening",
        question_type="behavioral",
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
    interview = await db.get(Interview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return {
        "id": interview.id,
        "company": interview.company,
        "role": interview.role,
        "difficulty": interview.difficulty,
        "status": interview.status,
        "blueprint": interview.blueprint,
    }


@router.post("/{interview_id}/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    interview_id: int,
    body: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db),
) -> SubmitAnswerResponse:
    """
    Submit an answer → evaluate → return next question or completion signal.
    """
    interview = await db.get(Interview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # TODO: 1. Retrieve current unanswered Question for this interview
    # TODO: 2. Run EvaluatorAgent.evaluate(question, answer, context, section)
    # TODO: 3. Store Response in DB
    # TODO: 4. Run difficulty_router → adjust blueprint if needed
    # TODO: 5. Generate next question via InterviewerAgent or signal completion

    placeholder_evaluation = {
        "score": 7.5,
        "correctness": 8.0,
        "depth": 7.0,
        "communication": 7.5,
        "confidence": 7.5,
        "strengths": ["Clear structure", "Good examples"],
        "weaknesses": ["Could go deeper on technical details"],
        "brief_feedback": "Good answer overall.",
    }

    return SubmitAnswerResponse(
        evaluation=placeholder_evaluation,
        next_question="What is the time complexity of BFS and DFS?",
        interview_complete=False,
    )


@router.post("/{interview_id}/complete")
async def complete_interview(
    interview_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Mark interview as complete and trigger feedback generation."""
    interview = await db.get(Interview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview.status = "completed"
    # TODO: Trigger FeedbackAgent and store Report

    return {"message": "Interview completed", "interview_id": interview_id}
