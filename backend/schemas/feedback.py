from __future__ import annotations
from pydantic import BaseModel, Field


class SectionScore(BaseModel):
    section: str
    score: float = Field(ge=0, le=10)


class Report(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    strong_topics: list[str] = Field(default_factory=list)
    weak_topics: list[str] = Field(default_factory=list)
    section_scores: dict[str, float] = Field(default_factory=dict)
    recommendations: list[str] = Field(default_factory=list)
    summary: str = ""