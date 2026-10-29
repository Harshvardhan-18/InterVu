"""API tests for /api/reports (404 vs lazy generation, regeneration)."""

from __future__ import annotations

from typing import Any

import pytest

from db.postgres import Interview, Question, Report, Response
from tests.fakes import FakeFeedbackAgent, FakeGraph
from tests.test_api_interview import BLUEPRINT, added, auth_headers, client_for, install_graph, make_interview

ENTRY = {"question": "Q1", "answer": "A1", "section": "Screening", "evaluation": {"score": 8}}


@pytest.fixture
def feedback(monkeypatch: pytest.MonkeyPatch) -> FakeFeedbackAgent:
    agent = FakeFeedbackAgent()
    monkeypatch.setattr("services.reports.feedback_agent", agent)
    return agent


async def test_report_for_in_progress_interview_is_404(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent
) -> None:
    fake_db.register(Interview, 1, make_interview(status="in_progress"))
    async with client_for(api_app) as client:
        res = await client.get("/api/reports/1", headers=auth_headers(1))
    assert res.status_code == 404
    assert feedback.calls == []


async def test_existing_report_is_returned_without_regeneration(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent
) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    fake_db.queue_result(Report(id=3, interview_id=1, overall_score=55, report_json={"summary": "Stored"}))
    async with client_for(api_app) as client:
        res = await client.get("/api/reports/1", headers=auth_headers(1))
    assert res.status_code == 200
    body = res.json()
    assert body["overall_score"] == 55
    assert body["report"]["summary"] == "Stored"
    assert {"interview_id", "company", "role", "overall_score", "report", "created_at"} <= body.keys()
    assert feedback.calls == []


async def test_missing_report_is_generated_lazily_from_graph_history(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    install_graph(monkeypatch, FakeGraph(state_values={"blueprint": BLUEPRINT, "qa_history": [ENTRY]}))

    async with client_for(api_app) as client:
        res = await client.get("/api/reports/1", headers=auth_headers(1))

    assert res.status_code == 200, res.text
    assert res.json()["overall_score"] == 72
    assert len(added(fake_db, Report)) == 1
    assert feedback.calls[0]["qa_pairs"] == [ENTRY]


async def test_missing_report_falls_back_to_db_history_when_graph_unavailable(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    monkeypatch.setattr("graph.interview_graph.compiled_graph", None)  # graph not initialised
    question = Question(id=10, interview_id=1, question="Q1", section="Screening", question_type="behavioral", order_index=0)
    response = Response(id=20, question_id=10, answer="A1", evaluation={"score": 6})
    fake_db.queue_result()  # get_report_row -> no report
    fake_db.queue_result()  # get_report_row re-check under the interview lock -> still none
    fake_db.queue_result((question, response))  # qa_history_from_db

    async with client_for(api_app) as client:
        res = await client.get("/api/reports/1", headers=auth_headers(1))

    assert res.status_code == 200, res.text
    pairs = feedback.calls[0]["qa_pairs"]
    assert pairs[0]["question"] == "Q1" and pairs[0]["answer"] == "A1"
    assert len(added(fake_db, Report)) == 1


async def test_completed_interview_without_any_answers_is_404(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    install_graph(monkeypatch, FakeGraph(state_values={"qa_history": []}))
    async with client_for(api_app) as client:
        res = await client.get("/api/reports/1", headers=auth_headers(1))
    assert res.status_code == 404
    assert feedback.calls == []


async def test_regenerate_updates_existing_report_in_place(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_db.register(Interview, 1, make_interview(status="completed"))
    install_graph(monkeypatch, FakeGraph(state_values={"qa_history": [ENTRY]}))
    existing = Report(id=3, interview_id=1, overall_score=10, report_json={"summary": "old"})
    fake_db.queue_result(existing)  # build_and_store_report -> get_report_row

    async with client_for(api_app) as client:
        res = await client.post("/api/reports/1", headers=auth_headers(1))

    assert res.status_code == 200, res.text
    assert res.json()["overall_score"] == 72
    assert existing.overall_score == 72
    assert existing.report_json["summary"] == "Solid fundamentals."
    assert added(fake_db, Report) == []


async def test_regenerate_requires_completed_interview(
    api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent
) -> None:
    fake_db.register(Interview, 1, make_interview(status="in_progress"))
    async with client_for(api_app) as client:
        res = await client.post("/api/reports/1", headers=auth_headers(1))
    assert res.status_code == 400
    assert feedback.calls == []


async def test_report_of_other_user_is_404(api_app: Any, fake_db: Any, feedback: FakeFeedbackAgent) -> None:
    fake_db.register(Interview, 1, make_interview(user_id=99, status="completed"))
    fake_db.queue_result(Report(id=3, interview_id=1, overall_score=55, report_json={}))
    async with client_for(api_app) as client:
        res = await client.get("/api/reports/1", headers=auth_headers(1))
    assert res.status_code == 404
