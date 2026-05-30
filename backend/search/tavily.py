"""
Tavily Search
-------------
Generates and executes search queries to gather company/role information.
"""

from __future__ import annotations

import os
from typing import Any

from tavily import TavilyClient


class TavilySearch:
    """Wrapper around Tavily API for research queries."""

    def __init__(self) -> None:
        self.client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

    def generate_queries(self, company: str, role: str) -> list[str]:
        """
        Generate targeted search queries for company + role research.

        Args:
            company: Target company name.
            role: Target role/position.

        Returns:
            List of search query strings.
        """
        return [
            f"{company} {role} job description",
            f"{company} {role} interview experience",
            f"{company} {role} skills required",
            f"{company} software engineer interview process",
            f"site:leetcode.com {company} interview",
            f"site:glassdoor.com {company} {role} interview",
        ]

    def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        """
        Execute a single Tavily search query.

        Args:
            query: Search query string.
            max_results: Number of results to return.

        Returns:
            List of {url, title, content} dicts.
        """
        response = self.client.search(
            query=query,
            max_results=max_results,
            search_depth="advanced",
            include_answer=False,
        )
        return [
            {
                "url": r.get("url", ""),
                "title": r.get("title", ""),
                "content": r.get("content", ""),
            }
            for r in response.get("results", [])
        ]

    def research(self, company: str, role: str) -> list[dict[str, Any]]:
        """
        Run all generated queries and aggregate results.

        Returns:
            Deduplicated list of {url, title, content} dicts.
        """
        queries = self.generate_queries(company, role)
        seen_urls: set[str] = set()
        results: list[dict[str, Any]] = []

        for query in queries:
            for item in self.search(query):
                if item["url"] not in seen_urls:
                    seen_urls.add(item["url"])
                    results.append(item)

        return results
