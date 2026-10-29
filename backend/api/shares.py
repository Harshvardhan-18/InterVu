"""
Shareable report links
----------------------
Lets a candidate show a finished report to someone without an InterVu
account (a mentor, a friend, a recruiter). This is the only unauthenticated
data endpoint in the API, so it is deliberately narrow:

* Opt-in per report: nothing is shared until the owner creates a link.
* The link is an unguessable random token (256 bits) and is the only
  credential. Anyone who has the link can read the report until it expires or
  the owner revokes it. It cannot be enumerated or derived from interview ids.
* It expires (SHARE_DEFAULT_DAYS, default 7; owners may choose up to
  SHARE_MAX_DAYS, default 90) and can be revoked at any time.
* It exposes a fixed whitelist: company, role, difficulty, score, summary,
  strong/weak topics, section scores, recommendations and dates. It never
  includes the candidate's name or email, their answers, the questions, or any
  internal id.
* Unknown, malformed, expired and revoked tokens all return the same 404, so
  the response does not reveal which tokens ever existed.
* Responses are marked no-store and noindex, and the endpoint is rate limited
  per client IP.

Owner endpoints (bearer token, owner only):
  POST   /api/reports/{id}/share    create (or return the active) link
  GET    /api/reports/{id}/share    current link status
  DELETE /api/reports/{id}/share    revoke
Public endpoint:
  GET    /api/shared/{token}        read-only report
"""

from __future__ import annotations

import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.interview import get_owned_interview_or_404
from db.postgres import Interview, Report, ReportShare, get_db
from services.reports import get_report_row, is_usable_report
from utils.auth import CurrentUser, get_current_user
from utils.rate_limit import limit_public

logger = logging.getLogger(__name__)

owner_router = APIRouter(prefix="/api/reports", tags=["shares"])
public_router = APIRouter(prefix="/api/shared", tags=["shares"])

DEFAULT_DAYS = 7
DEFAULT_MAX_DAYS = 90
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{32,64}$")

# Fields of the stored report JSON that a public link may expose.
_PUBLIC_REPORT_FIELDS = ("summary", "strong_topics", "weak_topics", "section_scores", "recommendations")


def _env_days(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    try:
        value = int(raw) if raw else default
    except ValueError:
        return default
    return value if value > 0 else default


def default_days() -> int:
    return min(_env_days("SHARE_DEFAULT_DAYS", DEFAULT_DAYS), max_days())


def max_days() -> int:
    return _env_days("SHARE_MAX_DAYS", DEFAULT_MAX_DAYS)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def is_active(share: ReportShare | None, now: datetime | None = None) -> bool:
    """True when ``share`` exists and has not expired."""
    if share is None or share.expires_at is None:
        return False
    return _aware(share.expires_at) > (now or _utcnow())


def _serialize_share(share: ReportShare) -> dict[str, Any]:
    return {
        "shared": True,
        "token": share.token,
        "path": f"/shared/{share.token}",
        "created_at": _aware(share.created_at or _utcnow()).isoformat(),
        "expires_at": _aware(share.expires_at).isoformat(),
    }


class ShareRequest(BaseModel):
    # How long the link stays valid. Defaults to SHARE_DEFAULT_DAYS.
    expires_in_days: int | None = Field(default=None, ge=1, le=365)


async def _get_share(db: AsyncSession, interview_id: int) -> ReportShare | None:
    result = await db.execute(
        select(ReportShare)
        .where(ReportShare.interview_id == interview_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


# ── Owner endpoints ────────────────────────────────────────────────────────────

@owner_router.post("/{interview_id}/share")
async def create_share(
    interview_id: int,
    body: ShareRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Create a public read-only link for a finished report (idempotent while active)."""
    interview = await get_owned_interview_or_404(interview_id, db, user)

    report = await get_report_row(db, interview.id)
    if interview.status != "completed" or not is_usable_report(report):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a finished interview with a generated report can be shared.",
        )

    share = await _get_share(db, interview.id)
    if is_active(share):
        return _serialize_share(share)

    days = min((body.expires_in_days if body and body.expires_in_days else default_days()), max_days())
    expires_at = _utcnow() + timedelta(days=days)
    token = secrets.token_urlsafe(32)  # 256 bits of randomness

    if share is None:
        share = ReportShare(interview_id=interview.id, token=token, expires_at=expires_at)
        db.add(share)
    else:
        # An expired link is replaced with a new token; the old one never revives.
        share.token = token
        share.expires_at = expires_at
        share.created_at = _utcnow()
    await db.flush()
    await db.commit()
    logger.info("Created share link for interview %s (expires %s).", interview.id, expires_at.isoformat())
    return _serialize_share(share)


@owner_router.get("/{interview_id}/share")
async def get_share_status(
    interview_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Whether the report currently has an active public link."""
    interview = await get_owned_interview_or_404(interview_id, db, user)
    share = await _get_share(db, interview.id)
    if not is_active(share):
        return {"shared": False}
    return _serialize_share(share)


@owner_router.delete("/{interview_id}/share")
async def revoke_share(
    interview_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Revoke the public link immediately (idempotent)."""
    interview = await get_owned_interview_or_404(interview_id, db, user)
    share = await _get_share(db, interview.id)
    if share is not None:
        await db.delete(share)
        await db.flush()
        await db.commit()
        logger.info("Revoked share link for interview %s.", interview.id)
    return {"shared": False}


# ── Public endpoint ────────────────────────────────────────────────────────────

# Sent on every response from the public endpoint, errors included: personal
# results are never cached or indexed and the URL is not leaked via Referer.
PUBLIC_HEADERS = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
}


def _not_found() -> HTTPException:
    # One identical response for malformed, unknown, expired and revoked tokens.
    # Headers must be attached to the exception: a Response parameter's headers
    # are discarded when a handler raises.
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="This shared report is not available.",
        headers=PUBLIC_HEADERS,
    )


def public_view(interview: Interview, report: Report, share: ReportShare) -> dict[str, Any]:
    """The whitelisted, anonymous view of a report. Add fields here deliberately."""
    data = report.report_json if isinstance(report.report_json, dict) else {}
    return {
        "company": interview.company,
        "role": interview.role,
        "difficulty": interview.difficulty,
        "overall_score": report.overall_score,
        "report": {key: data.get(key) for key in _PUBLIC_REPORT_FIELDS if key in data},
        "created_at": _aware(report.created_at or _utcnow()).isoformat(),
        "expires_at": _aware(share.expires_at).isoformat(),
    }


@public_router.get("/{token}", dependencies=[Depends(limit_public)])
async def read_shared_report(
    token: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Read-only view of a shared report. No authentication: the token is the credential."""
    for name, value in PUBLIC_HEADERS.items():
        response.headers[name] = value

    if not TOKEN_PATTERN.match(token):
        raise _not_found()

    result = await db.execute(
        select(ReportShare, Interview, Report)
        .join(Interview, Interview.id == ReportShare.interview_id)
        .join(Report, Report.interview_id == Interview.id)
        .where(ReportShare.token == token)
    )
    row = result.first()
    if row is None:
        raise _not_found()
    share, interview, report = row
    if not is_active(share) or not is_usable_report(report):
        raise _not_found()
    return public_view(interview, report, share)
