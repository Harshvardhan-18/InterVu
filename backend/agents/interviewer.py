"""
Interviewer Agent
-----------------
Responsible for generating interview questions grounded in RAG context
retrieved from ChromaDB (company/role specific knowledge base).
"""

from __future__ import annotations

import os
from typing import Any
from dotenv import load_dotenv
from pydantic import ValidationError
import json
from langchain_groq import ChatGroq
from prompts.interviewer import INTERVIEWER_PROMPT
from schemas.question import Question
load_dotenv()

SECTION_TYPE_FALLBACK = {
    "coding": "coding",
    "technical": "technical",
    "system_design": "technical",
    "behavioral": "behavioral",
    "screening": "behavioral",
}

FALLBACK_QUESTIONS = {
    "coding": "Can you walk me through how you would approach solving a problem involving searching or traversing a data structure efficiently?",
    "technical": "Can you describe a technical challenge you've faced and how you approached solving it?",
    "system_design": "How would you design a system to handle a high volume of read requests with low latency?",
    "behavioral": "Tell me about a time you disagreed with a teammate's approach. How did you handle it?",
    "screening": "Can you walk me through your background and what draws you to this role?",
}
class InterviewerAgent:
    """Generates contextual interview questions using Gemini/Groq."""

    def __init__(self, model: str = "llama-3.3-70b-versatile") -> None:
        self.llm = ChatGroq(model=model, api_key=os.getenv("GROQ_API_KEY"))

    def _fallback(self,section:str)->dict[str,Any]:
        q_type=SECTION_TYPE_FALLBACK.get(section.lower(),"technical")
        return{
            "question":FALLBACK_QUESTIONS.get(q_type,"technical"),
            "question_type":q_type,
            "focus_area":""
        }

    async def generate_question(
        self,
        company: str,
        role: str,
        context: str,
        section_name: str,
        section_type: str,
        focus_areas: list[str],
        difficulty: str,
        previous_questions: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Generate the next interview question.

        Args:
            company: Target company name.
            role: Target role/position.
            context: RAG-retrieved context string.
            section_name: Section display name (e.g. 'Coding Assessment').
            section_type: Section type (coding | behavioral | technical | system_design | screening).
            focus_areas: Topics/patterns this section should focus on.
            difficulty: Target difficulty (Easy | Medium | Hard).
            previous_questions: List of already asked questions to avoid repeats.

        Returns:
            {"question": str, "question_type": str, "focus_area": str}
        """
        previous_qs_text = (
            "\n".join(f"- {q}" for q in previous_questions)
            if previous_questions
            else "None"
        )

        prompt = INTERVIEWER_PROMPT.format(
            company=company,
            role=role,
            context=context,
            section_name=section_name,
            section_type=section_type,
            focus_areas=", ".join(focus_areas) if focus_areas else "General",
            difficulty=difficulty,
            previous_questions=previous_qs_text,
        )

        try:
            response = await self.llm.ainvoke(prompt)
            raw = response.content.strip()

            start=raw.find("{")
            end=raw.rfind("}")
            if start == -1 or end == -1:
                raise ValueError("No JSON object found in response")
            data = json.loads(raw[start:end+1])
            validated = Question(**data)
            return validated.model_dump()
        except (ValidationError,ValueError,json.JSONDecodeError) as e:
            print(f"[interviewer] Question generation error: {e}")
            return self._fallback(section_type)
        except Exception as e:
            print(f"[interviewer] Unexpected error: {e}")
            return self._fallback(section_type)
        
