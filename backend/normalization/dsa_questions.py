BAD_PATTERNS = [
    "easy problem",
    "medium problem",
    "hard problem",
    "coding question",
    "coding problem",
    "dsa question",
    "algorithm question",
]

def normalize_dsa_questions(
    questions: list[str]
) -> list[str]:

    cleaned = []

    for q in questions:
        q = q.strip()

        if not q:
            continue

        q_lower = q.lower()

        if any(
            bad in q_lower
            for bad in BAD_PATTERNS
        ):
            continue

        cleaned.append(q)

    return sorted(set(cleaned))