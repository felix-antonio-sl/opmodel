import { appearanceKey } from "./helpers";
import { createModel } from "./model";
import type {
  Appearance,
  Assertion,
  Link,
  Meta,
  Model,
  OPD,
  Requirement,
  Scenario,
  Settings,
  State,
  SystemType,
  Thing,
} from "./types";

export type ThingId = string;
export type StateId = string;
export type LinkId = string;
export type RefinementId = string;
export type OpdId = string;
export type ScenarioId = string;
export type AssertionId = string;
export type RequirementId = string;
export type ViewId = string;
export type ParallelClassId = string;

export type ExecutionMode = "sequential" | "parallel";
export type ViewLane = "objects-left" | "processes-center" | "objects-right" | "free";
export type InvocationOrigin = "explicit" | "derived-in-zoom" | "unknown";
export type RefinementCompleteness = "complete" | "partial";

export interface SemanticSource {
  documentId?: string;
  opdName?: string;
  span?: {
    line: number;
    column: number;
    offset: number;
    endLine: number;
    endColumn: number;
    endOffset: number;
  };
  sentenceKind?: string;
}

export interface DerivedSemantics {
  kind: "in-zoom-order" | "fan-elaboration" | "layout-elaboration";
  refinementId?: RefinementId;
  stepIndex?: number;
  note?: string;
}

export interface KernelMeta extends Meta {
  version?: string;
}

export interface KernelSettings extends Settings {}

export interface SemanticThing extends Thing {
  sourceInfo?: SemanticSource;
}

export interface SemanticState extends State {
  parentThing: ThingId;
  sourceInfo?: SemanticSource;
}

export interface SemanticLink extends Link {
  sourceInfo?: SemanticSource;
  derived?: DerivedSemantics;
  origin?: InvocationOrigin;
}

export interface SemanticScenario extends Scenario {
  sourceInfo?: SemanticSource;
}

export interface SemanticAssertion extends Assertion {
  sourceInfo?: SemanticSource;
}

export interface SemanticRequirement extends Requirement {
  sourceInfo?: SemanticSource;
}

export interface InZoomStep {
  id: string;
  thingIds: ThingId[];
  execution: ExecutionMode;
  sourceInfo?: SemanticSource;
}

export interface InZoomRefinement {
  id: RefinementId;
  kind: "in-zoom";
  parentThing: ThingId;
  childOpd: OpdId;
  parentOpd: OpdId;
  steps: InZoomStep[];
  internalObjects: ThingId[];
  completeness: RefinementCompleteness;
  note?: string;
  sourceInfo?: SemanticSource;
}

export interface UnfoldRefinement {
  id: RefinementId;
  kind: "unfold";
  parentThing: ThingId;
  childOpd: OpdId;
  parentOpd: OpdId;
  relation: "aggregation" | "exhibition" | "generalization" | "classification";
  refineeThings: ThingId[];
  completeness: RefinementCompleteness;
  note?: string;
  sourceInfo?: SemanticSource;
}

export type SemanticRefinement = InZoomRefinement | UnfoldRefinement;

export interface OpdNode extends OPD {}

export interface SemanticKernel {
  meta: KernelMeta;
  settings: KernelSettings;
  things: Map<ThingId, SemanticThing>;
  states: Map<StateId, SemanticState>;
  links: Map<LinkId, SemanticLink>;
  refinements: Map<RefinementId, SemanticRefinement>;
  opds: Map<OpdId, OpdNode>;
  scenarios: Map<ScenarioId, SemanticScenario>;
  assertions: Map<AssertionId, SemanticAssertion>;
  requirements: Map<RequirementId, SemanticRequirement>;
}

export interface ViewOccurrence {
  id: ViewId;
  thingId: ThingId;
  opdId: OpdId;
  role: "context" | "internal" | "duplicate" | "refinee" | "refiner";
  scope?: "inner" | "outer";
  semanticRank?: number;
  parallelClass?: ParallelClassId;
  lane?: ViewLane;
  preferredAnchor?: "top" | "bottom" | "left" | "right" | "center";
}

export interface ViewEdge {
  id: string;
  opdId: OpdId;
  linkId: LinkId;
  sourceView: ViewId;
  targetView: ViewId;
  derived?: boolean;
}

export interface SliceRules {
  hideDerivedInvocationLinks?: boolean;
  forbidOuterContourTransformingLinks?: boolean;
  allowDuplicateThings?: boolean;
}

