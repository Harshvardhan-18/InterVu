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

from typing import Annotated, Any, Literal

from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


# ── State ─────────────────────────────────────────────────────────────────────

class InterviewState(TypedDict):
    # Session info
    company: str
    role: str
    difficulty: str  # "easy" | "medium" | "hard"

    # Blueprint
    blueprint: dict[str, Any]
    current_section_index: int
    questions_asked_in_section: int

    # Current turn
    context: str
    current_question: str
    current_answer: str
    evaluation: dict[str, Any]

    # History
    previous_questions: list[str]
    qa_history: list[dict[str, Any]]

    # Control
    needs_followup: bool
    followup_question: str | None
    interview_complete: bool


# ── Node stubs (wire in real agents when implementing) ─────────────────────────

def retrieve_context(state: InterviewState) -> dict[str, Any]:
    """Retrieve relevant context from ChromaDB for current section."""
    # TODO: wire to RAGRetriever
    return {"context": "placeholder context"}


def generate_question(state: InterviewState) -> dict[str, Any]:
    """Use InterviewerAgent to generate the next question."""
    # TODO: wire to InterviewerAgent
    return {"current_question": "placeholder question"}


def evaluate_answer(state: InterviewState) -> dict[str, Any]:
    """Use EvaluatorAgent to score the answer."""
    # TODO: wire to EvaluatorAgent
    return {
        "evaluation": {
            "score": 7.0,
            "strengths": [],
            "weaknesses": [],
            "brief_feedback": "placeholder",
        }
    }


def difficulty_router(state: InterviewState) -> Literal["increase", "decrease", "same"]:
    """Route to difficulty adjustment based on evaluation score."""
    score = state["evaluation"].get("score", 5.0)
    if score >= 8.0:
        return "increase"
    elif score <= 4.0:
        return "decrease"
    return "same"


def adjust_difficulty(state: InterviewState) -> dict[str, Any]:
    """Adjust difficulty level based on router output."""
    # TODO: implement adaptive difficulty logic
    return {}


def generate_followup(state: InterviewState) -> dict[str, Any]:
    """Optionally generate a follow-up question."""
    # TODO: wire to FollowUpAgent
    return {"followup_question": None, "needs_followup": False}


def store_result(state: InterviewState) -> dict[str, Any]:
    """Persist Q&A + evaluation to PostgreSQL."""
    # TODO: wire to postgres.py
    entry = {
        "question": state["current_question"],
        "answer": state["current_answer"],
        "evaluation": state["evaluation"],
    }
    return {
        "qa_history": state["qa_history"] + [entry],
        "previous_questions": state["previous_questions"] + [state["current_question"]],
    }


def should_continue(state: InterviewState) -> Literal["continue", "end"]:
    """Decide whether to ask another question or end the interview."""
    if state.get("interview_complete"):
        return "end"
    blueprint = state.get("blueprint", {})
    sections = blueprint.get("sections", [])
    idx = state.get("current_section_index", 0)
    if idx >= len(sections):
        return "end"
    return "continue"


# ── Build Graph ────────────────────────────────────────────────────────────────

def build_interview_graph() -> StateGraph:
    graph = StateGraph(InterviewState)

    graph.add_node("retrieve_context", retrieve_context)
    graph.add_node("generate_question", generate_question)
    graph.add_node("evaluate_answer", evaluate_answer)
    graph.add_node("adjust_difficulty", adjust_difficulty)
    graph.add_node("generate_followup", generate_followup)
    graph.add_node("store_result", store_result)

    graph.add_edge(START, "retrieve_context")
    graph.add_edge("retrieve_context", "generate_question")
    # NOTE: "wait_for_answer" is handled externally via the API layer
    graph.add_edge("generate_question", "evaluate_answer")

    graph.add_conditional_edges(
        "evaluate_answer",
        difficulty_router,
        {
            "increase": "adjust_difficulty",
            "decrease": "adjust_difficulty",
            "same": "generate_followup",
        },
    )
    graph.add_edge("adjust_difficulty", "generate_followup")
    graph.add_edge("generate_followup", "store_result")

    graph.add_conditional_edges(
        "store_result",
        should_continue,
        {
            "continue": "retrieve_context",
            "end": END,
        },
    )

    return graph


interview_graph = build_interview_graph()
compiled_graph = interview_graph.compile()
