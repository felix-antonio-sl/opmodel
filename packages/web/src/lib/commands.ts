/* ═══════════════════════════════════════════════════
   Command Algebra — η: Command → Effect

   Categorical structure: discriminated coproduct of
   user actions, interpreted via natural transformation
   into Model mutations or UI state transitions.
   ═══════════════════════════════════════════════════ */

import type { Model, Thing, Link, State, Fan, Modifier, InvariantError, RefinementType, OplEdit, SimulationTrace, Settings } from "@opmodel/core";
import {
  updateAppearance,
  updateThing,
  updateState,
  updateLink,
  updateOPD,
  updateSettings,
  addThing,
  addState,
  addLink,
  addAppearance,
  removeThing,
  removeState,
  removeLink,
  addFan,
  removeFan,
  updateFan,
  addModifier,
  removeModifier,
  updateModifier,
  refineThing,
  bringConnectedThings,
  applyOplEdit,
  isOk,
  type Result,
} from "@opmodel/core";

/* ─── Simulation UI State ─── */

export interface SimulationUIState {
  trace: SimulationTrace;
  currentStepIndex: number;     // -1 = initial state, 0..N = after step[i]
  status: "paused" | "running" | "completed" | "deadlocked";
  speed: number;                // ms between auto-steps
  frozenModel: Model;           // snapshot at simulation start
}

/* ─── Editor Mode ─── */

export type EditorMode = "select" | "addObject" | "addProcess" | "addLink";

/* ─── Command Sum Type ─── */

export type LinkTypeChoice = "auto" | Link["type"];

export type Command =
  | { tag: "moveThing"; thingId: string; opdId: string; x: number; y: number }
  | { tag: "moveThings"; moves: Array<{ thingId: string; opdId: string; x: number; y: number }> }
  | { tag: "resizeThing"; thingId: string; opdId: string; w: number; h: number }
  | { tag: "renameThing"; thingId: string; name: string }
  | { tag: "updateThingProps"; thingId: string; patch: Partial<Omit<Thing, "id">> }
  | { tag: "addThing"; thing: Thing; opdId: string; x: number; y: number; w: number; h: number }
  | { tag: "removeThing"; thingId: string }
  | { tag: "addLink"; link: Omit<Link, never> }
  | { tag: "removeLink"; linkId: string }
  | { tag: "selectThing"; thingId: string | null }
  | { tag: "selectOpd"; opdId: string }
  | { tag: "addState"; state: { id: string; parent: string; name: string; initial: boolean; final: boolean; default: boolean } }
  | { tag: "removeState"; stateId: string }
  | { tag: "updateLink"; linkId: string; patch: Partial<Omit<Link, "id">> }
  | { tag: "updateState"; stateId: string; patch: Partial<Omit<State, "id" | "parent">> }
  | { tag: "refineThing"; thingId: string; opdId: string; refinementType: RefinementType; childOpdId: string; childOpdName: string }
  | { tag: "applyOplEdit"; edit: OplEdit }
  | { tag: "updateAppearance"; thingId: string; opdId: string; patch: Record<string, unknown> }
  | { tag: "bringConnected"; thingId: string; opdId: string; filter: "procedural" | "structural" | "all" }
  | { tag: "extractPart"; partThingId: string; opdId: string; x: number; y: number }
  | { tag: "setMode"; mode: EditorMode }
  | { tag: "setLinkType"; linkType: LinkTypeChoice }
  /* ─── Fan Commands ─── */
  | { tag: "addFan"; fan: Fan }
  | { tag: "removeFan"; fanId: string }
  | { tag: "updateFan"; fanId: string; patch: Partial<Omit<Fan, "id">> }
  /* ─── Modifier Commands ─── */
  | { tag: "addModifier"; modifier: Modifier }
  | { tag: "removeModifier"; modifierId: string }
  | { tag: "updateModifier"; modifierId: string; patch: Partial<Omit<Modifier, "id">> }
  /* ─── Settings Commands ─── */
  | { tag: "updateSettings"; patch: Partial<Settings> }
  /* ─── Simulation Commands ─── */
  | { tag: "startSimulation" }
  | { tag: "stepSimulation"; direction: 1 | -1 }
  | { tag: "resetSimulation" }
  | { tag: "setSimulationStep"; index: number }
  | { tag: "setSimulationSpeed"; speed: number }
  | { tag: "toggleSimulationAutoRun" };

/* ─── Effect Coproduct ─── */

export type Effect =
  | { type: "modelMutation"; apply: (model: Model) => Result<Model, InvariantError> }
  | { type: "uiTransition"; field: "selectedThing"; value: string | null }
  | { type: "uiTransition"; field: "currentOpd"; value: string }
  | { type: "uiTransition"; field: "mode"; value: EditorMode }
  | { type: "uiTransition"; field: "linkSource"; value: string | null }
  | { type: "uiTransition"; field: "linkType"; value: LinkTypeChoice }
  | { type: "simulationEffect"; action: "start" | "step" | "reset" | "setStep" | "setSpeed" | "toggleAutoRun"; payload?: number };

/* ─── Interpret: Natural Transformation η ─── */

