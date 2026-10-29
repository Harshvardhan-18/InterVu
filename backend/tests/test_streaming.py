"""Server-Sent Events variants of start and answer, and the helpers behind them."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import pytest

from db.postgres import Interview, Question, Response
from tests.fakes import FakeBlueprintGenerator, FakeFeedbackAgent, FakeGraph
from tests.test_api_interview import BLUEPRINT, added, auth_headers, client_for, install_graph, make_interview
from utils.locks import interview_locks

EVALUATION = {"score": 7.5, "brief_feedback": "Good.", "fallback": False}


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        events.append((lines["event"], json.loads(lines["data"])))
    return events


@pytest.fixture
def feedback(monkeypatch: pytest.MonkeyPatch) -> FakeFeedbackAgent:
    agent = FakeFeedbackAgent()
    monkeypatch.setattr("services.reports.feedback_agent", agent)
    return agent


# ── Start ─────────────────────────────────────────────────────────────────────

def _start_setup(monkeypatch: pytest.MonkeyPatch, cached: bool = False, pipeline_result: dict | None = None,
                 blueprint: dict | None = None) -> FakeGraph:
    profile = SimpleNamespace(
        skills=["Python"], technologies=[], topics=["Arrays"], rounds=["Screening"], behavioral_patterns=[],
        key_insights=[], dsa_questions=[], difficulty="Medium", updated_at=datetime.now(timezone.utc),
    )

    async def fake_get_profile(db: Any, company: str, role: str) -> Any:
        return profile if cached else None

    async def fake_save(db: Any, company: str, role: str, extracted: dict) -> None:
        return None

    class Pipeline:
        async def run(self, company: str, role: str, on_stage: Any = None) -> dict:
            for stage in ("searching", "scraping", "extracting", "indexing"):
                if on_stage:
                    await on_stage(stage)
            return {"extracted": pipeline_result if pipeline_result is not None else {"skills": ["Go"], "difficulty": "Hard"}}

    graph = install_graph(monkeypatch, FakeGraph(invoke_results=[{
        "current_question": "Tell me about yourself.", "current_question_type": "behavioral", "current_section": "Screening",
    }]))
    monkeypatch.setattr("api.interview.get_research_profile", fake_get_profile)
    monkeypatch.setattr("api.interview.save_research_profile", fake_save)
    monkeypatch.setattr("api.interview.ResearchPipeline", Pipeline)
    monkeypatch.setattr("api.interview.blueprint_generator", FakeBlueprintGenerator(blueprint or BLUEPRINT))
    return graph


async def test_start_stream_reports_real_stages_then_the_result(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    _start_setup(monkeypatch)
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start/stream", json={"company": "Acme", "role": "SDE"}, headers=auth_headers(1))

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    assert res.headers["cache-control"] == "no-store"
    events = parse_sse(res.text)
    stages = [data["stage"] for name, data in events if name == "stage"]
    assert stages == ["searching", "scraping", "extracting", "indexing", "planning", "starting"]
    name, result = events[-1]
    assert name == "result" and result["first_question"] == "Tell me about yourself." and result["interview_id"] == 1
    assert result["degraded"] is False
    assert len(added(fake_db, Interview)) == 1 and fake_db.committed


async def test_start_stream_with_cached_research_skips_pipeline_stages(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    _start_setup(monkeypatch, cached=True)
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start/stream", json={"company": "Acme", "role": "SDE"}, headers=auth_headers(1))
    stages = [d["stage"] for n, d in parse_sse(res.text) if n == "stage"]
    assert stages == ["planning", "starting"]


async def test_start_stream_reports_failures_as_an_error_event(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    _start_setup(monkeypatch, pipeline_result={}, blueprint={"sections": BLUEPRINT["sections"], "fallback": True})
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start/stream", json={"company": "Acme", "role": "SDE"}, headers=auth_headers(1))
    assert res.status_code == 200  # the stream itself opened fine
    name, data = parse_sse(res.text)[-1]
    assert name == "error" and data["status"] == 503 and "unavailable" in data["detail"]
    assert added(fake_db, Interview) == []


async def test_start_stream_unexpected_errors_do_not_leak_details(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    _start_setup(monkeypatch, cached=True)

    class Exploding(FakeBlueprintGenerator):
        async def generate(self, **kwargs: Any) -> dict:
            raise RuntimeError("secret-internal-detail postgres://user:pw@host")

    monkeypatch.setattr("api.interview.blueprint_generator", Exploding())
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start/stream", json={"company": "Acme", "role": "SDE"}, headers=auth_headers(1))
    name, data = parse_sse(res.text)[-1]
    assert name == "error" and data["status"] == 500
    assert "secret-internal-detail" not in res.text and "postgres://" not in res.text


async def test_start_stream_requires_auth_and_validates_input(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    _start_setup(monkeypatch)
    async with client_for(api_app) as client:
        assert (await client.post("/api/interviews/start/stream", json={"company": "A", "role": "B"})).status_code == 401
        assert (await client.post("/api/interviews/start/stream", json={"company": "", "role": "B"}, headers=auth_headers(1))).status_code == 422
        mismatch = await client.post(
            "/api/interviews/start/stream", json={"user_id": 2, "company": "A", "role": "B"}, headers=auth_headers(1)
        )
    assert mismatch.status_code == 403


# ── Answer ────────────────────────────────────────────────────────────────────

def _answer_graph(monkeypatch: pytest.MonkeyPatch, complete: bool = False) -> FakeGraph:
    result = {
        "evaluation": EVALUATION,
        "interview_complete": complete,
        "current_question": "Q2", "current_question_type": "coding", "current_section": "Screening",
        "current_acknowledgment": "Nice.", "previous_questions": ["Q1"],
        "qa_history": [{"question": "Q1", "answer": "A1", "section": "Screening", "evaluation": EVALUATION}],
    }
    return install_graph(monkeypatch, FakeGraph(state_values={"blueprint": BLUEPRINT}, invoke_results=[result]))


async def test_answer_stream_sends_the_evaluation_before_the_next_question(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_db.register(Interview, 1, make_interview())
    _answer_graph(monkeypatch)
    fake_db.queue_result(Question(id=10, interview_id=1, question="Q1", order_index=0))
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer/stream", json={"answer": "A1"}, headers=auth_headers(1))

    events = parse_sse(res.text)
    names = [n for n, _ in events]
    assert names == ["stage", "evaluation", "stage", "result"]
    assert events[0][1] == {"stage": "evaluating"} and events[2][1] == {"stage": "preparing_next"}
    assert events[1][1]["evaluation"]["score"] == 7.5
    result = events[-1][1]
    assert result["next_question"] == "Q2" and result["next_question_type"] == "coding" and result["interview_complete"] is False
    assert added(fake_db, Response)[0].answer == "A1" and added(fake_db, Question)[0].question == "Q2"
    assert len(interview_locks) == 0  # the lock is released once the step is saved


async def test_answer_stream_completion_streams_the_report_stage(api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch) -> None:
    interview = make_interview()
    fake_db.register(Interview, 1, interview)
    _answer_graph(monkeypatch, complete=True)
    fake_db.queue_result(Question(id=10, interview_id=1, question="Q1", order_index=0))
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer/stream", json={"answer": "A1"}, headers=auth_headers(1))
    events = parse_sse(res.text)
    assert ("stage", {"stage": "report"}) in events
    result = events[-1][1]
    assert result["interview_complete"] is True and result["report_ready"] is True and result["next_question_type"] is None
    assert interview.status == "completed" and len(feedback.calls) == 1


async def test_answer_stream_precondition_errors_are_plain_http_errors(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    fake_db.register(Interview, 2, make_interview(id=2))
    fake_db.register(Interview, 3, make_interview(id=3, user_id=99))
    _answer_graph(monkeypatch)
    async with client_for(api_app) as client:
        done = await client.post("/api/interviews/1/answer/stream", json={"answer": "A"}, headers=auth_headers(1))
        other = await client.post("/api/interviews/3/answer/stream", json={"answer": "A"}, headers=auth_headers(1))
        anon = await client.post("/api/interviews/2/answer/stream", json={"answer": "A"})
        empty = await client.post("/api/interviews/2/answer/stream", json={"answer": ""}, headers=auth_headers(1))
        async with interview_locks.hold(2):
            busy = await client.post("/api/interviews/2/answer/stream", json={"answer": "A"}, headers=auth_headers(1))
    assert (done.status_code, other.status_code, anon.status_code, empty.status_code, busy.status_code) == (400, 404, 401, 422, 409)
    assert len(interview_locks) == 0


async def test_answer_stream_session_lost_is_reported_in_the_stream(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_db.register(Interview, 1, make_interview())
    install_graph(monkeypatch, FakeGraph(state_values={}))  # no checkpoint: a restart lost the session
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer/stream", json={"answer": "A1"}, headers=auth_headers(1))
    name, data = parse_sse(res.text)[-1]
    assert name == "error" and data["status"] == 410
    assert len(interview_locks) == 0


async def test_answer_stream_failure_still_releases_the_lock(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_db.register(Interview, 1, make_interview())

    class Boom(FakeGraph):
        async def astream(self, *a: Any, **k: Any):
            raise RuntimeError("graph exploded")
            yield  # pragma: no cover

    install_graph(monkeypatch, Boom(state_values={"blueprint": BLUEPRINT}))
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer/stream", json={"answer": "A1"}, headers=auth_headers(1))
        assert parse_sse(res.text)[-1][0] == "error"
        assert len(interview_locks) == 0
        retry = await client.post("/api/interviews/1/answer/stream", json={"answer": "A1"}, headers=auth_headers(1))
    assert retry.status_code == 200  # not stuck behind a leaked lock


# ── Daily limit via the stream ────────────────────────────────────────────────

async def test_answer_stream_respects_the_daily_token_limit(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_db.register(Interview, 1, make_interview())
    _answer_graph(monkeypatch)
    monkeypatch.setenv("DAILY_TOKEN_LIMIT", "100")
    fake_db.queue_result(100)
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer/stream", json={"answer": "A1"}, headers=auth_headers(1))
    name, data = parse_sse(res.text)[-1]
    assert name == "error" and data["status"] == 429
    assert added(fake_db, Response) == []


# ── The lock is released explicitly, not by garbage collection ────────────────

class SpyLocks:
    """Class-based (not generator-based) lock stand-in: an exit is only recorded if it is really called."""

    def __init__(self) -> None:
        self.events: list[str] = []

    def is_locked(self, key: Any) -> bool:
        return False

    def hold(self, key: Any) -> "SpyLocks":
        return self

    async def __aenter__(self) -> None:
        self.events.append("enter")

    async def __aexit__(self, *exc: Any) -> bool:
        self.events.append("exit")
        return False


@pytest.mark.parametrize("fail", [False, True])
async def test_answer_stream_releases_the_lock_explicitly(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch, fail: bool
) -> None:
    spy = SpyLocks()
    monkeypatch.setattr("api.interview.interview_locks", spy)
    fake_db.register(Interview, 1, make_interview())
    if fail:
        install_graph(monkeypatch, FakeGraph(state_values={}))  # session lost -> the stream ends in an error event
    else:
        _answer_graph(monkeypatch)
        fake_db.queue_result(Question(id=10, interview_id=1, question="Q1", order_index=0))
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer/stream", json={"answer": "A1"}, headers=auth_headers(1))
    assert parse_sse(res.text)[-1][0] == ("error" if fail else "result")
    assert spy.events == ["enter", "exit"]
