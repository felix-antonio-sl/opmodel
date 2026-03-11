import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, addModifier, removeModifier, addFan, removeFan, addAssertion, addRequirement, addStereotype, addSubModel, validate } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, Link, Modifier, Fan } from "../src/types";

const water: Thing = { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };
const proc: Thing = { id: "proc-heating", kind: "process", name: "Heating", essence: "physical", affiliation: "systemic" };

describe("addModifier", () => {
  it("adds modifier to existing link", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addLink(m, { id: "lnk-effect", type: "effect", source: "proc-heating", target: "obj-water" }) as any).value;
    const r = addModifier(m, { id: "mod-ev", over: "lnk-effect", type: "event" });
    expect(isOk(r)).toBe(true);
  });

  it("rejects modifier on non-existent link (I-06)", () => {
    const r = addModifier(createModel("Test"), { id: "mod-ev", over: "lnk-ghost", type: "event" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-06");
  });
});

describe("addFan", () => {
  it("rejects fan with non-existent member links (I-07)", () => {
    const r = addFan(createModel("Test"), { id: "fan-1", type: "xor", members: ["lnk-ghost-1", "lnk-ghost-2"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-07");
  });

  it("rejects fan with fewer than 2 members (I-07)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addLink(m, { id: "lnk-a", type: "effect", source: "proc-heating", target: "obj-water" }) as any).value;
    const r = addFan(m, { id: "fan-1", type: "xor", members: ["lnk-a"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-07");
  });
});

describe("validate", () => {
  it("returns empty array for valid model", () => {
    expect(validate(createModel("Test"))).toEqual([]);
  });

  it("catches orphaned state parent (I-01)", () => {
    let m = createModel("Test");
    m = { ...m, states: new Map(m.states).set("state-orphan", {
      id: "state-orphan", parent: "obj-ghost", name: "orphan",
      initial: true, final: false, default: true,
    })};
    expect(validate(m).some((e) => e.code === "I-01")).toBe(true);
  });

  it("catches link with missing endpoint (I-05)", () => {
    let m = createModel("Test");
    m = { ...m, links: new Map(m.links).set("lnk-bad", {
      id: "lnk-bad", type: "effect" as const, source: "proc-ghost", target: "obj-ghost",
    })};
    expect(validate(m).some((e) => e.code === "I-05")).toBe(true);
  });

  it("catches modifier on missing link (I-06)", () => {
    let m = createModel("Test");
    m = { ...m, modifiers: new Map(m.modifiers).set("mod-bad", {
      id: "mod-bad", over: "lnk-ghost", type: "event" as const,
    })};
    expect(validate(m).some((e) => e.code === "I-06")).toBe(true);
  });

  it("catches fan with < 2 members (I-07)", () => {
    let m = createModel("Test");
    m = { ...m, fans: new Map(m.fans).set("fan-bad", {
      id: "fan-bad", type: "xor" as const, members: ["lnk-a"],
    })};
    expect(validate(m).some((e) => e.code === "I-07")).toBe(true);
  });
});
