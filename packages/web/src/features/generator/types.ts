import type { VisualRenderSpec } from "@opmodel/core";

export type GeneratorStep = 1 | 2 | 3 | 4;

export type ModelingTaskKind =
  | "wizard-generate"
  | "opl-import"
  | "incremental-change"
  | "refine-process"
  | "render";

export type ModelingTaskStatus = "proposed" | "needs-review" | "rejected";

export interface BridgeStageError {
  stage: string;
  message: string;
}

export interface KernelStats {
  things: number;
  states: number;
  links: number;
  refinements: number;
  opds: number;
}

export interface ThingSummary {
  id?: string | null;
  name: string;
  kind: "object" | "process";
}

export interface MethodologyReport {
  ok: boolean;
  issues: Array<Record<string, unknown>>;
}

export interface RenderVerificationReport {
  ok: boolean;
  issues: Array<Record<string, unknown>>;
}

export interface OrchestratorProposal {
  summary: string;
  rationale: string;
  confidence: number;
  requiresHumanReview: boolean;
  ssotChecksExpected: string[];
  operations?: Array<Record<string, unknown>>;
  refinementKind?: string;
  draft?: {
    subprocesses?: string[];
    internalObjects?: string[];
  };
  childOpdId?: string;
  mainProcessId?: string;
}

export interface OrchestratorPayload<TContext = Record<string, unknown>, TOutputs = Record<string, unknown>> {
  ok: boolean;
  proposal: OrchestratorProposal;
  context: TContext;
  outputs: TOutputs;
  error?: Record<string, unknown> | null;
  agent?: Record<string, unknown> | null;
  inputs?: Record<string, unknown> | null;
}

export interface IncrementalPreviewContext {
  currentOplPresent: boolean;
  modelSnapshotPresent: boolean;
  currentOplParsed: boolean;
  previewBaseSource: "modelSnapshot" | "currentOpl" | "none";
  previewApplied: boolean;
  normalizedOpl?: string | null;
  kernelStats?: KernelStats | null;
  knownThings: ThingSummary[];
  unresolvedReferences: string[];
  previewIssues: string[];
  appliedOperationCount?: number | null;
  currentOplError?: BridgeStageError | null;
  previewBaseError?: BridgeStageError | null;
}

export interface IncrementalPreviewOutputs {
  canonicalOpl?: string | null;
  modelJson?: string | null;
}

export interface RefineProcessContext {
  processId: string;
  resolvedProcessId?: string | null;
  baseModelSource: "modelSnapshot" | "currentOpl" | "fallback" | "none";
  modelSnapshotPresent: boolean;
  currentOplPresent: boolean;
  normalizedOpl?: string | null;
  snapshotError?: BridgeStageError | null;
  currentOplError?: BridgeStageError | null;
  fallbackError?: BridgeStageError | null;
  methodology?: MethodologyReport | null;
}

export interface RefineProcessOutputs {
  canonicalOpl?: string | null;
  modelJson?: string | null;
}

export interface RenderContext {
  source: "modelSnapshot" | "visualSpec" | "none";
  nodeCount?: number | null;
  edgeCount?: number | null;
  diagramKind?: string | null;
  verification?: RenderVerificationReport | null;
}

export interface RenderOutputs {
  visualSpec?: VisualRenderSpec | null;
  canonicalOpl?: string | null;
}

export interface WizardOutputs {
  canonicalOpl?: string | null;
  modelJson?: string | null;
}

export interface OplImportOutputs {
  canonicalOpl?: string | null;
  legacyModelJson?: string | null;
  modelJson?: string | null;
}

export interface SdDraftArtifact {
  artifact_kind: "sd-draft";
  summary: string;
  payload: OrchestratorPayload<Record<string, unknown>, WizardOutputs>;
}

export interface NormalizedOplArtifact {
  artifact_kind: "normalized-opl";
  summary: string;
  payload: OrchestratorPayload<Record<string, unknown>, OplImportOutputs>;
}

export interface KernelPatchProposalArtifact {
  artifact_kind: "kernel-patch-proposal";
  summary: string;
  payload: OrchestratorPayload<IncrementalPreviewContext, IncrementalPreviewOutputs>;
}

export interface RefinementProposalArtifact {
  artifact_kind: "refinement-proposal";
  summary: string;
  payload: OrchestratorPayload<RefineProcessContext, RefineProcessOutputs>;
}

export interface RenderIntentArtifact {
  artifact_kind: "render-intent";
  summary: string;
  payload: OrchestratorPayload<RenderContext, RenderOutputs>;
}

export type OrchestratorArtifact =
  | SdDraftArtifact
  | NormalizedOplArtifact
  | KernelPatchProposalArtifact
  | RefinementProposalArtifact
  | RenderIntentArtifact;

export interface OrchestratorGuardrail {
  ok: boolean;
  source_of_truth?: string;
  checks: string[];
  issues: string[];
}

export interface OrchestratorResult {
  task_kind: ModelingTaskKind;
  status: ModelingTaskStatus;
  artifacts: OrchestratorArtifact[];
  guardrail: OrchestratorGuardrail;
  trace: string[];
}

export interface ReviewDecision {
  decision: "accepted" | "rejected" | "applied";
  note: string;
}

export interface ReviewHistoryEntry {
  id: string;
  taskKind: ModelingTaskKind;
  artifactKind: string;
  status: string;
  summary: string;
  confidence: number;
  decision: ReviewDecision["decision"];
  note: string;
  at: string;
}

export interface ApplySimplePreviewResult {
  ok: boolean;
  artifact_kind: string;
  modelJson: string;
  canonicalOpl?: string | null;
  visualSpec?: VisualRenderSpec | null;
  childOpdId?: string | null;
  appliedFromTaskKind?: ModelingTaskKind | null;
}

export function artifactHasModelJson(
  artifact: OrchestratorArtifact,
): artifact is OrchestratorArtifact & { payload: { outputs: { modelJson: string } } } {
  const outputs = artifact.payload.outputs as { modelJson?: string | null };
  return typeof outputs.modelJson === "string" && outputs.modelJson.length > 0;
}
