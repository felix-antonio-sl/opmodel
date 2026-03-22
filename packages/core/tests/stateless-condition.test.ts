import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, addState, addLink, addModifier,
  updateThing, updateModifier, updateLink, validate,
} from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, Link, Modifier } from "../src/types";

// === Helpers ===

const statefulObj = (id: string, name: string): Thing => ({
  id, kind: "object", name, essence: "physical", affiliation: "systemic",
  stateful: true,
});

const statelessObj = (id: string, name: string): Thing => ({
  id, kind: "object", name, essence: "physical", affiliation: "systemic",
  stateful: false,
});

const defaultObj = (id: string, name: string): Thing => ({
  id, kind: "object", name, essence: "physical", affiliation: "systemic",
  // stateful is undefined → treated as true
});

const proc = (id: string, name: string): Thing => ({
  id, kind: "process", name, essence: "physical", affiliation: "systemic",
});

describe("I-STATELESS-STATES", () => {
  it("rejects addState on stateless object", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    const r = addState(m, {
      id: "state-a", parent: "obj-x", name: "A",
      initial: true, final: false, default: true,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-STATES");
  });

  it("allows addState on stateful object", () => {
    let m = createModel("Test");
    m = (addThing(m, statefulObj("obj-x", "X")) as any).value;
    const r = addState(m, {
      id: "state-a", parent: "obj-x", name: "A",
      initial: true, final: false, default: true,
    });
    expect(isOk(r)).toBe(true);
  });

  it("allows addState on object with undefined stateful (backwards-compatible)", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    const r = addState(m, {
      id: "state-a", parent: "obj-x", name: "A",
      initial: true, final: false, default: true,
    });
    expect(isOk(r)).toBe(true);
  });
});

describe("I-STATELESS-EFFECT", () => {
  it("rejects addLink(effect) to stateless object", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    const r = addLink(m, {
      id: "lnk-1", type: "effect", source: "proc-p", target: "obj-x",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-EFFECT");
  });

  it("allows addLink(consumption) to stateless object", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    const r = addLink(m, {
      id: "lnk-1", type: "consumption", source: "obj-x", target: "proc-p",
    });
    expect(isOk(r)).toBe(true);
  });

  it("allows addLink(result) to stateless object", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    const r = addLink(m, {
      id: "lnk-1", type: "result", source: "proc-p", target: "obj-x",
    });
    expect(isOk(r)).toBe(true);
  });

  it("rejects addLink with source_state referencing stateless object's state", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    // Directly mutate obj-x to stateless (bypass updateThing guard)
    m = { ...m, things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }) };
    const r = addLink(m, {
      id: "lnk-1", type: "effect", source: "proc-p", target: "obj-x",
      source_state: "state-a",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-EFFECT");
  });

  it("rejects addLink with target_state referencing stateless object's state", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    m = { ...m, things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }) };
    const r = addLink(m, {
      id: "lnk-1", type: "effect", source: "proc-p", target: "obj-x",
      target_state: "state-b",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-EFFECT");
  });
});

describe("I-STATELESS-DOWNGRADE", () => {
  it("rejects updateThing(stateful=false) when object has states", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    const r = updateThing(m, "obj-x", { stateful: false });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-DOWNGRADE");
  });

  it("allows updateThing(stateful=false) when object has no states", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    const r = updateThing(m, "obj-x", { stateful: false });
    expect(isOk(r)).toBe(true);
  });

  it("rejects updateThing(stateful=false) when effect links target the object", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-p", target: "obj-x" }) as any).value;
    const r = updateThing(m, "obj-x", { stateful: false });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-EFFECT");
  });
});

describe("I-CONDITION-MODE", () => {
  it("rejects addModifier(condition_mode='skip', type='event')", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "obj-x", target: "proc-p" }) as any).value;
    const r = addModifier(m, {
      id: "mod-1", over: "lnk-1", type: "event", condition_mode: "skip",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-CONDITION-MODE");
  });

  it("allows addModifier(condition_mode='skip', type='condition')", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "obj-x", target: "proc-p" }) as any).value;
    const r = addModifier(m, {
      id: "mod-1", over: "lnk-1", type: "condition", condition_mode: "skip",
    });
    expect(isOk(r)).toBe(true);
  });

  it("rejects updateModifier(type='event') on modifier with condition_mode='skip'", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "obj-x", target: "proc-p" }) as any).value;
    m = (addModifier(m, { id: "mod-1", over: "lnk-1", type: "condition", condition_mode: "skip" }) as any).value;
    const r = updateModifier(m, "mod-1", { type: "event" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-CONDITION-MODE");
  });
});

describe("I-STATELESS-EFFECT in updateLink", () => {
  it("rejects updateLink(type='effect') when target is stateless", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "obj-x", target: "proc-p" }) as any).value;
    const r = updateLink(m, "lnk-1", { type: "effect" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-EFFECT");
  });
});

describe("validate — new invariants", () => {
  it("detects stateless object with pre-existing states (I-STATELESS-STATES)", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    const badModel = {
      ...m,
      things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }),
    };
    const errors = validate(badModel);
    expect(errors.some(e => e.code === "I-STATELESS-STATES")).toBe(true);
  });

  it("detects condition_mode on event modifier (I-CONDITION-MODE)", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "obj-x", target: "proc-p" }) as any).value;
    m = (addModifier(m, { id: "mod-1", over: "lnk-1", type: "event" }) as any).value;
    const badModel = {
      ...m,
      modifiers: new Map(m.modifiers).set("mod-1", { ...m.modifiers.get("mod-1")!, condition_mode: "skip" as const }),
    };
    const errors = validate(badModel);
    expect(errors.some(e => e.code === "I-CONDITION-MODE")).toBe(true);
  });

  it("detects effect link to stateless object (I-STATELESS-EFFECT)", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-p", target: "obj-x" }) as any).value;
    const badModel = {
      ...m,
      things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }),
    };
    const errors = validate(badModel);
    expect(errors.some(e => e.code === "I-STATELESS-EFFECT")).toBe(true);
  });

  it("detects stateful=false with existing states (caught by I-STATELESS-STATES)", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    const badModel = {
      ...m,
      things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }),
    };
    const errors = validate(badModel);
    expect(errors.some(e => e.code === "I-STATELESS-STATES")).toBe(true);
  });
});
