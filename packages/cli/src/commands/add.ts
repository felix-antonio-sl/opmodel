// packages/cli/src/commands/add.ts
import {
  addThing, addState, addLink, addOPD,
  type Model, type Thing, type State, type Link, type OPD,
  type Kind, type Essence, type Affiliation, type LinkType, type OpdType, type RefinementType,
} from "@opmodel/core";
import { handleResult, fatal } from "../format";
import { readModel, writeModel, resolveModelFile } from "../io";
import { slug } from "../slug";

interface AddOptions {
  // Common
  file?: string;
  id?: string;
  input?: string;   // raw JSON input for agent mode (--input flag)
  // Thing
  name?: string;
  kind?: Kind;
  essence?: Essence;
  affiliation?: Affiliation;
  // State
  parent?: string;
  initial?: boolean;
  final?: boolean;
  default?: boolean;
  // Link
  type?: LinkType;
  source?: string;
  target?: string;
  sourceState?: string;
  targetState?: string;
  // OPD
  opdType?: OpdType;
  refines?: string;
  refinement?: RefinementType;
}

interface AddResult {
  id: string;
  type: string;
  entity: unknown;
}

type AddHandler = (model: Model, opts: AddOptions) => { model: Model; result: AddResult };

function parseInput<T>(input: string, entityType: string): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    fatal(`Invalid JSON input for ${entityType}: ${input.slice(0, 80)}`);
  }
}

function handleAddThing(model: Model, opts: AddOptions): { model: Model; result: AddResult } {
  let thing: Thing;
  if (opts.input) {
    thing = parseInput<Thing>(opts.input, "thing");
  } else {
    if (!opts.name) fatal("Missing required: name");
    if (!opts.kind) fatal("Missing required: --kind");
    if (!opts.essence) fatal("Missing required: --essence");
    const id = opts.id ?? `${opts.kind === "process" ? "proc" : "obj"}-${slug(opts.name)}`;
    thing = {
      id,
      kind: opts.kind,
      name: opts.name,
      essence: opts.essence,
      affiliation: opts.affiliation ?? "systemic",
    };
  }
  const newModel = handleResult(addThing(model, thing), { json: false });
  return { model: newModel, result: { id: thing.id, type: "thing", entity: thing } };
}

function handleAddState(model: Model, opts: AddOptions): { model: Model; result: AddResult } {
  let state: State;
  if (opts.input) {
    state = parseInput<State>(opts.input, "state");
  } else {
    if (!opts.name) fatal("Missing required: name");
    if (!opts.parent) fatal("Missing required: --parent");
    const id = opts.id ?? `state-${slug(opts.name)}`;
    state = {
      id,
      parent: opts.parent,
      name: opts.name,
      initial: opts.initial ?? false,
      final: opts.final ?? false,
      default: opts.default ?? false,
    };
  }
  const newModel = handleResult(addState(model, state), { json: false });
  return { model: newModel, result: { id: state.id, type: "state", entity: state } };
}

function handleAddLink(model: Model, opts: AddOptions): { model: Model; result: AddResult } {
  let link: Link;
  if (opts.input) {
    link = parseInput<Link>(opts.input, "link");
  } else {
    if (!opts.type) fatal("Missing required: --type");
    if (!opts.source) fatal("Missing required: --source");
    if (!opts.target) fatal("Missing required: --target");
    const id = opts.id ?? `lnk-${opts.type}-${opts.source}-${opts.target}`;
    link = {
      id,
      type: opts.type,
      source: opts.source,
      target: opts.target,
      ...(opts.sourceState && { source_state: opts.sourceState }),
      ...(opts.targetState && { target_state: opts.targetState }),
    };
  }
  const newModel = handleResult(addLink(model, link), { json: false });
  return { model: newModel, result: { id: link.id, type: "link", entity: link } };
}

function handleAddOPD(model: Model, opts: AddOptions): { model: Model; result: AddResult } {
  let opd: OPD;
  if (opts.input) {
    opd = parseInput<OPD>(opts.input, "opd");
  } else {
    if (!opts.name) fatal("Missing required: name");
    const id = opts.id ?? `opd-${slug(opts.name)}`;
    const opdType = opts.opdType ?? (opts.parent ? "hierarchical" : "view");
    opd = {
      id,
      name: opts.name,
      opd_type: opdType,
      parent_opd: opts.parent ?? null,
      ...(opts.refines && { refines: opts.refines }),
      ...(opts.refinement && { refinement_type: opts.refinement }),
    };
  }
  const newModel = handleResult(addOPD(model, opd), { json: false });
  return { model: newModel, result: { id: opd.id, type: "opd", entity: opd } };
}

const handlers = new Map<string, AddHandler>([
  ["thing", handleAddThing],
  ["state", handleAddState],
  ["link", handleAddLink],
  ["opd", handleAddOPD],
]);

export function executeAdd(
  entityType: string,
  opts: AddOptions,
): AddResult {
  const handler = handlers.get(entityType);
  if (!handler) {
    fatal(`Unknown entity type: ${entityType}. Valid types: ${[...handlers.keys()].join(", ")}`);
  }

  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);
  const { model: newModel, result } = handler(model, opts);
  writeModel(newModel, filePath);
  return result;
}
