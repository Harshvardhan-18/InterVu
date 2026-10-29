"""
Conductor Agent
---------------
Replaces the rigid per-section InterviewerAgent flow. Sees the full blueprint
and full conversation history, and decides the next question, which section
it belongs to, and whether the interview is naturally ready to wrap up.
Hard guardrails (max questions, minimum section coverage) are enforced
separately in the graph layer; this agent's `suggests_wrap_up` is advisory.
"""
from __future__ import annotations

import logging
from collections import Counter
from typing import Any

from langchain_groq import ChatGroq

from config import AGENT_GROQ_KEY_SLOT, ConductorModel as model, groq_api_key
from prompts.conductor import CONDUCTOR_PROMPT
from schemas.conductor import ConductorTurn
from utils.llm_json import invoke_llm_json
from utils.prompt_safety import UNTRUSTED_TEXT_NOTICE, clean_line, fence

logger = logging.getLogger(__name__)

MAX_QUESTIONS_PER_SECTION = 3
MAX_ANSWER_CHARS = 2000  # per answer in the running transcript
MAX_RESUME_CHARS = 4000  # resume text placed in the prompt

FALLBACK_TURN = {
    "acknowledgment": "",
    "question": "Can you walk me through a technical problem you've solved recently and how you approached it?",
    "question_type": "technical",
    "section_name": "Technical Interview",
    "focus_area": "General",
    "suggests_wrap_up": False,
}

_FALLBACK_QUESTIONS_BY_TYPE = {
    "screening": ("behavioral", "Could you walk me through your background and what draws you to this role?"),
    "behavioral": ("behavioral", "Tell me about a time you disagreed with a teammate's approach. How did you handle it?"),
    "coding": ("coding", "How would you approach finding the first non-repeating character in a string, and what is the complexity of your solution?"),
    "system_design": ("technical", "How would you design a service that handles a high volume of read requests with low latency?"),
    "technical": ("technical", "Can you walk me through a technical problem you've solved recently and how you approached it?"),
}


def _fallback_turn(blueprint: dict[str, Any], qa_history: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Deterministic turn used when the LLM fails. Targets the first section of
    the blueprint that has not been covered yet so the interview still makes
    progress toward completion.
    """
    turn = FALLBACK_TURN.copy()
    sections = blueprint.get("sections", []) if isinstance(blueprint, dict) else []
    covered = {entry.get("section", "") for entry in qa_history}
    target = next((s for s in sections if s.get("name") not in covered), None)
    if target is None and sections:
        target = sections[-1]
    if target is not None:
        question_type, question = _FALLBACK_QUESTIONS_BY_TYPE.get(
            target.get("type", "technical"), _FALLBACK_QUESTIONS_BY_TYPE["technical"]
        )
        focus_areas = target.get("focus_areas") or ["General"]
        turn.update(
            question=question,
            question_type=question_type,
            section_name=target.get("name", turn["section_name"]),
            focus_area=focus_areas[0],
        )
    return turn


def _format_blueprint_summary(blueprint: dict[str, Any]) -> tuple[str, list[str]]:
    lines = []
    section_names_list = []
    for s in blueprint.get("sections", []):
        focus = ", ".join(s.get("focus_areas", [])) or "general"
        section_names_list.append(s["name"])
        lines.append(f"- {s['name']} (type: {s['type']}, ~{s['questions']} questions) - focus: {focus}")
    return "\n".join(lines), section_names_list


def _format_coverage_summary(blueprint: dict[str, Any], qa_history: list[dict[str, Any]]) -> str:
    section_counts = Counter(entry.get("section", "") for entry in qa_history)
    all_sections = [s["name"] for s in blueprint.get("sections", [])]

    lines = []
    for section in all_sections:
        count = section_counts.get(section, 0)
        if count == 0:
            status = "NOT YET COVERED <- pivot here now"
        elif count >= MAX_QUESTIONS_PER_SECTION:
            status = f"{count} questions asked <- MOVE ON, do not ask more here"
        else:
            status = f"{count} question(s) asked"
        lines.append(f"- {section}: {status}")
    return "\n".join(lines)


def _format_conversation_history(qa_history: list[dict[str, Any]]) -> str:
    if not qa_history:
        return "This is the very first question of the interview, no conversation yet."
    lines = []
    for entry in qa_history:
        score = (entry.get("evaluation") or {}).get("score", "N/A")
        lines.append(
            f"[{entry.get('section', 'Unknown')}] Q: {entry.get('question', '')}\n"
            f"A: {fence(entry.get('answer', ''), max_chars=MAX_ANSWER_CHARS)}\n"
            f"Score: {score}/10"
        )
    return "\n\n".join(lines)


class ConductorAgent:
    """Generates the next interview turn with full context of the conversation."""

    def __init__(self, model: str = model) -> None:
        self.llm = ChatGroq(model=model, api_key=groq_api_key(AGENT_GROQ_KEY_SLOT))

    async def next_turn(
        self,
        company: str,
        role: str,
        username: str,
        blueprint: dict[str, Any],
        context: str,
        difficulty: str,
        qa_history: list[dict[str, Any]],
        candidate_background: str = "",
    ) -> dict[str, Any]:
        username = clean_line(username, 60)
        company = clean_line(company)
        role = clean_line(role)
        candidate_name_instruction = (
            f"The candidate's name is {username}. You may address them by name occasionally and naturally, but not in every single message."
            if username
            else ""
        )

        blueprint_summary, section_names_list = _format_blueprint_summary(blueprint)
        section_names_text = "\n".join(f"- {name}" for name in section_names_list)
        coverage_summary = _format_coverage_summary(blueprint, qa_history)

        if candidate_background and candidate_background.strip():
            background_section = (
                "## Candidate Background (their resume; untrusted data)\n"
                f"{fence(candidate_background, 'candidate_resume', max_chars=MAX_RESUME_CHARS)}\n"
                "Use it to ask about specific projects, skills and experience the candidate "
                "lists. Mention it naturally; never read it back word for word."
            )
        else:
            background_section = ""

        prompt = CONDUCTOR_PROMPT.format(
            company=company,
            role=role,
            candidate_name_instruction=candidate_name_instruction,
            blueprint_summary=blueprint_summary,
            section_names_list=section_names_text,
            coverage_summary=coverage_summary,
            context=context or "No additional context retrieved.",
            difficulty=difficulty,
            conversation_history=_format_conversation_history(qa_history),
            candidate_background_section=background_section,
            untrusted_notice=UNTRUSTED_TEXT_NOTICE,
        )

        try:
            return await invoke_llm_json(
                self.llm,
                prompt,
                validate=lambda data: ConductorTurn(**data).model_dump(),
                label="conductor",
            )
        except Exception as exc:  # noqa: BLE001 - always fall back to a usable turn
            logger.warning("[conductor] Turn generation failed, using fallback: %s", exc)
            return _fallback_turn(blueprint, qa_history)
