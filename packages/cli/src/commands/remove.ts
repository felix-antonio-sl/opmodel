// packages/cli/src/commands/remove.ts
import {
  removeThing, removeState, removeLink, removeOPD,
  type Model,
} from "@opmodel/core";
import { handleResult, fatal } from "../format";
import { readModel, writeModel, resolveModelFile } from "../io";

interface RemoveOptions {
  file?: string;
  dryRun?: boolean;
}

interface CascadeSummary {
  things: number;
  states: number;
  links: number;
  opds: number;
  modifiers: number;
  appearances: number;
  [key: string]: number;
}

interface RemoveResult {
  id: string;
  type: string;
  dryRun: boolean;
  cascade: CascadeSummary;
}

function diffCascade(before: Model, after: Model): CascadeSummary {
  return {
    things: before.things.size - after.things.size,
    states: before.states.size - after.states.size,
    links: before.links.size - after.links.size,
    opds: before.opds.size - after.opds.size,
    modifiers: before.modifiers.size - after.modifiers.size,
    appearances: before.appearances.size - after.appearances.size,
  };
}

type RemoveHandler = (model: Model, id: string) => Model;

const handlers = new Map<string, RemoveHandler>([
  ["thing", (m, id) => handleResult(removeThing(m, id), { json: false })],
  ["state", (m, id) => handleResult(removeState(m, id), { json: false })],
  ["link", (m, id) => handleResult(removeLink(m, id), { json: false })],
  ["opd", (m, id) => handleResult(removeOPD(m, id), { json: false })],
]);

export function executeRemove(
  entityType: string,
  id: string,
  opts: RemoveOptions = {},
): RemoveResult {
  const handler = handlers.get(entityType);
  if (!handler) {
    fatal(`Unknown entity type: ${entityType}. Valid types: ${[...handlers.keys()].join(", ")}`);
  }

  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);
  const newModel = handler(model, id);
  const cascade = diffCascade(model, newModel);

  if (!opts.dryRun) {
    writeModel(newModel, filePath);
  }

  return { id, type: entityType, dryRun: opts.dryRun ?? false, cascade };
}
