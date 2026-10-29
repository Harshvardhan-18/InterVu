"""
Per-key asyncio locks
---------------------
Serialises work on one interview inside this process (graph advances,
report generation). Locks are created on demand and dropped once nobody
holds or waits for them, so the registry does not grow without bound.

This is an in-process guard only: with several workers or hosts a database
row lock (SELECT ... FOR UPDATE) or an external lock would be needed.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Hashable
from contextlib import asynccontextmanager


class KeyedLocks:
    """A registry of asyncio.Lock objects keyed by any hashable value."""

    def __init__(self) -> None:
        self._locks: dict[Hashable, asyncio.Lock] = {}
        self._users: dict[Hashable, int] = {}

    def is_locked(self, key: Hashable) -> bool:
        lock = self._locks.get(key)
        return lock is not None and lock.locked()

    def __len__(self) -> int:
        return len(self._locks)

    @asynccontextmanager
    async def hold(self, key: Hashable) -> AsyncIterator[None]:
        """Wait for the lock of ``key`` and hold it for the ``async with`` body."""
        lock = self._locks.get(key)
        if lock is None:
            lock = self._locks[key] = asyncio.Lock()
        self._users[key] = self._users.get(key, 0) + 1
        try:
            async with lock:
                yield
        finally:
            remaining = self._users[key] - 1
            if remaining:
                self._users[key] = remaining
            else:
                del self._users[key]
                del self._locks[key]


# One lock per interview id, shared by the interview and report routers.
interview_locks = KeyedLocks()
