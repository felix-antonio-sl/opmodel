/* ═══════════════════════════════════════════════════
   Command Algebra — η: Command → Effect

   Categorical structure: discriminated coproduct of
   user actions, interpreted via natural transformation
   into Model mutations or UI state transitions.
   ═══════════════════════════════════════════════════ */

import type { Model, Thing, Link, InvariantError } from "@opmodel/core";
import {
  updateAppearance,
  updateThing,
  updateState,
  updateLink,
  updateOPD,
  addThing,
  addState,
  addLink,
  addAppearance,
  removeThing,
  removeState,
  removeLink,
  isOk,
  type Result,
} from "@opmodel/core";

/* ─── Editor Mode ─── */

export type EditorMode = "select" | "addObject" | "addProcess" | "addLink";

/* ─── Command Sum Type ─── */

export type Command =
  | { tag: "moveThing"; thingId: string; opdId: string; x: number; y: number }
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
  | { tag: "setMode"; mode: EditorMode };

/* ─── Effect Coproduct ─── */

export type Effect =
  | { type: "modelMutation"; apply: (model: Model) => Result<Model, InvariantError> }
  | { type: "uiTransition"; field: "selectedThing"; value: string | null }
  | { type: "uiTransition"; field: "currentOpd"; value: string }
  | { type: "uiTransition"; field: "mode"; value: EditorMode }
  | { type: "uiTransition"; field: "linkSource"; value: string | null };

/* ─── Interpret: Natural Transformation η ─── */

export function interpret(cmd: Command): Effect {
  switch (cmd.tag) {
    case "moveThing":
      return {
        type: "modelMutation",
        apply: (m) => updateAppearance(m, cmd.thingId, cmd.opdId, { x: cmd.x, y: cmd.y }),
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
          return addAppearance(r1.value, {
            thing: cmd.thing.id,
            opd: cmd.opdId,
            x: cmd.x,
            y: cmd.y,
            w: cmd.w,
            h: cmd.h,
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

    case "setMode":
      return { type: "uiTransition", field: "mode", value: cmd.mode };
  }
}
