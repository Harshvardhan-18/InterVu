from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field

class ConductorTurn(BaseModel):
    acknowledgment:str = Field(default="")
    question:str = Field(min_length=10)
    question_type:Literal["technical","behavioral", "coding"]
    section_name:str
    focus_area:str = Field(default="General")
    suggests_wrap_up:bool = Field(default=False)