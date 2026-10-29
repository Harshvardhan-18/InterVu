# backend/utils/groq_pool.py

import itertools
import logging
import threading

from langchain_groq import ChatGroq

from config import groq_api_keys

logger = logging.getLogger(__name__)


class GroqKeyPool:
    """Round-robin key rotation across multiple Groq API keys."""

    def __init__(self, model: str) -> None:
        # GROQ_API_KEY_1, GROQ_API_KEY_2, ... (numeric order), falling back to GROQ_API_KEY.
        keys = groq_api_keys()

        if not keys:
            raise ValueError(
                "No Groq API keys found. Set GROQ_API_KEY, or GROQ_API_KEY_1 and GROQ_API_KEY_2, in backend/.env"
            )

        self._clients = [ChatGroq(model=model, api_key=k) for k in keys]
        self._cycle = itertools.cycle(self._clients)
        self._lock = threading.Lock()

        logger.info("[GroqKeyPool] %d key(s) loaded for '%s'", len(keys), model)

    def get(self) -> ChatGroq:
        """Returns next client in round-robin order. Thread-safe."""
        with self._lock:
            return next(self._cycle)
