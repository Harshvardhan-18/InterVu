"""
Progress analytics
------------------
Turns a user's finished interviews and their reports into the numbers the
dashboard shows: score trend, per-section averages, the topics that keep
showing up as weak or strong, and what to practice next.

``build_progress`` is a pure function over plain rows so it can be unit
tested without a database. Placeholder reports (``fallback`` true, or no
score) are ignored: a failed LLM call must not count as a real zero.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Iterable

TREND_LIMIT = 20
TOPIC_LIMIT = 8
PRACTICE_LIMIT = 3


def _usable(report_json: Any, overall_score: Any) -> bool:
    if overall_score is None or not isinstance(report_json, dict):
        return False
    return not report_json.get("fallback")


def _topic_counts(named: Iterable[tuple[str, str]]) -> list[dict[str, Any]]:
    """Count topics case-insensitively, keeping the first spelling seen."""
    display: dict[str, str] = {}
    counts: dict[str, int] = defaultdict(int)
    for _, topic in named:
        text = str(topic).strip()
        if not text:
            continue
        key = text.casefold()
        display.setdefault(key, text)
        counts[key] += 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], display[item[0]].casefold()))
    return [{"topic": display[key], "count": count} for key, count in ranked[:TOPIC_LIMIT]]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def build_progress(rows: list[dict[str, Any]], total_interviews: int | None = None) -> dict[str, Any]:
    """
    ``rows``: one dict per interview that has a report, oldest first, with keys
    ``interview_id, company, role, date, overall_score, report`` (``report`` is
    the stored report JSON). ``total_interviews`` counts every interview the
    user started, including unfinished ones.
    """
    usable = [row for row in rows if _usable(row.get("report"), row.get("overall_score"))]
    scores = [float(row["overall_score"]) for row in usable]

    trend = [
        {
            "interview_id": row["interview_id"],
            "company": row["company"],
            "role": row["role"],
            "date": _iso(row.get("date")),
            "score": float(row["overall_score"]),
        }
        for row in usable[-TREND_LIMIT:]
    ]

    section_scores: dict[str, list[float]] = defaultdict(list)
    weak: list[tuple[str, str]] = []
    strong: list[tuple[str, str]] = []
    companies: dict[str, list[float]] = defaultdict(list)
    for row in usable:
        report = row["report"]
        for section, value in (report.get("section_scores") or {}).items():
            try:
                section_scores[str(section)].append(float(value))
            except (TypeError, ValueError):
                continue
        weak.extend((str(row["interview_id"]), t) for t in report.get("weak_topics") or [] if isinstance(t, str))
        strong.extend((str(row["interview_id"]), t) for t in report.get("strong_topics") or [] if isinstance(t, str))
        companies[str(row["company"])].append(float(row["overall_score"]))

    section_averages = sorted(
        (
            {"section": name, "average": round(sum(values) / len(values), 2), "count": len(values)}
            for name, values in section_scores.items()
            if values
        ),
        key=lambda item: (item["average"], item["section"].casefold()),
    )

    by_company = sorted(
        (
            {"company": name, "count": len(values), "average": round(sum(values) / len(values), 1)}
            for name, values in companies.items()
        ),
        key=lambda item: (-item["count"], item["company"].casefold()),
    )

    weak_topics = _topic_counts(weak)
    average = round(sum(scores) / len(scores), 1) if scores else None

    return {
        "total_interviews": total_interviews if total_interviews is not None else len(rows),
        "reports_count": len(usable),
        "average_score": average,
        "best_score": max(scores) if scores else None,
        "latest_score": scores[-1] if scores else None,
        # Change from the first to the latest scored interview (needs two).
        "improvement": round(scores[-1] - scores[0], 1) if len(scores) >= 2 else None,
        "trend": trend,
        "section_averages": section_averages,
        "weak_topics": weak_topics,
        "strong_topics": _topic_counts(strong),
        "by_company": by_company,
        "practice_next": [item["topic"] for item in weak_topics[:PRACTICE_LIMIT]],
    }
