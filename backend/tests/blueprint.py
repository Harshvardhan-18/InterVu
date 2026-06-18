json = {'extracted': {'skills': ['Object-Oriented Programming', 'Problem-Solving', 'Verbal And Written Communication', 'Web Development'], 'technologies': ['Django', 'JavaScript', 'Node.js', 'Python', 'React.js', 'SQL', 'Vue.js'], 'topics': ['Algorithms', 'BFS/DFS/Flood Fill', 'Behavioral', 'Binary Search', 'Data Structures', 'Dynamic Programming', 'Graphs', 'Hash Tables', 'Linked List', 'Queues', 'Stacks', 'System Design', 'Tree Traversals', 'Union Find'], 'rounds': ['DSA Rounds', 'Fitment Call', 'Google Hiring Committee Approval', 'Google OA', 'Googliness', 'Googliness Round', 'Googlyness Round', 'On-Site', 'Online Assessment', 'Onsite Interviews', 'Phone Screening Round', 'Round 1: Coding', 'Round 2: Telephonic Interview', 'Round 3', 'Round 4', 'Screening Call', 'Team Matching Round', 'Technical Interview', 'Telephone Conversation', 'Telephonic', 'Video Interview'], 'behavioral_patterns': ['Courage', 'Leadership', 'Problem-Solving', 'Teamwork'], 'difficulty': 'Medium', 'key_insights': ['Be Kind To The Recruiter', 'Focus on DSA', 'Practice Coding', 'Practice Coding Problems', 'Practice coding problems', 'Prepare Well For System Design', 'Study Programming Languages', 'Understand The Job Description'], 'dsa_questions': ['Angle Between Hands Of A Clock', 'Find All Matches Of A Small String', 'Longest Palindromic Substring', 'Minimum Steps To Reach 1', 'Rope Or Cord Data Structure', 'Shortest Path With Alternating Colors', 'Superstreaks', 'Team Formation', 'Text Justification', 'The Skyline Problem']}, 'urls_processed': 8}
data = json['extracted']
import asyncio
from agents.registry import blueprint_generator

async def test_blueprint():
    result=await blueprint_generator.generate(
        company="Google",
        role="SDE-I",
        skills=data['skills'],
        topics=data['topics'],
        rounds=data['rounds'],
        dsa_questions=data['dsa_questions'],
        difficulty=data['difficulty'],
    ) 
    print(result)

asyncio.run(test_blueprint())