export interface OpdSlice {
  opdId: OpdId;
  name: string;
  contextThing?: ThingId;
  parentOpd?: OpdId | null;
  refinementId?: RefinementId;
  visibleThings: ThingId[];
  visibleLinks: LinkId[];
  visibleStates?: StateId[];
  rules: SliceRules;
}

export interface OpdAtlas {
  rootOpd: OpdId;
  nodes: Map<OpdId, OpdSlice>;
  occurrences: Map<ViewId, ViewOccurrence>;
  edges: Map<string, ViewEdge>;
}

export interface LayoutNode {
  viewId: ViewId;
  x: number;
  y: number;
  w: number;
  h: number;
  pinned?: boolean;
  autoSizing?: boolean;
  internal?: boolean;
  stateAlignment?: "left" | "top" | "right" | "bottom";
}

export interface LayoutEdge {
  edgeId: string;
  vertices?: { x: number; y: number }[];
}

export interface OpdLayout {
  opdId: OpdId;
  nodes: Map<ViewId, LayoutNode>;
  edges: Map<string, LayoutEdge>;
  meta?: {
    algorithm?: string;
    version?: string;
  };
}

export interface LayoutModel {
  opdLayouts: Map<OpdId, OpdLayout>;
}

export interface LegacyModelAdapter {
  toSemanticKernel(model: Model): SemanticKernel;
  toLegacyModel(kernel: SemanticKernel, atlas?: OpdAtlas, layout?: LayoutModel): Model;
}

export interface LegacyProjection {
  kernel: SemanticKernel;
  atlas: OpdAtlas;
  layout: LayoutModel;
}

export function createSemanticKernel(name: string, systemType?: SystemType): SemanticKernel {
  const now = new Date().toISOString();
  return {
    meta: {
      name,
      system_type: systemType,
      created: now,
      modified: now,
    },
    settings: {},
    things: new Map(),
    states: new Map(),
    links: new Map(),
    refinements: new Map(),
    opds: new Map([
      ["opd-sd", { id: "opd-sd", name: "SD", opd_type: "hierarchical", parent_opd: null }],
    ]),
    scenarios: new Map(),
    assertions: new Map(),
    requirements: new Map(),
  };
}

/**
 * Adapter de transición desde el Model actual al SemanticKernel.
 *
 * Conserva la semántica base 1:1 para things/states/links/OPDs/etc.
 * La semántica detallada de refinamiento (steps/internalObjects) no existe todavía
 * en el Model legacy, así que se reconstruye como refinement parcial.
 */
export function semanticKernelFromModel(model: Model): SemanticKernel {
  const refinements = new Map<RefinementId, SemanticRefinement>();

  for (const opd of model.opds.values()) {
    if (!opd.refines || !opd.refinement_type) continue;

    const refinementId = `refinement-${opd.id}`;
    if (opd.refinement_type === "in-zoom") {
      refinements.set(refinementId, {
        id: refinementId,
        kind: "in-zoom",
        parentThing: opd.refines,
        childOpd: opd.id,
        parentOpd: opd.parent_opd ?? "opd-sd",
        steps: [],
        internalObjects: [],
        completeness: "partial",
        note: "Legacy Model does not preserve in-zoom step ordering explicitly; reconstruct from OPL or atlas.",
      });
    } else {
      refinements.set(refinementId, {
        id: refinementId,
        kind: "unfold",
        parentThing: opd.refines,
        childOpd: opd.id,
        parentOpd: opd.parent_opd ?? "opd-sd",
        relation: "aggregation",
        refineeThings: [],
        completeness: "partial",
        note: "Legacy Model does not preserve unfold relation/refinees explicitly enough for exact recovery.",
      });
    }
  }

  return {
    meta: { ...model.meta },
    settings: { ...model.settings },
    things: new Map([...model.things.entries()].map(([id, thing]) => [id, { ...thing }])),
    states: new Map([...model.states.entries()].map(([id, state]) => [id, { ...state, parentThing: state.parent }])),
    links: new Map([...model.links.entries()].map(([id, link]) => [
      id,
      {
        ...link,
        ...(link.type === "invocation" ? { origin: "unknown" as InvocationOrigin } : {}),
      },
    ])),
    refinements,
    opds: new Map([...model.opds.entries()].map(([id, opd]) => [id, { ...opd }])),
    scenarios: new Map([...model.scenarios.entries()].map(([id, s]) => [id, { ...s }])),
    assertions: new Map([...model.assertions.entries()].map(([id, a]) => [id, { ...a }])),
    requirements: new Map([...model.requirements.entries()].map(([id, r]) => [id, { ...r }])),
  };
}

