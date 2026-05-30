"""
Firecrawl Agent
---------------
Uses Firecrawl to scrape and extract clean markdown content from URLs
discovered during the Tavily research phase.
"""

from __future__ import annotations

import os
from typing import Any

from firecrawl import FirecrawlApp


class FirecrawlAgent:
    """Fetches and cleans web page content via Firecrawl."""

    def __init__(self) -> None:
        self.app = FirecrawlApp(api_key=os.environ["FIRECRAWL_API_KEY"])

    def scrape_url(self, url: str) -> dict[str, Any]:
        """
        Scrape a single URL and return clean markdown content.

        Args:
            url: The URL to scrape.

        Returns:
            {url, content, title, metadata}
        """
        try:
            result = self.app.scrape_url(
                url,
                params={
                    "formats": ["markdown"],
                    "onlyMainContent": True,
                },
            )
            return {
                "url": url,
                "content": result.get("markdown", ""),
                "title": result.get("metadata", {}).get("title", ""),
                "metadata": result.get("metadata", {}),
            }
        except Exception as e:
            return {"url": url, "content": "", "title": "", "error": str(e)}

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
            if result.get("content"):
                results.append(result)
        return results

    def crawl_site(self, url: str, max_pages: int = 5) -> list[dict[str, Any]]:
        """
        Crawl a site starting from a URL (e.g., company engineering blog).

        Args:
            url: Starting URL.
            max_pages: Maximum pages to crawl.

        Returns:
            List of {url, content} dicts.
        """
        result = self.app.crawl_url(
            url,
            params={
                "limit": max_pages,
                "scrapeOptions": {
                    "formats": ["markdown"],
                    "onlyMainContent": True,
                },
            },
        )
        pages = result.get("data", [])
        return [
            {
                "url": p.get("metadata", {}).get("sourceURL", ""),
                "content": p.get("markdown", ""),
            }
            for p in pages
            if p.get("markdown")
        ]
