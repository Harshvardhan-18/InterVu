"""Progress analytics: pure aggregation plus the GET /api/progress endpoint."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from db.postgres import Interview, Report
from services.progress import build_progress
from tests.test_api_interview import auth_headers, client_for, make_interview


def row(i: int, score: float | None, report: dict | None, company: str = "Acme", day: int = 1) -> dict[str, Any]:
    return {
        "interview_id": i,
        "company": company,
        "role": "SDE",
        "date": datetime(2026, 5, day, tzinfo=timezone.utc),
        "overall_score": score,
        "report": report,
    }


def report(weak: list[str], strong: list[str], sections: dict[str, float], fallback: bool = False) -> dict:
    return {"weak_topics": weak, "strong_topics": strong, "section_scores": sections, "fallback": fallback}


def test_empty_history() -> None:
    result = build_progress([], total_interviews=0)
    assert result["total_interviews"] == 0 and result["reports_count"] == 0
    assert result["average_score"] is None and result["best_score"] is None
    assert result["improvement"] is None and result["trend"] == [] and result["practice_next"] == []


def test_scores_trend_and_improvement() -> None:
    rows = [
        row(1, 50, report([], [], {}), day=1),
        row(2, 70, report([], [], {}), day=2),
        row(3, 90, report([], [], {}), day=3),
    ]
    result = build_progress(rows, total_interviews=5)
    assert result["total_interviews"] == 5 and result["reports_count"] == 3
    assert result["average_score"] == 70.0 and result["best_score"] == 90 and result["latest_score"] == 90
    assert result["improvement"] == 40.0
    assert [t["score"] for t in result["trend"]] == [50, 70, 90]  # oldest first
    assert result["trend"][0]["date"].startswith("2026-05-01")


def test_placeholder_reports_do_not_count_as_zeros() -> None:
    rows = [
        row(1, 80, report([], [], {}), day=1),
        row(2, None, report([], [], {}, fallback=True), day=2),  # failed LLM: no score
        row(3, 0, report([], [], {}, fallback=True), day=3),  # stored fallback must be ignored even with a 0
        row(4, 60, report([], [], {}), day=4),
    ]
    result = build_progress(rows)
    assert result["reports_count"] == 2
    assert result["average_score"] == 70.0 and result["improvement"] == -20.0


def test_topics_are_merged_case_insensitively_and_ranked() -> None:
    rows = [
        row(1, 60, report(["Graphs", "DP"], ["Arrays"], {})),
        row(2, 65, report(["graphs", "System Design"], ["arrays", "Hashing"], {})),
        row(3, 70, report(["GRAPHS"], [], {})),
    ]
    result = build_progress(rows)
    assert result["weak_topics"][0] == {"topic": "Graphs", "count": 3}  # first spelling wins
    assert {t["topic"] for t in result["weak_topics"]} == {"Graphs", "DP", "System Design"}
    assert result["strong_topics"][0] == {"topic": "Arrays", "count": 2}
    assert result["practice_next"] == ["Graphs", "DP", "System Design"]


def test_section_averages_sorted_weakest_first_and_tolerate_bad_values() -> None:
    rows = [
        row(1, 60, report([], [], {"Coding": 4, "Behavioral": 8, "Odd": "n/a"})),
        row(2, 70, report([], [], {"Coding": 6, "Behavioral": 9})),
    ]
    result = build_progress(rows)
    assert result["section_averages"] == [
        {"section": "Coding", "average": 5.0, "count": 2},
        {"section": "Behavioral", "average": 8.5, "count": 2},
    ]


def test_by_company_and_trend_limit() -> None:
    rows = [row(i, 50 + i, report([], [], {}), company="Acme" if i % 3 else "Globex", day=1) for i in range(1, 31)]
    result = build_progress(rows)
    assert len(result["trend"]) == 20 and result["trend"][-1]["interview_id"] == 30
    companies = {c["company"]: c for c in result["by_company"]}
    assert companies["Acme"]["count"] == 20 and companies["Globex"]["count"] == 10


def test_malformed_report_json_is_ignored() -> None:
    result = build_progress([row(1, 60, None), row(2, 70, "not a dict"), row(3, 80, report(["X"], [], {}))])  # type: ignore[arg-type]
    assert result["reports_count"] == 1 and result["weak_topics"] == [{"topic": "X", "count": 1}]


async def test_progress_endpoint_aggregates_the_callers_interviews(api_app: Any, fake_db: Any) -> None:
    newer = make_interview(id=2, company="Globex")
    older = make_interview(id=1, company="Acme")
    newer.created_at = datetime(2026, 5, 10, tzinfo=timezone.utc)
    older.created_at = datetime(2026, 5, 1, tzinfo=timezone.utc)
    r_new = Report(id=2, interview_id=2, overall_score=90, report_json=report(["Graphs"], ["Arrays"], {"Coding": 9}))
    r_old = Report(id=1, interview_id=1, overall_score=60, report_json=report(["Graphs"], [], {"Coding": 5}))
    fake_db.queue_result(4)  # total interviews started (including unfinished)
    fake_db.queue_result((newer, r_new), (older, r_old))  # query returns newest first

    async with client_for(api_app) as client:
        res = await client.get("/api/progress", headers=auth_headers(1))

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["total_interviews"] == 4 and data["reports_count"] == 2
    assert [t["interview_id"] for t in data["trend"]] == [1, 2]  # oldest first for charting
    assert data["improvement"] == 30.0 and data["practice_next"] == ["Graphs"]


async def test_progress_requires_authentication(api_app: Any) -> None:
    async with client_for(api_app) as client:
        res = await client.get("/api/progress")
    assert res.status_code == 401
