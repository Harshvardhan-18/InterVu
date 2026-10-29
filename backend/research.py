"""
Research profile cache
----------------------
One ResearchProfile row per (company, role) so repeat interviews skip the
research pipeline. Empty or failed extractions are never cached, otherwise an
LLM or scraper outage would pin an empty profile forever.

Cached profiles expire: interview processes change, so a profile older than
RESEARCH_TTL_DAYS (default 30, 0 = never expire) is refreshed the next time
someone starts an interview for that company and role. If the refresh fails
the stale profile is still used (and the candidate is warned).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import ResearchProfile

logger = logging.getLogger(__name__)

# Columns of ResearchProfile that come from the extractor output.
PROFILE_FIELDS = (
    "skills",
    "technologies",
    "topics",
    "rounds",
    "behavioral_patterns",
    "key_insights",
    "dsa_questions",
    "difficulty",
)


DEFAULT_TTL_DAYS = 30


def research_ttl_days() -> int:
    """RESEARCH_TTL_DAYS as a non-negative int (0 disables expiry)."""
    raw = os.getenv("RESEARCH_TTL_DAYS", "").strip()
    if not raw:
        return DEFAULT_TTL_DAYS
    try:
        return max(0, int(raw))
    except ValueError:
        logger.warning("Invalid RESEARCH_TTL_DAYS=%r; using %d.", raw, DEFAULT_TTL_DAYS)
        return DEFAULT_TTL_DAYS


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def is_stale(profile: Any, ttl_days: int | None = None, now: datetime | None = None) -> bool:
    """
    True when ``profile`` was last refreshed more than ``ttl_days`` days ago.
    A profile without any timestamp is treated as stale; ``ttl_days`` 0 never expires.
    """
    days = research_ttl_days() if ttl_days is None else ttl_days
    if days <= 0:
        return False
    refreshed_at = getattr(profile, "updated_at", None) or getattr(profile, "created_at", None)
    if refreshed_at is None:
        return True
    current = _as_utc(now) if now is not None else datetime.now(timezone.utc)
    return current - _as_utc(refreshed_at) > timedelta(days=days)


def is_cacheable(extracted: dict[str, Any]) -> bool:
    """
    False when the extraction failed outright or produced no skills, topics
    and rounds at all (nothing worth caching).
    """
    if extracted.get("extraction_failed"):
        return False
    return any(extracted.get(key) for key in ("skills", "topics", "rounds"))


async def get_research_profile(
        db: AsyncSession,
        company: str,
        role: str
):
    result = await db.execute(
        select(ResearchProfile).where(
            ResearchProfile.company == company,
            ResearchProfile.role == role
        )
    )
    return result.scalar_one_or_none()


async def save_research_profile(
        db: AsyncSession,
        company: str,
        role: str,
        extracted: dict
):
    """
    Cache ``extracted`` for (company, role). Returns the profile, or None when
    another request cached the same pair first (unique constraint).
    """
    columns = {key: extracted[key] for key in PROFILE_FIELDS if key in extracted}
    profile = ResearchProfile(company=company, role=role, **columns)
    db.add(profile)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        logger.info("Research profile for %s / %s was cached concurrently; keeping the existing row.", company, role)
        return None
    except Exception:
        await db.rollback()
        raise
    await db.refresh(profile)
    return profile


async def update_research_profile(
        db: AsyncSession,
        profile: ResearchProfile,
        extracted: dict
) -> ResearchProfile:
    """Overwrite ``profile`` with freshly extracted research and bump ``updated_at``."""
    for key in PROFILE_FIELDS:
        if key in extracted:
            setattr(profile, key, extracted[key])
    profile.updated_at = datetime.now(timezone.utc)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    await db.refresh(profile)
    return profile
