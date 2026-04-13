from __future__ import annotations

from .agents import build_deep_agent_config
from .contracts import (
    ArtifactPayload,
    ArtifactProposal,
    IncrementalPreviewContext,
    IncrementalPreviewOutputs,
    ProposalArtifact,
    RefineProcessContext,
    RefineProcessOutputs,
    RenderContext,
    RenderOutputs,
)
from .core_bridge import CoreBridgeError, run_incremental_change, run_opl_import, run_refine_process, run_render, run_wizard_generate
from .state import OrchestratorState


def _normalized_artifact_payload(
    *,
    ok: bool,
    proposal: dict,
    context: dict | None = None,
    outputs: dict | None = None,
    error: dict | None = None,
    agent: dict | None = None,
    inputs: dict | None = None,
) -> ArtifactPayload:
    return ArtifactPayload(
        ok=ok,
        proposal=ArtifactProposal.model_validate(proposal),
        context=context or {},
        outputs=outputs or {},
        error=error,
        agent=agent,
        inputs=inputs,
    )


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
            payload=_normalized_artifact_payload(
                ok=False,
                proposal={
                    "summary": "Wizard generation failed before building real artifacts.",
                    "rationale": "The wizard task did not complete the real core artifact path.",
                    "confidence": 0.1,
                    "requiresHumanReview": True,
                    "ssotChecksExpected": ["sd-draft-validation-attempted", "sd-draft-artifact-build-attempted"],
                },
                context={},
                outputs={},
                error={"stage": "wizard-bridge", "message": str(exc)},
                agent=agent_config,
                inputs={"draft": draft},
            ),
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
        payload=_normalized_artifact_payload(
            ok=bool(bridge_result.get("ok")),
            proposal={
                "summary": (
                    "Wizard draft validated and compiled into real core artifacts."
                    if bridge_result.get("ok")
                    else "Wizard draft produced but needs review before artifact acceptance."
                ),
                "rationale": "Wizard generation should converge to a validated SdDraft and real derived artifacts from the core generator slice.",
                "confidence": 0.92 if bridge_result.get("ok") else 0.58,
                "requiresHumanReview": not bool(bridge_result.get("ok")),
                "ssotChecksExpected": ["sd-draft-validation-attempted", "sd-draft-artifact-build-attempted"],
            },
            context={
                "validation": bridge_result.get("validation"),
                "kernel": bridge_result.get("kernel"),
            },
            outputs=bridge_result.get("outputs") or {},
            error=bridge_result.get("error"),
            agent=agent_config,
            inputs={"draft": bridge_result.get("draft", draft)},
        ),
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
            payload=_normalized_artifact_payload(
                ok=False,
                proposal={
                    "summary": "OPL import failed before reaching SemanticKernel compilation.",
                    "rationale": "The imported OPL did not complete the real parse/compile path.",
                    "confidence": 0.1,
                    "requiresHumanReview": True,
                    "ssotChecksExpected": ["core-parse-attempted", "semantic-kernel-compile-attempted"],
                },
                context={"language": language},
                outputs={},
                error={"stage": "opl-import-bridge", "message": str(exc)},
                inputs={"oplText": getattr(task, "oplText", "")},
            ),
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
        payload=_normalized_artifact_payload(
            ok=bool(bridge_result.get("ok")),
            proposal={
                "summary": (
                    "Imported OPL compiled through @opmodel/core into a real SemanticKernel."
                    if bridge_result.get("ok")
                    else "Imported OPL reached @opmodel/core but needs review before acceptance."
                ),
                "rationale": "OPL import should converge to normalized text, kernel evidence, and derived outputs from the real core compiler.",
                "confidence": 0.93 if bridge_result.get("ok") else 0.55,
                "requiresHumanReview": not bool(bridge_result.get("ok")),
                "ssotChecksExpected": ["core-parse-attempted", "semantic-kernel-compile-attempted"],
            },
            context={
                "language": language,
                "validation": bridge_result.get("validation"),
                "parsed": bridge_result.get("parsed"),
                "kernel": bridge_result.get("kernel"),
            },
            outputs={
                **(bridge_result.get("outputs") or {}),
                "modelJson": (bridge_result.get("outputs") or {}).get("legacyModelJson"),
            },
            error=bridge_result.get("error"),
            inputs={"oplText": getattr(task, "oplText", "")},
        ),
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
            payload=_normalized_artifact_payload(
                ok=False,
                proposal={
                    "summary": "Incremental change failed before building a stable patch proposal.",
                    "rationale": "The incremental request did not complete the stable proposal path.",
                    "confidence": 0.1,
                    "requiresHumanReview": True,
                    "ssotChecksExpected": ["incremental-context-evaluated", "kernel-patch-proposal-generated"],
                },
                error={"stage": "incremental-bridge", "message": str(exc)},
                inputs={"request": getattr(task, "request", None)},
            ),
        )
        next_state = _append_artifact(state, artifact, "incremental-bridge-error")
        return _extend_guardrail(
            next_state,
            issues=["Core bridge failed for incremental-change."],
            checks=["incremental-core-bridge-invoked"],
        )

    proposal = bridge_result.get("proposal", {})
    incremental_context = IncrementalPreviewContext.model_validate(bridge_result.get("context") or {})
    incremental_outputs = IncrementalPreviewOutputs.model_validate(bridge_result.get("outputs") or {})

    artifact = ProposalArtifact(
        artifact_kind="kernel-patch-proposal",
        summary=proposal.get("summary", "Stable kernel patch proposal generated from incremental request."),
        payload=_normalized_artifact_payload(
            ok=bool(bridge_result.get("ok")),
            proposal=proposal,
            context=incremental_context.model_dump(exclude_none=True),
            outputs=incremental_outputs.model_dump(exclude_none=True),
            error=bridge_result.get("error"),
            inputs={"request": getattr(task, "request", None)},
        ),
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
            payload=_normalized_artifact_payload(
                ok=False,
                proposal={
                    "summary": "Refine-process failed before building a real refinement proposal.",
                    "rationale": "The refine-process task did not complete the core refinement slice.",
                    "confidence": 0.1,
                    "requiresHumanReview": True,
                    "ssotChecksExpected": ["refinement-proposal-generated", "sd-sd1-methodology-reviewed"],
                },
                error={"stage": "refine-process-bridge", "message": str(exc)},
                inputs={
                    "processId": getattr(task, "process_id", None),
                    "request": getattr(task, "request", None),
                },
            ),
        )
        next_state = _append_artifact(state, artifact, "refine-process-bridge-error")
        return _extend_guardrail(
            next_state,
            issues=["Core bridge failed for refine-process."],
            checks=["refine-process-core-bridge-invoked"],
        )

    proposal = bridge_result.get("proposal", {})
    refine_context = RefineProcessContext.model_validate(bridge_result.get("context") or {})
    refine_outputs = RefineProcessOutputs.model_validate(bridge_result.get("outputs") or {})
    artifact = ProposalArtifact(
        artifact_kind="refinement-proposal",
        summary=proposal.get("summary", "Refinement proposal generated from real core refinement slice."),
        payload=_normalized_artifact_payload(
            ok=bool(bridge_result.get("ok")),
            proposal=proposal,
            context=refine_context.model_dump(exclude_none=True),
            outputs=refine_outputs.model_dump(exclude_none=True),
            error=bridge_result.get("error"),
            inputs={
                "processId": getattr(task, "process_id", None),
                "request": getattr(task, "request", None),
            },
        ),
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
    task = state["task"]

    try:
        bridge_result = run_render(
            model_snapshot=getattr(task, "model_snapshot", None),
            visual_spec=getattr(task, "visual_spec", None),
        )
    except CoreBridgeError as exc:
        artifact = ProposalArtifact(
            artifact_kind="render-intent",
            summary="Render failed before building a real visual render artifact.",
            payload=_normalized_artifact_payload(
                ok=False,
                proposal={
                    "summary": "Render failed before building a real visual render artifact.",
                    "rationale": "The render task did not complete the core visual-spec generation or verification path.",
                    "confidence": 0.1,
                    "requiresHumanReview": True,
                    "ssotChecksExpected": ["visual-render-spec-generated-or-verified", "visual-render-spec-verification-run"],
                },
                error={"stage": "render-bridge", "message": str(exc)},
                inputs={
                    "visualSpecPresent": bool(getattr(task, "visual_spec", None)),
                    "modelSnapshotPresent": bool(getattr(task, "model_snapshot", None)),
                },
            ),
        )
        next_state = _append_artifact(state, artifact, "render-bridge-error")
        return _extend_guardrail(
            next_state,
            issues=["Core bridge failed for render."],
            checks=["render-core-bridge-invoked"],
        )

    proposal = bridge_result.get("proposal", {})
    render_context = RenderContext.model_validate(bridge_result.get("context") or {})
    render_outputs = RenderOutputs.model_validate(bridge_result.get("outputs") or {})
    artifact = ProposalArtifact(
        artifact_kind="render-intent",
        summary=proposal.get("summary", "Visual render artifact generated from core render pipeline."),
        payload=_normalized_artifact_payload(
            ok=bool(bridge_result.get("ok")),
            proposal=proposal,
            context=render_context.model_dump(exclude_none=True),
            outputs=render_outputs.model_dump(exclude_none=True),
            error=bridge_result.get("error"),
            inputs={
                "visualSpecPresent": bool(getattr(task, "visual_spec", None)),
                "modelSnapshotPresent": bool(getattr(task, "model_snapshot", None)),
            },
        ),
    )
    next_state = _append_artifact(state, artifact, "render-visual-spec-built")

    issues: list[str] = []
    if not bridge_result.get("ok", False):
        issues.append("Render artifact did not pass visual verification cleanly.")
    if proposal.get("requiresHumanReview"):
        issues.append("Render artifact requires human review before renderer handoff.")

    return _extend_guardrail(
        next_state,
        issues=issues,
        checks=[
            "render-core-bridge-invoked",
            "visual-render-spec-generated-or-verified",
            "visual-render-spec-verification-run",
        ],
    )


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
