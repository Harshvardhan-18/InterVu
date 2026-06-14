"""
Firecrawl Agent
---------------
Uses Firecrawl to scrape and extract clean markdown content from URLs
discovered during the Tavily research phase.
"""

from __future__ import annotations

import os
from typing import Any
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
load_dotenv()  # Load FIRECRAWL_API_KEY from .env file

class FirecrawlAgent:
    """Fetches and cleans web page content via Firecrawl."""

    def __init__(self) -> None:
        api_key = os.getenv("FIRECRAWL_API_KEY")
        self.app = FirecrawlApp(api_key=api_key)
        if not api_key:
            raise ValueError("Firecrawl API key not found")

    def scrape_url(self, url: str) -> dict[str, Any]:
        """
        Scrape a single URL and return clean markdown content.

        Args:
            url: The URL to scrape.

        Returns:
            {url, content, title, metadata}
        """
        try:
            result = self.app.scrape(
                url,
                formats=["markdown"]
            )
            content=self.clean_content(result.markdown)
            content=content[:6000]  # Truncate to 6k chars to avoid huge docs
            metadata=(dict(result.metadata) if result.metadata else {})
            print(f"[firecrawl] Scraped {url} (content length: {len(content)})")
            return{
                "url": url,
                "content": content,
                "content_length": len(content),
                "title": getattr(result.metadata, "title", ""),
                "metadata": metadata
            }
        except Exception as e:
            print(f"[firecrawl] Error scraping {url}: {e}")
            return {"url": url, "content": "", "title": "","content_length": 0, "error": str(e)}
        
    def clean_content(self, text: str) -> str:
        if not text:
            return ""

        lines = text.splitlines()

        cleaned = [
            line.strip()
            for line in lines
            if len(line.strip()) > 2
        ]

        return "\n".join(cleaned)

    def scrape_urls(self, urls: list[str]) -> list[dict[str, Any]]:
        """
        Scrape multiple URLs, filtering out failed/empty results.

        Args:
            urls: List of URLs to scrape.

        Returns:
            List of {url, content, title} dicts with non-empty content.
        """
        results = []
        for url in urls:
            result = self.scrape_url(url)
            if len(result.get("content", "")) > 200:
                results.append(result)
        return results
    
    # IGNORING CRAWL_SITE METHOD FOR NOW - MAYBE ADD BACK LATER IF WE WANT TO CRAWL COMPANY BLOGS ETC.
    # def crawl_site(self, url: str, max_pages: int = 5) -> list[dict[str, Any]]:
    #     """
    #     Crawl a site starting from a URL (e.g., company engineering blog).

    #     Args:
    #         url: Starting URL.
    #         max_pages: Maximum pages to crawl.

    #     Returns:
    #         List of {url, content} dicts.
    #     """
    #     result = self.app.crawl(
    #         url,
    #         limit=max_pages,
    #         scrapeOptions={
    #             "formats": ["markdown"],
    #             "only_main_content": True,
    #             "timeout": 10,
    #         }
    #     )
    #     pages = result.get("data", [])
    #     return [
    #         {
    #             "url": p.get("metadata", {}).get("sourceURL", ""),
    #             "content": p.get("markdown", ""),
    #         }
    #         for p in pages
    #         if p.get("markdown")
    #     ]
