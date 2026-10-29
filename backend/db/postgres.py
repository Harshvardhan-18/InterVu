"""
PostgreSQL Database Layer
-------------------------
Async SQLAlchemy + asyncpg for all persistent storage.

Schema:
  - users
  - interviews
  - questions
  - responses
  - reports
  - research_profiles
  - report_shares   (opt-in public read-only links to a report)
  - resumes         (extracted text of a candidate's resume, one per user)
  - llm_usage       (token counts per LLM call, for cost tracking and limits)

Environment:
  DATABASE_URL  SQLAlchemy async URL (postgresql+asyncpg://...).
  DB_SSL        "require" encrypts without certificate checks, "verify-ca"
                verifies the server certificate chain, "verify-full" also
                verifies the host name, "disable" turns TLS off. When unset,
                "require" is used for every host except localhost / 127.0.0.1 /
                ::1 / the docker-compose "postgres" service. Unknown values
                raise at import time.
  DB_SSL_ROOT_CERT  Optional CA bundle path for verify-ca / verify-full
                (default: the system trust store).
"""

from __future__ import annotations

import os
import ssl
from datetime import datetime, timezone
from typing import Any, AsyncIterator
from urllib.parse import urlparse

from dotenv import load_dotenv
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship

load_dotenv()

# ── Database URL ───────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/intervu",
)

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "postgres", ""}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ssl_mode(database_url: str, db_ssl: str | None) -> str:
    """
    Resolve the TLS mode for asyncpg: "disable", "require", "verify-ca" or
    "verify-full".

    Raises:
        ValueError: for an unrecognised DB_SSL value (fail loudly instead of
            silently picking a weaker mode).
    """
    mode = (db_ssl or "").strip().lower()
    if mode in {"require", "required", "true", "1"}:
        return "require"
    if mode in {"verify-ca", "verify_ca"}:
        return "verify-ca"
    if mode in {"verify-full", "verify_full"}:
        return "verify-full"
    if mode in {"disable", "disabled", "false", "0", "off"}:
        return "disable"
    if mode:
        raise ValueError(
            f"Unsupported DB_SSL={db_ssl!r}. Use one of: require, verify-ca, "
            "verify-full, disable (or leave it unset)."
        )
    try:
        host = (urlparse(database_url).hostname or "").lower()
    except ValueError:
        host = ""
    return "disable" if host in _LOCAL_HOSTS else "require"


def ssl_required(database_url: str, db_ssl: str | None) -> bool:
    """Decide whether the asyncpg connection must use TLS."""
    return ssl_mode(database_url, db_ssl) != "disable"


def build_ssl_connect_arg(mode: str, root_cert: str | None = None) -> Any:
    """
    The asyncpg ``ssl`` argument for ``mode``.

    "require" encrypts without verifying the server certificate (libpq
    semantics). "verify-ca" verifies the certificate chain against the system
    trust store or ``root_cert``; "verify-full" additionally checks the host
    name.
    """
    if mode == "disable":
        return None
    if mode == "require":
        return "require"
    context = ssl.create_default_context(cafile=root_cert or None)
    context.verify_mode = ssl.CERT_REQUIRED
    context.check_hostname = mode == "verify-full"
    return context


def connect_args() -> dict[str, Any]:
    mode = ssl_mode(DATABASE_URL, os.getenv("DB_SSL"))
    ssl_arg = build_ssl_connect_arg(mode, os.getenv("DB_SSL_ROOT_CERT", "").strip() or None)
    return {} if ssl_arg is None else {"ssl": ssl_arg}


# ── Base ───────────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Models ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    interviews = relationship(
        "Interview",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    company = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False)
    difficulty = Column(String(50), default="Medium")
    blueprint = Column(JSON, nullable=True)
    status = Column(String(50), default="in_progress")  # in_progress | completed
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", back_populates="interviews")
    questions = relationship(
        "Question",
        back_populates="interview",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Question.order_index",
    )
    report = relationship(
        "Report",
        back_populates="interview",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    share = relationship(
        "ReportShare",
        back_populates="interview",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(
        Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question = Column(Text, nullable=False)
    section = Column(String(100), nullable=True)
    question_type = Column(String(100), nullable=True)
    order_index = Column(Integer, default=0)

    interview = relationship("Interview", back_populates="questions")
    response = relationship(
        "Response",
        back_populates="question",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(
        Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    answer = Column(Text, nullable=True)
    score = Column(Float, nullable=True)
    evaluation = Column(JSON, nullable=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    question = relationship("Question", back_populates="response")


class ResearchProfile(Base):
    __tablename__ = "research_profiles"
    __table_args__ = (
        UniqueConstraint("company", "role", name="uq_company_role"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company = Column(String(255), nullable=False, index=True)
    role = Column(String(255), nullable=False, index=True)
    skills = Column(JSON, nullable=False, default=list)
    technologies = Column(JSON, nullable=False, default=list)
    topics = Column(JSON, nullable=False, default=list)
    rounds = Column(JSON, nullable=False, default=list)
    behavioral_patterns = Column(JSON, nullable=False, default=list)
    key_insights = Column(JSON, nullable=False, default=list)
    dsa_questions = Column(JSON, nullable=False, default=list)

    difficulty = Column(String(50), default="Medium")

    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(
        Integer, ForeignKey("interviews.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    overall_score = Column(Float, nullable=True)
    report_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    interview = relationship("Interview", back_populates="report")


class ReportShare(Base):
    """
    An opt-in, revocable, expiring public link to one interview's report.
    The unguessable ``token`` is the only credential; see api/shares.py for
    exactly what a link exposes.
    """

    __tablename__ = "report_shares"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(
        Integer, ForeignKey("interviews.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    token = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    interview = relationship("Interview", back_populates="share")


class Resume(Base):
    """
    The extracted TEXT of a candidate's resume (the uploaded file itself is
    never stored). One row per user; used only when the candidate opts in when
    starting an interview, and deletable at any time.
    """

    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class LlmUsage(Base):
    """Token counts of one LLM call. ``interview_id`` is NULL for calls made before an interview existed."""

    __tablename__ = "llm_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    interview_id = Column(
        Integer, ForeignKey("interviews.id", ondelete="SET NULL"), nullable=True, index=True
    )
    label = Column(String(50), nullable=False)  # conductor | evaluator | feedback | blueprint | extractor
    model = Column(String(100), nullable=True)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)


# ── Engine & Session ───────────────────────────────────────────────────────────

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args=connect_args(),
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields a database session and commits on success."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_session_factory() -> Any:
    """
    FastAPI dependency returning a callable that opens a NEW session
    (``async with factory() as session``). Streaming endpoints finish their
    work in a background task that can outlive the request, so they must not
    reuse the request's session; tests override this with a fake.
    """
    return AsyncSessionLocal


async def create_tables() -> None:
    """Create all tables. Call on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
