"""
Embeddings
----------
Returns a ChromaDB-compatible embedding function.
Defaults to sentence-transformers/all-MiniLM-L6-v2 (local, free).
Can be swapped to Google text-embedding-004 via env var.
"""

from __future__ import annotations

import os

from chromadb import EmbeddingFunction


def get_embedding_function() -> EmbeddingFunction:
    """
    Return the appropriate embedding function based on environment.

    Set EMBEDDING_PROVIDER=google to use text-embedding-004.
    Defaults to sentence-transformers/all-MiniLM-L6-v2.
    """
    provider = os.getenv("EMBEDDING_PROVIDER", "sentence-transformers")

    if provider == "google":
        from chromadb.utils.embedding_functions import GoogleGenerativeAiEmbeddingFunction

        return GoogleGenerativeAiEmbeddingFunction(
            api_key=os.environ["GOOGLE_API_KEY"],
            model_name="models/text-embedding-004",
        )

    # Default: local sentence-transformers
    from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

    return SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
