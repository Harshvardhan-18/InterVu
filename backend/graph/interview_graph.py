"""
LangGraph Interview Graph
-------------------------
Core stateful graph that orchestrates the multi-turn interview:

  START
    │
    ▼
  retrieve_context
    │
    ▼
  generate_question
    │
    ▼
  wait_for_answer          ← human-in-the-loop node
    │
    ▼
  evaluate_answer
    │
    ▼
  difficulty_router ───────► adjust_difficulty
    │
    ▼
  generate_followup (optional)
    │
    ▼
  store_result
    │
    ▼
  END or NEXT QUESTION
"""

from __future__ import annotations
from typing import Any, Literal
from typing_extensions import TypedDict
from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.memory import MemorySaver
from rag.retriever import RAGRetriever
from agents.registry import interviewer,evaluator

_retriever = RAGRetriever()



# ── State ─────────────────────────────────────────────────────────────────────

class InterviewState(TypedDict):
    # Session info
    company: str
    role: str
    difficulty: str  # "easy" | "medium" | "hard"
    username: str

    # Blueprint
    blueprint: dict[str, Any]
    current_section_index: int
    questions_asked_in_section: int

    # Current turn
    context: str
    current_question: str
    current_question_type: str
    current_answer: str
    evaluation: dict[str, Any]

    # History
    previous_questions: list[str]
    qa_history: list[dict[str, Any]]

    # Control
    needs_followup: bool
    followup_question: str | None
    interview_complete: bool

# ── Helper Function ───────────────────────────────────────────────────────────

def current_section(state: InterviewState) -> dict[str, Any] | None:
    sections = state["blueprint"].get("sections", [])
    idx = state["current_section_index"]
    return sections[idx] if idx < len(sections) else None

# ── Node stubs (wire in real agents when implementing) ─────────────────────────

async def retrieve_context(state: InterviewState) -> dict[str, Any]:
    """Retrieve relevant context from ChromaDB for current section."""
    section = current_section(state)
    if not section:
        return {"context": ""}
    focus_areas = section.get("focus_areas", [])
    query = f"{state['company']} {state['role']} {' '.join(focus_areas)} interview question"
    
    chunks = _retriever.retrieve(query=query,company=state["company"], role=state["role"])
    context = _retriever.format_context(chunks) if chunks else ""
    return {"context": context}

async def generate_question(state: InterviewState) -> dict[str, Any]:
    """Use InterviewerAgent to generate the next question."""
    section = current_section(state)
    if not section:
        return {
            "current_question": "Thank you for your time. The interview is now complete.",
            "current_question_type": "screening",
            "current_focus_area": "",
        }
    
    is_very_first_question = (
        state["current_section_index"] == 0 and state["questions_asked_in_section"] == 0
    )

    if is_very_first_question:
        username = state.get("username","")
        greeting_name = f", {username}" if username else ""
        return {
            "current_question": (
                f"Hi{greeting_name}, welcome! I'll be conducting your interview today "
                f"for the {state['role']} position at {state['company']}. "
                f"Before we dive in, I'd love to hear a bit about yourself — "
                f"your background, what you've been working on recently, and what draws you to this role."
            ),
            "current_question_type": "behavioral",
            "current_focus_area": "introduction",
        }

    result = await interviewer.generate_question(
        company=state["company"],
        role=state["role"],
        username=state["username"],
        context=state["context"],
        section_name=section.get("name", ""),
        section_type=section.get("type", ""),
        focus_areas=section.get("focus_areas", []),
        difficulty=state["difficulty"],
        previous_questions=state["previous_questions"],
    )

    return {
        "current_question": result.get("question", "N/A"),
        "current_question_type": result.get("question_type", "N/A"),
        "current_focus_area": result.get("focus_area", ""),
    }

async def evaluate_answer(state: InterviewState) -> dict[str, Any]:
    """Use EvaluatorAgent to score the answer."""
    section = current_section(state)
    section_name = section.get("name", "") if section else ""

    evaluation = await evaluator.evaluate(
        company=state["company"],
        role=state["role"],
        section=section_name,
        question=state["current_question"],
        context=state["context"],
        answer=state["current_answer"],
    )
    return {"evaluation": evaluation}


