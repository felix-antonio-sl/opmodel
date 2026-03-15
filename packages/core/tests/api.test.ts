import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, removeThing, addState, removeState } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, State } from "../src/types";

const waterObj: Thing = {
  id: "obj-water", kind: "object", name: "Water",
  essence: "physical", affiliation: "systemic",
};

describe("addThing", () => {
  it("adds a thing to an empty model", () => {
    const model = createModel("Test");
    const result = addThing(model, waterObj);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.things.size).toBe(1);
    expect(result.value.things.get("obj-water")?.name).toBe("Water");
  });

  it("does not mutate original model (immutable)", () => {
    const model = createModel("Test");
    addThing(model, waterObj);
    expect(model.things.size).toBe(0);
  });

  it("rejects duplicate id (I-08)", () => {
    const model = createModel("Test");
    const r1 = addThing(model, waterObj);
    if (!isOk(r1)) return;
    const r2 = addThing(r1.value, { ...waterObj });
    expect(isErr(r2)).toBe(true);
    if (isErr(r2)) expect(r2.error.code).toBe("I-08");
  });

  it("rejects id colliding with existing state (I-08 global)", () => {
    const model = createModel("Test");
    const r1 = addThing(model, waterObj);
    if (!isOk(r1)) return;
    const m = r1.value;
    const m2: typeof m = {
      ...m,
      states: new Map(m.states).set("state-x", {
        id: "state-x", parent: "obj-water", name: "x",
        initial: true, final: false, default: true,
      }),
    };
    const r2 = addThing(m2, {
      id: "state-x", kind: "object", name: "Clash",
      essence: "physical", affiliation: "systemic",
    });
    expect(isErr(r2)).toBe(true);
  });
});

describe("removeThing", () => {
  it("removes a thing", () => {
    const m0 = createModel("Test");
    const r1 = addThing(m0, waterObj);
    if (!isOk(r1)) return;
    const r2 = removeThing(r1.value, "obj-water");
    expect(isOk(r2)).toBe(true);
    if (isOk(r2)) expect(r2.value.things.size).toBe(0);
  });

  it("rejects removing non-existent thing", () => {
    const model = createModel("Test");
    const result = removeThing(model, "obj-ghost");
    expect(isErr(result)).toBe(true);
  });

  it("cascade deletes states (I-02)", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as Extract<typeof m extends never ? never : ReturnType<typeof addThing>, { ok: true }>).value;
    // Use addState once it exists; for now set up manually
    m = { ...m, states: new Map(m.states).set("state-water-cold", {
      id: "state-water-cold", parent: "obj-water", name: "cold",
      initial: true, final: false, default: true,
    })};
    expect(m.states.size).toBe(1);
    const r = removeThing(m, "obj-water");
    if (!isOk(r)) return;
    expect(r.value.states.size).toBe(0);
  });

  it("cascade deletes links touching thing (I-02)", () => {
    let m = createModel("Test");
    const proc: Thing = {
      id: "proc-heating", kind: "process", name: "Heating",
      essence: "physical", affiliation: "systemic",
    };
    m = (addThing(m, waterObj) as any).value;
    m = (addThing(m, proc) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-effect", {
      id: "lnk-effect", type: "effect" as const,
      source: "proc-heating", target: "obj-water",
    })};
    expect(m.links.size).toBe(1);
    const r = removeThing(m, "obj-water");
    if (!isOk(r)) return;
    expect(r.value.links.size).toBe(0);
  });

  it("cascade deletes appearances of thing (I-02)", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as any).value;
    m = { ...m, appearances: new Map(m.appearances).set("obj-water::opd-sd", {
      thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50,
    })};
    const r = removeThing(m, "obj-water");
    if (!isOk(r)) return;
    expect(r.value.appearances.size).toBe(0);
  });

  it("cascade deletes modifiers over removed links (I-02)", () => {
    let m = createModel("Test");
    const proc: Thing = {
      id: "proc-heating", kind: "process", name: "Heating",
      essence: "physical", affiliation: "systemic",
    };
    m = (addThing(m, waterObj) as any).value;
    m = (addThing(m, proc) as any).value;
    m = { ...m,
      links: new Map(m.links).set("lnk-effect", {
        id: "lnk-effect", type: "effect" as const,
        source: "proc-heating", target: "obj-water",
      }),
      modifiers: new Map(m.modifiers).set("mod-ev", {
        id: "mod-ev", over: "lnk-effect", type: "event" as const,
      }),
    };
    const r = removeThing(m, "obj-water");
    if (!isOk(r)) return;
    expect(r.value.modifiers.size).toBe(0);
  });

  it("cascade cleans up fans with removed link members (I-02)", () => {
    let m = createModel("Test");
    const proc: Thing = {
      id: "proc-heating", kind: "process", name: "Heating",
      essence: "physical", affiliation: "systemic",
    };
    m = (addThing(m, waterObj) as any).value;
    m = (addThing(m, proc) as any).value;
    m = { ...m,
      links: new Map(m.links)
        .set("lnk-a", { id: "lnk-a", type: "effect" as const, source: "proc-heating", target: "obj-water" })
        .set("lnk-b", { id: "lnk-b", type: "consumption" as const, source: "obj-water", target: "proc-heating" }),
      fans: new Map(m.fans).set("fan-1", {
        id: "fan-1", type: "xor" as const, members: ["lnk-a", "lnk-b"],
      }),
    };
    const r = removeThing(m, "obj-water");
    if (!isOk(r)) return;
    // Both links removed → fan has < 2 members → fan deleted
    expect(r.value.fans.size).toBe(0);
  });
});

describe("addState", () => {
  it("adds a state to an object", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as any).value;
    const state: State = {
      id: "state-water-cold", parent: "obj-water", name: "cold",
      initial: true, final: false, default: true,
    };
    const r = addState(m, state);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.states.size).toBe(1);
  });

  it("rejects state on non-existent parent (I-01)", () => {
    const m = createModel("Test");
    const state: State = {
      id: "state-ghost-x", parent: "obj-ghost", name: "x",
      initial: true, final: false, default: true,
    };
    const r = addState(m, state);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });

  it("rejects state on process (I-01: parent must be object)", () => {
    let m = createModel("Test");
    const proc: Thing = {
      id: "proc-heating", kind: "process", name: "Heating",
      essence: "physical", affiliation: "systemic",
    };
    m = (addThing(m, proc) as any).value;
    const state: State = {
      id: "state-heating-x", parent: "proc-heating", name: "x",
      initial: true, final: false, default: true,
    };
    const r = addState(m, state);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });

  it("rejects duplicate id (I-08)", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as any).value;
    const state: State = {
      id: "state-water-cold", parent: "obj-water", name: "cold",
      initial: true, final: false, default: true,
    };
    m = (addState(m, state) as any).value;
    const r = addState(m, { ...state });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-08");
  });
});

describe("removeState", () => {
  it("removes a state", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as any).value;
    const state: State = {
      id: "state-water-cold", parent: "obj-water", name: "cold",
      initial: true, final: false, default: true,
    };
    m = (addState(m, state) as any).value;
    const r = removeState(m, "state-water-cold");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.states.size).toBe(0);
  });

  it("rejects removing non-existent state", () => {
    const r = removeState(createModel("Test"), "state-ghost");
    expect(isErr(r)).toBe(true);
  });
});
