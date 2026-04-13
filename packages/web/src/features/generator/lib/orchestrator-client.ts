import type { OrchestratorResult } from "../types";

type SourceKind = "wizard" | "imported-opl" | "incremental-session" | "system";

export type ModelingTaskEnvelope = {
  task:
    | ({ kind: "wizard-generate"; source?: SourceKind } & Record<string, unknown>)
    | ({ kind: "opl-import"; source?: SourceKind; oplText: string; language?: "en" | "es" | "mixed" })
    | ({ kind: "incremental-change"; source?: SourceKind; request: string; modelSnapshot?: Record<string, unknown> | null; currentOpl?: string | null })
    | ({ kind: "refine-process"; source?: SourceKind; processId: string; request?: string | null; modelSnapshot?: Record<string, unknown> | null; currentOpl?: string | null })
    | ({ kind: "render"; source?: SourceKind; modelSnapshot?: Record<string, unknown> | null; visualSpec?: Record<string, unknown> | null });
  session_id?: string | null;
  actor_id?: string | null;
};

function baseUrl() {
  const envBase = (import.meta.env.VITE_MODELING_ORCHESTRATOR_URL as string | undefined)?.trim();
  return (envBase && envBase.length > 0 ? envBase : "/api/modeling-orchestrator").replace(/\/$/, "");
}

export async function runModelingTask(envelope: ModelingTaskEnvelope): Promise<OrchestratorResult> {
  const response = await fetch(`${baseUrl()}/v1/modeling-tasks/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(envelope),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(bodyText || `Modeling orchestrator request failed (${response.status})`);
  }

  try {
    return JSON.parse(bodyText) as OrchestratorResult;
  } catch {
    throw new Error("Modeling orchestrator returned invalid JSON.");
  }
}
