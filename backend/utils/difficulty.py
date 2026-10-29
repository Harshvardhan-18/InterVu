"""
Difficulty helpers
------------------
Single source of truth for interview difficulty labels. Every layer (API,
blueprint, graph) stores difficulty in Title Case: "Easy", "Medium", "Hard".
"""

from __future__ import annotations

from typing import Any

DIFFICULTY_LEVELS: tuple[str, ...] = ("Easy", "Medium", "Hard")
DEFAULT_DIFFICULTY = "Medium"

# Thresholds used by the interview graph to move difficulty up or down.
RAISE_DIFFICULTY_SCORE = 8.5
LOWER_DIFFICULTY_SCORE = 4.0

_ALIASES = {
    "easy": "Easy",
    "beginner": "Easy",
    "medium": "Medium",
    "moderate": "Medium",
    "intermediate": "Medium",
    "hard": "Hard",
    "difficult": "Hard",
    "advanced": "Hard",
}


def parse_difficulty(value: Any) -> str | None:
    """Return the Title Case label for ``value`` or None if it is not recognised."""
    if not isinstance(value, str):
        return None
    return _ALIASES.get(value.strip().lower())


def normalize_difficulty(value: Any, default: str = DEFAULT_DIFFICULTY) -> str:
    """
    Normalise any difficulty-like value to "Easy", "Medium" or "Hard".
    Unknown or empty values fall back to ``default`` (itself normalised).
    """
    parsed = parse_difficulty(value)
    if parsed is not None:
        return parsed
    return parse_difficulty(default) or DEFAULT_DIFFICULTY


def step_difficulty(current: Any, score: float) -> str:
    """
    Move one level up when ``score`` is high, one level down when it is low,
    otherwise keep the current level. Always returns a Title Case label.
    """
    level = normalize_difficulty(current)
    index = DIFFICULTY_LEVELS.index(level)
    if score >= RAISE_DIFFICULTY_SCORE:
        index = min(index + 1, len(DIFFICULTY_LEVELS) - 1)
    elif score <= LOWER_DIFFICULTY_SCORE:
        index = max(index - 1, 0)
    return DIFFICULTY_LEVELS[index]
