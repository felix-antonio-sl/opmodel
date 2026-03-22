import type { Model, Thing, State, Link, LinkType, FanType, ModifierType, RefinementType, OPD } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { genId } from "../lib/ids";

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
                      {mods.length === 0 && (
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
          (l.type === "exhibition" && l.target === thingId)
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
                    patch: { semi_folded: e.target.checked || undefined },
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

      <button
        className="props-panel__delete-btn"
        onClick={() => dispatch({ tag: "removeThing", thingId })}
      >
        Delete {thing.kind}
      </button>
    </div>
  );
}
