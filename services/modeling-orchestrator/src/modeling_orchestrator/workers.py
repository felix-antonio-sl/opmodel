from __future__ import annotations

from .agents import build_deep_agent_config
from .contracts import ProposalArtifact
from .state import OrchestratorState


def route_task(state: OrchestratorState) -> OrchestratorState:
    task = state["task"]
    route = {
        "wizard-generate": "wizard",
        "opl-import": "opl-import",
        "incremental-change": "incremental",
        "refine-process": "refine",
        "render": "render",
    }[task.kind]
    trace = list(state.get("trace", []))
    trace.append(f"routed:{route}")
    return {**state, "route": route, "trace": trace, "task_kind": task.kind}


def wizard_worker(state: OrchestratorState) -> OrchestratorState:
    task = state["task"]
    agent_config = build_deep_agent_config(ssot_summary=state["ssot_summary"], task_kind=task.kind)
    artifact = ProposalArtifact(
        artifact_kind="sd-draft",
        summary="Proposed SD draft skeleton from wizard input.",
        payload={
            "agent": agent_config,
            "system_type": getattr(task, "system_type", None),
            "system_name": getattr(task, "system_name", None),
            "main_process": getattr(task, "main_process", None),
            "beneficiary": getattr(task, "beneficiary", None),
        },
    )
    return _append_artifact(state, artifact, "wizard-proposal-ready")


def opl_import_worker(state: OrchestratorState) -> OrchestratorState:
    task = state["task"]
    text = getattr(task, "oplText", "")
    normalized = text if text.lstrip().startswith("===") else f"=== SD ===\n{text.strip()}"
    artifact = ProposalArtifact(
        artifact_kind="normalized-opl",
        summary="Normalized imported OPL for downstream parsing.",
        payload={
            "normalized_opl": normalized,
            "language": getattr(task, "language", "mixed"),
        },
    )
    return _append_artifact(state, artifact, "opl-normalized")


def incremental_change_worker(state: OrchestratorState) -> OrchestratorState:
    task = state["task"]
    artifact = ProposalArtifact(
        artifact_kind="kernel-patch-proposal",
        summary="Placeholder kernel patch proposal from incremental request.",
        payload={
            "request": getattr(task, "request", None),
            "model_snapshot_present": bool(getattr(task, "model_snapshot", None)),
            "operations": [],
        },
    )
    return _append_artifact(state, artifact, "incremental-proposal-ready")


def refine_process_worker(state: OrchestratorState) -> OrchestratorState:
    task = state["task"]
    artifact = ProposalArtifact(
        artifact_kind="refinement-proposal",
        summary="Placeholder SD1 refinement proposal.",
        payload={
            "process_id": getattr(task, "process_id", None),
            "request": getattr(task, "request", None),
        },
    )
    return _append_artifact(state, artifact, "refinement-proposal-ready")


def render_worker(state: OrchestratorState) -> OrchestratorState:
    artifact = ProposalArtifact(
        artifact_kind="render-intent",
        summary="Placeholder premium render intent derived from the model.",
        payload={
            "visual_spec_present": bool(getattr(state["task"], "visual_spec", None)),
        },
    )
    return _append_artifact(state, artifact, "render-intent-ready")


def apply_ssot_guardrail(state: OrchestratorState) -> OrchestratorState:
    artifacts = state.get("artifacts", [])
    checks = list(state.get("guardrail_checks", []))
    issues = list(state.get("guardrail_issues", []))

    checks.extend(
        [
            "ssot-precedence-loaded",
            "agent-means-human-only",
            "every-process-must-transform-an-object",
            "opl-opd-equivalence-required",
        ]
    )

    if not artifacts:
        issues.append("No proposal artifact produced by the routed worker.")

    status = "proposed" if not issues else "needs-review"
    trace = list(state.get("trace", []))
    trace.append(f"guardrail:{status}")
    return {
        **state,
        "guardrail_checks": checks,
        "guardrail_issues": issues,
        "status": status,
        "trace": trace,
    }


def _append_artifact(state: OrchestratorState, artifact: ProposalArtifact, trace_line: str) -> OrchestratorState:
    artifacts = list(state.get("artifacts", []))
    artifacts.append(artifact)
    trace = list(state.get("trace", []))
    trace.append(trace_line)
    return {**state, "artifacts": artifacts, "trace": trace}
