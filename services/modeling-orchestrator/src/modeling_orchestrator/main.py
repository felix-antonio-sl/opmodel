from __future__ import annotations

import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .contracts import ApplySimplePreviewRequest, ApplySimplePreviewResult, ModelingTaskEnvelope, ModelingTaskResult
from .core_bridge import CoreBridgeError, run_render
from .graph import run_modeling_task

app = FastAPI(
    title="OPModel Modeling Orchestrator",
    version="0.1.0",
    description="LangGraph/Deep Agents orchestration service under OPM SSOT guardrails.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.post("/v1/reviews/apply-simple", response_model=ApplySimplePreviewResult)
def apply_simple_preview(request: ApplySimplePreviewRequest) -> ApplySimplePreviewResult:
    outputs = request.artifact.payload.outputs
    model_json = outputs.get("modelJson")
    if not isinstance(model_json, str) or not model_json.strip():
        raise HTTPException(status_code=400, detail="Artifact does not expose a deterministic modelJson preview.")

    try:
        model_snapshot = json.loads(model_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Artifact modelJson is not valid JSON.") from exc

    try:
        render_result = run_render(model_snapshot=model_snapshot)
    except CoreBridgeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if not render_result.get("ok"):
        raise HTTPException(status_code=400, detail=render_result.get("error", {}).get("message", "Render verification failed."))

    return ApplySimplePreviewResult(
        ok=True,
        artifact_kind=request.artifact.artifact_kind,
        modelJson=model_json,
        canonicalOpl=(render_result.get("outputs") or {}).get("canonicalOpl") or outputs.get("canonicalOpl"),
        visualSpec=(render_result.get("outputs") or {}).get("visualSpec"),
        childOpdId=getattr(request.artifact.payload.proposal, "childOpdId", None),
        appliedFromTaskKind=_task_kind_for_artifact(request.artifact.artifact_kind),
    )


def _task_kind_for_artifact(artifact_kind: str) -> str | None:
    return {
        "sd-draft": "wizard-generate",
        "normalized-opl": "opl-import",
        "kernel-patch-proposal": "incremental-change",
        "refinement-proposal": "refine-process",
        "render-intent": "render",
    }.get(artifact_kind)
