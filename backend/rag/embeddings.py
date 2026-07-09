"""
Embeddings
----------
Returns a Google-API-based Embedding function using GoogleEmbedPool.
"""

from __future__ import annotations

from chromadb import EmbeddingFunction
from utils.google_embed_pool import GoogleEmbedPool

_embedding_function: GoogleEmbedPool | None = None


def get_embedding_function() -> EmbeddingFunction:
    """
    Return the singleton GoogleEmbedPool embedding function.
    """
    global _embedding_function
    if _embedding_function is None:
        _embedding_function = GoogleEmbedPool()
    return _embedding_function
