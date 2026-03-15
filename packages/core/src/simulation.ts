// packages/core/src/simulation.ts
// Motor de Simulación ECA (Event-Condition-Action) como Coalgebra
// Según DA-5: c: ModelState → Event × (Precond → ModelState + 1)

import type { Model, Thing, State, Link, Modifier, OPD } from "./types";
import type { InvariantError, Result } from "./result";
import { ok, err } from "./result";

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

  // 4. Collect states produced internally (target_state of effect/result links on subprocesses)
  //    Used to filter enabling links whose required state is an internal product.
  const internallyProducedStates = new Set<string>();
  for (const link of model.links.values()) {
    if (!["effect", "result"].includes(link.type)) continue;
    if (!link.target_state) continue;
    if (subprocessToAncestor.has(link.source) || subprocessToAncestor.has(link.target)) {
      internallyProducedStates.add(link.target_state);
    }
  }

  const result: ResolvedLink[] = [];
  const seen = new Set<string>();

  for (const link of model.links.values()) {
    const vs = resolve(link.source);
    const vt = resolve(link.target);
    if (!vs || !vt) continue;
    if (vs === vt) continue; // Skip self-loops from same-parent resolution

    const isAggregated = vs !== link.source || vt !== link.target;

    // Filter internal scheduling dependencies ONLY for aggregated links (projected to parent).
    // Inside the in-zoom OPD, show all links including internal dependencies.
    if (isAggregated && ["agent", "instrument"].includes(link.type) && link.source_state) {
      if (internallyProducedStates.has(link.source_state)) continue;
    }

    const key = `${link.type}|${vs}|${vt}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      link,
      visualSource: vs,
      visualTarget: vt,
      aggregated: isAggregated,
    });
  }

  return result;
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

/**
 * Evaluar precondición de un proceso — versión trivalent (C2)
 * Precond = preprocess object set satisfecho
 * Unsatisfied branch carries response: "lost" | "skip" | "wait"
 */
export function evaluatePrecondition(
  model: Model,
  state: ModelState,
  processId: string
): PreconditionResult {
  const links = [...model.links.values()].filter(
    l => l.target === processId || l.source === processId
  );

  for (const link of links) {
    // Para transforming links, verificar que los objetos existan
    if (["consumption", "effect", "input", "output"].includes(link.type)) {
      // Detect process/object endpoints by kind (direction-agnostic)
      const srcThing = model.things.get(link.source);
      const tgtThing = model.things.get(link.target);
      const processEnd = srcThing?.kind === "process" ? link.source : link.target;
      const objectEnd = srcThing?.kind === "object" ? link.source : link.target;
      if (processEnd !== processId) continue;
      const objectId = objectEnd;
      const objState = state.objects.get(objectId);

      if (!objState?.exists) {
        return { satisfied: false, reason: `Object ${objectId} does not exist`, response: getResponse(model, link.id) };
      }

      // Check state-specified: use whichever state field is populated on the object endpoint
      const stateRef = link.source_state || link.target_state;
      if (stateRef) {
        const requiredState = model.states.get(stateRef);
        if (requiredState && objState.currentState !== stateRef) {
          return { satisfied: false, reason: `Object ${objectId} not in required state ${requiredState.name}`, response: getResponse(model, link.id) };
        }
      }
    }

    // Para enabling links (agent, instrument), verificar existencia
    if (["agent", "instrument"].includes(link.type)) {
      // Direction: source=object, target=process for enabling links
      if (link.target !== processId) continue;
      const objectId = link.source;
      const objState = state.objects.get(objectId);

      if (!objState?.exists) {
        return { satisfied: false, reason: `${link.type} ${objectId} does not exist`, response: getResponse(model, link.id) };
      }

      // State-specified enabling
      if (link.source_state) {
        const requiredState = model.states.get(link.source_state);
        if (requiredState && objState.currentState !== link.source_state) {
          return {
            satisfied: false,
            reason: `${link.type} ${objectId} not in required state ${requiredState.name}`,
            response: getResponse(model, link.id),
          };
        }
      }
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
  event: SimulationEvent
): SimulationStep {
  const step: SimulationStep = {
    step: state.step + 1,
    event,
    preconditionMet: false,
    skipped: false,
    consumptionIds: [],
    resultIds: [],
    stateChanges: [],
    newState: { ...state, objects: new Map(state.objects), waitingProcesses: new Set(state.waitingProcesses), step: state.step + 1 },
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

  // Ejecutar efectos del proceso
  const links = [...model.links.values()].filter(l => l.target === processId || l.source === processId);

  for (const link of links) {
    // Consumption: objeto deja de existir
    if (link.type === "consumption") {
      // consumption: source=object (ISO), target=process — detect by kind
      const srcThing = model.things.get(link.source);
      const objId = srcThing?.kind === "object" ? link.source : link.target;
      const obj = step.newState.objects.get(objId);
      if (obj) {
        obj.exists = false;
        step.consumptionIds.push(objId);
      }
    }

    // Effect: cambio de estado — bidirectional per ISO, detect object by kind
    if (link.type === "effect") {
      const srcThing = model.things.get(link.source);
      const objId = srcThing?.kind === "object" ? link.source : link.target;
      const obj = step.newState.objects.get(objId);
      if (obj && link.target_state) {
        const fromState = obj.currentState;
        obj.currentState = link.target_state;
        step.stateChanges.push({ objectId: objId, fromState, toState: link.target_state });
      }
    }

    // Result: objeto comienza a existir
    if (link.type === "result") {
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
  // (re-activation requires invocation link, not yet implemented — SIM-BUG-02)
  const completedProcesses = new Set<string>();

  for (let i = 0; i < maxSteps; i++) {
    let executed = false;

    // 1. Re-evaluar procesos en espera primero
    for (const waitingId of [...currentState.waitingProcesses]) {
      const precond = evaluatePrecondition(model, currentState, waitingId);
      if (precond.satisfied) {
        // Crear nuevo estado sin este proceso en waitingProcesses (inmutable)
        const unblocked: ModelState = {
          ...currentState,
          objects: new Map(currentState.objects),
          waitingProcesses: new Set([...currentState.waitingProcesses].filter(id => id !== waitingId)),
        };
        const event: SimulationEvent = { kind: "manual", targetId: waitingId };
        const stepResult = simulationStep(model, unblocked, event);
        if (!stepResult.skipped) {
          // Enrich with in-zoom context from executable list
          const ep = executableProcesses.find(p => p.id === waitingId);
          if (ep?.parentProcessId) {
            stepResult.parentProcessId = ep.parentProcessId;
            stepResult.opdContext = ep.opdId;
          }
          steps.push(stepResult);
          currentState = stepResult.newState;
          completedProcesses.add(waitingId); // Mark unblocked process as completed
          executed = true;
          break;
        }
      }
    }

    if (executed) continue;

    // 2. Evaluar procesos ejecutables (con in-zoom expansion)
    for (const ep of executableProcesses) {
      if (currentState.waitingProcesses.has(ep.id)) continue;
      if (completedProcesses.has(ep.id)) continue; // SIM-BUG-01: don't re-execute
      const event: SimulationEvent = { kind: "manual", targetId: ep.id };
      const stepResult = simulationStep(model, currentState, event);

      if (!stepResult.skipped) {
        // Enrich step with in-zoom context
        if (ep.parentProcessId) {
          stepResult.parentProcessId = ep.parentProcessId;
          stepResult.opdContext = ep.opdId;
        }
        steps.push(stepResult);
        currentState = stepResult.newState;
        completedProcesses.add(ep.id); // Mark as completed
        executed = true;
        break;
      } else if (stepResult.processId && stepResult.newState.waitingProcesses.has(stepResult.processId)) {
        // Proceso fue añadido a waiting por simulationStep — propagar el nuevo estado
        currentState = stepResult.newState;
      }
    }

    if (!executed) {
      // Deadlock: waiting processes exist but none can execute
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
