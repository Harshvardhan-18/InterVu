"""
Alembic environment for InterVu.

* The database URL always comes from DATABASE_URL (``db.postgres``), including
  its TLS settings, so migrations connect exactly like the app does.
* Only the application's own tables are managed. LangGraph's checkpoint tables
  live in the same database but are created by LangGraph itself, so they are
  excluded from autogenerate and never dropped.
* A Postgres advisory lock serialises concurrent runs (for example several
  workers starting at once): the second one waits, then finds nothing to do.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from db.postgres import DATABASE_URL, Base, connect_args

config = context.config
config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))

if config.config_file_name is not None:
    # Keep the application's own loggers when this runs inside the app process.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata

# Arbitrary constant identifying "InterVu schema migration" for pg_advisory_lock.
MIGRATION_LOCK_ID = 7272741


def include_object(obj, name, type_, reflected, compare_to):
    """Ignore tables that are not part of our models (for example LangGraph's)."""
    if type_ == "table" and reflected and name not in target_metadata.tables:
        return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    connection.execute(text(f"SELECT pg_advisory_lock({MIGRATION_LOCK_ID})"))
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        compare_type=True,
    )
    try:
        with context.begin_transaction():
            context.run_migrations()
    finally:
        connection.execute(text(f"SELECT pg_advisory_unlock({MIGRATION_LOCK_ID})"))
        connection.commit()


async def run_async_migrations() -> None:
    engine = create_async_engine(DATABASE_URL, connect_args=connect_args())
    try:
        async with engine.connect() as connection:
            await connection.run_sync(do_run_migrations)
    finally:
        await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
