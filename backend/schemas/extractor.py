

from pydantic import BaseModel, Field


class ExtractionResult(BaseModel):
    skills: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    rounds: list[str] = Field(default_factory=list)
    behavioral_patterns: list[str] = Field(default_factory=list)
    difficulty: str = "Medium"
    key_insights: list[str] = Field(default_factory=list)
    dsa_questions: list[str] = Field(default_factory=list)