/**
 * Adapter de transición de vuelta al Model actual.
 *
 * Sin atlas/layout, la reconstrucción es semánticamente útil pero visualmente mínima:
 * no materializa appearances. Con atlas+layout, reconstruye appearances explícitas.
 */
export function legacyModelFromSemanticKernel(kernel: SemanticKernel, atlas?: OpdAtlas, layout?: LayoutModel): Model {
  const model = createModel(kernel.meta.name, kernel.meta.system_type);

  const appearances = atlas && layout
    ? buildAppearanceMapFromAtlas(atlas, layout)
    : new Map<string, Appearance>();

  return {
    ...model,
    meta: legacyMetaFromKernel(kernel.meta),
    settings: { ...kernel.settings },
    things: new Map([...kernel.things.entries()].map(([id, thing]) => [id, legacyThingFromSemantic(thing)])),
    states: new Map([...kernel.states.entries()].map(([id, state]) => [id, legacyStateFromSemantic(state)])),
    links: new Map([...kernel.links.entries()].map(([id, link]) => [id, legacyLinkFromSemantic(link)])),
    opds: new Map([...kernel.opds.entries()].map(([id, opd]) => [id, { ...opd }])),
    scenarios: new Map([...kernel.scenarios.entries()].map(([id, s]) => [id, legacyScenarioFromSemantic(s)])),
    assertions: new Map([...kernel.assertions.entries()].map(([id, a]) => [id, legacyAssertionFromSemantic(a)])),
    requirements: new Map([...kernel.requirements.entries()].map(([id, r]) => [id, legacyRequirementFromSemantic(r)])),
    appearances,
    modifiers: new Map(),
    fans: new Map(),
    stereotypes: new Map(),
    subModels: new Map(),
  };
}

function legacyMetaFromKernel(meta: KernelMeta): Meta {
  const { version: _version, ...rest } = meta;
  return { ...rest };
}

function legacyThingFromSemantic(thing: SemanticThing): Thing {
  const { sourceInfo: _sourceInfo, ...rest } = thing;
  return stripUndefined(rest);
}

function legacyStateFromSemantic(state: SemanticState): State {
  const { parentThing, sourceInfo: _sourceInfo, ...rest } = state;
  return stripUndefined({ ...rest, parent: parentThing });
}

function legacyLinkFromSemantic(link: SemanticLink): Link {
  const { sourceInfo: _sourceInfo, derived: _derived, origin: _origin, ...rest } = link;
  return stripUndefined(rest);
}

function legacyScenarioFromSemantic(scenario: SemanticScenario): Scenario {
  const { sourceInfo: _sourceInfo, ...rest } = scenario;
  return stripUndefined(rest);
}

function legacyAssertionFromSemantic(assertion: SemanticAssertion): Assertion {
  const { sourceInfo: _sourceInfo, ...rest } = assertion;
  return stripUndefined(rest);
}

function legacyRequirementFromSemantic(requirement: SemanticRequirement): Requirement {
  const { sourceInfo: _sourceInfo, ...rest } = requirement;
  return stripUndefined(rest);
}

export function projectLegacyModel(model: Model): LegacyProjection {
  const kernel = semanticKernelFromModel(model);
  const atlas = exposeSemanticKernel(kernel);
  const layout = layoutModelFromLegacyModel(model, atlas);
  return { kernel, atlas, layout };
}

export function layoutModelFromLegacyModel(model: Model, atlas?: OpdAtlas): LayoutModel {
  const opdLayouts = new Map<OpdId, OpdLayout>();

  for (const app of model.appearances.values()) {
    const opdId = app.opd;
    let opdLayout = opdLayouts.get(opdId);
    if (!opdLayout) {
      opdLayout = {
        opdId,
        nodes: new Map(),
        edges: new Map(),
        meta: { algorithm: "legacy-appearance-import", version: model.opmodel },
      };
      opdLayouts.set(opdId, opdLayout);
    }

    const candidateId = viewId(opdId, app.thing);
    const viewIdToUse = atlas && atlas.occurrences.has(candidateId)
      ? candidateId
      : candidateId;

    opdLayout.nodes.set(viewIdToUse, {
      viewId: viewIdToUse,
      x: app.x,
      y: app.y,
      w: app.w,
      h: app.h,
      ...(app.pinned !== undefined ? { pinned: app.pinned } : {}),
      ...(app.auto_sizing !== undefined ? { autoSizing: app.auto_sizing } : {}),
      ...(app.internal !== undefined ? { internal: app.internal } : {}),
      ...(app.state_alignment ? { stateAlignment: app.state_alignment } : {}),
    });
  }

  return { opdLayouts };
}

