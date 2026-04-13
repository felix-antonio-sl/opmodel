import type { OrchestratorResult, ReviewDecision } from "../types";

interface ProposalReviewPanelProps {
  result: OrchestratorResult;
  decision?: ReviewDecision | null;
  busy?: boolean;
  error?: string | null;
  onAccept?: () => void;
  onReject?: () => void;
  onApplySimple?: () => void;
}

function prettyValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function ProposalReviewPanel({ result, decision, busy = false, error, onAccept, onReject, onApplySimple }: ProposalReviewPanelProps) {
  const artifact = result.artifacts[0];
  if (!artifact) return null;

  const payload = artifact.payload;
  const hasPreviewModel = typeof payload.outputs?.modelJson === "string" && payload.outputs.modelJson.length > 0;
  const operations = Array.isArray(payload.proposal.operations) ? payload.proposal.operations : [];
  const checks = payload.proposal.ssotChecksExpected ?? [];
  const outputEntries = Object.entries(payload.outputs ?? {}).filter(([key]) => key !== "modelJson");
  const statusColor = result.status === "proposed" ? "#22c55e" : result.status === "needs-review" ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 16, background: "rgba(15,23,42,0.55)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Proposal review</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700, color: "var(--code-text)" }}>{payload.proposal.summary}</div>
          <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 13 }}>{payload.proposal.rationale}</div>
        </div>
        <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
          <div style={{ color: statusColor, fontWeight: 700, fontSize: 13 }}>{result.status}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>confidence {payload.proposal.confidence.toFixed(2)}</div>
          {decision && <div style={{ fontSize: 12, color: "#38bdf8" }}>decision: {decision.decision}</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Expected checks</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--code-text)", fontSize: 13, display: "grid", gap: 4 }}>
            {checks.map((check) => <li key={check}><code>{check}</code></li>)}
          </ul>
          {operations.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>Operations</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, color: "#cbd5e1", background: "#020617", borderRadius: 10, padding: 12 }}>{JSON.stringify(operations, null, 2)}</pre>
            </>
          )}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Outputs</div>
          {outputEntries.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No review outputs beyond internal preview state.</div>
          ) : outputEntries.map(([key, value]) => (
            <details key={key} style={{ border: "1px solid var(--code-border)", borderRadius: 10, padding: 10, background: "rgba(2,6,23,0.6)" }}>
              <summary style={{ cursor: "pointer", color: "var(--code-text)", fontSize: 13, fontWeight: 600 }}>{key}</summary>
              <pre style={{ margin: "12px 0 0", whiteSpace: "pre-wrap", fontSize: 12, color: "#cbd5e1" }}>{prettyValue(value)}</pre>
            </details>
          ))}
        </div>
      </div>

      {(result.guardrail.issues.length > 0 || payload.error || error) && (
        <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
          {result.guardrail.issues.length > 0 && (
            <div style={{ color: "#f59e0b" }}>Guardrail issues: {result.guardrail.issues.join(" · ")}</div>
          )}
          {payload.error && <div style={{ color: "#ef4444" }}>Artifact error: {prettyValue(payload.error)}</div>}
          {error && <div style={{ color: "#ef4444" }}>{error}</div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onAccept && <button onClick={onAccept} disabled={busy}>Accept review</button>}
        {onReject && <button onClick={onReject} disabled={busy}>Reject review</button>}
        {onApplySimple && <button onClick={onApplySimple} disabled={busy || !hasPreviewModel} style={{ background: hasPreviewModel ? "#1d4ed8" : undefined, color: hasPreviewModel ? "white" : undefined, border: hasPreviewModel ? "1px solid #2563eb" : undefined }}>Apply simple preview</button>}
      </div>
    </div>
  );
}
