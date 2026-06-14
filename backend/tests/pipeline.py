from pipeline import ResearchPipeline
import asyncio
pp=ResearchPipeline()

async def main():
    result=await pp.run(
        company="Google",
        role="SDE I"
    )
    print(result)

asyncio.run(main())

# results=pp.vector_store.search(
#     query="What are the most common interview questions for Google SDE I roles?",
#     filters={"company": "Google", "role": "SDE I"},
# )

# print(results)