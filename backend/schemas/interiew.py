from pydantic import BaseModel
from typing import Any

class StartInterviewRequest(BaseModel):
    user_id: int
    company: str
    role: str
    difficulty: str = "medium"


class StartInterviewResponse(BaseModel):
    interview_id: int
    first_question: str
    blueprint: dict[str, Any]


class SubmitAnswerRequest(BaseModel):
    answer: str


class SubmitAnswerResponse(BaseModel):
    evaluation: dict[str, Any]
    next_question: str | None
    interview_complete: bool
