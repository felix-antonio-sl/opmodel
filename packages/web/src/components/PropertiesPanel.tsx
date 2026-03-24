import type { Model, Thing, State, Link, LinkType, FanType, ModifierType, RefinementType, OPD, Duration, TimeUnit, ValueType, FunctionType, ComputationalObject, ComputationalProcess } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { genId } from "../lib/ids";

const TIME_UNITS: TimeUnit[] = ["ms", "s", "min", "h", "d"];

function formatDuration(d: Duration): string {
  const parts: string[] = [];
  if (d.min != null) parts.push(String(d.min));
  parts.push(String(d.nominal));
  if (d.max != null) parts.push(String(d.max));
  return parts.join("–") + " " + d.unit;
}

function DurationSection({
  thing, dispatch,
}: {
  thing: Thing;
  dispatch: (cmd: Command) => boolean;
}) {
  const dur = thing.duration;

  const setDuration = (patch: Partial<Duration>) => {
    const current = thing.duration ?? { nominal: 1, unit: "min" as TimeUnit };
    dispatch({
      tag: "updateThingProps",
      thingId: thing.id,
      patch: { duration: { ...current, ...patch } },
    });
  };

  const removeDuration = () => {
    dispatch({
      tag: "updateThingProps",
      thingId: thing.id,
      patch: { duration: null } as any,
    });
  };

  if (!dur) {
    return (
      <div className="props-panel__section">
        <button
          className="props-panel__add-btn"
          onClick={() => setDuration({ nominal: 1, unit: "min" })}
        >
          + Duration
        </button>
      </div>
    );
  }

  return (
    <div className="props-panel__section">
      <div className="props-panel__states-header">
        <span className="props-panel__label">Duration</span>
        <button className="props-panel__remove-btn" onClick={removeDuration}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr auto 1fr auto", gap: 3, alignItems: "center", marginTop: 2 }}>
        <span style={{ fontSize: 8, color: "var(--text-muted)" }}>mn</span>
        <input
          className="props-panel__input"
          style={{ width: "100%", fontSize: 10 }}
          type="number"
          step="any"
          min={0}
          title="Minimum duration"
          value={dur.min ?? ""}
          onChange={(e) => setDuration({ min: e.target.value ? Number(e.target.value) : undefined })}
        />
        <span style={{ fontSize: 8, color: "var(--text-muted)" }}>nom</span>
        <input
          className="props-panel__input"
          style={{ width: "100%", fontSize: 10 }}
          type="number"
          step="any"
          min={0}
          title="Nominal duration"
          value={dur.nominal}
          onChange={(e) => setDuration({ nominal: Number(e.target.value) || 0 })}
        />
        <span style={{ fontSize: 8, color: "var(--text-muted)" }}>mx</span>
        <input
          className="props-panel__input"
          style={{ width: "100%", fontSize: 10 }}
          type="number"
          step="any"
          min={0}
          title="Maximum duration"
          value={dur.max ?? ""}
          onChange={(e) => setDuration({ max: e.target.value ? Number(e.target.value) : undefined })}
        />
        <select
          className="props-panel__select"
          style={{ fontSize: 10, minWidth: 36 }}
          value={dur.unit}
          onChange={(e) => setDuration({ unit: e.target.value as TimeUnit })}
        >
          {TIME_UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

const VALUE_TYPES: ValueType[] = ["integer", "float", "string", "character", "boolean"];
const FUNCTION_TYPES: FunctionType[] = ["predefined", "user_defined"];

function ComputationalSection({
  thing, dispatch,
}: {
  thing: Thing;
  dispatch: (cmd: Command) => boolean;
}) {
  const comp = thing.computational;
  const isObject = thing.kind === "object";

  const setComputational = (val: ComputationalObject | ComputationalProcess) => {
    dispatch({
      tag: "updateThingProps",
      thingId: thing.id,
      patch: { computational: val },
    });
  };

  const removeComputational = () => {
    dispatch({
      tag: "updateThingProps",
      thingId: thing.id,
      patch: { computational: null } as any,
    });
  };

  if (!comp) {
    return (
      <div className="props-panel__section">
        <button
          className="props-panel__add-btn"
          onClick={() => {
            if (isObject) {
              setComputational({ value: 0, value_type: "integer" });
            } else {
              setComputational({ function_type: "predefined" });
            }
          }}
        >
          + Computational
        </button>
      </div>
    );
  }

  // Discriminate between ComputationalObject and ComputationalProcess
  const isCompObj = "value_type" in comp;

  if (isCompObj) {
    const co = comp as ComputationalObject;
    return (
      <div className="props-panel__section">
        <div className="props-panel__states-header">
          <span className="props-panel__label">Computational</span>
          <button className="props-panel__remove-btn" onClick={removeComputational}>×</button>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
          <select
            className="props-panel__select"
            style={{ fontSize: 10, minWidth: 60 }}
            value={co.value_type}
            onChange={(e) => setComputational({ ...co, value_type: e.target.value as ValueType })}
          >
            {VALUE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            className="props-panel__input"
            style={{ width: 50, fontSize: 10 }}
            placeholder="value"
            title="Value"
            value={co.value != null ? String(co.value) : ""}
            onChange={(e) => {
              let v: unknown = e.target.value;
              if (co.value_type === "integer") v = parseInt(e.target.value) || 0;
              else if (co.value_type === "float") v = parseFloat(e.target.value) || 0;
              else if (co.value_type === "boolean") v = e.target.value === "true";
              setComputational({ ...co, value: v });
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
          <input
            className="props-panel__input"
            style={{ width: 50, fontSize: 10 }}
            placeholder="unit"
            title="Measurement unit"
            value={co.unit ?? ""}
            onChange={(e) => setComputational({ ...co, unit: e.target.value || undefined })}
          />
          <input
            className="props-panel__input"
            style={{ width: 40, fontSize: 10 }}
            placeholder="alias"
            title="Short alias for calculations"
            value={co.alias ?? ""}
            onChange={(e) => setComputational({ ...co, alias: e.target.value || undefined })}
          />
        </div>
      </div>
    );
  }

  // ComputationalProcess
  const cp = comp as ComputationalProcess;
  return (
    <div className="props-panel__section">
      <div className="props-panel__states-header">
        <span className="props-panel__label">Computational</span>
        <button className="props-panel__remove-btn" onClick={removeComputational}>×</button>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
        <select
          className="props-panel__select"
          style={{ fontSize: 10, minWidth: 80 }}
          value={cp.function_type}
          onChange={(e) => setComputational({ ...cp, function_type: e.target.value as FunctionType })}
        >
          {FUNCTION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          className="props-panel__input"
          style={{ flex: 1, fontSize: 10 }}
          placeholder="function name"
          value={cp.function_name ?? ""}
          onChange={(e) => setComputational({ ...cp, function_name: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}

const LINK_TYPES: LinkType[] = [
  "agent", "instrument",
  "consumption", "effect", "result", "input", "output",
  "aggregation", "exhibition", "generalization", "classification",
  "invocation", "exception",
];

interface Props {
  model: Model;
  thingId: string;
  opdId: string;
  dispatch: (cmd: Command) => boolean;
}

function statesOf(model: Model, thingId: string): State[] {
  return [...model.states.values()]
    .filter((s) => s.parent === thingId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function linksOf(model: Model, thingId: string): Link[] {
  return [...model.links.values()]
    .filter((l) => l.source === thingId || l.target === thingId);
}

function refinementsOf(model: Model, thingId: string, opdId: string): OPD[] {
  return [...model.opds.values()]
    .filter((o) => o.refines === thingId && o.parent_opd === opdId);
}

function nextChildOpdName(model: Model, parentOpdId: string): string {
  const parentOpd = model.opds.get(parentOpdId);
  const parentName = parentOpd?.name ?? "SD";
  let maxN = 0;
  for (const opd of model.opds.values()) {
    if (opd.parent_opd === parentOpdId) maxN++;
  }
  const sep = /\d$/.test(parentName) ? "." : "";
  return `${parentName}${sep}${maxN + 1}`;
}

function StateRow({
  state, dispatch, isSuppressed, onToggleSuppression,
}: {
  state: State;
  dispatch: (cmd: Command) => boolean;
  isSuppressed: boolean;
  onToggleSuppression: () => void;
}) {
  return (
    <div className="props-panel__state-row" style={isSuppressed ? { opacity: 0.5 } : undefined}>
      <label className="props-panel__state-flag" title={isSuppressed ? "Show in OPD" : "Hide in OPD"}>
        <input
          type="checkbox"
          checked={!isSuppressed}
          onChange={onToggleSuppression}
        />
        V
      </label>
      <input
        className="props-panel__state-input"
        value={state.name}
        onChange={(e) =>
          dispatch({ tag: "updateState", stateId: state.id, patch: { name: e.target.value } })
        }
      />
      <label className="props-panel__state-flag" title="Initial">
        <input
          type="checkbox"
          checked={state.initial}
          onChange={(e) =>
            dispatch({ tag: "updateState", stateId: state.id, patch: { initial: e.target.checked } })
          }
        />
        I
      </label>
      <label className="props-panel__state-flag" title="Final">
        <input
          type="checkbox"
          checked={state.final}
          onChange={(e) =>
            dispatch({ tag: "updateState", stateId: state.id, patch: { final: e.target.checked } })
          }
        />
        F
      </label>
      <label className="props-panel__state-flag" title="Default">
        <input
          type="checkbox"
          checked={state.default}
          onChange={(e) =>
            dispatch({ tag: "updateState", stateId: state.id, patch: { default: e.target.checked } })
          }
        />
        D
      </label>
      <button
        className="props-panel__remove-btn"
        onClick={() => dispatch({ tag: "removeState", stateId: state.id })}
      >
        ×
      </button>
    </div>
  );
}

function isInOwnRefinementTree(model: Model, thingId: string, opdId: string): boolean {
  let id: string | null = opdId;
  while (id) {
    const opd = model.opds.get(id);
    if (!opd) break;
    if (opd.refines === thingId) return true;
    id = opd.parent_opd;
  }
  return false;
}

const FAN_TYPES: FanType[] = ["xor", "or", "and"];

function FanSection({
  model, thingId, links, dispatch,
}: {
  model: Model; thingId: string; links: Link[];
  dispatch: (cmd: Command) => boolean;
}) {
  // Find fans that involve links of this thing
  const thingLinkIds = new Set(links.map(l => l.id));
  const fansForThing = [...model.fans.values()].filter(
    f => f.members.some(mid => thingLinkIds.has(mid))
  );

  // Detect fan-eligible groups: 2+ links of same type sharing an endpoint
  // Group by (linkType, sharedEndpoint) where sharedEndpoint can be thingId itself
  // (converging: multiple objects → this process) or otherEnd (diverging: this process → multiple objects)
  const linkGroups = new Map<string, Link[]>();
  for (const l of links) {
    // Two grouping modes: by source (all share source) or by target (all share target)
    const keySrc = `${l.type}::src::${l.source}`;
    const keyTgt = `${l.type}::tgt::${l.target}`;
    if (!linkGroups.has(keySrc)) linkGroups.set(keySrc, []);
    linkGroups.get(keySrc)!.push(l);
    if (keySrc !== keyTgt) {
      if (!linkGroups.has(keyTgt)) linkGroups.set(keyTgt, []);
      linkGroups.get(keyTgt)!.push(l);
    }
  }
  // Deduplicate: a link may appear in both src and tgt groups. Keep only groups with 2+ unique links.
  const seenLinkSets = new Set<string>();
  const candidates = [...linkGroups.entries()]
    .filter(([, group]) => group.length >= 2)
    .filter(([, group]) => {
      // Deduplicate by sorted member IDs
      const sig = group.map(l => l.id).sort().join(",");
      if (seenLinkSets.has(sig)) return false;
      seenLinkSets.add(sig);
      return true;
    })
    .filter(([, group]) => {
      // Exclude groups already in a fan
      const memberIds = new Set(group.map(l => l.id));
      return !fansForThing.some(f => {
        const fanMemberSet = new Set(f.members);
        // Check if this fan covers these exact links
        return group.every(l => fanMemberSet.has(l.id));
      });
    });

  if (fansForThing.length === 0 && candidates.length === 0) return null;

  return (
    <div className="props-panel__section">
      <span className="props-panel__label">Fans</span>
      {fansForThing.map(f => {
        const memberNames = f.members.map(mid => {
          const link = model.links.get(mid);
          if (!link) return mid;
          const otherId = link.source === thingId ? link.target : link.source;
          return model.things.get(otherId)?.name ?? otherId;
        });
        return (
          <div key={f.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <select
                className="props-panel__select"
                style={{ fontSize: 10, minWidth: 50 }}
                value={f.type}
                onChange={(e) =>
                  dispatch({ tag: "updateFan", fanId: f.id, patch: { type: e.target.value as FanType } })
                }
              >
                {FAN_TYPES.map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
              <span style={{ fontSize: 9, color: "var(--text-muted)", flex: 1 }}>
                {memberNames.join(", ")}
              </span>
              <button
                className="props-panel__remove-btn"
                onClick={() => dispatch({ tag: "removeFan", fanId: f.id })}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
      {candidates.map(([key, group]) => {
        const firstLink = group[0]!;
        const memberNames = group.map(l => {
          const otherId = l.source === thingId ? l.target : l.source;
          return model.things.get(otherId)?.name ?? otherId;
        });
        return (
          <div key={key} style={{ padding: "2px 0" }}>
            <button
              style={{ fontSize: 9, cursor: "pointer", color: "var(--text-link)" }}
              onClick={() => dispatch({
                tag: "addFan",
                fan: {
                  id: genId("fan"),
                  type: "xor",
                  members: group.map(l => l.id),
                },
              })}
            >
              + Fan {firstLink.type} ({memberNames.join(", ")})
            </button>
          </div>
        );
      })}
    </div>
  );
}

function RefineSection({
  model, thingId, opdId, thing, dispatch,
}: {
  model: Model; thingId: string; opdId: string; thing: Thing;
  dispatch: (cmd: Command) => boolean;
}) {
  const existing = refinementsOf(model, thingId, opdId);
  const parentOpd = model.opds.get(opdId);
  // Only hierarchical OPDs can be refined (not views)
  if (!parentOpd || parentOpd.opd_type !== "hierarchical") return null;

  const appKey = `${thingId}::${opdId}`;
  const app = model.appearances.get(appKey);

  // I-REFINE-EXT: external appearances (pullback projections) cannot be refined
  const isExternal = app?.internal === false;
  // I-REFINE-CYCLE: cannot refine from within the thing's own refinement tree
  const isCyclic = isInOwnRefinementTree(model, thingId, opdId);
  const blocked = isExternal || isCyclic;

  const handleRefine = (refinementType: RefinementType) => {
    const childOpdId = genId("opd");
    const childOpdName = nextChildOpdName(model, opdId);
    const ok = dispatch({
      tag: "refineThing", thingId, opdId,
      refinementType, childOpdId, childOpdName,
    });
    if (ok) {
      dispatch({ tag: "selectOpd", opdId: childOpdId });
    }
  };

  const canUnfold = thing.kind === "object";
  const hasInZoom = existing.some((o) => o.refinement_type === "in-zoom");
  const hasUnfold = existing.some((o) => o.refinement_type === "unfold");

  return (
    <div className="props-panel__refine">
      <div className="props-panel__states-header">
        <span className="props-panel__label">Refinement</span>
        {!blocked && (
          <div className="props-panel__refine-actions">
            {!hasInZoom && (
              <button className="props-panel__add-btn" onClick={() => handleRefine("in-zoom")}>
                In-zoom
              </button>
            )}
            {canUnfold && !hasUnfold && (
              <button className="props-panel__add-btn" onClick={() => handleRefine("unfold")}>
                Unfold
              </button>
            )}
          </div>
        )}
      </div>
      {blocked && (
        <div className="props-panel__refine-hint">
          {isExternal ? "External — refine from parent OPD" : "Already refined in ancestor"}
        </div>
      )}
      {existing.map((o) => (
        <div
          key={o.id}
          className="props-panel__refine-row"
          onClick={() => dispatch({ tag: "selectOpd", opdId: o.id })}
        >
          <span className="props-panel__refine-type">{o.refinement_type}</span>
          <span>{o.name}</span>
          <span className="props-panel__refine-arrow">→</span>
        </div>
      ))}
    </div>
  );
}

export function PropertiesPanel({ model, thingId, opdId, dispatch }: Props) {
  const thing = model.things.get(thingId);
  if (!thing) return null;

  const states = statesOf(model, thingId);
  const links = linksOf(model, thingId);
  const appKey = `${thingId}::${opdId}`;
  const appearance = model.appearances.get(appKey);
  const suppressedStates = appearance?.suppressed_states ?? [];

  const toggleSuppression = (stateId: string) => {
    const newSuppressed = suppressedStates.includes(stateId)
      ? suppressedStates.filter((id) => id !== stateId)
      : [...suppressedStates, stateId];
    dispatch({
      tag: "updateAppearance",
      thingId,
      opdId,
      patch: { suppressed_states: newSuppressed.length > 0 ? newSuppressed : undefined },
    });
  };

  return (
    <div className="props-panel">
      <div className="props-panel__title">Properties</div>

      <div className="props-panel__section">
        <label className="props-panel__label">Name</label>
        <input
          className="props-panel__input"
          value={thing.name}
          onChange={(e) =>
            dispatch({ tag: "renameThing", thingId, name: e.target.value })
          }
        />
      </div>

      <div className="props-panel__row">
        <div className="props-panel__section">
          <label className="props-panel__label">Kind</label>
          <div className="props-panel__value">{thing.kind}</div>
        </div>
        <div className="props-panel__section">
          <label className="props-panel__label">Essence</label>
          <select
            className="props-panel__select"
            value={thing.essence}
            onChange={(e) =>
              dispatch({
                tag: "updateThingProps",
                thingId,
                patch: { essence: e.target.value as "physical" | "informatical" },
              })
            }
          >
            <option value="physical">physical</option>
            <option value="informatical">informatical</option>
          </select>
        </div>
      </div>

      <div className="props-panel__section">
        <label className="props-panel__label">Affiliation</label>
        <select
          className="props-panel__select"
          value={thing.affiliation}
          onChange={(e) =>
            dispatch({
              tag: "updateThingProps",
              thingId,
              patch: { affiliation: e.target.value as "systemic" | "environmental" },
            })
          }
        >
          <option value="systemic">systemic</option>
          <option value="environmental">environmental</option>
        </select>
      </div>

      {/* Duration — only for processes */}
      {thing.kind === "process" && (
        <DurationSection thing={thing} dispatch={dispatch} />
      )}

      {/* Computational — objects get value/type/unit, processes get function */}
      <ComputationalSection thing={thing} dispatch={dispatch} />

      {/* States section — only for objects */}
      {thing.kind === "object" && (
        <div className="props-panel__states">
          <div className="props-panel__states-header">
            <span className="props-panel__label">States ({states.length})</span>
            <button
              className="props-panel__add-btn"
              onClick={() =>
                dispatch({
                  tag: "addState",
                  state: {
                    id: genId("state"),
                    parent: thingId,
                    name: `state${states.length + 1}`,
                    initial: states.length === 0,
                    final: false,
                    default: states.length === 0,
                  },
                })
              }
            >
              + State
            </button>
          </div>
          {states.map((s) => (
            <StateRow
              key={s.id}
              state={s}
              dispatch={dispatch}
              isSuppressed={suppressedStates.includes(s.id)}
              onToggleSuppression={() => toggleSuppression(s.id)}
            />
          ))}
        </div>
      )}

      {/* Links — editable type, endpoints, states */}
      {links.length > 0 && (
        <div className="props-panel__section">
          <span className="props-panel__label">Links ({links.length})</span>
          {links.map((l) => {
            const sourceThing = model.things.get(l.source);
            const targetThing = model.things.get(l.target);
            const sourceStates = sourceThing?.kind === "object" ? statesOf(model, l.source) : [];
            const targetStates = targetThing?.kind === "object" ? statesOf(model, l.target) : [];
            const allThings = [...model.things.values()];

            return (
              <div key={l.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <div className="props-panel__link-row">
                  {/* Link type selector */}
                  <select
                    className="props-panel__select"
                    style={{ fontSize: 10, minWidth: 80 }}
                    value={l.type}
                    onChange={(e) =>
                      dispatch({ tag: "updateLink", linkId: l.id, patch: { type: e.target.value as LinkType } })
                    }
                  >
                    {LINK_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    className="props-panel__remove-btn"
                    onClick={() => dispatch({ tag: "removeLink", linkId: l.id })}
                  >
                    ×
                  </button>
                </div>
                {/* Source selector */}
                <div style={{ display: "flex", gap: 4, marginTop: 2, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", minWidth: 20 }}>src</span>
                  <select
                    className="props-panel__select"
                    style={{ flex: 1, fontSize: 10 }}
                    value={l.source}
                    onChange={(e) =>
                      dispatch({ tag: "updateLink", linkId: l.id, patch: { source: e.target.value, source_state: undefined } })
                    }
                  >
                    {allThings.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {sourceStates.length > 0 && (
                    <select
                      className="props-panel__select"
                      style={{ fontSize: 9, maxWidth: 70 }}
                      value={l.source_state ?? ""}
                      onChange={(e) =>
                        dispatch({ tag: "updateLink", linkId: l.id, patch: { source_state: e.target.value || undefined } })
                      }
                    >
                      <option value="">(any)</option>
                      {sourceStates.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Target selector */}
                <div style={{ display: "flex", gap: 4, marginTop: 2, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", minWidth: 20 }}>tgt</span>
                  <select
                    className="props-panel__select"
                    style={{ flex: 1, fontSize: 10 }}
                    value={l.target}
                    onChange={(e) =>
                      dispatch({ tag: "updateLink", linkId: l.id, patch: { target: e.target.value, target_state: undefined } })
                    }
                  >
                    {allThings.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {targetStates.length > 0 && (
                    <select
                      className="props-panel__select"
                      style={{ fontSize: 9, maxWidth: 70 }}
                      value={l.target_state ?? ""}
                      onChange={(e) =>
                        dispatch({ tag: "updateLink", linkId: l.id, patch: { target_state: e.target.value || undefined } })
                      }
                    >
                      <option value="">(any)</option>
                      {targetStates.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Multiplicity */}
                <div style={{ display: "flex", gap: 4, marginTop: 2, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "var(--text-muted)" }}>mult</span>
                  <input
                    className="props-panel__input"
                    style={{ width: 36, fontSize: 9 }}
                    placeholder="src"
                    title="Source multiplicity (?, *, +, m..n)"
                    value={l.multiplicity_source ?? ""}
                    onChange={(e) =>
                      dispatch({ tag: "updateLink", linkId: l.id, patch: { multiplicity_source: e.target.value || undefined } })
                    }
                  />
                  <span style={{ fontSize: 9, color: "var(--text-muted)" }}>→</span>
                  <input
                    className="props-panel__input"
                    style={{ width: 36, fontSize: 9 }}
                    placeholder="tgt"
                    title="Target multiplicity (?, *, +, m..n)"
                    value={l.multiplicity_target ?? ""}
                    onChange={(e) =>
                      dispatch({ tag: "updateLink", linkId: l.id, patch: { multiplicity_target: e.target.value || undefined } })
                    }
                  />
                </div>
                {/* Rate — for procedural links */}
                {["consumption", "result", "effect", "input", "output", "agent", "instrument"].includes(l.type) && (
                  <div style={{ display: "flex", gap: 4, marginTop: 2, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>rate</span>
                    <input
                      className="props-panel__input"
                      style={{ width: 40, fontSize: 9 }}
                      type="number"
                      step="any"
                      min={0}
                      placeholder="val"
                      title="Rate value"
                      value={l.rate?.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        dispatch({
                          tag: "updateLink", linkId: l.id,
                          patch: { rate: val != null ? { value: val, unit: l.rate?.unit ?? "/s" } : undefined },
                        });
                      }}
                    />
                    <input
                      className="props-panel__input"
                      style={{ width: 30, fontSize: 9 }}
                      placeholder="/s"
                      title="Rate unit"
                      value={l.rate?.unit ?? ""}
                      onChange={(e) => {
                        if (l.rate) {
                          dispatch({
                            tag: "updateLink", linkId: l.id,
                            patch: { rate: { ...l.rate, unit: e.target.value || "/s" } },
                          });
                        }
                      }}
                    />
                  </div>
                )}
                {/* Exception type — only for exception links */}
                {l.type === "exception" && (
                  <div style={{ display: "flex", gap: 4, marginTop: 2, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>exception</span>
                    <select
                      className="props-panel__select"
                      style={{ fontSize: 10, minWidth: 70 }}
                      value={l.exception_type ?? "overtime"}
                      onChange={(e) =>
                        dispatch({ tag: "updateLink", linkId: l.id, patch: { exception_type: e.target.value as "overtime" | "undertime" } })
                      }
                    >
                      <option value="overtime">overtime</option>
                      <option value="undertime">undertime</option>
                    </select>
                  </div>
                )}
                {/* Modifiers (event/condition) */}
                {(() => {
                  const mods = [...model.modifiers.values()].filter(m => m.over === l.id);
                  return (
                    <div style={{ marginTop: 2 }}>
                      {mods.map(mod => (
                        <div key={mod.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 9, marginTop: 2 }}>
                          <span style={{
                            display: "inline-block", width: 14, height: 14, borderRadius: "50%", textAlign: "center", lineHeight: "14px",
                            color: "white", fontWeight: "bold", fontSize: 8,
                            background: mod.type === "event" ? "#d69e2e" : mod.condition_mode === "skip" ? "#c05621" : "#3182ce",
                          }}>
                            {mod.type === "event" ? "e" : "c"}
                          </span>
                          {mod.type === "condition" && (
                            <select
                              className="props-panel__select"
                              style={{ fontSize: 9, minWidth: 50 }}
                              value={mod.condition_mode ?? "wait"}
                              onChange={(e) =>
                                dispatch({ tag: "updateModifier", modifierId: mod.id, patch: { condition_mode: e.target.value as "skip" | "wait" } })
                              }
                            >
                              <option value="wait">wait</option>
                              <option value="skip">skip</option>
                            </select>
                          )}
                          <label style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <input type="checkbox" checked={mod.negated ?? false}
                              onChange={(e) => dispatch({ tag: "updateModifier", modifierId: mod.id, patch: { negated: e.target.checked || undefined } })} />
                            neg
                          </label>
                          <button className="props-panel__remove-btn"
                            onClick={() => dispatch({ tag: "removeModifier", modifierId: mod.id })}>×</button>
                        </div>
                      ))}
                      {mods.length === 0 && !["aggregation", "exhibition", "generalization", "classification", "tagged"].includes(l.type) && (
                        <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                          <button style={{ fontSize: 8, cursor: "pointer", color: "#d69e2e" }}
                            onClick={() => dispatch({ tag: "addModifier", modifier: { id: genId("mod"), over: l.id, type: "event" } })}>
                            +event
                          </button>
                          <button style={{ fontSize: 8, cursor: "pointer", color: "#3182ce" }}
                            onClick={() => dispatch({ tag: "addModifier", modifier: { id: genId("mod"), over: l.id, type: "condition", condition_mode: "wait" } })}>
                            +condition
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Fans — group links into XOR/OR/AND */}
      <FanSection model={model} thingId={thingId} links={links} dispatch={dispatch} />

      {/* Semi-fold toggle — only for objects with structural children */}
      {thing.kind === "object" && (() => {
        const hasStructural = links.some(l =>
          (l.type === "aggregation" && l.source === thingId) ||
          (l.type === "exhibition" && (l.target === thingId || l.source === thingId))
        );
        if (!hasStructural) return null;
        return (
          <div className="props-panel__section">
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <input
                type="checkbox"
                checked={appearance?.semi_folded ?? false}
                onChange={(e) =>
                  dispatch({
                    tag: "updateAppearance",
                    thingId,
                    opdId,
                    patch: { semi_folded: e.target.checked ? true : null },
                  })
                }
              />
              Semi-fold
            </label>
          </div>
        );
      })()}

      {/* Refinement section */}
      <RefineSection model={model} thingId={thingId} opdId={opdId} thing={thing} dispatch={dispatch} />

      {/* DA-9: Bring Connected Things */}
      {(() => {
        // Count connected things without appearance in this OPD
        const existingApps = new Set<string>();
        for (const app of model.appearances.values()) {
          if (app.opd === opdId) existingApps.add(app.thing);
        }
        let connectedCount = 0;
        for (const link of model.links.values()) {
          if (link.source === thingId && !existingApps.has(link.target)) connectedCount++;
          if (link.target === thingId && !existingApps.has(link.source)) connectedCount++;
        }
        if (connectedCount === 0) return null;
        return (
          <div className="props-panel__section">
            <button
              className="props-panel__add-btn"
              onClick={() => dispatch({ tag: "bringConnected", thingId, opdId, filter: "all" })}
            >
              + Bring Connected ({connectedCount})
            </button>
          </div>
        );
      })()}

      {/* Requirements on this thing */}
      {(() => {
        const reqs = [...model.requirements.values()].filter(r => r.target === thingId);
        return (
          <div className="props-panel__section">
            <label className="props-panel__label">Requirements ({reqs.length})</label>
            {reqs.map(r => (
              <div key={r.id} className="props-panel__req-row">
                <input
                  className="props-panel__input props-panel__input--sm"
                  value={r.name}
                  onChange={(e) => dispatch({ tag: "updateRequirement", requirementId: r.id, patch: { name: e.target.value } })}
                  placeholder="Requirement name"
                />
                <button className="props-panel__remove-btn" onClick={() => dispatch({ tag: "removeRequirement", requirementId: r.id })}>✕</button>
              </div>
            ))}
            <button
              className="props-panel__add-btn"
              onClick={() => {
                const id = `req-${Date.now().toString(36)}`;
                dispatch({ tag: "addRequirement", requirement: { id, target: thingId, name: "New Requirement" } });
              }}
            >
              + Requirement
            </button>
          </div>
        );
      })()}

      {/* Assertions on this thing */}
      {(() => {
        const asserts = [...model.assertions.values()].filter(a => a.target === thingId);
        return (
          <div className="props-panel__section">
            <label className="props-panel__label">Assertions ({asserts.length})</label>
            {asserts.map(a => (
              <div key={a.id} className="props-panel__req-row">
                <input
                  className="props-panel__input props-panel__input--sm"
                  value={a.predicate}
                  onChange={(e) => dispatch({ tag: "updateAssertion", assertionId: a.id, patch: { predicate: e.target.value } })}
                  placeholder="Predicate"
                />
                <select
                  className="props-panel__select props-panel__select--sm"
                  value={a.category}
                  onChange={(e) => dispatch({ tag: "updateAssertion", assertionId: a.id, patch: { category: e.target.value as any } })}
                >
                  <option value="safety">Safety</option>
                  <option value="liveness">Liveness</option>
                  <option value="correctness">Correctness</option>
                </select>
                <button className="props-panel__remove-btn" onClick={() => dispatch({ tag: "removeAssertion", assertionId: a.id })}>✕</button>
              </div>
            ))}
            <button
              className="props-panel__add-btn"
              onClick={() => {
                const id = `assert-${Date.now().toString(36)}`;
                dispatch({ tag: "addAssertion", assertion: { id, target: thingId, predicate: "New assertion", category: "safety", enabled: true } });
              }}
            >
              + Assertion
            </button>
          </div>
        );
      })()}

      {/* Stereotypes on this thing (M-05) */}
      {(() => {
        const stps = [...model.stereotypes.values()].filter(s => s.thing === thingId);
        return (
          <div className="props-panel__section">
            <label className="props-panel__label">Stereotypes ({stps.length})</label>
            {stps.map(s => (
              <div key={s.id} className="props-panel__req-row">
                <span style={{ fontSize: 10, flex: 1 }}>«{s.stereotype_id}»{s.global ? " (global)" : ""}</span>
                <button className="props-panel__remove-btn" onClick={() => dispatch({ tag: "removeStereotype", stereotypeId: s.id })}>✕</button>
              </div>
            ))}
            <button
              className="props-panel__add-btn"
              onClick={() => {
                const id = `stp-${Date.now().toString(36)}`;
                const stpId = prompt("Stereotype identifier (e.g., agent, sensor, actuator):");
                if (stpId) dispatch({ tag: "addStereotype", stereotype: { id, thing: thingId, stereotype_id: stpId, global: false } });
              }}
            >
              + Stereotype
            </button>
          </div>
        );
      })()}

      <button
        className="props-panel__delete-btn"
        onClick={() => dispatch({ tag: "removeThing", thingId })}
      >
        Delete {thing.kind}
      </button>
    </div>
  );
}
