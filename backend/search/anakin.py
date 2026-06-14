import requests
import httpx
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
import time

class AnakinAgent:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv('ANAKIN_API_KEY')
        if not self.api_key:
            raise ValueError("Anakin API key must be provided either as an argument or in the environment variable 'ANAKIN_API_KEY'.")
    
    async def scrape_urls(self, urls: list[str],max_wait_seconds: int = 120) -> list[dict]:
        if not urls:
            return []
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                'https://api.anakin.io/v1/url-scraper/batch',
                headers={'X-API-Key': self.api_key},
                json={
                    'urls': urls,
                    'country':'in',
                'useBrowser': False,
                'generateJson': True
            }
        ) 
        response.raise_for_status()
        batch_id=response.json().get('jobId')
        scraped_data=[]
        elapsed=0
        poll_interval=3
        while True: 
            result = requests.get(
                f'https://api.anakin.io/v1/url-scraper/{batch_id}',
                headers={'X-API-Key': self.api_key},
                timeout=30
            )
            result.raise_for_status()
            data=result.json()
            if data['status']=='completed':
                for item in data['results']:
                    if item['status']=='completed':
                        print(f"[anakin] Scraping completed for: {item['url']}")
                        json_data=item['generatedJson']['data']
                        scraped_data.append({
                            "url": item['url'],
                            "title": json_data.get('title', ''),
                            "content": json_data.get('content', ''),
                        })
                    else:
                        print(f"[anakin] Scraping failed for : {item['url']} with status: {item['status']}")
                break
            if data['status'] in {"failed","error"}:
                raise Exception(f"[anakin] API request failed for {batch_id}")
            if elapsed >= max_wait_seconds:
                raise TimeoutError(f"[anakin] API request timed out after {max_wait_seconds} seconds")
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        return scraped_data


