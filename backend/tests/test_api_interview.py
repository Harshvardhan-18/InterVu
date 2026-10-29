"""
API tests for /api/auth and /api/interviews.

The DB is the in-memory FakeAsyncSession from conftest.py, the LangGraph graph
is replaced by tests.fakes.FakeGraph and every LLM agent is faked, so no
network, API key or database is needed. httpx.ASGITransport does not run the
FastAPI lifespan, so create_tables()/init_graph() are never called.
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import httpx
import pytest

from db.postgres import Interview, Question, Report, Response
from tests.fakes import FakeBlueprintGenerator, FakeFeedbackAgent, FakeGraph
from utils.auth import create_access_token, verify_token

BLUEPRINT = {
    "sections": [{"name": "Screening", "type": "screening", "questions": 1, "focus_areas": ["Intro"]}]
}


def auth_headers(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id, ttl_seconds=3600)}"}


def client_for(app: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


def make_interview(**overrides: Any) -> Interview:
    data: dict[str, Any] = {
        "id": 1,
        "user_id": 1,
        "company": "Acme",
        "role": "SDE",
        "difficulty": "Medium",
        "blueprint": BLUEPRINT,
        "status": "in_progress",
    }
    data.update(overrides)
    return Interview(**data)


@pytest.fixture
def feedback(monkeypatch: pytest.MonkeyPatch) -> FakeFeedbackAgent:
    agent = FakeFeedbackAgent()
    monkeypatch.setattr("services.reports.feedback_agent", agent)
    return agent


def install_graph(monkeypatch: pytest.MonkeyPatch, graph: FakeGraph) -> FakeGraph:
    monkeypatch.setattr("graph.interview_graph.compiled_graph", graph)
    return graph


def added(fake_db: Any, model: type) -> list[Any]:
    return [obj for obj in fake_db.added if isinstance(obj, model)]


# ── Auth ──────────────────────────────────────────────────────────────────────

async def test_login_creates_user_normalizes_email_and_returns_token(api_app: Any, fake_db: Any) -> None:
    async with client_for(api_app) as client:
        res = await client.post("/api/auth/login", json={"name": "  Ana   Lee ", "email": "  Ana@Example.COM "})

    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "ana@example.com"
    assert body["name"] == "Ana Lee"
    assert body["is_new"] is True
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0
    assert verify_token(body["access_token"]) == body["user_id"]
    assert {"user_id", "name", "email", "is_new"} <= body.keys()


async def test_login_returns_existing_user(api_app: Any, fake_db: Any) -> None:
    existing = SimpleNamespace(id=5, name="Ana", email="ana@example.com")
    fake_db.queue_result(existing)
    async with client_for(api_app) as client:
        res = await client.post("/api/auth/login", json={"name": "Ana", "email": "ANA@example.com"})

    assert res.status_code == 200
    assert res.json()["user_id"] == 5
    assert res.json()["is_new"] is False
    assert verify_token(res.json()["access_token"]) == 5


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "Ana", "email": "not-an-email"},
        {"name": "Ana", "email": "a@b"},
        {"name": "", "email": "ana@example.com"},
        {"name": "x" * 101, "email": "ana@example.com"},
    ],
)
async def test_login_validates_input(api_app: Any, payload: dict) -> None:
    async with client_for(api_app) as client:
        res = await client.post("/api/auth/login", json=payload)
    assert res.status_code == 422


# ── Authentication and ownership ──────────────────────────────────────────────

async def test_requests_without_token_are_rejected(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview())
    async with client_for(api_app) as client:
        responses = [
            await client.get("/api/interviews/1"),
            await client.get("/api/interviews"),
            await client.post("/api/interviews/1/answer", json={"answer": "hi"}),
            await client.post("/api/interviews/1/complete"),
            await client.post("/api/interviews/1/end"),
            await client.get("/api/reports/1"),
            await client.post("/api/reports/1"),
        ]
    for res in responses:
        assert res.status_code == 401
        assert res.headers.get("www-authenticate") == "Bearer"


async def test_invalid_token_is_rejected(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview())
    async with client_for(api_app) as client:
        res = await client.get("/api/interviews/1", headers={"Authorization": "Bearer v1.bogus.token"})
    assert res.status_code == 401


async def test_other_users_interview_is_404(api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent) -> None:
    fake_db.register(Interview, 1, make_interview(user_id=2, status="completed"))
    headers = auth_headers(1)
    async with client_for(api_app) as client:
        responses = [
            await client.get("/api/interviews/1", headers=headers),
            await client.post("/api/interviews/1/answer", json={"answer": "hi"}, headers=headers),
            await client.post("/api/interviews/1/complete", headers=headers),
            await client.post("/api/interviews/1/end", headers=headers),
            await client.get("/api/reports/1", headers=headers),
            await client.post("/api/reports/1", headers=headers),
        ]
    for res in responses:
        assert res.status_code == 404
    assert feedback.calls == []


async def test_missing_interview_is_404(api_app: Any) -> None:
    async with client_for(api_app) as client:
        res = await client.get("/api/interviews/999", headers=auth_headers(1))
    assert res.status_code == 404


async def test_auth_disabled_allows_requests_without_token(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("AUTH_DISABLED", "true")
    fake_db.register(Interview, 1, make_interview(user_id=2))
    async with client_for(api_app) as client:
        res = await client.get("/api/interviews/1")
    assert res.status_code == 200
    assert res.json()["id"] == 1


# ── Start ─────────────────────────────────────────────────────────────────────

@pytest.fixture
def start_env(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    profile = SimpleNamespace(
        skills=["Python"],
        technologies=["AWS"],
        topics=["Arrays"],
        rounds=["Screening"],
        behavioral_patterns=[],
        key_insights=[],
        dsa_questions=[],
        difficulty="easy",
        # A recent profile, so the cached path is taken (no refresh).
        updated_at=datetime.now(timezone.utc),
    )

    async def fake_get_profile(db: Any, company: str, role: str) -> Any:
        return profile

    class ExplodingPipeline:
        def __init__(self) -> None:
            raise AssertionError("research pipeline must not run when a profile is cached")

    blueprint = FakeBlueprintGenerator(BLUEPRINT)
    graph = install_graph(
        monkeypatch,
        FakeGraph(invoke_results=[{
            "current_question": "Tell me about yourself.",
            "current_question_type": "behavioral",
            "current_section": "Screening",
        }]),
    )
    monkeypatch.setattr("api.interview.get_research_profile", fake_get_profile)
    monkeypatch.setattr("api.interview.ResearchPipeline", ExplodingPipeline)
    monkeypatch.setattr("api.interview.blueprint_generator", blueprint)
    return {"blueprint": blueprint, "graph": graph}


async def test_start_honors_requested_difficulty(api_app: Any, fake_db: Any, start_env: dict) -> None:
    body = {"user_id": 1, "username": "Ana", "company": "Acme", "role": "SDE", "difficulty": "hard"}
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start", json=body, headers=auth_headers(1))

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["first_question"] == "Tell me about yourself."
    assert data["difficulty"] == "Hard"

    interviews = added(fake_db, Interview)
    assert len(interviews) == 1
    assert interviews[0].difficulty == "Hard"
    assert interviews[0].user_id == 1
    assert start_env["blueprint"].calls[0]["difficulty"] == "Hard"
    initial_state = start_env["graph"].invocations[0][0]
    assert initial_state["difficulty"] == "Hard"
    assert added(fake_db, Question)[0].question == "Tell me about yourself."


async def test_start_without_difficulty_uses_researched_value(api_app: Any, fake_db: Any, start_env: dict) -> None:
    body = {"username": "Ana", "company": "Acme", "role": "SDE"}
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start", json=body, headers=auth_headers(3))

    assert res.status_code == 200, res.text
    interview = added(fake_db, Interview)[0]
    assert interview.difficulty == "Easy"
    assert interview.user_id == 3


async def test_start_rejects_mismatched_user_id(api_app: Any, fake_db: Any, start_env: dict) -> None:
    body = {"user_id": 2, "username": "Ana", "company": "Acme", "role": "SDE"}
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start", json=body, headers=auth_headers(1))

    assert res.status_code == 403
    assert added(fake_db, Interview) == []


async def test_start_rejects_unknown_difficulty(api_app: Any, start_env: dict) -> None:
    body = {"username": "Ana", "company": "Acme", "role": "SDE", "difficulty": "nightmare"}
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start", json=body, headers=auth_headers(1))
    assert res.status_code == 422


# ── Get / list ────────────────────────────────────────────────────────────────

async def test_get_interview_builds_history_from_single_join(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview())
    q1 = Question(id=10, interview_id=1, question="Q1", section="Screening", question_type="behavioral", order_index=0)
    q2 = Question(id=11, interview_id=1, question="Q2", section="Screening", question_type="behavioral", order_index=1)
    r1 = Response(id=20, question_id=10, answer="A1", score=7.0, evaluation={"score": 7.0})
    fake_db.queue_result((q1, r1), (q2, None))

    async with client_for(api_app) as client:
        res = await client.get("/api/interviews/1", headers=auth_headers(1))

    assert res.status_code == 200
    data = res.json()
    assert len(fake_db.executed) == 1
    assert [h["question"] for h in data["history"]] == ["Q1", "Q2"]
    assert data["history"][0]["answer"] == "A1"
    assert data["history"][1]["answer"] is None
    assert data["current_question"] == "Q2"


async def test_list_interviews_returns_scores_and_paginates(api_app: Any, fake_db: Any) -> None:
    interview = make_interview(blueprint={"sections": [{"name": "S", "focus_areas": ["a", "b", "c"]}]})
    fake_db.queue_result((interview, 72.0))

    async with client_for(api_app) as client:
        res = await client.get("/api/interviews?user_id=1&limit=10&offset=0", headers=auth_headers(1))

    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["score"] == 72.0
    assert data[0]["skills"] == ["a", "b"]
    assert len(fake_db.executed) == 1


async def test_list_interviews_rejects_other_user_and_bad_limits(api_app: Any) -> None:
    async with client_for(api_app) as client:
        mismatch = await client.get("/api/interviews?user_id=2", headers=auth_headers(1))
        too_big = await client.get("/api/interviews?limit=101", headers=auth_headers(1))
        negative = await client.get("/api/interviews?offset=-1", headers=auth_headers(1))
    assert mismatch.status_code == 403
    assert too_big.status_code == 422
    assert negative.status_code == 422


# ── Answer / natural completion ───────────────────────────────────────────────

def completion_graph(monkeypatch: pytest.MonkeyPatch, evaluation: dict[str, Any]) -> FakeGraph:
    entry = {"question": "Q1", "answer": "A1", "section": "Screening", "evaluation": evaluation}
    return install_graph(
        monkeypatch,
        FakeGraph(
            state_values={"blueprint": BLUEPRINT, "qa_history": []},
            invoke_results=[{"evaluation": evaluation, "interview_complete": True, "qa_history": [entry]}],
        ),
    )


async def test_natural_completion_creates_report(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    interview = make_interview()
    fake_db.register(Interview, 1, interview)
    evaluation = {"score": 7.0, "brief_feedback": "Good", "fallback": False}
    graph = completion_graph(monkeypatch, evaluation)
    fake_db.queue_result(Question(id=10, interview_id=1, question="Q1", order_index=0))

    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer", json={"answer": "A1"}, headers=auth_headers(1))

        assert res.status_code == 200, res.text
        data = res.json()
        assert data["interview_complete"] is True
        assert data["report_ready"] is True
        assert data["next_question"] is None
        assert graph.updates[0] == {"current_answer": "A1"}

        assert interview.status == "completed"
        responses = added(fake_db, Response)
        assert len(responses) == 1 and responses[0].answer == "A1"
        reports = added(fake_db, Report)
        assert len(reports) == 1
        assert reports[0].interview_id == 1
        assert reports[0].overall_score == 72
        assert len(feedback.calls) == 1
        assert feedback.calls[0]["qa_pairs"][0]["answer"] == "A1"

        # The stored report is now served by GET /api/reports/{id}.
        fake_db.queue_result(reports[0])
        report_res = await client.get("/api/reports/1", headers=auth_headers(1))

    assert report_res.status_code == 200
    assert report_res.json()["overall_score"] == 72
    assert report_res.json()["report"]["summary"] == "Solid fundamentals."
    assert len(feedback.calls) == 1


async def test_natural_completion_survives_report_failure(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    failing = FakeFeedbackAgent(error=RuntimeError("LLM down"))
    monkeypatch.setattr("services.reports.feedback_agent", failing)
    interview = make_interview()
    fake_db.register(Interview, 1, interview)
    completion_graph(monkeypatch, {"score": 6.0, "brief_feedback": "ok", "fallback": False})
    fake_db.queue_result(Question(id=10, interview_id=1, question="Q1", order_index=0))

    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer", json={"answer": "A1"}, headers=auth_headers(1))

    assert res.status_code == 200, res.text
    assert res.json()["interview_complete"] is True
    assert res.json()["report_ready"] is False
    assert interview.status == "completed"
    assert len(added(fake_db, Response)) == 1
    assert added(fake_db, Report) == []


async def test_answer_keeps_evaluator_fallback_flag(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview())
    evaluation = {"score": 5.0, "brief_feedback": "Unable to evaluate answer at this time.", "fallback": True}
    install_graph(
        monkeypatch,
        FakeGraph(
            state_values={"blueprint": BLUEPRINT},
            invoke_results=[{
                "evaluation": evaluation,
                "interview_complete": False,
                "current_question": "Q2",
                "current_question_type": "technical",
                "current_section": "Screening",
                "current_acknowledgment": "Thanks.",
                "previous_questions": ["Q1"],
            }],
        ),
    )
    fake_db.queue_result(Question(id=10, interview_id=1, question="Q1", order_index=0))

    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer", json={"answer": "A1"}, headers=auth_headers(1))

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["evaluation"]["fallback"] is True
    assert data["next_question"] == "Q2"
    assert data["interview_complete"] is False
    assert added(fake_db, Response)[0].evaluation["fallback"] is True
    next_rows = added(fake_db, Question)
    assert next_rows[0].question == "Q2" and next_rows[0].order_index == 1


async def test_answer_on_completed_interview_is_400(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer", json={"answer": "A1"}, headers=auth_headers(1))
    assert res.status_code == 400


async def test_answer_with_lost_graph_state_is_410(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview())
    install_graph(monkeypatch, FakeGraph(state_values={}))
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer", json={"answer": "A1"}, headers=auth_headers(1))
    assert res.status_code == 410


async def test_blank_answer_is_422(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview())
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer", json={"answer": "   "}, headers=auth_headers(1))
    assert res.status_code == 422


# ── Complete / end ────────────────────────────────────────────────────────────

async def test_complete_is_idempotent(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    interview = make_interview()
    fake_db.register(Interview, 1, interview)
    entry = {"question": "Q1", "answer": "A1", "section": "Screening", "evaluation": {"score": 8}}
    graph = install_graph(monkeypatch, FakeGraph(state_values={"blueprint": BLUEPRINT, "qa_history": [entry]}))

    async with client_for(api_app) as client:
        first = await client.post("/api/interviews/1/complete", headers=auth_headers(1))
        assert first.status_code == 200, first.text
        assert first.json()["already_completed"] is False
        assert first.json()["overall_score"] == 72

        reports = added(fake_db, Report)
        assert len(reports) == 1
        fake_db.queue_result(reports[0])
        second = await client.post("/api/interviews/1/complete", headers=auth_headers(1))

    assert second.status_code == 200
    assert second.json()["already_completed"] is True
    assert second.json()["overall_score"] == 72
    assert len(added(fake_db, Report)) == 1
    assert len(feedback.calls) == 1
    assert interview.status == "completed"
    assert {"interview_complete": True} in graph.updates


async def test_end_early_generates_report_and_is_idempotent(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    interview = make_interview()
    fake_db.register(Interview, 1, interview)
    entry = {"question": "Q1", "answer": "A1", "section": "Screening", "evaluation": {"score": 8}}
    install_graph(monkeypatch, FakeGraph(state_values={"blueprint": BLUEPRINT, "qa_history": [entry]}))

    async with client_for(api_app) as client:
        first = await client.post("/api/interviews/1/end", headers=auth_headers(1))
        assert first.status_code == 200, first.text
        assert first.json()["questions_answered"] == 1
        assert interview.status == "completed"

        fake_db.queue_result(added(fake_db, Report)[0])
        second = await client.post("/api/interviews/1/end", headers=auth_headers(1))

    assert second.status_code == 200
    assert second.json()["message"] == "Interview already completed"
    assert second.json()["overall_score"] == 72
    assert len(feedback.calls) == 1


async def test_end_without_answers_is_400(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview())
    install_graph(monkeypatch, FakeGraph(state_values={"blueprint": BLUEPRINT, "qa_history": []}))
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/end", headers=auth_headers(1))
    assert res.status_code == 400
    assert feedback.calls == []
