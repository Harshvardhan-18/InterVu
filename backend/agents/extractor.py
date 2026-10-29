"""
Extractor Agent
---------------
Converts raw web content (job descriptions, interview experiences, blogs)
into structured knowledge: skills, topics, interview rounds, difficulty.
"""

from __future__ import annotations

import asyncio
import logging
from collections import Counter
from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential

from config import ExtractorModel as model
from prompts.extractor import EXTRACTOR_PROMPT
from schemas.extractor import ExtractionResult
from utils.groq_pool import GroqKeyPool
from utils import usage
from utils.llm_json import extract_json_object

logger = logging.getLogger(__name__)

MAX_CONTENT_CHARS = 16000

class ExtractorAgent:
    """Extracts structured interview knowledge from raw web content."""

    def __init__(self, model: str = model) -> None:
        self.llm = GroqKeyPool(model=model).get()

    async def extract(self, company: str, role: str, raw_content: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Extract and merge knowledge from every document.

        One failing document does not discard the others. The merged result
        carries ``extraction_failed``: True when there were documents but every
        one of them failed (or there was nothing to extract), so callers can
        avoid caching an empty profile.
        """
        outcomes = await asyncio.gather(
            *(self.extract_doc(company, role, d) for d in raw_content),
            return_exceptions=True,
        )
        partials: list[dict[str, Any]] = []
        for doc, outcome in zip(raw_content, outcomes):
            if isinstance(outcome, BaseException):
                logger.warning("[extractor] Giving up on %s: %s", doc.get("url", "unknown"), outcome)
            else:
                partials.append(outcome)

        merged = self.merge_results(partials)
        merged["extraction_failed"] = not partials
        if not partials:
            logger.error(
                "[extractor] No knowledge extracted for %s / %s (%d document(s), all failed or none found).",
                company, role, len(raw_content),
            )
        return merged
    
    @retry(
        wait=wait_exponential(multiplier=1, min=10, max=60),  # 25s → 50s → 60s
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def extract_doc(self, company: str, role: str, doc: dict[str, Any]) -> dict[str, Any]:
        # Truncate content to stay within TPM budget
        content = doc.get("content", "")
        if len(content) > MAX_CONTENT_CHARS:
            content = content[:MAX_CONTENT_CHARS] + "\n...[truncated for length]"
        prompt = EXTRACTOR_PROMPT.format(
            company=company,
            role=role,
            doc=doc,
            category=doc.get("category", "unknown"),
            title=doc.get("title", "unknown"),
            url=doc.get("url", "unknown"),
            content=content,
        )
        try:
            response = await self.llm.ainvoke(prompt)
            usage.record("extractor", response, self.llm)
            validated = ExtractionResult(**extract_json_object(response))
            return validated.model_dump()
        except Exception as e:
            logger.warning("[extractor] LLM error: %s", e)
            raise   # let tenacity retry

    def merge_results(self,partials:list[dict[str,Any]])->dict[str,Any]:
        skills = set()
        technologies = set()
        topics = set()
        rounds = set()
        behavioral_patterns = set()
        key_insights = set()
        dsa_questions = set()

        difficulties = []
        logger.info("[extractor] Merging %d partial extraction results", len(partials))
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