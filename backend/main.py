"""
InterVu FastAPI Application Entry Point
"""

from __future__ import annotations

# Load backend/.env before any module that reads configuration is imported.
from dotenv import load_dotenv

load_dotenv()

import asyncio  # noqa: E402
import logging  # noqa: E402
import os  # noqa: E402
import re  # noqa: E402
import sys  # noqa: E402
import time  # noqa: E402
import uuid  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from sqlalchemy import text  # noqa: E402

from utils.logging_setup import configure_logging, request_id_var  # noqa: E402

configure_logging()

from utils.observability import init_sentry  # noqa: E402

# Before the app is created so the SDK can instrument it. No-op without SENTRY_DSN.
init_sentry()

from api.auth import router as auth_router  # noqa: E402
from api.interview import router as interview_router  # noqa: E402
from api.progress import router as progress_router  # noqa: E402
from api.report import router as report_router  # noqa: E402
from api.resume import router as resume_router  # noqa: E402
from api.shares import owner_router as share_owner_router  # noqa: E402
from api.shares import public_router as share_public_router  # noqa: E402
from api.usage import router as usage_router  # noqa: E402
from db.migrate import migrate_on_start, run_migrations  # noqa: E402
from db.postgres import create_tables, engine  # noqa: E402
from graph.interview_graph import close_graph, init_graph, is_graph_ready  # noqa: E402
from utils.auth import auth_disabled, get_auth_secret, is_production  # noqa: E402

logger = logging.getLogger("intervu")

REQUEST_ID_HEADER = "X-Request-ID"
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_DEV_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")


def cors_origins() -> list[str]:
    """
    Allowed browser origins: every comma-separated entry of FRONTEND_URL, plus
    the local Next.js dev server when ENV is explicitly a development
    environment (unset ENV is treated as production). Empty entries are dropped.
    """
    configured = [
        origin.strip().rstrip("/")
        for origin in os.getenv("FRONTEND_URL", "").split(",")
        if origin.strip()
    ]
    if not is_production():
        configured.extend(_DEV_ORIGINS)
    # De-duplicate while keeping order.
    return list(dict.fromkeys(configured))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks (config checks, DB init, graph init) and cleanup on shutdown."""
    if is_production():
        get_auth_secret()  # Fail fast: raises when AUTH_SECRET is missing outside development.
    if auth_disabled():
        logger.warning("AUTH_DISABLED=true: bearer tokens are NOT enforced. Never use this outside local debugging.")
    if migrate_on_start():
        await run_migrations()
    else:
        await create_tables()
    await init_graph()
    yield
    await close_graph()


app = FastAPI(
    title="InterVu API",
    description="AI-powered interview preparation platform",
    version="0.2.0",
    lifespan=lifespan,
)


# ── Request id + access log ────────────────────────────────────────────────────

def _internal_error_response(request_id: str | None) -> JSONResponse:
    """JSON 500 that carries the request id instead of a bare text error."""
    headers = {REQUEST_ID_HEADER: request_id} if request_id else None
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
        headers=headers,
    )


@app.middleware("http")
async def request_context(request: Request, call_next):
    """
    Request id, access log and the JSON 500 for unhandled errors.

    This middleware is registered before CORSMiddleware, so CORS wraps it:
    the 500 built here still receives the CORS headers and browsers can read
    the error body and request id (an ``exception_handler(Exception)`` runs in
    Starlette's outermost ServerErrorMiddleware, outside CORS).
    """
    incoming = request.headers.get(REQUEST_ID_HEADER, "")
    request_id = incoming if _SAFE_REQUEST_ID.match(incoming) else uuid.uuid4().hex
    request.state.request_id = request_id
    token = request_id_var.set(request_id)
    started = time.perf_counter()
    try:
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.exception("%s %s -> 500 (%.1f ms)", request.method, request.url.path, elapsed_ms)
            return _internal_error_response(request_id)
        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers[REQUEST_ID_HEADER] = request_id
        logger.info(
            "%s %s -> %d (%.1f ms)",
            request.method, request.url.path, response.status_code, elapsed_ms,
        )
        return response
    finally:
        request_id_var.reset(token)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last resort for errors raised outside request_context (no CORS headers here)."""
    request_id = getattr(request.state, "request_id", None) or request_id_var.get()
    return _internal_error_response(request_id)


# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,  # Auth uses bearer tokens, not cookies.
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Filename", REQUEST_ID_HEADER],
    expose_headers=[REQUEST_ID_HEADER],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(interview_router)
app.include_router(report_router)
app.include_router(share_owner_router)
app.include_router(share_public_router)
app.include_router(progress_router)
app.include_router(resume_router)
app.include_router(usage_router)
app.include_router(auth_router)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness: the process is up and serving requests."""
    return {"status": "ok", "service": "InterVu API"}


async def _database_ready() -> bool:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return True


@app.get("/ready")
async def ready() -> JSONResponse:
    """Readiness: the database answers and the interview graph is initialised."""
    checks: dict[str, str] = {}
    try:
        await asyncio.wait_for(_database_ready(), timeout=15)
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001 - report, do not crash
        logger.warning("Readiness check: database unavailable: %s", exc)
        checks["database"] = "unavailable"

    checks["graph"] = "ok" if is_graph_ready() else "not_initialized"

    is_ready = all(value == "ok" for value in checks.values())
    return JSONResponse(
        status_code=200 if is_ready else 503,
        content={"status": "ready" if is_ready else "not_ready", "checks": checks},
    )
