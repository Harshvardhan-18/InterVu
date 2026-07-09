# backend/utils/groq_pool.py

import os
import itertools
import threading
from langchain_groq import ChatGroq
from dotenv import load_dotenv
load_dotenv()


class GroqKeyPool:
    """Round-robin key rotation across multiple Groq API keys."""

    def __init__(self, model: str) -> None:
        keys = [v for k, v in sorted(os.environ.items()) if k.startswith("GROQ_API_KEY_")]
        
        if not keys:
            # fallback to single key
            single = os.getenv("GROQ_API_KEY")
            if single:
                keys = [single]
        
        if not keys:
            raise ValueError("No Groq API keys found. Set GROQ_API_KEY_1 and GROQ_API_KEY_2 in .env")

        self._clients = [ChatGroq(model=model,api_key=k) for k in keys]
        self._cycle   = itertools.cycle(self._clients)
        self._lock    = threading.Lock()

        print(f"[GroqKeyPool] {len(keys)} key(s) loaded for '{model}'")

    def get(self) -> ChatGroq:
        """Returns next client in round-robin order. Thread-safe."""
        with self._lock:
            return next(self._cycle)