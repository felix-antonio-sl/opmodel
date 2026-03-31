import type { Model } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { buildVisualReport, exportVisualReportMarkdown, type VisualFindingReportItem, type VisualOpdReport } from "../lib/visual-report";

function thingLabel(model: Model, thingId: string): string {
  const thing = model.things.get(thingId);
  if (!thing) return thingId;
  return `${thing.kind === "process" ? "⬭" : "▭"} ${thing.name}`;
}

function severityColor(severity: VisualFindingReportItem["severity"]): string {
  switch (severity) {
    case "error":
      return "var(--error, #e53e3e)";
    case "warning":
      return "var(--warning, #dd6b20)";
    case "info":
      return "var(--text-dim)";
  }
}

function gradeColor(grade: VisualOpdReport["grade"]): string {
  switch (grade) {
    case "A":
      return "var(--success)";
    case "F":
      return "var(--error, #e53e3e)";
    default:
      return "var(--text)";
  }
}

export function VisualReportPanel({
  model,
  dispatch,
  onClose,
}: {
  model: Model;
  dispatch: (cmd: Command) => boolean;
  onClose: () => void;
}) {
  const report = buildVisualReport(model);

  const downloadMarkdown = () => {
    const blob = new Blob([exportVisualReportMarkdown(report)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(model.meta.name || "model").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-visual-report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const navigateToFinding = (opdId: string, finding: VisualFindingReportItem) => {
    dispatch({ tag: "selectOpd", opdId });
    if (finding.primaryEntity) {
      dispatch({ tag: "selectThing", thingId: finding.primaryEntity });
    }
    onClose();
  };

  return (
    <div style={{
      position: "fixed", right: 12, bottom: 34, width: 520, maxHeight: "72vh", overflow: "auto", zIndex: 60,
      background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8,
      boxShadow: "0 6px 24px rgba(0,0,0,0.18)", padding: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Visual Quality Report</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{report.modelName}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="header__action" onClick={downloadMarkdown}>Export MD</button>
          <button className="header__action" onClick={onClose}>Close</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12, fontSize: 12 }}>
        <div><strong>Avg</strong><br />{report.avgScore}</div>
        <div><strong>Best</strong><br />{report.bestScore}</div>
        <div><strong>Worst</strong><br />{report.worstScore}</div>
        <div><strong>Errors</strong><br />{report.totalErrors}</div>
        <div><strong>Warnings</strong><br />{report.totalWarnings}</div>
        <div><strong>Info</strong><br />{report.totalInfo}</div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "6px 4px" }}>OPD</th>
            <th style={{ padding: "6px 4px" }}>Grade</th>
            <th style={{ padding: "6px 4px" }}>Score</th>
            <th style={{ padding: "6px 4px" }}>E/W/I</th>
          </tr>
        </thead>
        <tbody>
          {report.opds.map((opd) => (
            <tr key={opd.opdId} style={{ borderBottom: "1px solid var(--border-subtle, var(--border))" }}>
              <td style={{ padding: "6px 4px" }}>{opd.name}</td>
              <td style={{ padding: "6px 4px", color: gradeColor(opd.grade), fontWeight: 600 }}>{opd.grade}</td>
              <td style={{ padding: "6px 4px" }}>{opd.score}</td>
              <td style={{ padding: "6px 4px" }}>{opd.errors}/{opd.warnings}/{opd.info}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {report.opds.map((opd, index) => (
          <details
            key={opd.opdId}
            open={index === 0 || opd.errors > 0}
            style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-subtle, transparent)" }}
          >
            <summary style={{ cursor: "pointer", listStyle: "none", padding: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{opd.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  Grade <span style={{ color: gradeColor(opd.grade), fontWeight: 700 }}>{opd.grade}</span> · Score {opd.score} · {opd.findings.length} findings
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                {opd.errors} / {opd.warnings} / {opd.info}
              </div>
            </summary>

            <div style={{ padding: "0 10px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
              {opd.findings.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>No findings.</div>
              ) : (
                opd.findings.map((finding, findingIndex) => {
                  const clickable = Boolean(finding.primaryEntity);
                  return (
                    <button
                      key={`${opd.opdId}-${finding.kind}-${findingIndex}`}
                      type="button"
                      onClick={() => clickable ? navigateToFinding(opd.opdId, finding) : undefined}
                      disabled={!clickable}
                      style={{
                        appearance: "none",
                        width: "100%",
                        textAlign: "left",
                        border: "1px solid var(--border-subtle, var(--border))",
                        borderRadius: 6,
                        background: "var(--bg-panel)",
                        padding: 10,
                        cursor: clickable ? "pointer" : "default",
                        opacity: clickable ? 1 : 0.9,
                      }}
                      title={clickable ? "Go to affected thing in this OPD" : "Model-level finding without a direct entity target"}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: severityColor(finding.severity),
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                          }}>
                            {finding.severity}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{finding.kind}</span>
                        </div>
                        {finding.primaryEntity && (
                          <span style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                            {thingLabel(model, finding.primaryEntity)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.35 }}>{finding.summary}</div>
                    </button>
                  );
                })
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
