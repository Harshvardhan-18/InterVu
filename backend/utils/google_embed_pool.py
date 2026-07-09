# backend/utils/google_embed_pool.py

import os
import re
import itertools
import threading
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from chromadb import EmbeddingFunction

load_dotenv()


class GoogleEmbedPool(EmbeddingFunction):
    """
    Round-robin key rotation across multiple Google API keys for embeddings.
    Thread-safe and implements both LangChain and ChromaDB embedding interfaces.
    """

    def __init__(self) -> None:
        # Sort keys numerically by suffix (e.g. GOOGLE_API_KEY_1, GOOGLE_API_KEY_2, etc.)
        keys_dict = {}
        for k, v in os.environ.items():
            match = re.match(r"^GOOGLE_API_KEY_(\d+)$", k)
            if match and v.strip():
                keys_dict[int(match.group(1))] = v.strip()
        
        keys = [keys_dict[idx] for idx in sorted(keys_dict.keys())]

        if not keys:
            # fallback to single key
            single = os.getenv("GOOGLE_API_KEY", "").strip()
            if single:
                keys = [single]

        if not keys:
            raise ValueError("No Google API keys found. Set GOOGLE_API_KEY_1 and GOOGLE_API_KEY_2 in .env")

        self._clients = [
            GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=k)
            for k in keys
        ]
        self._cycle = itertools.cycle(self._clients)
        self._lock = threading.Lock()

        print(f"[GoogleEmbedPool] {len(keys)} key(s) loaded for 'models/gemini-embedding-001'")

    def _get_client(self) -> GoogleGenerativeAIEmbeddings:
        """Returns next client in round-robin order. Thread-safe."""
        with self._lock:
            return next(self._cycle)

    def embed_query(self, text: str | None = None, input: list[str] | None = None) -> list[float] | list[list[float]]:
        if input is not None:
            return [self._get_client().embed_query(q) for q in input]
        return self._get_client().embed_query(text)

    def embed_documents(self, texts: list[str] | None = None, input: list[str] | None = None) -> list[list[float]]:
        target = texts if texts is not None else input
        return self._get_client().embed_documents(target)

    async def aembed_query(self, text: str | None = None, input: list[str] | None = None) -> list[float] | list[list[float]]:
        if input is not None:
            return [await self._get_client().aembed_query(q) for q in input]
        return await self._get_client().aembed_query(text)

    async def aembed_documents(self, texts: list[str] | None = None, input: list[str] | None = None) -> list[list[float]]:
        target = texts if texts is not None else input
        return await self._get_client().aembed_documents(target)

    def __call__(self, input: list[str]) -> list[list[float]]:
        return self.embed_documents(input=input)
