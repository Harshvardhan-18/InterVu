# agents/registry.py
from agents.blueprint import BlueprintGenerator
from agents.interviewer import InterviewerAgent
from agents.evaluator import EvaluatorAgent
from agents.feedback import FeedbackAgent
from rag.retriever import RAGRetriever
from agents.conductor import ConductorAgent

retriever = RAGRetriever()
interviewer = InterviewerAgent()
evaluator = EvaluatorAgent()
blueprint_generator = BlueprintGenerator()
feedback_agent = FeedbackAgent()
conductor = ConductorAgent()