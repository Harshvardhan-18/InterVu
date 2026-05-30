"""
Extractor Agent
---------------
Converts raw web content (job descriptions, interview experiences, blogs)
into structured knowledge: skills, topics, interview rounds, difficulty.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI


class ExtractorAgent:
    """Extracts structured interview knowledge from raw web content."""

    def __init__(self, model: str = "gemini-2.5-flash-preview-05-20") -> None:
        self.llm = ChatGoogleGenerativeAI(model=model)

    def extract(
        self,
        company: str,
        role: str,
        raw_content: list[dict[str, str]],
    ) -> dict[str, Any]:
        """
        Extract structured knowledge from raw content.

        Args:
            company: Target company name.
            role: Target role.
            raw_content: List of {url, content} dicts from research agent.

        Returns:
            {
                "skills": [str, ...],
                "topics": [str, ...],
                "rounds": [str, ...],
                "difficulty": "Easy" | "Medium" | "Hard",
                "key_insights": [str, ...]
            }
        """
        content_text = "\n\n---\n\n".join(
            f"Source: {item.get('url', 'unknown')}\n{item.get('content', '')}"
            for item in raw_content
        )

        prompt = f"""You are an expert at analyzing job postings and interview experiences.
Company: {company}
Role: {role}

Analyze the following content and extract structured information:

{content_text}

Respond ONLY with valid JSON in this exact format:
{{
  "skills": ["skill1", "skill2", ...],
  "topics": ["topic1", "topic2", ...],
  "rounds": ["round1", "round2", ...],
  "difficulty": "Easy" | "Medium" | "Hard",
  "key_insights": ["insight1", "insight2", ...]
}}"""

        response = self.llm.invoke(prompt)
        raw = response.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        return json.loads(raw)
