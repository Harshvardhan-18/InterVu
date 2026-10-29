"""
LLM token accounting
--------------------
Every LLM call reports its token counts here. A request handler calls
``begin()`` to start collecting; ``utils.llm_json.invoke_llm_json`` and the
extractor call ``record()`` after each model response (including responses
that later fail validation, because they cost tokens too); the handler then
persists the rows with ``services.usage.persist_usage``.

Collection uses a ``ContextVar`` holding a list, so concurrent requests never
mix their numbers, and tasks spawned by LangGraph (which copy the context)
append to the same list. Outside a request nothing is collected and
``record()`` is a no-op.

Cost: token prices differ per provider and change often, so no price is
hard-coded. Set LLM_PRICE_INPUT_PER_MTOK and LLM_PRICE_OUTPUT_PER_MTOK (USD per
million tokens) to see estimated costs; without them only tokens are shown.
"""

from __future__ import annotations

import os
from contextvars import ContextVar
from typing import Any

_collector: ContextVar[list[dict[str, Any]] | None] = ContextVar("llm_usage_collector", default=None)


def begin() -> list[dict[str, Any]]:
    """Start collecting usage for the current request; returns the (live) list."""
    records: list[dict[str, Any]] = []
    _collector.set(records)
    return records


def ensure() -> list[dict[str, Any]]:
    """The current collector, starting one only if none is active (keeps earlier records)."""
    existing = _collector.get()
    return existing if existing is not None else begin()


def collected() -> list[dict[str, Any]]:
    return _collector.get() or []


def _as_int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def tokens_from_response(response: Any) -> tuple[int, int]:
    """(input_tokens, output_tokens) from a LangChain message, (0, 0) when unknown."""
    meta = getattr(response, "usage_metadata", None)
    if isinstance(meta, dict) and meta:
        return _as_int(meta.get("input_tokens")), _as_int(meta.get("output_tokens"))
    resp_meta = getattr(response, "response_metadata", None)
    if isinstance(resp_meta, dict):
        token_usage = resp_meta.get("token_usage")
        if isinstance(token_usage, dict):
            return _as_int(token_usage.get("prompt_tokens")), _as_int(token_usage.get("completion_tokens"))
    return 0, 0


def model_from_response(response: Any, llm: Any = None) -> str | None:
    resp_meta = getattr(response, "response_metadata", None)
    if isinstance(resp_meta, dict) and resp_meta.get("model_name"):
        return str(resp_meta["model_name"])[:100]
    name = getattr(llm, "model_name", None) or getattr(llm, "model", None)
    return str(name)[:100] if name else None


def record(label: str, response: Any, llm: Any = None) -> None:
    """Add one call's token counts to the current request's collector (if any)."""
    records = _collector.get()
    if records is None:
        return
    input_tokens, output_tokens = tokens_from_response(response)
    records.append({
        "label": label[:50],
        "model": model_from_response(response, llm),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    })


# ── Pricing and limits (environment) ──────────────────────────────────────────

def _env_float(name: str) -> float | None:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    try:
        value = float(raw)
    except ValueError:
        return None
    return value if value >= 0 else None


def estimate_cost(input_tokens: int, output_tokens: int) -> float | None:
    """Estimated USD cost, or None when prices are not configured."""
    price_in = _env_float("LLM_PRICE_INPUT_PER_MTOK")
    price_out = _env_float("LLM_PRICE_OUTPUT_PER_MTOK")
    if price_in is None and price_out is None:
        return None
    return round(
        (input_tokens / 1_000_000) * (price_in or 0.0) + (output_tokens / 1_000_000) * (price_out or 0.0),
        6,
    )


def daily_token_limit() -> int:
    """DAILY_TOKEN_LIMIT per user (0 = unlimited, the default)."""
    raw = os.getenv("DAILY_TOKEN_LIMIT", "").strip()
    try:
        return max(0, int(raw)) if raw else 0
    except ValueError:
        return 0
