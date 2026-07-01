"""
Auth Router
-----------
Minimal auth: create or retrieve a user by email.
No passwords — just identity for attribution and personalization.
"""
from __future__ import annotations
from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from db.postgres import get_db, User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    name: str
    email: str


class LoginResponse(BaseModel):
    user_id: int
    name: str
    email: str
    is_new: bool


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """
    Get or create a user by email.
    If the email already exists, returns the existing user.
    If not, creates a new one with the provided name.
    """
    result = await db.execute(
        select(User).where(User.email == body.email)
    )
    existing = result.scalar_one_or_none()

    if existing:
        return LoginResponse(
            user_id=existing.id,
            name=existing.name,
            email=existing.email,
            is_new=False,
        )

    new_user = User(name=body.name, email=body.email)
    db.add(new_user)
    await db.flush()

    return LoginResponse(
        user_id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        is_new=True,
    )