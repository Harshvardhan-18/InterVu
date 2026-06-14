from search.firecrawl import FirecrawlAgent
from firecrawl import FirecrawlApp
agent = FirecrawlAgent()

result = agent.scrape_url(
    "https://www.amazon.jobs/en/jobs/10424932/sde-1"
)


print(type(result))
print(result)

