import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addOPD, addAppearance, removeAppearance } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, OPD, Appearance } from "../src/types";

const water: Thing = { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };

describe("addAppearance", () => {
  it("adds an appearance", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const r = addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50 });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.appearances.size).toBe(1);
  });

  it("rejects duplicate thing+opd (I-04)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50 }) as any).value;
    const r = addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 100, y: 100, w: 120, h: 50 });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-04");
  });

  it("rejects internal=true in non-refinement OPD (I-15)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const r = addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50, internal: true });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-15");
  });

  it("allows internal=true in refinement OPD (I-15 satisfied)", () => {
    let m = createModel("Test");
    const proc: Thing = { id: "proc-heating", kind: "process", name: "Heating", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-heating", refinement_type: "in-zoom" }) as any).value;
    const r = addAppearance(m, { thing: "obj-water", opd: "opd-sd1", x: 50, y: 50, w: 120, h: 50, internal: true });
    expect(isOk(r)).toBe(true);
  });
});

describe("removeAppearance", () => {
  it("removes by thing+opd key", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50 }) as any).value;
    const r = removeAppearance(m, "obj-water", "opd-sd");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.appearances.size).toBe(0);
  });
});
