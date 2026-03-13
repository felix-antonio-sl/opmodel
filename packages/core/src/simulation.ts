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
}

/** Evento que dispara evaluación */
export interface SimulationEvent {
  kind: "object-created" | "object-entered-state" | "process-completed" | "timeout" | "manual";
  targetId?: string;
  targetState?: string;
  sourceId?: string;
}

/** Resultado de evaluar precondición */
export type PreconditionResult = 
  | { satisfied: true }
  | { satisfied: false; reason: string };

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
  };
}

/**
 * Evaluar precondición de un proceso
 * Precond = preprocess object set satisfecho
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
      const objectId = link.target; // target es el objeto en transforming links
      const objState = state.objects.get(objectId);
      
      if (!objState?.exists) {
        return { satisfied: false, reason: `Object ${objectId} does not exist` };
      }
      
      // Verificar estado específico si está especificado
      if (link.source_state) {
        const requiredState = model.states.get(link.source_state);
        if (requiredState && objState.currentState !== link.source_state) {
          return { satisfied: false, reason: `Object ${objectId} not in required state ${requiredState.name}` };
        }
      }
    }
    
    // Para enabling links (agent, instrument), verificar existencia
    if (["agent", "instrument"].includes(link.type)) {
      const objectId = link.source; // source es el objeto en enabling links
      const objState = state.objects.get(objectId);
      
      if (!objState?.exists) {
        return { satisfied: false, reason: `${link.type} ${objectId} does not exist` };
      }
      
      // State-specified enabling
      if (link.source_state) {
        const requiredState = model.states.get(link.source_state);
        if (requiredState && objState.currentState !== link.source_state) {
          return { 
            satisfied: false, 
            reason: `${link.type} ${objectId} not in required state ${requiredState.name}` 
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
    newState: { ...state, objects: new Map(state.objects), step: state.step + 1 },
  };
  
  // Encontrar proceso a ejecutar basado en evento
  let processId: string | undefined;
  
  if (event.kind === "object-entered-state" && event.targetId) {
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
    step.skipped = true; // Evento perdido (Maybe monad +1)
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
  
  for (let i = 0; i < maxSteps; i++) {
    let executed = false;
    
    for (const proc of processes) {
      // Intentar ejecutar con evento manual
      const event: SimulationEvent = { kind: "manual", targetId: proc.id };
      const stepResult = simulationStep(model, currentState, event);
      
      if (!stepResult.skipped) {
        steps.push(stepResult);
        currentState = stepResult.newState;
        executed = true;
        break;
      }
    }
    
    if (!executed) break;
  }
  
  return {
    steps,
    finalState: currentState,
    completed: steps.length < maxSteps,
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
