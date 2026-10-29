"""Shareable report links: owner endpoints and the anonymous public view."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest

from api.shares import TOKEN_PATTERN, is_active
from db.postgres import Interview, Report, ReportShare
from tests.test_api_interview import added, auth_headers, client_for, make_interview
from utils import rate_limit

TOKEN = "A" * 43
SECRET_ANSWER = "my private answer about my salary"

REPORT_JSON = {
    "overall_score": 72,
    "summary": "Solid fundamentals.",
    "strong_topics": ["Python"],
    "weak_topics": ["Graphs"],
    "section_scores": {"Coding": 7.5},
    "recommendations": ["Practice graphs."],
    "fallback": False,
    # Things that must never leak even if they ever end up inside the stored JSON:
    "answers": [SECRET_ANSWER],
    "email": "private@example.com",
}


def future(days: float = 3) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def make_report(**overrides: Any) -> Report:
    data = {"id": 3, "interview_id": 1, "overall_score": 72, "report_json": dict(REPORT_JSON),
            "created_at": datetime(2026, 5, 1, tzinfo=timezone.utc)}
    data.update(overrides)
    return Report(**data)


def make_share(**overrides: Any) -> ReportShare:
    data = {"id": 9, "interview_id": 1, "token": TOKEN, "created_at": datetime.now(timezone.utc), "expires_at": future()}
    data.update(overrides)
    return ReportShare(**data)


# ── Helpers ───────────────────────────────────────────────────────────────────

def test_is_active() -> None:
    assert is_active(make_share(expires_at=future(1))) is True
    assert is_active(make_share(expires_at=future(-1))) is False
    assert is_active(None) is False


def test_token_pattern_accepts_generated_tokens_only() -> None:
    import secrets

    assert TOKEN_PATTERN.match(secrets.token_urlsafe(32))
    for bad in ["short", "has space " + "a" * 40, "../../etc/passwd", "a" * 100, "a" * 31, ""]:
        assert not TOKEN_PATTERN.match(bad)


# ── Owner: create ─────────────────────────────────────────────────────────────

async def test_create_requires_authentication(api_app: Any) -> None:
    async with client_for(api_app) as client:
        res = await client.post("/api/reports/1/share")
    assert res.status_code == 401


async def test_create_share_for_other_users_interview_is_404(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview(user_id=2, status="completed"))
    async with client_for(api_app) as client:
        res = await client.post("/api/reports/1/share", headers=auth_headers(1))
    assert res.status_code == 404
    assert added(fake_db, ReportShare) == []


@pytest.mark.parametrize("status", ["in_progress"])
async def test_cannot_share_an_unfinished_interview(api_app: Any, fake_db: Any, status: str) -> None:
    fake_db.register(Interview, 1, make_interview(status=status))
    fake_db.queue_result(make_report())
    async with client_for(api_app) as client:
        res = await client.post("/api/reports/1/share", headers=auth_headers(1))
    assert res.status_code == 409 and added(fake_db, ReportShare) == []


async def test_cannot_share_a_missing_or_placeholder_report(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    async with client_for(api_app) as client:
        missing = await client.post("/api/reports/1/share", headers=auth_headers(1))
        fake_db.queue_result(make_report(overall_score=None, report_json={"fallback": True}))
        placeholder = await client.post("/api/reports/1/share", headers=auth_headers(1))
    assert missing.status_code == 409 and placeholder.status_code == 409
    assert added(fake_db, ReportShare) == []


async def test_create_share_generates_unguessable_token_and_default_expiry(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    fake_db.queue_result(make_report())  # report lookup
    fake_db.queue_result()  # no existing share
    async with client_for(api_app) as client:
        res = await client.post("/api/reports/1/share", headers=auth_headers(1))

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["shared"] is True and TOKEN_PATTERN.match(body["token"]) and len(body["token"]) >= 43
    assert body["path"] == f"/shared/{body['token']}"
    expires = datetime.fromisoformat(body["expires_at"])
    assert timedelta(days=6.9) < expires - datetime.now(timezone.utc) < timedelta(days=7.1)
    share = added(fake_db, ReportShare)[0]
    assert share.token == body["token"] and share.interview_id == 1 and fake_db.committed


async def test_two_new_shares_never_get_the_same_token(api_app: Any, fake_db: Any) -> None:
    tokens = set()
    for _ in range(5):
        fake_db.added.clear()
        fake_db.register(Interview, 1, make_interview(status="completed"))
        fake_db.queue_result(make_report())
        fake_db.queue_result()
        async with client_for(api_app) as client:
            res = await client.post("/api/reports/1/share", headers=auth_headers(1))
        tokens.add(res.json()["token"])
    assert len(tokens) == 5


async def test_create_share_is_idempotent_while_active(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    existing = make_share(token="B" * 43, expires_at=future(2))
    fake_db.queue_result(make_report())
    fake_db.queue_result(existing)
    async with client_for(api_app) as client:
        res = await client.post("/api/reports/1/share", headers=auth_headers(1))
    assert res.status_code == 200 and res.json()["token"] == "B" * 43
    assert added(fake_db, ReportShare) == []


async def test_expired_share_is_replaced_with_a_new_token(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    expired = make_share(token="C" * 43, expires_at=future(-1))
    fake_db.queue_result(make_report())
    fake_db.queue_result(expired)
    async with client_for(api_app) as client:
        res = await client.post("/api/reports/1/share", headers=auth_headers(1))
    assert res.status_code == 200
    assert res.json()["token"] != "C" * 43 and expired.token == res.json()["token"]
    assert is_active(expired)


async def test_expiry_can_be_chosen_but_is_capped(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SHARE_MAX_DAYS", "10")
    for requested, expected_days in [(3, 3), (365, 10)]:
        fake_db.register(Interview, 1, make_interview(status="completed"))
        fake_db.queue_result(make_report())
        fake_db.queue_result()
        async with client_for(api_app) as client:
            res = await client.post("/api/reports/1/share", json={"expires_in_days": requested}, headers=auth_headers(1))
        delta = datetime.fromisoformat(res.json()["expires_at"]) - datetime.now(timezone.utc)
        assert timedelta(days=expected_days - 0.1) < delta < timedelta(days=expected_days + 0.1)


@pytest.mark.parametrize("days", [0, -1, 366])
async def test_invalid_expiry_is_rejected(api_app: Any, fake_db: Any, days: int) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    async with client_for(api_app) as client:
        res = await client.post("/api/reports/1/share", json={"expires_in_days": days}, headers=auth_headers(1))
    assert res.status_code == 422


# ── Owner: status and revoke ──────────────────────────────────────────────────

async def test_share_status(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    async with client_for(api_app) as client:
        none = await client.get("/api/reports/1/share", headers=auth_headers(1))
        fake_db.queue_result(make_share(expires_at=future(-1)))
        expired = await client.get("/api/reports/1/share", headers=auth_headers(1))
        fake_db.queue_result(make_share())
        active = await client.get("/api/reports/1/share", headers=auth_headers(1))
    assert none.json() == {"shared": False} and expired.json() == {"shared": False}
    assert active.json()["shared"] is True and active.json()["token"] == TOKEN


async def test_share_status_of_other_users_interview_is_404(api_app: Any, fake_db: Any) -> None:
    fake_db.register(Interview, 1, make_interview(user_id=2, status="completed"))
    fake_db.queue_result(make_share())
    async with client_for(api_app) as client:
        res = await client.get("/api/reports/1/share", headers=auth_headers(1))
    assert res.status_code == 404


async def test_revoke_deletes_the_share_and_is_idempotent(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    deleted: list[Any] = []

    async def record_delete(obj: Any) -> None:
        deleted.append(obj)

    monkeypatch.setattr(fake_db, "delete", record_delete)
    share = make_share()
    fake_db.queue_result(share)
    async with client_for(api_app) as client:
        first = await client.delete("/api/reports/1/share", headers=auth_headers(1))
        second = await client.delete("/api/reports/1/share", headers=auth_headers(1))  # nothing left to delete
    assert first.json() == {"shared": False} and second.json() == {"shared": False}
    assert deleted == [share]


async def test_revoke_by_other_user_is_404_and_deletes_nothing(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_db.register(Interview, 1, make_interview(user_id=2, status="completed"))
    deleted: list[Any] = []

    async def record_delete(obj: Any) -> None:
        deleted.append(obj)

    monkeypatch.setattr(fake_db, "delete", record_delete)
    fake_db.queue_result(make_share())
    async with client_for(api_app) as client:
        res = await client.delete("/api/reports/1/share", headers=auth_headers(1))
    assert res.status_code == 404 and deleted == []


# ── Public view ───────────────────────────────────────────────────────────────

def queue_public(fake_db: Any, share: ReportShare | None, report: Report | None = None) -> None:
    if share is None:
        fake_db.queue_result()
    else:
        fake_db.queue_result((share, make_interview(status="completed"), report or make_report()))


async def test_public_view_needs_no_authentication_and_returns_a_whitelist(api_app: Any, fake_db: Any) -> None:
    queue_public(fake_db, make_share())
    async with client_for(api_app) as client:
        res = await client.get(f"/api/shared/{TOKEN}")  # no Authorization header

    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {"company", "role", "difficulty", "overall_score", "report", "created_at", "expires_at"}
    assert set(body["report"]) == {"summary", "strong_topics", "weak_topics", "section_scores", "recommendations"}
    assert body["company"] == "Acme" and body["overall_score"] == 72
    text = json.dumps(body)
    for leak in [SECRET_ANSWER, "private@example.com", "user_id", "interview_id", "fallback"]:
        assert leak not in text


async def test_public_view_response_headers(api_app: Any, fake_db: Any) -> None:
    queue_public(fake_db, make_share())
    async with client_for(api_app) as client:
        res = await client.get(f"/api/shared/{TOKEN}")
    assert res.headers["cache-control"] == "no-store"
    assert "noindex" in res.headers["x-robots-tag"]
    assert res.headers["referrer-policy"] == "no-referrer"


async def test_unknown_expired_and_malformed_tokens_look_identical(api_app: Any, fake_db: Any) -> None:
    async with client_for(api_app) as client:
        queue_public(fake_db, None)
        unknown = await client.get(f"/api/shared/{TOKEN}")
        queue_public(fake_db, make_share(expires_at=future(-1)))
        expired = await client.get(f"/api/shared/{TOKEN}")
        executed_before = len(fake_db.executed)
        malformed = await client.get("/api/shared/not-a-valid-token")
        traversal = await client.get("/api/shared/..%2F..%2Fetc%2Fpasswd")

    assert unknown.status_code == expired.status_code == malformed.status_code == 404
    assert unknown.json() == expired.json() == malformed.json()
    assert traversal.status_code == 404
    assert len(fake_db.executed) == executed_before  # malformed tokens never reach the database
    for res in (unknown, expired, malformed):
        assert res.headers["cache-control"] == "no-store"


async def test_public_view_refuses_a_placeholder_report(api_app: Any, fake_db: Any) -> None:
    queue_public(fake_db, make_share(), make_report(overall_score=None, report_json={"fallback": True}))
    async with client_for(api_app) as client:
        res = await client.get(f"/api/shared/{TOKEN}")
    assert res.status_code == 404


async def test_public_endpoint_is_rate_limited_per_ip(api_app: Any, fake_db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_PUBLIC_PER_MIN", "3")
    rate_limit.limiter.reset()
    try:
        async with client_for(api_app) as client:
            codes = [(await client.get(f"/api/shared/{'D' * 43}")).status_code for _ in range(5)]
    finally:
        rate_limit.limiter.reset()
    assert codes == [404, 404, 404, 429, 429]
