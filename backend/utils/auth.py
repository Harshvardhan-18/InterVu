"""
Bearer token authentication
---------------------------
Stateless, HMAC-SHA256 signed access tokens built only on the standard library.

Token format (all parts base64url without padding)::

    v1.<payload>.<signature>

where ``payload`` is compact JSON ``{"sub": "<user id>", "iat": <unix>, "exp": <unix>}``
and ``signature`` is HMAC-SHA256 over ``"v1.<payload>"`` keyed with AUTH_SECRET.

Environment:
    ENV                    Fails closed: only "development", "dev", "test" or
                           "local" count as a development environment. Unset
                           or any other value is treated as production.
    AUTH_SECRET            Signing key. Required outside development. In a
                           development environment a random per-process key is
                           generated when it is missing (tokens then stop
                           working on every restart or reload).
    AUTH_TOKEN_TTL_HOURS   Token lifetime in hours (default 168, one week).
    AUTH_DISABLED          "true" skips token checks for local debugging only.
                           Ignored outside development.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

TOKEN_VERSION = "v1"
DEFAULT_TTL_HOURS = 168.0
_TRUE_VALUES = {"1", "true", "yes", "on"}

_ephemeral_secret: bytes | None = None


class TokenError(Exception):
    """Raised when a token is malformed, tampered with or expired."""


# ── Environment helpers ───────────────────────────────────────────────────────

DEVELOPMENT_ENVS = frozenset({"development", "dev", "test", "local"})


def env_name() -> str:
    """The normalised ENV value ("" when unset)."""
    return os.getenv("ENV", "").strip().lower()


def is_development() -> bool:
    """True only when ENV explicitly names a development or test environment."""
    return env_name() in DEVELOPMENT_ENVS


def is_test() -> bool:
    return env_name() == "test"


def is_production() -> bool:
    """Fail closed: anything that is not explicitly development is production."""
    return not is_development()


def auth_disabled() -> bool:
    """True only when AUTH_DISABLED is explicitly enabled in a development ENV."""
    enabled = os.getenv("AUTH_DISABLED", "").strip().lower() in _TRUE_VALUES
    if enabled and is_production():
        logger.error(
            "AUTH_DISABLED is set but ENV=%r is not a development environment; "
            "ignoring it and enforcing auth.",
            env_name(),
        )
        return False
    return enabled


def get_auth_secret() -> bytes:
    """Return the signing key, failing closed in production when it is missing."""
    global _ephemeral_secret

    secret = os.getenv("AUTH_SECRET", "").strip()
    if secret:
        return secret.encode("utf-8")

    if is_production():
        raise RuntimeError(
            "AUTH_SECRET must be set unless ENV is development, dev, test or local "
            "(ENV is unset or a production value). Generate one with: "
            "python3 -c \"import secrets;print(secrets.token_urlsafe(48))\""
        )

    if _ephemeral_secret is None:
        _ephemeral_secret = secrets.token_bytes(32)
        logger.warning(
            "AUTH_SECRET is not set; using a random per-process key. "
            "Issued tokens will be invalid after every restart or --reload. "
            "Set AUTH_SECRET in backend/.env (make setup-backend generates one)."
        )
    return _ephemeral_secret


def default_ttl_seconds() -> int:
    raw = os.getenv("AUTH_TOKEN_TTL_HOURS", "").strip()
    try:
        hours = float(raw) if raw else DEFAULT_TTL_HOURS
    except ValueError:
        logger.warning("Invalid AUTH_TOKEN_TTL_HOURS=%r; using %s hours.", raw, DEFAULT_TTL_HOURS)
        hours = DEFAULT_TTL_HOURS
    if hours <= 0:
        hours = DEFAULT_TTL_HOURS
    return int(hours * 3600)


# ── Encoding helpers ──────────────────────────────────────────────────────────

def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(signing_input: str) -> str:
    digest = hmac.new(get_auth_secret(), signing_input.encode("ascii"), hashlib.sha256).digest()
    return _b64encode(digest)


# ── Public token API ──────────────────────────────────────────────────────────

def create_access_token(
    user_id: int,
    ttl_seconds: int | None = None,
    *,
    now: float | None = None,
) -> str:
    """Create a signed access token for ``user_id`` valid for ``ttl_seconds``."""
    issued_at = int(time.time() if now is None else now)
    ttl = default_ttl_seconds() if ttl_seconds is None else int(ttl_seconds)
    payload = {"sub": str(int(user_id)), "iat": issued_at, "exp": issued_at + ttl}
    body = _b64encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signing_input = f"{TOKEN_VERSION}.{body}"
    return f"{signing_input}.{_sign(signing_input)}"


def verify_token(token: str, *, now: float | None = None) -> int:
    """
    Verify ``token`` and return the user id it was issued for.

    Raises:
        TokenError: when the token is malformed, has a bad signature or expired.
    """
    if not isinstance(token, str) or not token:
        raise TokenError("Missing token")

    parts = token.split(".")
    if len(parts) != 3 or parts[0] != TOKEN_VERSION:
        raise TokenError("Malformed token")

    version, body, signature = parts
    try:
        signing_input = f"{version}.{body}"
        expected = _sign(signing_input)
    except UnicodeEncodeError as exc:
        raise TokenError("Malformed token") from exc

    if not hmac.compare_digest(expected.encode("ascii"), signature.encode("utf-8")):
        raise TokenError("Invalid token signature")

    try:
        payload: Any = json.loads(_b64decode(body))
    except (ValueError, UnicodeDecodeError) as exc:
        raise TokenError("Malformed token payload") from exc

    if not isinstance(payload, dict):
        raise TokenError("Malformed token payload")

    exp = payload.get("exp")
    if not isinstance(exp, int):
        raise TokenError("Token has no expiry")

    current = time.time() if now is None else now
    if current >= exp:
        raise TokenError("Token expired")

    try:
        return int(payload.get("sub"))
    except (TypeError, ValueError) as exc:
        raise TokenError("Token has no subject") from exc


# ── FastAPI dependency ────────────────────────────────────────────────────────

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    """
    The authenticated caller.

    ``id`` is None only when AUTH_DISABLED is active and no token was sent;
    ownership checks are skipped in that case.
    """

    id: int | None
    auth_disabled: bool = False

    def owns(self, owner_id: int | None) -> bool:
        if self.id is None:
            return self.auth_disabled
        return owner_id == self.id


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> CurrentUser:
    """Resolve the caller from the ``Authorization: Bearer <token>`` header."""
    disabled = auth_disabled()

    if credentials is None or not credentials.credentials:
        if disabled:
            return CurrentUser(id=None, auth_disabled=True)
        raise _unauthorized("Not authenticated")

    try:
        user_id = verify_token(credentials.credentials)
    except TokenError as exc:
        if disabled:
            return CurrentUser(id=None, auth_disabled=True)
        raise _unauthorized(str(exc)) from exc

    return CurrentUser(id=user_id, auth_disabled=disabled)
