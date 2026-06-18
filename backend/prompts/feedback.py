FEEDBACK_PROMPT = """You are a senior hiring manager at {company} evaluating a candidate for {role}.

Here is the complete interview transcript with scores:
{qa_text}

Generate a comprehensive post-interview feedback report.

Scoring guide for overall_score (0-100):
- 0-40:  Poor, significant gaps in knowledge
- 41-60: Below average, some correct answers but major weaknesses
- 61-75: Average, adequate performance with room for improvement
- 76-90: Good, strong performance with minor gaps
- 91-100: Excellent, exceptional performance across all areas

For section_scores, use the section names exactly as they appear in the transcript.
Each section score should be 0-10.

Respond ONLY with valid JSON, no markdown fences, no explanation:
{{
  "overall_score": <0-100 int>,
  "strong_topics": ["...", "..."],
  "weak_topics": ["...", "..."],
  "section_scores": {{"<section_name>": <0-10 float>, ...}},
  "recommendations": ["...", "...", "..."],
  "summary": "..."
}}"""