export function exposeSemanticKernel(kernel: SemanticKernel): OpdAtlas {
  const rootOpd = kernel.opds.has("opd-sd") ? "opd-sd" : [...kernel.opds.keys()][0] ?? "opd-sd";
  const nodes = new Map<OpdId, OpdSlice>();
  const occurrences = new Map<ViewId, ViewOccurrence>();
  const edges = new Map<string, ViewEdge>();

  const refinementByChild = new Map<OpdId, SemanticRefinement>();
  for (const refinement of kernel.refinements.values()) {
    refinementByChild.set(refinement.childOpd, refinement);
  }

  for (const opd of kernel.opds.values()) {
    const refinement = refinementByChild.get(opd.id);
    const rules: SliceRules = {
      hideDerivedInvocationLinks: true,
      forbidOuterContourTransformingLinks: true,
      allowDuplicateThings: true,
    };

    const visibleThings = new Set<ThingId>();
    const visibleLinks = new Set<LinkId>();

    if (!refinement) {
      for (const thingId of kernel.things.keys()) visibleThings.add(thingId);
      for (const link of kernel.links.values()) {
        if (shouldHideLinkInSlice(link, rules)) continue;
        visibleLinks.add(link.id);
      }
    } else if (refinement.kind === "in-zoom") {
      visibleThings.add(refinement.parentThing);
      for (const step of refinement.steps) {
        for (const thingId of step.thingIds) visibleThings.add(thingId);
      }
      for (const thingId of refinement.internalObjects) visibleThings.add(thingId);

      const focusThings = new Set<ThingId>(visibleThings);
      for (const link of kernel.links.values()) {
        if (shouldHideLinkInSlice(link, rules)) continue;
        if (focusThings.has(link.source) || focusThings.has(link.target)) {
          visibleThings.add(link.source);
          visibleThings.add(link.target);
        }
      }
      for (const link of kernel.links.values()) {
        if (shouldHideLinkInSlice(link, rules)) continue;
        if (visibleThings.has(link.source) && visibleThings.has(link.target)) {
          visibleLinks.add(link.id);
        }
      }
    } else {
      visibleThings.add(refinement.parentThing);
      for (const thingId of refinement.refineeThings) visibleThings.add(thingId);
      for (const link of kernel.links.values()) {
        if (shouldHideLinkInSlice(link, rules)) continue;
        if (visibleThings.has(link.source) && visibleThings.has(link.target)) {
          visibleLinks.add(link.id);
        }
      }
    }

    const visibleStates = [...kernel.states.values()]
      .filter((state) => visibleThings.has(state.parentThing))
      .map((state) => state.id);

    const slice: OpdSlice = {
      opdId: opd.id,
      name: opd.name,
      ...(refinement ? { contextThing: refinement.parentThing, parentOpd: opd.parent_opd, refinementId: refinement.id } : { parentOpd: opd.parent_opd }),
      visibleThings: [...visibleThings].sort(),
      visibleLinks: [...visibleLinks].sort(),
      ...(visibleStates.length > 0 ? { visibleStates: visibleStates.sort() } : {}),
      rules,
    };
    nodes.set(opd.id, slice);

    if (!refinement) {
      for (const thingId of slice.visibleThings) {
        const occurrence = createOccurrence(kernel, opd.id, thingId, { role: "internal" });
        occurrences.set(occurrence.id, occurrence);
      }
    } else if (refinement.kind === "in-zoom") {
      const contextOccurrence = createOccurrence(kernel, opd.id, refinement.parentThing, { role: "context", lane: "processes-center" });
      occurrences.set(contextOccurrence.id, contextOccurrence);

      refinement.steps.forEach((step, stepIndex) => {
        const parallelClass = step.execution === "parallel" ? `parallel:${refinement.id}:${stepIndex}` : undefined;
        for (const thingId of step.thingIds) {
          const occurrence = createOccurrence(kernel, opd.id, thingId, {
            role: "internal",
            semanticRank: stepIndex,
            ...(parallelClass ? { parallelClass } : {}),
            lane: defaultLaneForThing(kernel, thingId),
          });
          occurrences.set(occurrence.id, occurrence);
        }
      });

      for (const thingId of refinement.internalObjects) {
        const occurrence = createOccurrence(kernel, opd.id, thingId, {
          role: "internal",
          scope: "inner",
          lane: defaultLaneForThing(kernel, thingId),
        });
        occurrences.set(occurrence.id, occurrence);
      }

      for (const thingId of slice.visibleThings) {
        if (occurrences.has(viewId(opd.id, thingId))) continue;
        const occurrence = createOccurrence(kernel, opd.id, thingId, {
          role: "duplicate",
          scope: "outer",
          lane: defaultLaneForThing(kernel, thingId),
        });
        occurrences.set(occurrence.id, occurrence);
      }
    } else {
      const contextOccurrence = createOccurrence(kernel, opd.id, refinement.parentThing, { role: "context", lane: defaultLaneForThing(kernel, refinement.parentThing) });
      occurrences.set(contextOccurrence.id, contextOccurrence);
      for (const thingId of slice.visibleThings) {
        if (thingId === refinement.parentThing) continue;
        const occurrence = createOccurrence(kernel, opd.id, thingId, {
          role: "internal",
          lane: defaultLaneForThing(kernel, thingId),
        });
        occurrences.set(occurrence.id, occurrence);
      }
    }

    for (const linkId of slice.visibleLinks) {
      const link = kernel.links.get(linkId);
      if (!link) continue;
      const sourceView = viewId(opd.id, link.source);
      const targetView = viewId(opd.id, link.target);
      if (!occurrences.has(sourceView) || !occurrences.has(targetView)) continue;
      edges.set(`vedge:${opd.id}:${link.id}`, {
        id: `vedge:${opd.id}:${link.id}`,
        opdId: opd.id,
        linkId: link.id,
        sourceView,
        targetView,
        ...(isDerivedLink(link) ? { derived: true } : {}),
      });
    }
  }

  return { rootOpd, nodes, occurrences, edges };
}

