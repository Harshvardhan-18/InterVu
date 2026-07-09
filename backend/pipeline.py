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
from search.anakin import AnakinAgent
import asyncio


class ResearchPipeline:
    """End-to-end research pipeline for a company/role pair."""

    def __init__(self) -> None:
        self.tavily = TavilySearch()
        self.firecrawl = FirecrawlAgent()
        self.extractor = ExtractorAgent()
        self.vector_store = VectorStore()
        self.normalizer = ExtractionNormalizer()
        self.anakin=AnakinAgent()

    def rank_results(self,results:list[dict[str,Any]]) -> list[dict[str,Any]]:
        ranked = []

        source_bonus = {
            "reddit.com": 2,
            "leetcode.com": 2,
            "geeksforgeeks.org": 2,
            "glassdoor.com": 1,
        }

        category_bonus = {
            "interview_experiences": 3,
            "process": 2,
            "job": 2,
            "skills": 1,
        }

        for r in results:
            score=r.get("score",0)
            score+=source_bonus.get(r.get("source", ""),0)
            score+=category_bonus.get(r.get("category", ""),0)
            ranked.append({**r,"relevance_score":score})

        ranked.sort(key=lambda x: x["relevance_score"],reverse=True)
        return ranked

    async def run(self, company: str, role: str) -> dict[str, Any]:
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
        search_results = await self.tavily.research(company, role)

        ranked_results = self.rank_results(search_results)

        BAD_URL_TERMS = {
            "salary",
            "compensation",
            "benefits",
            "recruiter",
        }

        job_results = [r for r in ranked_results
                        if r["category"] == "job"
                        and not any(term in r.get("url", "").lower() for term in BAD_URL_TERMS)]
        interview_results = [r for r in ranked_results
                            if r["category"] == "interview_experiences" 
                            and not any(term in r.get("url", "").lower() for term in BAD_URL_TERMS)]
        process_results = [r for r in ranked_results 
                        if r["category"] == "process" 
                        and not any(term in r.get("url", "").lower() for term in BAD_URL_TERMS)]

        selected_results = interview_results[:4] + process_results[:2] + job_results[:2]

        print(f"[pipeline] Selected {len(selected_results)} results for scraping:")
        for r in selected_results:
            print(f"[pipeline] - {r['url']} (category: {r['category']}, relevance_score: {r['relevance_score']})")

        if(len(selected_results)<8):
            used_urls = set(r["url"] for r in selected_results)
            for r in ranked_results:
                if r["url"] not in used_urls and not any(term in r.get("url", "").lower() for term in BAD_URL_TERMS):
                    selected_results.append(r)
                    used_urls.add(r["url"])

                if len(selected_results) >= 8:
                    break
        reddit_urls=[]
        top_urls=[]
        for r in selected_results:
            if r["source"]=="reddit.com":
                reddit_urls.append(r["url"])
            else:
                top_urls.append(r["url"])

        # 2. Scrape non-Reddit URLs via Firecrawl; Reddit URLs via Anakin
        scraped,reddit_scraped = await asyncio.gather(
            self.firecrawl.scrape_urls(top_urls),
            self.anakin.scrape_urls(reddit_urls)
        )

        # Build lookup dicts keyed by URL for O(1) access
        scraped_urls = {s["url"]: s for s in scraped}
        reddit_scraped_urls = {s["url"]: s for s in reddit_scraped}

        # Merge full scraped content back into the ranked results, keeping JSON structure uniform.
        # If a URL failed to scrape (either scraper), fall back to the Tavily snippet so the
        # extractor still gets some signal rather than silently dropping the result.
        all_content: list[dict[str, str]] = []
        for r in selected_results:
            if r["source"] == "reddit.com":
                full = reddit_scraped_urls.get(r["url"])
                if full and full.get("content"):
                    all_content.append({
                        **r,
                        "title": full.get("title", r.get("title", "")),
                        "content": full["content"],
                        "metadata": full.get("metadata", {}),
                    })
                else:
                    # Anakin failed for this URL — fall back to Tavily snippet
                    print(f"[pipeline] Anakin scrape failed for {r['url']}, using Tavily snippet")
                    all_content.append(r)
            else:
                full = scraped_urls.get(r["url"])
                if not full:
                    continue  # Firecrawl failed and no snippet to fall back to
                all_content.append({
                    **r,
                    "title": full["title"],
                    "content": full["content"],
                    "metadata": full["metadata"],
                })

        # 3. Extract structured knowledge
        extracted =await self.extractor.extract(company, role, all_content)

        extracted = self.normalizer.normalize(extracted)

        # 4. Embed and store in ChromaDB
        chunks_added = 0
        for item in all_content:
            if item.get("content"):
                chunks_added += await self.vector_store.add_document(
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
