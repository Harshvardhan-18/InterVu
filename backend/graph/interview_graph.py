"""
LangGraph Interview Graph
-------------------------
Core stateful graph that orchestrates the multi-turn interview:

  START
    |
    v
  retrieve_context
    |
    v
  generate_question
    |
    v
  (interrupt: wait for the candidate's answer via the API layer)
    |
    v
  evaluate_answer
    |
    v
  difficulty_router -------> adjust_difficulty
    |                              |
    v                              v
  store_result  <------------------
    |
    v
  END or NEXT QUESTION (back to retrieve_context)
"""

from __future__ import annotations

import logging
import os
from typing import Any, Literal

from dotenv import load_dotenv
from typing_extensions import TypedDict
from langgraph.graph import END, START, StateGraph

from agents.registry import conductor, evaluator
from rag.retriever import get_retriever
from utils.difficulty import step_difficulty

load_dotenv()

logger = logging.getLogger(__name__)


# ── State ─────────────────────────────────────────────────────────────────────

class InterviewState(TypedDict):
    # Session info
    company: str
    role: str
    difficulty: str  # "Easy" | "Medium" | "Hard"
    username: str

    # Blueprint
    blueprint: dict[str, Any]

    # Optional resume text (opt-in, untrusted); "" when not used.
    candidate_background: str

    # Current turn
    context: str
    current_question: str
    current_question_type: str
    current_section: str
    current_acknowledgment: str
    current_focus_area: str
    current_answer: str
    evaluation: dict[str, Any]

    # History
    previous_questions: list[str]
    qa_history: list[dict[str, Any]]

    # Control
    interview_complete: bool
    llm_suggests_wrap_up: bool


# ── Helper Function ───────────────────────────────────────────────────────────
MAX_TOTAL_QUESTIONS = 15
MIN_QUESTIONS_PER_SECTION = 1


def graph_config(interview_id: int) -> dict[str, Any]:
    """LangGraph thread config: one checkpoint thread per interview session."""
    return {"configurable": {"thread_id": str(interview_id)}}


def _score(evaluation: dict[str, Any] | None, default: float = 5.0) -> float:
    """Read a numeric score from an evaluation dict, tolerating bad values."""
    try:
        return float((evaluation or {}).get("score", default))
    except (TypeError, ValueError):
        return default


def _sections_covered(blueprint: dict, qa_history: list[dict]) -> set[str]:
    """Which section names have been asked about at least once."""
    return {entry.get("section", "") for entry in qa_history}


def _all_sections_covered(blueprint: dict, qa_history: list[dict]) -> bool:
    all_section_names = {s["name"] for s in blueprint.get("sections", [])}
    covered = _sections_covered(blueprint, qa_history)
    return all_section_names.issubset(covered)


def _should_end_interview(blueprint: dict, qa_history: list[dict], llm_suggests_wrap_up: bool) -> bool:
    total_asked = len(qa_history)

    # Hard ceiling: always stop regardless of LLM opinion
    if total_asked >= MAX_TOTAL_QUESTIONS:
        return True

    # Never end before every section has been touched at least once,
    # even if the LLM wants to wrap up early
    if not _all_sections_covered(blueprint, qa_history):
        return False

    # Once minimum coverage is satisfied, trust the LLM's judgment
    return bool(llm_suggests_wrap_up)


# ── Nodes ─────────────────────────────────────────────────────────────────────

async def retrieve_context(state: InterviewState) -> dict[str, Any]:
    """Retrieve relevant context from ChromaDB, blending all section focus areas
    weighted toward sections not yet covered."""
    blueprint = state["blueprint"]
    covered = _sections_covered(blueprint, state["qa_history"])
    uncovered_sections = [s for s in blueprint.get("sections", []) if s["name"] not in covered]

    target_sections = uncovered_sections or blueprint.get("sections", [])
    focus_areas = [fa for s in target_sections for fa in s.get("focus_areas", [])]

    query = f"{state['company']} {state['role']} {' '.join(focus_areas[:8])} interview question"
    try:
        retriever = get_retriever()
        chunks = await retriever.retrieve(query, company=state["company"], role=state["role"])
        context = retriever.format_context(chunks) if chunks else "No relevant context found."
    except Exception as exc:  # noqa: BLE001 - RAG is best-effort; the interview must go on
        logger.warning("[graph] Context retrieval failed, continuing without context: %s", exc)
        context = "No relevant context found."
    return {"context": context}


