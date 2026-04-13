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
