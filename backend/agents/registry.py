# agents/registry.py
"""
Shared agent singletons.

Constructing these agents only builds LLM client objects (no network calls).
The RAG retriever is NOT created here; use ``rag.retriever.get_retriever()``,
which creates the ChromaDB client lazily on first use.
"""
from agents.blueprint import BlueprintGenerator
from agents.conductor import ConductorAgent
from agents.evaluator import EvaluatorAgent
from agents.feedback import FeedbackAgent

evaluator = EvaluatorAgent()
blueprint_generator = BlueprintGenerator()
feedback_agent = FeedbackAgent()
conductor = ConductorAgent()
