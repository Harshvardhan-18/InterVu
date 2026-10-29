"""Test doubles for the LangGraph graph and the LLM agents."""

from __future__ import annotations

from typing import Any


class FakeState:
    def __init__(self, values: dict[str, Any]) -> None:
        self.values = values


class FakeGraph:
    """
    Minimal stand-in for a compiled LangGraph graph with a checkpointer.

    ``state_values`` is what ``aget_state`` returns; each ``ainvoke`` pops the
    next entry of ``invoke_results`` (merged into the state) or echoes the
    current state.
    """

    def __init__(
        self,
        state_values: dict[str, Any] | None = None,
        invoke_results: list[dict[str, Any]] | None = None,
    ) -> None:
        self.state_values: dict[str, Any] = dict(state_values or {})
        self.invoke_results: list[dict[str, Any]] = list(invoke_results or [])
        self.updates: list[dict[str, Any]] = []
        self.invocations: list[tuple[Any, Any]] = []

    async def aget_state(self, config: Any) -> FakeState:
        return FakeState(dict(self.state_values))

    async def aupdate_state(self, config: Any, values: dict[str, Any]) -> None:
        self.updates.append(dict(values))
        self.state_values.update(values)

    async def ainvoke(self, state: Any, config: Any = None) -> dict[str, Any]:
        self.invocations.append((state, config))
        if isinstance(state, dict):
            self.state_values.update(state)
        result = self.invoke_results.pop(0) if self.invoke_results else {}
        self.state_values.update(result)
        return dict(self.state_values)

    async def astream(self, state: Any, config: Any = None, stream_mode: str = "updates"):
        """Like ainvoke, but yields LangGraph-style per-node updates first."""
        self.invocations.append((state, config))
        result = self.invoke_results.pop(0) if self.invoke_results else {}
        self.state_values.update(result)
        if "evaluation" in result:
            yield {"evaluate_answer": {"evaluation": result["evaluation"]}}
        yield {"generate_question": {k: v for k, v in result.items() if k.startswith("current_")}}


DEFAULT_REPORT = {
    "overall_score": 72,
    "strong_topics": ["Python"],
    "weak_topics": ["System design"],
    "section_scores": {"Screening": 7.0},
    "recommendations": ["Practice trade-off discussions."],
    "summary": "Solid fundamentals.",
    "fallback": False,
}


class FakeFeedbackAgent:
    def __init__(self, report: dict[str, Any] | None = None, error: Exception | None = None) -> None:
        self.report = dict(report or DEFAULT_REPORT)
        self.error = error
        self.calls: list[dict[str, Any]] = []

    async def generate_report(self, company: str, role: str, qa_pairs: list[dict[str, Any]]) -> dict[str, Any]:
        self.calls.append({"company": company, "role": role, "qa_pairs": list(qa_pairs)})
        if self.error is not None:
            raise self.error
        return dict(self.report)


class FakeBlueprintGenerator:
    def __init__(self, blueprint: dict[str, Any] | None = None) -> None:
        self.blueprint = blueprint or {
            "sections": [{"name": "Screening", "type": "screening", "questions": 2, "focus_areas": ["Intro"]}]
        }
        self.calls: list[dict[str, Any]] = []

    async def generate(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        return dict(self.blueprint)


class FakeMessage:
    def __init__(self, content: Any) -> None:
        self.content = content


class FakeLLM:
    """LLM double whose ``ainvoke`` returns (or raises) queued outcomes in order."""

    def __init__(self, outcomes: list[Any]) -> None:
        self.outcomes = list(outcomes)
        self.calls = 0

    async def ainvoke(self, prompt: Any) -> FakeMessage:
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return FakeMessage(outcome)
