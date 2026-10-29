"""
Auth Router
-----------
Passwordless sign-in: create or retrieve a user by email and issue a signed
bearer access token (see utils/auth.py). Every other endpoint requires the
token in an ``Authorization: Bearer <token>`` header.

Note: there is no email verification, so the token proves "signed in with
this email", not ownership of the mailbox.
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import User, get_db
from utils.auth import CurrentUser, create_access_token, default_ttl_seconds, get_current_user
from utils.rate_limit import limit_login

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Pragmatic check: one "@", no whitespace, a dot in the domain part.
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_EMAIL_LENGTH = 254
MAX_NAME_LENGTH = 100


def normalize_email(value: str) -> str:
    """Trim and lower-case an email address."""
    return value.strip().lower()


def is_valid_email(value: str) -> bool:
    return len(value) <= MAX_EMAIL_LENGTH and bool(_EMAIL_PATTERN.match(value))


class LoginRequest(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_NAME_LENGTH)
    email: str = Field(min_length=3, max_length=MAX_EMAIL_LENGTH)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: Any) -> Any:
        return " ".join(value.split()) if isinstance(value, str) else value

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email(cls, value: Any) -> Any:
        return normalize_email(value) if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        if not is_valid_email(value):
            raise ValueError("Enter a valid email address")
        return value


class LoginResponse(BaseModel):
    user_id: int
    name: str
    email: str
    is_new: bool
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MeResponse(BaseModel):
    user_id: int
    name: str
    email: str


def _login_response(user: User, is_new: bool) -> LoginResponse:
    ttl = default_ttl_seconds()
    return LoginResponse(
        user_id=user.id,
        name=user.name,
        email=user.email,
        is_new=is_new,
        access_token=create_access_token(user.id, ttl),
        expires_in=ttl,
    )


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(limit_login)])
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """
    Get or create a user by (normalised) email and return an access token.
    If the email already exists, returns the existing user.
    If not, creates a new one with the provided name.

    Rate limited per client IP (RATE_LIMIT_LOGIN_PER_MIN). Note that
    ``is_new`` tells the caller whether the email was already registered;
    that enumeration is accepted for this passwordless, local-use design and
    goes away with a real identity provider (see README).
    """
    # lower() also matches rows stored with mixed case before emails were normalised.
    result = await db.execute(
        select(User).where(func.lower(User.email) == body.email).order_by(User.id.asc())
    )
    existing = result.scalars().first()

    if existing:
        return _login_response(existing, is_new=False)

    new_user = User(name=body.name, email=body.email)
    db.add(new_user)
    await db.flush()
    # Commit before responding: get_db's own commit runs after the response
    # is sent on recent FastAPI versions, so a failure there would be invisible.
    await db.commit()

    return _login_response(new_user, is_new=True)


@router.get("/me", response_model=MeResponse)
async def me(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    """Return the user behind the bearer token (401 when missing or invalid)."""
    if user.id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    record = await db.get(User, user.id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
    return MeResponse(user_id=record.id, name=record.name, email=record.email)
