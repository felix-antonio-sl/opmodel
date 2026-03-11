import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, removeThing,
  addState, removeState,
  addLink, removeLink,
  addOPD, removeOPD,
  addAppearance, removeAppearance,
  addModifier, removeModifier,
  addFan, removeFan,
  addScenario, removeScenario,
  addAssertion, removeAssertion,
  addRequirement, removeRequirement,
  addStereotype, removeStereotype,
  addSubModel, removeSubModel,
} from "../src/api";
import { isOk } from "../src/result";
import type { Model, Thing, State, Link, OPD, Appearance } from "../src/types";
import type { Result } from "../src/result";
import type { InvariantError } from "../src/result";

const water: Thing = { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };
const proc: Thing = { id: "proc-heat", kind: "process", name: "Heat", essence: "physical", affiliation: "systemic" };

let timeCounter = 0;
beforeEach(() => {
  vi.useFakeTimers();
  timeCounter = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

function advanceTime() {
  timeCounter += 1000;
  vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 0, timeCounter / 1000)));
}

function expectTouched(original: Model, result: Result<Model, InvariantError>) {
  if (!isOk(result)) throw new Error("Expected ok result");
  expect(result.value.meta.modified).not.toBe(original.meta.modified);
  expect(result.value.meta.created).toBe(original.meta.created);
}

describe("touch() composition", () => {
  it("addThing updates meta.modified", () => {
    advanceTime();
    const m = createModel("Test");
    advanceTime();
    const r = addThing(m, water);
    expectTouched(m, r);
  });

  it("removeThing updates meta.modified", () => {
    advanceTime();
    const m = createModel("Test");
    advanceTime();
    const r1 = addThing(m, water);
    if (!isOk(r1)) return;
    advanceTime();
    const r2 = removeThing(r1.value, "obj-water");
    expectTouched(r1.value, r2);
  });

  it("addState updates meta.modified", () => {
    advanceTime();
    let m = createModel("Test");
    advanceTime();
    m = (addThing(m, water) as any).value;
    advanceTime();
    const r = addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true });
    expectTouched(m, r);
  });

  it("addLink updates meta.modified", () => {
    advanceTime();
    let m = createModel("Test");
    advanceTime();
    m = (addThing(m, water) as any).value;
    advanceTime();
    m = (addThing(m, proc) as any).value;
    advanceTime();
    const r = addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-water" });
    expectTouched(m, r);
  });

  it("addOPD updates meta.modified", () => {
    advanceTime();
    const m = createModel("Test");
    advanceTime();
    const r = addOPD(m, { id: "opd-child", name: "Child", opd_type: "hierarchical", parent_opd: "opd-sd" });
    expectTouched(m, r);
  });

  it("addAppearance updates meta.modified", () => {
    advanceTime();
    let m = createModel("Test");
    advanceTime();
    m = (addThing(m, water) as any).value;
    advanceTime();
    const r = addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
    expectTouched(m, r);
  });
});
