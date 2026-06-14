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
"""

from __future__ import annotations

import os
from datetime import datetime,timezone
from typing import Any

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


# ── Database URL ───────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/intervu",
)


# ── Base ───────────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Models ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    interviews = relationship("Interview", back_populates="user")


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False)
    difficulty = Column(String(50), default="medium")
    blueprint = Column(JSON, nullable=True)
    status = Column(String(50), default="in_progress")  # in_progress | completed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="interviews")
    questions = relationship("Question", back_populates="interview")
    report = relationship("Report", back_populates="interview", uselist=False)


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    section = Column(String(100), nullable=True)
    question_type = Column(String(100), nullable=True)  # technical | behavioral | coding
    order_index = Column(Integer, default=0)

    interview = relationship("Interview", back_populates="questions")
    response = relationship("Response", back_populates="question", uselist=False)


class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    answer = Column(Text, nullable=True)
    score = Column(Float, nullable=True)
    evaluation = Column(JSON, nullable=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda:datetime.now(timezone.utc))

    question = relationship("Question", back_populates="response")

class ResearchProfile(Base):
    __tablename__ = "research_profiles"
    __table_args__ = (
        UniqueConstraint("company", "role", name="uq_company_role")
    ),
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

    created_at = Column(DateTime, default=lambda:datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda:datetime.now(timezone.utc),onupdate=lambda:datetime.now(timezone.utc))
class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), unique=True, nullable=False)
    overall_score = Column(Float, nullable=True)
    report_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda:datetime.now(timezone.utc))

    interview = relationship("Interview", back_populates="report")


# ── Engine & Session ───────────────────────────────────────────────────────────

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    """Create all tables. Call on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
