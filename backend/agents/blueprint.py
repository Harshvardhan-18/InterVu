"""
Blueprint Generator
-------------------
Converts extracted knowledge (skills, rounds, difficulty) into a structured
interview plan stored in PostgreSQL.
"""

from __future__ import annotations

import copy
import logging
import re
from typing import Any

from langchain_groq import ChatGroq

from config import AGENT_GROQ_KEY_SLOT, BlueprintModel as model, groq_api_key
from prompts.blueprint import BLUEPRINT_PROMPT
from schemas.blueprint import Blueprint
from utils.difficulty import normalize_difficulty
from utils.llm_json import invoke_llm_json

logger = logging.getLogger(__name__)

SECTION_NAME_ORDER_PATTERNS: list[tuple[int, list[str]]] = [
    (0, ["screening", "screening call", "screening round", "fitment"]),
    (1, ["online assessment", "google oa", r"^oa$", "dsa round"]),
    (2, ["phone screen", "telephonic", "telephone"]),
    (3, [r"^round \d", "coding round", "technical round", "technical interview", "onsite", "on-site", "on site", "team match"]),
    (4, ["system design"]),
    (5, ["googleyness", "googlyness", "googliness", "hr round", "hr interview", "behavioral", "hiring committee"]),
]

SECTIONS_TYPE_ORDER ={
    "screening": 0,
    "coding": 1,        
    "technical": 2,    
    "system_design": 3,
    "behavioral": 4, 
}

def _name_based_order(name: str) -> int | None:
    name_lower = name.strip().lower()
    for order, patterns in SECTION_NAME_ORDER_PATTERNS:
        if any(re.search(p, name_lower) for p in patterns):
            return order
    return None


def sort_sections(sections: list[dict]) -> list[dict]:
    """
    Sort sections into a realistic interview flow.
    Prefers name-based pattern matching (more reliable than the LLM's
    self-reported `type`, which is sometimes inconsistent), falling back
    to type-based order if the name doesn't match a known pattern.
    """
    def sort_key(s: dict) -> int:
        name_order = _name_based_order(s.get("name", ""))
        if name_order is not None:
            return name_order
        return SECTIONS_TYPE_ORDER.get(s.get("type", ""), 99)

    return sorted(sections, key=sort_key)

SECTION_DEFAULTS = {
    "easy": [
        {"name": "Screening", "type": "screening", "questions": 2, "focus_areas": []},
        {"name": "Coding", "type": "coding", "questions": 2, "focus_areas": []},
        {"name": "Behavioral", "type": "behavioral", "questions": 2, "focus_areas": []},
    ],
    "medium": [
        {"name": "Screening", "type": "screening", "questions": 2, "focus_areas": []},
        {"name": "Coding", "type": "coding", "questions": 3, "focus_areas": []},
        {"name": "Role Specific", "type": "technical", "questions": 3, "focus_areas": []},
        {"name": "Behavioral", "type": "behavioral", "questions": 2, "focus_areas": []},
    ],
    "hard": [
        {"name": "Screening", "type": "screening", "questions": 2, "focus_areas": []},
        {"name": "Coding", "type": "coding", "questions": 4, "focus_areas": []},
        {"name": "Role Specific", "type": "technical", "questions": 4, "focus_areas": []},
        {"name": "System Design", "type": "system_design", "questions": 2, "focus_areas": []},
        {"name": "Behavioral", "type": "behavioral", "questions": 2, "focus_areas": []},
    ],
}


class BlueprintGenerator:
    """Generates a structured interview blueprint from extracted knowledge."""

    def __init__(self, model: str = model) -> None:
        self.llm = ChatGroq(model=model, api_key=groq_api_key(AGENT_GROQ_KEY_SLOT))

    def _fallback(self, difficulty: str) -> dict[str, Any]:
        sections = SECTION_DEFAULTS.get(difficulty.lower(), SECTION_DEFAULTS["medium"])
        # Deep copy so callers can never mutate the shared defaults.
        # ``fallback`` tells the API this is the generic plan, not an AI-made one.
        return {"sections": sort_sections(copy.deepcopy(sections)), "fallback": True}
    
    async def generate(
        self,
        company: str,
        role: str,
        skills: list[str],
        topics: list[str],
        rounds: list[str],
        dsa_questions: list[str],
        difficulty: str,
    ) -> dict[str, Any]:
        """
        Generate an interview blueprint.

        Args:
            company: Target company.
            role: Target role.
            skills: Extracted required skills.
            topics: Extracted interview topics.
            rounds: Extracted interview rounds.
            dsa_questions: Extracted DSA questions/patterns.
            difficulty: Estimated difficulty (Easy | Medium | Hard).

        Returns:
            Blueprint dict with sections,types, question counts and focus areas.
        """
        difficulty = normalize_difficulty(difficulty).lower()

        prompt = BLUEPRINT_PROMPT.format(
            company=company,
            role=role,
            skills=", ".join(skills or []),
            topics=", ".join(topics or []),
            rounds=", ".join(rounds or []),
            dsa_questions=", ".join(dsa_questions or []),
            difficulty=difficulty
        )

        def _validate(data: dict[str, Any]) -> dict[str, Any]:
            result = Blueprint(**data).model_dump()
            if not result.get("sections"):
                raise ValueError("Blueprint has no sections")
            result["sections"] = sort_sections(result["sections"])
            return result

        try:
            return await invoke_llm_json(self.llm, prompt, validate=_validate, label="blueprint")
        except Exception as exc:  # noqa: BLE001 - always return a usable blueprint
            logger.warning("[blueprint] Blueprint generation failed, using defaults: %s", exc)
            return self._fallback(difficulty)
