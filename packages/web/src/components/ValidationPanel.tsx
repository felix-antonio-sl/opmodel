import { useMemo, useState } from "react";
import type { Model, InvariantError } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { visualFindingSeverity, type VisualFinding } from "../lib/visual-lint";

interface Props {
  model: Model;
  currentOpd: string;
  errors: InvariantError[];
  visualFindings?: VisualFinding[];
  dispatch: (cmd: Command) => boolean;
  onClose: () => void;
}

type SeverityFilter = "all" | "error" | "warning" | "info";
type ScopeFilter = "all" | "current-opd";

/** Find the first OPD where this entity has an appearance */
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
  }
}

function errorSeverity(err: InvariantError): Exclude<SeverityFilter, "all"> {
  return (err.severity ?? "error") as Exclude<SeverityFilter, "all">;
}

export function formatValidationMessage(err: InvariantError): string {
  if (err.code === "I-GERUND") {
    return "Process name should use accepted process naming: English may use a word ending in -ing; Spanish uses the first word ending in -ando/-iendo/-ción.";
  }
  return err.message;
}

export function ValidationPanel({ model, currentOpd, errors, visualFindings = [], dispatch, onClose }: Props) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("current-opd");

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
      if (scopeFilter === "current-opd") return true;
      return true;
    });
  }, [visualFindings, severityFilter, scopeFilter]);

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

  return (
    <div className="validation-panel">
      <div className="validation-panel__header">
        <span className="validation-panel__title">Validation</span>
        <button className="validation-panel__close" onClick={onClose}>×</button>
      </div>
      <div className="validation-panel__summary">
        <span className="validation-panel__chip validation-panel__chip--error">{errorCount} errors</span>
        <span className="validation-panel__chip validation-panel__chip--warning">{warningCount} warnings</span>
        <span className="validation-panel__chip validation-panel__chip--info">{infoCount} info</span>
        <span className="validation-panel__chip validation-panel__chip--visual">{filteredVisualFindings.length} visual</span>
        {visualErrorCount > 0 && <span className="validation-panel__chip validation-panel__chip--error">{visualErrorCount} visual errors</span>}
        {visualWarningCount > 0 && <span className="validation-panel__chip validation-panel__chip--warning">{visualWarningCount} visual warnings</span>}
        {visualInfoCount > 0 && <span className="validation-panel__chip validation-panel__chip--info">{visualInfoCount} visual info</span>}
      </div>
      <div className="validation-panel__filters">
        <div className="validation-panel__filter-group">
          <button className={`validation-panel__filter-btn${severityFilter === "all" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setSeverityFilter("all")}>All</button>
          <button className={`validation-panel__filter-btn${severityFilter === "error" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setSeverityFilter("error")}>Errors</button>
          <button className={`validation-panel__filter-btn${severityFilter === "warning" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setSeverityFilter("warning")}>Warnings</button>
          <button className={`validation-panel__filter-btn${severityFilter === "info" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setSeverityFilter("info")}>Info</button>
        </div>
        <div className="validation-panel__filter-group">
          <button className={`validation-panel__filter-btn${scopeFilter === "current-opd" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setScopeFilter("current-opd")}>Current OPD</button>
          <button className={`validation-panel__filter-btn${scopeFilter === "all" ? " validation-panel__filter-btn--active" : ""}`} onClick={() => setScopeFilter("all")}>Whole model</button>
        </div>
      </div>
      <div className="validation-panel__list">
        {filteredErrors.length === 0 && filteredVisualFindings.length === 0 ? (
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
        )}
      </div>
    </div>
  );
}
