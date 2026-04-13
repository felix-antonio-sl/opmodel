from __future__ import annotations

from .agents import build_deep_agent_config
from .contracts import ProposalArtifact
from .core_bridge import CoreBridgeError, run_opl_import
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
    language = getattr(task, "language", "mixed")

    try:
        bridge_result = run_opl_import(getattr(task, "oplText", ""), language)
    except CoreBridgeError as exc:
        artifact = ProposalArtifact(
            artifact_kind="normalized-opl",
            summary="OPL import failed before reaching SemanticKernel compilation.",
            payload={
                "language": language,
                "bridge_error": str(exc),
            },
        )
        next_state = _append_artifact(state, artifact, "opl-import-bridge-error")
        return _extend_guardrail(
            next_state,
            issues=["Core bridge failed for opl-import."],
            checks=["core-bridge-invoked"],
        )

    artifact = ProposalArtifact(
        artifact_kind="normalized-opl",
        summary=(
            "Imported OPL compiled through @opmodel/core into a real SemanticKernel."
            if bridge_result.get("ok")
            else "Imported OPL reached @opmodel/core but needs review before acceptance."
        ),
        payload=bridge_result,
    )
    next_state = _append_artifact(state, artifact, "opl-import-core-compiled")

    issues: list[str] = []
    if not bridge_result.get("ok", False):
        issues.append("OPL import did not pass core validation cleanly.")
    if bridge_result.get("error"):
        issues.append(f"Core stage failed: {bridge_result['error'].get('stage', 'unknown')}.")

    return _extend_guardrail(
        next_state,
        issues=issues,
        checks=[
            "core-bridge-invoked",
            "core-parse-attempted",
            "semantic-kernel-compile-attempted",
        ],
    )


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



def _extend_guardrail(
    state: OrchestratorState,
    *,
    issues: list[str] | None = None,
    checks: list[str] | None = None,
) -> OrchestratorState:
    guardrail_issues = list(state.get("guardrail_issues", []))
    guardrail_checks = list(state.get("guardrail_checks", []))

    if issues:
        guardrail_issues.extend(issues)
    if checks:
        guardrail_checks.extend(checks)

    return {
        **state,
        "guardrail_issues": guardrail_issues,
        "guardrail_checks": guardrail_checks,
    }
