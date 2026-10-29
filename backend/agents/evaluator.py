"""
Evaluator Agent
---------------
Scores candidate answers across four dimensions:
  - Correctness
  - Depth
  - Communication
  - Problem Solving

Every returned evaluation carries a boolean ``fallback`` key: False for a real
LLM evaluation, True when the neutral fallback was used because the LLM call
failed. API responses and stored Response rows keep that flag.
"""

from __future__ import annotations

import logging
from typing import Any

from langchain_groq import ChatGroq

from config import AGENT_GROQ_KEY_SLOT, EvaluatorModel as model, groq_api_key
from prompts.evaluator import EVALUATOR_PROMPT
from schemas.evaluator import Evaluation
from utils.prompt_safety import UNTRUSTED_TEXT_NOTICE, clean_line, fence
from utils.llm_json import invoke_llm_json

logger = logging.getLogger(__name__)

# Longer answers are truncated before they reach the prompt.
MAX_ANSWER_CHARS = 8000

FALLBACK_EVALUATION = {
    "score": 5.0,
    "correctness": 5.0,
    "depth": 5.0,
    "communication": 5.0,
    "problem_solving": 5.0,
    "strengths": [],
    "weaknesses": [],
    "brief_feedback": "Unable to evaluate answer at this time.",
    "fallback": True,
}


def fallback_evaluation() -> dict[str, Any]:
    """A fresh copy of the neutral fallback evaluation (lists are not shared)."""
    data = dict(FALLBACK_EVALUATION)
    data["strengths"] = []
    data["weaknesses"] = []
    return data


def _validate(data: dict[str, Any]) -> dict[str, Any]:
    result = Evaluation(**data).model_dump()
    result["fallback"] = False
    return result


class EvaluatorAgent:
    """Evaluates a candidate's answer and returns a structured score."""

    def __init__(self, model: str = model) -> None:
        self.llm = ChatGroq(model=model, api_key=groq_api_key(AGENT_GROQ_KEY_SLOT))

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
                "brief_feedback": str,
                "fallback": bool         # True when the LLM failed
            }
        """
        prompt = EVALUATOR_PROMPT.format(
            company=clean_line(company),
            role=clean_line(role),
            section=clean_line(section),
            question=question,
            question_type=question_type,
            # The answer is untrusted: fenced so it cannot pose as instructions.
            answer=fence(answer, max_chars=MAX_ANSWER_CHARS),
            untrusted_notice=UNTRUSTED_TEXT_NOTICE,
            context=context
        )
        try:
            return await invoke_llm_json(self.llm, prompt, validate=_validate, label="evaluator")
        except Exception as exc:  # noqa: BLE001 - always return a usable evaluation
            logger.warning("[evaluator] Evaluation failed, using fallback: %s", exc)
            return fallback_evaluation()
