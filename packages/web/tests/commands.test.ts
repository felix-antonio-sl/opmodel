import { describe, it, expect } from "vitest";
import { interpret, type Command } from "../src/lib/commands";
import {
  createModel,
  addThing,
  addAppearance,
  addLink,
  addState,
  isOk,
  type Model,
  type Thing,
  type Link,
  type State,
} from "@opmodel/core";

/* ─── Helper: build a model with an object + a process, each with an appearance in opd-sd ─── */

function modelWithThings(): Model {
  let m = createModel("Test");
  const obj: Thing = {
    id: "obj-1",
    kind: "object",
    name: "Water",
    essence: "physical",
    affiliation: "systemic",
  };
  const proc: Thing = {
    id: "proc-1",
    kind: "process",
    name: "Heating",
    essence: "informatical",
    affiliation: "systemic",
  };
  let r = addThing(m, obj);
  m = isOk(r) ? r.value : m;
  r = addThing(m, proc);
  m = isOk(r) ? r.value : m;
  r = addAppearance(m, { thing: "obj-1", opd: "opd-sd", x: 50, y: 50, w: 120, h: 60 });
  m = isOk(r) ? r.value : m;
  r = addAppearance(m, { thing: "proc-1", opd: "opd-sd", x: 200, y: 50, w: 120, h: 60 });
  m = isOk(r) ? r.value : m;
  return m;
}

/* ─── Helper: build a model that additionally has a link and a state ─── */

function modelWithLinkAndState(): Model {
  let m = modelWithThings();
  const link: Link = {
    id: "link-1",
    type: "agent",
    source: "obj-1",
    target: "proc-1",
  };
  let r = addLink(m, link);
  m = isOk(r) ? r.value : m;
  const state: State = {
    id: "state-1",
    parent: "obj-1",
    name: "Hot",
    initial: true,
    final: false,
    default: false,
  };
  r = addState(m, state);
  m = isOk(r) ? r.value : m;
  return m;
}

/* ═══════════════════════════════════════════════════
   Model Mutation Commands
   ═══════════════════════════════════════════════════ */

