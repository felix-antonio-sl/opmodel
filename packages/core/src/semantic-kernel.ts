import { appearanceKey } from "./helpers";
import { createModel } from "./model";
import type {
  Appearance,
  Assertion,
  Fan,
  Link,
  Meta,
  Model,
  Modifier,
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

export interface SemanticModifier extends Modifier {
  sourceInfo?: SemanticSource;
}

export interface SemanticFan extends Fan {
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

export type ModifierId = string;
export type FanId = string;

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
  modifiers: Map<ModifierId, SemanticModifier>;
  fans: Map<FanId, SemanticFan>;
}

export interface ViewOccurrence {
  id: ViewId;
  thingId: ThingId;
  opdId: OpdId;
  role: "primary" | "context" | "internal" | "duplicate" | "refinee" | "refiner";
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
    modifiers: new Map(),
    fans: new Map(),
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
      // Reconstruct steps/internalObjects from Model appearances
      const parentOpdId = opd.parent_opd ?? "opd-sd";
      const parentThingIds = new Set(
        [...model.appearances.values()].filter(a => a.opd === parentOpdId).map(a => a.thing)
      );
      const childApps = [...model.appearances.values()]
        .filter(a => a.opd === opd.id && a.internal === true && a.thing !== opd.refines);
      const stepProcesses = childApps
        .filter(a => model.things.get(a.thing)?.kind === "process")
        .sort((a, b) => a.y - b.y)
        .map(a => a.thing);
      // Only truly internal objects (not present in parent OPD) — externals appear in both.
      // Also exclude objects that are agent/instrument of a sub-process: those are
      // external participants (visualized within the sub-OPD but covered by their
      // own agent/instrument OPL sentences). Including them in internalObjects
      // causes the renderer to emit an "as well as" clause for roles already
      // expressed by link sentences, and the parser does not register Things
      // from that clause, so they vanish on roundtrip.
      const subProcessSet = new Set(stepProcesses);
      const isExternalParticipant = (thingId: string): boolean => {
        for (const link of model.links.values()) {
          if (link.source !== thingId) continue;
          if (link.type !== "agent" && link.type !== "instrument") continue;
          if (subProcessSet.has(link.target)) return true;
        }
        return false;
      };
      const internalObjs = childApps
        .filter(a => model.things.get(a.thing)?.kind === "object" && !parentThingIds.has(a.thing))
        .filter(a => !isExternalParticipant(a.thing))
        .map(a => a.thing);

      refinements.set(refinementId, {
        id: refinementId,
        kind: "in-zoom",
        parentThing: opd.refines,
        childOpd: opd.id,
        parentOpd: opd.parent_opd ?? "opd-sd",
        steps: stepProcesses.length > 0
          ? [{ id: `step-${refinementId}-0`, thingIds: stepProcesses, execution: "sequential" as const }]
          : [],
        internalObjects: internalObjs,
        completeness: stepProcesses.length > 0 ? "complete" as const : "partial" as const,
      });
    } else {
      // Reconstruct refineeThings from Model appearances
      const refineeApps = [...model.appearances.values()]
        .filter(a => a.opd === opd.id && a.internal === true && a.thing !== opd.refines);
      refinements.set(refinementId, {
        id: refinementId,
        kind: "unfold",
        parentThing: opd.refines,
        childOpd: opd.id,
        parentOpd: opd.parent_opd ?? "opd-sd",
        relation: "aggregation",
        refineeThings: refineeApps.map(a => a.thing),
        completeness: refineeApps.length > 0 ? "complete" as const : "partial" as const,
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
    modifiers: new Map([...model.modifiers.entries()].map(([id, mod]) => [id, { ...mod }])),
    fans: new Map([...model.fans.entries()].map(([id, fan]) => [id, { ...fan }])),
  };
}

/**
 * Adapter de transición de vuelta al Model actual.
 *
 * Sin atlas/layout, la reconstrucción es semánticamente útil pero visualmente mínima:
 * no materializa appearances. Con atlas+layout, reconstruye appearances explícitas.
 */
function defaultLayoutFromAtlas(atlas: OpdAtlas, kernel: SemanticKernel): LayoutModel {
  const opdLayouts = new Map<OpdId, OpdLayout>();

  // Group occurrences by OPD
  const byOpd = new Map<OpdId, ViewOccurrence[]>();
  for (const occ of atlas.occurrences.values()) {
    const list = byOpd.get(occ.opdId) ?? [];
    list.push(occ);
    byOpd.set(occ.opdId, list);
  }

  for (const [opdId, occs] of byOpd) {
    const nodes = new Map<ViewId, LayoutNode>();
    const slice = atlas.nodes.get(opdId);
    const context = occs.find((occ) => occ.role === "context");

    if (slice?.refinementId && context) {
      const internalProcesses = occs
        .filter((occ) => occ.role === "internal" && kernel.things.get(occ.thingId)?.kind === "process")
        .sort((a, b) => (a.semanticRank ?? 0) - (b.semanticRank ?? 0) || a.thingId.localeCompare(b.thingId));
      const processOrder = new Map(internalProcesses.map((occ, index) => [occ.thingId, index]));
      const linkedProcessRank = (thingId: ThingId): number => {
        const ranks: number[] = [];
        for (const link of kernel.links.values()) {
          if (link.source !== thingId && link.target !== thingId) continue;
          const otherId = link.source === thingId ? link.target : link.source;
          const rank = processOrder.get(otherId);
          if (rank !== undefined) ranks.push(rank);
        }
        if (ranks.length === 0) return Number.MAX_SAFE_INTEGER;
        return ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
      };
      const internalObjects = occs
        .filter((occ) => occ.role === "internal" && kernel.things.get(occ.thingId)?.kind !== "process")
        .sort((a, b) => linkedProcessRank(a.thingId) - linkedProcessRank(b.thingId) || a.thingId.localeCompare(b.thingId));
      const duplicates = occs
        .filter((occ) => occ.role === "duplicate")
        .sort((a, b) => linkedProcessRank(a.thingId) - linkedProcessRank(b.thingId) || a.thingId.localeCompare(b.thingId));

      const containerX = 80;
      const containerY = 60;
      const processX = containerX + 120;
      const objectX = containerX + 430;
      const leftX = containerX - 220;
      const rightX = containerX + 830;
      const supportStartY = containerY + 520;
      const processW = 210;
      const processH = 60;
      const processGapY = 44;
      const objectW = 230;
      const objectH = 58;
      const objectGapY = 42;
      const duplicateW = 170;
      const duplicateH = 50;
      const duplicateGapY = 18;
      const supportRowGap = 14;

      const processHeight = Math.max(1, internalProcesses.length) * (processH + processGapY) - processGapY;
      const objectHeight = Math.max(1, internalObjects.length) * (objectH + objectGapY) - objectGapY;
      const contentHeight = Math.max(processHeight, objectHeight);
      const supportRows = Math.ceil(duplicates.length / 5);
      const supportHeight = supportRows > 0 ? supportRows * (duplicateH + supportRowGap) - supportRowGap + 40 : 0;
      const containerW = 1040;
      const containerH = Math.max(620, 120 + contentHeight + 120 + supportHeight);

      nodes.set(context.id, {
        viewId: context.id,
        x: containerX,
        y: containerY,
        w: containerW,
        h: containerH,
      });

      internalProcesses.forEach((occ, index) => {
        nodes.set(occ.id, {
          viewId: occ.id,
          x: processX,
          y: containerY + 70 + index * (processH + processGapY),
          w: processW,
          h: processH,
        });
      });

      const objectYFor = (thingId: ThingId, fallbackIndex: number) => {
        const rank = linkedProcessRank(thingId);
        if (!Number.isFinite(rank) || rank === Number.MAX_SAFE_INTEGER) return containerY + 65 + fallbackIndex * (objectH + objectGapY);
        return containerY + 65 + rank * (processH + processGapY);
      };
      internalObjects.forEach((occ, index) => {
        nodes.set(occ.id, {
          viewId: occ.id,
          x: objectX,
          y: objectYFor(occ.thingId, index),
          w: objectW,
          h: objectH,
        });
      });

      const leftDuplicates = duplicates.filter((occ) => occ.lane === "objects-left");
      const rightDuplicates = duplicates.filter((occ) => !leftDuplicates.includes(occ));
      leftDuplicates.forEach((occ, index) => {
        nodes.set(occ.id, {
          viewId: occ.id,
          x: leftX,
          y: objectYFor(occ.thingId, index),
          w: duplicateW,
          h: duplicateH,
        });
      });
      rightDuplicates.forEach((occ, index) => {
        nodes.set(occ.id, {
          viewId: occ.id,
          x: rightX,
          y: objectYFor(occ.thingId, index),
          w: duplicateW,
          h: duplicateH,
        });
      });

      opdLayouts.set(opdId, {
        opdId,
        nodes,
        edges: new Map(),
        meta: { algorithm: "in-zoom-role-aware", version: "2.0" },
      });
      continue;
    }

    const processes = occs.filter(o => kernel.things.get(o.thingId)?.kind === "process");
    const objects = occs.filter(o => kernel.things.get(o.thingId)?.kind !== "process");

    const colWidth = 180;
    const rowHeight = 100;
    const cols = Math.max(3, Math.ceil(Math.sqrt(occs.length)));
    const startX = 60;
    const startY = 60;

    for (let i = 0; i < processes.length; i++) {
      const proc = processes[i];
      if (!proc) continue;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const w = 160;
      const h = 70;
      nodes.set(proc.id, {
        viewId: proc.id,
        x: startX + col * colWidth + (colWidth - w) / 2,
        y: startY + row * rowHeight + (rowHeight - h) / 2,
        w, h,
      });
    }

    const objStartY = startY + (Math.ceil(processes.length / cols) || 1) * rowHeight + 40;
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      if (!obj) continue;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const w = 140;
      const h = 50;
      nodes.set(obj.id, {
        viewId: obj.id,
        x: startX + col * colWidth + (colWidth - w) / 2,
        y: objStartY + row * rowHeight + (rowHeight - h) / 2,
        w, h,
      });
    }

    opdLayouts.set(opdId, {
      opdId,
      nodes,
      edges: new Map(),
      meta: { algorithm: "auto-grid", version: "1.0" },
    });
  }

  return { opdLayouts };
}

export function legacyModelFromSemanticKernel(kernel: SemanticKernel, atlas?: OpdAtlas, layout?: LayoutModel): Model {
  const model = createModel(kernel.meta.name, kernel.meta.system_type);

  // When atlas exists but no layout, generate a default grid layout so appearances are materialized
  const effectiveLayout = layout ?? (atlas ? defaultLayoutFromAtlas(atlas, kernel) : undefined);
  const appearances = atlas && effectiveLayout
    ? buildAppearanceMapFromAtlas(atlas, effectiveLayout)
    : new Map<string, Appearance>();

  return {
    ...model,
    meta: legacyMetaFromKernel(kernel.meta),
    settings: { ...kernel.settings },
    things: new Map([...kernel.things.entries()].map(([id, thing]) => [id, legacyThingFromSemantic(thing)])),
    states: new Map([...kernel.states.entries()].map(([id, state]) => [id, legacyStateFromSemantic(state)])),
    links: new Map([...kernel.links.entries()].map(([id, link]) => [id, legacyLinkFromSemantic(link)])),
    opds: new Map([...kernel.opds.entries()].map(([id, opd]) => {
      // Reconstruct refines/refinement_type from kernel.refinements
      const refinement = [...kernel.refinements.values()].find(r => r.childOpd === id);
      return [id, {
        ...opd,
        ...(refinement ? { refines: refinement.parentThing, refinement_type: refinement.kind } : {}),
      }];
    })),
    scenarios: new Map([...kernel.scenarios.entries()].map(([id, s]) => [id, legacyScenarioFromSemantic(s)])),
    assertions: new Map([...kernel.assertions.entries()].map(([id, a]) => [id, legacyAssertionFromSemantic(a)])),
    requirements: new Map([...kernel.requirements.entries()].map(([id, r]) => [id, legacyRequirementFromSemantic(r)])),
    appearances,
    modifiers: new Map([...kernel.modifiers.entries()].map(([id, mod]) => [id, legacyModifierFromSemantic(mod)])),
    fans: new Map([...kernel.fans.entries()].map(([id, fan]) => [id, legacyFanFromSemantic(fan)])),
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

function legacyModifierFromSemantic(mod: SemanticModifier): Modifier {
  const { sourceInfo: _sourceInfo, ...rest } = mod;
  return stripUndefined(rest);
}

function legacyFanFromSemantic(fan: SemanticFan): Fan {
  const { sourceInfo: _sourceInfo, ...rest } = fan;
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
      // Exclude things internal to ALL descendant refinements (recursive)
      const internalToChild = new Set<ThingId>();
      const collectInternals = (parentOpdId: OpdId) => {
        for (const ref of kernel.refinements.values()) {
          if (ref.parentOpd === parentOpdId || (!ref.parentOpd && parentOpdId === rootOpd)) {
            if (ref.kind === "in-zoom") {
              for (const step of ref.steps) {
                for (const tid of step.thingIds) internalToChild.add(tid);
              }
              for (const tid of ref.internalObjects) internalToChild.add(tid);
            } else {
              for (const tid of ref.refineeThings) internalToChild.add(tid);
            }
            // Recurse into the child OPD
            collectInternals(ref.childOpd);
          }
        }
      };
      collectInternals(opd.id);
      for (const thingId of kernel.things.keys()) {
        if (!internalToChild.has(thingId)) visibleThings.add(thingId);
      }
      for (const link of kernel.links.values()) {
        if (shouldHideLinkInSlice(link, rules)) continue;
        visibleLinks.add(link.id);
      }
    } else if (refinement.kind === "in-zoom") {
      visibleThings.add(refinement.parentThing);
      const internalProcessIds = new Set<ThingId>();
      for (const step of refinement.steps) {
        for (const thingId of step.thingIds) {
          visibleThings.add(thingId);
          internalProcessIds.add(thingId);
        }
      }

      const supportOnlyTypes = new Set(["agent", "instrument"]);
      const staysInternal = (thingId: ThingId) => {
        const relevant = [...kernel.links.values()].filter((link) => {
          if (link.source !== thingId && link.target !== thingId) return false;
          const other = link.source === thingId ? link.target : link.source;
          return other === refinement.parentThing || internalProcessIds.has(other);
        });
        if (relevant.length === 0) return true;
        return relevant.some((link) => !supportOnlyTypes.has(link.type));
      };

      for (const thingId of refinement.internalObjects) {
        if (staysInternal(thingId)) visibleThings.add(thingId);
      }

      const parentVisibleThings = new Set<ThingId>(nodes.get(opd.parent_opd ?? "")?.visibleThings ?? []);
      const supportInfrastructureNames = ["sistema", "infraestructura", "centro", "establecimiento"];
      const isPullbackExternalAllowed = (thingId: ThingId, viaLink: Link): boolean => {
        const thing = kernel.things.get(thingId);
        if (!thing) return false;
        if (thing.kind === "process") return false;
        if (viaLink.type !== "agent" && viaLink.type !== "instrument") return true;
        const lowerName = (thing.name || "").toLowerCase();
        const looksInfrastructure = supportInfrastructureNames.some((token) => lowerName.includes(token));
        const isHumanActor = lowerName.includes("medico") || lowerName.includes("profesional") || lowerName.includes("cuidador") || lowerName.includes("paciente");
        const isMaterialClinicalInterface = lowerName.includes("medicamento") || lowerName.includes("insumo") || lowerName.includes("equipamiento") || lowerName.includes("ficha") || lowerName.includes("plan") || lowerName.includes("epicrisis") || lowerName.includes("derivacion") || lowerName.includes("consentimiento") || lowerName.includes("domicilio") || lowerName.includes("vehiculo");
        if (looksInfrastructure && !isHumanActor && !isMaterialClinicalInterface) return false;
        return isHumanActor || isMaterialClinicalInterface;
      };
      for (const link of kernel.links.values()) {
        if (shouldHideLinkInSlice(link, rules)) continue;
        const touchesRefined = link.source === refinement.parentThing || link.target === refinement.parentThing;
        if (!touchesRefined) continue;
        const otherThingId = link.source === refinement.parentThing ? link.target : link.source;
        if (parentVisibleThings.size > 0 && !parentVisibleThings.has(otherThingId)) continue;
        if (!isPullbackExternalAllowed(otherThingId, link)) continue;
        visibleThings.add(otherThingId);
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

    // Exhibitor propagation (root OPD only): any exhibition link whose feature
    // is visible in the root OPD must also make its exhibitor visible here.
    // Otherwise the kernel-native OPL render emits a compound declaration
    // "Feature of Exhibitor" in the SD section but the exhibitor itself is
    // only declared in a descendant OPD, breaking parse-time compound-name
    // stripping on re-compile. Scoped to root OPD to preserve the tighter
    // visibility contract for child OPDs (visual regression tests depend on
    // child OPDs showing only refinement participants + direct parent
    // neighbors).
    if (!refinement) {
      const exhibitorAdditions = new Set<ThingId>();
      for (const link of kernel.links.values()) {
        if (link.type !== "exhibition") continue;
        const featureId = link.target;
        const exhibitorId = link.source;
        if (visibleThings.has(featureId) && !visibleThings.has(exhibitorId)) {
          exhibitorAdditions.add(exhibitorId);
        }
      }
      for (const id of exhibitorAdditions) visibleThings.add(id);
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
        const occurrence = createOccurrence(kernel, opd.id, thingId, { role: "primary" });
        occurrences.set(occurrence.id, occurrence);
      }
    } else if (refinement.kind === "in-zoom") {
      const contextOccurrence = createOccurrence(kernel, opd.id, refinement.parentThing, { role: "context", lane: "processes-center" });
      occurrences.set(contextOccurrence.id, contextOccurrence);

      let sequenceRank = 0;
      refinement.steps.forEach((step, stepIndex) => {
        const parallelClass = step.execution === "parallel" ? `parallel:${refinement.id}:${stepIndex}` : undefined;
        for (const thingId of step.thingIds) {
          const occurrence = createOccurrence(kernel, opd.id, thingId, {
            role: "internal",
            semanticRank: sequenceRank++,
            ...(parallelClass ? { parallelClass } : {}),
            lane: defaultLaneForThing(kernel, thingId),
          });
          occurrences.set(occurrence.id, occurrence);
        }
      });

      const supportOnlyTypes = new Set(["agent", "instrument"]);
      const stepThingIds = new Set(refinement.steps.flatMap((step) => step.thingIds));
      const shouldStayInternal = (thingId: ThingId) => {
        const relevant = [...kernel.links.values()].filter((link) => {
          if (link.source !== thingId && link.target !== thingId) return false;
          const other = link.source === thingId ? link.target : link.source;
          return other === refinement.parentThing || stepThingIds.has(other);
        });
        if (relevant.length === 0) return true;
        return relevant.some((link) => !supportOnlyTypes.has(link.type));
      };

      for (const thingId of refinement.internalObjects) {
        if (!shouldStayInternal(thingId)) continue;
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
      // Container and internal things: internal=true. Externals (duplicates): internal=false.
      ...(occurrence.role === "context" || occurrence.role === "internal"
        ? { internal: true }
        : occurrence.role === "duplicate"
          ? { internal: false }
          : {}),
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

// === F4: Collect — Atlas edits → Kernel patches (ADR-003) ===

export type AtlasEdit =
  | { kind: "add-thing-to-opd"; opdId: OpdId; thingId: ThingId }
  | { kind: "remove-thing-from-opd"; opdId: OpdId; thingId: ThingId }
  | { kind: "move-thing"; opdId: OpdId; thingId: ThingId; x: number; y: number }
  | { kind: "add-link"; linkId: LinkId; sourceThingId: ThingId; targetThingId: ThingId; linkType: Link["type"] }
  | { kind: "remove-link"; linkId: LinkId }
  | { kind: "reorder-steps"; refinementId: RefinementId; newOrder: ThingId[][] };

export type KernelPatch =
  | { kind: "semantic"; description: string; apply: (kernel: SemanticKernel) => void }
  | { kind: "layout-only"; description: string };

/**
 * F4: Collect — the left adjoint of Expose.
 *
 * Classifies an atlas edit as either a semantic patch (changes kernel)
 * or a layout-only patch (changes only positions, no semantic effect).
 *
 * ADR-003 Law 4 (orthogonality): move-thing produces layout-only patches.
 * ADR-003 Law 3 (diamond): semantic patches must be roundtrip-stable.
 */
export function collectSemanticPatches(
  kernel: SemanticKernel,
  atlas: OpdAtlas,
  edit: AtlasEdit,
): KernelPatch {
  switch (edit.kind) {
    case "move-thing":
      // Law 4: moving a thing is purely layout — no semantic change
      return { kind: "layout-only", description: `Move ${edit.thingId} in ${edit.opdId}` };

    case "add-thing-to-opd":
      return {
        kind: "semantic",
        description: `Add appearance of ${edit.thingId} in ${edit.opdId}`,
        apply: (_kernel) => {
          // Adding a thing to an OPD creates a new occurrence in the atlas
          // The kernel itself doesn't change — the thing already exists
          // But if the thing doesn't exist yet, it would need to be created
        },
      };

    case "remove-thing-from-opd": {
      // Check if thing appears in other OPDs — if not, removing it from the last OPD
      // effectively removes it from the model (semantic change)
      const otherOccurrences = [...atlas.occurrences.values()].filter(
        (o) => o.thingId === edit.thingId && o.opdId !== edit.opdId,
      );
      if (otherOccurrences.length === 0) {
        return {
          kind: "semantic",
          description: `Remove ${edit.thingId} from model (last OPD)`,
          apply: (k) => {
            k.things.delete(edit.thingId);
            // Remove associated states
            for (const [sid, state] of k.states) {
              if (state.parentThing === edit.thingId) k.states.delete(sid);
            }
            // Remove associated links
            for (const [lid, link] of k.links) {
              if (link.source === edit.thingId || link.target === edit.thingId) k.links.delete(lid);
            }
          },
        };
      }
      return { kind: "layout-only", description: `Hide ${edit.thingId} from ${edit.opdId}` };
    }

    case "add-link":
      return {
        kind: "semantic",
        description: `Add ${edit.linkType} link ${edit.sourceThingId} → ${edit.targetThingId}`,
        apply: (k) => {
          k.links.set(edit.linkId, {
            id: edit.linkId,
            type: edit.linkType,
            source: edit.sourceThingId,
            target: edit.targetThingId,
          });
        },
      };

    case "remove-link":
      return {
        kind: "semantic",
        description: `Remove link ${edit.linkId}`,
        apply: (k) => {
          k.links.delete(edit.linkId);
          // Remove modifiers on this link
          for (const [mid, mod] of k.modifiers) {
            if (mod.over === edit.linkId) k.modifiers.delete(mid);
          }
        },
      };

    case "reorder-steps":
      return {
        kind: "semantic",
        description: `Reorder steps in refinement ${edit.refinementId}`,
        apply: (k) => {
          const refinement = k.refinements.get(edit.refinementId);
          if (!refinement || refinement.kind !== "in-zoom") return;
          refinement.steps = edit.newOrder.map((thingIds, i) => ({
            id: `step-${edit.refinementId}-${i}`,
            thingIds,
            execution: thingIds.length > 1 ? "parallel" as const : "sequential" as const,
          }));
        },
      };
  }
}
