"""
Conductor Agent
---------------
Replaces the rigid per-section InterviewerAgent flow. Sees the full blueprint
and full conversation history, and decides the next question, which section
it belongs to, and whether the interview is naturally ready to wrap up.

Hard guardrails (max questions, minimum section coverage) are enforced
separately in the graph layer — this agent's `suggests_wrap_up` is advisory.
"""
from __future__ import annotations
import json
import os
from typing import Any
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from pydantic import ValidationError
from prompts.conductor import CONDUCTOR_PROMPT
from schemas.conductor import ConductorTurn
load_dotenv()

FALLBACK_TURN = {
    "acknowledgment": "",
    "question": "Can you walk me through a technical problem you've solved recently and how you approached it?",
    "question_type": "technical",
    "section_name": "Technical",
    "focus_area": "General",
    "suggests_wrap_up": False,
}


def _format_blueprint_summary(blueprint: dict[str, Any]) -> str:
    lines = []
    section_names_list = []
    for s in blueprint.get("sections", []):
        focus = ", ".join(s.get("focus_areas", [])) or "general"
        section_names_list.append(s["name"])
        lines.append(f"- {s['name']} (type: {s['type']}, ~{s['questions']} questions) — focus: {focus}")
    return "\n".join(lines),section_names_list


def _format_conversation_history(qa_history: list[dict[str, Any]]) -> str:
    if not qa_history:
        return "This is the very first question of the interview — no conversation yet."
    lines = []
    for entry in qa_history:
        score = entry.get("evaluation", {}).get("score", "N/A")
        lines.append(
            f"[{entry.get('section', 'Unknown')}] Q: {entry['question']}\n"
            f"A: {entry['answer']}\n"
            f"Score: {score}/10"
        )
    return "\n\n".join(lines)

class ConductorAgent:
    """Generates the next interview turn with full context of the conversation."""

    def __init__(self,model:str="llama-3.3-70b-versatile")-> None:
        self.llm = ChatGroq(model=model,api_key=os.getenv("GROQ_API_KEY"))

    async def next_turn(
            self,
            company:str,
            role:str,
            username:str,
            blueprint:dict[str,Any],
            context:str,
            difficulty:str,
            qa_history:list[dict[str,Any]]
    ) -> dict[str,Any]:
        candidate_name_instruction = (
            f"The candidate's name is {username}. You may address them by name occasionally and naturally, but not in every single message."
            if username
            else ""
        )
        blueprint_summary, section_names_list = _format_blueprint_summary(blueprint)
        section_names = "\n".join(f"- {name}" for name in section_names_list)
        prompt = CONDUCTOR_PROMPT.format(
            company=company,
            role=role,
            candidate_name_instruction=candidate_name_instruction,
            blueprint_summary=blueprint_summary,
            context=context or "No additional context retrieved.",
            section_names_list=section_names,
            difficulty=difficulty,
            conversation_history=_format_conversation_history(qa_history),
        )

        try:
            response = await self.llm.ainvoke(prompt)
            raw = response.content.strip()

            start = raw.find("{")
            end = raw.rfind("}")
            if start == -1 or end == -1:
                raise ValueError("No JSON object found in the response.")
            data = json.loads(raw[start:end + 1])
            validated = ConductorTurn(**data)
            return validated.model_dump()
        except(ValidationError, ValueError, json.JSONDecodeError) as e:
            print(f"[conductor] Turn generation error: {e}")
            return FALLBACK_TURN.copy()
        except Exception as e:
            print(f"[conductor] Unexpected error: {e}")
            return FALLBACK_TURN.copy()