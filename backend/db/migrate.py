"""
Schema migrations
-----------------
Applies Alembic migrations (``backend/alembic``) when the app starts.

  MIGRATE_ON_START   "true" (default) runs ``alembic upgrade head`` at startup;
                     "false" falls back to ``create_all`` (creates missing
                     tables only, never alters existing ones) so you can run
                     ``alembic upgrade head`` yourself as a deploy step.

The first migration is a baseline that creates only the tables that are
missing, so databases created before migrations existed upgrade cleanly.
Concurrent starts are serialised by a Postgres advisory lock (alembic/env.py).
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from alembic import command
from alembic.config import Config

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent.parent

_FALSE_VALUES = {"0", "false", "no", "off"}


def migrate_on_start() -> bool:
    return os.getenv("MIGRATE_ON_START", "true").strip().lower() not in _FALSE_VALUES


def alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return config


def upgrade_to_head() -> None:
    """Blocking: run ``alembic upgrade head``."""
    command.upgrade(alembic_config(), "head")


async def run_migrations() -> None:
    """Run the migrations in a worker thread (Alembic's async env starts its own event loop)."""
    logger.info("Applying database migrations (alembic upgrade head)...")
    await asyncio.to_thread(upgrade_to_head)
    logger.info("Database schema is up to date.")
