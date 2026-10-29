"""Unit tests for utils/llm_json.py."""

from __future__ import annotations

import asyncio

import pytest

from tests.fakes import FakeLLM, FakeMessage
from utils.llm_json import extract_json_object, invoke_llm_json, response_text, retry_async


# ── extract_json_object ───────────────────────────────────────────────────────

def test_plain_json() -> None:
    assert extract_json_object('{"a": 1}') == {"a": 1}


def test_code_fence_with_language() -> None:
    raw = 'Here you go:\n```json\n{"score": 7.5, "tags": ["x"]}\n```\nThanks!'
    assert extract_json_object(raw) == {"score": 7.5, "tags": ["x"]}


def test_code_fence_without_language() -> None:
    assert extract_json_object('```\n{"ok": true}\n```') == {"ok": True}


def test_prose_around_object_and_nested_braces() -> None:
    raw = 'Sure! {"outer": {"inner": {"deep": 1}}, "list": [{"x": 2}]} Hope that helps.'
    assert extract_json_object(raw) == {"outer": {"inner": {"deep": 1}}, "list": [{"x": 2}]}


def test_braces_inside_strings_are_ignored() -> None:
    raw = 'Result: {"text": "use {curly} braces and \\"quotes\\"", "n": 3}'
    assert extract_json_object(raw) == {"text": 'use {curly} braces and "quotes"', "n": 3}


def test_skips_invalid_object_and_finds_next_valid_one() -> None:
    raw = "first {not json} then {\"valid\": 1}"
    assert extract_json_object(raw) == {"valid": 1}


def test_prose_with_apostrophes_and_quotes_outside_object() -> None:
    raw = "It's \"great\": {\"a\": 1}"
    assert extract_json_object(raw) == {"a": 1}


def test_accepts_message_objects_and_content_lists() -> None:
    assert extract_json_object(FakeMessage('{"a": 1}')) == {"a": 1}
    message = FakeMessage([{"type": "text", "text": '{"b": '}, {"type": "text", "text": "2}"}])
    assert extract_json_object(message) == {"b": 2}


@pytest.mark.parametrize("raw", ["", "   ", "no json here", "[1, 2, 3]", "{broken"])
def test_raises_value_error_when_no_object(raw: str) -> None:
    with pytest.raises(ValueError):
        extract_json_object(raw)


def test_response_text_handles_none_and_other_types() -> None:
    assert response_text(FakeMessage(None)) == ""
    assert response_text(123) == "123"


# ── retry_async ───────────────────────────────────────────────────────────────

async def test_retry_succeeds_after_failures() -> None:
    calls = {"n": 0}

    async def flaky() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("boom")
        return "ok"

    assert await retry_async(flaky, attempts=3, timeout=1, base_delay=0) == "ok"
    assert calls["n"] == 3


async def test_retry_reraises_last_error() -> None:
    calls = {"n": 0}

    async def always_fails() -> None:
        calls["n"] += 1
        raise ValueError(f"fail {calls['n']}")

    with pytest.raises(ValueError, match="fail 2"):
        await retry_async(always_fails, attempts=2, timeout=1, base_delay=0)
    assert calls["n"] == 2


async def test_retry_times_out_each_attempt() -> None:
    async def slow() -> None:
        await asyncio.sleep(1)

    with pytest.raises(asyncio.TimeoutError):
        await retry_async(slow, attempts=2, timeout=0.01, base_delay=0)


async def test_retry_uses_exponential_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    import utils.llm_json as llm_json

    delays: list[float] = []

    async def fake_sleep(delay: float) -> None:
        delays.append(delay)

    monkeypatch.setattr(llm_json.asyncio, "sleep", fake_sleep)

    async def always_fails() -> None:
        raise RuntimeError("x")

    with pytest.raises(RuntimeError):
        await retry_async(always_fails, attempts=4, timeout=1, base_delay=1, max_delay=3)
    assert delays == [1, 2, 3]


# ── invoke_llm_json ───────────────────────────────────────────────────────────

async def test_invoke_llm_json_retries_on_unparseable_output() -> None:
    llm = FakeLLM(["not json at all", '```json\n{"score": 9}\n```'])
    result = await invoke_llm_json(llm, "prompt", attempts=3, timeout=1, base_delay=0)
    assert result == {"score": 9}
    assert llm.calls == 2


async def test_invoke_llm_json_applies_validator() -> None:
    llm = FakeLLM(['{"score": 9}'])
    result = await invoke_llm_json(
        llm, "prompt", validate=lambda d: {**d, "validated": True}, attempts=1, timeout=1
    )
    assert result == {"score": 9, "validated": True}


async def test_invoke_llm_json_raises_after_all_attempts() -> None:
    llm = FakeLLM([RuntimeError("down"), RuntimeError("still down")])
    with pytest.raises(RuntimeError, match="still down"):
        await invoke_llm_json(llm, "prompt", attempts=2, timeout=1, base_delay=0)
