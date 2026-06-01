"""
Extractor Agent
---------------
Converts raw web content (job descriptions, interview experiences, blogs)
into structured knowledge: skills, topics, interview rounds, difficulty.
"""

from __future__ import annotations

import json
from typing import Any
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
load_dotenv()  # Load GROQ_API_KEY from .env file


class ExtractorAgent:
    """Extracts structured interview knowledge from raw web content."""

    def __init__(self, model: str = "llama-3.3-70b-versatile") -> None:
        self.llm = ChatGroq(model=model,api_key=os.getenv("GROQ_API_KEY"))

    def extract(self, company: str, role: str, raw_content: list[dict[str, Any]]) -> dict[str, Any]:
        partials = []
        for d in raw_content:
            try:
                partial=self.extract_doc(
                    company=company,
                    role=role,
                    doc=d
                )
                partials.append(partial)
            except Exception as e:
                print(f"Error extracting from doc {d.get('url', 'unknown')}: {e}")
        return self.merge_results(partials)
    
    def extract_doc(self,company:str,role:str,doc:dict[str,Any]) -> dict[str,Any]:
        prompt = f"""
            You are an expert at analyzing job postings and interview experiences.
            Company: {company}
            Role: {role}
            Document Category:
            {doc.get("category", "unknown")}
            Document Title:
            {doc.get("title", "unknown")}
            Source URL:
            {doc.get("url", "unknown")}
            Content:
            {doc.get("content", "")}
            Respond ONLY with valid JSON:
            {{
            "skills": [],
            "technologies": [],
            "topics": [],
            "responsibilities": [],
            "rounds": [],
            "behavioral_patterns": [],
            "difficulty": "Easy | Medium | Hard",
            "key_insights": []
            }}
        """

        response = self.llm.invoke(prompt)
        raw = response.content.strip()

        if raw.startswith("```"):
            raw = raw.replace("```json", "")
            raw = raw.replace("```", "")
            raw = raw.strip()

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            print("Failed to parse extraction JSON")
            return {
                "skills": [],
                "technologies": [],
                "topics": [],
                "responsibilities": [],
                "rounds": [],
                "behavioral_patterns": [],
                "difficulty": "Medium",
                "key_insights": [],
            }
    
    def merge_results(self,partials:list[dict[str,Any]])->dict[str,Any]:
        skills = set()
        technologies = set()
        topics = set()
        responsibilities = set()
        rounds = set()
        behavioral_patterns = set()
        key_insights = set()

        difficulties = []
        
        for result in partials:
            skills.update(result.get("skills", []))
            technologies.update(result.get("technologies", []))
            topics.update(result.get("topics", []))
            responsibilities.update(result.get("responsibilities", []))
            rounds.update(result.get("rounds", []))
            behavioral_patterns.update(result.get("behavioral_patterns", []))
            key_insights.update(result.get("key_insights", []))
            if result.get("difficulty"):
                difficulties.append(result["difficulty"])

        difficulty = "Medium"

        if difficulties:
            difficulty = max(difficulties, key=lambda d:{"Easy": 1, "Medium": 2, "Hard": 3}.get(d, 2))

        return {
            "skills": sorted(skills),
            "technologies": sorted(technologies),
            "topics": sorted(topics),
            "responsibilities": sorted(responsibilities),
            "rounds": sorted(rounds),
            "behavioral_patterns": sorted(
                behavioral_patterns
            ),
            "difficulty": difficulty,
            "key_insights": sorted(
                key_insights
            ),
        }