from pipeline import ResearchPipeline

pp=ResearchPipeline()

result=pp.run(
    company="Google",
    role="SDE I"
)

print(result)

# results=pp.vector_store.search(
#     query="What are the most common interview questions for Google SDE I roles?",
#     filters={"company": "Google", "role": "SDE I"},
# )

# print(results)