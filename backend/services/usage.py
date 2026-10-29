"""
Token usage persistence, daily limits and summaries.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import Interview, LlmUsage
from utils import usage


def _utc_day_start(now: datetime | None = None) -> datetime:
    current = now or datetime.now(timezone.utc)
    return current.replace(hour=0, minute=0, second=0, microsecond=0)


async def persist_usage(db: AsyncSession, user_id: int | None, interview_id: int | None) -> int:
    """
    Write the records collected so far as ``llm_usage`` rows and clear the
    collector (so calling it twice never double counts). Calls whose token
    counts are unknown (0 and 0) are skipped. Returns the number of rows added.
    The caller commits.
    """
    records = usage.collected()
    if not records or user_id is None:
        return 0
    rows = [r for r in records if r["input_tokens"] or r["output_tokens"]]
    records.clear()
    for r in rows:
        db.add(LlmUsage(
            user_id=user_id,
            interview_id=interview_id,
            label=r["label"],
            model=r.get("model"),
            input_tokens=r["input_tokens"],
            output_tokens=r["output_tokens"],
        ))
    if rows:
        await db.flush()
    return len(rows)


async def tokens_used_today(db: AsyncSession, user_id: int, now: datetime | None = None) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(LlmUsage.input_tokens + LlmUsage.output_tokens), 0))
        .where(LlmUsage.user_id == user_id, LlmUsage.created_at >= _utc_day_start(now))
    )
    return int(result.scalar_one() or 0)


async def enforce_daily_limit(db: AsyncSession, user_id: int | None) -> None:
    """Raise 429 when the user already spent DAILY_TOKEN_LIMIT tokens today (UTC). 0 = unlimited."""
    limit = usage.daily_token_limit()
    if limit <= 0 or user_id is None:
        return
    used = await tokens_used_today(db, user_id)
    if used >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily AI usage limit reached ({used:,} of {limit:,} tokens). It resets at 00:00 UTC.",
        )


def _totals(input_tokens: int, output_tokens: int) -> dict[str, Any]:
    return {
        "input_tokens": int(input_tokens),
        "output_tokens": int(output_tokens),
        "total_tokens": int(input_tokens) + int(output_tokens),
        "estimated_cost_usd": usage.estimate_cost(int(input_tokens), int(output_tokens)),
    }


async def usage_summary(db: AsyncSession, user_id: int, now: datetime | None = None) -> dict[str, Any]:
    """Today's and all-time token usage plus the most recent interviews' usage."""
    today = (await db.execute(
        select(
            func.coalesce(func.sum(LlmUsage.input_tokens), 0),
            func.coalesce(func.sum(LlmUsage.output_tokens), 0),
        ).where(LlmUsage.user_id == user_id, LlmUsage.created_at >= _utc_day_start(now))
    )).first() or (0, 0)
    overall = (await db.execute(
        select(
            func.coalesce(func.sum(LlmUsage.input_tokens), 0),
            func.coalesce(func.sum(LlmUsage.output_tokens), 0),
        ).where(LlmUsage.user_id == user_id)
    )).first() or (0, 0)
    per_interview = (await db.execute(
        select(
            Interview.id, Interview.company, Interview.role,
            func.coalesce(func.sum(LlmUsage.input_tokens), 0),
            func.coalesce(func.sum(LlmUsage.output_tokens), 0),
        )
        .join(LlmUsage, LlmUsage.interview_id == Interview.id)
        .where(Interview.user_id == user_id)
        .group_by(Interview.id, Interview.company, Interview.role)
        .order_by(Interview.id.desc())
        .limit(20)
    )).all()

    limit = usage.daily_token_limit()
    today_totals = _totals(today[0], today[1])
    return {
        "today": today_totals,
        "all_time": _totals(overall[0], overall[1]),
        "daily_token_limit": limit or None,
        "daily_tokens_remaining": max(0, limit - today_totals["total_tokens"]) if limit else None,
        "per_interview": [
            {"interview_id": iid, "company": company, "role": role, **_totals(tin, tout)}
            for iid, company, role, tin, tout in per_interview
        ],
        # True when prices are configured, so the UI knows whether to show money.
        "cost_estimates_enabled": usage.estimate_cost(1, 1) is not None,
    }
