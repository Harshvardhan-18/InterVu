from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


class BlueprintSection(BaseModel):
    name:str
    type: Literal["coding", "behavioral", "technical", "system_design", "screening"]
    questions:int=Field(ge=1,le=5)
    focus_areas:list[str]=Field(default_factory=list)

class Blueprint(BaseModel):
    sections: list[BlueprintSection]