async def generate_question(state: InterviewState) -> dict[str, Any]:
    """Use ConductorAgent to generate the next turn, with full conversation context."""
    result = await conductor.next_turn(
        company=state["company"],
        role=state["role"],
        username=state["username"],
        context=state["context"],
        blueprint=state["blueprint"],
        difficulty=state["difficulty"],
        qa_history=state["qa_history"],
        candidate_background=state.get("candidate_background", ""),
    )

    return {
        "current_question": result.get("question", "N/A"),
        "current_question_type": result.get("question_type", "N/A"),
        "current_focus_area": result.get("focus_area", ""),
        "current_section": result.get("section_name", ""),
        "current_acknowledgment": result.get("acknowledgment", ""),
        "llm_suggests_wrap_up": result.get("suggests_wrap_up", False)
    }


async def evaluate_answer(state: InterviewState) -> dict[str, Any]:
    """Use EvaluatorAgent to score the answer."""

    evaluation = await evaluator.evaluate(
        company=state["company"],
        role=state["role"],
        section=state["current_section"],
        question=state["current_question"],
        question_type=state["current_question_type"],
        context=state["context"],
        answer=state["current_answer"],
    )
    return {"evaluation": evaluation}


def difficulty_router(state: InterviewState) -> Literal["adjust", "store"]:
    """Route to difficulty adjustment only if the score is very off."""
    score = _score(state.get("evaluation"))
    if score >= 8.5 or score <= 4.0:
        return "adjust"
    return "store"


async def adjust_difficulty(state: InterviewState) -> dict[str, Any]:
    """Move difficulty one level up or down based on the latest score."""
    return {"difficulty": step_difficulty(state.get("difficulty"), _score(state.get("evaluation")))}


async def store_result(state: InterviewState) -> dict[str, Any]:
    """Persist Q&A + evaluation and advance section/question counters."""
    entry = {
        "question": state["current_question"],
        "question_type": state["current_question_type"],
        "answer": state["current_answer"],
        "focus_area": state["current_focus_area"],
        "evaluation": state["evaluation"],
        "section": state["current_section"],
    }

    new_qa_history = state["qa_history"] + [entry]
    new_previous_questions = state["previous_questions"] + [state["current_question"]]

    interview_complete = _should_end_interview(
        blueprint=state["blueprint"],
        qa_history=new_qa_history,
        llm_suggests_wrap_up=state["llm_suggests_wrap_up"]
    )

    return {
        "qa_history": new_qa_history,
        "previous_questions": new_previous_questions,
        "interview_complete": interview_complete,
    }


def should_continue(state: InterviewState) -> Literal["continue", "end"]:
    """Decide whether to ask another question or end the interview."""
    return "end" if state["interview_complete"] else "continue"


# ── Build Graph ────────────────────────────────────────────────────────────────

def build_interview_graph() -> StateGraph:
    graph = StateGraph(InterviewState)

    graph.add_node("retrieve_context", retrieve_context)
    graph.add_node("generate_question", generate_question)
    graph.add_node("evaluate_answer", evaluate_answer)
    graph.add_node("adjust_difficulty", adjust_difficulty)
    graph.add_node("store_result", store_result)

    graph.add_edge(START, "retrieve_context")
    graph.add_edge("retrieve_context", "generate_question")
    # Waiting for the answer is handled externally via the API layer (interrupt_after).
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


_pool: Any = None
compiled_graph: Any = None


async def init_graph():
    """
    Call once at FastAPI startup (in the lifespan handler).
    Initializes a Postgres-backed checkpointer so interview sessions survive
    server restarts, and compiles the graph.
    """
    global _pool, compiled_graph

    # Imported lazily so importing this module never needs a database driver.
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg.rows import dict_row
    from psycopg_pool import AsyncConnectionPool

    conn_string = os.getenv("DATABASE_URL_PSYCOPG")
    if not conn_string:
        raise ValueError("DATABASE_URL_PSYCOPG environment variable is not set.")

    _pool = AsyncConnectionPool(
        conninfo=conn_string,
        kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
        min_size=1,
        max_size=10,
        open=False,
    )
    await _pool.open()

    checkpointer = AsyncPostgresSaver(conn=_pool)
    await checkpointer.setup()

    graph = build_interview_graph()
    compiled_graph = graph.compile(
        checkpointer=checkpointer,
        interrupt_after=["generate_question"]
    )
    logger.info("[graph] Interview graph initialized and compiled with Postgres checkpointer pool.")
    return compiled_graph


async def close_graph():
    """
    Call once at FastAPI shutdown (in the lifespan handler).
    Closes the Postgres-backed checkpointer pool.
    """
    global _pool, compiled_graph
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("[graph] Interview graph checkpointer pool closed.")
    compiled_graph = None


def is_graph_ready() -> bool:
    """True once init_graph() has compiled the graph."""
    return compiled_graph is not None


def get_compiled_graph():
    """
    Accessor for the compiled graph. Raises if called before init_graph()
    has run, which gives a clear error instead of a cryptic NoneType crash.
    """
    if compiled_graph is None:
        raise RuntimeError(
            "Compiled graph is not initialized. Call init_graph() first."
        )
    return compiled_graph
