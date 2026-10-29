"""LLM token accounting, daily limits and the /api/usage summary."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

from db.postgres import Interview, LlmUsage, Question
from services.usage import enforce_daily_limit, persist_usage, usage_summary
from tests.fakes import FakeBlueprintGenerator, FakeGraph, FakeLLM, FakeMessage
from tests.test_api_interview import BLUEPRINT, added, auth_headers, client_for, install_graph
from utils import usage
from utils.llm_json import invoke_llm_json


class Msg:
    """AIMessage look-alike with provider usage metadata."""

    def __init__(self, content: str, usage_metadata: dict | None = None, response_metadata: dict | None = None) -> None:
        self.content = content
        self.usage_metadata = usage_metadata
        self.response_metadata = response_metadata or {}


# ── Extraction of token counts ────────────────────────────────────────────────

def test_tokens_from_usage_metadata_and_legacy_token_usage() -> None:
    assert usage.tokens_from_response(Msg("x", {"input_tokens": 120, "output_tokens": 30})) == (120, 30)
    legacy = Msg("x", None, {"token_usage": {"prompt_tokens": 7, "completion_tokens": 3}})
    assert usage.tokens_from_response(legacy) == (7, 3)
    assert usage.tokens_from_response(FakeMessage("x")) == (0, 0)
    assert usage.tokens_from_response(Msg("x", {"input_tokens": "bad", "output_tokens": -4})) == (0, 0)


def test_record_is_a_noop_without_a_collector_and_model_name_is_read() -> None:
    usage._collector.set(None)
    usage.record("conductor", Msg("x", {"input_tokens": 5, "output_tokens": 5}))  # must not raise
    records = usage.begin()
    usage.record("conductor", Msg("x", {"input_tokens": 5, "output_tokens": 6}, {"model_name": "m-1"}))
    assert records == [{"label": "conductor", "model": "m-1", "input_tokens": 5, "output_tokens": 6}]
    assert usage.ensure() is records  # ensure() keeps what was already collected


async def test_invoke_llm_json_counts_failed_attempts_too() -> None:
    records = usage.begin()
    llm = FakeLLM([
        Msg("not json at all", {"input_tokens": 100, "output_tokens": 10}),
        Msg('{"ok": true}', {"input_tokens": 100, "output_tokens": 20}),
    ])

    async def ainvoke(prompt: Any) -> Any:
        outcome = llm.outcomes.pop(0)
        return outcome

    llm.ainvoke = ainvoke  # type: ignore[method-assign]
    result = await invoke_llm_json(llm, "p", label="evaluator", attempts=2, base_delay=0)
    assert result == {"ok": True}
    assert [(r["label"], r["input_tokens"], r["output_tokens"]) for r in records] == [
        ("evaluator", 100, 10), ("evaluator", 100, 20),
    ]


async def test_concurrent_requests_do_not_mix_their_usage() -> None:
    async def request(name: str, tokens: int) -> list[dict]:
        records = usage.begin()
        await asyncio.sleep(0)
        usage.record(name, Msg("x", {"input_tokens": tokens, "output_tokens": 0}))
        await asyncio.sleep(0)
        return list(records)

    a, b = await asyncio.gather(request("a", 1), request("b", 2))
    assert [r["label"] for r in a] == ["a"] and [r["label"] for r in b] == ["b"]


# ── Pricing and limits ────────────────────────────────────────────────────────

def test_cost_is_only_estimated_when_prices_are_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("LLM_PRICE_INPUT_PER_MTOK", "LLM_PRICE_OUTPUT_PER_MTOK"):
        monkeypatch.delenv(name, raising=False)
    assert usage.estimate_cost(1_000_000, 1_000_000) is None
    monkeypatch.setenv("LLM_PRICE_INPUT_PER_MTOK", "0.15")
    monkeypatch.setenv("LLM_PRICE_OUTPUT_PER_MTOK", "0.60")
    assert usage.estimate_cost(2_000_000, 1_000_000) == 0.9
    monkeypatch.setenv("LLM_PRICE_INPUT_PER_MTOK", "abc")
    assert usage.estimate_cost(1000, 1000) == pytest.approx(0.0006)  # bad price ignored, other kept


def test_daily_limit_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DAILY_TOKEN_LIMIT", raising=False)
    assert usage.daily_token_limit() == 0
    monkeypatch.setenv("DAILY_TOKEN_LIMIT", "5000")
    assert usage.daily_token_limit() == 5000
    monkeypatch.setenv("DAILY_TOKEN_LIMIT", "-1")
    assert usage.daily_token_limit() == 0
    monkeypatch.setenv("DAILY_TOKEN_LIMIT", "x")
    assert usage.daily_token_limit() == 0


# ── Persistence ───────────────────────────────────────────────────────────────

async def test_persist_usage_writes_rows_skips_unknown_and_clears(fake_db: Any) -> None:
    records = usage.begin()
    usage.record("conductor", Msg("x", {"input_tokens": 10, "output_tokens": 5}))
    usage.record("evaluator", FakeMessage("x"))  # token counts unknown -> skipped
    assert await persist_usage(fake_db, 7, 3) == 1
    rows = added(fake_db, LlmUsage)
    assert len(rows) == 1 and (rows[0].user_id, rows[0].interview_id, rows[0].label) == (7, 3, "conductor")
    assert records == []  # drained: a second call cannot double count
    assert await persist_usage(fake_db, 7, 3) == 0
    assert len(added(fake_db, LlmUsage)) == 1


async def test_persist_usage_without_collector_or_user_does_nothing(fake_db: Any) -> None:
    usage._collector.set(None)
    assert await persist_usage(fake_db, 1, 1) == 0
    usage.begin()
    usage.record("x", Msg("x", {"input_tokens": 1, "output_tokens": 1}))
    assert await persist_usage(fake_db, None, 1) == 0


async def test_daily_limit_blocks_when_exhausted(fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DAILY_TOKEN_LIMIT", "1000")
    fake_db.queue_result(1000)
    with pytest.raises(HTTPException) as exc:
        await enforce_daily_limit(fake_db, 1)
    assert exc.value.status_code == 429 and "1,000" in exc.value.detail
    fake_db.queue_result(999)
    await enforce_daily_limit(fake_db, 1)  # still under the limit


async def test_daily_limit_off_never_queries(fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DAILY_TOKEN_LIMIT", raising=False)
    await enforce_daily_limit(fake_db, 1)
    assert fake_db.executed == []


async def test_usage_summary_shape(fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DAILY_TOKEN_LIMIT", "10000")
    monkeypatch.setenv("LLM_PRICE_INPUT_PER_MTOK", "1")
    monkeypatch.setenv("LLM_PRICE_OUTPUT_PER_MTOK", "2")
    fake_db.queue_result((1000, 500))  # today
    fake_db.queue_result((4000, 2000))  # all time
    fake_db.queue_result((9, "Acme", "SDE", 3000, 1500))  # per interview
    summary = await usage_summary(fake_db, 1, now=datetime(2026, 6, 1, 12, tzinfo=timezone.utc))
    assert summary["today"]["total_tokens"] == 1500 and summary["all_time"]["total_tokens"] == 6000
    assert summary["daily_tokens_remaining"] == 8500 and summary["cost_estimates_enabled"] is True
    assert summary["per_interview"][0]["interview_id"] == 9
    assert summary["today"]["estimated_cost_usd"] == pytest.approx(0.002)


async def test_usage_endpoint_requires_auth_and_returns_summary(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DAILY_TOKEN_LIMIT", raising=False)
    for name in ("LLM_PRICE_INPUT_PER_MTOK", "LLM_PRICE_OUTPUT_PER_MTOK"):
        monkeypatch.delenv(name, raising=False)
    async with client_for(api_app) as client:
        assert (await client.get("/api/usage")).status_code == 401
        fake_db.queue_result((10, 5))
        fake_db.queue_result((10, 5))
        res = await client.get("/api/usage", headers=auth_headers(1))
    assert res.status_code == 200
    body = res.json()
    assert body["today"]["total_tokens"] == 15 and body["daily_token_limit"] is None
    assert body["today"]["estimated_cost_usd"] is None and body["cost_estimates_enabled"] is False


# ── Wired into the start flow ─────────────────────────────────────────────────

class RecordingBlueprint(FakeBlueprintGenerator):
    """A blueprint generator that 'spends' tokens like a real LLM call would."""

    def __init__(self, blueprint: dict | None = None) -> None:
        super().__init__(blueprint)

    async def generate(self, **kwargs: Any) -> dict:
        usage.record("blueprint", Msg("x", {"input_tokens": 200, "output_tokens": 50}))
        return await super().generate(**kwargs)


def _install_start(monkeypatch: pytest.MonkeyPatch, blueprint: dict) -> None:
    profile = SimpleNamespace(
        skills=["Python"], technologies=[], topics=["Arrays"], rounds=["Screening"], behavioral_patterns=[],
        key_insights=[], dsa_questions=[], difficulty="Medium", updated_at=datetime.now(timezone.utc),
    )

    async def fake_get_profile(db: Any, company: str, role: str) -> Any:
        return profile

    install_graph(monkeypatch, FakeGraph(invoke_results=[{
        "current_question": "Tell me about yourself.", "current_question_type": "behavioral", "current_section": "Screening",
    }]))
    monkeypatch.setattr("api.interview.get_research_profile", fake_get_profile)
    monkeypatch.setattr("api.interview.blueprint_generator", RecordingBlueprint(blueprint))


async def test_start_persists_token_usage_against_the_new_interview(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    _install_start(monkeypatch, BLUEPRINT)
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start", json={"company": "Acme", "role": "SDE"}, headers=auth_headers(4))
    assert res.status_code == 200, res.text
    rows = added(fake_db, LlmUsage)
    assert len(rows) == 1
    assert (rows[0].user_id, rows[0].interview_id, rows[0].label, rows[0].input_tokens, rows[0].output_tokens) == (4, 1, "blueprint", 200, 50)


async def test_failed_start_still_records_the_tokens_it_spent(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    _install_start(monkeypatch, {"sections": BLUEPRINT["sections"], "fallback": True})

    async def no_profile(db: Any, company: str, role: str) -> Any:
        return None

    class EmptyPipeline:
        async def run(self, company: str, role: str) -> dict:
            return {"extracted": {}}

    monkeypatch.setattr("api.interview.get_research_profile", no_profile)
    monkeypatch.setattr("api.interview.ResearchPipeline", EmptyPipeline)
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start", json={"company": "Acme", "role": "SDE"}, headers=auth_headers(4))
    assert res.status_code == 503
    rows = added(fake_db, LlmUsage)
    assert len(rows) == 1 and rows[0].interview_id is None and rows[0].user_id == 4
    assert fake_db.committed is True and added(fake_db, Interview) == [] and added(fake_db, Question) == []


async def test_start_is_refused_once_the_daily_limit_is_used_up(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    _install_start(monkeypatch, BLUEPRINT)
    monkeypatch.setenv("DAILY_TOKEN_LIMIT", "500")
    fake_db.queue_result(500)
    async with client_for(api_app) as client:
        res = await client.post("/api/interviews/start", json={"company": "Acme", "role": "SDE"}, headers=auth_headers(4))
    assert res.status_code == 429 and "Daily AI usage limit" in res.json()["detail"]
    assert added(fake_db, Interview) == []
