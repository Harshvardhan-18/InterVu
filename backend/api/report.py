"""
Report API Router
-----------------
All endpoints require a bearer token and only expose the caller's interviews
(other users' interviews are reported as 404).

Endpoints:
  GET  /api/reports/{interview_id}   – get full feedback report (generated lazily
                                       for completed interviews that lack one)
  POST /api/reports/{interview_id}   – (re)generate report for an interview
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.interview import get_owned_interview_or_404
from db.postgres import get_db
from services.reports import (
    build_and_store_report,
    collect_qa_history,
    get_report_row,
    is_usable_report,
    serialize_report,
)
from utils.auth import CurrentUser, get_current_user
from utils.locks import interview_locks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{interview_id}")
async def get_report(
    interview_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Retrieve the feedback report. If the interview is completed but no real
    report is stored (generation failed at completion time, or only a
    fallback placeholder was stored), the report is generated now from the
    interview's Q&A history.
    """
    interview = await get_owned_interview_or_404(interview_id, db, user)

    report = await get_report_row(db, interview.id)
    if is_usable_report(report):
        return serialize_report(interview, report)

    if interview.status != "completed":
        if report is not None:
            return serialize_report(interview, report)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not yet generated. Complete the interview first.",
        )

    async with interview_locks.hold(interview.id):
        # Re-check under the lock: an overlapping request may have just stored it.
        await db.refresh(interview)
        report = await get_report_row(db, interview.id)
        if not is_usable_report(report):
            qa_history = await collect_qa_history(db, interview)
            if not qa_history:
                if report is not None:
                    return serialize_report(interview, report)
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No answered questions found for this interview, so no report can be generated.",
                )
            logger.info(
                "Lazily generating %s report for interview %s",
                "missing" if report is None else "placeholder", interview.id,
            )
            report = await build_and_store_report(db, interview, qa_history)
            await db.commit()  # Persist before the response is sent.

    return serialize_report(interview, report)


@router.post("/{interview_id}")
async def generate_report(
    interview_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Generate (or regenerate) the feedback report for a completed interview.
    Runs FeedbackAgent on all stored Q&A pairs.
    """
    interview = await get_owned_interview_or_404(interview_id, db, user)

    if interview.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview must be completed before generating a report.",
        )

    async with interview_locks.hold(interview.id):
        await db.refresh(interview)  # see state committed by an earlier lock holder
        qa_history = await collect_qa_history(db, interview)
        report = await build_and_store_report(db, interview, qa_history)
        await db.commit()  # Persist before the response is sent.

    return {
        "message": "Report generated",
        "interview_id": interview.id,
        "overall_score": report.overall_score,
        "report": report.report_json,
    }
