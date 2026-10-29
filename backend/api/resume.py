"""
Resume API Router
-----------------
  PUT    /api/resume   upload (raw request body; file name in the X-Filename header)
  GET    /api/resume   metadata and a short preview
  DELETE /api/resume   delete the stored text

Privacy: only the extracted text is stored, never the file. The text is sent
to the AI provider (Groq) only for interviews the candidate explicitly starts
with "use my resume"; deleting it here stops future use. Copies already placed
in the state of past interviews are not removed.

The body is read as a bounded stream so an oversized upload is rejected
without being buffered (``MAX_BYTES``).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.interview import resolve_owner_id
from db.postgres import Resume, get_db
from services.resume import MAX_BYTES, ResumeError, extract_text, get_resume, safe_filename
from utils.auth import CurrentUser, get_current_user
from utils.rate_limit import limit_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resume", tags=["resume"])

PREVIEW_CHARS = 400


def _describe(resume: Resume) -> dict[str, Any]:
    text = resume.text or ""
    return {
        "has_resume": True,
        "filename": resume.filename,
        "content_type": resume.content_type,
        "characters": len(text),
        "updated_at": resume.updated_at.isoformat() if resume.updated_at else None,
        "preview": text[:PREVIEW_CHARS],
    }


async def _read_limited(request: Request) -> bytes:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BYTES:
        raise ResumeError(f"The file is too large (limit {MAX_BYTES // (1024 * 1024)} MB).", 413)
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BYTES:
            raise ResumeError(f"The file is too large (limit {MAX_BYTES // (1024 * 1024)} MB).", 413)
        chunks.append(chunk)
    return b"".join(chunks)


@router.put("", dependencies=[Depends(limit_upload)])
async def upload_resume(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    owner_id = resolve_owner_id(None, user)
    try:
        data = await _read_limited(request)
        # Parsing is CPU-bound and the input is untrusted: keep it off the event loop.
        text, content_type = await asyncio.to_thread(extract_text, data)
    except ResumeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    filename = safe_filename(request.headers.get("x-filename"))
    resume = await get_resume(db, owner_id)
    if resume is None:
        resume = Resume(user_id=owner_id, filename=filename, content_type=content_type, text=text)
        db.add(resume)
    else:
        resume.filename, resume.content_type, resume.text = filename, content_type, text
    await db.flush()
    await db.commit()
    logger.info("Stored resume text for user %s (%d chars, %s).", owner_id, len(text), content_type)
    return _describe(resume)


@router.get("")
async def read_resume(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    resume = await get_resume(db, resolve_owner_id(None, user))
    return _describe(resume) if resume is not None else {"has_resume": False}


@router.delete("")
async def delete_resume(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    resume = await get_resume(db, resolve_owner_id(None, user))
    if resume is not None:
        await db.delete(resume)
        await db.flush()
        await db.commit()
    return {"has_resume": False}
