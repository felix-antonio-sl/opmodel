/* ═══════════════════════════════════════════════════
   Command Algebra — η: Command → Effect

   Categorical structure: discriminated coproduct of
   user actions, interpreted via natural transformation
   into Model mutations or UI state transitions.
   ═══════════════════════════════════════════════════ */

import type { Model, Thing, Link, State, Fan, Modifier, InvariantError, RefinementType, OplEdit, SimulationTrace, Settings, Meta, Requirement, Assertion, Scenario, Stereotype, SubModel } from "@opmodel/core";
import {
  updateAppearance,
  updateThing,
  updateState,
  updateLink,
  updateOPD,
  updateMeta,
  updateSettings,
  addRequirement,
  removeRequirement,
  updateRequirement,
  addAssertion,
  removeAssertion,
  updateAssertion,
  addScenario,
  removeScenario,
  updateScenario,
  addStereotype,
  removeStereotype,
  updateStereotype,
  addSubModel,
  removeSubModel,
  updateSubModel,
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
  addOPD,
  removeOPD,
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
  | { tag: "updateAppearancesBatch"; updates: Array<{ thingId: string; opdId: string; patch: Record<string, unknown> }> }
  | { tag: "resizeThing"; thingId: string; opdId: string; w: number; h: number }
  | { tag: "renameThing"; thingId: string; name: string }
  | { tag: "updateThingProps"; thingId: string; patch: Partial<Omit<Thing, "id">> }
  | { tag: "addThing"; thing: Thing; opdId: string; x: number; y: number; w: number; h: number }
  | { tag: "removeThing"; thingId: string }
  | { tag: "addLink"; link: Omit<Link, never> }
  | { tag: "removeLink"; linkId: string }
  | { tag: "selectThing"; thingId: string | null }
  | { tag: "selectLink"; linkId: string | null }
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
  | { tag: "addViewOpd"; opdId: string; name: string }
  | { tag: "removeOpd"; opdId: string }
  | { tag: "addThingToView"; thingId: string; opdId: string }
  | { tag: "updateSettings"; patch: Partial<Settings> }
  | { tag: "updateMeta"; patch: Partial<Omit<Meta, "created" | "modified">> }
  /* ─── Requirements, Assertions, Scenarios ─── */
  | { tag: "addRequirement"; requirement: Requirement }
  | { tag: "removeRequirement"; requirementId: string }
  | { tag: "updateRequirement"; requirementId: string; patch: Partial<Omit<Requirement, "id">> }
  | { tag: "addAssertion"; assertion: Assertion }
  | { tag: "removeAssertion"; assertionId: string }
  | { tag: "updateAssertion"; assertionId: string; patch: Partial<Omit<Assertion, "id">> }
  | { tag: "addScenario"; scenario: Scenario }
  | { tag: "removeScenario"; scenarioId: string }
  | { tag: "updateScenario"; scenarioId: string; patch: Partial<Omit<Scenario, "id">> }
  | { tag: "renameOpd"; opdId: string; name: string }
  | { tag: "addStereotype"; stereotype: Stereotype }
  | { tag: "removeStereotype"; stereotypeId: string }
  /* ─── SubModels ─── */
  | { tag: "addSubModel"; subModel: SubModel }
  | { tag: "removeSubModel"; subModelId: string }
  | { tag: "updateSubModel"; subModelId: string; patch: Partial<Omit<SubModel, "id">> }
  /* ─── Simulation Commands ─── */
  | { tag: "startSimulation" }
  | { tag: "stepSimulation"; direction: 1 | -1 }
  | { tag: "resetSimulation" }
  | { tag: "setSimulationStep"; index: number }
  | { tag: "setSimulationSpeed"; speed: number }
  | { tag: "importOpl"; model: Model }
  | { tag: "toggleSimulationAutoRun" }
  | { tag: "duplicateThing"; sourceThingId: string; newThingId: string; opdId: string };

/* ─── Effect Coproduct ─── */

export type Effect =
  | { type: "modelMutation"; apply: (model: Model) => Result<Model, InvariantError> }
  | { type: "uiTransition"; field: "selectedThing"; value: string | null }
  | { type: "uiTransition"; field: "selectedLink"; value: string | null }
  | { type: "uiTransition"; field: "currentOpd"; value: string }
  | { type: "uiTransition"; field: "mode"; value: EditorMode }
  | { type: "uiTransition"; field: "linkSource"; value: string | null }
  | { type: "uiTransition"; field: "linkType"; value: LinkTypeChoice }
  | { type: "simulationEffect"; action: "start" | "step" | "reset" | "setStep" | "setSpeed" | "toggleAutoRun"; payload?: number }
  | { type: "replaceModel"; model: Model };

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

    case "updateAppearancesBatch":
      return {
        type: "modelMutation",
        apply: (m) => {
          let current = m;
          for (const update of cmd.updates) {
            const r = updateAppearance(current, update.thingId, update.opdId, update.patch as any);
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

    case "selectLink":
      return { type: "uiTransition", field: "selectedLink", value: cmd.linkId };

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

    case "updateMeta":
      return {
        type: "modelMutation",
        apply: (m) => updateMeta(m, cmd.patch),
      };

    /* ─── Requirements, Assertions, Scenarios ─── */

    case "addRequirement":
      return { type: "modelMutation", apply: (m) => addRequirement(m, cmd.requirement) };
    case "removeRequirement":
      return { type: "modelMutation", apply: (m) => removeRequirement(m, cmd.requirementId) };
    case "updateRequirement":
      return { type: "modelMutation", apply: (m) => updateRequirement(m, cmd.requirementId, cmd.patch) };

    case "addAssertion":
      return { type: "modelMutation", apply: (m) => addAssertion(m, cmd.assertion) };
    case "removeAssertion":
      return { type: "modelMutation", apply: (m) => removeAssertion(m, cmd.assertionId) };
    case "updateAssertion":
      return { type: "modelMutation", apply: (m) => updateAssertion(m, cmd.assertionId, cmd.patch) };

    case "addScenario":
      return { type: "modelMutation", apply: (m) => addScenario(m, cmd.scenario) };
    case "removeScenario":
      return { type: "modelMutation", apply: (m) => removeScenario(m, cmd.scenarioId) };
    case "updateScenario":
      return { type: "modelMutation", apply: (m) => updateScenario(m, cmd.scenarioId, cmd.patch) };

    case "renameOpd":
      return { type: "modelMutation", apply: (m) => updateOPD(m, cmd.opdId, { name: cmd.name }) };

    case "addStereotype":
      return { type: "modelMutation", apply: (m) => addStereotype(m, cmd.stereotype) };
    case "removeStereotype":
      return { type: "modelMutation", apply: (m) => removeStereotype(m, cmd.stereotypeId) };

    case "addSubModel":
      return { type: "modelMutation", apply: (m) => addSubModel(m, cmd.subModel) };
    case "removeSubModel":
      return { type: "modelMutation", apply: (m) => removeSubModel(m, cmd.subModelId) };
    case "updateSubModel":
      return { type: "modelMutation", apply: (m) => updateSubModel(m, cmd.subModelId, cmd.patch) };

    /* ─── OPDs (R-NT-4: View OPDs) ─── */

    case "addViewOpd":
      return {
        type: "modelMutation",
        apply: (m) => addOPD(m, {
          id: cmd.opdId,
          name: cmd.name,
          opd_type: "view",
          parent_opd: null,
        }),
      };

    case "removeOpd":
      return {
        type: "modelMutation",
        apply: (m) => removeOPD(m, cmd.opdId),
      };

    case "addThingToView": {
      return {
        type: "modelMutation",
        apply: (m) => {
          const thing = m.things.get(cmd.thingId);
          if (!thing) return { ok: false, error: { code: "NOT_FOUND", message: `Thing ${cmd.thingId} not found`, entity: cmd.thingId } } as Result<Model, InvariantError>;
          // Auto-position: grid layout based on existing appearances in this OPD
          const existing = [...m.appearances.values()].filter(a => a.opd === cmd.opdId);
          const col = existing.length % 4;
          const row = Math.floor(existing.length / 4);
          const w = thing.kind === "process" ? 180 : 140;
          const h = thing.kind === "process" ? 70 : 55;
          return addAppearance(m, {
            thing: cmd.thingId,
            opd: cmd.opdId,
            x: 50 + col * 200,
            y: 50 + row * 120,
            w,
            h,
          });
        },
      };
    }

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

    case "importOpl":
      return { type: "replaceModel", model: cmd.model };

    case "duplicateThing":
      return {
        type: "modelMutation",
        apply: (m) => {
          const src = m.things.get(cmd.sourceThingId);
          if (!src) return { ok: false, error: { code: "NOT_FOUND", message: `Thing ${cmd.sourceThingId} not found`, entity: cmd.sourceThingId } } as Result<Model, InvariantError>;
          const newThing: Thing = { ...src, id: cmd.newThingId, name: `${src.name} (copy)` };
          const r1 = addThing(m, newThing);
          if (!isOk(r1)) return r1;
          let current = r1.value;
          // Copy states
          const srcStates = [...m.states.values()].filter(s => s.parent === cmd.sourceThingId);
          for (const s of srcStates) {
            const newStateId = `${cmd.newThingId}-${s.id}`;
            const r = addState(current, { ...s, id: newStateId, parent: cmd.newThingId });
            if (isOk(r)) current = r.value;
          }
          // Place in same OPD offset by 30px
          const srcApp = [...m.appearances.values()].find(a => a.thing === cmd.sourceThingId && a.opd === cmd.opdId);
          if (srcApp) {
            const r2 = addAppearance(current, { thing: cmd.newThingId, opd: cmd.opdId, x: srcApp.x + 30, y: srcApp.y + 30, w: srcApp.w, h: srcApp.h });
            if (isOk(r2)) current = r2.value;
          }
          return { value: current, ok: true } as Result<Model, InvariantError>;
        },
      };
  }
}
