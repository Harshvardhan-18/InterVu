# test_vector_store.py

from rag.vector_store import VectorStore

def main():
    store = VectorStore()

    sample_text = """
    Google SDE interview experience.

    Round 1:
    Graph traversal problem using BFS.

    Round 2:
    Binary Tree problem involving Lowest Common Ancestor.

    Round 3:
    System design discussion around distributed caching.

    Behavioral round focused on leadership and teamwork.
    """
    larger_text = sample_text * 50  # Simulate a longer document that requires chunking
    chunks_added = store.add_document(
        text=larger_text,
        metadata={
            "company": "Google",
            "role": "SDE I",
            "source": "test",
            "category": "interview_experiences",
        },
        source_url="test://google-sde",
    )

    print(f"Chunks added: {chunks_added}")

    print("\nCollection Stats:")
    print(store.get_collection_stats())

    print("\nSearching for 'graph problems'...")

    results = store.collection.query(
        query_texts=["graph problems"],
        n_results=3,
    )

    print("\nRetrieved Documents:")
    for i, doc in enumerate(results["documents"][0]):
        print(f"\nResult {i + 1}")
        print(doc[:300])

    print("\nMetadata:")
    for meta in results["metadatas"][0]:
        print(meta)


if __name__ == "__main__":
    main()