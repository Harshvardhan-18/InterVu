"""
Error monitoring (Sentry)
-------------------------
Optional and off by default: nothing is sent and the SDK is not even imported
unless SENTRY_DSN is set.

What leaves the server is deliberately minimal, because this app handles
interview answers, resumes and secret share links:

* ``send_default_pii=False`` and ``max_request_body_size="never"``: request
  bodies (answers, resume uploads), cookies and IP addresses are not attached.
* ``include_local_variables=False``: stack frames carry no local variables
  (which would hold answers, tokens and database URLs).
* ``scrub_event`` additionally drops the Authorization header and cookies,
  query strings, and replaces share tokens in URLs with ``[redacted]``.

Environment:
    SENTRY_DSN                  Enables Sentry when set.
    SENTRY_TRACES_SAMPLE_RATE   0.0 to 1.0 performance sampling (default 0).
    SENTRY_RELEASE              Optional release identifier.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from utils.auth import env_name

logger = logging.getLogger(__name__)

_SENSITIVE_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key", "proxy-authorization", "x-filename"}
# /shared/<token> and /api/shared/<token>: the token is the credential.
_SHARE_URL = re.compile(r"(/shared/)[A-Za-z0-9_\-]{8,}")


def _redact_url(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    return _SHARE_URL.sub(r"\1[redacted]", value.split("?", 1)[0])


def scrub_event(event: dict[str, Any], hint: Any = None) -> dict[str, Any] | None:
    """``before_send`` hook: strip secrets and personal data from an event."""
    request = event.get("request")
    if isinstance(request, dict):
        for key in ("data", "cookies", "query_string", "env"):
            request.pop(key, None)
        if "url" in request:
            request["url"] = _redact_url(request["url"])
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {k: v for k, v in headers.items() if k.lower() not in _SENSITIVE_HEADERS}
    event.pop("user", None)
    if isinstance(event.get("transaction"), str):
        event["transaction"] = _redact_url(event["transaction"])
    for crumb in (event.get("breadcrumbs") or {}).get("values", []) if isinstance(event.get("breadcrumbs"), dict) else []:
        data = crumb.get("data")
        if isinstance(data, dict):
            for key in ("url", "http.url", "http.query"):
                if key in data:
                    data[key] = _redact_url(data[key]) if key != "http.query" else "[redacted]"
    return event


def scrub_breadcrumb(crumb: dict[str, Any], hint: Any = None) -> dict[str, Any] | None:
    data = crumb.get("data")
    if isinstance(data, dict):
        for key in ("url", "http.url"):
            if key in data:
                data[key] = _redact_url(data[key])
        data.pop("http.query", None)
    return crumb


def _sample_rate() -> float:
    try:
        return min(1.0, max(0.0, float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0") or 0)))
    except ValueError:
        return 0.0


def init_sentry() -> bool:
    """Initialise Sentry if SENTRY_DSN is set. Returns True when it was enabled."""
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False
    try:
        import sentry_sdk  # imported lazily: not needed unless monitoring is on
    except ImportError:
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed; monitoring is disabled.")
        return False
    sentry_sdk.init(
        dsn=dsn,
        environment=env_name() or "production",
        release=os.getenv("SENTRY_RELEASE", "").strip() or None,
        traces_sample_rate=_sample_rate(),
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        before_send=scrub_event,
        before_breadcrumb=scrub_breadcrumb,
    )
    logger.info("Sentry error monitoring enabled (environment=%s).", env_name() or "production")
    return True
