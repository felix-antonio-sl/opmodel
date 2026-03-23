// packages/core/src/simulation.ts
// Motor de Simulación ECA (Event-Condition-Action) como Coalgebra
// Según DA-5: c: ModelState → Event × (Precond → ModelState + 1)

import type { Model, Thing, State, Link, Modifier, OPD, Fan } from "./types";
import type { InvariantError, Result } from "./result";
import { ok, err } from "./result";

/** Maximum self-invocation repetitions per process before stopping (ISO §9.5.2.5.2) */
export const MAX_SELF_INVOCATIONS = 10;

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
}

/** Traza coinductiva de simulación */
export interface SimulationTrace {
  steps: SimulationStep[];
  finalState: ModelState;
  completed: boolean;
  deadlocked: boolean;
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

  // Build lookup: processId → in-zoom OPD (if any)
  const inZoomOpds = new Map<string, OPD>();
  for (const opd of model.opds.values()) {
    if (opd.refines && opd.refinement_type === "in-zoom") {
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
  result.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  return result;
}

/** Link resolved for OPD visibility with visual endpoint mapping */
export interface ResolvedLink {
  link: Link;
  visualSource: string;
  visualTarget: string;
  aggregated: boolean;
}

/**
 * Compute visible links for an OPD by resolving endpoints through in-zoom containers.
 * Implements the pullback π* of I-LINK-VISIBILITY (ISO §14.2.2.4.1).
 * Only processes participate in subprocess-to-parent resolution; objects need direct appearances.
 */
export function resolveLinksForOpd(model: Model, opdId: string): ResolvedLink[] {
  // 1. Appearances in this OPD
  const appearances = new Set<string>();
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) appearances.add(app.thing);
  }

  // 2. Build subprocessToAncestor: subprocess ID → visible ancestor process ID
  //    Transitively resolves nested in-zoom chains.
  const subprocessToAncestor = new Map<string, string>();

  const inZoomOpds = new Map<string, OPD>();
  for (const opd of model.opds.values()) {
    if (opd.refines && opd.refinement_type === "in-zoom") {
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
          } else {
            // Agent/instrument/effect → all subprocesses
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
        }
        // Skip the original link to container (distributed or no subprocesses)
        continue;
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

  return result.filter(rl => {
    if (!rl.aggregated) return true;
    if (!["instrument", "agent"].includes(rl.link.type)) return true;
    // Rule 1: source is part of whole that already has direct link of same type
    const whole = partToWhole.get(rl.visualSource);
    if (whole && directLinkKeys.has(`${rl.link.type}|${whole}|${rl.visualTarget}`)) return false;
    // Rule 2: source already has a direct link to same process → resolved enabling is redundant
    if (directParticipants.has(`${rl.visualSource}|${rl.visualTarget}`)) return false;
    return true;
  });
}

// === Coalgebra: c: ModelState → Event × (Precond → ModelState + 1) ===

/**
 * Crear estado inicial del modelo para simulación
 */
export function createInitialState(model: Model): ModelState {
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
function getResponse(model: Model, linkId: string): "lost" | "skip" | "wait" {
  const mod = [...model.modifiers.values()].find(m => m.over === linkId);
  if (!mod) return "lost";
  if (mod.type === "event") return "lost";
  if (mod.type === "condition") {
    return mod.condition_mode === "skip" ? "skip" : "wait";
  }
  return "lost";
}

/** Build lookup: linkId → Fan for XOR/OR fans (AND fans use default all-must-pass logic) */
function buildFanLookup(model: Model): Map<string, Fan> {
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
  model: Model,
  state: ModelState,
  link: Link,
  processId: string,
): PreconditionResult {
  if (["consumption", "effect", "input", "output"].includes(link.type)) {
    const srcThing = model.things.get(link.source);
    const processEnd = srcThing?.kind === "process" ? link.source : link.target;
    const objectEnd = srcThing?.kind === "object" ? link.source : link.target;
    if (processEnd !== processId) return { satisfied: true };
    const objState = state.objects.get(objectEnd);
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
 */
export function chooseFanBranch(model: Model, fan: Fan, rng: () => number = Math.random): string[] {
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
 */
export function evaluatePrecondition(
  model: Model,
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
 * Ejecutar un paso de simulación (evaluación coalgébrica)
 * c: ModelState → Event × (Precond → ModelState + 1)
 */
export function simulationStep(
  model: Model,
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
    }
    step.resultIds.push(objId);
  }

  return step;
}

/**
 * Ejecutar simulación completa hasta completar o alcanzar maxSteps
 * Con re-evaluación de waitingProcesses y detección de deadlock
 */
export function runSimulation(
  model: Model,
  initialState?: ModelState,
  maxSteps: number = 100
): SimulationTrace {
  const state = initialState ?? createInitialState(model);
  const steps: SimulationStep[] = [];
  let currentState = state;

  // Expand in-zoomed processes into executable leaves (ISO §14.2.1)
  const executableProcesses = getExecutableProcesses(model);

  // Track completed processes — a process executes at most once per simulation
  // (re-activation via invocation link — ISO §9.5.2.5.1)
  const completedProcesses = new Set<string>();
  const selfInvocationCount = new Map<string, number>();
  const pendingInvocations = new Map<string, string>(); // targetId → sourceId (who invoked it)

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

      // Re-enable target (override SIM-BUG-01 guard for invoked processes)
      completedProcesses.delete(targetId);
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
  let currentWaveOrder: number | null = null;
  let waveSnapshot: ModelState | null = null;

  for (let i = 0; i < maxSteps; i++) {
    let executed = false;

    // Phase 1: Re-evaluar procesos en espera primero (against currentState, not snapshot)
    for (const waitingId of [...currentState.waitingProcesses]) {
      const precond = evaluatePrecondition(model, currentState, waitingId);
      if (precond.satisfied) {
        const unblocked: ModelState = {
          ...currentState,
          objects: new Map(currentState.objects),
          waitingProcesses: new Set([...currentState.waitingProcesses].filter(id => id !== waitingId)),
        };
        const event: SimulationEvent = { kind: "manual", targetId: waitingId };
        const stepResult = simulationStep(model, unblocked, event);
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
      const stepResult = simulationStep(model, currentState, event);

      if (!stepResult.skipped) {
        enrichStep(stepResult, ep.id);
        steps.push(stepResult);
        currentState = stepResult.newState;
        completedProcesses.add(ep.id);
        const invoked = processInvocations(ep.id);
        if (invoked) {
          // Invocation re-enabled a process — invalidate wave snapshot
          currentWaveOrder = null;
          waveSnapshot = null;
        }
        executed = true;
        break;
      } else {
        // Snapshot said satisfied but execution failed (parallel conflict) — mark completed
        completedProcesses.add(ep.id);
        if (stepResult.processId && stepResult.newState.waitingProcesses.has(stepResult.processId)) {
          currentState = stepResult.newState;
        }
      }
    }

    if (!executed) {
      if (currentState.waitingProcesses.size > 0) {
        return { steps, finalState: currentState, completed: false, deadlocked: true };
      }
      break;
    }
  }

  return {
    steps,
    finalState: currentState,
    completed: steps.length < maxSteps,
    deadlocked: false,
  };
}

/**
 * Obtener preprocess object set de un proceso
 */
export function getPreprocessSet(
  model: Model,
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
 * Obtener postprocess object set de un proceso
 */
export function getPostprocessSet(
  model: Model,
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
