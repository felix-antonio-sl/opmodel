export type GeneratorStep = 1 | 2 | 3 | 4;

export type ModelingTaskKind =
  | "wizard-generate"
  | "opl-import"
  | "incremental-change"
  | "refine-process"
  | "render";

export type ModelingTaskStatus = "proposed" | "needs-review" | "rejected";

export interface OrchestratorProposal {
  summary: string;
  rationale: string;
  confidence: number;
  requiresHumanReview: boolean;
  ssotChecksExpected: string[];
  operations?: Array<Record<string, unknown>>;
  refinementKind?: string;
  draft?: Record<string, unknown>;
  childOpdId?: string;
  mainProcessId?: string;
}

export interface OrchestratorPayload {
  ok: boolean;
  proposal: OrchestratorProposal;
  context: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error?: Record<string, unknown> | null;
  agent?: Record<string, unknown> | null;
  inputs?: Record<string, unknown> | null;
}

export interface OrchestratorArtifact {
  artifact_kind: string;
  summary: string;
  payload: OrchestratorPayload;
}

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
  visualSpec?: Record<string, unknown> | null;
  childOpdId?: string | null;
  appliedFromTaskKind?: ModelingTaskKind | null;
}
