"""Voice-call interviews: questions are written for the ear and answers are known to be transcripts."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import pytest

from agents.conductor import SPOKEN_STYLE_SECTION, ConductorAgent
from agents.evaluator import VOICE_NOTE, EvaluatorAgent
from db.postgres import Interview, Question
from graph import interview_graph
from tests.fakes import FakeBlueprintGenerator, FakeGraph
from tests.test_api_interview import BLUEPRINT, auth_headers, client_for, install_graph, make_interview
from tests.test_prompt_safety import CapturingLLM

CONDUCTOR_REPLY = (
    '{"acknowledgment": "", "question": "Tell me about a project you led.", "question_type": "behavioral",'
    ' "section_name": "Screening", "focus_area": "Intro", "suggests_wrap_up": false}'
)
EVAL_REPLY = (
    '{"score": 6, "correctness": 6, "depth": 6, "communication": 6, "problem_solving": 6,'
    ' "strengths": [], "weaknesses": [], "brief_feedback": "ok"}'
)


# ── Prompts ───────────────────────────────────────────────────────────────────

async def _conductor_prompt(voice_mode: bool | None) -> str:
    agent = ConductorAgent()
    llm = CapturingLLM(CONDUCTOR_REPLY)
    agent.llm = llm
    kwargs: dict[str, Any] = {}
    if voice_mode is not None:
        kwargs["voice_mode"] = voice_mode
    await agent.next_turn(
        company="Acme", role="SDE", username="Ana", blueprint=BLUEPRINT, context="", difficulty="Medium",
        qa_history=[], **kwargs,
    )
    return llm.prompts[0]


async def test_conductor_writes_for_the_ear_only_in_voice_mode() -> None:
    spoken = await _conductor_prompt(True)
    assert SPOKEN_STYLE_SECTION in spoken
    assert "read aloud" in spoken and "no markdown" in spoken.lower().replace("use no markdown", "no markdown")
    assert "never read out scores" in spoken
    for text_prompt in (await _conductor_prompt(False), await _conductor_prompt(None)):
        assert "## Spoken conversation" not in text_prompt


async def _evaluator_prompt(voice_mode: bool | None) -> str:
    agent = EvaluatorAgent()
    llm = CapturingLLM(EVAL_REPLY)
    agent.llm = llm
    kwargs: dict[str, Any] = {} if voice_mode is None else {"voice_mode": voice_mode}
    await agent.evaluate(
        company="Acme", role="SDE", question="Two sum?", answer="i would use a hash map um to store seen numbers",
        context="", section="Coding", question_type="coding", **kwargs,
    )
    return llm.prompts[0]


async def test_evaluator_is_told_the_answer_is_a_transcript_only_in_voice_mode() -> None:
    spoken = await _evaluator_prompt(True)
    assert VOICE_NOTE.strip() in spoken and "transcribed automatically" in spoken
    assert "Ignore missing punctuation" in spoken
    for text_prompt in (await _evaluator_prompt(False), await _evaluator_prompt(None)):
        assert "## Spoken answer" not in text_prompt


# ── Graph nodes pass the flag through ─────────────────────────────────────────

class _Recorder:
    def __init__(self, result: dict[str, Any]) -> None:
        self.result, self.kwargs = result, None

    async def next_turn(self, **kwargs: Any) -> dict[str, Any]:
        self.kwargs = kwargs
        return self.result

    async def evaluate(self, **kwargs: Any) -> dict[str, Any]:
        self.kwargs = kwargs
        return self.result


def _state(**overrides: Any) -> dict[str, Any]:
    base = {
        "company": "Acme", "role": "SDE", "username": "Ana", "difficulty": "Medium", "blueprint": BLUEPRINT,
        "context": "", "qa_history": [], "current_question": "Q", "current_question_type": "technical",
        "current_section": "Screening", "current_answer": "A",
    }
    base.update(overrides)
    return base


@pytest.mark.parametrize("flag", [True, False])
async def test_graph_nodes_forward_voice_mode(monkeypatch: pytest.MonkeyPatch, flag: bool) -> None:
    conductor = _Recorder({"question": "Q", "question_type": "technical", "section_name": "Screening"})
    evaluator = _Recorder({"score": 5})
    monkeypatch.setattr(interview_graph, "conductor", conductor)
    monkeypatch.setattr(interview_graph, "evaluator", evaluator)

    await interview_graph.generate_question(_state(voice_mode=flag))
    await interview_graph.evaluate_answer(_state(voice_mode=flag))

    assert conductor.kwargs["voice_mode"] is flag and evaluator.kwargs["voice_mode"] is flag


async def test_graph_nodes_default_to_text_mode_for_old_checkpoints(monkeypatch: pytest.MonkeyPatch) -> None:
    """Interviews saved before this feature have no voice_mode key in their state."""
    conductor = _Recorder({"question": "Q", "question_type": "technical", "section_name": "Screening"})
    evaluator = _Recorder({"score": 5})
    monkeypatch.setattr(interview_graph, "conductor", conductor)
    monkeypatch.setattr(interview_graph, "evaluator", evaluator)

    await interview_graph.generate_question(_state())
    await interview_graph.evaluate_answer(_state())

    assert conductor.kwargs["voice_mode"] is False and evaluator.kwargs["voice_mode"] is False


# ── API ───────────────────────────────────────────────────────────────────────

def _prepare_start(monkeypatch: pytest.MonkeyPatch) -> FakeGraph:
    profile = SimpleNamespace(
        skills=["Go"], technologies=[], topics=["Arrays"], rounds=["Screening"], behavioral_patterns=[],
        key_insights=[], dsa_questions=[], difficulty="Medium", updated_at=datetime.now(timezone.utc),
    )

    async def fake_get_profile(db: Any, company: str, role: str) -> Any:
        return profile

    graph = install_graph(monkeypatch, FakeGraph(invoke_results=[{
        "current_question": "Tell me about yourself.", "current_question_type": "behavioral", "current_section": "Screening",
    }]))
    monkeypatch.setattr("api.interview.get_research_profile", fake_get_profile)
    monkeypatch.setattr("api.interview.blueprint_generator", FakeBlueprintGenerator(BLUEPRINT))
    return graph


@pytest.mark.parametrize(("payload", "expected"), [({}, False), ({"voice_mode": True}, True), ({"voice_mode": False}, False)])
async def test_start_records_voice_mode_in_the_graph_state(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch, payload: dict, expected: bool
) -> None:
    graph = _prepare_start(monkeypatch)
    async with client_for(api_app) as client:
        res = await client.post(
            "/api/interviews/start", json={"company": "Acme", "role": "SDE", **payload}, headers=auth_headers(1)
        )
    assert res.status_code == 200, res.text
    assert graph.invocations[0][0]["voice_mode"] is expected


def _answer_graph(monkeypatch: pytest.MonkeyPatch) -> FakeGraph:
    result = {
        "evaluation": {"score": 6.0, "fallback": False}, "interview_complete": False,
        "current_question": "Q2", "current_question_type": "behavioral", "current_section": "Screening",
        "current_acknowledgment": "", "previous_questions": ["Q1"],
    }
    return install_graph(monkeypatch, FakeGraph(state_values={"blueprint": BLUEPRINT}, invoke_results=[result]))


@pytest.mark.parametrize(
    ("payload", "expected_update"),
    [
        ({}, {"current_answer": "A1"}),  # unset: the interview's setting is left alone
        ({"voice_mode": True}, {"current_answer": "A1", "voice_mode": True}),
        ({"voice_mode": False}, {"current_answer": "A1", "voice_mode": False}),  # switching back to typing
    ],
)
@pytest.mark.parametrize("path", ["/answer", "/answer/stream"])
async def test_answer_can_switch_the_interview_between_voice_and_text(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch, path: str, payload: dict, expected_update: dict
) -> None:
    fake_db.register(Interview, 1, make_interview())
    graph = _answer_graph(monkeypatch)
    fake_db.queue_result(Question(id=10, interview_id=1, question="Q1", order_index=0))
    async with client_for(api_app) as client:
        res = await client.post(f"/api/interviews/1{path}", json={"answer": "A1", **payload}, headers=auth_headers(1))
    assert res.status_code == 200, res.text
    assert graph.updates[0] == expected_update


async def test_voice_mode_must_be_a_boolean(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_db.register(Interview, 1, make_interview())
    _answer_graph(monkeypatch)
    async with client_for(api_app) as client:
        res = await client.post(
            "/api/interviews/1/answer", json={"answer": "A1", "voice_mode": "maybe"}, headers=auth_headers(1)
        )
    assert res.status_code == 422
