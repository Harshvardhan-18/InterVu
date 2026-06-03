# tests/test_extractor.py

from agents.extractor import ExtractorAgent

agent = ExtractorAgent()

documents = [
    {
        "url": "test",
        "title": "Amazon SDE-1 Job Description",
        "category": "job",
        "content": """
        Requirements:
        - Java
        - Data Structures
        - Algorithms
        - Distributed Systems

        Responsibilities:
        - Build scalable systems
        - Design APIs
        """
    }
]

result = agent.extract(
    company="Amazon",
    role="SDE-1",
    raw_content=documents
)

print(result)