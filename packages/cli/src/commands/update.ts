// packages/cli/src/commands/update.ts
import {
  updateThing, updateState, updateLink, updateOPD, updateMeta, updateSettings,
  type Model, type Kind, type Essence, type Affiliation, type LinkType,
  type OpdType, type RefinementType, type SystemType,
} from "@opmodel/core";
import { handleResult, fatal } from "../format";
import { readModel, writeModel, resolveModelFile } from "../io";

interface UpdateOptions {
  file?: string;
  input?: string;
  json?: boolean;
  name?: string;
  kind?: Kind;
  essence?: Essence;
  affiliation?: Affiliation;
  parent?: string;
  initial?: boolean;
  final?: boolean;
  default?: boolean;
  type?: LinkType;
  source?: string;
  target?: string;
  sourceState?: string;
  targetState?: string;
  opdType?: OpdType;
  refines?: string;
  refinement?: RefinementType;
  description?: string;
  systemType?: SystemType;
}

interface UpdateResult {
  id?: string;
  type: string;
  entity: unknown;
}

function parseInputPatch<T>(input: string, entityType: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    fatal(`Invalid JSON input for ${entityType}: ${input.slice(0, 80)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fatal(`Input must be a JSON object for ${entityType}`);
  }
  const obj = parsed as Record<string, unknown>;
  delete obj.id;
  delete obj.thing;
  delete obj.opd;
  delete obj.created;
  delete obj.modified;
  return obj as T;
}

type UpdateHandler = (model: Model, id: string, opts: UpdateOptions) => { model: Model; result: UpdateResult };
type SingletonUpdateHandler = (model: Model, opts: UpdateOptions) => { model: Model; result: UpdateResult };

function handleUpdateThing(model: Model, id: string, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "thing");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.kind !== undefined) patch.kind = opts.kind;
    if (opts.essence !== undefined) patch.essence = opts.essence;
    if (opts.affiliation !== undefined) patch.affiliation = opts.affiliation;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateThing(model, id, patch as any), { json: !!opts.json });
  const entity = newModel.things.get(id);
  return { model: newModel, result: { id, type: "thing", entity } };
}

function handleUpdateState(model: Model, id: string, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "state");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.parent !== undefined) patch.parent = opts.parent;
    if (opts.initial !== undefined) patch.initial = opts.initial;
    if (opts.final !== undefined) patch.final = opts.final;
    if (opts.default !== undefined) patch.default = opts.default;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateState(model, id, patch as any), { json: !!opts.json });
  const entity = newModel.states.get(id);
  return { model: newModel, result: { id, type: "state", entity } };
}

function handleUpdateLink(model: Model, id: string, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "link");
  } else {
    patch = {};
    if (opts.type !== undefined) patch.type = opts.type;
    if (opts.source !== undefined) patch.source = opts.source;
    if (opts.target !== undefined) patch.target = opts.target;
    if (opts.sourceState !== undefined) patch.source_state = opts.sourceState;
    if (opts.targetState !== undefined) patch.target_state = opts.targetState;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateLink(model, id, patch as any), { json: !!opts.json });
  const entity = newModel.links.get(id);
  return { model: newModel, result: { id, type: "link", entity } };
}

function handleUpdateOPD(model: Model, id: string, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "opd");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.opdType !== undefined) patch.opd_type = opts.opdType;
    if (opts.parent !== undefined) patch.parent_opd = opts.parent;
    if (opts.refines !== undefined) patch.refines = opts.refines;
    if (opts.refinement !== undefined) patch.refinement_type = opts.refinement;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateOPD(model, id, patch as any), { json: !!opts.json });
  const entity = newModel.opds.get(id);
  return { model: newModel, result: { id, type: "opd", entity } };
}

function handleUpdateMeta(model: Model, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "meta");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.description !== undefined) patch.description = opts.description;
    if (opts.systemType !== undefined) patch.system_type = opts.systemType;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateMeta(model, patch as any), { json: !!opts.json });
  return { model: newModel, result: { type: "meta", entity: newModel.meta } };
}

function handleUpdateSettings(model: Model, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  if (!opts.input) fatal("Settings requires --input with JSON patch.");
  const patch = parseInputPatch(opts.input, "settings");
  const newModel = handleResult(updateSettings(model, patch as any), { json: !!opts.json });
  return { model: newModel, result: { type: "settings", entity: newModel.settings } };
}

const handlers = new Map<string, UpdateHandler>([
  ["thing", handleUpdateThing],
  ["state", handleUpdateState],
  ["link", handleUpdateLink],
  ["opd", handleUpdateOPD],
]);

const singletonHandlers = new Map<string, SingletonUpdateHandler>([
  ["meta", handleUpdateMeta],
  ["settings", handleUpdateSettings],
]);

export function executeUpdate(
  entityType: string,
  id: string | undefined,
  opts: UpdateOptions,
): UpdateResult {
  const singletonHandler = singletonHandlers.get(entityType);
  if (singletonHandler) {
    const filePath = resolveModelFile(opts.file);
    const { model } = readModel(filePath);
    const { model: newModel, result } = singletonHandler(model, opts);
    writeModel(newModel, filePath);
    return result;
  }

  const handler = handlers.get(entityType);
  if (!handler) {
    fatal(`Unknown entity type: ${entityType}. Valid: ${[...handlers.keys(), ...singletonHandlers.keys()].join(", ")}`);
  }
  if (!id) fatal(`Missing required: <id> for ${entityType}`);

  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);
  const { model: newModel, result } = handler(model, id, opts);
  writeModel(newModel, filePath);
  return result;
}
