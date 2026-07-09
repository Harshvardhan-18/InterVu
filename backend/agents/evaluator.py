"""
Evaluator Agent
---------------
Scores candidate answers across four dimensions:
  - Correctness
  - Depth
  - Communication
  - Problem Solving
"""

from __future__ import annotations

import json
from typing import Any
import os 
from config import EvaluatorModel as model
from dotenv import load_dotenv
from pydantic import ValidationError
load_dotenv()  # Load GROQ_API_KEY from .env file
from langchain_groq import ChatGroq
from prompts.evaluator import EVALUATOR_PROMPT
from schemas.evaluator import Evaluation
import asyncio

FALLBACK_EVALUATION = {
    "score": 5.0,
    "correctness": 5.0,
    "depth": 5.0,
    "communication": 5.0,
    "problem_solving": 5.0,
    "strengths": [],
    "weaknesses": [],
    "brief_feedback": "Unable to evaluate answer at this time.",
}

class EvaluatorAgent:
    """Evaluates a candidate's answer and returns a structured score."""

    def __init__(self, model: str = model) -> None:
        self.llm = ChatGroq(model=model, api_key=os.getenv("GROQ_API_KEY_2"))

    async def evaluate(
        self,
        company: str,
        role: str,
        question: str,
        answer: str,
        context: str,
        section: str,
        question_type: str = "technical"
    ) -> dict[str, Any]:
        """
        Evaluate the candidate's answer.

        Returns:
            {
                "score": float,          # 0-10
                "correctness": float,    # 0-10
                "depth": float,          # 0-10
                "communication": float,  # 0-10
                "problem_solving": float,     # 0-10
                "strengths": [str, ...],
                "weaknesses": [str, ...],
                "brief_feedback": str
            }
        """
        prompt = EVALUATOR_PROMPT.format(
            company=company,
            role=role,
            section=section,
            question=question,
            question_type=question_type,
            answer=answer,
            context=context
        )
        try:
            response = await self.llm.ainvoke(prompt)
            raw = response.content.strip()

            start = raw.find("{")
            end = raw.rfind("}")
            if start == -1 or end == -1:
                raise ValueError(f"No JSON found in response:\n{raw[:500]}")

            data = json.loads(raw[start:end + 1])
            validated = Evaluation(**data)
            return validated.model_dump()
        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            print(f"[evaluator] Evaluation error: {e}")
            return FALLBACK_EVALUATION.copy()
        except Exception as e:
            print(f"[evaluator] Unexpected error: {e}")
            return FALLBACK_EVALUATION.copy()
