"""
Report API Router
-----------------
Endpoints:
  GET  /api/reports/{interview_id}   – get full feedback report
  POST /api/reports/{interview_id}   – (re)generate report for an interview
"""

from __future__ import annotations

from typing import Any
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from agents.registry import feedback_agent
from graph.interview_graph import compiled_graph
from db.postgres import get_db, Interview, Report

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

    result = await db.execute(select(Report).where(Report.interview_id == interview_id))
    report = result.scalar_one_or_none()
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

    config ={"configurable":{"thread_id":str(interview_id)}}
    graph_state = await compiled_graph.aget_state(config=config)
    qa_history = graph_state.values.get("qa_history", []) if graph_state else []

    report_data = await feedback_agent.generate_report(
        company=interview.company,
        role=interview.role,
        qa_pairs=qa_history
    )

    result = await db.execute(
        select(Report).where(Report.interview_id == interview_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.overall_score = report_data.get("overall_score", 0)
        existing.report_json = report_data
    else:
        db.add(Report(
            interview_id=interview_id,
            overall_score=report_data.get("overall_score", 0),
            report_json=report_data,
        ))

    await db.flush()

    return {
        "message": "Report generated",
        "interview_id": interview_id,
        "overall_score": report_data.get("overall_score", 0),
        "report": report_data
    }
