from pipeline import ResearchPipeline

pp=ResearchPipeline()

result=pp.run(
    company="Google",
    role="SDE I"
)

print(result["extracted"])