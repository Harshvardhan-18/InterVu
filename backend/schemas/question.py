from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


class Question(BaseModel):
    question: str = Field(min_length=10)
    question_type: Literal["technical", "behavioral", "coding"]
    focus_area: str = ""