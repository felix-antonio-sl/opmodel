import type { Model } from "@opmodel/core";
import { buildVisualReport, exportVisualReportMarkdown } from "../lib/visual-report";

export function VisualReportPanel({ model, onClose }: { model: Model; onClose: () => void }) {
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

  return (
    <div style={{
      position: "fixed", right: 12, bottom: 34, width: 420, maxHeight: "65vh", overflow: "auto", zIndex: 60,
      background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8,
      boxShadow: "0 6px 24px rgba(0,0,0,0.18)", padding: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Visual Quality Report</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{report.modelName}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
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

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
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
              <td style={{ padding: "6px 4px", color: opd.grade === "A" ? "var(--success)" : opd.grade === "F" ? "var(--error, #e53e3e)" : "var(--text)" }}>{opd.grade}</td>
              <td style={{ padding: "6px 4px" }}>{opd.score}</td>
              <td style={{ padding: "6px 4px" }}>{opd.errors}/{opd.warnings}/{opd.info}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
