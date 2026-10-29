"""
Report service
--------------
Shared logic for building, storing and loading interview feedback reports.
Used by POST /answer (natural completion), /complete, /end and the reports
router so every path produces exactly one Report row per interview.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.registry import feedback_agent
from db.postgres import Interview, Question, Report, Response
from graph import interview_graph
from services.usage import persist_usage
from utils import usage

logger = logging.getLogger(__name__)


def isoformat(value: datetime | None) -> str:
    """ISO 8601 string for ``value`` (now, in UTC, when it is not set yet)."""
    return (value or datetime.now(timezone.utc)).isoformat()


async def get_report_row(db: AsyncSession, interview_id: int) -> Report | None:
    # populate_existing: a re-check under the interview lock must see what an
    # overlapping request just committed, not this session's cached copy.
    result = await db.execute(
        select(Report)
        .where(Report.interview_id == interview_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def qa_history_from_graph(interview_id: int) -> list[dict[str, Any]]:
    """Q&A history from the LangGraph checkpoint ([] when unavailable)."""
    try:
        compiled = interview_graph.get_compiled_graph()
        state = await compiled.aget_state(interview_graph.graph_config(interview_id))
    except Exception as exc:  # noqa: BLE001 - fall back to the database copy
        logger.warning("[reports] Could not read graph state for interview %s: %s", interview_id, exc)
        return []
    values = getattr(state, "values", None) or {}
    return list(values.get("qa_history", []) or [])


async def qa_history_from_db(db: AsyncSession, interview_id: int) -> list[dict[str, Any]]:
    """Rebuild the answered Q&A pairs from the questions/responses tables."""
    result = await db.execute(
        select(Question, Response)
        .join(Response, Response.question_id == Question.id)
        .where(Question.interview_id == interview_id)
        .order_by(Question.order_index.asc(), Question.id.asc())
    )
    history: list[dict[str, Any]] = []
    for question, response in result.all():
        history.append({
            "question": question.question,
            "question_type": question.question_type,
            "section": question.section,
            "answer": response.answer,
            "evaluation": response.evaluation or {},
        })
    return history


async def collect_qa_history(db: AsyncSession, interview: Interview) -> list[dict[str, Any]]:
    """Prefer the graph checkpoint; fall back to the persisted responses."""
    history = await qa_history_from_graph(interview.id)
    if history:
        return history
    return await qa_history_from_db(db, interview.id)


def is_fallback_report(report: Report | None) -> bool:
    """True when ``report`` is a stored placeholder from a failed LLM call."""
    if report is None:
        return False
    data = report.report_json if isinstance(report.report_json, dict) else {}
    return bool(data.get("fallback"))


def is_usable_report(report: Report | None) -> bool:
    """A real report exists (not missing and not a fallback placeholder)."""
    return report is not None and not is_fallback_report(report)


async def build_and_store_report(
    db: AsyncSession,
    interview: Interview,
    qa_history: list[dict[str, Any]],
) -> Report:
    """
    Run the FeedbackAgent over ``qa_history`` and upsert the interview's
    Report row (update in place when one already exists).

    Fallback reports (the LLM failed) are stored with ``overall_score`` None
    so they never count as a real zero, and callers treat them as "no report
    yet" so they are regenerated on the next request.
    """
    usage.ensure()  # keeps records already collected by the caller (for example /answer)
    report_data = await feedback_agent.generate_report(
        company=interview.company,
        role=interview.role,
        qa_pairs=qa_history,
    )
    await persist_usage(db, interview.user_id, interview.id)
    overall_score = None if report_data.get("fallback") else report_data.get("overall_score", 0)

    report = await get_report_row(db, interview.id)
    if report is not None:
        report.overall_score = overall_score
        report.report_json = report_data
    else:
        report = Report(
            interview_id=interview.id,
            overall_score=overall_score,
            report_json=report_data,
        )
        db.add(report)

    await db.flush()
    return report


def serialize_report(interview: Interview, report: Report) -> dict[str, Any]:
    """Response body for GET /api/reports/{interview_id}."""
    return {
        "interview_id": interview.id,
        "company": interview.company,
        "role": interview.role,
        "overall_score": report.overall_score,
        "report": report.report_json,
        "created_at": isoformat(report.created_at),
    }
