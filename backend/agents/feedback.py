"""
Feedback Agent
--------------
Runs after the full interview to produce a comprehensive performance report.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI


class FeedbackAgent:
    """Generates a post-interview feedback report."""

    def __init__(self, model: str = "gemini-2.5-pro-preview-06-05") -> None:
        self.llm = ChatGoogleGenerativeAI(model=model)

    def generate_report(
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
            qa_pairs: List of {question, answer, evaluation} dicts.

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
        qa_text = "\n\n".join(
            f"Q: {pair['question']}\nA: {pair['answer']}\nScore: {pair['evaluation'].get('score', 'N/A')}"
            for pair in qa_pairs
        )

        prompt = f"""You are a senior hiring manager at {company} evaluating a candidate for {role}.

Here is the complete interview transcript with scores:

{qa_text}

Generate a comprehensive feedback report. Respond ONLY with valid JSON:
{{
  "overall_score": <0-100 int>,
  "strong_topics": ["...", "..."],
  "weak_topics": ["...", "..."],
  "section_scores": {{"section_name": <0-10 float>, ...}},
  "recommendations": ["...", "...", "..."],
  "summary": "..."
}}"""

        response = self.llm.invoke(prompt)
        raw = response.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        return json.loads(raw)
