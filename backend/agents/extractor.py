"""
Extractor Agent
---------------
Converts raw web content (job descriptions, interview experiences, blogs)
into structured knowledge: skills, topics, interview rounds, difficulty.
"""

from __future__ import annotations
from collections import Counter
from typing import Any
import json
import os
import asyncio
from prompts.extractor import EXTRACTOR_PROMPT
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from schemas.extractor import ExtractionResult
load_dotenv()  # Load GROQ_API_KEY from .env file

class ExtractorAgent:
    """Extracts structured interview knowledge from raw web content."""

    def __init__(self, model: str = "llama-3.3-70b-versatile") -> None:
        self.llm = ChatGroq(model=model,api_key=os.getenv("GROQ_API_KEY"))

    async def extract(self, company: str, role: str, raw_content: list[dict[str, Any]]) -> dict[str, Any]:
        partials = await asyncio.gather(
            *(self.extract_doc(company, role, d) for d in raw_content)
        )
        return self.merge_results(list(partials))
    
    async def extract_doc(self,company:str,role:str,doc:dict[str,Any]) -> dict[str,Any]:
        prompt = EXTRACTOR_PROMPT.format(
            company=company,
            role=role,
            doc=doc,
            category=doc.get("category", "unknown"),
            title=doc.get("title", "unknown"),
            url=doc.get("url", "unknown"),
            content=doc.get("content", "")
        )
        
        try:
            response = await self.llm.ainvoke(prompt)
            raw = response.content.strip()
            print(f"[extractor] RAW RESPONSE:")
            print(raw[:500])
            start = raw.find("{")
            end = raw.rfind("}")
            if start == -1 or end == -1:
                raise ValueError(
                    f"[extractor] No JSON found in response:\n{raw[:500]}"
                )
            json_text = raw[start:end + 1]
            data = json.loads(json_text)
            validated = ExtractionResult(**data)
            return validated.model_dump()
        except Exception as e:
            print(f"[extractor] Error occurred while invoking LLM: {e}")
            return ExtractionResult().model_dump()

    def merge_results(self,partials:list[dict[str,Any]])->dict[str,Any]:
        skills = set()
        technologies = set()
        topics = set()
        rounds = set()
        behavioral_patterns = set()
        key_insights = set()
        dsa_questions = set()

        difficulties = []
        print(f"[extractor] Merging {len(partials)} partial extraction results")
        for result in partials:
            skills.update(
                s for s in result.get("skills", [])
                if isinstance(s, str)
            )
            technologies.update(
                t for t in result.get("technologies", [])
                if isinstance(t, str)
            )
            topics.update(
                t for t in result.get("topics", [])
                if isinstance(t, str)
            )
            rounds.update(
                r for r in result.get("rounds", [])
                if isinstance(r, str)
            )
            behavioral_patterns.update(
                b for b in result.get("behavioral_patterns", [])
                if isinstance(b, str)
            )
            key_insights.update(
                k for k in result.get("key_insights", [])
                if isinstance(k, str)
            )
            dsa_questions.update(
                q for q in result.get("dsa_questions", [])
                if isinstance(q, str)
            )
            d = result.get("difficulty", "Medium")
            if isinstance(d, str):
                d = d.strip().capitalize()
                if d in {"Easy", "Medium", "Hard"}:
                    difficulties.append(d)

        return {
            "skills": sorted(skills),
            "technologies": sorted(technologies),
            "topics": sorted(topics),
            "rounds": sorted(rounds),
            "behavioral_patterns": sorted(
                behavioral_patterns
            ),
            "difficulty": Counter(difficulties).most_common(1)[0][0] if difficulties else "Medium",
            "key_insights": sorted(
                key_insights
            ),
            "dsa_questions": sorted(
                dsa_questions
            )
        }