export function interpret(cmd: Command): Effect {
  switch (cmd.tag) {
    case "moveThing":
      return {
        type: "modelMutation",
        apply: (m) => updateAppearance(m, cmd.thingId, cmd.opdId, { x: cmd.x, y: cmd.y }),
      };

    case "moveThings":
      return {
        type: "modelMutation",
        apply: (m) => {
          let current = m;
          for (const move of cmd.moves) {
            const r = updateAppearance(current, move.thingId, move.opdId, { x: move.x, y: move.y });
            if (!isOk(r)) return r;
            current = r.value;
          }
          return { value: current, ok: true } as Result<Model, InvariantError>;
        },
      };

    case "resizeThing":
      return {
        type: "modelMutation",
        apply: (m) => updateAppearance(m, cmd.thingId, cmd.opdId, { w: cmd.w, h: cmd.h }),
      };

    case "renameThing":
      return {
        type: "modelMutation",
        apply: (m) => updateThing(m, cmd.thingId, { name: cmd.name }),
      };

    case "updateThingProps":
      return {
        type: "modelMutation",
        apply: (m) => updateThing(m, cmd.thingId, cmd.patch),
      };

    case "addThing":
      return {
        type: "modelMutation",
        apply: (m) => {
          const r1 = addThing(m, cmd.thing);
          if (!isOk(r1)) return r1;
          const targetOpd = r1.value.opds.get(cmd.opdId);
          const isRefinementOpd = targetOpd?.refines != null;
          return addAppearance(r1.value, {
            thing: cmd.thing.id,
            opd: cmd.opdId,
            x: cmd.x,
            y: cmd.y,
            w: cmd.w,
            h: cmd.h,
            ...(isRefinementOpd ? { internal: true } : {}),
          });
        },
      };

    case "removeThing":
      return {
        type: "modelMutation",
        apply: (m) => removeThing(m, cmd.thingId),
      };

    case "addLink":
      return {
        type: "modelMutation",
        apply: (m) => addLink(m, cmd.link),
      };

    case "removeLink":
      return {
        type: "modelMutation",
        apply: (m) => removeLink(m, cmd.linkId),
      };

    case "selectThing":
      return { type: "uiTransition", field: "selectedThing", value: cmd.thingId };

    case "selectOpd":
      return { type: "uiTransition", field: "currentOpd", value: cmd.opdId };

    case "addState":
      return {
        type: "modelMutation",
        apply: (m) => addState(m, cmd.state as any),
      };

    case "removeState":
      return {
        type: "modelMutation",
        apply: (m) => removeState(m, cmd.stateId),
      };

    case "updateLink":
      return {
        type: "modelMutation",
        apply: (m) => updateLink(m, cmd.linkId, cmd.patch),
      };

    case "updateState":
      return {
        type: "modelMutation",
        apply: (m) => updateState(m, cmd.stateId, cmd.patch),
      };

    case "refineThing":
      return {
        type: "modelMutation",
        apply: (m) => refineThing(m, cmd.thingId, cmd.opdId, cmd.refinementType, cmd.childOpdId, cmd.childOpdName),
      };

    case "updateAppearance":
      return {
        type: "modelMutation",
        apply: (m) => updateAppearance(m, cmd.thingId, cmd.opdId, cmd.patch as any),
      };

    case "bringConnected":
      return {
        type: "modelMutation",
        apply: (m) => bringConnectedThings(m, cmd.thingId, cmd.opdId, cmd.filter),
      };

    case "extractPart":
      return {
        type: "modelMutation",
        apply: (m) => addAppearance(m, {
          thing: cmd.partThingId, opd: cmd.opdId,
          x: cmd.x, y: cmd.y, w: 120, h: 60,
        }),
      };

    case "applyOplEdit":
      return {
        type: "modelMutation",
        apply: (m) => applyOplEdit(m, cmd.edit),
      };

    case "setMode":
      return { type: "uiTransition", field: "mode", value: cmd.mode };

    case "setLinkType":
      return { type: "uiTransition", field: "linkType", value: cmd.linkType };

    /* ─── Fan ─── */

    case "addFan":
      return {
        type: "modelMutation",
        apply: (m) => addFan(m, cmd.fan),
      };

    case "removeFan":
      return {
        type: "modelMutation",
        apply: (m) => removeFan(m, cmd.fanId),
      };

    case "updateFan":
      return {
        type: "modelMutation",
        apply: (m) => updateFan(m, cmd.fanId, cmd.patch),
      };

    /* ─── Modifier ─── */

    case "addModifier":
      return {
        type: "modelMutation",
        apply: (m) => addModifier(m, cmd.modifier),
      };

    case "removeModifier":
      return {
        type: "modelMutation",
        apply: (m) => removeModifier(m, cmd.modifierId),
      };

    case "updateModifier":
      return {
        type: "modelMutation",
        apply: (m) => updateModifier(m, cmd.modifierId, cmd.patch),
      };

    /* ─── Settings ─── */

    case "updateSettings":
      return {
        type: "modelMutation",
        apply: (m) => updateSettings(m, cmd.patch),
      };

    /* ─── Simulation ─── */

    case "startSimulation":
      return { type: "simulationEffect", action: "start" };

    case "stepSimulation":
      return { type: "simulationEffect", action: "step", payload: cmd.direction };

    case "resetSimulation":
      return { type: "simulationEffect", action: "reset" };

    case "setSimulationStep":
      return { type: "simulationEffect", action: "setStep", payload: cmd.index };

    case "setSimulationSpeed":
      return { type: "simulationEffect", action: "setSpeed", payload: cmd.speed };

    case "toggleSimulationAutoRun":
      return { type: "simulationEffect", action: "toggleAutoRun" };
  }
}
