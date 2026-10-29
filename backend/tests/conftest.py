"""
Shared pytest fixtures.

Dummy environment variables are set at import time, BEFORE any application
module is imported, so that modules reading configuration at import time
(database URL, API keys, auth secret) never need real credentials and never
touch the network.
"""

from __future__ import annotations

import os

# ── Dummy environment (must run before any app import) ─────────────────────────
_TEST_ENV = {
    "ENV": "test",
    "DATABASE_URL": "postgresql+asyncpg://test:test@localhost:5432/intervu_test",
    "DATABASE_URL_PSYCOPG": "postgresql://test:test@localhost:5432/intervu_test",
    "GROQ_API_KEY": "test-groq-key",
    "GROQ_API_KEY_1": "test-groq-key-1",
    "GROQ_API_KEY_2": "test-groq-key-2",
    "GOOGLE_API_KEY": "test-google-key",
    "GOOGLE_API_KEY_1": "test-google-key-1",
    "GOOGLE_API_KEY_2": "test-google-key-2",
    "TAVILY_API_KEY": "test-tavily-key",
    "FIRECRAWL_API_KEY": "test-firecrawl-key",
    "ANAKIN_API_KEY": "test-anakin-key",
    "AUTH_SECRET": "test-auth-secret-not-for-production",
    "FRONTEND_URL": "http://localhost:3000",
}
for _key, _value in _TEST_ENV.items():
    os.environ.setdefault(_key, _value)

# Settings that a developer's backend/.env could change test behaviour for.
# load_dotenv() never overrides variables that already exist, so pinning them
# here (before any app import) keeps backend/.env from leaking into the tests.
# Pop first so an exported shell value cannot leak either, then set explicit
# safe values. Tests that need other values use monkeypatch.setenv.
_PINNED_ENV = {
    "RATE_LIMIT_ENABLED": "false",
    "DB_SSL": "disable",
    "LLM_TIMEOUT_SECONDS": "40",
    "LLM_MAX_ATTEMPTS": "2",
}
for _key, _value in _PINNED_ENV.items():
    os.environ.pop(_key, None)
    os.environ[_key] = _value

from typing import Any, Callable, Iterator  # noqa: E402

import pytest  # noqa: E402


# ── Fake async DB session ──────────────────────────────────────────────────────

class FakeResult:
    """Minimal stand-in for a SQLAlchemy Result."""

    def __init__(self, rows: list[Any] | None = None) -> None:
        self._rows = list(rows or [])

    def scalars(self) -> "FakeResult":
        return self

    def all(self) -> list[Any]:
        return list(self._rows)

    def first(self) -> Any:
        return self._rows[0] if self._rows else None

    def scalar_one_or_none(self) -> Any:
        return self._rows[0] if self._rows else None

    def scalar_one(self) -> Any:
        if not self._rows:
            raise LookupError("No row was found")
        return self._rows[0]

    def scalar(self) -> Any:
        return self.first()


class FakeAsyncSession:
    """
    In-memory stand-in for sqlalchemy.ext.asyncio.AsyncSession.

    Tests queue results with ``queue_result(...)``; each ``execute`` call pops
    the next queued result (or returns an empty result). Objects passed to
    ``add`` are recorded in ``added`` and given sequential integer ids on
    ``flush``/``commit`` if they have an ``id`` attribute that is None.
    """

    def __init__(self) -> None:
        self.added: list[Any] = []
        self.executed: list[Any] = []
        self.results: list[FakeResult] = []
        self.get_map: dict[tuple[Any, Any], Any] = {}
        self.committed = False
        self.rolled_back = False
        self.closed = False
        self._next_id = 1

    # -- test helpers ----------------------------------------------------------
    def queue_result(self, *rows: Any) -> None:
        self.results.append(FakeResult(list(rows)))

    def register(self, model: type, pk: Any, obj: Any) -> None:
        self.get_map[(model, pk)] = obj

    # -- AsyncSession API ------------------------------------------------------
    def add(self, obj: Any) -> None:
        self.added.append(obj)

    def add_all(self, objs: list[Any]) -> None:
        self.added.extend(objs)

    async def execute(self, statement: Any, *args: Any, **kwargs: Any) -> FakeResult:
        self.executed.append(statement)
        if self.results:
            return self.results.pop(0)
        return FakeResult()

    async def get(self, model: type, pk: Any, *args: Any, **kwargs: Any) -> Any:
        return self.get_map.get((model, pk))

    async def flush(self) -> None:
        for obj in self.added:
            if hasattr(obj, "id") and getattr(obj, "id", None) is None:
                obj.id = self._next_id
                self._next_id += 1

    async def commit(self) -> None:
        await self.flush()
        self.committed = True

    async def rollback(self) -> None:
        self.rolled_back = True

    async def refresh(self, obj: Any, *args: Any, **kwargs: Any) -> None:
        return None

    async def delete(self, obj: Any) -> None:
        if obj in self.added:
            self.added.remove(obj)

    async def close(self) -> None:
        self.closed = True

    def begin_nested(self) -> "_FakeNestedTransaction":
        """Stand-in for AsyncSession.begin_nested() (an async SAVEPOINT context)."""
        return _FakeNestedTransaction(self)


class _FakeNestedTransaction:
    """Async context manager mimicking a SAVEPOINT; records rollbacks on error."""

    def __init__(self, session: FakeAsyncSession) -> None:
        self.session = session

    async def __aenter__(self) -> "_FakeNestedTransaction":
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> bool:
        if exc_type is not None:
            self.session.rolled_back = True
        else:
            await self.session.flush()
        return False


@pytest.fixture(autouse=True)
def _auth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Pin auth-related settings for every test so a developer's backend/.env
    (loaded by load_dotenv in app modules) can never change test behaviour.
    """
    monkeypatch.setenv("ENV", "test")
    monkeypatch.setenv("AUTH_SECRET", _TEST_ENV["AUTH_SECRET"])
    monkeypatch.setenv("AUTH_DISABLED", "false")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.delenv("AUTH_TOKEN_TTL_HOURS", raising=False)


@pytest.fixture
def fake_db() -> FakeAsyncSession:
    """A fresh fake async DB session per test."""
    return FakeAsyncSession()


@pytest.fixture
def override_db(fake_db: FakeAsyncSession) -> Iterator[Callable[[Any], FakeAsyncSession]]:
    """
    Returns a function ``apply(app)`` that overrides ``db.postgres.get_db`` on
    the given FastAPI app with ``fake_db`` and is undone after the test.

        def test_x(override_db, fake_db):
            from main import app
            override_db(app)
    """
    from db.postgres import get_db, get_session_factory

    applied: list[Any] = []

    class _FakeSessionContext:
        """``async with factory() as session`` yielding the shared fake session."""

        async def __aenter__(self) -> FakeAsyncSession:
            return fake_db

        async def __aexit__(self, *exc: Any) -> bool:
            return False

    def apply(app: Any) -> FakeAsyncSession:
        async def _get_fake_db():
            yield fake_db

        app.dependency_overrides[get_db] = _get_fake_db
        app.dependency_overrides[get_session_factory] = lambda: _FakeSessionContext
        applied.append(app)
        return fake_db

    yield apply

    for app in applied:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_session_factory, None)


@pytest.fixture
def api_app(override_db: Callable[[Any], FakeAsyncSession], monkeypatch: pytest.MonkeyPatch):
    """
    The FastAPI app with the DB dependency faked and lifespan side effects
    (table creation, graph init) disabled. Use with ``httpx.AsyncClient`` and
    ``httpx.ASGITransport`` (which does not run lifespan events).
    """
    from main import app

    override_db(app)
    return app
