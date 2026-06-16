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
from dotenv import load_dotenv
load_dotenv()

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
        return {"sections":sections}
    
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
            return validated.model_dump()
        except (ValidationError, json.JSONDecodeError, ValueError) as e:
            print(f"[blueprint] Error generating blueprint: {e}")
            return self._fallback(difficulty)
        except Exception as e:
            # Fallback to defaults
            print(f"[blueprint] Unexpected error during blueprint generation, using fallback: {e}")
            return self._fallback(difficulty)
