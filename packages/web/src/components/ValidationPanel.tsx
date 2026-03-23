import type { Model, InvariantError } from "@opmodel/core";
import type { Command } from "../lib/commands";

interface Props {
  model: Model;
  errors: InvariantError[];
  dispatch: (cmd: Command) => boolean;
  onClose: () => void;
}

/** Find the first OPD where this entity has an appearance */
function findOpdForEntity(model: Model, entityId: string): string | null {
  // Direct thing appearance
  for (const app of model.appearances.values()) {
    if (app.thing === entityId) return app.opd;
  }
  // Entity might be a state — find parent thing
  const state = model.states.get(entityId);
  if (state) {
    for (const app of model.appearances.values()) {
      if (app.thing === state.parent) return app.opd;
    }
  }
  // Entity might be a link — find source thing
  const link = model.links.get(entityId);
  if (link) {
    for (const app of model.appearances.values()) {
      if (app.thing === link.source) return app.opd;
    }
  }
  // Entity might be a modifier — find link source
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

/** Find the thing ID to select for a given entity */
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

export function ValidationPanel({ model, errors, dispatch, onClose }: Props) {
  const handleClick = (err: InvariantError) => {
    if (!err.entity) return;
    const thingId = findThingForEntity(model, err.entity);
    const opdId = findOpdForEntity(model, err.entity);
    if (opdId) dispatch({ tag: "selectOpd", opdId });
    if (thingId) dispatch({ tag: "selectThing", thingId });
  };

  return (
    <div className="validation-panel">
      <div className="validation-panel__header">
        <span className="validation-panel__title">
          Validation — {errors.length} {errors.length === 1 ? "error" : "errors"}
        </span>
        <button className="validation-panel__close" onClick={onClose}>×</button>
      </div>
      <div className="validation-panel__list">
        {errors.length === 0 ? (
          <div className="validation-panel__ok">All invariants satisfied</div>
        ) : (
          errors.map((err, i) => (
            <div
              key={i}
              className={`validation-panel__item${err.entity ? " validation-panel__item--clickable" : ""}`}
              onClick={() => handleClick(err)}
            >
              <span className="validation-panel__code">{err.code}</span>
              <span className="validation-panel__msg">{err.message}</span>
              {err.entity && (
                <span className="validation-panel__entity">
                  {entityLabel(model, err.entity)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
