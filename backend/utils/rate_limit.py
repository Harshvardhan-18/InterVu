"""
In-memory sliding-window rate limiting
--------------------------------------
Standard library only. Protects the unauthenticated login endpoint and the
expensive interview start endpoint (web research plus several LLM calls on
the operator's API keys).

Limits are per process: with several workers or hosts every process keeps
its own counters, so put a shared limiter (API gateway, Redis) in front of
any real deployment. The client address is ``request.client.host``;
X-Forwarded-For is deliberately NOT trusted because it is client-controlled.
Behind a reverse proxy, run uvicorn with ``--proxy-headers`` and
``--forwarded-allow-ips`` set to the proxy so ``request.client`` is correct.

Environment:
    RATE_LIMIT_LOGIN_PER_MIN    Login attempts per client IP per minute (default 10).
    RATE_LIMIT_START_PER_HOUR   Interview starts per user per hour (default 20).
    RATE_LIMIT_PUBLIC_PER_MIN   Shared-report views per client IP per minute (default 60).
    RATE_LIMIT_UPLOAD_PER_HOUR  Resume uploads per user per hour (default 10).
    RATE_LIMIT_ENABLED          "true"/"false" to force limiting on or off.
                                Default: on, except when ENV=test.
    A limit of 0 disables that limit.
"""

from __future__ import annotations

import logging
import math
import os
import threading
import time
from collections import deque
from collections.abc import Callable, Hashable

from fastapi import Depends, HTTPException, Request, status

from utils.auth import CurrentUser, get_current_user, is_test

logger = logging.getLogger(__name__)

DEFAULT_LOGIN_PER_MIN = 10
DEFAULT_START_PER_HOUR = 20
DEFAULT_PUBLIC_PER_MIN = 60
DEFAULT_UPLOAD_PER_HOUR = 10
# Upper bound on tracked keys; stale keys are pruned before this is reached.
MAX_TRACKED_KEYS = 10_000

_TRUE_VALUES = {"1", "true", "yes", "on"}
_FALSE_VALUES = {"0", "false", "no", "off"}


class SlidingWindowLimiter:
    """
    Allows at most ``limit`` hits per ``window`` seconds for each key, counting
    the exact timestamps of earlier hits (a true sliding window).
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._hits: dict[Hashable, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: Hashable, limit: int, window: float) -> float | None:
        """
        Record a hit for ``key``. Returns None when allowed, otherwise the
        number of seconds until the next hit would be allowed (the rejected
        hit is not recorded).
        """
        if limit <= 0 or window <= 0:
            return None
        now = self._clock()
        cutoff = now - window
        with self._lock:
            hits = self._hits.get(key)
            if hits is None:
                if len(self._hits) >= MAX_TRACKED_KEYS:
                    self._prune(cutoff)
                hits = self._hits[key] = deque()
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= limit:
                return max(0.0, hits[0] + window - now)
            hits.append(now)
            return None

    def _prune(self, cutoff: float) -> None:
        """Drop keys without recent hits; if still full, drop the oldest keys."""
        for key in [k for k, hits in self._hits.items() if not hits or hits[-1] <= cutoff]:
            del self._hits[key]
        overflow = len(self._hits) - MAX_TRACKED_KEYS + 1
        if overflow > 0:
            oldest = sorted(self._hits, key=lambda k: self._hits[k][-1])[:overflow]
            for key in oldest:
                del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def rate_limiting_enabled() -> bool:
    raw = os.getenv("RATE_LIMIT_ENABLED", "").strip().lower()
    if raw in _TRUE_VALUES:
        return True
    if raw in _FALSE_VALUES:
        return False
    return not is_test()


def _env_limit(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        logger.warning("Invalid %s=%r; using %d.", name, raw, default)
        return default
    return max(0, value)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _enforce(key: Hashable, limit: int, window: float, what: str) -> None:
    retry_after = limiter.hit(key, limit, window)
    if retry_after is None:
        return
    seconds = max(1, math.ceil(retry_after))
    logger.warning("Rate limit hit for %s (%r); retry in %ss.", what, key, seconds)
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many {what} requests. Try again in {seconds} seconds.",
        headers={"Retry-After": str(seconds)},
    )


async def limit_login(request: Request) -> None:
    """FastAPI dependency: RATE_LIMIT_LOGIN_PER_MIN per client IP."""
    if not rate_limiting_enabled():
        return
    limit = _env_limit("RATE_LIMIT_LOGIN_PER_MIN", DEFAULT_LOGIN_PER_MIN)
    _enforce(("login", client_ip(request)), limit, 60.0, "sign-in")


async def limit_start(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """
    FastAPI dependency: RATE_LIMIT_START_PER_HOUR per authenticated user
    (per client IP when AUTH_DISABLED leaves the caller anonymous).
    """
    if not rate_limiting_enabled():
        return
    limit = _env_limit("RATE_LIMIT_START_PER_HOUR", DEFAULT_START_PER_HOUR)
    subject: Hashable = ("user", user.id) if user.id is not None else ("ip", client_ip(request))
    _enforce(("start", subject), limit, 3600.0, "interview start")


async def limit_public(request: Request) -> None:
    """FastAPI dependency: RATE_LIMIT_PUBLIC_PER_MIN per client IP (unauthenticated endpoints)."""
    if not rate_limiting_enabled():
        return
    limit = _env_limit("RATE_LIMIT_PUBLIC_PER_MIN", DEFAULT_PUBLIC_PER_MIN)
    _enforce(("public", client_ip(request)), limit, 60.0, "shared-report")


async def limit_upload(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """FastAPI dependency: RATE_LIMIT_UPLOAD_PER_HOUR per authenticated user."""
    if not rate_limiting_enabled():
        return
    limit = _env_limit("RATE_LIMIT_UPLOAD_PER_HOUR", DEFAULT_UPLOAD_PER_HOUR)
    subject: Hashable = ("user", user.id) if user.id is not None else ("ip", client_ip(request))
    _enforce(("upload", subject), limit, 3600.0, "resume upload")
