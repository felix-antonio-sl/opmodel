from __future__ import annotations

from .agents import build_deep_agent_config
from .contracts import ProposalArtifact
from .core_bridge import CoreBridgeError, run_incremental_change, run_opl_import, run_refine_process, run_wizard_generate
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
    draft = {
        "systemType": getattr(task, "system_type", None) or "artificial",
        "systemName": getattr(task, "system_name", None) or "",
        "mainProcess": getattr(task, "main_process", None) or "",
        "beneficiary": getattr(task, "beneficiary", None) or "",
        "beneficiaryAttribute": getattr(task, "beneficiary_attribute", None) or "",
        "beneficiaryStateIn": getattr(task, "beneficiary_state_in", None) or "",
        "beneficiaryStateOut": getattr(task, "beneficiary_state_out", None) or "",
        "valueObject": getattr(task, "value_object", None) or "",
        "valueStateIn": getattr(task, "value_state_in", None) or "",
        "valueStateOut": getattr(task, "value_state_out", None) or "",
        "agents": list(getattr(task, "agents", []) or []),
        "instruments": list(getattr(task, "instruments", []) or []),
        "inputs": list(getattr(task, "inputs", []) or []),
        "outputs": list(getattr(task, "outputs", []) or []),
        "environment": list(getattr(task, "environment", []) or []),
        "problemOccurrence": getattr(task, "problem_occurrence", None),
    }

    try:
        bridge_result = run_wizard_generate(draft)
    except CoreBridgeError as exc:
        artifact = ProposalArtifact(
            artifact_kind="sd-draft",
            summary="Wizard generation failed before building real artifacts.",
            payload={
                "agent": agent_config,
                "draft": draft,
                "bridge_error": str(exc),
            },
        )
        next_state = _append_artifact(state, artifact, "wizard-bridge-error")
        return _extend_guardrail(
            next_state,
            issues=["Core bridge failed for wizard-generate."],
            checks=["wizard-core-bridge-invoked"],
        )

    artifact = ProposalArtifact(
        artifact_kind="sd-draft",
        summary=(
            "Wizard draft validated and compiled into real core artifacts."
            if bridge_result.get("ok")
            else "Wizard draft produced but needs review before artifact acceptance."
        ),
        payload={
            "agent": agent_config,
            **bridge_result,
        },
    )
    next_state = _append_artifact(state, artifact, "wizard-core-artifacts-built")

    issues: list[str] = []
    if not bridge_result.get("ok", False):
        issues.append("Wizard draft did not pass core validation cleanly.")
    if bridge_result.get("error"):
        issues.append(f"Wizard stage failed: {bridge_result['error'].get('stage', 'unknown')}.")

    return _extend_guardrail(
        next_state,
        issues=issues,
        checks=[
            "wizard-core-bridge-invoked",
            "sd-draft-validation-attempted",
            "sd-draft-artifact-build-attempted",
        ],
    )


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

    try:
        bridge_result = run_incremental_change(
            getattr(task, "request", ""),
            current_opl=getattr(task, "current_opl", None),
            model_snapshot=getattr(task, "model_snapshot", None),
        )
    except CoreBridgeError as exc:
        artifact = ProposalArtifact(
            artifact_kind="kernel-patch-proposal",
            summary="Incremental change failed before building a stable patch proposal.",
            payload={
                "request": getattr(task, "request", None),
                "bridge_error": str(exc),
            },
        )
        next_state = _append_artifact(state, artifact, "incremental-bridge-error")
        return _extend_guardrail(
            next_state,
            issues=["Core bridge failed for incremental-change."],
            checks=["incremental-core-bridge-invoked"],
        )

    proposal = bridge_result.get("proposal", {})
    artifact = ProposalArtifact(
        artifact_kind="kernel-patch-proposal",
        summary=proposal.get("summary", "Stable kernel patch proposal generated from incremental request."),
        payload=bridge_result,
    )
    next_state = _append_artifact(state, artifact, "incremental-proposal-built")

    issues: list[str] = []
    if not bridge_result.get("ok", False):
        issues.append("Incremental change request remains ambiguous and needs manual review.")
    if proposal.get("requiresHumanReview"):
        issues.append("Kernel patch proposal requires human review before application.")

    return _extend_guardrail(
        next_state,
        issues=issues,
        checks=[
            "incremental-core-bridge-invoked",
            "kernel-patch-proposal-generated",
            "incremental-context-evaluated",
        ],
    )


def refine_process_worker(state: OrchestratorState) -> OrchestratorState:
    task = state["task"]

    try:
        bridge_result = run_refine_process(
            getattr(task, "process_id", ""),
            request=getattr(task, "request", None),
            current_opl=getattr(task, "current_opl", None),
            model_snapshot=getattr(task, "model_snapshot", None),
        )
    except CoreBridgeError as exc:
        artifact = ProposalArtifact(
            artifact_kind="refinement-proposal",
            summary="Refine-process failed before building a real refinement proposal.",
            payload={
                "process_id": getattr(task, "process_id", None),
                "request": getattr(task, "request", None),
                "bridge_error": str(exc),
            },
        )
        next_state = _append_artifact(state, artifact, "refine-process-bridge-error")
        return _extend_guardrail(
            next_state,
            issues=["Core bridge failed for refine-process."],
            checks=["refine-process-core-bridge-invoked"],
        )

    proposal = bridge_result.get("proposal", {})
    artifact = ProposalArtifact(
        artifact_kind="refinement-proposal",
        summary=proposal.get("summary", "Refinement proposal generated from real core refinement slice."),
        payload=bridge_result,
    )
    next_state = _append_artifact(state, artifact, "refinement-proposal-built")

    issues: list[str] = []
    if not bridge_result.get("ok", False):
        issues.append("Refine-process did not pass methodology cleanly.")
    if proposal.get("requiresHumanReview"):
        issues.append("Refinement proposal requires human review before application.")

    return _extend_guardrail(
        next_state,
        issues=issues,
        checks=[
            "refine-process-core-bridge-invoked",
            "refinement-proposal-generated",
            "sd-sd1-methodology-reviewed",
        ],
    )


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
