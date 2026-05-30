"""
Interviewer Agent
-----------------
Responsible for generating interview questions grounded in RAG context
retrieved from ChromaDB (company/role specific knowledge base).
"""

from __future__ import annotations

from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI


class InterviewerAgent:
    """Generates contextual interview questions using Gemini."""

    def __init__(self, model: str = "gemini-2.5-flash-preview-05-20") -> None:
        self.llm = ChatGoogleGenerativeAI(model=model)

    def generate_question(
        self,
        company: str,
        role: str,
        context: str,
        section: str,
        previous_questions: list[str] | None = None,
    ) -> str:
        """
        Generate the next interview question.

        Args:
            company: Target company name.
            role: Target role/position.
            context: RAG-retrieved context string.
            section: Interview section (e.g. 'Coding', 'Behavioral').
            previous_questions: List of already asked questions to avoid repeats.

        Returns:
            A single interview question as a string.
        """
        previous_qs_text = (
            "\n".join(f"- {q}" for q in previous_questions)
            if previous_questions
            else "None"
        )

        prompt = f"""You are an expert technical interviewer at {company}.
You are interviewing a candidate for the role of {role}.

## Retrieved Context (use this to ground your question):
{context}

## Interview Section: {section}

## Questions Already Asked (do NOT repeat these):
{previous_qs_text}

Generate ONE clear, specific interview question appropriate for this section.
Return ONLY the question — no preamble, no explanation."""

        response = self.llm.invoke(prompt)
        return response.content.strip()
