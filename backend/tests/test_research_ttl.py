"""Research profile expiry (RESEARCH_TTL_DAYS) and in-place refresh."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import pytest

from research import DEFAULT_TTL_DAYS, is_stale, research_ttl_days, update_research_profile

NOW = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)


def profile(days_old: float | None, field: str = "updated_at", naive: bool = False) -> Any:
    if days_old is None:
        return SimpleNamespace(updated_at=None, created_at=None)
    moment = NOW - timedelta(days=days_old)
    if naive:
        moment = moment.replace(tzinfo=None)
    return SimpleNamespace(**{"updated_at": None, "created_at": None, field: moment})


def test_default_ttl_and_env_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RESEARCH_TTL_DAYS", raising=False)
    assert research_ttl_days() == DEFAULT_TTL_DAYS == 30
    monkeypatch.setenv("RESEARCH_TTL_DAYS", "7")
    assert research_ttl_days() == 7
    monkeypatch.setenv("RESEARCH_TTL_DAYS", "0")
    assert research_ttl_days() == 0
    monkeypatch.setenv("RESEARCH_TTL_DAYS", "-3")
    assert research_ttl_days() == 0
    monkeypatch.setenv("RESEARCH_TTL_DAYS", "abc")
    assert research_ttl_days() == DEFAULT_TTL_DAYS


def test_is_stale_boundaries() -> None:
    assert is_stale(profile(31), ttl_days=30, now=NOW) is True
    assert is_stale(profile(29.9), ttl_days=30, now=NOW) is False
    assert is_stale(profile(0), ttl_days=30, now=NOW) is False


def test_zero_ttl_never_expires() -> None:
    assert is_stale(profile(10_000), ttl_days=0, now=NOW) is False


def test_missing_timestamps_count_as_stale() -> None:
    assert is_stale(profile(None), ttl_days=30, now=NOW) is True


def test_falls_back_to_created_at_and_accepts_naive_datetimes() -> None:
    assert is_stale(profile(40, field="created_at"), ttl_days=30, now=NOW) is True
    assert is_stale(profile(40, naive=True), ttl_days=30, now=NOW) is True
    assert is_stale(profile(1, naive=True), ttl_days=30, now=NOW) is False


def test_is_stale_reads_ttl_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RESEARCH_TTL_DAYS", "2")
    old = SimpleNamespace(updated_at=datetime.now(timezone.utc) - timedelta(days=3), created_at=None)
    new = SimpleNamespace(updated_at=datetime.now(timezone.utc) - timedelta(hours=1), created_at=None)
    assert is_stale(old) is True
    assert is_stale(new) is False


async def test_update_research_profile_overwrites_fields_and_bumps_timestamp(fake_db: Any) -> None:
    row = SimpleNamespace(
        skills=["old"], technologies=[], topics=[], rounds=[], behavioral_patterns=[],
        key_insights=[], dsa_questions=[], difficulty="Easy",
        updated_at=NOW - timedelta(days=90), created_at=NOW - timedelta(days=90),
    )
    fresh = {"skills": ["Python", "SQL"], "topics": ["Graphs"], "difficulty": "Hard", "extraction_failed": False}

    updated = await update_research_profile(fake_db, row, fresh)

    assert updated is row
    assert row.skills == ["Python", "SQL"] and row.topics == ["Graphs"] and row.difficulty == "Hard"
    assert row.technologies == []  # keys missing from the new extraction are left alone
    assert not hasattr(row, "extraction_failed")  # only profile columns are copied
    assert row.updated_at > NOW  # bumped to "now"
    assert fake_db.committed is True
