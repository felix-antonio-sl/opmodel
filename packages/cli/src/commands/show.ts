// packages/cli/src/commands/show.ts
import type { Model } from "@opmodel/core";
import { fatal } from "../format";
import { readModel, resolveModelFile } from "../io";

interface ShowOptions {
  file?: string;
}

interface ShowResult {
  entityType: string;
  entity: unknown;
  related?: {
    states?: unknown[];
    appearances?: unknown[];
  };
}

export function executeShow(id: string, opts: ShowOptions = {}): ShowResult {
  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);

  // Search P0 collections first
  if (model.things.has(id)) {
    const thing = model.things.get(id)!;
    const states = [...model.states.values()].filter(s => s.parent === id);
    return { entityType: "thing", entity: thing, related: { states } };
  }
  if (model.states.has(id)) {
    return { entityType: "state", entity: model.states.get(id)! };
  }
  if (model.links.has(id)) {
    return { entityType: "link", entity: model.links.get(id)! };
  }
  if (model.opds.has(id)) {
    const opd = model.opds.get(id)!;
    const appearances = [...model.appearances.values()].filter(a => a.opd === id);
    return { entityType: "opd", entity: opd, related: { appearances } };
  }

  // Search P1+ collections (fallback to JSON raw)
  const p1Collections: [string, Map<string, unknown>][] = [
    ["modifier", model.modifiers as Map<string, unknown>],
    ["fan", model.fans as Map<string, unknown>],
    ["scenario", model.scenarios as Map<string, unknown>],
    ["assertion", model.assertions as Map<string, unknown>],
    ["requirement", model.requirements as Map<string, unknown>],
    ["stereotype", model.stereotypes as Map<string, unknown>],
    ["subModel", model.subModels as Map<string, unknown>],
  ];
  for (const [type, collection] of p1Collections) {
    if (collection.has(id)) {
      return { entityType: type, entity: collection.get(id)! };
    }
  }

  fatal(`Entity not found: ${id}`);
}
