"""
Report API Router
-----------------
Endpoints:
  GET  /api/reports/{interview_id}   – get full feedback report
  POST /api/reports/{interview_id}   – (re)generate report for an interview
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.postgres import get_db, Interview, Report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{interview_id}")
async def get_report(
    interview_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve the feedback report for a completed interview."""
    interview = await db.get(Interview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    report = await db.get(Report, interview_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not yet generated. Complete the interview first.")

    return {
        "interview_id": interview_id,
        "company": interview.company,
        "role": interview.role,
        "overall_score": report.overall_score,
        "report": report.report_json,
        "created_at": report.created_at.isoformat(),
    }


@router.post("/{interview_id}")
async def generate_report(
    interview_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Generate (or regenerate) the feedback report for a completed interview.
    Runs FeedbackAgent on all stored Q&A pairs.
    """
    interview = await db.get(Interview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.status != "completed":
        raise HTTPException(status_code=400, detail="Interview must be completed before generating a report.")

    # TODO: 1. Load all Question + Response pairs from DB
    # TODO: 2. Run FeedbackAgent.generate_report(company, role, qa_pairs)
    # TODO: 3. Upsert Report into DB

    placeholder_report = {
        "overall_score": 78,
        "strong_topics": ["Data Structures", "System Design"],
        "weak_topics": ["Dynamic Programming", "OS Concepts"],
        "section_scores": {
            "Screening": 8.5,
            "Coding": 7.0,
            "Role Specific": 8.0,
            "Behavioral": 7.5,
        },
        "recommendations": [
            "Practice more DP problems on LeetCode",
            "Review OS fundamentals (scheduling, memory management)",
            "Work on articulating trade-offs more clearly",
        ],
        "summary": "Strong candidate with good fundamentals. Needs improvement in dynamic programming.",
    }

    report = Report(
        interview_id=interview_id,
        overall_score=placeholder_report["overall_score"],
        report_json=placeholder_report,
    )
    db.add(report)
    await db.flush()

    return {"message": "Report generated", "report": placeholder_report}
