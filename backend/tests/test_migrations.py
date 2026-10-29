"""Migration hygiene that needs no database (the live checks run `alembic check` in CI)."""

from __future__ import annotations

import io

from alembic import command
from alembic.script import ScriptDirectory

from db.migrate import alembic_config, migrate_on_start
from db.postgres import Base


def test_there_is_exactly_one_migration_head() -> None:
    heads = ScriptDirectory.from_config(alembic_config()).get_heads()
    assert len(heads) == 1, f"Multiple migration heads {heads}: merge them with `alembic merge`."


def test_every_model_table_is_created_by_the_migrations() -> None:
    """Adding a model without a migration fails here, even without Postgres."""
    config = alembic_config()
    buffer = io.StringIO()
    config.output_buffer = buffer
    command.upgrade(config, "head", sql=True)  # offline: renders the SQL instead of running it
    sql = buffer.getvalue()
    missing = [name for name in Base.metadata.tables if f"CREATE TABLE {name} " not in sql]
    assert not missing, f"No migration creates: {missing}. Run `make migration m=\"...\"`."


def test_migrate_on_start_flag(monkeypatch) -> None:
    monkeypatch.delenv("MIGRATE_ON_START", raising=False)
    assert migrate_on_start() is True
    for value in ("false", "0", "OFF", "no"):
        monkeypatch.setenv("MIGRATE_ON_START", value)
        assert migrate_on_start() is False
    monkeypatch.setenv("MIGRATE_ON_START", "true")
    assert migrate_on_start() is True
