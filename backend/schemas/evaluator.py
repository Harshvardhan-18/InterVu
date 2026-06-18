from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal

class Evaluation(BaseModel):
    score: float = Field(ge=0, le=10)
    correctness: float = Field(ge=0, le=10)
    depth: float = Field(ge=0, le=10)
    communication: float = Field(ge=0, le=10)
    problem_solving: float = Field(ge=0, le=10)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    brief_feedback: str = ""