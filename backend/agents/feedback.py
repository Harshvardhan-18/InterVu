"""
Feedback Agent
--------------
Runs after the full interview to produce a comprehensive performance report.
"""
from __future__ import annotations
import json
import os
from typing import Any
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from pydantic import ValidationError
from prompts.feedback import FEEDBACK_PROMPT
from schemas.feedback import Report
load_dotenv()

FALLBACK_REPORT = {
    "overall_score": 0,
    "strong_topics": [],
    "weak_topics": [],
    "section_scores": {},
    "recommendations": ["Unable to generate report. Please review your answers manually."],
    "summary": "Report generation failed.",
}


class FeedbackAgent:
    """Generates a post-interview feedback report."""

    def __init__(self, model: str = "llama-3.3-70b-versatile") -> None:
        self.llm = ChatGroq(
            model=model,
            api_key=os.getenv("GROQ_API_KEY")
        )

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
                "summary": str
            }
        """
        if not qa_pairs:
            print("[feedback] No Q&A pairs provided, returning fallback report")
            return FALLBACK_REPORT.copy()

        qa_text = "\n\n".join(
            f"Section: {pair.get('section', 'Unknown')}\n"
            f"Q: {pair['question']}\n"
            f"A: {pair['answer']}\n"
            f"Score: {pair.get('evaluation', {}).get('score', 'N/A')}\n"
            f"Feedback: {pair.get('evaluation', {}).get('brief_feedback', 'N/A')}"
            for pair in qa_pairs
        )

        prompt = FEEDBACK_PROMPT.format(
            company=company,
            role=role,
            qa_text=qa_text,
        )

        try:
            response = await self.llm.ainvoke(prompt)
            raw = response.content.strip()

            start = raw.find("{")
            end = raw.rfind("}")
            if start == -1 or end == -1:
                raise ValueError(f"No JSON found in response:\n{raw[:500]}")

            data = json.loads(raw[start:end + 1])
            validated = Report(**data)
            return validated.model_dump()

        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            print(f"[feedback] Report generation error: {e}")
            return FALLBACK_REPORT.copy()
        except Exception as e:
            print(f"[feedback] Unexpected error: {e}")
            return FALLBACK_REPORT.copy()