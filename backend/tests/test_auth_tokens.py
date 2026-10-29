"""Unit tests for utils/auth.py (token signing, verification, settings)."""

from __future__ import annotations

import pytest

from utils import auth
from utils.auth import TokenError, create_access_token, verify_token


def test_round_trip_returns_user_id() -> None:
    token = create_access_token(42, ttl_seconds=60, now=1_000)
    assert verify_token(token, now=1_030) == 42


def test_token_has_three_parts_and_version_prefix() -> None:
    token = create_access_token(7, ttl_seconds=60)
    parts = token.split(".")
    assert len(parts) == 3
    assert parts[0] == auth.TOKEN_VERSION


def test_expired_token_is_rejected() -> None:
    token = create_access_token(1, ttl_seconds=60, now=1_000)
    with pytest.raises(TokenError):
        verify_token(token, now=1_060)


def test_tampered_payload_is_rejected() -> None:
    token = create_access_token(1, ttl_seconds=3600)
    other = create_access_token(2, ttl_seconds=3600)
    version, _, signature = token.split(".")
    _, other_payload, _ = other.split(".")
    with pytest.raises(TokenError):
        verify_token(f"{version}.{other_payload}.{signature}")


def test_tampered_signature_is_rejected() -> None:
    token = create_access_token(1, ttl_seconds=3600)
    version, payload, signature = token.split(".")
    flipped = ("A" if signature[0] != "A" else "B") + signature[1:]
    with pytest.raises(TokenError):
        verify_token(f"{version}.{payload}.{flipped}")


def test_token_signed_with_other_secret_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    token = create_access_token(1, ttl_seconds=3600)
    monkeypatch.setenv("AUTH_SECRET", "a-completely-different-secret")
    with pytest.raises(TokenError):
        verify_token(token)


@pytest.mark.parametrize(
    "bad",
    ["", "abc", "v1.only-two", "v2.e30.sig", "v1.!!!.sig", "v1.e30.\u00e9\u00e9", "a.b.c.d"],
)
def test_malformed_tokens_are_rejected(bad: str) -> None:
    with pytest.raises(TokenError):
        verify_token(bad)


def test_missing_secret_raises_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AUTH_SECRET", raising=False)
    monkeypatch.setenv("ENV", "production")
    with pytest.raises(RuntimeError):
        auth.get_auth_secret()


def test_missing_secret_uses_ephemeral_key_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AUTH_SECRET", raising=False)
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setattr(auth, "_ephemeral_secret", None)
    first = auth.get_auth_secret()
    assert len(first) == 32
    assert auth.get_auth_secret() == first


def test_auth_disabled_is_ignored_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("ENV", "development")
    assert auth.auth_disabled() is True
    monkeypatch.setenv("ENV", "production")
    assert auth.auth_disabled() is False


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("", 168 * 3600), ("2", 2 * 3600), ("0.5", 1800), ("nope", 168 * 3600), ("-3", 168 * 3600)],
)
def test_default_ttl_seconds(monkeypatch: pytest.MonkeyPatch, raw: str, expected: int) -> None:
    monkeypatch.setenv("AUTH_TOKEN_TTL_HOURS", raw)
    assert auth.default_ttl_seconds() == expected


def test_current_user_owns() -> None:
    assert auth.CurrentUser(id=1).owns(1) is True
    assert auth.CurrentUser(id=1).owns(2) is False
    assert auth.CurrentUser(id=None, auth_disabled=True).owns(99) is True
    assert auth.CurrentUser(id=None, auth_disabled=False).owns(99) is False
