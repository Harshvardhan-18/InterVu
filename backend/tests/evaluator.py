# tests/evaluator.py
import asyncio
from agents.evaluator import EvaluatorAgent

async def main():
    agent = EvaluatorAgent()

    # Test 1: Strong answer
    print("=" * 60)
    print("TEST 1: Strong Answer")
    print("=" * 60)
    result = await agent.evaluate(
        company="Google",
        role="SDE I",
        question="Given a weighted graph with positive edge weights, implement Dijkstra's algorithm to find the shortest path between two nodes.",
        answer="""I'll use a min-heap priority queue to implement Dijkstra's algorithm.
        First, initialize distances to all nodes as infinity except the source (0).
        Push (0, source) into the heap. While the heap is non-empty, pop the
        minimum distance node. If we've reached the destination, return the distance.
        For each neighbor, if current distance + edge weight < known distance,
        update and push to heap. Time complexity O((V+E) log V), space O(V).
        Edge cases: disconnected graph returns -1, single node returns 0.""",
        context="Google interviews focus heavily on graph algorithms. Dijkstra's algorithm is frequently asked. Candidates are expected to discuss time/space complexity and edge cases.",
        section="Coding",
    )
    print(f"Score:           {result['score']}")
    print(f"Correctness:     {result['correctness']}")
    print(f"Depth:           {result['depth']}")
    print(f"Communication:   {result['communication']}")
    print(f"Problem Solving: {result['problem_solving']}")
    print(f"Strengths:       {result['strengths']}")
    print(f"Weaknesses:      {result['weaknesses']}")
    print(f"Feedback:        {result['brief_feedback']}")

    # Test 2: Weak answer
    print("\n" + "=" * 60)
    print("TEST 2: Weak Answer")
    print("=" * 60)
    result = await agent.evaluate(
        company="Google",
        role="SDE I",
        question="Given a weighted graph with positive edge weights, implement Dijkstra's algorithm to find the shortest path between two nodes.",
        answer="I would use BFS to traverse the graph and find the shortest path.",
        context="Google interviews focus heavily on graph algorithms. Dijkstra's algorithm is frequently asked. Candidates are expected to discuss time/space complexity and edge cases.",
        section="Coding",
    )
    print(f"Score:           {result['score']}")
    print(f"Correctness:     {result['correctness']}")
    print(f"Depth:           {result['depth']}")
    print(f"Communication:   {result['communication']}")
    print(f"Problem Solving: {result['problem_solving']}")
    print(f"Strengths:       {result['strengths']}")
    print(f"Weaknesses:      {result['weaknesses']}")
    print(f"Feedback:        {result['brief_feedback']}")

    # Test 3: Behavioral question
    print("\n" + "=" * 60)
    print("TEST 3: Behavioral Answer")
    print("=" * 60)
    result = await agent.evaluate(
        company="Google",
        role="SDE I",
        question="Tell me about a time you disagreed with a teammate's technical approach. How did you handle it?",
        answer="""During a project, my teammate wanted to use a NoSQL database for
        a use case that clearly needed relational data with complex joins.
        I scheduled a 1:1, prepared a comparison doc showing query complexity
        and consistency tradeoffs, and proposed a hybrid approach. We ended up
        using PostgreSQL and it saved us significant refactoring later.
        The key was focusing on data, not opinions.""",
        context="Google values Googleyness — collaboration, humility, and evidence-based decision making.",
        section="Behavioral",
    )
    print(f"Score:           {result['score']}")
    print(f"Correctness:     {result['correctness']}")
    print(f"Depth:           {result['depth']}")
    print(f"Communication:   {result['communication']}")
    print(f"Problem Solving: {result['problem_solving']}")
    print(f"Strengths:       {result['strengths']}")
    print(f"Weaknesses:      {result['weaknesses']}")
    print(f"Feedback:        {result['brief_feedback']}")

asyncio.run(main())