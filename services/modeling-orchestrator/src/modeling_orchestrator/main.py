from __future__ import annotations

from fastapi import FastAPI

from .contracts import ModelingTaskEnvelope, ModelingTaskResult
from .graph import run_modeling_task

app = FastAPI(
    title="OPModel Modeling Orchestrator",
    version="0.1.0",
    description="LangGraph/Deep Agents orchestration service under OPM SSOT guardrails.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "modeling-orchestrator",
    }


@app.post("/v1/modeling-tasks/run", response_model=ModelingTaskResult)
def run_task(envelope: ModelingTaskEnvelope) -> ModelingTaskResult:
    return run_modeling_task(envelope)
