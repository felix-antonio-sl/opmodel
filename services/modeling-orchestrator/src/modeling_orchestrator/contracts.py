from __future__ import annotations

from typing import Any, Literal, Union

from pydantic import BaseModel, Field


TaskKind = Literal[
    "wizard-generate",
    "opl-import",
    "incremental-change",
    "refine-process",
    "render",
]

SourceKind = Literal[
    "wizard",
    "imported-opl",
    "incremental-session",
    "system",
]


class WizardGenerateTask(BaseModel):
    kind: Literal["wizard-generate"]
    source: SourceKind = "wizard"
    system_type: Literal["artificial", "natural", "social", "socio-technical"] | None = None
    system_name: str | None = None
    main_process: str | None = None
    beneficiary: str | None = None
    benefit_attribute: str | None = None
    benefit_input_state: str | None = None
    benefit_output_state: str | None = None
    raw_intent: str | None = None


class OplImportTask(BaseModel):
    kind: Literal["opl-import"]
    source: SourceKind = "imported-opl"
    oplText: str = Field(min_length=1)
    language: Literal["en", "es", "mixed"] = "mixed"


class IncrementalChangeTask(BaseModel):
    kind: Literal["incremental-change"]
    source: SourceKind = "incremental-session"
    request: str = Field(min_length=1)
    model_snapshot: dict[str, Any] | None = None
    current_opl: str | None = None


class RefineProcessTask(BaseModel):
    kind: Literal["refine-process"]
    source: SourceKind = "incremental-session"
    process_id: str = Field(min_length=1)
    request: str | None = None
    model_snapshot: dict[str, Any] | None = None


class RenderTask(BaseModel):
    kind: Literal["render"]
    source: SourceKind = "system"
    model_snapshot: dict[str, Any] | None = None
    visual_spec: dict[str, Any] | None = None


ModelingTask = Union[
    WizardGenerateTask,
    OplImportTask,
    IncrementalChangeTask,
    RefineProcessTask,
    RenderTask,
]


class ModelingTaskEnvelope(BaseModel):
    task: ModelingTask = Field(discriminator="kind")
    session_id: str | None = None
    actor_id: str | None = None


class ProposalArtifact(BaseModel):
    artifact_kind: Literal[
        "sd-draft",
        "normalized-opl",
        "kernel-patch-proposal",
        "refinement-proposal",
        "render-intent",
    ]
    summary: str
    payload: dict[str, Any]


class GuardrailReport(BaseModel):
    ok: bool
    source_of_truth: str = "/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-ssot"
    checks: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


class ModelingTaskResult(BaseModel):
    task_kind: TaskKind
    status: Literal["proposed", "needs-review", "rejected"]
    artifacts: list[ProposalArtifact] = Field(default_factory=list)
    guardrail: GuardrailReport
    trace: list[str] = Field(default_factory=list)
