// Compound State Space — Cartesian product of exhibited attributes
import type { Model, State } from "./types";

export interface CompoundStateEntry {
  attributes: Array<{ name: string; state: string }>;
}

/** Compute compound state space for an object (Cartesian product of its exhibited attributes' states) */
export function getCompoundStates(model: Model, objectId: string): CompoundStateEntry[] {
  // Find exhibited attributes (via exhibition links)
  const exhibitedIds: string[] = [];
  for (const link of model.links.values()) {
    if (link.type === "exhibition" && link.source === objectId) {
      const target = model.things.get(link.target);
      if (target?.kind === "object") exhibitedIds.push(link.target);
    }
  }

  if (exhibitedIds.length === 0) return [];

  // Collect states per attribute
  const attrStates: Array<{ name: string; states: string[] }> = [];
  for (const attrId of exhibitedIds) {
    const attr = model.things.get(attrId);
    if (!attr) continue;
    const states = [...model.states.values()]
      .filter(s => s.parent === attrId)
      .map(s => s.name);
    if (states.length > 0) {
      attrStates.push({ name: attr.name, states });
    }
  }

  if (attrStates.length === 0) return [];

  // Cartesian product
  const result: CompoundStateEntry[] = [];
  function generate(index: number, current: CompoundStateEntry["attributes"]) {
    if (index >= attrStates.length) {
      result.push({ attributes: [...current] });
      return;
    }
    const attr = attrStates[index]!;
    for (const state of attr.states) {
      current.push({ name: attr.name, state });
      generate(index + 1, current);
      current.pop();
    }
  }
  generate(0, []);
  return result;
}
