"""
Usage API Router
----------------
  GET /api/usage   - the caller's LLM token usage (today, all time, per interview)

Requires a bearer token. Token counts come from the provider's responses;
dollar amounts appear only when LLM_PRICE_INPUT_PER_MTOK / LLM_PRICE_OUTPUT_PER_MTOK
are configured. "Today" is the UTC day, which is also the window of DAILY_TOKEN_LIMIT.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.interview import resolve_owner_id
from db.postgres import get_db
from services.usage import usage_summary
from utils.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/api/usage", tags=["usage"])


@router.get("")
async def get_usage(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await usage_summary(db, resolve_owner_id(None, user))
