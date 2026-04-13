import type { ModelingTaskKind, OrchestratorResult, ReviewDecision } from "../types";

const STORAGE_KEY = "opmodel:generator:review-history";
const MAX_ENTRIES = 20;

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

export function loadReviewHistory(): ReviewHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ReviewHistoryEntry[] : [];
  } catch {
    return [];
  }
}

export function appendReviewHistory(result: OrchestratorResult, decision: ReviewDecision): ReviewHistoryEntry[] {
  const artifact = result.artifacts[0];
  if (!artifact) return loadReviewHistory();

  const nextEntry: ReviewHistoryEntry = {
    id: `${Date.now()}-${result.task_kind}-${decision.decision}`,
    taskKind: result.task_kind,
    artifactKind: artifact.artifact_kind,
    status: result.status,
    summary: artifact.payload.proposal.summary,
    confidence: artifact.payload.proposal.confidence,
    decision: decision.decision,
    note: decision.note,
    at: new Date().toISOString(),
  };

  const next = [nextEntry, ...loadReviewHistory()].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
