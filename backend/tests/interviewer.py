from agents.interviewer import InterviewerAgent
import asyncio 
from rag.retriever import RAGRetriever

async def test_interviewer_agent():
    agent=InterviewerAgent()
    retriever=RAGRetriever()
    print(f"Collection count: {retriever.collection.count()}")

    query="Graph traversal BFS DFS interview question Google"
    chunks=retriever.retrieve(query=query,company="Google",role="SDE I")
    print(f"Retrieved {len(chunks)} chunks for query")
    for i,c in enumerate(chunks):
        print(f"/n[Chunk {i+1}] distance={c['distance']:.4f} source={c['metadata'].get('source','unknown')}")
        print(c['text'][:300]+"...")
    context=retriever.format_context(chunks)
    result=await agent.generate_question(
        company="Google",
        role="SDE I",
        context=context,
        section_name="Coding Assessment",
        section_type="coding",
        focus_areas=["Graphs", "BFS/DFS", "Dynamic Programming"],
        difficulty="Hard",
        previous_questions=[]
    )
    print(f"\nGenerated Question:")
    print(f"  question:      {result['question']}")
    print(f"  question_type: {result['question_type']}")
    print(f"  focus_area:    {result['focus_area']}")

asyncio.run(test_interviewer_agent())
