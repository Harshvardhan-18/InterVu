"""
Blueprint Prompt
----------------
Prompt template for generating a structured interview blueprint from
extracted company/role research data.
"""

BLUEPRINT_PROMPT = """You are designing an interview plan for {role} at {company}.
Required Skills: {skills}
Interview Topics: {topics}
Interview Rounds (observed): {rounds}
Known DSA Question Patterns: {dsa_questions}
Difficulty: {difficulty}

Generate a structured interview blueprint. Respond ONLY with valid JSON, no markdown fences, no explanation:
{{
  "sections": [
    {{
      "name": "<section name>",
      "type": "coding" | "behavioral" | "technical" | "system_design" | "screening",
      "questions": <int 1-5>,
      "focus_areas": ["...", "..."]
    }}
  ]
}}

For "focus_areas", select specific items from the Interview Topics and DSA Question Patterns
provided above that are most relevant to each section. Do not invent topics not present in the
provided lists."""