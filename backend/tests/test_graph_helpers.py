"""Unit tests for the pure helpers and simple nodes of graph/interview_graph.py."""

from __future__ import annotations

import pytest

from graph import interview_graph as ig

BLUEPRINT = {
    "sections": [
        {"name": "Screening", "type": "screening", "questions": 1, "focus_areas": []},
        {"name": "Coding", "type": "coding", "questions": 2, "focus_areas": []},
    ]
}


def _entries(*sections: str) -> list[dict]:
    return [{"section": name, "question": "q", "answer": "a", "evaluation": {"score": 5}} for name in sections]


def test_does_not_end_before_every_section_is_covered() -> None:
    assert ig._should_end_interview(BLUEPRINT, _entries("Screening"), llm_suggests_wrap_up=True) is False


def test_ends_when_covered_and_llm_suggests_wrap_up() -> None:
    assert ig._should_end_interview(BLUEPRINT, _entries("Screening", "Coding"), llm_suggests_wrap_up=True) is True


def test_continues_when_covered_but_llm_wants_more() -> None:
    assert ig._should_end_interview(BLUEPRINT, _entries("Screening", "Coding"), llm_suggests_wrap_up=False) is False


def test_hard_ceiling_ends_interview_even_if_uncovered() -> None:
    history = _entries(*(["Screening"] * ig.MAX_TOTAL_QUESTIONS))
    assert ig._should_end_interview(BLUEPRINT, history, llm_suggests_wrap_up=False) is True


@pytest.mark.parametrize(
    ("difficulty", "score", "expected"),
    [
        ("medium", 9.0, "Hard"),
        ("Medium", 3.0, "Easy"),
        ("easy", 9.0, "Medium"),
        ("hard", 9.0, "Hard"),
        ("Easy", 1.0, "Easy"),
        ("HARD", 2.0, "Medium"),
    ],
)
async def test_adjust_difficulty_returns_title_case(difficulty: str, score: float, expected: str) -> None:
    state = {"difficulty": difficulty, "evaluation": {"score": score}}
    assert await ig.adjust_difficulty(state) == {"difficulty": expected}


@pytest.mark.parametrize(
    ("score", "route"),
    [(9.0, "adjust"), (8.5, "adjust"), (4.0, "adjust"), (1.0, "adjust"), (6.0, "store"), ("bad", "store"), (None, "store")],
)
def test_difficulty_router(score: object, route: str) -> None:
    assert ig.difficulty_router({"evaluation": {"score": score}}) == route


def test_difficulty_router_without_evaluation() -> None:
    assert ig.difficulty_router({"evaluation": {}}) == "store"


async def test_store_result_appends_history_and_flags_completion() -> None:
    state = {
        "blueprint": BLUEPRINT,
        "qa_history": _entries("Screening"),
        "previous_questions": ["q0"],
        "current_question": "q1",
        "current_question_type": "coding",
        "current_answer": "answer",
        "current_focus_area": "Arrays",
        "current_section": "Coding",
        "evaluation": {"score": 7},
        "llm_suggests_wrap_up": True,
    }
    result = await ig.store_result(state)
    assert len(result["qa_history"]) == 2
    assert result["qa_history"][-1]["section"] == "Coding"
    assert result["previous_questions"] == ["q0", "q1"]
    assert result["interview_complete"] is True


def test_graph_config_uses_interview_id_as_thread() -> None:
    assert ig.graph_config(12) == {"configurable": {"thread_id": "12"}}


def test_get_compiled_graph_raises_before_init(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ig, "compiled_graph", None)
    assert ig.is_graph_ready() is False
    with pytest.raises(RuntimeError):
        ig.get_compiled_graph()
