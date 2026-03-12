import type { Model, Thing, State, Link, RefinementType, OPD } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { genId } from "../lib/ids";

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

function StateRow({ state, dispatch }: { state: State; dispatch: (cmd: Command) => boolean }) {
  return (
    <div className="props-panel__state-row">
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
            <StateRow key={s.id} state={s} dispatch={dispatch} />
          ))}
        </div>
      )}

      {/* Links summary */}
      {links.length > 0 && (
        <div className="props-panel__section">
          <span className="props-panel__label">Links ({links.length})</span>
          {links.map((l) => {
            const other = l.source === thingId ? l.target : l.source;
            const otherName = model.things.get(other)?.name ?? other;
            const dir = l.source === thingId ? "→" : "←";
            return (
              <div key={l.id} className="props-panel__link-row">
                <span className="props-panel__link-type">{l.type}</span>
                <span>{dir} {otherName}</span>
                <button
                  className="props-panel__remove-btn"
                  onClick={() => dispatch({ tag: "removeLink", linkId: l.id })}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

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
