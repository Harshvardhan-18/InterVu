"""
Anakin Scraper
--------------
Scrapes Reddit URLs through the Anakin batch URL-scraper API. All HTTP calls
are non-blocking (httpx.AsyncClient).
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

ANAKIN_BASE_URL = "https://api.anakin.io/v1/url-scraper"


class AnakinAgent:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("ANAKIN_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Anakin API key must be provided either as an argument or in the environment variable 'ANAKIN_API_KEY'."
            )

    async def scrape_urls(
        self,
        urls: list[str],
        max_wait_seconds: int = 120,
        poll_interval: float = 3,
    ) -> list[dict[str, Any]]:
        if not urls:
            return []

        headers = {"X-API-Key": self.api_key}
        scraped_data: list[dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{ANAKIN_BASE_URL}/batch",
                headers=headers,
                json={
                    "urls": urls,
                    "country": "in",
                    "useBrowser": False,
                    "generateJson": True,
                },
            )
            response.raise_for_status()
            batch_id = response.json().get("jobId")
            if not batch_id:
                raise RuntimeError("[anakin] Batch request returned no jobId")

            elapsed = 0.0
            while True:
                result = await client.get(f"{ANAKIN_BASE_URL}/{batch_id}", headers=headers)
                result.raise_for_status()
                data = result.json()
                status = data.get("status")

                if status == "completed":
                    for item in data.get("results", []):
                        url = item.get("url", "")
                        if item.get("status") == "completed":
                            logger.info("[anakin] Scraping completed for: %s", url)
                            json_data = (item.get("generatedJson") or {}).get("data") or {}
                            scraped_data.append({
                                "url": url,
                                "title": json_data.get("title", ""),
                                "content": json_data.get("content", ""),
                            })
                        else:
                            logger.warning(
                                "[anakin] Scraping failed for: %s with status: %s", url, item.get("status")
                            )
                    break

                if status in {"failed", "error"}:
                    raise RuntimeError(f"[anakin] API request failed for {batch_id}")
                if elapsed >= max_wait_seconds:
                    raise TimeoutError(f"[anakin] API request timed out after {max_wait_seconds} seconds")

                await asyncio.sleep(poll_interval)
                elapsed += poll_interval

        return scraped_data