function buildAppearanceMapFromAtlas(atlas: OpdAtlas, layout: LayoutModel): Map<string, Appearance> {
  const appearances = new Map<string, Appearance>();

  for (const occurrence of atlas.occurrences.values()) {
    const opdLayout = layout.opdLayouts.get(occurrence.opdId);
    const node = opdLayout?.nodes.get(occurrence.id);
    if (!node) continue;

    const appearance: Appearance = {
      thing: occurrence.thingId,
      opd: occurrence.opdId,
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h,
      ...(occurrence.role === "internal" ? { internal: true } : {}),
      ...(node.pinned !== undefined ? { pinned: node.pinned } : {}),
      ...(node.autoSizing !== undefined ? { auto_sizing: node.autoSizing } : {}),
      ...(node.stateAlignment ? { state_alignment: node.stateAlignment } : {}),
    };

    appearances.set(appearanceKey(appearance.thing, appearance.opd), appearance);
  }

  return appearances;
}

function createOccurrence(
  kernel: SemanticKernel,
  opdId: OpdId,
  thingId: ThingId,
  overrides: Partial<ViewOccurrence>,
): ViewOccurrence {
  return {
    id: viewId(opdId, thingId),
    thingId,
    opdId,
    role: "internal",
    lane: defaultLaneForThing(kernel, thingId),
    ...overrides,
  };
}

function viewId(opdId: OpdId, thingId: ThingId): ViewId {
  return `view:${opdId}:${thingId}`;
}

function defaultLaneForThing(kernel: SemanticKernel, thingId: ThingId): ViewLane {
  const thing = kernel.things.get(thingId);
  if (!thing) return "free";
  return thing.kind === "process" ? "processes-center" : "objects-left";
}

function isDerivedLink(link: SemanticLink): boolean {
  return !!link.derived || link.origin === "derived-in-zoom";
}

function shouldHideLinkInSlice(link: SemanticLink, rules: SliceRules): boolean {
  if (rules.hideDerivedInvocationLinks && link.type === "invocation" && isDerivedLink(link)) {
    return true;
  }
  return false;
}

function stripUndefined<T extends object>(value: T): T {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  return Object.fromEntries(entries) as T;
}
