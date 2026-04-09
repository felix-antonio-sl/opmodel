import { useEffect, useMemo, useState } from "react";
import type { Model, InvariantError } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { buildVisualReport, exportVisualReportMarkdown, type VisualFindingReportItem, type VisualOpdReport } from "../lib/visual-report";
import { visualFindingSeverity, type VisualFinding } from "../lib/visual-lint";

interface Props {
  model: Model;
  currentOpd: string;
  errors: InvariantError[];
  visualFindings?: VisualFinding[];
  dispatch: (cmd: Command) => boolean;
  onClose: () => void;
  initialTab?: ValidationTab;
}

type SeverityFilter = "all" | "error" | "warning" | "info";
type ScopeFilter = "all" | "current-opd";
export type ValidationTab = "issues" | "visual-report";

function findOpdForEntity(model: Model, entityId: string): string | null {
  for (const app of model.appearances.values()) {
    if (app.thing === entityId) return app.opd;
  }
  const state = model.states.get(entityId);
  if (state) {
    for (const app of model.appearances.values()) {
      if (app.thing === state.parent) return app.opd;
    }
  }
  const link = model.links.get(entityId);
  if (link) {
    for (const app of model.appearances.values()) {
      if (app.thing === link.source) return app.opd;
    }
  }
  const mod = model.modifiers.get(entityId);
  if (mod) {
    const mlink = model.links.get(mod.over);
    if (mlink) {
      for (const app of model.appearances.values()) {
        if (app.thing === mlink.source) return app.opd;
      }
    }
  }
  return null;
}

function findThingForEntity(model: Model, entityId: string): string | null {
  if (model.things.has(entityId)) return entityId;
  const state = model.states.get(entityId);
  if (state) return state.parent;
  const link = model.links.get(entityId);
  if (link) return link.source;
  const mod = model.modifiers.get(entityId);
  if (mod) {
    const mlink = model.links.get(mod.over);
    if (mlink) return mlink.source;
  }
  return null;
}

function entityLabel(model: Model, entityId: string): string {
  const thing = model.things.get(entityId);
  if (thing) return `${thing.kind === "process" ? "⬭" : "▭"} ${thing.name}`;
  const state = model.states.get(entityId);
  if (state) {
    const parent = model.things.get(state.parent);
    return `● ${parent?.name ?? "?"}.${state.name}`;
  }
  const link = model.links.get(entityId);
  if (link) {
    const src = model.things.get(link.source);
    const tgt = model.things.get(link.target);
    return `→ ${src?.name ?? "?"} — ${link.type} — ${tgt?.name ?? "?"}`;
  }
  return entityId;
}

function thingLabel(model: Model, thingId: string): string {
  const thing = model.things.get(thingId);
  return thing ? `${thing.kind === "process" ? "⬭" : "▭"} ${thing.name}` : thingId;
}

function visualFindingLabel(model: Model, finding: VisualFinding): string {
  switch (finding.kind) {
    case "overlap":
      return `Overlap — ${thingLabel(model, finding.aThing)} × ${thingLabel(model, finding.bThing)}`;
    case "orphan":
      return `Orphan — ${thingLabel(model, finding.thing)}`;
    case "truncated-state": {
      const state = model.states.get(finding.state);
      const parent = model.things.get(finding.thing);
      return `Truncated state pill — ${parent?.name ?? finding.thing}.${state?.name ?? finding.state}`;
    }
    case "degenerate-bounds":
      return `Degenerate bounds — ${Math.round(finding.width)}×${Math.round(finding.height)} (ratio ${finding.aspectRatio.toFixed(1)})`;
    case "crowded-diagram":
      return `Crowded diagram — ${finding.nodeCount} nodes in ${Math.round(finding.width)}×${Math.round(finding.height)} (fill ${(finding.fillRatio * 100).toFixed(0)}%)`;
    case "tight-spacing":
      return `Tight spacing — ${thingLabel(model, finding.aThing)} ↔ ${thingLabel(model, finding.bThing)} (${finding.axis}-gap ${Math.round(finding.gap)}px)`;
    case "link-crossing":
      return `Link crossing — ${finding.aLink} × ${finding.bLink}`;
    case "label-cluster":
      return `Label cluster — ${finding.clusterSize} labels competing in one area`;
  }
}

