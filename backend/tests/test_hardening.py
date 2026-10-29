"""
Tests for the review follow-ups: fail-closed ENV handling, CORS origins and
CORS headers on 500s, DB_SSL modes, rate limiting, per-interview locks,
fallback report handling, empty-history guards, research caching and /ready.
"""

from __future__ import annotations

import asyncio
import ssl
from types import SimpleNamespace
from typing import Any

import pytest

from db.postgres import Interview, Question, Report, ResearchProfile, build_ssl_connect_arg, ssl_mode, ssl_required
from tests.fakes import FakeBlueprintGenerator, FakeFeedbackAgent, FakeGraph
from tests.test_api_interview import (
    BLUEPRINT,
    added,
    auth_headers,
    client_for,
    completion_graph,
    install_graph,
    make_interview,
)
from utils import auth
from utils.auth import CurrentUser
from utils.locks import KeyedLocks, interview_locks
from utils.rate_limit import SlidingWindowLimiter, limit_start, limiter

ENTRY = {"question": "Q1", "answer": "A1", "section": "Screening", "evaluation": {"score": 8}}

FALLBACK_REPORT = {
    "overall_score": 0,
    "strong_topics": [],
    "weak_topics": [],
    "section_scores": {},
    "recommendations": ["Unable to generate report. Please review your answers manually."],
    "summary": "Report generation failed.",
    "fallback": True,
}


@pytest.fixture(autouse=True)
def _reset_limiter() -> Any:
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def feedback(monkeypatch: pytest.MonkeyPatch) -> FakeFeedbackAgent:
    agent = FakeFeedbackAgent()
    monkeypatch.setattr("services.reports.feedback_agent", agent)
    return agent


def fallback_row() -> Report:
    return Report(id=3, interview_id=1, overall_score=None, report_json=dict(FALLBACK_REPORT))


