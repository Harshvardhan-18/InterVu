"""
Logging setup
-------------
Configures the root logger once and injects the current request id (set by
the request-id middleware in main.py) into every log record.

Environment:
    LOG_LEVEL   Root log level name (default INFO).
"""

from __future__ import annotations

import contextvars
import logging
import os

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] [req=%(request_id)s] %(message)s"

_configured = False


class RequestIdFilter(logging.Filter):
    """Adds ``record.request_id`` from the request context."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = request_id_var.get()
        return True


def configure_logging() -> None:
    """Idempotently configure root logging with request-id aware formatting."""
    global _configured
    if _configured:
        return

    level_name = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"
    level = getattr(logging, level_name, logging.INFO)
    if not isinstance(level, int):
        level = logging.INFO

    logging.basicConfig(level=level, format=LOG_FORMAT)

    request_filter = RequestIdFilter()
    for handler in logging.getLogger().handlers:
        handler.addFilter(request_filter)

    _configured = True
