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
from agents.registry import interviewer,evaluator, conductor
import os
from dotenv import load_dotenv
load_dotenv()
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

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

    # Current turn
    context: str
    current_question: str
    current_question_type: str
    current_section:str
    current_acknowledgment: str
    current_focus_area: str
    current_answer: str
    evaluation: dict[str, Any]

    # History
    previous_questions: list[str]
    qa_history: list[dict[str, Any]]

    # Control
    needs_followup: bool
    followup_question: str | None
    interview_complete: bool
    llm_suggests_wrap_up: bool

# ── Helper Function ───────────────────────────────────────────────────────────
MAX_TOTAL_QUESTIONS = 15
MIN_QUESTIONS_PER_SECTION = 1

def _sections_covered(blueprint: dict, qa_history: list[dict]) -> set[str]:
    """Which section names have been asked about at least once."""
    return {entry["section"] for entry in qa_history}

def _all_sections_covered(blueprint: dict, qa_history: list[dict]) -> bool:
    all_section_names = {s["name"] for s in blueprint.get("sections", [])}
    covered = _sections_covered(blueprint, qa_history)
    return all_section_names.issubset(covered)

def _should_end_interview(blueprint: dict, qa_history: list[dict], llm_suggests_wrap_up: bool) -> bool:
    total_asked = len(qa_history)

    # Hard ceiling — always stop regardless of LLM opinion
    if total_asked >= MAX_TOTAL_QUESTIONS:
        return True

    # Never end before every section has been touched at least once,
    # even if the LLM wants to wrap up early
    if not _all_sections_covered(blueprint, qa_history):
        return False

    # Once minimum coverage is satisfied, trust the LLM's judgment
    return llm_suggests_wrap_up

# ── Node stubs (wire in real agents when implementing) ─────────────────────────

async def retrieve_context(state: InterviewState) -> dict[str, Any]:
    """Retrieve relevant context from ChromaDB, blending all section focus areas
    weighted toward sections not yet covered."""
    blueprint = state["blueprint"]
    covered= _sections_covered(blueprint, state["qa_history"])
    uncovered_sections = [s for s in blueprint.get("sections", []) if s["name"] not in covered]

    target_sections = uncovered_sections or blueprint.get("sections", [])
    focus_areas = [fa for s in target_sections for fa in s.get("focus_areas", [])]

    query = f"{state['company']} {state['role']} {' '.join(focus_areas[:8])} interview question"
    chunks = _retriever.retrieve(query, company=state["company"], role=state["role"])
    context = _retriever.format_context(chunks) if chunks else "No relevant context found."
    return {"context": context}

async def generate_question(state: InterviewState) -> dict[str, Any]:
    """Use ConductorAgent to generate the next turn, with full conversation context."""
    print(f"[DEBUG] generate_question called. qa_history length: {len(state.get('qa_history', []))}")
    print(f"[DEBUG] qa_history contents: {state.get('qa_history', [])}")
    result = await conductor.next_turn(
        company=state["company"],
        role=state["role"],
        username=state["username"],
        context=state["context"],
        blueprint=state["blueprint"],
        difficulty=state["difficulty"],
        qa_history=state["qa_history"],
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

_checkpointer_cm = None
compiled_graph:Any = None

async def init_graph():
    """
    Call once at FastAPI startup (in the lifespan handler).
    Initializes a Postgres-backed checkpointer so interview sessions survive
    server restarts, and compiles the graph.
    """
    global _checkpointer_cm, compiled_graph

    conn_string = os.getenv("DATABASE_URL_PSYCOPG")
    if not conn_string:
        raise ValueError("DATABASE_URL_PSYCOPG environment variable is not set.")

    _checkpointer_cm = AsyncPostgresSaver.from_conn_string(conn_string=conn_string)
    checkpointer = await _checkpointer_cm.__aenter__()
    await checkpointer.setup()

    graph = build_interview_graph()
    compiled_graph = graph.compile(
        checkpointer=checkpointer,
        interrupt_after=["generate_question"]
    )
    print("[graph] Interview graph initialized and compiled with Postgres checkpointer.")
    return compiled_graph
    
    
    
async def close_graph():
    """
    Call once at FastAPI shutdown (in the lifespan handler).
    Closes the Postgres-backed checkpointer.
    """
    global _checkpointer_cm
    if _checkpointer_cm:
        await _checkpointer_cm.__aexit__(None, None, None)
        print("[graph] Interview graph checkpointer closed.")

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
