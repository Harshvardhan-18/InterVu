from search.tavily import TavilySearch

search = TavilySearch()

results = search.research(
    company="Amazon",
    role="SDE-1"
)

print(f"\nFound {len(results)} results\n")

for i, result in enumerate(results[:10], start=1):
    print("=" * 80)
    print(f"Result #{i}")
    print(f"Category : {result['category']}")
    print(f"Title    : {result['title']}")
    print(f"URL      : {result['url']}")
    print(f"Query    : {result['query']}")
    print(f"Content  : {result['content'][:300]}")
    print()