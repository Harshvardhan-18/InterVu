"""
RAG Retriever
-------------
Queries ChromaDB to retrieve relevant context for interview question generation.
"""

from __future__ import annotations

from typing import Any

import chromadb
from chromadb import Collection

from .embeddings import get_embedding_function


class RAGRetriever:
    """Retrieves relevant chunks from ChromaDB given a query."""

    def __init__(
        self,
        collection_name: str = "intervu_kb",
        chroma_path: str = "./chroma_db",
        n_results: int = 5,
    ) -> None:
        self.client = chromadb.PersistentClient(path=chroma_path)
        self.collection: Collection = self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=get_embedding_function(),
        )
        self.n_results = n_results

    def retrieve(
        self,
        query: str,
        company: str | None = None,
        role: str | None = None,
        source_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Retrieve top-k relevant chunks.

        Args:
            query: The semantic search query.
            company: Filter by company metadata.
            role: Filter by role metadata.
            source_type: Filter by source type (e.g., 'interview_experience').

        Returns:
            List of {text, metadata, distance} dicts.
        """
        where: dict[str, Any] = {}
        if company:
            where["company"] = company
        if role:
            where["role"] = role
        if source_type:
            where["source"] = source_type

        kwargs: dict[str, Any] = {
            "query_texts": [query],
            "n_results": self.n_results,
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            kwargs["where"] = where

        results = self.collection.query(**kwargs)

        chunks = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            chunks.append({"text": doc, "metadata": meta, "distance": dist})

        return chunks

    def format_context(self, chunks: list[dict[str, Any]]) -> str:
        """Format retrieved chunks into a single context string."""
        return "\n\n---\n\n".join(
            f"[Source: {c['metadata'].get('source', 'unknown')}]\n{c['text']}"
            for c in chunks
        )
