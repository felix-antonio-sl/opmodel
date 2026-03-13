// packages/core/src/simulation.ts
// Motor de Simulación ECA (Event-Condition-Action) como Coalgebra
// Según DA-5: c: ModelState → Event × (Precond → ModelState + 1)

import type { Model, Thing, State, Link, Modifier } from "./types";
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
}

/** Traza coinductiva de simulación */
export interface SimulationTrace {
  steps: SimulationStep[];
  finalState: ModelState;
  completed: boolean;
  deadlocked: boolean;
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
      // Direction: source=process, target=object for transforming links
      if (link.source !== processId) continue;
      const objectId = link.target;
      const objState = state.objects.get(objectId);

      if (!objState?.exists) {
        return { satisfied: false, reason: `Object ${objectId} does not exist`, response: getResponse(model, link.id) };
      }

      // Verificar estado específico si está especificado
      if (link.source_state) {
        const requiredState = model.states.get(link.source_state);
        if (requiredState && objState.currentState !== link.source_state) {
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
      const objId = link.target;
      const obj = step.newState.objects.get(objId);
      if (obj) {
        obj.exists = false;
        step.consumptionIds.push(objId);
      }
    }

    // Effect: cambio de estado
    if (link.type === "effect") {
      const objId = link.target;
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

  // Encontrar procesos a ejecutar (orden por in-zoom)
  const processes = [...model.things.values()]
    .filter(t => t.kind === "process")
    .sort((a, b) => a.id.localeCompare(b.id));

  // Rastrear procesos que han ejecutado exitosamente al menos una vez
  const everExecuted = new Set<string>();

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
          steps.push(stepResult);
          currentState = stepResult.newState;
          if (stepResult.processId) everExecuted.add(stepResult.processId);
          executed = true;
          break;
        }
      }
    }

    if (executed) continue;

    // 2. Evaluar procesos normales
    for (const proc of processes) {
      if (currentState.waitingProcesses.has(proc.id)) continue;
      const event: SimulationEvent = { kind: "manual", targetId: proc.id };
      const stepResult = simulationStep(model, currentState, event);

      if (!stepResult.skipped) {
        steps.push(stepResult);
        currentState = stepResult.newState;
        if (stepResult.processId) everExecuted.add(stepResult.processId);
        executed = true;
        break;
      } else if (stepResult.processId && stepResult.newState.waitingProcesses.has(stepResult.processId)) {
        // Proceso fue añadido a waiting por simulationStep — propagar el nuevo estado
        currentState = stepResult.newState;
      }
    }

    if (!executed) {
      // Sin progreso — comprobar si es deadlock real o agotamiento de recursos
      // Deadlock real: procesos en espera que NUNCA han podido ejecutar
      const trueDeadlock = [...currentState.waitingProcesses].some(id => !everExecuted.has(id));
      if (trueDeadlock) {
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
    // Transforming links: source=process, target=object
    if (link.source === processId && link.type === "consumption") {
      result.push({ objectId: link.target, objectType: "consumee" });
    }
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