def difficulty_router(state: InterviewState) -> Literal["adjust", "store"]:
    """Route to difficulty adjustment only if the score is very off."""
    score = state["evaluation"].get("score", 5.0)
    if score >= 8.5 or score <= 4.0:
        return "adjust"
    return "store"


async def adjust_difficulty(state: InterviewState) -> dict[str, Any]:
    """Adjust difficulty level based on router output."""
    score = state["evaluation"].get("score", 5.0)
    current = state["difficulty"].lower()
    if score >= 8.5 and current != "hard":
        new_difficulty = "Hard" if current == "medium" else "Medium"
    elif score <= 4.0 and current != "easy":
        new_difficulty = "Easy" if current == "medium" else "Medium"
    else:
        new_difficulty = state["difficulty"]
    return {"difficulty": new_difficulty}

async def store_result(state: InterviewState) -> dict[str, Any]:
    """Persist Q&A + evaluation and advance section/question counters."""
    section = current_section(state)
    section_name = section.get("name", "") if section else ""
    current_focus_area=section.get("focus_areas", [""])[0] if section else ""
    entry = {
        "question": state["current_question"],
        "question_type": state["current_question_type"],
        "answer": state["current_answer"],
        "focus_area": current_focus_area,
        "evaluation": state["evaluation"],
        "section": section_name,
    }

    new_qa_history = state["qa_history"] + [entry]
    new_previous_questions = state["previous_questions"] + [state["current_question"]]
    new_asked = state["questions_asked_in_section"] + 1

    sections = state["blueprint"].get("sections", [])
    idx = state["current_section_index"]
    current_section_target = section["questions"] if section else 0

    if new_asked >= current_section_target:
        new_idx = idx + 1
        if new_idx >= len(sections):
            return {
                "qa_history": new_qa_history,
                "previous_questions": new_previous_questions,
                "questions_asked_in_section": 0,
                "interview_complete": True,
            }
        return{
            "qa_history": new_qa_history,
            "previous_questions": new_previous_questions,
            "current_section_index": new_idx,
            "questions_asked_in_section": 0,
            "interview_complete": False,
        }
    return{
        "qa_history": new_qa_history,
        "previous_questions": new_previous_questions,
        "questions_asked_in_section": new_asked,
        "interview_complete": False,
    }


def should_continue(state: InterviewState) -> Literal["continue", "end"]:
    """Decide whether to ask another question or end the interview."""
    if state.get("interview_complete"):
        return "end"
    return "continue"


# ── Build Graph ────────────────────────────────────────────────────────────────

def build_interview_graph() -> StateGraph:
    graph = StateGraph(InterviewState)

    graph.add_node("retrieve_context", retrieve_context)
    graph.add_node("generate_question", generate_question)
    graph.add_node("evaluate_answer", evaluate_answer)
    graph.add_node("adjust_difficulty", adjust_difficulty)
    # graph.add_node("generate_followup", generate_followup)    
    graph.add_node("store_result", store_result)

    graph.add_edge(START, "retrieve_context")
    graph.add_edge("retrieve_context", "generate_question")
    # "wait_for_answer" is handled externally via the API layer
    graph.add_edge("generate_question", "evaluate_answer")

    graph.add_conditional_edges(
        "evaluate_answer",
        difficulty_router,
        {
            "adjust": "adjust_difficulty",
            "store": "store_result",
        },
    )
    graph.add_edge("adjust_difficulty", "store_result")

    graph.add_conditional_edges(
        "store_result",
        should_continue,
        {
            "continue": "retrieve_context",
            "end": END,
        },
    )

    return graph


def get_interview_graph() -> StateGraph:
    checkpointer = MemorySaver()
    graph = build_interview_graph()
    return graph.compile(
        checkpointer=checkpointer,
        interrupt_after=["generate_question"]
    )

compiled_graph = get_interview_graph()