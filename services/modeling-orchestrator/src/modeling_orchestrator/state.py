from __future__ import annotations

from typing import Any, Literal, TypedDict

from .contracts import ModelingTask, ProposalArtifact


class OrchestratorState(TypedDict, total=False):
    task: ModelingTask
    task_kind: str
    route: Literal[
        "wizard",
        "opl-import",
        "incremental",
        "refine",
        "render",
    ]
    ssot_summary: str
    trace: list[str]
    artifacts: list[ProposalArtifact]
    guardrail_checks: list[str]
    guardrail_issues: list[str]
    status: Literal["proposed", "needs-review", "rejected"]
    metadata: dict[str, Any]
