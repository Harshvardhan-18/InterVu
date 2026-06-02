from search.firecrawl import FirecrawlAgent
import os
from firecrawl import FirecrawlApp
import inspect
agent = FirecrawlAgent()

result = agent.scrape_url(
    "https://www.amazon.jobs/en/jobs/10424932/sde-1"
)


print(type(result))
print(result)

