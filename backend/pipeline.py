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

from search.tavily import TavilySearch
from search.firecrawl import FirecrawlAgent
from agents.extractor import ExtractorAgent
from rag.vector_store import VectorStore
from normalization.normalizer import ExtractionNormalizer


class ResearchPipeline:
    """End-to-end research pipeline for a company/role pair."""

    def __init__(self) -> None:
        self.tavily = TavilySearch()
        self.firecrawl = FirecrawlAgent()
        self.extractor = ExtractorAgent()
        self.vector_store = VectorStore()
        self.normalizer = ExtractionNormalizer()

    def rank_results(self,results:list[dict[str,Any]]) -> list[dict[str,Any]]:
        ranked = []

        # source_bonus = {
        #     "reddit.com": 2,
        #     "leetcode.com": 2,
        #     "geeksforgeeks.org": 2,
        #     "glassdoor.com": 1,
        # }

        category_bonus = {
            "interview_experiences": 3,
            "process": 2,
            "job": 2,
            "skills": 1,
        }

        for r in results:
            score=r.get("score",0)
            # score+=source_bonus.get(r.get("source", ""),0)
            score+=category_bonus.get(r.get("category", ""),0)
            ranked.append({**r,"relevance_score":score})

        ranked.sort(key=lambda x: x["relevance_score"],reverse=True)
        return ranked

    def run(self, company: str, role: str) -> dict[str, Any]:
        """
            Run the end-to-end research pipeline.

            The pipeline gathers information about a company-role pair,
            ranks and scrapes relevant sources, extracts structured
            interview knowledge, and returns a consolidated summary.

            Args:
                company: Target company name.
                role: Target role being researched.

            Returns:
                Dictionary containing extracted interview preparation data,
                including skills, technologies, interview topics, rounds,
                behavioral patterns, difficulty, and key insights.
        """
        # 1. Search
        search_results = self.tavily.research(company, role)

        ranked_results = self.rank_results(search_results)

        job_results = [r for r in ranked_results if r["category"] == "job"]
        interview_results = [r for r in ranked_results if r["category"] == "interview_experiences"]
        process_results = [r for r in ranked_results if r["category"] == "process"]

        selected_results = interview_results[:4] + process_results[:2] + job_results[:2]

        print(f"Selected {len(selected_results)} results for scraping:")
        for r in selected_results:
            print(f"- {r['url']} (category: {r['category']}, relevance_score: {r['relevance_score']})")

        if(len(selected_results)<8):
            used_urls = set(r["url"] for r in selected_results)
            for r in ranked_results:
                if r["url"] not in used_urls:
                    selected_results.append(r)
                    used_urls.add(r["url"])
                if len(selected_results) >= 8:
                    break

        top_urls=[
            r["url"]
            for r in selected_results
            if r["source"] != "reddit.com"  # Exclude Reddit links due to scraping difficulties
        ]

        # 2. Scrape top URLs (limit to 8 to avoid rate limits)
        scraped = self.firecrawl.scrape_urls(top_urls)

        # Combine snippets (for URLs that failed scraping) with full content
        all_content: list[dict[str, str]] = []
        scraped_urls = {s["url"]: s for s in scraped}
        for r in selected_results:
            if r["source"] == "reddit.com":
                all_content.append(r)
                continue
            if r["url"] not in scraped_urls:
               continue
            full = scraped_urls[r["url"]]
            all_content.append({
                **r,
                "title":full["title"],
                "content": full["content"],
                "metadata": full["metadata"]
            })

        # 3. Extract structured knowledge
        extracted = self.extractor.extract(company, role, all_content)

        extracted = self.normalizer.normalize(extracted)

        # 4. Embed and store in ChromaDB
        chunks_added = 0
        for item in all_content:
            if item.get("content"):
                chunks_added += self.vector_store.add_document(
                    text=item["content"],
                    metadata={
                        "company": company,
                        "role": role,
                        "source": item.get("source", ""),
                        "category": item.get("category", ""),   
                    },
                    source_url=item.get("url", ""),
                )

        return {
            "extracted": extracted,
            "chunks_added": chunks_added,
            "urls_processed": len(all_content),
        }
