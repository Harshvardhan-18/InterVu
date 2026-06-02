EXTRACTOR_PROMPT="""
        You are an expert at analyzing job postings and interview experiences.

        Company: {company}
        Role: {role}

        Document Category: {category}

        Document Title: {title}

        Source URL: {url}

        Content: {content}

        Return ONLY valid JSON.

        Rules:
        1. All arrays must contain strings only.
        2. Do not return objects.
        3. Do not return nested JSON.
        4. Do not return dictionaries inside arrays.
        5. difficulty must be EXACTLY one of:
        - Easy
        - Medium
        - Hard
        
        Definitions:
        - skills: Specific skills required for the role (e.g. "Data Structures", "System Design", "Behavioral").
        - technologies: Programming languages, tools, frameworks (e.g. "Python", "AWS", "Docker").
        - topics: High-level interview subjects (e.g. "Operating Systems", "System Design", "Networking", "Graphs", "Trees").
        - responsibilities: Key job responsibilities mentioned in the description (e.g. "Design scalable systems", "Lead a team of engineers").
        - rounds: Distinct interview rounds or stages (e.g. "Online Assessment  ", "Technical Interview", "HR Interview").
        - behavioral_patterns: Common behavioral themes or leadership qualities (e.g. "Leadership", "Teamwork", "Problem-solving").
        - difficulty: Overall difficulty level of the interview process (Easy, Medium, Hard).
        - key_insights: Unique insights or advice mentioned in the document (e.g. "Focus on system design for senior roles", "Practice coding problems on LeetCode").
        - dsa_questions: Specific data structure and algorithm questions mentioned (e.g. "Two Sum", "Longest Substring Without Repeating Characters").
        Example:
        {{
        "skills": ["Data Structures", "Algorithms"],
        "technologies": ["Java", "Python"],
        "topics": ["Graphs", "Trees"],
        "responsibilities": ["Design scalable systems"],
        "rounds": ["Online Assessment", "Technical Interview"],
        "behavioral_patterns": ["Leadership"],
        "difficulty": "Hard",
        "key_insights": ["Focus on DSA"],
        "dsa_questions": ["Two Sum", "Longest Substring Without Repeating Characters"]
        }}
        Category Rules:

        For category = "job":
        Focus on:
        - skills
        - technologies
        - responsibilities

        For category = "interview_experiences":
        Focus on:
        - topics
        - rounds
        - difficulty
        - behavioral_patterns
        - dsa_questions

        For category = "process":
        Focus on:
        - rounds
        - difficulty
        - key_insights
        IMPORTANT:
        Do not include <think> tags.
        Do not explain your reasoning.
        Do not output any text before the JSON.
        Return only the JSON object.
        If information is missing, return empty arrays or default values, but always return valid JSON.
        Do not guess
        Only extract information explicitly present in the document.
        Do not infer missing information.               
        Remove duplicates.
        Keep entries concise.
        Use title case when appropriate. 
        """