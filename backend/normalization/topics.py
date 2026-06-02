TOPIC_MAP = {
    "Graph": "Graphs",
    "Binary Graph": "Graphs",

    "Binary Tree": "Trees",
    "Binary Trees": "Trees",
    "Tree": "Trees",

    "Array": "Arrays",
    "String": "Strings",

    "DP": "Dynamic Programming",
    "Dynamic Programming Problems": "Dynamic Programming",

    "Operating System": "Operating Systems",
    "Computer Network": "Computer Networks",

    "Data Structure": "Data Structures",
    "Algorithm": "Algorithms",
}


def normalize_topics(topics: list[str]) -> list[str]:
    normalized = []

    for topic in topics:
        topic = topic.strip()

        if not topic:
            continue

        normalized.append(
            TOPIC_MAP.get(topic, topic)
        )

    return sorted(set(normalized))