describe("interpret — modelMutation commands", () => {
  it("moveThing → modelMutation that updates appearance position", () => {
    const cmd: Command = { tag: "moveThing", thingId: "obj-1", opdId: "opd-sd", x: 300, y: 400 };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const app = result.value.appearances.get("obj-1::opd-sd");
    expect(app).toBeDefined();
    expect(app!.x).toBe(300);
    expect(app!.y).toBe(400);
  });

  it("moveThings → modelMutation that batch-updates appearance positions", () => {
    const cmd: Command = {
      tag: "moveThings",
      moves: [
        { thingId: "obj-1", opdId: "opd-sd", x: 10, y: 20 },
        { thingId: "proc-1", opdId: "opd-sd", x: 30, y: 40 },
      ],
    };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const appObj = result.value.appearances.get("obj-1::opd-sd");
    const appProc = result.value.appearances.get("proc-1::opd-sd");
    expect(appObj!.x).toBe(10);
    expect(appObj!.y).toBe(20);
    expect(appProc!.x).toBe(30);
    expect(appProc!.y).toBe(40);
  });

  it("resizeThing → modelMutation that updates appearance dimensions", () => {
    const cmd: Command = { tag: "resizeThing", thingId: "obj-1", opdId: "opd-sd", w: 200, h: 100 };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const app = result.value.appearances.get("obj-1::opd-sd");
    expect(app!.w).toBe(200);
    expect(app!.h).toBe(100);
  });

  it("renameThing → modelMutation that updates thing name", () => {
    const cmd: Command = { tag: "renameThing", thingId: "obj-1", name: "Steam" };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.things.get("obj-1")!.name).toBe("Steam");
  });

  it("updateThingProps → modelMutation that patches thing properties", () => {
    const cmd: Command = {
      tag: "updateThingProps",
      thingId: "obj-1",
      patch: { essence: "informatical" },
    };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.things.get("obj-1")!.essence).toBe("informatical");
  });

  it("addThing → modelMutation that adds thing + appearance", () => {
    const newThing: Thing = {
      id: "obj-new",
      kind: "object",
      name: "Ice",
      essence: "physical",
      affiliation: "systemic",
    };
    const cmd: Command = {
      tag: "addThing",
      thing: newThing,
      opdId: "opd-sd",
      x: 400,
      y: 400,
      w: 100,
      h: 50,
    };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.things.has("obj-new")).toBe(true);
    expect(result.value.things.get("obj-new")!.name).toBe("Ice");
    const app = result.value.appearances.get("obj-new::opd-sd");
    expect(app).toBeDefined();
    expect(app!.x).toBe(400);
    expect(app!.y).toBe(400);
    expect(app!.w).toBe(100);
    expect(app!.h).toBe(50);
  });

  it("removeThing → modelMutation that removes thing", () => {
    const cmd: Command = { tag: "removeThing", thingId: "obj-1" };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.things.has("obj-1")).toBe(false);
    expect(result.value.appearances.has("obj-1::opd-sd")).toBe(false);
  });

  it("addLink → modelMutation that adds link between things", () => {
    const link: Link = {
      id: "link-new",
      type: "effect",
      source: "proc-1",
      target: "obj-1",
    };
    const cmd: Command = { tag: "addLink", link };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.links.has("link-new")).toBe(true);
    expect(result.value.links.get("link-new")!.type).toBe("effect");
  });

  it("removeLink → modelMutation that removes link", () => {
    const cmd: Command = { tag: "removeLink", linkId: "link-1" };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithLinkAndState();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.links.has("link-1")).toBe(false);
  });

  it("addState → modelMutation that adds state to object", () => {
    const state = {
      id: "state-new",
      parent: "obj-1",
      name: "Cold",
      initial: false,
      final: false,
      default: true,
    };
    const cmd: Command = { tag: "addState", state };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.states.has("state-new")).toBe(true);
    expect(result.value.states.get("state-new")!.name).toBe("Cold");
    expect(result.value.states.get("state-new")!.parent).toBe("obj-1");
  });

  it("removeState → modelMutation that removes state", () => {
    const cmd: Command = { tag: "removeState", stateId: "state-1" };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithLinkAndState();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.states.has("state-1")).toBe(false);
  });

  it("updateLink → modelMutation that patches link properties", () => {
    const cmd: Command = {
      tag: "updateLink",
      linkId: "link-1",
      patch: { type: "instrument" },
    };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithLinkAndState();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.links.get("link-1")!.type).toBe("instrument");
  });

  it("updateState → modelMutation that patches state properties", () => {
    const cmd: Command = {
      tag: "updateState",
      stateId: "state-1",
      patch: { name: "Boiling", final: true },
    };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithLinkAndState();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const s = result.value.states.get("state-1")!;
    expect(s.name).toBe("Boiling");
    expect(s.final).toBe(true);
  });

  it("refineThing → modelMutation that creates refinement OPD", () => {
    const cmd: Command = {
      tag: "refineThing",
      thingId: "proc-1",
      opdId: "opd-sd",
      refinementType: "in-zoom",
      childOpdId: "opd-proc1-iz",
      childOpdName: "Heating In-Zoom",
    };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.opds.has("opd-proc1-iz")).toBe(true);
    const childOpd = result.value.opds.get("opd-proc1-iz")!;
    expect(childOpd.refines).toBe("proc-1");
    expect(childOpd.refinement_type).toBe("in-zoom");
    expect(childOpd.name).toBe("Heating In-Zoom");
  });

  it("applyOplEdit → modelMutation that applies OPL-level edit", () => {
    const cmd: Command = {
      tag: "applyOplEdit",
      edit: { kind: "remove-thing", thingId: "obj-1" },
    };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.things.has("obj-1")).toBe(false);
  });

  it("updateAppearance → modelMutation that patches appearance", () => {
    const cmd: Command = {
      tag: "updateAppearance",
      thingId: "obj-1",
      opdId: "opd-sd",
      patch: { pinned: true, x: 999 },
    };
    const effect = interpret(cmd);
    expect(effect.type).toBe("modelMutation");

    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const app = result.value.appearances.get("obj-1::opd-sd")!;
    expect(app.pinned).toBe(true);
    expect(app.x).toBe(999);
  });
});

/* ═══════════════════════════════════════════════════
   UI Transition Commands
   ═══════════════════════════════════════════════════ */

describe("interpret — uiTransition commands", () => {
  it("selectThing → uiTransition with field=selectedThing and value=thingId", () => {
    const effect = interpret({ tag: "selectThing", thingId: "obj-1" });
    expect(effect.type).toBe("uiTransition");
    if (effect.type !== "uiTransition") return;
    expect(effect.field).toBe("selectedThing");
    expect(effect.value).toBe("obj-1");
  });

  it("selectThing with null → uiTransition with value=null", () => {
    const effect = interpret({ tag: "selectThing", thingId: null });
    expect(effect.type).toBe("uiTransition");
    if (effect.type !== "uiTransition") return;
    expect(effect.field).toBe("selectedThing");
    expect(effect.value).toBeNull();
  });

  it("selectOpd → uiTransition with field=currentOpd", () => {
    const effect = interpret({ tag: "selectOpd", opdId: "opd-sd" });
    expect(effect.type).toBe("uiTransition");
    if (effect.type !== "uiTransition") return;
    expect(effect.field).toBe("currentOpd");
    expect(effect.value).toBe("opd-sd");
  });

  it("setMode → uiTransition with field=mode", () => {
    const effect = interpret({ tag: "setMode", mode: "addObject" });
    expect(effect.type).toBe("uiTransition");
    if (effect.type !== "uiTransition") return;
    expect(effect.field).toBe("mode");
    expect(effect.value).toBe("addObject");
  });

  it("setLinkType → uiTransition with field=linkType", () => {
    const effect = interpret({ tag: "setLinkType", linkType: "agent" });
    expect(effect.type).toBe("uiTransition");
    if (effect.type !== "uiTransition") return;
    expect(effect.field).toBe("linkType");
    expect(effect.value).toBe("agent");
  });

  it("setLinkType auto → uiTransition with value=auto", () => {
    const effect = interpret({ tag: "setLinkType", linkType: "auto" });
    expect(effect.type).toBe("uiTransition");
    if (effect.type !== "uiTransition") return;
    expect(effect.field).toBe("linkType");
    expect(effect.value).toBe("auto");
  });
});

