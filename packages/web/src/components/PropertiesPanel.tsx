import type { Model, Thing, State, Link } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { genId } from "../lib/ids";

interface Props {
  model: Model;
  thingId: string;
  opdId: string;
  dispatch: (cmd: Command) => void;
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
            <div key={s.id} className="props-panel__state-row">
              <span className="props-panel__state-name">{s.name}</span>
              <span className="props-panel__state-flags">
                {s.initial && "I"}
                {s.default && "D"}
                {s.current && "●"}
              </span>
              <button
                className="props-panel__remove-btn"
                onClick={() => dispatch({ tag: "removeState", stateId: s.id })}
              >
                ×
              </button>
            </div>
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

      <button
        className="props-panel__delete-btn"
        onClick={() => dispatch({ tag: "removeThing", thingId })}
      >
        Delete {thing.kind}
      </button>
    </div>
  );
}
