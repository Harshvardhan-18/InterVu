"""
Research Pipeline
-----------------
Orchestrates the full research flow:
  1. TavilySearch  → list of URLs + snippets
  2. FirecrawlAgent → full page markdown for top URLs
  3. ExtractorAgent → structured knowledge
  4. VectorStore    → embed + upsert into ChromaDB
"""

from __future__ import annotations

from typing import Any

from .search.tavily import TavilySearch
from .search.firecrawl import FirecrawlAgent
from .agents.extractor import ExtractorAgent
from .rag.vector_store import VectorStore


class ResearchPipeline:
    """End-to-end research pipeline for a company/role pair."""

    def __init__(self) -> None:
        self.tavily = TavilySearch()
        self.firecrawl = FirecrawlAgent()
        self.extractor = ExtractorAgent()
        self.vector_store = VectorStore()

    def run(self, company: str, role: str) -> dict[str, Any]:
        """
        Run the full pipeline.

        Returns:
            {
                "extracted": {skills, topics, rounds, difficulty, key_insights},
                "chunks_added": int,
                "urls_processed": int,
            }
        """
        # 1. Search
        search_results = self.tavily.research(company, role)

        # 2. Scrape top URLs (limit to 8 to avoid rate limits)
        top_urls = [r["url"] for r in search_results[:8] if r.get("url")]
        scraped = self.firecrawl.scrape_urls(top_urls)

        # Combine snippets (for URLs that failed scraping) with full content
        all_content: list[dict[str, str]] = []
        scraped_urls = {s["url"] for s in scraped}
        for r in search_results:
            if r["url"] in scraped_urls:
                full = next(s for s in scraped if s["url"] == r["url"])
                all_content.append({"url": r["url"], "content": full["content"]})
            else:
                all_content.append({"url": r["url"], "content": r.get("content", "")})

        # 3. Extract structured knowledge
        extracted = self.extractor.extract(company, role, all_content)

        # 4. Embed and store in ChromaDB
        chunks_added = 0
        for item in all_content:
            if item.get("content"):
                chunks_added += self.vector_store.add_document(
                    text=item["content"],
                    metadata={
                        "company": company,
                        "role": role,
                        "source": "research",
                    },
                    source_url=item.get("url", ""),
                )

        return {
            "extracted": extracted,
            "chunks_added": chunks_added,
            "urls_processed": len(all_content),
        }
