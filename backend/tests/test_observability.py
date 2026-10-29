"""Sentry is opt-in and must never receive secrets or personal data."""

from __future__ import annotations

import copy
import sys

import pytest

from utils import observability
from utils.observability import scrub_breadcrumb, scrub_event

TOKEN = "dyTTwDeIGU1ofpqLmFECuFTdEz-f7yH4F0Mc484Rcb4"


def make_event() -> dict:
    return {
        "request": {
            "url": f"http://127.0.0.1:8000/api/shared/{TOKEN}?utm=secret",
            "method": "GET",
            "query_string": "email=jane@example.com",
            "data": {"answer": "my salary expectation is 999k"},
            "cookies": {"session": "abc"},
            "env": {"REMOTE_ADDR": "10.0.0.1"},
            "headers": {
                "Authorization": "Bearer v1.payload.signature",
                "Cookie": "a=b",
                "X-Filename": "jane-doe-resume.pdf",
                "User-Agent": "pytest",
                "Content-Type": "application/json",
            },
        },
        "user": {"email": "jane@example.com", "ip_address": "10.0.0.1"},
        "transaction": f"/shared/{TOKEN}",
        "breadcrumbs": {"values": [
            {"category": "httplib", "data": {"url": f"https://x/api/shared/{TOKEN}", "http.query": "a=b"}},
        ]},
        "message": "boom",
    }


def test_scrub_event_removes_secrets_and_personal_data() -> None:
    event = scrub_event(make_event())
    text = repr(event)
    for secret in [TOKEN, "my salary", "jane@example.com", "Bearer", "10.0.0.1", "signature", "utm=secret", "jane-doe-resume"]:
        assert secret not in text, secret
    assert event["request"]["url"].endswith("/api/shared/[redacted]")
    assert event["request"]["headers"] == {"User-Agent": "pytest", "Content-Type": "application/json"}
    assert "user" not in event and event["message"] == "boom"


def test_scrub_event_tolerates_sparse_events() -> None:
    assert scrub_event({}) == {}
    assert scrub_event({"request": {}}) == {"request": {}}
    assert scrub_event({"request": {"headers": None}, "breadcrumbs": None, "transaction": None}) is not None


def test_scrub_event_does_not_mutate_unrelated_fields() -> None:
    original = make_event()
    scrubbed = scrub_event(copy.deepcopy(original))
    assert scrubbed["message"] == original["message"]


def test_breadcrumb_scrubbing() -> None:
    crumb = scrub_breadcrumb({"data": {"url": f"https://h/api/shared/{TOKEN}?x=1", "http.query": "x=1"}})
    assert TOKEN not in repr(crumb) and "http.query" not in crumb["data"]
    assert scrub_breadcrumb({"message": "plain"}) == {"message": "plain"}


def test_sentry_is_off_without_a_dsn_and_the_sdk_is_not_even_imported(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    monkeypatch.delitem(sys.modules, "sentry_sdk", raising=False)
    assert observability.init_sentry() is False
    assert "sentry_sdk" not in sys.modules


def test_sentry_init_uses_privacy_preserving_options(monkeypatch: pytest.MonkeyPatch) -> None:
    import sentry_sdk

    captured: dict = {}
    monkeypatch.setattr(sentry_sdk, "init", lambda **kwargs: captured.update(kwargs))  # no network in unit tests
    monkeypatch.setenv("SENTRY_DSN", "http://public@127.0.0.1:9/1")
    monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "7")
    monkeypatch.setenv("SENTRY_RELEASE", "v1.2.3")

    assert observability.init_sentry() is True
    assert captured["dsn"] == "http://public@127.0.0.1:9/1" and captured["release"] == "v1.2.3"
    assert captured["send_default_pii"] is False
    assert captured["include_local_variables"] is False
    assert captured["max_request_body_size"] == "never"
    assert captured["traces_sample_rate"] == 1.0  # clamped from 7
    assert captured["before_send"] is scrub_event and captured["before_breadcrumb"] is scrub_breadcrumb


def test_invalid_sample_rate_falls_back_to_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "lots")
    assert observability._sample_rate() == 0.0
    monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "-3")
    assert observability._sample_rate() == 0.0
