"""Unit tests for utils/difficulty.py and difficulty parsing in request schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from schemas.interiew import StartInterviewRequest
from utils.difficulty import normalize_difficulty, parse_difficulty, step_difficulty


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("easy", "Easy"),
        ("EASY", "Easy"),
        (" Medium ", "Medium"),
        ("hard", "Hard"),
        ("Hard", "Hard"),
        ("intermediate", "Medium"),
        ("advanced", "Hard"),
    ],
)
def test_normalize_known_values(value: str, expected: str) -> None:
    assert normalize_difficulty(value) == expected


@pytest.mark.parametrize("value", [None, "", "extreme", 3, ["hard"]])
def test_normalize_unknown_values_fall_back_to_default(value: object) -> None:
    assert normalize_difficulty(value) == "Medium"
    assert normalize_difficulty(value, default="easy") == "Easy"


def test_parse_returns_none_for_unknown() -> None:
    assert parse_difficulty("whatever") is None
    assert parse_difficulty(None) is None


@pytest.mark.parametrize(
    ("current", "score", "expected"),
    [
        ("Easy", 9.0, "Medium"),
        ("medium", 8.5, "Hard"),
        ("Hard", 10.0, "Hard"),
        ("Hard", 2.0, "Medium"),
        ("medium", 4.0, "Easy"),
        ("easy", 0.0, "Easy"),
        ("Medium", 6.0, "Medium"),
        ("garbage", 9.0, "Hard"),
    ],
)
def test_step_difficulty(current: str, score: float, expected: str) -> None:
    assert step_difficulty(current, score) == expected


def _request(**overrides: object) -> StartInterviewRequest:
    data = {"username": "Ana", "company": "Acme", "role": "SDE"}
    data.update(overrides)
    return StartInterviewRequest(**data)


@pytest.mark.parametrize(("raw", "expected"), [("hard", "Hard"), ("EASY", "Easy"), ("Medium", "Medium")])
def test_start_request_normalizes_difficulty(raw: str, expected: str) -> None:
    assert _request(difficulty=raw).difficulty == expected


@pytest.mark.parametrize("raw", [None, "", "auto", "AUTO"])
def test_start_request_auto_difficulty_is_none(raw: object) -> None:
    assert _request(difficulty=raw).difficulty is None


def test_start_request_rejects_unknown_difficulty() -> None:
    with pytest.raises(ValidationError):
        _request(difficulty="impossible")


def test_start_request_strips_and_requires_company() -> None:
    assert _request(company="  Acme  ").company == "Acme"
    with pytest.raises(ValidationError):
        _request(company="   ")
