from normalization.topics import normalize_topics
from normalization.rounds import normalize_rounds
from normalization.dsa_questions import normalize_dsa_questions


class ExtractionNormalizer:

    def normalize(
        self,
        data: dict
    ) -> dict:

        data["topics"] = normalize_topics(
            data.get("topics", [])
        )

        data["rounds"] = normalize_rounds(
            data.get("rounds", [])
        )

        data["dsa_questions"] = normalize_dsa_questions(
            data.get("dsa_questions", [])
        )

        return data