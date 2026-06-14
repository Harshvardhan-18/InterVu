

from pydantic import BaseModel, Field, field_validator
from typing import Literal


class ExtractionResult(BaseModel):
    skills: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    rounds: list[str] = Field(default_factory=list)
    behavioral_patterns: list[str] = Field(default_factory=list)
    difficulty: Literal["Easy", "Medium", "Hard"] = "Medium"
    key_insights: list[str] = Field(default_factory=list)
    dsa_questions: list[str] = Field(default_factory=list)

    @field_validator("difficulty", mode="before")
    @classmethod
    def normalize_difficulty(cls, v):
        if isinstance(v, str):
            v = v.strip().capitalize()
            if v in {"Easy", "Medium", "Hard"}:
                return v
        return "Medium"