function visualFindingEntity(finding: VisualFinding): string | null {
  switch (finding.kind) {
    case "overlap":
      return finding.aThing;
    case "orphan":
      return finding.thing;
    case "truncated-state":
      return finding.thing;
    case "degenerate-bounds":
      return null;
    case "crowded-diagram":
      return null;
    case "tight-spacing":
      return finding.aThing;
    case "link-crossing":
      return finding.aLink;
    case "label-cluster":
      return finding.linkIds[0] ?? null;
  }
}

function visualFindingKindLabel(kind: VisualFinding["kind"]): string {
  switch (kind) {
    case "overlap": return "Overlaps";
    case "orphan": return "Orphans";
    case "truncated-state": return "Truncated state pills";
    case "degenerate-bounds": return "Degenerate bounds";
    case "crowded-diagram": return "Crowded diagrams";
    case "tight-spacing": return "Tight spacing";
    case "link-crossing": return "Link crossings";
    case "label-cluster": return "Label clusters";
  }
}

function errorSeverity(err: InvariantError): Exclude<SeverityFilter, "all"> {
  return (err.severity ?? "error") as Exclude<SeverityFilter, "all">;
}

function severityColor(severity: VisualFindingReportItem["severity"]): string {
  switch (severity) {
    case "error": return "var(--error, #e53e3e)";
    case "warning": return "var(--warning, #dd6b20)";
    case "info": return "var(--text-dim)";
  }
}

function gradeColor(grade: VisualOpdReport["grade"]): string {
  switch (grade) {
    case "A": return "var(--success)";
    case "F": return "var(--error, #e53e3e)";
    default: return "var(--text)";
  }
}

export function formatValidationMessage(err: InvariantError): string {
  if (err.code === "I-GERUND") {
    return "Process name should use accepted process naming: English may use a word ending in -ing; Spanish uses the first word ending in -ando/-iendo/-ción.";
  }
  return err.message;
}

