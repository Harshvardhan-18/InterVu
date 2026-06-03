"""
Vector Store
------------
Handles chunking, embedding, and upserting documents into ChromaDB.
"""

from __future__ import annotations

import hashlib
from typing import Any
import chromadb
from chromadb import Collection

from .embeddings import get_embedding_function


CHUNK_SIZE = 500  # tokens (approximate via word count * 1.3)
CHUNK_OVERLAP = 50


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks by approximate token count."""
    words = text.split()
    approx_chunk_words = int(chunk_size / 1.3)
    approx_overlap_words = int(overlap / 1.3)

    chunks = []
    start = 0
    while start < len(words):
        end = min(start + approx_chunk_words, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start += approx_chunk_words - approx_overlap_words

    return chunks


class VectorStore:
    """Manages document ingestion into ChromaDB."""

    def __init__(
        self,
        collection_name: str = "intervu_kb",
        chroma_path: str = "./chroma_db",
    ) -> None:
        self.client = chromadb.PersistentClient(path=chroma_path)
        self.collection: Collection = self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=get_embedding_function(),
        )

    def add_document(
        self,
        text: str,
        metadata: dict[str, Any],
        source_url: str = "",
    ) -> int:
        """
        Chunk and embed a document into ChromaDB.

        Args:
            text: Raw text content.
            metadata: Dict with at minimum 'company', 'role', 'source', 'category'.
            source_url: Optional URL for traceability.

        Returns:
            Number of chunks added.
        """
        chunks = _chunk_text(text)
        ids = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            doc_id = hashlib.md5(f"{source_url}-{i}".encode()).hexdigest()
            ids.append(doc_id)
            documents.append(chunk)
            metadatas.append({**metadata, "chunk_index": i,"total_chunks": len(chunks), "source_url": source_url})

        self.collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )
        return len(chunks)

    def get_collection_stats(self) -> dict[str, Any]:
        """Return basic stats about the collection."""
        return {
            "name": self.collection.name,
            "count": self.collection.count(),
        }
    
    def search(self, query: str, top_k: int = 5,filters: dict | None = None):
        where=None
        if filters:
            where = {
                "$and": [
                {k:v}
                for k,v in filters.items()
            ]
        }
        return self.collection.query(
            query_texts=[query],
            n_results=top_k,
            where=where
           
        )
