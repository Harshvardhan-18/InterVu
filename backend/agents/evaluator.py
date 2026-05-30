"""
Evaluator Agent
---------------
Scores candidate answers across four dimensions:
  - Correctness
  - Depth
  - Communication
  - Confidence
"""

from __future__ import annotations

import json
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI


class EvaluatorAgent:
    """Evaluates a candidate's answer and returns a structured score."""

    def __init__(self, model: str = "gemini-2.5-pro-preview-06-05") -> None:
        self.llm = ChatGoogleGenerativeAI(model=model)

    def evaluate(
        self,
        question: str,
        answer: str,
        context: str,
        section: str,
    ) -> dict[str, Any]:
        """
        Evaluate the candidate's answer.

        Returns:
            {
                "score": float,          # 0-10
                "correctness": float,    # 0-10
                "depth": float,          # 0-10
                "communication": float,  # 0-10
                "confidence": float,     # 0-10
                "strengths": [str, ...],
                "weaknesses": [str, ...],
                "brief_feedback": str
            }
        """
        prompt = f"""You are a senior technical interviewer evaluating a candidate's answer.

## Interview Section: {section}

## Question:
{question}

## Candidate's Answer:
{answer}

## Reference Context:
{context}

Evaluate the answer across these dimensions (score 0-10 each):
1. Correctness — technical accuracy
2. Depth — thoroughness and detail
3. Communication — clarity and structure
4. Confidence — assertiveness and precision

Respond ONLY with a valid JSON object in this exact format:
{{
  "score": <overall 0-10 float>,
  "correctness": <0-10 float>,
  "depth": <0-10 float>,
  "communication": <0-10 float>,
  "confidence": <0-10 float>,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "brief_feedback": "..."
}}"""

        response = self.llm.invoke(prompt)
        raw = response.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        return json.loads(raw)
