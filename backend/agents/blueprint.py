"""
Blueprint Generator
-------------------
Converts extracted knowledge (skills, rounds, difficulty) into a structured
interview plan stored in PostgreSQL.
"""

from __future__ import annotations

from typing import Any
from pydantic import ValidationError
from schemas.blueprint import Blueprint, BlueprintSection
from langchain_groq import ChatGroq
import json
from prompts.blueprint import BLUEPRINT_PROMPT
import asyncio
import os
import re
from dotenv import load_dotenv
load_dotenv()

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

    def __init__(self, model: str = "llama-3.3-70b-versatile") -> None:
        self.llm = ChatGroq(model=model,api_key=os.getenv("GROQ_API_KEY"))
    
    def _fallback(self,difficulty:str)->dict[str,Any]:
        sections= SECTION_DEFAULTS.get(difficulty, SECTION_DEFAULTS["medium"])
        return {"sections":sort_sections(sections)}
    
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
        difficulty = difficulty.lower()

        prompt = BLUEPRINT_PROMPT.format(
            company=company,
            role=role,
            skills=", ".join(skills),
            topics=", ".join(topics),      
            rounds=", ".join(rounds),
            dsa_questions=", ".join(dsa_questions),
            difficulty=difficulty
        )
        try:
            response = await self.llm.ainvoke(prompt)
            raw = response.content.strip()
            start=raw.find("{")
            end=raw.rfind("}")
            if start == -1 or end == -1:
                raise ValueError(f"No JSON found in response:\n{raw[:500]}")
            data = json.loads(raw[start:end+1])
            validated = Blueprint(**data)  # Validate structure with Pydantic
            result = validated.model_dump()
            result["sections"] = sort_sections(result.get("sections", []))
            return result
        except (ValidationError, json.JSONDecodeError, ValueError) as e:
            print(f"[blueprint] Error generating blueprint: {e}")
            return self._fallback(difficulty)
        except Exception as e:
            # Fallback to defaults
            print(f"[blueprint] Unexpected error during blueprint generation, using fallback: {e}")
            return self._fallback(difficulty)
