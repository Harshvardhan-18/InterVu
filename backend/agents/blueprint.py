"""
Blueprint Generator
-------------------
Converts extracted knowledge (skills, rounds, difficulty) into a structured
interview plan stored in PostgreSQL.
"""

from __future__ import annotations

from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI
import json


SECTION_DEFAULTS = {
    "easy": [
        {"name": "Screening", "questions": 2},
        {"name": "Coding", "questions": 2},
        {"name": "Behavioral", "questions": 2},
    ],
    "medium": [
        {"name": "Screening", "questions": 2},
        {"name": "Coding", "questions": 3},
        {"name": "Role Specific", "questions": 3},
        {"name": "Behavioral", "questions": 2},
    ],
    "hard": [
        {"name": "Screening", "questions": 2},
        {"name": "Coding", "questions": 4},
        {"name": "Role Specific", "questions": 4},
        {"name": "System Design", "questions": 2},
        {"name": "Behavioral", "questions": 2},
    ],
}


class BlueprintGenerator:
    """Generates a structured interview blueprint from extracted knowledge."""

    def __init__(self, model: str = "gemini-2.5-flash-preview-05-20") -> None:
        self.llm = ChatGoogleGenerativeAI(model=model)

    def generate(
        self,
        company: str,
        role: str,
        skills: list[str],
        rounds: list[str],
        difficulty: str,
    ) -> dict[str, Any]:
        """
        Generate an interview blueprint.

        Args:
            company: Target company.
            role: Target role.
            skills: Extracted required skills.
            rounds: Extracted interview rounds.
            difficulty: Estimated difficulty (easy | medium | hard).

        Returns:
            Blueprint dict with sections and question counts.
        """
        difficulty = difficulty.lower()
        default_sections = SECTION_DEFAULTS.get(difficulty, SECTION_DEFAULTS["medium"])

        prompt = f"""You are designing an interview plan for {role} at {company}.

Required Skills: {', '.join(skills)}
Interview Rounds: {', '.join(rounds)}
Difficulty: {difficulty}

Generate a structured interview blueprint. Respond ONLY with valid JSON:
{{
  "interview_type": "technical" | "behavioral" | "mixed",
  "estimated_duration_minutes": <int>,
  "sections": [
    {{
      "name": "<section name>",
      "type": "coding" | "behavioral" | "technical" | "system_design" | "screening",
      "questions": <int 1-5>,
      "focus_areas": ["...", "..."]
    }}
  ]
}}"""

        try:
            response = self.llm.invoke(prompt)
            raw = response.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return json.loads(raw)
        except Exception:
            # Fallback to defaults
            return {
                "interview_type": "mixed",
                "estimated_duration_minutes": 60,
                "sections": default_sections,
            }
