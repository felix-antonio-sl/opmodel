// packages/cli/src/commands/list.ts
import type { Model, Kind, LinkType } from "@opmodel/core";
import { fatal } from "../format";
import { readModel, resolveModelFile } from "../io";

interface ListOptions {
  file?: string;
  kind?: Kind;
  parent?: string;
  type?: LinkType;
  tree?: boolean;
}

interface ListResult {
  entityType: string;
  entities: unknown[];
}

type ListHandler = (model: Model, opts: ListOptions) => unknown[];

const handlers = new Map<string, ListHandler>([
  ["things", (model, opts) => {
    let items = [...model.things.values()];
    if (opts.kind) items = items.filter(t => t.kind === opts.kind);
    return items;
  }],
  ["states", (model, opts) => {
    let items = [...model.states.values()];
    if (opts.parent) items = items.filter(s => s.parent === opts.parent);
    return items;
  }],
  ["links", (model, opts) => {
    let items = [...model.links.values()];
    if (opts.type) items = items.filter(l => l.type === opts.type);
    return items;
  }],
  ["opds", (model) => {
    return [...model.opds.values()];
  }],
]);

export function executeList(
  collection: string,
  opts: ListOptions = {},
): ListResult {
  const handler = handlers.get(collection);
  if (!handler) {
    fatal(`Unknown collection: ${collection}. Valid: ${[...handlers.keys()].join(", ")}`);
  }

  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);
  const entities = handler(model, opts);
  return { entityType: collection, entities };
}
