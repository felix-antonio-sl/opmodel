// packages/core/src/simulation.ts
// Motor de Simulación ECA (Event-Condition-Action) como Coalgebra (DA-5)
//
// Coalgebra structure:
//   Carrier:  S = ModelState
//   Functor:  F(S) = SimulationEvent × (PreconditionResult → S + 1)
//   Step:     c: S → F(S)  implemented by simulationStep()
//
// Where:
//   PreconditionResult = { satisfied: true } | { satisfied: false; response: "lost"|"skip"|"wait" }
//   S + 1 = ModelState | halt (when no further processes are executable)
//
// The functor F is observational: each step produces an event, evaluates preconditions
// (trivalent), and yields a deterministic successor state or halts.
//
// Deadlock detection is empirical (no-progress + waiting processes), not based on
// state-space fixed-point analysis. See MAX_WAIT_STEPS for timeout heuristic.

import type { Model, Thing, State, Link, Modifier, OPD, Fan, Appearance, OpmDataView } from "./types";
import type { InvariantError, Result } from "./result";
import { ok, err } from "./result";
import { getStructuralChildren, getInheritedLinks } from "./structural";
import type { SemanticKernel, OpdAtlas, LayoutModel, InZoomRefinement, UnfoldRefinement, SemanticRefinement } from "./semantic-kernel";
import { legacyModelFromSemanticKernel, exposeSemanticKernel } from "./semantic-kernel";
import { appearanceKey } from "./helpers";

/** Maximum self-invocation repetitions per process before stopping (ISO §9.5.2.5.2) */
export const MAX_SELF_INVOCATIONS = 10;
export const MAX_INVOCATION_CHAIN_DEPTH = 50;
/** Max steps a process can wait before being timed out (heuristic, not formal) */
const MAX_WAIT_STEPS = 20;

// === Tipos Coalgebraicos ===

/** Estado de un objeto individual durante simulación */
export interface ObjectState {
  exists: boolean;
  currentState?: string; // ID del estado actual
}

/** Estado global del modelo durante simulación */
export interface ModelState {
  objects: Map<string, ObjectState>;
  step: number;
  timestamp: number;
  waitingProcesses: Set<string>;
}

/** Evento que dispara evaluación */
export interface SimulationEvent {
  kind: "object-created" | "object-entered-state" | "process-completed" | "timeout" | "manual";
  targetId?: string;
  targetState?: string;
  sourceId?: string;
}

/** Resultado de evaluar precondición — trivalent (C2) */
export type PreconditionResult =
  | { satisfied: true }
  | { satisfied: false; reason: string; response: "lost" | "skip" | "wait" };

/** Resultado de un paso de simulación */
export interface SimulationStep {
  step: number;
  event: SimulationEvent;
  processId?: string;
  processName?: string;
  preconditionMet: boolean;
  skipped: boolean;
  consumptionIds: string[];
  resultIds: string[];
  stateChanges: Array<{ objectId: string; fromState?: string; toState?: string }>;
  newState: ModelState;
  parentProcessId?: string;   // Present when executing a subprocess (in-zoom)
  opdContext?: string;         // OPD ID where subprocess lives
  invokedBy?: string;          // Process that triggered this via invocation link (ISO §9.5.2.5.1)
  duration?: number;            // Simulated duration of this step (nominal, or random if distribution)
  exceptionTriggered?: "overtime" | "undertime"; // Exception condition detected
}

/** Traza coinductiva de simulación */
export interface AssertionResult {
  assertionId: string;
  name: string;
  category: string;
  passed: boolean;
  reason?: string;
}

export interface SimulationTrace {
  steps: SimulationStep[];
  finalState: ModelState;
  completed: boolean;
  deadlocked: boolean;
  assertionResults?: AssertionResult[];
  totalDuration?: number;
}

/** Proceso ejecutable con orden y contexto OPD */
export interface ExecutableProcess {
  id: string;
  name: string;
  order: number;              // Y-coordinate para sorting (0 para top-level)
  parentProcessId?: string;   // Si es subprocess, ID del padre
  opdId?: string;             // OPD donde vive el subprocess
}

/**
 * Expand in-zoomed processes into their subprocesses (leaf expansion).
 * Returns leaf processes sorted by execution order (Y-based within in-zoom).
 * ISO 19450 §14.2.1: recursively transfer execution to top-most subprocess(es).
 * ISO §D.4: top-to-bottom ordering by graphical Y-coordinate.
 */
export function getExecutableProcesses(model: Model, maxDepth: number = 10): ExecutableProcess[] {
  const result: ExecutableProcess[] = [];

  // Build lookup: processId → refinement OPD (in-zoom or unfold)
  const inZoomOpds = new Map<string, OPD>();
  for (const opd of model.opds.values()) {
    if (opd.refines && (opd.refinement_type === "in-zoom" || opd.refinement_type === "unfold")) {
      inZoomOpds.set(opd.refines, opd);
    }
  }

  function expand(processId: string, parentId: string | undefined, depth: number): void {
    if (depth > maxDepth) return;
    const childOpd = inZoomOpds.get(processId);
    if (!childOpd) {
      // Leaf process — directly executable
      const thing = model.things.get(processId);
      if (!thing) return;
      result.push({
        id: processId,
        name: thing.name,
        order: 0,
        parentProcessId: parentId,
        opdId: parentId ? inZoomOpds.get(parentId)?.id : undefined,
      });
      return;
    }

    // Find subprocesses: processes with appearances in child OPD, excluding the container
    const subprocesses: Array<{ id: string; name: string; y: number }> = [];
    for (const app of model.appearances.values()) {
      if (app.opd !== childOpd.id) continue;
      if (app.thing === processId) continue; // Skip the container (refined thing)
      const thing = model.things.get(app.thing);
      if (thing?.kind === "process") {
        subprocesses.push({ id: thing.id, name: thing.name, y: app.y });
      }
    }

    // Sort by Y (ISO §D.4: top-to-bottom)
    subprocesses.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));

    if (subprocesses.length === 0) {
      // In-zoom exists but has no subprocesses — execute parent directly
      const thing = model.things.get(processId);
      if (!thing) return;
      result.push({ id: processId, name: thing.name, order: 0, parentProcessId: parentId });
      return;
    }

    // Recursively expand subprocesses
    for (const sp of subprocesses) {
      expand(sp.id, processId, depth + 1);
      // Set order from Y and OPD context for last pushed result(s)
      const last = result[result.length - 1];
      if (last && last.id === sp.id) {
        last.order = sp.y;
        last.opdId = childOpd.id;
      }
    }
  }

  // Build set of subprocess IDs (processes that appear inside an in-zoom OPD)
  // to exclude them from top-level iteration (they'll be reached via expansion)
  const subprocessIds = new Set<string>();
  for (const opd of inZoomOpds.values()) {
    for (const app of model.appearances.values()) {
      if (app.opd !== opd.id) continue;
      if (app.thing === opd.refines) continue; // Skip the container
      const thing = model.things.get(app.thing);
      if (thing?.kind === "process") {
        subprocessIds.add(thing.id);
      }
    }
  }

  // Start with top-level processes only (exclude subprocesses)
  const topLevelProcesses = [...model.things.values()]
    .filter(t => t.kind === "process" && !subprocessIds.has(t.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const thing of topLevelProcesses) {
    expand(thing.id, undefined, 0);
  }

  // Sort: by order (Y), then by ID for stability
  // Sort by Y-order, then by duration (shortest first for time-based scheduling)
  result.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const durA = model.things.get(a.id)?.duration?.nominal ?? Infinity;
    const durB = model.things.get(b.id)?.duration?.nominal ?? Infinity;
    if (durA !== durB) return durA - durB;
    return a.id.localeCompare(b.id);
  });

  return result;
}

/** Link resolved for OPD visibility with visual endpoint mapping */
export interface ResolvedLink {
  link: Link;
  visualSource: string;
  visualTarget: string;
  aggregated: boolean;
  /** R-ES: effect split half — "input" (source_state→first) or "output" (last→target_state) */
  splitHalf?: "input" | "output";
}

// === DA-9: Fiber (derived OPD view) ===

/** Entry in a computed OPD fiber — explicit (stored appearance) or implicit (derived) */
export interface FiberEntry {
  thing: Thing;
  appearance: Appearance;
  implicit: boolean;  // true = derived from link connectivity, no stored appearance
}

/** Computed fiber for an OPD: the full derived view over the model graph */
export interface OpdFiber {
  things: Map<string, FiberEntry>;  // key: thing ID
  links: ResolvedLink[];
  suppressedStates: Map<string, Set<string>>;  // key: thing ID → suppressed state IDs
}

/**
 * Compute visible links for an OPD by resolving endpoints through in-zoom containers.
 * Implements the pullback π* of I-LINK-VISIBILITY (ISO §14.2.2.4.1).
 * Only processes participate in subprocess-to-parent resolution; objects need direct appearances.
 */
