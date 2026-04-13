from __future__ import annotations

from typing import Any, Literal, Union

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


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
    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["wizard-generate"]
    source: SourceKind = "wizard"
    system_type: Literal["artificial", "natural", "social", "socio-technical"] | None = Field(
        default=None,
        validation_alias=AliasChoices("system_type", "systemType"),
    )
    system_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("system_name", "systemName"),
    )
    main_process: str | None = Field(
        default=None,
        validation_alias=AliasChoices("main_process", "mainProcess"),
    )
    beneficiary: str | None = None
    beneficiary_attribute: str | None = Field(
        default=None,
        validation_alias=AliasChoices("beneficiary_attribute", "beneficiaryAttribute", "benefit_attribute"),
    )
    beneficiary_state_in: str | None = Field(
        default=None,
        validation_alias=AliasChoices("beneficiary_state_in", "beneficiaryStateIn", "benefit_input_state"),
    )
    beneficiary_state_out: str | None = Field(
        default=None,
        validation_alias=AliasChoices("beneficiary_state_out", "beneficiaryStateOut", "benefit_output_state"),
    )
    value_object: str | None = Field(
        default=None,
        validation_alias=AliasChoices("value_object", "valueObject"),
    )
    value_state_in: str | None = Field(
        default=None,
        validation_alias=AliasChoices("value_state_in", "valueStateIn"),
    )
    value_state_out: str | None = Field(
        default=None,
        validation_alias=AliasChoices("value_state_out", "valueStateOut"),
    )
    agents: list[str] = Field(default_factory=list)
    instruments: list[str] = Field(default_factory=list)
    inputs: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    environment: list[str] = Field(default_factory=list)
    problem_occurrence: str | None = Field(
        default=None,
        validation_alias=AliasChoices("problem_occurrence", "problemOccurrence"),
    )
    raw_intent: str | None = None


class OplImportTask(BaseModel):
    kind: Literal["opl-import"]
    source: SourceKind = "imported-opl"
    oplText: str = Field(min_length=1)
    language: Literal["en", "es", "mixed"] = "mixed"


class IncrementalChangeTask(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["incremental-change"]
    source: SourceKind = "incremental-session"
    request: str = Field(min_length=1)
    model_snapshot: dict[str, Any] | None = Field(
        default=None,
        validation_alias=AliasChoices("model_snapshot", "modelSnapshot"),
    )
    current_opl: str | None = Field(
        default=None,
        validation_alias=AliasChoices("current_opl", "currentOpl"),
    )


class RefineProcessTask(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["refine-process"]
    source: SourceKind = "incremental-session"
    process_id: str = Field(
        min_length=1,
        validation_alias=AliasChoices("process_id", "processId"),
    )
    request: str | None = None
    model_snapshot: dict[str, Any] | None = Field(
        default=None,
        validation_alias=AliasChoices("model_snapshot", "modelSnapshot"),
    )
    current_opl: str | None = Field(
        default=None,
        validation_alias=AliasChoices("current_opl", "currentOpl"),
    )


class RenderTask(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["render"]
    source: SourceKind = "system"
    model_snapshot: dict[str, Any] | None = Field(
        default=None,
        validation_alias=AliasChoices("model_snapshot", "modelSnapshot"),
    )
    visual_spec: dict[str, Any] | None = Field(
        default=None,
        validation_alias=AliasChoices("visual_spec", "visualSpec"),
    )


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


class ArtifactProposal(BaseModel):
    summary: str
    rationale: str
    confidence: float
    requiresHumanReview: bool
    ssotChecksExpected: list[str] = Field(default_factory=list)
    model_config = ConfigDict(extra="allow")


class ArtifactPayload(BaseModel):
    ok: bool
    proposal: ArtifactProposal
    context: dict[str, Any] = Field(default_factory=dict)
    outputs: dict[str, Any] = Field(default_factory=dict)
    error: dict[str, Any] | None = None
    agent: dict[str, Any] | None = None
    inputs: dict[str, Any] | None = None


class BridgeStageError(BaseModel):
    stage: str
    message: str


class KernelStats(BaseModel):
    things: int
    states: int
    links: int
    refinements: int
    opds: int


class ThingSummary(BaseModel):
    id: str | None = None
    name: str
    kind: Literal["object", "process"]


class IncrementalPreviewContext(BaseModel):
    currentOplPresent: bool = False
    modelSnapshotPresent: bool = False
    currentOplParsed: bool = False
    previewBaseSource: Literal["modelSnapshot", "currentOpl", "none"] = "none"
    previewApplied: bool = False
    normalizedOpl: str | None = None
    kernelStats: KernelStats | None = None
    knownThings: list[ThingSummary] = Field(default_factory=list)
    unresolvedReferences: list[str] = Field(default_factory=list)
    previewIssues: list[str] = Field(default_factory=list)
    appliedOperationCount: int | None = None
    currentOplError: BridgeStageError | None = None
    previewBaseError: BridgeStageError | None = None


class IncrementalPreviewOutputs(BaseModel):
    canonicalOpl: str | None = None
    modelJson: str | None = None


class MethodologyReport(BaseModel):
    ok: bool
    issues: list[dict[str, Any]] = Field(default_factory=list)


class RefineProcessContext(BaseModel):
    processId: str
    resolvedProcessId: str | None = None
    baseModelSource: Literal["modelSnapshot", "currentOpl", "fallback", "none"]
    modelSnapshotPresent: bool = False
    currentOplPresent: bool = False
    normalizedOpl: str | None = None
    snapshotError: BridgeStageError | None = None
    currentOplError: BridgeStageError | None = None
    fallbackError: BridgeStageError | None = None
    methodology: MethodologyReport | None = None


class RefineProcessOutputs(BaseModel):
    canonicalOpl: str | None = None
    modelJson: str | None = None


class RenderVerificationReport(BaseModel):
    ok: bool
    issues: list[dict[str, Any]] = Field(default_factory=list)


class RenderContext(BaseModel):
    source: Literal["modelSnapshot", "visualSpec", "none"]
    nodeCount: int | None = None
    edgeCount: int | None = None
    diagramKind: str | None = None
    verification: RenderVerificationReport | None = None


class RenderOutputs(BaseModel):
    visualSpec: dict[str, Any] | None = None
    canonicalOpl: str | None = None


class ProposalArtifact(BaseModel):
    artifact_kind: Literal[
        "sd-draft",
        "normalized-opl",
        "kernel-patch-proposal",
        "refinement-proposal",
        "render-intent",
    ]
    summary: str
    payload: ArtifactPayload


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


class ApplySimplePreviewRequest(BaseModel):
    artifact: ProposalArtifact


class ApplySimplePreviewResult(BaseModel):
    ok: bool
    artifact_kind: str
    modelJson: str
    canonicalOpl: str | None = None
    visualSpec: dict[str, Any] | None = None
    childOpdId: str | None = None
    appliedFromTaskKind: TaskKind | None = None