# ── ENV fails closed ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("value", ["development", "dev", "test", "local", " Development "])
def test_development_envs(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    monkeypatch.setenv("ENV", value)
    assert auth.is_development() is True
    assert auth.is_production() is False


@pytest.mark.parametrize("value", [None, "", "production", "prod", "staging", "something"])
def test_unset_or_unknown_env_is_production(monkeypatch: pytest.MonkeyPatch, value: str | None) -> None:
    if value is None:
        monkeypatch.delenv("ENV", raising=False)
    else:
        monkeypatch.setenv("ENV", value)
    assert auth.is_production() is True


def test_missing_secret_raises_when_env_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("AUTH_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="AUTH_SECRET"):
        auth.get_auth_secret()


def test_auth_disabled_ignored_when_env_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.setenv("AUTH_DISABLED", "true")
    assert auth.auth_disabled() is False
    monkeypatch.setenv("ENV", "development")
    assert auth.auth_disabled() is True


async def test_auth_disabled_with_unset_env_still_requires_token(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.setenv("AUTH_DISABLED", "true")
    fake_db.register(Interview, 1, make_interview())
    async with client_for(api_app) as client:
        res = await client.get("/api/interviews/1")
    assert res.status_code == 401


# ── CORS ──────────────────────────────────────────────────────────────────────

def test_cors_origins_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    from main import cors_origins

    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("FRONTEND_URL", " https://app.example/ , ,https://other.example,http://localhost:3000")
    assert cors_origins() == [
        "https://app.example",
        "https://other.example",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def test_cors_origins_without_env_has_no_localhost_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    from main import cors_origins

    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.setenv("FRONTEND_URL", "https://app.example")
    assert cors_origins() == ["https://app.example"]

    monkeypatch.setenv("FRONTEND_URL", "")
    assert cors_origins() == []


async def test_unhandled_error_returns_json_500_with_cors_headers(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def boom(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("database exploded")

    monkeypatch.setattr(fake_db, "get", boom)
    headers = {**auth_headers(1), "Origin": "http://localhost:3000"}
    async with client_for(api_app) as client:
        res = await client.get("/api/interviews/1", headers=headers)

    assert res.status_code == 500
    body = res.json()
    assert body["detail"] == "Internal server error"
    assert body["request_id"]
    assert res.headers.get("x-request-id") == body["request_id"]
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"


# ── DB_SSL ────────────────────────────────────────────────────────────────────

LOCAL_URL = "postgresql+asyncpg://u:p@localhost:5432/db"
REMOTE_URL = "postgresql+asyncpg://u:p@db.example.com:5432/db"


@pytest.mark.parametrize(
    ("url", "value", "expected"),
    [
        (LOCAL_URL, None, "disable"),
        (LOCAL_URL, "", "disable"),
        ("postgresql+asyncpg://u:p@postgres:5432/db", None, "disable"),
        (REMOTE_URL, None, "require"),
        (LOCAL_URL, "require", "require"),
        (REMOTE_URL, "disable", "disable"),
        (REMOTE_URL, "verify-ca", "verify-ca"),
        (REMOTE_URL, "VERIFY-FULL", "verify-full"),
    ],
)
def test_ssl_mode(url: str, value: str | None, expected: str) -> None:
    assert ssl_mode(url, value) == expected
    assert ssl_required(url, value) is (expected != "disable")


def test_unknown_ssl_mode_is_rejected() -> None:
    with pytest.raises(ValueError, match="DB_SSL"):
        ssl_mode(REMOTE_URL, "prefer")


def test_ssl_connect_args_verify_certificates() -> None:
    assert build_ssl_connect_arg("disable") is None
    assert build_ssl_connect_arg("require") == "require"

    verify_ca = build_ssl_connect_arg("verify-ca")
    assert isinstance(verify_ca, ssl.SSLContext)
    assert verify_ca.verify_mode == ssl.CERT_REQUIRED
    assert verify_ca.check_hostname is False

    verify_full = build_ssl_connect_arg("verify-full")
    assert isinstance(verify_full, ssl.SSLContext)
    assert verify_full.verify_mode == ssl.CERT_REQUIRED
    assert verify_full.check_hostname is True


# ── Rate limiting ─────────────────────────────────────────────────────────────

def test_sliding_window_limiter() -> None:
    now = [1000.0]
    window_limiter = SlidingWindowLimiter(clock=lambda: now[0])

    assert window_limiter.hit("k", limit=2, window=60) is None
    now[0] += 10
    assert window_limiter.hit("k", limit=2, window=60) is None
    now[0] += 10
    retry_after = window_limiter.hit("k", limit=2, window=60)
    assert retry_after == pytest.approx(40.0)
    # Other keys are independent.
    assert window_limiter.hit("other", limit=2, window=60) is None
    # The first hit leaves the window after 60 s.
    now[0] = 1060.5
    assert window_limiter.hit("k", limit=2, window=60) is None
    # A limit of 0 disables limiting.
    for _ in range(5):
        assert window_limiter.hit("z", limit=0, window=60) is None


async def test_login_is_rate_limited_per_ip(api_app: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_LOGIN_PER_MIN", "2")
    payload = {"name": "Ana", "email": "ana@example.com"}
    async with client_for(api_app) as client:
        statuses = [(await client.post("/api/auth/login", json=payload)).status_code for _ in range(2)]
        limited = await client.post("/api/auth/login", json=payload)

    assert statuses == [200, 200]
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) >= 1


async def test_rate_limiting_is_off_in_test_env(api_app: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RATE_LIMIT_ENABLED", raising=False)
    monkeypatch.setenv("RATE_LIMIT_LOGIN_PER_MIN", "1")
    payload = {"name": "Ana", "email": "ana@example.com"}
    async with client_for(api_app) as client:
        statuses = [(await client.post("/api/auth/login", json=payload)).status_code for _ in range(3)]
    assert statuses == [200, 200, 200]


async def test_start_is_rate_limited_per_user(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi import HTTPException

    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_START_PER_HOUR", "1")
    request: Any = SimpleNamespace(client=SimpleNamespace(host="10.0.0.1"))

    await limit_start(request, CurrentUser(id=7))
    with pytest.raises(HTTPException) as excinfo:
        await limit_start(request, CurrentUser(id=7))
    assert excinfo.value.status_code == 429
    # A different user from the same IP has their own budget.
    await limit_start(request, CurrentUser(id=8))


# ── Per-interview locks ───────────────────────────────────────────────────────

async def test_keyed_locks_serialise_and_clean_up() -> None:
    locks = KeyedLocks()
    order: list[str] = []

    async def worker(name: str) -> None:
        async with locks.hold(1):
            order.append(f"{name}-start")
            await asyncio.sleep(0.01)
            order.append(f"{name}-end")

    await asyncio.gather(worker("a"), worker("b"))
    assert order == ["a-start", "a-end", "b-start", "b-end"]
    assert len(locks) == 0
    assert locks.is_locked(1) is False


async def test_answer_while_another_is_in_flight_is_409(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview())
    graph = install_graph(monkeypatch, FakeGraph(state_values={"blueprint": BLUEPRINT}))

    async with interview_locks.hold(1):
        async with client_for(api_app) as client:
            res = await client.post("/api/interviews/1/answer", json={"answer": "A1"}, headers=auth_headers(1))

    assert res.status_code == 409
    assert graph.updates == []
    assert graph.invocations == []
    assert len(interview_locks) == 0


# ── Fallback reports ──────────────────────────────────────────────────────────

async def test_natural_completion_with_fallback_report_is_not_ready(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    agent = FakeFeedbackAgent(report=FALLBACK_REPORT)
    monkeypatch.setattr("services.reports.feedback_agent", agent)
    interview = make_interview()
    fake_db.register(Interview, 1, interview)
    completion_graph(monkeypatch, {"score": 6.0, "brief_feedback": "ok", "fallback": False})
    fake_db.queue_result(Question(id=10, interview_id=1, question="Q1", order_index=0))

    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/answer", json={"answer": "A1"}, headers=auth_headers(1))

    assert res.status_code == 200, res.text
    assert res.json()["interview_complete"] is True
    assert res.json()["report_ready"] is False
    reports = added(fake_db, Report)
    assert len(reports) == 1
    assert reports[0].overall_score is None
    assert reports[0].report_json["fallback"] is True
    assert interview.status == "completed"
    assert fake_db.committed is True


async def test_complete_regenerates_a_stored_fallback_report(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    install_graph(monkeypatch, FakeGraph(state_values={"blueprint": BLUEPRINT, "qa_history": [ENTRY]}))
    existing = fallback_row()
    fake_db.queue_result(existing)  # idempotency check
    fake_db.queue_result(existing)  # build_and_store_report -> upsert target

    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/complete", headers=auth_headers(1))

    assert res.status_code == 200, res.text
    assert res.json()["already_completed"] is False
    assert res.json()["overall_score"] == 72
    assert existing.overall_score == 72
    assert existing.report_json["fallback"] is False
    assert added(fake_db, Report) == []
    assert len(feedback.calls) == 1


async def test_get_report_regenerates_a_stored_fallback_report(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    install_graph(monkeypatch, FakeGraph(state_values={"qa_history": [ENTRY]}))
    existing = fallback_row()
    fake_db.queue_result(existing)  # first lookup
    fake_db.queue_result(existing)  # re-check under the interview lock
    fake_db.queue_result(existing)  # build_and_store_report -> upsert target

    async with client_for(api_app) as client:
        res = await client.get("/api/reports/1", headers=auth_headers(1))

    assert res.status_code == 200, res.text
    assert res.json()["overall_score"] == 72
    assert res.json()["report"]["fallback"] is False
    assert len(feedback.calls) == 1
    assert fake_db.committed is True


async def test_get_report_returns_fallback_when_nothing_to_regenerate_from(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    install_graph(monkeypatch, FakeGraph(state_values={"qa_history": []}))
    existing = fallback_row()
    fake_db.queue_result(existing)
    fake_db.queue_result(existing)

    async with client_for(api_app) as client:
        res = await client.get("/api/reports/1", headers=auth_headers(1))

    assert res.status_code == 200
    assert res.json()["overall_score"] is None
    assert res.json()["report"]["fallback"] is True
    assert feedback.calls == []


async def test_list_interviews_reports_null_score_for_fallback(api_app: Any, fake_db: Any) -> None:
    fake_db.queue_result((make_interview(status="completed"), None))
    async with client_for(api_app) as client:
        res = await client.get("/api/interviews", headers=auth_headers(1))
    assert res.status_code == 200
    assert res.json()[0]["score"] is None


# ── Empty-history guard on /complete ──────────────────────────────────────────

async def test_complete_without_answers_is_400(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    interview = make_interview()
    fake_db.register(Interview, 1, interview)
    graph = install_graph(monkeypatch, FakeGraph(state_values={"blueprint": BLUEPRINT, "qa_history": []}))

    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/1/complete", headers=auth_headers(1))

    assert res.status_code == 400
    assert feedback.calls == []
    assert interview.status == "in_progress"
    assert added(fake_db, Report) == []
    assert graph.updates == []


# ── Research profile caching ──────────────────────────────────────────────────

def test_is_cacheable() -> None:
    from research import is_cacheable

    assert is_cacheable({"skills": ["Python"], "topics": [], "rounds": []}) is True
    assert is_cacheable({"skills": [], "topics": [], "rounds": ["Onsite"]}) is True
    assert is_cacheable({"skills": [], "topics": [], "rounds": [], "difficulty": "Medium"}) is False
    assert is_cacheable({"skills": ["Python"], "extraction_failed": True}) is False


async def test_save_research_profile_ignores_non_column_keys(fake_db: Any) -> None:
    from research import save_research_profile

    profile = await save_research_profile(
        fake_db, "Acme", "SDE", {"skills": ["Python"], "difficulty": "Hard", "extraction_failed": False}
    )
    assert isinstance(profile, ResearchProfile)
    assert profile.skills == ["Python"]
    assert profile.difficulty == "Hard"
    assert fake_db.committed is True


@pytest.mark.parametrize(
    ("extracted", "should_cache"),
    [
        ({"skills": [], "topics": [], "rounds": [], "difficulty": "Medium", "extraction_failed": True}, False),
        ({"skills": [], "topics": [], "rounds": [], "difficulty": "Medium", "extraction_failed": False}, False),
        ({"skills": ["Python"], "topics": ["Arrays"], "rounds": [], "difficulty": "Hard", "extraction_failed": False}, True),
    ],
)
async def test_start_only_caches_useful_research(
    api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch, extracted: dict, should_cache: bool
) -> None:
    saved: list[dict] = []

    async def no_profile(db: Any, company: str, role: str) -> None:
        return None

    async def record_save(db: Any, company: str, role: str, data: dict) -> None:
        saved.append(data)

    class FakePipeline:
        async def run(self, company: str, role: str) -> dict:
            return {"extracted": dict(extracted), "chunks_added": 0, "urls_processed": 0}

    monkeypatch.setattr("api.interview.get_research_profile", no_profile)
    monkeypatch.setattr("api.interview.save_research_profile", record_save)
    monkeypatch.setattr("api.interview.ResearchPipeline", FakePipeline)
    monkeypatch.setattr("api.interview.blueprint_generator", FakeBlueprintGenerator(BLUEPRINT))
    install_graph(monkeypatch, FakeGraph(invoke_results=[{"current_question": "Hi?"}]))

    body = {"username": "Ana", "company": "Acme", "role": "SDE"}
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start", json=body, headers=auth_headers(1))

    assert res.status_code == 200, res.text
    assert bool(saved) is should_cache
    assert fake_db.committed is True


async def test_extractor_flags_when_every_document_fails() -> None:
    from agents.extractor import ExtractorAgent

    agent = ExtractorAgent.__new__(ExtractorAgent)  # skip the Groq client

    async def always_fails(company: str, role: str, doc: dict) -> dict:
        raise RuntimeError("LLM down")

    agent.extract_doc = always_fails  # type: ignore[method-assign]
    result = await agent.extract("Acme", "SDE", [{"url": "u1"}, {"url": "u2"}])
    assert result["extraction_failed"] is True
    assert result["skills"] == [] and result["topics"] == [] and result["rounds"] == []

    empty = await agent.extract("Acme", "SDE", [])
    assert empty["extraction_failed"] is True


async def test_extractor_keeps_partial_results() -> None:
    from agents.extractor import ExtractorAgent

    agent = ExtractorAgent.__new__(ExtractorAgent)

    async def sometimes(company: str, role: str, doc: dict) -> dict:
        if doc["url"] == "bad":
            raise RuntimeError("LLM down")
        return {"skills": ["Python"], "topics": ["Arrays"], "rounds": [], "difficulty": "hard"}

    agent.extract_doc = sometimes  # type: ignore[method-assign]
    result = await agent.extract("Acme", "SDE", [{"url": "bad"}, {"url": "good"}])
    assert result["extraction_failed"] is False
    assert result["skills"] == ["Python"]
    assert result["difficulty"] == "Hard"


# ── /ready ────────────────────────────────────────────────────────────────────

async def test_ready_when_database_and_graph_are_up(api_app: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    async def db_ok() -> bool:
        return True

    monkeypatch.setattr("main._database_ready", db_ok)
    monkeypatch.setattr("main.is_graph_ready", lambda: True)
    async with client_for(api_app) as client:
        res = await client.get("/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ready", "checks": {"database": "ok", "graph": "ok"}}


async def test_ready_is_503_when_database_is_down(api_app: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    async def db_down() -> bool:
        raise OSError("connection refused")

    monkeypatch.setattr("main._database_ready", db_down)
    monkeypatch.setattr("main.is_graph_ready", lambda: True)
    async with client_for(api_app) as client:
        res = await client.get("/ready")
    assert res.status_code == 503
    assert res.json()["checks"] == {"database": "unavailable", "graph": "ok"}


async def test_ready_is_503_when_graph_is_not_initialised(api_app: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    async def db_ok() -> bool:
        return True

    monkeypatch.setattr("main._database_ready", db_ok)
    monkeypatch.setattr("main.is_graph_ready", lambda: False)
    async with client_for(api_app) as client:
        res = await client.get("/ready")
    assert res.status_code == 503
    assert res.json()["checks"]["graph"] == "not_initialized"
