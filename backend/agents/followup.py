"""
Follow-up Generator Agent
-------------------------
Generates deeper, probing follow-up questions based on a candidate's answer.
Used by the LangGraph difficulty router when score >= 8 or to probe weak spots.
"""

from __future__ import annotations

from langchain_google_genai import ChatGoogleGenerativeAI


class FollowUpAgent:
    """Generates a targeted follow-up question to probe understanding further."""

    def __init__(self, model: str = "gemini-2.5-flash-preview-05-20") -> None:
        self.llm = ChatGoogleGenerativeAI(model=model)

    def generate(
        self,
        question: str,
        answer: str,
        score: float,
        section: str,
        context: str = "",
    ) -> str | None:
        """
        Generate a follow-up question.

        Args:
            question: The original question asked.
            answer: The candidate's answer.
            score: Evaluation score (0-10).
            section: Current interview section.
            context: RAG context (optional).

        Returns:
            A follow-up question string, or None if no follow-up is warranted.
        """
        if 4.0 <= score <= 8.0:
            return None  # No follow-up needed for average scores

        direction = "deeper technical depth" if score > 8.0 else "clarify weak points"

        prompt = f"""You are an expert interviewer. A candidate answered an interview question.
Your task: generate ONE targeted follow-up question to probe {direction}.

Section: {section}
Original Question: {question}
Candidate's Answer: {answer}
Score: {score}/10
Context: {context or "N/A"}

Rules:
- If score > 8: Push harder. Ask about edge cases, trade-offs, or deeper internals.
- If score < 4: Ask a simpler clarifying question to help the candidate think through it.
- Return ONLY the follow-up question. No preamble.
"""

        response = self.llm.invoke(prompt)
        return response.content.strip()