// TODO R-LV-5: Support user-driven link visibility override in child OPDs.
// Currently all resolved links are shown; no per-link hide/show mechanism.
export function resolveLinksForOpd(model: Model, opdId: string): ResolvedLink[] {
  // 1. Appearances in this OPD
  const appearances = new Set<string>();
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) appearances.add(app.thing);
  }

  // R-SF-6/9: Semi-fold parts are virtually "present" — links to them should resolve
  for (const app of model.appearances.values()) {
    if (app.opd === opdId && app.semi_folded) {
      const thing = model.things.get(app.thing);
      if (thing?.kind === "object") {
        const children = getStructuralChildren(model, app.thing, new Set(["aggregation", "exhibition"]));
        for (const { childId } of children) {
          if (!appearances.has(childId)) appearances.add(childId);
        }
      }
    }
  }

  // 2. Build subprocessToAncestor: subprocess ID → visible ancestor process ID
  //    Transitively resolves nested in-zoom chains.
  const subprocessToAncestor = new Map<string, string>();

  const inZoomOpds = new Map<string, OPD>();
  for (const opd of model.opds.values()) {
    if (opd.refines && (opd.refinement_type === "in-zoom" || opd.refinement_type === "unfold")) {
      inZoomOpds.set(opd.refines, opd);
    }
  }

  function registerDescendants(ancestorId: string, processId: string): void {
    const childOpd = inZoomOpds.get(processId);
    if (!childOpd) return;
    for (const app of model.appearances.values()) {
      if (app.opd !== childOpd.id) continue;
      if (app.thing === processId) continue;
      const thing = model.things.get(app.thing);
      if (thing?.kind === "process") {
        subprocessToAncestor.set(thing.id, ancestorId);
        registerDescendants(ancestorId, thing.id);
      }
    }
  }

  for (const thingId of appearances) {
    const thing = model.things.get(thingId);
    if (thing?.kind === "process") {
      registerDescendants(thingId, thingId);
    }
  }

  // 3. Resolve each link
  function resolve(thingId: string): string | null {
    if (appearances.has(thingId)) return thingId;
    return subprocessToAncestor.get(thingId) ?? null;
  }

  // 4. Collect objects consumed internally (consumption links on subprocesses)
  //    Used to suppress aggregated effect/result links on these objects.
  const internallyConsumedObjects = new Set<string>();
  for (const link of model.links.values()) {
    const isSiblingLink = subprocessToAncestor.has(link.source) || subprocessToAncestor.has(link.target);
    if (!isSiblingLink) continue;
    if (link.type === "consumption") {
      const srcThing = model.things.get(link.source);
      const objId = srcThing?.kind === "object" ? link.source : link.target;
      internallyConsumedObjects.add(objId);
    }
  }

  const result: ResolvedLink[] = [];
  const seen = new Set<string>();

  // RESOLVE-01: In-zoom OPD parent-level link filtering + C-01 distribution
  const opd = model.opds.get(opdId);
  const containerThingId = opd?.refines;
  let internalThings: Set<string> | null = null;
  // C-01: Subprocesses sorted by Y for link distribution (ISO §14.2.2.4.1)
  let subprocessesByY: string[] = [];
  if (containerThingId) {
    internalThings = new Set<string>();
    const subprocessApps: Array<{ thingId: string; y: number }> = [];
    for (const app of model.appearances.values()) {
      if (app.opd === opdId && app.internal === true) {
        internalThings.add(app.thing);
        const thing = model.things.get(app.thing);
        if (thing?.kind === "process" && app.thing !== containerThingId) {
          subprocessApps.push({ thingId: app.thing, y: app.y });
        }
      }
    }
    subprocessesByY = subprocessApps.sort((a, b) => a.y - b.y).map(a => a.thingId);
  }

  for (const link of model.links.values()) {
    const vs = resolve(link.source);
    const vt = resolve(link.target);
    if (!vs || !vt) continue;
    if (vs === vt) continue; // Skip self-loops from same-parent resolution

    // RESOLVE-01: Filter parent-level links in refinement OPDs.
    // C-01: Distribute procedural links to subprocesses instead of skipping them.
    if (containerThingId && internalThings) {
      const isStructural = ["aggregation", "exhibition", "generalization", "classification", "tagged"].includes(link.type);
      const touchesContainer = vs === containerThingId || vt === containerThingId;

      if (touchesContainer && !isStructural) {
        // C-01: Distribute to subprocesses if any exist
        if (subprocessesByY.length > 0) {
          const first = subprocessesByY[0]!;
          const last = subprocessesByY[subprocessesByY.length - 1]!;
          const otherEnd = vs === containerThingId ? vt : vs;

          if (link.type === "consumption" || link.type === "input") {
            // Consumption/input → first subprocess
            const dvs = vs === containerThingId ? first : vs;
            const dvt = vt === containerThingId ? first : vt;
            result.push({ link, visualSource: dvs, visualTarget: dvt, aggregated: true });
          } else if (link.type === "result" || link.type === "output") {
            // Result/output → last subprocess
            const dvs = vs === containerThingId ? last : vs;
            const dvt = vt === containerThingId ? last : vt;
            result.push({ link, visualSource: dvs, visualTarget: dvt, aggregated: true });
          } else if (link.type === "effect") {
            // R-ES / R-LD-4: ALL effect links → split into input half (→first) + output half (last→)
            // State-specified: splitHalf labels for state rendering; plain: same distribution, no labels.
            const hasStates = !!(link.source_state || link.target_state);
            result.push({ link, visualSource: otherEnd, visualTarget: first, aggregated: true, ...(hasStates ? { splitHalf: "input" as const } : {}) });
            result.push({ link, visualSource: last, visualTarget: otherEnd, aggregated: true, ...(hasStates ? { splitHalf: "output" as const } : {}) });
          } else if (link.type === "invocation" || link.type === "exception") {
            // Invocation/exception: resolve to nearest visible internal subprocess, not all.
            // Find which internal subprocess contains each endpoint.
            function findInternalAncestor(thingId: string): string | null {
              if (internalThings!.has(thingId)) return thingId;
              for (const intId of internalThings!) {
                const childOpd = [...model.opds.values()].find(o => o.refines === intId && (o.refinement_type === "in-zoom" || o.refinement_type === "unfold"));
                if (!childOpd) continue;
                // Check direct appearance
                if ([...model.appearances.values()].some(a => a.opd === childOpd.id && a.thing === thingId)) return intId;
                // Check transitive (nested in-zoom)
                const thing = model.things.get(thingId);
                if (thing?.kind === "process" && subprocessToAncestor.get(thingId) === containerThingId) {
                  // thingId is a deep descendant — check if intId is on the path
                  let cur = thingId;
                  while (subprocessToAncestor.has(cur)) {
                    const parent = subprocessToAncestor.get(cur)!;
                    if (parent === intId) return intId;
                    cur = parent;
                  }
                }
              }
              return null;
            }
            const srcAnc = vs === containerThingId ? findInternalAncestor(link.source) : null;
            const tgtAnc = vt === containerThingId ? findInternalAncestor(link.target) : null;
            const finalVs = srcAnc ?? vs;
            const finalVt = tgtAnc ?? vt;
            if (finalVs !== finalVt) {
              result.push({ link, visualSource: finalVs, visualTarget: finalVt, aggregated: true });
            }
          } else {
            // Agent/instrument → all subprocesses
            for (const spId of subprocessesByY) {
              const dvs = vs === containerThingId ? spId : vs;
              const dvt = vt === containerThingId ? spId : vt;
              const spKey = `${link.type}|${dvs}|${dvt}`;
              if (!seen.has(spKey)) {
                seen.add(spKey);
                result.push({ link, visualSource: dvs, visualTarget: dvt, aggregated: true });
              }
            }
          }
          continue; // distributed — skip original
        }
        // No subprocesses yet — show link to container as-is (fall through)
      }
      if (!internalThings.has(vs) && !internalThings.has(vt)) continue;
    }

    const isAggregated = vs !== link.source || vt !== link.target;

    // Filter internal mechanisms ONLY for aggregated links (projected to parent).
    // Inside the in-zoom OPD, show all links.
    if (isAggregated) {
      // Effect/result links on objects that are consumed by a sibling subprocess —
      // the transformation is an internal mechanism, not external interface
      if (["effect", "result"].includes(link.type)) {
        const srcThing = model.things.get(link.source);
        const objId = srcThing?.kind === "object" ? link.source : link.target;
        if (internallyConsumedObjects.has(objId)) continue;
      }
    }

    const key = `${link.type}|${vs}|${vt}`;
    if (seen.has(key)) {
      // Prefer direct links over aggregated for same visual key
      if (!isAggregated) {
        const idx = result.findIndex(r =>
          `${r.link.type}|${r.visualSource}|${r.visualTarget}` === key && r.aggregated
        );
        if (idx !== -1) {
          result[idx] = { link, visualSource: vs, visualTarget: vt, aggregated: false };
        }
      }
      continue;
    }
    seen.add(key);

    result.push({
      link,
      visualSource: vs,
      visualTarget: vt,
      aggregated: isAggregated,
    });
  }

  // Post-filter: suppress aggregated enabling links that are internal details.
  // Rule 1 (VISUAL-03): source is part of a whole that has a direct link of same type.
  // Rule 2: source already has a direct link to the same process (redundant role).
  const partToWhole = new Map<string, string>();
  for (const l of model.links.values()) {
    // Direction-agnostic: register both endpoints for aggregation links
    if (l.type === "aggregation") {
      partToWhole.set(l.target, l.source);
      partToWhole.set(l.source, l.target);
    }
  }

  const directLinkKeys = new Set<string>();
  const directParticipants = new Set<string>();
  for (const rl of result) {
    if (!rl.aggregated) {
      directLinkKeys.add(`${rl.link.type}|${rl.visualSource}|${rl.visualTarget}`);
      const srcThing = model.things.get(rl.visualSource);
      const tgtThing = model.things.get(rl.visualTarget);
      if (srcThing?.kind === "object") directParticipants.add(`${rl.visualSource}|${rl.visualTarget}`);
      if (tgtThing?.kind === "object") directParticipants.add(`${rl.visualTarget}|${rl.visualSource}`);
    }
  }

  const afterVisual03 = result.filter(rl => {
    if (!rl.aggregated) return true;
    if (!["instrument", "agent", "effect"].includes(rl.link.type)) return true;
    // Rule 1: source is part of whole that already has direct link of same type
    const whole = partToWhole.get(rl.visualSource);
    if (whole && directLinkKeys.has(`${rl.link.type}|${whole}|${rl.visualTarget}`)) return false;
    // Rule 2: source already has a direct link to same process → resolved enabling is redundant
    if (directParticipants.has(`${rl.visualSource}|${rl.visualTarget}`)) return false;
    return true;
  });

  // R-IH: Structural inheritance — specializations inherit links from their generals
  // Show inherited links as visual connections from the specialization
  for (const thingId of appearances) {
    const inherited = getInheritedLinks(model, thingId);
    for (const iLink of inherited) {
      // Remap: replace general endpoint with specialization
      const generalId = iLink.source === thingId || iLink.target === thingId ? null :
        (model.things.get(iLink.source)?.kind === "object" ? iLink.source : iLink.target);
      if (!generalId) continue;
      const vs = generalId === iLink.source ? thingId : iLink.source;
      const vt = generalId === iLink.target ? thingId : iLink.target;
      if (!appearances.has(vs) || !appearances.has(vt)) continue;
      const key = `inherited|${iLink.type}|${vs}|${vt}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ link: iLink, visualSource: vs, visualTarget: vt, aggregated: true });
      }
    }
  }

  // R-OZ: Out-zoom precedence — when multiple aggregated link types connect the same
  // object-process pair, keep only the highest precedence type.
  // Precedence: consumption = result > effect > agent > instrument (ISO §14 lines 784-796)
  const OZ_PRECEDENCE: Record<string, number> = {
    consumption: 5, result: 5, input: 5, output: 5,
    effect: 4,
    agent: 3,
    instrument: 2,
  };
  const aggPairBest = new Map<string, number>(); // "obj|proc" → best precedence
  for (const rl of afterVisual03) {
    if (!rl.aggregated) continue;
    const objId = model.things.get(rl.visualSource)?.kind === "object" ? rl.visualSource : rl.visualTarget;
    const procId = objId === rl.visualSource ? rl.visualTarget : rl.visualSource;
    const pairKey = `${objId}|${procId}`;
    const prec = OZ_PRECEDENCE[rl.link.type] ?? 0;
    const best = aggPairBest.get(pairKey) ?? -1;
    if (prec > best) aggPairBest.set(pairKey, prec);
  }

  return afterVisual03.filter(rl => {
    if (!rl.aggregated) return true;
    const prec = OZ_PRECEDENCE[rl.link.type] ?? 0;
    const objId = model.things.get(rl.visualSource)?.kind === "object" ? rl.visualSource : rl.visualTarget;
    const procId = objId === rl.visualSource ? rl.visualTarget : rl.visualSource;
    const pairKey = `${objId}|${procId}`;
    return prec >= (aggPairBest.get(pairKey) ?? 0);
  });
}

/**
 * Compute the derived fiber for an OPD (DA-9).
 * The Model is the "god diagram" (Grothendieck colimit ∫ M).
 * Each OPD is a fiber π⁻¹(OPD_i) — a computed view over the total graph.
 *
 * NOTE: This is fiber computation with semantic enrichment, not a pure categorical
 * pullback. It applies: implicit materialization (1-hop connectivity closure),
 * C-01 link distribution (ISO §14.2.2.4.1), and state suppression derivation.
 *
 * Returns:
 *   - things: explicit (with stored appearance) + implicit (connected via link, 1-hop)
 *   - links: resolved links (delegates to resolveLinksForOpd)
 *   - suppressedStates: derived state suppression from child in-zoom OPDs
 */
export function resolveOpdFiber(model: Model, opdId: string): OpdFiber {
  // 1. Explicit things: those with appearances in this OPD
  const things = new Map<string, FiberEntry>();
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) {
      const thing = model.things.get(app.thing);
      if (thing) {
        things.set(app.thing, { thing, appearance: app, implicit: false });
      }
    }
  }

  // 2. Resolved links (C-01 distribution, dedup, etc.)
  const links = resolveLinksForOpd(model, opdId);

  // 3. Implicit things: connected via link to an explicit thing, no appearance in this OPD.
  //    Only 1-hop from explicit — no cascading.
  //    Exclude things that are internal to a child refinement OPD (inside objects — R-IE-8).
  const explicitIds = new Set(things.keys());
  // Collect ALL descendant OPD ids (recursive), not just direct children
  const descendantOpdIds = new Set<string>();
  const collectDescendantOpds = (parentId: string) => {
    for (const o of model.opds.values()) {
      if (o.parent_opd === parentId && !descendantOpdIds.has(o.id)) {
        descendantOpdIds.add(o.id);
        collectDescendantOpds(o.id);
      }
    }
  };
  collectDescendantOpds(opdId);
  const internalToChildOpd = new Set<string>();
  for (const app of model.appearances.values()) {
    if (descendantOpdIds.has(app.opd) && app.internal === true) {
      internalToChildOpd.add(app.thing);
    }
  }

  // Compute bounding box of explicit things to place ghosts outside
  let maxRight = 0;
  let minTop = Infinity;
  for (const entry of things.values()) {
    const r = entry.appearance.x + entry.appearance.w;
    if (r > maxRight) maxRight = r;
    if (entry.appearance.y < minTop) minTop = entry.appearance.y;
  }
  if (!isFinite(minTop)) minTop = 50;
  const ghostStartX = maxRight + 80; // 80px gap after rightmost explicit thing
  const ghostColWidth = 160;
  const ghostRowHeight = 80;
  const ghostCols = 3;

  // First pass: collect implicit candidates
  const implicitCandidates: Array<{ anchorId: string; candidateId: string; thing: Thing }> = [];
  const implicitSeen = new Set<string>();
  for (const link of model.links.values()) {
    collectImplicit(link.source, link.target);
    collectImplicit(link.target, link.source);
  }

  function collectImplicit(anchorId: string, candidateId: string): void {
    if (!explicitIds.has(anchorId)) return;
    if (things.has(candidateId)) return;
    if (implicitSeen.has(candidateId)) return;
    if (internalToChildOpd.has(candidateId)) return; // Inside object of child refinement
    const thing = model.things.get(candidateId);
    if (!thing) return;
    implicitSeen.add(candidateId);
    implicitCandidates.push({ anchorId, candidateId, thing });
  }

  // Second pass: position ghosts in a clean grid to the right of explicit things
  let gridIndex = 0;
  for (const { candidateId, thing } of implicitCandidates) {
    const w = thing.kind === "process" ? 140 : 120;
    const h = 60;
    const x = ghostStartX + (gridIndex % ghostCols) * ghostColWidth;
    const y = minTop + Math.floor(gridIndex / ghostCols) * ghostRowHeight;

    things.set(candidateId, {
      thing,
      appearance: { thing: candidateId, opd: opdId, x, y, w, h },
      implicit: true,
    });
    gridIndex++;
  }

  // 4. State suppression — derived from child in-zoom OPDs (replaces stored C-04)
  const suppressedStates = computeStateSuppression(model, opdId);

  return { things, links, suppressedStates };
}

/**
 * Compute state suppression for an OPD from its child in-zoom refinements.
 * A state s is suppressed in OPD_i when:
 *   ∃ child in-zoom OPD refining thing T:
 *     s.parent is an external thing in child OPD ∧
 *     ∃ link between s.parent and T referencing s
 */
function computeStateSuppression(
  model: Model,
  opdId: string,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  for (const opd of model.opds.values()) {
    if (opd.parent_opd !== opdId) continue;
    if (opd.refinement_type !== "in-zoom") continue;
    if (!opd.refines) continue;

    const refinedThingId = opd.refines;

    // External things in the child OPD: have appearance, not internal, not the container
    for (const app of model.appearances.values()) {
      if (app.opd !== opd.id) continue;
      if (app.thing === refinedThingId) continue;
      if (app.internal) continue;

      const extThingId = app.thing;

      // R-SS-1: Collect internal things in this child OPD (subprocesses + internal objects)
      const childInternalIds = new Set<string>();
      childInternalIds.add(refinedThingId); // container itself
      for (const childApp of model.appearances.values()) {
        if (childApp.opd !== opd.id) continue;
        if (childApp.internal) childInternalIds.add(childApp.thing);
      }

      for (const link of model.links.values()) {
        // R-SS-1: Suppression fires when link connects external thing to container OR any internal thing
        const connects =
          (link.source === extThingId && childInternalIds.has(link.target)) ||
          (link.target === extThingId && childInternalIds.has(link.source));
        if (!connects) continue;

        if (link.source_state) {
          if (!result.has(extThingId)) result.set(extThingId, new Set());
          result.get(extThingId)!.add(link.source_state);
        }
        if (link.target_state) {
          if (!result.has(extThingId)) result.set(extThingId, new Set());
          result.get(extThingId)!.add(link.target_state);
        }
      }
    }
  }

  return result;
}

// === Kernel-Aware Simulation Functions (ADR-003 Fase 5) ===

/**
 * Build a Model from SemanticKernel + OpdAtlas with semantic subprocess ordering.
 * Uses kernel.refinements.steps for process ordering instead of Y-coordinates.
 * The returned Model has appearances with Y-values derived from step ordering,
 * ensuring simulation respects semantic order (not layout-dependent).
 */
export function buildSimulationModel(kernel: SemanticKernel, atlas?: OpdAtlas, layout?: LayoutModel): Model {
  const resolvedAtlas = atlas ?? exposeSemanticKernel(kernel);
  const resolvedLayout = layout ?? { opdLayouts: new Map() };
  const model = legacyModelFromSemanticKernel(kernel, resolvedAtlas, resolvedLayout);

  // Ensure every visible thing in every OPD has an appearance
  for (const [opdId, slice] of resolvedAtlas.nodes) {
    let col = 0;
    for (const thingId of slice.visibleThings) {
      const key = appearanceKey(thingId, opdId);
      if (!model.appearances.has(key)) {
        const isInternal = [...resolvedAtlas.occurrences.values()].some(
          (o) => o.opdId === opdId && o.thingId === thingId && o.role === "internal",
        );
        model.appearances.set(key, {
          thing: thingId, opd: opdId,
          x: 120 + (col % 4) * 180, y: 120 + Math.floor(col / 4) * 120,
          w: 120, h: 60,
          ...(isInternal ? { internal: true } : {}),
        });
        col++;
      }
    }
  }

  // Override Y-positions for in-zoom subprocesses based on kernel step ordering
  for (const refinement of kernel.refinements.values()) {
    if (refinement.kind !== "in-zoom") continue;
    const inZoom = refinement as InZoomRefinement;
    let yBase = 120;
    for (const step of inZoom.steps) {
      for (const thingId of step.thingIds) {
        const key = appearanceKey(thingId, inZoom.childOpd);
        const existing = model.appearances.get(key);
        if (existing) {
          model.appearances.set(key, { ...existing, y: yBase, internal: true });
        } else {
          model.appearances.set(key, {
            thing: thingId, opd: inZoom.childOpd,
            x: 120, y: yBase, w: 120, h: 60, internal: true,
          });
        }
      }
      yBase += 120;
    }
    // Place internal objects
    for (const objId of inZoom.internalObjects) {
      const key = appearanceKey(objId, inZoom.childOpd);
      if (!model.appearances.has(key)) {
        model.appearances.set(key, {
          thing: objId, opd: inZoom.childOpd,
          x: 350, y: 120, w: 120, h: 60, internal: true,
        });
      }
    }
  }

  return model;
}

/**
 * Kernel-aware getExecutableProcesses.
 * Delegates to getExecutableProcessesFromRefinements — no Model intermediate.
 * @deprecated atlas/layout params are ignored; use getExecutableProcessesFromRefinements directly.
 */
export function getExecutableProcessesFromKernel(
  kernel: SemanticKernel,
  _atlas?: OpdAtlas,
  _layout?: LayoutModel,
  maxDepth: number = 10,
): ExecutableProcess[] {
  return getExecutableProcessesFromRefinements(kernel, kernel.refinements, maxDepth);
}

/**
 * Kernel-native link resolution. Uses atlas visibility + refinement step ordering.
 * No Model intermediate — reads things/links/modifiers from OpmDataView (kernel),
 * visibility from OpdAtlas, and subprocess ordering from refinements.
 */
export function resolveLinksForOpdNative(
  data: OpmDataView,
  refinements: ReadonlyMap<string, SemanticRefinement>,
  atlas: OpdAtlas,
  opdId: string,
): ResolvedLink[] {
  // 1. Visibility from atlas
  const slice = atlas.nodes.get(opdId);
  if (!slice) return [];
  const visible = new Set<string>(slice.visibleThings);

  // Semi-fold: find objects with aggregation children — include children as visible
  for (const thingId of slice.visibleThings) {
    const thing = data.things.get(thingId);
    if (thing?.kind === "object") {
      const children = getStructuralChildren(data, thingId, new Set(["aggregation", "exhibition"]));
      for (const { childId } of children) {
        if (!visible.has(childId)) visible.add(childId);
      }
    }
  }

  // 2. Build subprocessToAncestor from refinements (not appearances)
  const subprocessToAncestor = new Map<string, string>();
  const inZoomRefinements = new Map<string, InZoomRefinement>();
  for (const ref of refinements.values()) {
    if (ref.kind === "in-zoom") inZoomRefinements.set(ref.parentThing, ref);
  }

  function registerDescendants(ancestorId: string, processId: string): void {
    const ref = inZoomRefinements.get(processId);
    if (!ref) return;
    for (const step of ref.steps) {
      for (const tid of step.thingIds) {
        const thing = data.things.get(tid);
        if (thing?.kind === "process") {
          subprocessToAncestor.set(tid, ancestorId);
          registerDescendants(ancestorId, tid);
        }
      }
    }
  }

  for (const thingId of visible) {
    const thing = data.things.get(thingId);
    if (thing?.kind === "process") registerDescendants(thingId, thingId);
  }

  // 3. Resolve endpoint visibility
  function resolve(thingId: string): string | null {
    if (visible.has(thingId)) return thingId;
    return subprocessToAncestor.get(thingId) ?? null;
  }

  // 4. Internal objects consumed by subprocesses (suppress aggregated effect/result)
  const internallyConsumedObjects = new Set<string>();
  for (const link of data.links.values()) {
    const isSiblingLink = subprocessToAncestor.has(link.source) || subprocessToAncestor.has(link.target);
    if (!isSiblingLink) continue;
    if (link.type === "consumption") {
      const srcThing = data.things.get(link.source);
      const objId = srcThing?.kind === "object" ? link.source : link.target;
      internallyConsumedObjects.add(objId);
    }
  }

  const result: ResolvedLink[] = [];
  const seen = new Set<string>();

  // Container/internal detection from atlas occurrences
  const opd = data.opds.get(opdId);
  const containerThingId = opd?.refines;
  let internalThings: Set<string> | null = null;
  let subprocessesByOrder: string[] = [];

  if (containerThingId) {
    internalThings = new Set<string>();
    // Internal things from atlas occurrences
    for (const occ of atlas.occurrences.values()) {
      if (occ.opdId === opdId && occ.role === "internal") {
        internalThings.add(occ.thingId);
      }
    }
    // Subprocess order from refinements (C-01, no Y-coords)
    const ref = inZoomRefinements.get(containerThingId);
    if (ref) {
      for (const step of ref.steps) {
        for (const tid of step.thingIds) {
          const thing = data.things.get(tid);
          if (thing?.kind === "process" && tid !== containerThingId) {
            subprocessesByOrder.push(tid);
          }
        }
      }
    }
  }

  // 5. Resolve links (same algorithm as resolveLinksForOpd but with atlas-based data)
  for (const link of data.links.values()) {
    const vs = resolve(link.source);
    const vt = resolve(link.target);
    if (!vs || !vt) continue;
    if (vs === vt) continue;

    // C-01: In-zoom link distribution
    if (containerThingId && internalThings) {
      const isStructural = ["aggregation", "exhibition", "generalization", "classification", "tagged"].includes(link.type);
      const touchesContainer = vs === containerThingId || vt === containerThingId;

      if (touchesContainer && !isStructural) {
        if (subprocessesByOrder.length > 0) {
          const first = subprocessesByOrder[0]!;
          const last = subprocessesByOrder[subprocessesByOrder.length - 1]!;
          const otherEnd = vs === containerThingId ? vt : vs;

          if (link.type === "consumption" || link.type === "input") {
            result.push({ link, visualSource: vs === containerThingId ? first : vs, visualTarget: vt === containerThingId ? first : vt, aggregated: true });
          } else if (link.type === "result" || link.type === "output") {
            result.push({ link, visualSource: vs === containerThingId ? last : vs, visualTarget: vt === containerThingId ? last : vt, aggregated: true });
          } else if (link.type === "effect") {
            // R-ES / R-LD-4: ALL effect links → split to first+last
            const hasStates = !!(link.source_state || link.target_state);
            result.push({ link, visualSource: otherEnd, visualTarget: first, aggregated: true, ...(hasStates ? { splitHalf: "input" as const } : {}) });
            result.push({ link, visualSource: last, visualTarget: otherEnd, aggregated: true, ...(hasStates ? { splitHalf: "output" as const } : {}) });
          } else if (link.type === "invocation" || link.type === "exception") {
            // Simplified: resolve to first internal subprocess
            const targetSp = internalThings.has(link.target) ? link.target : (internalThings.has(link.source) ? link.source : first);
            const finalVs = vs === containerThingId ? targetSp : vs;
            const finalVt = vt === containerThingId ? targetSp : vt;
            if (finalVs !== finalVt) {
              result.push({ link, visualSource: finalVs, visualTarget: finalVt, aggregated: true });
            }
          } else {
            // Agent/instrument only → all subprocesses
            for (const spId of subprocessesByOrder) {
              const dvs = vs === containerThingId ? spId : vs;
              const dvt = vt === containerThingId ? spId : vt;
              const spKey = `${link.type}|${dvs}|${dvt}`;
              if (!seen.has(spKey)) {
                seen.add(spKey);
                result.push({ link, visualSource: dvs, visualTarget: dvt, aggregated: true });
              }
            }
          }
          continue;
        }
      }
      if (!internalThings.has(vs) && !internalThings.has(vt)) continue;
    }

    const isAggregated = vs !== link.source || vt !== link.target;

    if (isAggregated) {
      if (["effect", "result"].includes(link.type)) {
        const srcThing = data.things.get(link.source);
        const objId = srcThing?.kind === "object" ? link.source : link.target;
        if (internallyConsumedObjects.has(objId)) continue;
      }
    }

    const key = `${link.type}|${vs}|${vt}`;
    if (seen.has(key)) {
      if (!isAggregated) {
        const idx = result.findIndex(r =>
          `${r.link.type}|${r.visualSource}|${r.visualTarget}` === key && r.aggregated
        );
        if (idx !== -1) {
          result[idx] = { link, visualSource: vs, visualTarget: vt, aggregated: false };
        }
      }
      continue;
    }
    seen.add(key);
    result.push({ link, visualSource: vs, visualTarget: vt, aggregated: isAggregated });
  }

  // Post-filter: VISUAL-03 and R-OZ (same as resolveLinksForOpd)
  const partToWhole = new Map<string, string>();
  for (const l of data.links.values()) {
    if (l.type === "aggregation") {
      partToWhole.set(l.target, l.source);
      partToWhole.set(l.source, l.target);
    }
  }

  const directLinkKeys = new Set<string>();
  const directParticipants = new Set<string>();
  for (const rl of result) {
    if (!rl.aggregated) {
      directLinkKeys.add(`${rl.link.type}|${rl.visualSource}|${rl.visualTarget}`);
      const srcThing = data.things.get(rl.visualSource);
      const tgtThing = data.things.get(rl.visualTarget);
      if (srcThing?.kind === "object") directParticipants.add(`${rl.visualSource}|${rl.visualTarget}`);
      if (tgtThing?.kind === "object") directParticipants.add(`${rl.visualTarget}|${rl.visualSource}`);
    }
  }

  const afterVisual03 = result.filter(rl => {
    if (!rl.aggregated) return true;
    if (!["instrument", "agent", "effect"].includes(rl.link.type)) return true;
    const whole = partToWhole.get(rl.visualSource);
    if (whole && directLinkKeys.has(`${rl.link.type}|${whole}|${rl.visualTarget}`)) return false;
    if (directParticipants.has(`${rl.visualSource}|${rl.visualTarget}`)) return false;
    return true;
  });

  // R-IH: Structural inheritance
  for (const thingId of visible) {
    const inherited = getInheritedLinks(data, thingId);
    for (const iLink of inherited) {
      const generalId = iLink.source === thingId || iLink.target === thingId ? null :
        (data.things.get(iLink.source)?.kind === "object" ? iLink.source : iLink.target);
      if (!generalId) continue;
      const ivs = generalId === iLink.source ? thingId : iLink.source;
      const ivt = generalId === iLink.target ? thingId : iLink.target;
      if (!visible.has(ivs) || !visible.has(ivt)) continue;
      const ikey = `inherited|${iLink.type}|${ivs}|${ivt}`;
      if (!seen.has(ikey)) {
        seen.add(ikey);
        afterVisual03.push({ link: iLink, visualSource: ivs, visualTarget: ivt, aggregated: true });
      }
    }
  }

  // R-OZ: Out-zoom precedence
  const OZ_PRECEDENCE: Record<string, number> = {
    consumption: 5, result: 5, input: 5, output: 5,
    effect: 4, agent: 3, instrument: 2,
  };
  const aggPairBest = new Map<string, number>();
  for (const rl of afterVisual03) {
    if (!rl.aggregated) continue;
    const objId = data.things.get(rl.visualSource)?.kind === "object" ? rl.visualSource : rl.visualTarget;
    const procId = objId === rl.visualSource ? rl.visualTarget : rl.visualSource;
    const pairKey = `${objId}|${procId}`;
    const prec = OZ_PRECEDENCE[rl.link.type] ?? 0;
    const best = aggPairBest.get(pairKey) ?? -1;
    if (prec > best) aggPairBest.set(pairKey, prec);
  }

  return afterVisual03.filter(rl => {
    if (!rl.aggregated) return true;
    const prec = OZ_PRECEDENCE[rl.link.type] ?? 0;
    const objId = data.things.get(rl.visualSource)?.kind === "object" ? rl.visualSource : rl.visualTarget;
    const procId = objId === rl.visualSource ? rl.visualTarget : rl.visualSource;
    return prec >= (aggPairBest.get(`${objId}|${procId}`) ?? 0);
  });
}

/**
 * Kernel-native OPD fiber computation. Uses atlas for visibility + layout for geometry.
 * No Model intermediate — fiber computation with semantic enrichment
 * (implicit materialization, C-01 distribution, state suppression).
 */
export function resolveOpdFiberNative(
  data: OpmDataView,
  refinements: ReadonlyMap<string, SemanticRefinement>,
  atlas: OpdAtlas,
  layout: LayoutModel,
  opdId: string,
): OpdFiber {
  const slice = atlas.nodes.get(opdId);
  if (!slice) return { things: new Map(), links: [], suppressedStates: new Map() };

  // 1. Explicit things from atlas visibility
  const things = new Map<string, FiberEntry>();
  const opdLayout = layout.opdLayouts?.get(opdId);

  for (const thingId of slice.visibleThings) {
    const thing = data.things.get(thingId);
    if (!thing) continue;
    const layoutNode = opdLayout?.nodes?.get(thingId);
    const appearance: Appearance = {
      thing: thingId,
      opd: opdId,
      x: layoutNode?.x ?? 100,
      y: layoutNode?.y ?? 100,
      w: layoutNode?.w ?? (thing.kind === "process" ? 140 : 120),
      h: layoutNode?.h ?? 60,
    };
    things.set(thingId, { thing, appearance, implicit: false });
  }

  // 2. Resolved links
  const links = resolveLinksForOpdNative(data, refinements, atlas, opdId);

  // 3. Implicit things (1-hop connected, no appearance)
  const explicitIds = new Set(things.keys());
  // Child OPD internal things (exclude from implicit)
  const childRefinements = [...refinements.values()].filter(
    r => r.kind === "in-zoom" && data.opds.get(r.childOpd)?.parent_opd === opdId
  );
  const internalToChildOpd = new Set<string>();
  for (const ref of childRefinements) {
    if (ref.kind === "in-zoom") {
      for (const step of ref.steps) {
        for (const tid of step.thingIds) internalToChildOpd.add(tid);
      }
      for (const oid of ref.internalObjects) internalToChildOpd.add(oid);
    }
  }

  let maxRight = 0;
  let minTop = Infinity;
  for (const entry of things.values()) {
    const r = entry.appearance.x + entry.appearance.w;
    if (r > maxRight) maxRight = r;
    if (entry.appearance.y < minTop) minTop = entry.appearance.y;
  }
  if (!isFinite(minTop)) minTop = 50;
  const ghostStartX = maxRight + 80;
  const ghostColWidth = 160;
  const ghostRowHeight = 80;

  const implicitSeen = new Set<string>();
  const implicitCandidates: Array<{ candidateId: string; thing: Thing }> = [];
  for (const link of data.links.values()) {
    checkImplicit(link.source, link.target);
    checkImplicit(link.target, link.source);
  }
  function checkImplicit(anchorId: string, candidateId: string): void {
    if (!explicitIds.has(anchorId)) return;
    if (things.has(candidateId)) return;
    if (implicitSeen.has(candidateId)) return;
    if (internalToChildOpd.has(candidateId)) return;
    const thing = data.things.get(candidateId);
    if (!thing) return;
    implicitSeen.add(candidateId);
    implicitCandidates.push({ candidateId, thing });
  }

  let gridIndex = 0;
  for (const { candidateId, thing } of implicitCandidates) {
    const w = thing.kind === "process" ? 140 : 120;
    const h = 60;
    things.set(candidateId, {
      thing,
      appearance: {
        thing: candidateId, opd: opdId,
        x: ghostStartX + (gridIndex % 3) * ghostColWidth,
        y: minTop + Math.floor(gridIndex / 3) * ghostRowHeight,
        w, h,
      },
      implicit: true,
    });
    gridIndex++;
  }

  // 4. State suppression from child in-zoom refinements
  const suppressedStates = new Map<string, Set<string>>();
  for (const ref of childRefinements) {
    if (ref.kind !== "in-zoom") continue;
    const refinedThingId = ref.parentThing;
    // External things in child OPD (visible but not internal)
    const childSlice = atlas.nodes.get(ref.childOpd);
    if (!childSlice) continue;
    for (const extId of childSlice.visibleThings) {
      if (extId === refinedThingId) continue;
      // Check if external (not internal role)
      const isInternal = [...atlas.occurrences.values()].some(
        o => o.opdId === ref.childOpd && o.thingId === extId && o.role === "internal"
      );
      if (isInternal) continue;

      for (const link of data.links.values()) {
        const connects =
          (link.source === extId && link.target === refinedThingId) ||
          (link.target === extId && link.source === refinedThingId);
        if (!connects) continue;
        if (link.source_state) {
          if (!suppressedStates.has(extId)) suppressedStates.set(extId, new Set());
          suppressedStates.get(extId)!.add(link.source_state);
        }
        if (link.target_state) {
          if (!suppressedStates.has(extId)) suppressedStates.set(extId, new Set());
          suppressedStates.get(extId)!.add(link.target_state);
        }
      }
    }
  }

  return { things, links, suppressedStates };
}

/**
 * Kernel-aware resolveLinksForOpd.
 * Delegates to resolveLinksForOpdNative — no Model intermediate.
 */
export function resolveLinksForOpdFromKernel(
  kernel: SemanticKernel,
  opdId: string,
  atlas?: OpdAtlas,
  _layout?: LayoutModel,
): ResolvedLink[] {
  const resolvedAtlas = atlas ?? exposeSemanticKernel(kernel);
  return resolveLinksForOpdNative(kernel, kernel.refinements, resolvedAtlas, opdId);
}

/**
 * Kernel-aware resolveOpdFiber.
 * Delegates to resolveOpdFiberNative — no Model intermediate.
 */
export function resolveOpdFiberFromKernel(
  kernel: SemanticKernel,
  opdId: string,
  atlas?: OpdAtlas,
  layout?: LayoutModel,
): OpdFiber {
  const resolvedAtlas = atlas ?? exposeSemanticKernel(kernel);
  const resolvedLayout = layout ?? { opdLayouts: new Map() };
  return resolveOpdFiberNative(kernel, kernel.refinements, resolvedAtlas, resolvedLayout, opdId);
}

// === Coalgebra: c: ModelState → Event × (Precond → ModelState + 1) ===

/**
 * Crear estado inicial del modelo para simulación.
 * Accepts Model or SemanticKernel via OpmDataView.
 */
export function createInitialState(model: OpmDataView): ModelState {
  const objects = new Map<string, ObjectState>();

  for (const [id, thing] of model.things) {
    if (thing.kind === "object") {
      // Buscar estado inicial
      const states = [...model.states.values()].filter(s => s.parent === id);
      const initialState = states.find(s => s.initial) || states[0];

      objects.set(id, {
        exists: true,
        currentState: initialState?.id,
      });
    }
  }

  return {
    objects,
    step: 0,
    timestamp: 0,
    waitingProcesses: new Set(),
  };
}

/**
 * Determine response for a failed precondition based on modifiers on the link
 */
function getResponse(model: OpmDataView, linkId: string): "lost" | "skip" | "wait" {
  const mod = [...model.modifiers.values()].find(m => m.over === linkId);
  if (!mod) return "lost";
  if (mod.type === "event") return "lost";
  if (mod.type === "condition") {
    return mod.condition_mode === "skip" ? "skip" : "wait";
  }
  return "lost";
}

/** Build lookup: linkId → Fan for XOR/OR fans (AND fans use default all-must-pass logic) */
function buildFanLookup(model: OpmDataView): Map<string, Fan> {
  const lookup = new Map<string, Fan>();
  for (const fan of model.fans.values()) {
    if (fan.type === "and") continue;
    for (const mid of fan.members) {
      lookup.set(mid, fan);
    }
  }
  return lookup;
}

/** Check if a single link's precondition is individually satisfied */
function checkLinkPrecondition(
  model: OpmDataView,
  state: ModelState,
  link: Link,
  processId: string,
): PreconditionResult {
  // ISO §8.2.3: negated condition modifier inverts precondition (absence of state / not to exist)
  const modifier = [...model.modifiers.values()].find(m => m.over === link.id);
  const isNegated = modifier?.negated === true;

  if (["consumption", "effect", "input", "output"].includes(link.type)) {
    const srcThing = model.things.get(link.source);
    const processEnd = srcThing?.kind === "process" ? link.source : link.target;
    const objectEnd = srcThing?.kind === "object" ? link.source : link.target;
    if (processEnd !== processId) return { satisfied: true };
    const objState = state.objects.get(objectEnd);

    if (isNegated) {
      // Negated: satisfied when object does NOT exist or is NOT in required state
      if (!objState?.exists) return { satisfied: true };
      const stateRef = link.type === "effect" ? link.source_state : (link.source_state || link.target_state);
      if (stateRef) {
        if (objState.currentState === stateRef) {
          return { satisfied: false, reason: `Object ${objectEnd} IS in negated state`, response: getResponse(model, link.id) };
        }
        return { satisfied: true };
      }
      return { satisfied: false, reason: `Object ${objectEnd} exists (negated)`, response: getResponse(model, link.id) };
    }

    if (!objState?.exists) {
      return { satisfied: false, reason: `Object ${objectEnd} does not exist`, response: getResponse(model, link.id) };
    }
    const stateRef = link.type === "effect" ? link.source_state : (link.source_state || link.target_state);
    if (stateRef) {
      const requiredState = model.states.get(stateRef);
      if (requiredState && objState.currentState !== stateRef) {
        return { satisfied: false, reason: `Object ${objectEnd} not in required state ${requiredState.name}`, response: getResponse(model, link.id) };
      }
    }
  }
  if (["agent", "instrument"].includes(link.type)) {
    if (link.target !== processId) return { satisfied: true };
    const objectId = link.source;
    const objState = state.objects.get(objectId);

    if (isNegated) {
      // Negated enabling: satisfied when agent/instrument does NOT exist
      if (!objState?.exists) return { satisfied: true };
      return { satisfied: false, reason: `${link.type} ${objectId} exists (negated)`, response: getResponse(model, link.id) };
    }

    if (!objState?.exists) {
      return { satisfied: false, reason: `${link.type} ${objectId} does not exist`, response: getResponse(model, link.id) };
    }
    if (link.source_state) {
      const requiredState = model.states.get(link.source_state);
      if (requiredState && objState.currentState !== link.source_state) {
        return { satisfied: false, reason: `${link.type} ${objectId} not in required state ${requiredState.name}`, response: getResponse(model, link.id) };
      }
    }
  }
  return { satisfied: true };
}

/**
 * Choose which fan member links are active for postcondition application.
 * XOR: exactly 1 (probability-weighted or uniform).
 * OR: at least 1 (each member independently included, guarantee >= 1).
 * Accepts Model or SemanticKernel via OpmDataView.
 */
export function chooseFanBranch(model: OpmDataView, fan: Fan, rng: () => number = Math.random): string[] {
  if (fan.type === "xor") {
    const memberLinks = fan.members.map(mid => model.links.get(mid)!);
    const hasProbs = memberLinks.every(l => l.probability != null);
    if (hasProbs) {
      const r = rng();
      let cumulative = 0;
      for (const l of memberLinks) {
        cumulative += l.probability!;
        if (r < cumulative) return [l.id];
      }
      return [memberLinks[memberLinks.length - 1]!.id];
    }
    // Uniform selection
    const idx = Math.floor(rng() * fan.members.length);
    return [fan.members[idx]!];
  }
  if (fan.type === "or") {
    // Each member included with 50% chance, guarantee at least 1
    const selected: string[] = [];
    for (const mid of fan.members) {
      if (rng() < 0.5) selected.push(mid);
    }
    if (selected.length === 0) {
      const idx = Math.floor(rng() * fan.members.length);
      selected.push(fan.members[idx]!);
    }
    return selected;
  }
  // AND: all members
  return [...fan.members];
}

/**
 * Evaluar precondición de un proceso — versión trivalent (C2)
 * Fan-aware: XOR/OR fans require at least 1 member satisfied.
 * AND fans / no fan: all must be satisfied (default behavior).
 * Accepts Model or SemanticKernel via OpmDataView.
 */
export function evaluatePrecondition(
  model: OpmDataView,
  state: ModelState,
  processId: string
): PreconditionResult {
  const links = [...model.links.values()].filter(
    l => l.target === processId || l.source === processId
  );
  const fanLookup = buildFanLookup(model);

  // Group fan member links by fanId to evaluate as groups
  const evaluatedFans = new Set<string>();

  for (const link of links) {
    const fan = fanLookup.get(link.id);
    if (fan) {
      // XOR/OR fan: evaluate as group (skip if already evaluated)
      if (evaluatedFans.has(fan.id)) continue;
      evaluatedFans.add(fan.id);

      const memberLinks = fan.members
        .map(mid => model.links.get(mid))
        .filter((l): l is Link => l != null);

      // At least one member must be satisfied
      let anySatisfied = false;
      let lastFailure: PreconditionResult | null = null;
      for (const ml of memberLinks) {
        const result = checkLinkPrecondition(model, state, ml, processId);
        if (result.satisfied) {
          anySatisfied = true;
          break;
        }
        lastFailure = result;
      }
      if (!anySatisfied && lastFailure) {
        return lastFailure;
      }
    } else {
      // Non-fan link: evaluate individually (AND semantics)
      const result = checkLinkPrecondition(model, state, link, processId);
      if (!result.satisfied) return result;
    }
  }

  return { satisfied: true };
}

/**
 * Ejecutar un paso de simulación (evaluación coalgébrica).
 * Implements c: S → F(S) where F(S) = Event × (PreconditionResult → S + 1).
 * Accepts Model or SemanticKernel via OpmDataView.
 */
export function simulationStep(
  model: OpmDataView,
  state: ModelState,
  event: SimulationEvent,
  rng: () => number = Math.random,
): SimulationStep {
  const step: SimulationStep = {
    step: state.step + 1,
    event,
    preconditionMet: false,
    skipped: false,
    consumptionIds: [],
    resultIds: [],
    stateChanges: [],
    newState: {
      ...state,
      // Deep-copy each ObjectState so mutations don't leak to prior steps
      objects: new Map([...state.objects].map(([k, v]) => [k, { ...v }])),
      waitingProcesses: new Set(state.waitingProcesses),
      step: state.step + 1,
    },
  };

  // Encontrar proceso a ejecutar basado en evento
  let processId: string | undefined;

  if (event.kind === "manual" && event.targetId) {
    // Manual events: targetId IS the processId directly
    if (model.things.get(event.targetId)?.kind === "process") {
      processId = event.targetId;
    }
  } else if (event.kind === "object-entered-state" && event.targetId) {
    // Encontrar procesos que tienen event link desde este objeto
    for (const [id, link] of model.links) {
      const mod = [...model.modifiers.values()].find(m => m.over === id && m.type === "event");
      if (mod && link.source === event.targetId) {
        processId = link.target;
        break;
      }
    }
  }

  if (!processId) {
    step.skipped = true;
    return step;
  }

  step.processId = processId;
  step.processName = model.things.get(processId)?.name;

  // Evaluar precondición
  const precondition = evaluatePrecondition(model, step.newState, processId);
  step.preconditionMet = precondition.satisfied;

  if (!precondition.satisfied) {
    if (precondition.response === "wait") {
      step.newState.waitingProcesses.add(processId);
    }
    step.skipped = true;
    return step;
  }

  // Ejecutar efectos del proceso — phased: consumption → effect → result
  // Phase ordering: consumption (destroy) → effect (state change) → result (create)
  const links = [...model.links.values()].filter(l => l.target === processId || l.source === processId);

  // Fan-aware link filtering: for XOR/OR fans, choose active branches
  const activeFanLinks = new Set<string>();
  const suppressedFanLinks = new Set<string>();
  const fanLookup = buildFanLookup(model);
  const resolvedFans = new Set<string>();
  for (const link of links) {
    const fan = fanLookup.get(link.id);
    if (!fan || resolvedFans.has(fan.id)) continue;
    resolvedFans.add(fan.id);
    const chosen = chooseFanBranch(model, fan, rng);
    const chosenSet = new Set(chosen);
    for (const mid of fan.members) {
      if (chosenSet.has(mid)) activeFanLinks.add(mid);
      else suppressedFanLinks.add(mid);
    }
  }

  function isLinkActive(linkId: string): boolean {
    if (suppressedFanLinks.has(linkId)) return false;
    return true;
  }

  // Phase 1: Consumption — objeto deja de existir
  for (const link of links) {
    if (link.type !== "consumption") continue;
    if (!isLinkActive(link.id)) continue;
    const srcThing = model.things.get(link.source);
    const objId = srcThing?.kind === "object" ? link.source : link.target;
    const obj = step.newState.objects.get(objId);
    if (obj) {
      obj.exists = false;
      step.consumptionIds.push(objId);
      // Unfold cascade: consuming a whole also consumes its aggregation parts
      for (const aggLink of model.links.values()) {
        if (aggLink.type === "aggregation" && aggLink.source === objId) {
          const partObj = step.newState.objects.get(aggLink.target);
          if (partObj) { partObj.exists = false; step.consumptionIds.push(aggLink.target); }
        }
      }
    }
  }

  // Phase 2: Effect — cambio de estado (bidirectional per ISO, detect object by kind)
  for (const link of links) {
    if (link.type !== "effect") continue;
    if (!isLinkActive(link.id)) continue;
    const srcThing = model.things.get(link.source);
    const objId = srcThing?.kind === "object" ? link.source : link.target;
    const obj = step.newState.objects.get(objId);
    if (obj && link.target_state) {
      const fromState = obj.currentState;
      obj.currentState = link.target_state;
      step.stateChanges.push({ objectId: objId, fromState, toState: link.target_state });
    }
  }

  // Phase 3: Result — objeto comienza a existir
  for (const link of links) {
    if (link.type !== "result") continue;
    if (!isLinkActive(link.id)) continue;
    const objId = link.target;
    let obj = step.newState.objects.get(objId);
    if (!obj) {
      obj = { exists: true };
      step.newState.objects.set(objId, obj);
    }
    obj.exists = true;
    if (link.target_state) {
      obj.currentState = link.target_state;
    } else if (!obj.currentState) {
      // ISO: re-created object resets to initial state
      const initialState = [...model.states.values()].find(s => s.parent === objId && s.initial);
      if (initialState) obj.currentState = initialState.id;
    }
    step.resultIds.push(objId);
    // Unfold cascade: creating a whole also creates its aggregation parts
    for (const aggLink of model.links.values()) {
      if (aggLink.type === "aggregation" && aggLink.source === objId) {
        let partObj = step.newState.objects.get(aggLink.target);
        if (!partObj) {
          partObj = { exists: true };
          step.newState.objects.set(aggLink.target, partObj);
        }
        if (!partObj.exists) {
          partObj.exists = true;
          const initState = [...model.states.values()].find(s => s.parent === aggLink.target && s.initial);
          if (initState) partObj.currentState = initState.id;
          step.resultIds.push(aggLink.target);
        }
      }
    }
  }

  // Duration simulation: compute elapsed time and check exception conditions
  const processThing = model.things.get(processId);
  if (processThing?.duration) {
    const d = processThing.duration;
    // Simulate actual duration (use nominal, or random within min-max if distribution exists)
    let actualDuration = d.nominal;
    if (d.distribution?.name === "uniform" && d.min != null && d.max != null) {
      actualDuration = d.min + rng() * (d.max - d.min);
    } else if (d.distribution?.name === "normal" && d.distribution.params) {
      // Box-Muller approximation for normal
      const mean = d.distribution.params.mean ?? d.nominal;
      const sd = d.distribution.params.sd ?? (d.max != null ? (d.max - d.nominal) / 3 : d.nominal * 0.1);
      const u1 = rng() || 0.001;
      const u2 = rng();
      actualDuration = mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    step.duration = actualDuration;
    step.newState.timestamp += actualDuration;

    // Check exception conditions (ISO §9.5.4)
    if (d.max != null && actualDuration > d.max) {
      step.exceptionTriggered = "overtime";
    } else if (d.min != null && actualDuration < d.min) {
      step.exceptionTriggered = "undertime";
    }
  }

  return step;
}

/**
 * Ejecutar simulación completa hasta completar o alcanzar maxSteps.
 * Re-evaluates waitingProcesses each iteration and detects deadlock.
 *
 * Deadlock detection is empirical (no-progress + waiting processes), not based
 * on state-space fixed-point analysis or dependency graph cycle detection.
 * The MAX_WAIT_STEPS timeout (20 steps) is a pragmatic heuristic.
 */
export function runSimulation(
  model: Model,
  initialState?: ModelState,
  maxSteps: number = 100,
  rng: () => number = Math.random,
  scenarioId?: string,
): SimulationTrace {
  const state = initialState ?? createInitialState(model);
  const steps: SimulationStep[] = [];
  let currentState = state;

  // Expand in-zoomed processes into executable leaves (ISO §14.2.1)
  let executableProcesses = getExecutableProcesses(model);

  // Scenario filter: only execute processes connected by links on this scenario's path
  const scenario = scenarioId ? model.scenarios.get(scenarioId) : undefined;
    if (scenario && scenario.path_labels.length > 0) {
      const pathLabels = new Set(scenario.path_labels);
      const scenarioLinks = [...model.links.values()].filter(l => l.path_label && pathLabels.has(l.path_label));
      const scenarioProcessIds = new Set<string>();
      for (const link of scenarioLinks) {
        const src = model.things.get(link.source);
        const tgt = model.things.get(link.target);
        if (src?.kind === "process") scenarioProcessIds.add(src.id);
        if (tgt?.kind === "process") scenarioProcessIds.add(tgt.id);
      }
      if (scenarioProcessIds.size > 0) {
        executableProcesses = executableProcesses.filter(ep =>
          scenarioProcessIds.has(ep.id) || (ep.parentProcessId && scenarioProcessIds.has(ep.parentProcessId))
        );
    }
  }

  // Track completed processes — a process executes at most once per simulation
  // (re-activation via invocation link — ISO §9.5.2.5.1)
  const completedProcesses = new Set<string>();
  const allowedProcessIds = new Set(executableProcesses.map(ep => ep.id));
  const selfInvocationCount = new Map<string, number>();
  const waitingSince = new Map<string, number>(); // processId → step when started waiting
  // MAX_WAIT_STEPS defined at module scope
  const pendingInvocations = new Map<string, string>(); // targetId → sourceId (who invoked it)
  let totalInvocations = 0; // Global guard against infinite invocation chains

  /** Phase 3: process invocation links from a just-completed process.
   *  Returns true if any invocation was triggered (for wave snapshot invalidation). */
  function processInvocations(justCompleted: string): boolean {
    let triggered = false;
    for (const link of model.links.values()) {
      if (link.type !== "invocation" || link.source !== justCompleted) continue;
      const targetId = link.target;
      const isSelf = targetId === justCompleted;

      // Self-invocation guard (Approach A)
      if (isSelf) {
        const count = selfInvocationCount.get(targetId) ?? 0;
        if (count >= MAX_SELF_INVOCATIONS) continue;
        selfInvocationCount.set(targetId, count + 1);
      } else {
        // Reset self-invocation counter when invoked by another process
        selfInvocationCount.delete(targetId);
      }

      // Re-enable target: invocation resets a process's "completed" status so it can
      // fire again. Without this, an invoked process that already ran in this wave
      // would be skipped by the completedProcesses guard (SIM-BUG-01).
      completedProcesses.delete(targetId);
      if (++totalInvocations > MAX_INVOCATION_CHAIN_DEPTH) continue;
      pendingInvocations.set(targetId, justCompleted);
      triggered = true;
    }
    return triggered;
  }

  /** Enrich step with invocation and in-zoom context */
  function enrichStep(stepResult: SimulationStep, processId: string): void {
    const ep = executableProcesses.find(p => p.id === processId);
    if (ep?.parentProcessId) {
      stepResult.parentProcessId = ep.parentProcessId;
      stepResult.opdContext = ep.opdId;
    }
    if (pendingInvocations.has(processId)) {
      stepResult.invokedBy = pendingInvocations.get(processId);
      pendingInvocations.delete(processId);
    }
  }

  // Wave state for parallel subprocess semantics (ISO §14.2.2.2)
  // Processes at the same Y-level form a wave; preconditions are evaluated
  // against a snapshot taken when the wave starts (parallel pre-image).
  //
  // R-TI-4 Barrier semantics: The wave snapshot ensures all processes at the same
  // Y-level evaluate preconditions against the pre-image (state before any of them
  // executed). A waiting process at Y=N does NOT block advancement to Y=N+1 — ISO
  // parallel semantics allow independent branches to proceed. The barrier is about
  // evaluation consistency (snapshot), not execution blocking. Waiting processes
  // are re-evaluated each iteration in Phase 1.
  let currentWaveOrder: number | null = null;
  let waveSnapshot: ModelState | null = null;

  for (let i = 0; i < maxSteps; i++) {
    let executed = false;

    // Guard: ensure state integrity after mutations (defensive)
    if (!(currentState.waitingProcesses instanceof Set)) {
      currentState = { ...currentState, waitingProcesses: new Set() };
    }
    if (!(currentState.objects instanceof Map)) {
      break; // Corrupted state — stop simulation
    }

    // Phase 1: Re-evaluar procesos en espera primero (against currentState, not snapshot)
    for (const waitingId of [...currentState.waitingProcesses]) {
      // Scenario filter: skip processes not in allowed set
      if (!allowedProcessIds.has(waitingId)) continue;
      // Track waiting duration — timeout if exceeded
      if (!waitingSince.has(waitingId)) waitingSince.set(waitingId, i);
      if (i - (waitingSince.get(waitingId) ?? 0) > MAX_WAIT_STEPS) {
        // Timeout: remove from waiting, mark as completed (timed out)
        currentState = {
          ...currentState,
          waitingProcesses: new Set([...currentState.waitingProcesses].filter(id => id !== waitingId)),
        };
        completedProcesses.add(waitingId);
        waitingSince.delete(waitingId);
        continue;
      }
      const precond = evaluatePrecondition(model, currentState, waitingId);
      if (precond.satisfied) {
        waitingSince.delete(waitingId);
        const unblocked: ModelState = {
          ...currentState,
          objects: new Map(currentState.objects),
          waitingProcesses: new Set([...currentState.waitingProcesses].filter(id => id !== waitingId)),
        };
        const event: SimulationEvent = { kind: "manual", targetId: waitingId };
        const stepResult = simulationStep(model, unblocked, event, rng);
        if (!stepResult.skipped) {
          enrichStep(stepResult, waitingId);
          steps.push(stepResult);
          currentState = stepResult.newState;
          completedProcesses.add(waitingId);
          processInvocations(waitingId);
          executed = true;
          // State changed out-of-band — invalidate wave snapshot
          currentWaveOrder = null;
          waveSnapshot = null;
          break;
        }
      }
    }

    if (executed) continue;

    // Phase 2: Wave-based execution with snapshot semantics (ISO §14.2.2.2)
    for (const ep of executableProcesses) {
      if (currentState.waitingProcesses.has(ep.id)) continue;
      if (completedProcesses.has(ep.id)) continue;

      // Wave transition: take snapshot when entering a new Y-level
      if (currentWaveOrder === null || ep.order !== currentWaveOrder) {
        currentWaveOrder = ep.order;
        // Deep-copy ObjectState values so mutations in simulationStep don't affect snapshot
        const snapshotObjects = new Map<string, ObjectState>();
        for (const [id, objState] of currentState.objects) {
          snapshotObjects.set(id, { ...objState });
        }
        waveSnapshot = {
          ...currentState,
          objects: snapshotObjects,
          waitingProcesses: new Set(currentState.waitingProcesses),
        };
      }

      // Evaluate precondition against wave snapshot (parallel semantics)
      const precond = evaluatePrecondition(model, waveSnapshot!, ep.id);
      if (!precond.satisfied) {
        if (precond.response === "wait") {
          currentState = {
            ...currentState,
            objects: new Map(currentState.objects),
            waitingProcesses: new Set([...currentState.waitingProcesses, ep.id]),
          };
        } else {
          // lost/skip: mark completed so barrier can clear
          completedProcesses.add(ep.id);
        }
        continue;
      }

      const event: SimulationEvent = { kind: "manual", targetId: ep.id };
      const stepResult = simulationStep(model, currentState, event, rng);

      if (!stepResult.skipped) {
        enrichStep(stepResult, ep.id);
        steps.push(stepResult);
        currentState = stepResult.newState;
        completedProcesses.add(ep.id);
        const invoked = processInvocations(ep.id);

        // Exception handling (ISO §9.5.4): if duration triggered overtime/undertime,
        // find and schedule the exception handler process
        if (stepResult.exceptionTriggered && stepResult.processId) {
          for (const link of model.links.values()) {
            if (link.type !== "exception" || link.source !== stepResult.processId) continue;
            // Match exception type: overtime=default, undertime if link.exception_type matches
            const linkType = link.exception_type ?? "overtime";
            if (linkType === stepResult.exceptionTriggered) {
              completedProcesses.delete(link.target);
              pendingInvocations.set(link.target, stepResult.processId);
            }
          }
        }

        // Event trigger: state changes fire event-linked processes (ISO §8.2.1)
        for (const sc of stepResult.stateChanges) {
          if (!sc.toState) continue;
          for (const link of model.links.values()) {
            const mod = [...model.modifiers.values()].find(m => m.over === link.id && m.type === "event");
            if (!mod) continue;
            if (link.source !== sc.objectId) continue;
            // Event fires: schedule the target process
            const targetProc = model.things.get(link.target);
            if (targetProc?.kind === "process" && allowedProcessIds.has(link.target)) {
              completedProcesses.delete(link.target);
              pendingInvocations.set(link.target, stepResult.processId ?? "");
            }
          }
        }

        if (invoked) {
          // Invocation re-enabled a process — invalidate wave snapshot
          currentWaveOrder = null;
          waveSnapshot = null;
        }
        executed = true;
        break;
      } else {
        // R-BC-4: When subprocess skipped (condition_mode=skip), auto-advance to next subprocess
        if (ep.parentProcessId && stepResult.processId) {
          completedProcesses.add(ep.id);
          // Find next subprocess in sequence
          const siblingIdx = executableProcesses.findIndex(p => p.id === ep.id);
          if (siblingIdx >= 0 && siblingIdx < executableProcesses.length - 1) {
            const next = executableProcesses[siblingIdx + 1];
            if (next?.parentProcessId === ep.parentProcessId) {
              completedProcesses.delete(next.id);
            }
          }
        }
        // Snapshot said satisfied but execution failed (parallel conflict) — mark completed
        completedProcesses.add(ep.id);
        if (stepResult.processId && stepResult.newState.waitingProcesses.has(stepResult.processId)) {
          currentState = stepResult.newState;
        }
      }
    }

    if (!executed) {
      if (currentState.waitingProcesses.size > 0) {
        return {
          steps, finalState: currentState, completed: false, deadlocked: true,
          assertionResults: verifyAssertions(model, currentState, steps).length > 0 ? verifyAssertions(model, currentState, steps) : undefined,
        };
      }
      break;
    }
  }

  // Post-simulation assertion verification (ISO §8.3)
  const assertionResults = verifyAssertions(model, currentState, steps);
  const totalDuration = currentState.timestamp - state.timestamp;

  return {
    steps,
    finalState: currentState,
    completed: steps.length < maxSteps,
    deadlocked: false,
    assertionResults: assertionResults.length > 0 ? assertionResults : undefined,
    totalDuration: totalDuration > 0 ? totalDuration : undefined,
  };
}

/** Monte Carlo simulation — run N times with different RNG seeds */
export interface MonteCarloResult {
  runs: number;
  completedCount: number;
  deadlockedCount: number;
  avgSteps: number;
  avgDuration: number | null;
  assertionPassRate: Record<string, number>; // assertionId → pass rate (0-1)
  exceptionRate: Record<string, number>; // processName → exception frequency
}

export function runMonteCarloSimulation(
  model: Model,
  runs: number = 100,
  maxSteps: number = 100,
): MonteCarloResult {
  let completedCount = 0;
  let deadlockedCount = 0;
  let totalSteps = 0;
  let totalDuration = 0;
  let durationCount = 0;
  const assertionPassCounts: Record<string, number> = {};
  const assertionTotalCounts: Record<string, number> = {};
  const exceptionCounts: Record<string, number> = {};

  // Simple seeded RNG (mulberry32)
  function makeRng(seed: number): () => number {
    let s = seed;
    return () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  for (let i = 0; i < runs; i++) {
    const rng = makeRng(i * 31337 + 42);
    const trace = runSimulation(model, undefined, maxSteps, rng);

    totalSteps += trace.steps.length;
    if (trace.completed) completedCount++;
    if (trace.deadlocked) deadlockedCount++;
    if (trace.totalDuration != null) {
      totalDuration += trace.totalDuration;
      durationCount++;
    }

    // Assertion pass tracking
    if (trace.assertionResults) {
      for (const ar of trace.assertionResults) {
        assertionTotalCounts[ar.assertionId] = (assertionTotalCounts[ar.assertionId] ?? 0) + 1;
        if (ar.passed) assertionPassCounts[ar.assertionId] = (assertionPassCounts[ar.assertionId] ?? 0) + 1;
      }
    }

    // Exception tracking
    for (const step of trace.steps) {
      if (step.exceptionTriggered && step.processName) {
        const key = `${step.processName} (${step.exceptionTriggered})`;
        exceptionCounts[key] = (exceptionCounts[key] ?? 0) + 1;
      }
    }
  }

  const assertionPassRate: Record<string, number> = {};
  for (const [id, total] of Object.entries(assertionTotalCounts)) {
    assertionPassRate[id] = (assertionPassCounts[id] ?? 0) / total;
  }

  const exceptionRate: Record<string, number> = {};
  for (const [key, count] of Object.entries(exceptionCounts)) {
    exceptionRate[key] = count / runs;
  }

  return {
    runs,
    completedCount,
    deadlockedCount,
    avgSteps: totalSteps / runs,
    avgDuration: durationCount > 0 ? totalDuration / durationCount : null,
    assertionPassRate,
    exceptionRate,
  };
}

/** Verify model assertions against final simulation state */
function verifyAssertions(model: OpmDataView, finalState: ModelState, steps: SimulationStep[]): AssertionResult[] {
  const results: AssertionResult[] = [];
  for (const assertion of model.assertions.values()) {
    if (!assertion.enabled) continue;
    const result: AssertionResult = {
      assertionId: assertion.id,
      name: assertion.predicate,
      category: assertion.category,
      passed: false,
    };

    // Pattern matching on predicate text
    const pred = assertion.predicate.toLowerCase();

    // Pattern: "after <Process>, <Object> is <state>"
    const afterMatch = pred.match(/after\s+(.+?),\s+(.+?)\s+is\s+(.+)/);
    if (afterMatch) {
      const [, procName, objName, stateName] = afterMatch;
      const proc = [...model.things.values()].find(t => t.name.toLowerCase() === procName?.trim());
      const obj = [...model.things.values()].find(t => t.name.toLowerCase() === objName?.trim());
      if (proc && obj) {
        // Check if process was executed directly OR via subprocesses (in-zoom)
        const wasExecuted = steps.some(s => !s.skipped && (s.processId === proc.id || s.parentProcessId === proc.id));
        const objState = finalState.objects?.get(obj.id);
        const targetState = [...model.states.values()].find(s => s.parent === obj.id && s.name.toLowerCase() === stateName?.trim());
        if (wasExecuted && objState && targetState && objState.currentState === targetState.id) {
          result.passed = true;
        } else {
          result.reason = wasExecuted
            ? `${obj.name} is in state ${objState?.currentState ? model.states.get(objState.currentState)?.name : "unknown"}, expected ${stateName}`
            : `${proc.name} was not executed`;
        }
      } else {
        result.reason = `Could not resolve entities in predicate`;
      }
      results.push(result);
      continue;
    }

    // Pattern: "<Process> requires <Object> <state>"
    const reqMatch = pred.match(/(.+?)\s+requires\s+(.+?)\s+(.+)/);
    if (reqMatch) {
      const [, procName, objName, qualifier] = reqMatch;
      const proc = [...model.things.values()].find(t => t.name.toLowerCase() === procName?.trim());
      const obj = [...model.things.values()].find(t => t.name.toLowerCase() === objName?.trim());
      if (proc && obj) {
        const objState = finalState.objects?.get(obj.id);
        if (objState?.exists) {
          result.passed = true;
        } else {
          result.reason = `${obj.name} does not exist`;
        }
      }
      results.push(result);
      continue;
    }

    // Pattern: "<Object> exists" or "<Object> does not exist"
    const existsMatch = pred.match(/^(.+?)\s+(exists|does not exist)$/);
    if (existsMatch) {
      const [, objName, verb] = existsMatch;
      const obj = [...model.things.values()].find(t => t.name.toLowerCase() === objName?.trim());
      if (obj) {
        const objState = finalState.objects?.get(obj.id);
        const exists = objState?.exists ?? false;
        const shouldExist = verb === "exists";
        result.passed = exists === shouldExist;
        if (!result.passed) result.reason = `${obj.name} ${exists ? "exists" : "does not exist"}`;
      } else {
        result.reason = `Object "${objName}" not found`;
      }
      results.push(result);
      continue;
    }

    // Pattern: "<Object> is <state>"
    const isMatch = pred.match(/^(.+?)\s+is\s+(.+)$/);
    if (isMatch) {
      const [, objName, stateName] = isMatch;
      const obj = [...model.things.values()].find(t => t.name.toLowerCase() === objName?.trim());
      if (obj) {
        const objState = finalState.objects?.get(obj.id);
        const targetState = [...model.states.values()].find(s => s.parent === obj.id && s.name.toLowerCase() === stateName?.trim());
        if (targetState && objState?.currentState === targetState.id) {
          result.passed = true;
        } else {
          const currentName = objState?.currentState ? model.states.get(objState.currentState)?.name : "unknown";
          result.reason = `${obj.name} is ${currentName}, expected ${stateName}`;
        }
      } else {
        result.reason = `Object "${objName}" not found`;
      }
      results.push(result);
      continue;
    }

    // Unknown pattern — mark as inconclusive
    result.reason = "Predicate pattern not recognized";
    results.push(result);
  }
  return results;
}

/**
 * Obtener preprocess object set de un proceso.
 * Accepts Model or SemanticKernel via OpmDataView.
 */
export function getPreprocessSet(
  model: OpmDataView,
  processId: string
): Array<{ objectId: string; objectType: "consumee" | "affectee" | "agent" | "instrument" }> {
  const result: Array<{ objectId: string; objectType: "consumee" | "affectee" | "agent" | "instrument" }> = [];

  for (const link of model.links.values()) {
    // Consumption: source=object, target=process (ISO direction) — detect by kind
    if (link.type === "consumption") {
      const srcThing = model.things.get(link.source);
      const processEnd = srcThing?.kind === "process" ? link.source : link.target;
      const objectEnd = srcThing?.kind === "object" ? link.source : link.target;
      if (processEnd === processId) {
        result.push({ objectId: objectEnd, objectType: "consumee" });
      }
    }
    // Effect: source=process, target=object
    if (link.source === processId && link.type === "effect") {
      result.push({ objectId: link.target, objectType: "affectee" });
    }
    // Enabling links: source=object, target=process
    if (link.target === processId && link.type === "agent") {
      result.push({ objectId: link.source, objectType: "agent" });
    }
    if (link.target === processId && link.type === "instrument") {
      result.push({ objectId: link.source, objectType: "instrument" });
    }
  }

  return result;
}

/**
 * Obtener postprocess object set de un proceso.
 * Accepts Model or SemanticKernel via OpmDataView.
 */
export function getPostprocessSet(
  model: OpmDataView,
  processId: string
): Array<{ objectId: string; objectType: "resultee" | "affectee" }> {
  const result: Array<{ objectId: string; objectType: "resultee" | "affectee" }> = [];

  for (const link of model.links.values()) {
    // Result: source=process, target=object
    if (link.source === processId && link.type === "result") {
      result.push({ objectId: link.target, objectType: "resultee" });
    }
    // Effect: source=process, target=object (affectee appears in both pre and post)
    if (link.source === processId && link.type === "effect") {
      result.push({ objectId: link.target, objectType: "affectee" });
    }
  }

  return result;
}

/** Render simulation trace as human-readable OPL-like text */
export function renderTrace(model: Model, trace: SimulationTrace): string {
  const lines: string[] = [];
  lines.push(`Simulation of ${model.meta.name}: ${trace.steps.length} steps, ${trace.completed ? "completed" : trace.deadlocked ? "deadlocked" : "in progress"}`);
  if (trace.totalDuration != null) lines.push(`Total duration: ${trace.totalDuration.toFixed(1)}`);
  lines.push("");

  for (const step of trace.steps) {
    if (step.skipped) continue;
    const proc = step.processName ?? step.processId ?? "?";
    let line = `${step.step}. ${proc}`;
    if (step.invokedBy) {
      const invoker = model.things.get(step.invokedBy)?.name ?? step.invokedBy;
      line += ` (invoked by ${invoker})`;
    }
    if (step.duration != null) line += ` [${step.duration.toFixed(1)}]`;
    if (step.exceptionTriggered) line += ` ⚠ ${step.exceptionTriggered}`;
    lines.push(line);

    for (const id of step.consumptionIds) {
      lines.push(`   consumed ${model.things.get(id)?.name ?? id}`);
    }
    for (const id of step.resultIds) {
      lines.push(`   created ${model.things.get(id)?.name ?? id}`);
    }
    for (const sc of step.stateChanges) {
      const obj = model.things.get(sc.objectId)?.name ?? sc.objectId;
      const from = sc.fromState ? model.states.get(sc.fromState)?.name : "—";
      const to = sc.toState ? model.states.get(sc.toState)?.name : "—";
      lines.push(`   ${obj}: ${from} → ${to}`);
    }
  }

  if (trace.assertionResults && trace.assertionResults.length > 0) {
    lines.push("");
    lines.push("Assertions:");
    for (const ar of trace.assertionResults) {
      lines.push(`  ${ar.passed ? "✓" : "✗"} [${ar.category}] ${ar.name}${ar.reason ? ` — ${ar.reason}` : ""}`);
    }
  }

  return lines.join("\n");
}

// === Kernel-Native Simulation (ADR-003: no Model intermediate) ===

/**
 * Expand in-zoomed processes into executable leaves using kernel refinement steps.
 * Unlike getExecutableProcesses (which reads appearance Y-coordinates),
 * this function derives subprocess ordering from SemanticKernel.refinements.steps,
 * eliminating the layout→semantics dependency (C-3 fix).
 *
 * For parallel steps (step.execution === "parallel"), all processes share the same order.
 */
export function getExecutableProcessesFromRefinements(
  data: OpmDataView,
  refinements: ReadonlyMap<string, SemanticRefinement>,
  maxDepth: number = 10,
): ExecutableProcess[] {
  const result: ExecutableProcess[] = [];

  // Build lookup: processId → refinement (in-zoom or unfold)
  const inZoomRefinements = new Map<string, InZoomRefinement>();
  const unfoldRefinements = new Map<string, UnfoldRefinement>();
  for (const ref of refinements.values()) {
    if (ref.kind === "in-zoom") {
      inZoomRefinements.set(ref.parentThing, ref);
    } else if (ref.kind === "unfold") {
      unfoldRefinements.set(ref.parentThing, ref);
    }
  }

  // Track all subprocess IDs to exclude from top-level
  const subprocessIds = new Set<string>();
  for (const ref of inZoomRefinements.values()) {
    for (const step of ref.steps) {
      for (const tid of step.thingIds) {
        const thing = data.things.get(tid);
        if (thing?.kind === "process") subprocessIds.add(tid);
      }
    }
  }
  for (const ref of unfoldRefinements.values()) {
    for (const tid of ref.refineeThings) {
      const thing = data.things.get(tid);
      if (thing?.kind === "process") subprocessIds.add(tid);
    }
  }

  function expand(processId: string, parentId: string | undefined, depth: number): void {
    if (depth > maxDepth) return;
    const ref = inZoomRefinements.get(processId);
    const unfoldRef = unfoldRefinements.get(processId);

    if (!ref && !unfoldRef) {
      // Leaf process — directly executable
      const thing = data.things.get(processId);
      if (!thing) return;
      const parentChildOpd = parentId
        ? (inZoomRefinements.get(parentId)?.childOpd ?? unfoldRefinements.get(parentId)?.childOpd)
        : undefined;
      result.push({
        id: processId,
        name: thing.name,
        order: 0,
        parentProcessId: parentId,
        opdId: parentChildOpd,
      });
      return;
    }

    if (ref && ref.steps.length > 0) {
      // Expand in-zoom subprocesses using semantic step ordering
      let stepOrder = 0;
      for (const step of ref.steps) {
        const processThings = step.thingIds
          .map(tid => ({ id: tid, thing: data.things.get(tid) }))
          .filter((e): e is { id: string; thing: Thing } => e.thing?.kind === "process");

        for (const { id: spId } of processThings) {
          expand(spId, processId, depth + 1);
          const last = result[result.length - 1];
          if (last && last.id === spId) {
            last.order = stepOrder;
            last.opdId = ref.childOpd;
          }
        }
        if (step.execution === "sequential") stepOrder++;
      }
    } else if (unfoldRef && unfoldRef.refineeThings.length > 0) {
      // Expand unfold subprocesses — all share same order (structural, not sequential)
      for (const tid of unfoldRef.refineeThings) {
        const thing = data.things.get(tid);
        if (!thing || thing.kind !== "process") continue;
        expand(tid, processId, depth + 1);
        const last = result[result.length - 1];
        if (last && last.id === tid) {
          last.order = 0;
          last.opdId = unfoldRef.childOpd;
        }
      }
    } else {
      // Refinement exists but empty — execute parent directly
      const thing = data.things.get(processId);
      if (!thing) return;
      result.push({ id: processId, name: thing.name, order: 0, parentProcessId: parentId });
    }
  }

  // Start with top-level processes only
  const topLevelProcesses = [...data.things.values()]
    .filter(t => t.kind === "process" && !subprocessIds.has(t.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const thing of topLevelProcesses) {
    expand(thing.id, undefined, 0);
  }

  // Sort by semantic order, then by duration (shortest first), then by ID
  result.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const durA = data.things.get(a.id)?.duration?.nominal ?? Infinity;
    const durB = data.things.get(b.id)?.duration?.nominal ?? Infinity;
    if (durA !== durB) return durA - durB;
    return a.id.localeCompare(b.id);
  });

  return result;
}

/**
 * Kernel-native simulation: run complete simulation on SemanticKernel directly.
 * No Model intermediate — uses refinement steps for process ordering (not Y-coords),
 * and reads things/links/states/modifiers/fans directly from the kernel.
 *
 * This eliminates the C-3 (layout→semantics) dependency and the C-1 (Model roundtrip)
 * in the simulation path.
 */
export function runSimulationFromKernel(
  kernel: SemanticKernel,
  initialState?: ModelState,
  maxSteps: number = 100,
  rng: () => number = Math.random,
  scenarioId?: string,
): SimulationTrace {
  const state = initialState ?? createInitialState(kernel);
  const steps: SimulationStep[] = [];
  let currentState = state;

  // Use kernel refinements for process ordering (no Y-coordinates)
  let executableProcesses = getExecutableProcessesFromRefinements(kernel, kernel.refinements);

  // Scenario filter
  const scenario = scenarioId ? kernel.scenarios.get(scenarioId) : undefined;
  if (scenario && scenario.path_labels.length > 0) {
    const pathLabels = new Set(scenario.path_labels);
    const scenarioLinks = [...kernel.links.values()].filter(l => l.path_label && pathLabels.has(l.path_label));
    const scenarioProcessIds = new Set<string>();
    for (const link of scenarioLinks) {
      const src = kernel.things.get(link.source);
      const tgt = kernel.things.get(link.target);
      if (src?.kind === "process") scenarioProcessIds.add(src.id);
      if (tgt?.kind === "process") scenarioProcessIds.add(tgt.id);
    }
    if (scenarioProcessIds.size > 0) {
      executableProcesses = executableProcesses.filter(ep =>
        scenarioProcessIds.has(ep.id) || (ep.parentProcessId && scenarioProcessIds.has(ep.parentProcessId))
      );
    }
  }

  const completedProcesses = new Set<string>();
  const allowedProcessIds = new Set(executableProcesses.map(ep => ep.id));
  const selfInvocationCount = new Map<string, number>();
  const waitingSince = new Map<string, number>();
  const pendingInvocations = new Map<string, string>();
  let totalInvocations = 0;

  function processInvocations(justCompleted: string): boolean {
    let triggered = false;
    for (const link of kernel.links.values()) {
      if (link.type !== "invocation" || link.source !== justCompleted) continue;
      const targetId = link.target;
      const isSelf = targetId === justCompleted;
      if (isSelf) {
        const count = selfInvocationCount.get(targetId) ?? 0;
        if (count >= MAX_SELF_INVOCATIONS) continue;
        selfInvocationCount.set(targetId, count + 1);
      } else {
        selfInvocationCount.delete(targetId);
      }
      completedProcesses.delete(targetId);
      if (++totalInvocations > MAX_INVOCATION_CHAIN_DEPTH) continue;
      pendingInvocations.set(targetId, justCompleted);
      triggered = true;
    }
    return triggered;
  }

  function enrichStep(stepResult: SimulationStep, processId: string): void {
    const ep = executableProcesses.find(p => p.id === processId);
    if (ep?.parentProcessId) {
      stepResult.parentProcessId = ep.parentProcessId;
      stepResult.opdContext = ep.opdId;
    }
    if (pendingInvocations.has(processId)) {
      stepResult.invokedBy = pendingInvocations.get(processId);
      pendingInvocations.delete(processId);
    }
  }

  let currentWaveOrder: number | null = null;
  let waveSnapshot: ModelState | null = null;

  for (let i = 0; i < maxSteps; i++) {
    let executed = false;

    if (!(currentState.waitingProcesses instanceof Set)) {
      currentState = { ...currentState, waitingProcesses: new Set() };
    }
    if (!(currentState.objects instanceof Map)) break;

    // Phase 1: Re-evaluate waiting processes
    for (const waitingId of [...currentState.waitingProcesses]) {
      if (!allowedProcessIds.has(waitingId)) continue;
      if (!waitingSince.has(waitingId)) waitingSince.set(waitingId, i);
      if (i - (waitingSince.get(waitingId) ?? 0) > MAX_WAIT_STEPS) {
        currentState = {
          ...currentState,
          waitingProcesses: new Set([...currentState.waitingProcesses].filter(id => id !== waitingId)),
        };
        completedProcesses.add(waitingId);
        waitingSince.delete(waitingId);
        continue;
      }
      const precond = evaluatePrecondition(kernel, currentState, waitingId);
      if (precond.satisfied) {
        waitingSince.delete(waitingId);
        const unblocked: ModelState = {
          ...currentState,
          objects: new Map(currentState.objects),
          waitingProcesses: new Set([...currentState.waitingProcesses].filter(id => id !== waitingId)),
        };
        const event: SimulationEvent = { kind: "manual", targetId: waitingId };
        const stepResult = simulationStep(kernel, unblocked, event, rng);
        if (!stepResult.skipped) {
          enrichStep(stepResult, waitingId);
          steps.push(stepResult);
          currentState = stepResult.newState;
          completedProcesses.add(waitingId);
          processInvocations(waitingId);
          executed = true;
          currentWaveOrder = null;
          waveSnapshot = null;
          break;
        }
      }
    }

    if (executed) continue;

    // Phase 2: Wave-based execution (semantic order, not Y)
    for (const ep of executableProcesses) {
      if (currentState.waitingProcesses.has(ep.id)) continue;
      if (completedProcesses.has(ep.id)) continue;

      if (currentWaveOrder === null || ep.order !== currentWaveOrder) {
        currentWaveOrder = ep.order;
        const snapshotObjects = new Map<string, ObjectState>();
        for (const [id, objState] of currentState.objects) {
          snapshotObjects.set(id, { ...objState });
        }
        waveSnapshot = {
          ...currentState,
          objects: snapshotObjects,
          waitingProcesses: new Set(currentState.waitingProcesses),
        };
      }

      const precond = evaluatePrecondition(kernel, waveSnapshot!, ep.id);
      if (!precond.satisfied) {
        if (precond.response === "wait") {
          currentState = {
            ...currentState,
            objects: new Map(currentState.objects),
            waitingProcesses: new Set([...currentState.waitingProcesses, ep.id]),
          };
        } else {
          completedProcesses.add(ep.id);
        }
        continue;
      }

      const event: SimulationEvent = { kind: "manual", targetId: ep.id };
      const stepResult = simulationStep(kernel, currentState, event, rng);

      if (!stepResult.skipped) {
        enrichStep(stepResult, ep.id);
        steps.push(stepResult);
        currentState = stepResult.newState;
        completedProcesses.add(ep.id);
        const invoked = processInvocations(ep.id);

        // Exception handling
        if (stepResult.exceptionTriggered && stepResult.processId) {
          for (const link of kernel.links.values()) {
            if (link.type !== "exception" || link.source !== stepResult.processId) continue;
            const linkType = link.exception_type ?? "overtime";
            if (linkType === stepResult.exceptionTriggered) {
              completedProcesses.delete(link.target);
              pendingInvocations.set(link.target, stepResult.processId);
            }
          }
        }

        // Event triggers
        for (const sc of stepResult.stateChanges) {
          if (!sc.toState) continue;
          for (const link of kernel.links.values()) {
            const mod = [...kernel.modifiers.values()].find(m => m.over === link.id && m.type === "event");
            if (!mod) continue;
            if (link.source !== sc.objectId) continue;
            const targetProc = kernel.things.get(link.target);
            if (targetProc?.kind === "process" && allowedProcessIds.has(link.target)) {
              completedProcesses.delete(link.target);
              pendingInvocations.set(link.target, stepResult.processId ?? "");
            }
          }
        }

        if (invoked) {
          currentWaveOrder = null;
          waveSnapshot = null;
        }
        executed = true;
        break;
      } else {
        if (ep.parentProcessId && stepResult.processId) {
          completedProcesses.add(ep.id);
          const siblingIdx = executableProcesses.findIndex(p => p.id === ep.id);
          if (siblingIdx >= 0 && siblingIdx < executableProcesses.length - 1) {
            const next = executableProcesses[siblingIdx + 1];
            if (next?.parentProcessId === ep.parentProcessId) {
              completedProcesses.delete(next.id);
            }
          }
        }
        completedProcesses.add(ep.id);
        if (stepResult.processId && stepResult.newState.waitingProcesses.has(stepResult.processId)) {
          currentState = stepResult.newState;
        }
      }
    }

    if (!executed) {
      if (currentState.waitingProcesses.size > 0) {
        return {
          steps, finalState: currentState, completed: false, deadlocked: true,
          assertionResults: verifyAssertions(kernel, currentState, steps).length > 0 ? verifyAssertions(kernel, currentState, steps) : undefined,
        };
      }
      break;
    }
  }

  const assertionResults = verifyAssertions(kernel, currentState, steps);
  const totalDuration = currentState.timestamp - state.timestamp;

  return {
    steps,
    finalState: currentState,
    completed: steps.length < maxSteps,
    deadlocked: false,
    assertionResults: assertionResults.length > 0 ? assertionResults : undefined,
    totalDuration: totalDuration > 0 ? totalDuration : undefined,
  };
}

/**
 * Kernel-native Monte Carlo simulation.
 * Delegates to runSimulationFromKernel instead of runSimulation.
 */
export function runMonteCarloSimulationFromKernel(
  kernel: SemanticKernel,
  runs: number = 100,
  maxSteps: number = 100,
): MonteCarloResult {
  let completedCount = 0;
  let deadlockedCount = 0;
  let totalSteps = 0;
  let totalDuration = 0;
  let durationCount = 0;
  const assertionPassCounts: Record<string, number> = {};
  const assertionTotalCounts: Record<string, number> = {};
  const exceptionCounts: Record<string, number> = {};

  function makeRng(seed: number): () => number {
    let s = seed;
    return () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  for (let i = 0; i < runs; i++) {
    const rng = makeRng(i * 31337 + 42);
    const trace = runSimulationFromKernel(kernel, undefined, maxSteps, rng);

    totalSteps += trace.steps.length;
    if (trace.completed) completedCount++;
    if (trace.deadlocked) deadlockedCount++;
    if (trace.totalDuration != null) {
      totalDuration += trace.totalDuration;
      durationCount++;
    }
    if (trace.assertionResults) {
      for (const ar of trace.assertionResults) {
        assertionTotalCounts[ar.assertionId] = (assertionTotalCounts[ar.assertionId] ?? 0) + 1;
        if (ar.passed) assertionPassCounts[ar.assertionId] = (assertionPassCounts[ar.assertionId] ?? 0) + 1;
      }
    }
    for (const step of trace.steps) {
      if (step.exceptionTriggered && step.processName) {
        const key = `${step.processName} (${step.exceptionTriggered})`;
        exceptionCounts[key] = (exceptionCounts[key] ?? 0) + 1;
      }
    }
  }

  const assertionPassRate: Record<string, number> = {};
  for (const [id, total] of Object.entries(assertionTotalCounts)) {
    assertionPassRate[id] = (assertionPassCounts[id] ?? 0) / total;
  }
  const exceptionRate: Record<string, number> = {};
  for (const [key, count] of Object.entries(exceptionCounts)) {
    exceptionRate[key] = count / runs;
  }

  return {
    runs, completedCount, deadlockedCount,
    avgSteps: totalSteps / runs,
    avgDuration: durationCount > 0 ? totalDuration / durationCount : null,
    assertionPassRate, exceptionRate,
  };
}
