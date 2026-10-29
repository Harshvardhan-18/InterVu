"""
Feedback Agent
--------------
Runs after the full interview to produce a comprehensive performance report.

Returned reports carry a boolean ``fallback`` key: True when the LLM failed
and a placeholder report was produced (it can be regenerated later through
POST /api/reports/{interview_id}).
"""
from __future__ import annotations

import logging
from typing import Any

from langchain_groq import ChatGroq

from config import AGENT_GROQ_KEY_SLOT, FeedbackModel as model, groq_api_key
from prompts.feedback import FEEDBACK_PROMPT
from schemas.feedback import Report
from utils.prompt_safety import UNTRUSTED_TEXT_NOTICE, clean_line, fence
from utils.llm_json import invoke_llm_json

logger = logging.getLogger(__name__)

MAX_ANSWER_CHARS = 4000

FALLBACK_REPORT = {
    "overall_score": 0,
    "strong_topics": [],
    "weak_topics": [],
    "section_scores": {},
    "recommendations": ["Unable to generate report. Please review your answers manually."],
    "summary": "Report generation failed.",
    "fallback": True,
}


def fallback_report() -> dict[str, Any]:
    """A fresh deep-enough copy of the fallback report (containers not shared)."""
    data = dict(FALLBACK_REPORT)
    data["strong_topics"] = []
    data["weak_topics"] = []
    data["section_scores"] = {}
    data["recommendations"] = list(FALLBACK_REPORT["recommendations"])
    return data


def _validate(data: dict[str, Any]) -> dict[str, Any]:
    result = Report(**data).model_dump()
    result["fallback"] = False
    return result


class FeedbackAgent:
    """Generates a post-interview feedback report."""

    def __init__(self, model: str = model) -> None:
        self.llm = ChatGroq(model=model, api_key=groq_api_key(AGENT_GROQ_KEY_SLOT))

    async def generate_report(
        self,
        company: str,
        role: str,
        qa_pairs: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Generate a holistic post-interview report.

        Args:
            company: Target company.
            role: Target role.
            qa_pairs: List of {question, answer, evaluation, section} dicts.

        Returns:
            {
                "overall_score": int (0-100),
                "strong_topics": [str, ...],
                "weak_topics": [str, ...],
                "section_scores": {section: score, ...},
                "recommendations": [str, ...],
                "summary": str,
                "fallback": bool
            }
        """
        if not qa_pairs:
            logger.info("[feedback] No Q&A pairs provided, returning fallback report")
            return fallback_report()

        qa_text = "\n\n".join(
            f"Section: {clean_line(pair.get('section', 'Unknown'))}\n"
            f"Q: {pair.get('question', '')}\n"
            f"A: {fence(pair.get('answer', ''), max_chars=MAX_ANSWER_CHARS)}\n"
            f"Score: {(pair.get('evaluation') or {}).get('score', 'N/A')}\n"
            f"Feedback: {(pair.get('evaluation') or {}).get('brief_feedback', 'N/A')}"
            for pair in qa_pairs
        )

        prompt = FEEDBACK_PROMPT.format(
            company=clean_line(company),
            role=clean_line(role),
            qa_text=qa_text,
            untrusted_notice=UNTRUSTED_TEXT_NOTICE,
        )

        try:
            return await invoke_llm_json(self.llm, prompt, validate=_validate, label="feedback")
        except Exception as exc:  # noqa: BLE001 - always return a usable report
            logger.warning("[feedback] Report generation failed, using fallback: %s", exc)
            return fallback_report()
