import re

CANONICAL_ROUNDS = {
    "Online Assessment": ["online assessment", "google oa", r"^oa$"],
    "Technical Phone Screen": ["phone screen", "telephonic", "telephone", "screening call", "screening round"],
    "Onsite Interviews": ["onsite", "on-site", "on site"],
    "Technical Interview": [r"^round \d", "coding round", "technical round", "technical interview"],
    "Googleyness Round": ["googleyness", "googlyness", "googliness"],
    "HR Interview": ["hr round", "hr interview"],
    "DSA Rounds": ["dsa round"],
    "Team Matching Round": ["team match"],
    "Fitment Call": ["fitment"],
    "Hiring Committee Approval": ["hiring committee"],
}

def normalize_rounds(rounds: list[str]) -> list[str]:
    normalized = set()
    for round_name in rounds:
        rn = round_name.strip()
        if not rn:
            continue
        rn_lower = rn.lower()
        matched = False
        for canonical, patterns in CANONICAL_ROUNDS.items():
            if any(re.search(p, rn_lower) for p in patterns):
                normalized.add(canonical)
                matched = True
                break
        if not matched:
            normalized.add(rn)  # keep unrecognized rounds as-is
    return sorted(normalized)