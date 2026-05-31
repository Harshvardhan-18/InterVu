"""
Tavily Search
-------------
Generates and executes search queries to gather company/role information.
"""

from __future__ import annotations

import os
from typing import Any
from dotenv import load_dotenv
from tavily import TavilyClient
load_dotenv()  # Load TAVILY_API_KEY from .env file

class TavilySearch:
    """Wrapper around Tavily API for research queries."""

    def __init__(self) -> None:
        self.client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

    def generate_queries(self, company: str, role: str) -> dict[str,list[str]]:
        """
        Generate categorized search queries for company and role research.

        Categories:
            - job: Job descriptions and career pages.
            - interview_experiences: Candidate-reported interview experiences.
            - skills: Required technical and non-technical skills.
            - process: Interview rounds and hiring process information.
            - engineering: Engineering blogs and technical culture content.

        Args:
            company: Target company name.
            role: Target role or position.

        Returns:
            dict[str, list[str]] containing categorized search queries.
        """
        return {
        "job": [
            f"{company} {role} job description",
            f"{company} careers {role}",
        ],

        "interview_experiences": [
            f"site:reddit.com {company} {role} interview experience",
            f"site:reddit.com {company} {role} interview",
            f"site:leetcode.com {company} {role} interview",
            f"site:geeksforgeeks.org {company} {role} interview experience",
        ],

        "skills": [
            f"{company} {role} skills required",
        ],

        "process": [
            f"{company} {role} interview process",
        ],

        "engineering": [
            f"{company} engineering blog",
        ],
    }

    def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        """
        Execute a single Tavily search query.

        Args:
            query: Search query string.
            max_results: Number of results to return.

        Returns:
            List of {url, title, content} dicts.
        """
        try:
            response = self.client.search(
                query=query,
                max_results=max_results,
                search_depth="advanced",
                include_answer=False,
            )
        except Exception as e:
            print(f"Tavily search error for query '{query}': {e}")
            return []
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
            [
                {
                "url": "...",
                "title": "...",
                "content": "...",
                "category": "...",
                "query": "..."
                }
            ]
        """
        query_groups = self.generate_queries(company, role)
        seen_urls: set[str] = set()
        results: list[dict[str, Any]] = []

        for category,queries in query_groups.items():
            for query in queries:
                search_results=self.search(query)
                for item in search_results:
                    url=item["url"]
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    results.append({
                        **item,
                        "category": category,
                        "query": query,
                    })
        return results
