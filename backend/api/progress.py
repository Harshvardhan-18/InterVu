"""
Progress API Router
-------------------
  GET /api/progress   - the caller's score trend, weakest sections and topics

Requires a bearer token; only the caller's own interviews are used.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.interview import resolve_owner_id
from db.postgres import Interview, Report, get_db
from services.progress import build_progress
from utils.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/api/progress", tags=["progress"])

# Safety cap: the analytics only need the most recent history.
MAX_INTERVIEWS = 200


@router.get("")
async def get_progress(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Aggregate the caller's finished interviews into dashboard analytics."""
    owner_id = resolve_owner_id(None, user)

    total = (
        await db.execute(select(func.count(Interview.id)).where(Interview.user_id == owner_id))
    ).scalar_one()

    result = await db.execute(
        select(Interview, Report)
        .join(Report, Report.interview_id == Interview.id)
        .where(Interview.user_id == owner_id)
        .order_by(Interview.created_at.desc(), Interview.id.desc())
        .limit(MAX_INTERVIEWS)
    )
    # Newest first from the query (so the cap keeps recent history); the
    # analytics want oldest first.
    rows = [
        {
            "interview_id": interview.id,
            "company": interview.company,
            "role": interview.role,
            "date": interview.created_at,
            "overall_score": report.overall_score,
            "report": report.report_json,
        }
        for interview, report in reversed(result.all())
    ]
    return build_progress(rows, total_interviews=int(total or 0))
