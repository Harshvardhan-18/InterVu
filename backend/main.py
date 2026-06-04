"""
InterVu FastAPI Application Entry Point
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.interview import router as interview_router
from api.report import router as report_router
from db.postgres import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks (DB init) and cleanup on shutdown."""
    await create_tables()
    yield


app = FastAPI(
    title="InterVu API",
    description="AI-powered interview preparation platform",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(interview_router)
app.include_router(report_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "InterVu API"}
