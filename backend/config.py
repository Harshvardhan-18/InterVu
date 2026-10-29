"""
Central configuration
---------------------
Model names plus small helpers that read environment variables consistently.

Environment variables are loaded from ``backend/.env`` (if present) the first
time this module is imported. Values already present in the process
environment always win over the file.
"""

from __future__ import annotations

import os
import re

from dotenv import load_dotenv

load_dotenv()

# ── LLM models ─────────────────────────────────────────────────────────────────

ExtractorModel = "openai/gpt-oss-120b"

BlueprintModel = "openai/gpt-oss-120b"

ConductorModel = "openai/gpt-oss-120b"

EvaluatorModel = "openai/gpt-oss-120b"

FeedbackModel = "openai/gpt-oss-120b"

# ── ChromaDB ───────────────────────────────────────────────────────────────────

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db").strip() or "./chroma_db"
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "intervu_kb_v2").strip() or "intervu_kb_v2"

# ── Groq API keys ──────────────────────────────────────────────────────────────

_NUMBERED_GROQ_KEY = re.compile(r"^GROQ_API_KEY_(\d+)$")


def groq_api_keys() -> list[str]:
    """
    All configured Groq keys, ordered by their numeric suffix
    (GROQ_API_KEY_1, GROQ_API_KEY_2, ...). Falls back to the single
    GROQ_API_KEY when no numbered keys are set.
    """
    numbered: dict[int, str] = {}
    for name, value in os.environ.items():
        match = _NUMBERED_GROQ_KEY.match(name)
        if match and value.strip():
            numbered[int(match.group(1))] = value.strip()

    keys = [numbered[index] for index in sorted(numbered)]
    if not keys:
        single = os.getenv("GROQ_API_KEY", "").strip()
        if single:
            keys = [single]
    return keys


def groq_api_key(slot: int | None = None) -> str | None:
    """
    Resolve a single Groq key.

    Preference order: GROQ_API_KEY_<slot> (when ``slot`` is given), then
    GROQ_API_KEY, then the first numbered key found. Returns None when no key
    is configured so the caller (ChatGroq) can raise its own clear error.
    """
    if slot is not None:
        value = os.getenv(f"GROQ_API_KEY_{slot}", "").strip()
        if value:
            return value

    single = os.getenv("GROQ_API_KEY", "").strip()
    if single:
        return single

    keys = groq_api_keys()
    return keys[0] if keys else None


# Agents that use a single dedicated key read this slot (GROQ_API_KEY_2).
AGENT_GROQ_KEY_SLOT = 2