/* ═══════════════════════════════════════════════════
   Simulation Effect Commands
   ═══════════════════════════════════════════════════ */

describe("interpret — simulationEffect commands", () => {
  it("startSimulation → simulationEffect with action=start", () => {
    const effect = interpret({ tag: "startSimulation" });
    expect(effect.type).toBe("simulationEffect");
    if (effect.type !== "simulationEffect") return;
    expect(effect.action).toBe("start");
    expect(effect.payload).toBeUndefined();
  });

  it("stepSimulation forward → simulationEffect with action=step, payload=1", () => {
    const effect = interpret({ tag: "stepSimulation", direction: 1 });
    expect(effect.type).toBe("simulationEffect");
    if (effect.type !== "simulationEffect") return;
    expect(effect.action).toBe("step");
    expect(effect.payload).toBe(1);
  });

  it("stepSimulation backward → simulationEffect with action=step, payload=-1", () => {
    const effect = interpret({ tag: "stepSimulation", direction: -1 });
    expect(effect.type).toBe("simulationEffect");
    if (effect.type !== "simulationEffect") return;
    expect(effect.action).toBe("step");
    expect(effect.payload).toBe(-1);
  });

  it("resetSimulation → simulationEffect with action=reset", () => {
    const effect = interpret({ tag: "resetSimulation" });
    expect(effect.type).toBe("simulationEffect");
    if (effect.type !== "simulationEffect") return;
    expect(effect.action).toBe("reset");
    expect(effect.payload).toBeUndefined();
  });

  it("setSimulationStep → simulationEffect with action=setStep, payload=index", () => {
    const effect = interpret({ tag: "setSimulationStep", index: 5 });
    expect(effect.type).toBe("simulationEffect");
    if (effect.type !== "simulationEffect") return;
    expect(effect.action).toBe("setStep");
    expect(effect.payload).toBe(5);
  });

  it("setSimulationSpeed → simulationEffect with action=setSpeed, payload=speed", () => {
    const effect = interpret({ tag: "setSimulationSpeed", speed: 250 });
    expect(effect.type).toBe("simulationEffect");
    if (effect.type !== "simulationEffect") return;
    expect(effect.action).toBe("setSpeed");
    expect(effect.payload).toBe(250);
  });

  it("toggleSimulationAutoRun → simulationEffect with action=toggleAutoRun", () => {
    const effect = interpret({ tag: "toggleSimulationAutoRun" });
    expect(effect.type).toBe("simulationEffect");
    if (effect.type !== "simulationEffect") return;
    expect(effect.action).toBe("toggleAutoRun");
    expect(effect.payload).toBeUndefined();
  });

  /* ─── Settings Commands ─── */

  it("updateSettings → modelMutation that patches opl_language", () => {
    const effect = interpret({ tag: "updateSettings", patch: { opl_language: "es" } });
    expect(effect.type).toBe("modelMutation");
    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.settings.opl_language).toBe("es");
  });

  it("updateSettings → toggle language back to en", () => {
    const m = modelWithThings();
    // Set to es first
    const e1 = interpret({ tag: "updateSettings", patch: { opl_language: "es" } });
    if (e1.type !== "modelMutation") return;
    const r1 = e1.apply(m);
    if (!isOk(r1)) return;
    expect(r1.value.settings.opl_language).toBe("es");
    // Toggle back to en
    const e2 = interpret({ tag: "updateSettings", patch: { opl_language: "en" } });
    if (e2.type !== "modelMutation") return;
    const r2 = e2.apply(r1.value);
    if (!isOk(r2)) return;
    expect(r2.value.settings.opl_language).toBe("en");
  });

  it("updateSettings → patches other settings", () => {
    const effect = interpret({ tag: "updateSettings", patch: { opl_essence_visibility: "none" } });
    expect(effect.type).toBe("modelMutation");
    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.settings.opl_essence_visibility).toBe("none");
  });

  /* ─── Meta Commands ─── */

  it("updateMeta → modelMutation that patches model name", () => {
    const effect = interpret({ tag: "updateMeta", patch: { name: "New Name" } });
    expect(effect.type).toBe("modelMutation");
    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.meta.name).toBe("New Name");
  });

  it("updateMeta → patches description", () => {
    const effect = interpret({ tag: "updateMeta", patch: { description: "A test model" } });
    if (effect.type !== "modelMutation") return;
    const m = modelWithThings();
    const result = effect.apply(m);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.meta.description).toBe("A test model");
  });
});