export function ValidationPanel({
  model,
  currentOpd,
  errors,
  visualFindings = [],
  dispatch,
  onClose,
  initialTab = "issues",
}: Props) {
  const [tab, setTab] = useState<ValidationTab>(initialTab);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("current-opd");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const visualReport = useMemo(() => buildVisualReport(model), [model]);

  const filteredErrors = useMemo(() => {
    return errors.filter((err) => {
      const sev = errorSeverity(err);
      if (severityFilter !== "all" && sev !== severityFilter) return false;
      if (scopeFilter === "current-opd") {
        if (!err.entity) return false;
        return findOpdForEntity(model, err.entity) === currentOpd;
      }
      return true;
    });
  }, [errors, severityFilter, scopeFilter, model, currentOpd]);

  const filteredVisualFindings = useMemo(() => {
    return visualFindings.filter((finding) => {
      const sev = visualFindingSeverity(finding);
      if (severityFilter !== "all" && sev !== severityFilter) return false;
      return true;
    });
  }, [visualFindings, severityFilter]);

  const errorCount = filteredErrors.filter((e) => errorSeverity(e) === "error").length;
  const warningCount = filteredErrors.filter((e) => errorSeverity(e) === "warning").length;
  const infoCount = filteredErrors.filter((e) => errorSeverity(e) === "info").length;
  const visualErrorCount = filteredVisualFindings.filter((f) => visualFindingSeverity(f) === "error").length;
  const visualWarningCount = filteredVisualFindings.filter((f) => visualFindingSeverity(f) === "warning").length;
  const visualInfoCount = filteredVisualFindings.filter((f) => visualFindingSeverity(f) === "info").length;

  const groupedVisualFindings = useMemo(() => {
    const order: VisualFinding["kind"][] = ["overlap", "orphan", "truncated-state", "degenerate-bounds", "crowded-diagram", "tight-spacing"];
    return order
      .map((kind) => ({ kind, items: filteredVisualFindings.filter((finding) => finding.kind === kind) }))
      .filter((group) => group.items.length > 0);
  }, [filteredVisualFindings]);

  const filteredReportOpds = useMemo(() => {
    return visualReport.opds.filter((opd) => {
      if (severityFilter !== "all") {
        const matching = opd.findings.filter((finding) => finding.severity === severityFilter);
        if (matching.length === 0) return false;
      }
      if (scopeFilter === "current-opd" && opd.opdId !== currentOpd) return false;
      return true;
    }).map((opd) => ({
      ...opd,
      findings: severityFilter === "all" ? opd.findings : opd.findings.filter((finding) => finding.severity === severityFilter),
    }));
  }, [visualReport, severityFilter, scopeFilter, currentOpd]);

  const downloadMarkdown = () => {
    const blob = new Blob([exportVisualReportMarkdown(visualReport)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(model.meta.name || "model").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-visual-report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClick = (err: InvariantError) => {
    if (!err.entity) return;
    const thingId = findThingForEntity(model, err.entity);
    const opdId = findOpdForEntity(model, err.entity);
    if (opdId) dispatch({ tag: "selectOpd", opdId });
    if (thingId) dispatch({ tag: "selectThing", thingId });
  };

  const handleVisualClick = (finding: VisualFinding) => {
    const entity = visualFindingEntity(finding);
    if (!entity) return;
    const opdId = findOpdForEntity(model, entity);
    if (opdId) dispatch({ tag: "selectOpd", opdId });
    dispatch({ tag: "selectThing", thingId: entity });
  };

  const navigateToReportFinding = (opdId: string, finding: VisualFindingReportItem) => {
    dispatch({ tag: "selectOpd", opdId });
    if (finding.primaryEntity) dispatch({ tag: "selectThing", thingId: finding.primaryEntity });
    onClose();
  };

  return (
    <div className="validation-panel">
      <div className="validation-panel__header">
        <div>
          <span className="validation-panel__title">Validation</span>
          <div className="validation-panel__subtitle">
            {tab === "issues"
              ? "Actionable model and visual issues for the current working context."
              : "Model-level visual quality report with per-OPD findings and export."}
          </div>
        </div>
        <button className="validation-panel__close" onClick={onClose}>×</button>
      </div>
      <div className="validation-panel__tabs">
        <button className={`validation-panel__tab${tab === "issues" ? " validation-panel__tab--active" : ""}`} onClick={() => setTab("issues")} title="Actionable findings you can inspect and navigate from">Issues</button>
        <button className={`validation-panel__tab${tab === "visual-report" ? " validation-panel__tab--active" : ""}`} onClick={() => setTab("visual-report")} title="Model-level visual quality by OPD, with export">Visual Report</button>
      </div>
      <div className="validation-panel__hint">
        {tab === "issues"
          ? "Use severity + scope filters to reduce noise while you work."
          : "Use severity + scope filters to inspect report slices or export the full markdown report."}
      </div>
      <div className="validation-panel__summary">
        <span className="validation-panel__chip validation-panel__chip--error">{errorCount} errors</span>
        <span className="validation-panel__chip validation-panel__chip--warning">{warningCount} warnings</span>
        <span className="validation-panel__chip validation-panel__chip--info">{infoCount} info</span>
        <span className="validation-panel__chip validation-panel__chip--visual">{tab === "issues" ? filteredVisualFindings.length : filteredReportOpds.reduce((sum, opd) => sum + opd.findings.length, 0)} visual</span>
        {tab === "issues" ? (
          <>
            {visualErrorCount > 0 && <span className="validation-panel__chip validation-panel__chip--error">{visualErrorCount} visual errors</span>}
            {visualWarningCount > 0 && <span className="validation-panel__chip validation-panel__chip--warning">{visualWarningCount} visual warnings</span>}
            {visualInfoCount > 0 && <span className="validation-panel__chip validation-panel__chip--info">{visualInfoCount} visual info</span>}
          </>
        ) : (
          <>
            <span className="validation-panel__chip validation-panel__chip--visual">Avg {visualReport.avgScore}</span>
            <span className="validation-panel__chip validation-panel__chip--visual">Best {visualReport.bestScore}</span>
            <span className="validation-panel__chip validation-panel__chip--visual">Worst {visualReport.worstScore}</span>
          </>
        )}
      </div>
      <div className="validation-panel__filters">
        <div className="validation-panel__filter-group">
          <button className={`validation-panel__filter-btn${severityFilter === "all" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setSeverityFilter("all")}>All</button>
          <button className={`validation-panel__filter-btn${severityFilter === "error" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setSeverityFilter("error")}>Errors</button>
          <button className={`validation-panel__filter-btn${severityFilter === "warning" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setSeverityFilter("warning")}>Warnings</button>
          <button className={`validation-panel__filter-btn${severityFilter === "info" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setSeverityFilter("info")}>Info</button>
        </div>
        <div className="validation-panel__filter-group">
          <button className={`validation-panel__filter-btn${scopeFilter === "current-opd" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setScopeFilter("current-opd")} title="Focus on the OPD you are currently editing">Current OPD</button>
          <button className={`validation-panel__filter-btn${scopeFilter === "all" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setScopeFilter("all")} title="Inspect issues across the whole model">Whole model</button>
          {tab === "visual-report" && <button className="validation-panel__filter-btn" onClick={downloadMarkdown}>Export MD</button>}
        </div>
      </div>
      <div className="validation-panel__list">
        {tab === "issues" ? (
          filteredErrors.length === 0 && filteredVisualFindings.length === 0 ? (
            <div className="validation-panel__ok">No issues for current filters</div>
          ) : (
            <>
              {filteredErrors.length > 0 && (
                <div className="validation-panel__section">
                  <div className="validation-panel__section-title">Model validation</div>
                  {filteredErrors.map((err, i) => (
                    <div
                      key={`err-${i}`}
                      className={`validation-panel__item validation-panel__item--${err.severity ?? "error"}${err.entity ? " validation-panel__item--clickable" : ""}`}
                      onClick={() => handleClick(err)}
                    >
                      <span className="validation-panel__code">{err.code}</span>
                      <span className="validation-panel__msg">{formatValidationMessage(err)}</span>
                      {err.entity && <span className="validation-panel__entity">{entityLabel(model, err.entity)}</span>}
                    </div>
                  ))}
                </div>
              )}

              {groupedVisualFindings.length > 0 && (
                <div className="validation-panel__section">
                  <div className="validation-panel__section-title">Visual validation</div>
                  {groupedVisualFindings.map((group) => (
                    <div key={group.kind} className="validation-panel__subsection">
                      <div className="validation-panel__subsection-title">
                        {visualFindingKindLabel(group.kind)}
                        <span className="validation-panel__subsection-count">{group.items.length}</span>
                      </div>
                      {group.items.map((finding, i) => {
                        const entity = visualFindingEntity(finding);
                        const severity = visualFindingSeverity(finding);
                        return (
                          <div
                            key={`${group.kind}-${i}`}
                            className={`validation-panel__item validation-panel__item--${severity}${entity ? " validation-panel__item--clickable" : ""}`}
                            onClick={() => handleVisualClick(finding)}
                          >
                            <span className="validation-panel__code">VISUAL</span>
                            <span className="validation-panel__msg">{visualFindingLabel(model, finding)}</span>
                            {entity && <span className="validation-panel__entity">{thingLabel(model, entity)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        ) : (
          filteredReportOpds.length === 0 ? (
            <div className="validation-panel__ok">No visual report findings for current filters</div>
          ) : (
            <div className="validation-panel__report-list">
              {filteredReportOpds.map((opd) => (
                <details key={opd.opdId} open={opd.opdId === currentOpd || opd.errors > 0} className="validation-panel__report-card">
                  <summary className="validation-panel__report-summary">
                    <div>
                      <div className="validation-panel__report-name">{opd.name}</div>
                      <div className="validation-panel__report-meta">
                        Grade <span style={{ color: gradeColor(opd.grade), fontWeight: 700 }}>{opd.grade}</span> · Score {opd.score} · {opd.findings.length} findings
                      </div>
                    </div>
                    <div className="validation-panel__report-metrics">{opd.errors}/{opd.warnings}/{opd.info}</div>
                  </summary>
                  <div className="validation-panel__report-findings">
                    {opd.findings.map((finding, index) => {
                      const clickable = Boolean(finding.primaryEntity);
                      return (
                        <button
                          key={`${opd.opdId}-${finding.kind}-${index}`}
                          type="button"
                          className="validation-panel__report-item"
                          onClick={() => clickable ? navigateToReportFinding(opd.opdId, finding) : undefined}
                          disabled={!clickable}
                          title={clickable ? "Go to affected thing in this OPD" : "Model-level finding without a direct entity target"}
                        >
                          <div className="validation-panel__report-item-head">
                            <div>
                              <span className="validation-panel__report-severity" style={{ color: severityColor(finding.severity) }}>{finding.severity}</span>
                              <span className="validation-panel__report-kind">{finding.kind}</span>
                            </div>
                            {finding.primaryEntity && <span className="validation-panel__entity">{thingLabel(model, finding.primaryEntity)}</span>}
                          </div>
                          <div className="validation-panel__msg">{finding.summary}</div>
                        </button>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
