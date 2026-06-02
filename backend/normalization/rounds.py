ROUND_MAP = {
    "Onsites": "Onsite Interviews",
    "Onsite Round": "Onsite Interviews",
    "Onsite Interview": "Onsite Interviews",

    "Phone Screen": "Technical Phone Screen",
    "Technical Phone Interview": "Technical Phone Screen",

    "Technical Round": "Technical Interview",
    "Coding Round": "Technical Interview",

    "Googleyness": "Googleyness Round",
    "Googlyness": "Googleyness Round",

    "HR Round": "HR Interview",
}

def normalize_rounds(rounds: list[str]) -> list[str]:
    normalized = []

    for round_name in rounds:
        round_name = round_name.strip()

        if not round_name:
            continue

        normalized.append(
            ROUND_MAP.get(round_name, round_name)
        )

    return sorted(set(normalized))