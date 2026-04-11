import type { DraftValidationReport } from "@opmodel/core";

interface GeneratorValidationPanelProps {
  report: DraftValidationReport;
}

export function ValidationPanel({ report }: GeneratorValidationPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Validation</div>
        <span style={{ color: report.ok ? "var(--success)" : "var(--warning)", fontSize: 12, fontWeight: 700 }}>
          {report.ok ? "PASS" : "REVIEW"}
        </span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {report.issues.length === 0 ? (
          <div style={{ border: "1px solid rgba(34,197,94,0.35)", borderRadius: 10, padding: 12, background: "rgba(22,101,52,0.12)", color: "#bbf7d0" }}>
            Sin hallazgos en la validación de draft.
          </div>
        ) : report.issues.map((issue) => (
          <div key={`${issue.ruleId}-${issue.message}`} style={{ border: "1px solid var(--code-border)", borderRadius: 10, padding: 12, background: "rgba(15,23,42,0.55)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#93c5fd" }}>{issue.ruleId}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{issue.severity}</span>
              {issue.field && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{issue.field}</span>}
            </div>
            <div style={{ color: "var(--code-text)", fontSize: 13 }}>{issue.message}</div>
            {issue.suggestedFix && <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>{issue.suggestedFix}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
