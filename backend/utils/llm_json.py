"""
LLM JSON helpers
----------------
Robust parsing of JSON objects out of free-form LLM output, plus a small async
retry helper with exponential backoff and a per-attempt timeout.

Environment:
    LLM_TIMEOUT_SECONDS  Per-attempt timeout for LLM calls (default 40).
    LLM_MAX_ATTEMPTS     Attempts per LLM call including the first (default 2).

The defaults keep one LLM call under about 81 s worst case (2 x 40 s plus a
1 s backoff). POST /answer can chain the evaluator, the conductor and (on the
final answer) the feedback agent, about 245 s worst case; the frontend waits
180 s for answer and report calls and 420 s for /start. A client that gives
up early cannot double-advance an interview: concurrent answers get 409.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any, Awaitable, Callable, Iterator, TypeVar

from utils import usage

logger = logging.getLogger(__name__)

T = TypeVar("T")

_FENCE_PATTERN = re.compile(r"```(?:json|JSON)?\s*(.*?)```", re.DOTALL)


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    try:
        value = float(raw) if raw else default
    except ValueError:
        return default
    return value if value > 0 else default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    try:
        value = int(raw) if raw else default
    except ValueError:
        return default
    return value if value > 0 else default


DEFAULT_TIMEOUT_SECONDS = _env_float("LLM_TIMEOUT_SECONDS", 40.0)
DEFAULT_ATTEMPTS = _env_int("LLM_MAX_ATTEMPTS", 2)


# ── JSON extraction ───────────────────────────────────────────────────────────

def response_text(response: Any) -> str:
    """Return the text of a LangChain message (or a raw string)."""
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and isinstance(part.get("text"), str):
                parts.append(part["text"])
        return "".join(parts)
    return "" if content is None else str(content)


def _iter_balanced_objects(text: str) -> Iterator[str]:
    """
    Yield every top-level ``{...}`` span in ``text`` whose braces balance,
    ignoring braces inside JSON string literals.
    """
    depth = 0
    start: int | None = None
    in_string = False
    escaped = False

    for index, char in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            # Quotes only matter inside an object; prose quotes are ignored.
            if depth > 0:
                in_string = True
            continue

        if char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start is not None:
                yield text[start:index + 1]
                start = None


def _loads_object(candidate: str) -> dict[str, Any] | None:
    try:
        value = json.loads(candidate)
    except (json.JSONDecodeError, TypeError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def extract_json_object(raw: Any) -> dict[str, Any]:
    """
    Extract the first JSON object from LLM output.

    Handles Markdown code fences, leading/trailing prose and nested braces.

    Raises:
        ValueError: when no JSON object can be parsed.
    """
    text = response_text(raw).strip()
    if not text:
        raise ValueError("Empty LLM response")

    candidates: list[str] = [match.strip() for match in _FENCE_PATTERN.findall(text)]
    candidates.append(text)

    for candidate in candidates:
        direct = _loads_object(candidate)
        if direct is not None:
            return direct
        for span in _iter_balanced_objects(candidate):
            parsed = _loads_object(span)
            if parsed is not None:
                return parsed

    # Last resort: the legacy first-"{" to last-"}" slice.
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        parsed = _loads_object(text[start:end + 1])
        if parsed is not None:
            return parsed

    raise ValueError(f"No JSON object found in LLM response: {text[:300]!r}")


# ── Retry helper ──────────────────────────────────────────────────────────────

async def retry_async(
    func: Callable[[], Awaitable[T]],
    *,
    attempts: int | None = None,
    timeout: float | None = None,
    base_delay: float = 1.0,
    max_delay: float = 8.0,
    label: str = "llm",
) -> T:
    """
    Await ``func()`` up to ``attempts`` times, each bounded by ``timeout``
    seconds, sleeping ``base_delay * 2**n`` (capped at ``max_delay``) between
    failures. Re-raises the last exception when every attempt fails.
    """
    total = max(1, attempts if attempts is not None else DEFAULT_ATTEMPTS)
    limit = timeout if timeout is not None else DEFAULT_TIMEOUT_SECONDS
    last_error: BaseException | None = None

    for attempt in range(1, total + 1):
        try:
            return await asyncio.wait_for(func(), timeout=limit)
        except Exception as exc:  # noqa: BLE001 - every failure is retried
            last_error = exc
            if attempt >= total:
                break
            delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
            logger.warning(
                "[%s] attempt %d/%d failed (%s: %s); retrying in %.1fs",
                label, attempt, total, type(exc).__name__, exc, delay,
            )
            if delay > 0:
                await asyncio.sleep(delay)

    assert last_error is not None
    raise last_error


async def invoke_llm_json(
    llm: Any,
    prompt: Any,
    *,
    validate: Callable[[dict[str, Any]], T] | None = None,
    attempts: int | None = None,
    timeout: float | None = None,
    base_delay: float = 1.0,
    label: str = "llm",
) -> Any:
    """
    Call ``llm.ainvoke(prompt)``, extract a JSON object and optionally
    validate it, retrying the whole sequence on any failure.
    """

    async def _once() -> Any:
        response = await llm.ainvoke(prompt)
        # Count tokens before parsing: a reply that fails validation still cost money.
        usage.record(label, response, llm)
        data = extract_json_object(response)
        return validate(data) if validate is not None else data

    return await retry_async(
        _once,
        attempts=attempts,
        timeout=timeout,
        base_delay=base_delay,
        label=label,
    )
