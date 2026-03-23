import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, addState, addFan, addOPD, updateFan, updateOPD, validate } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, Link, State, Fan, OPD } from "../src/types";

// === Helpers ===

const obj = (id: string, name: string): Thing => ({
  id, kind: "object", name, essence: "physical", affiliation: "systemic",
});

const proc = (id: string, name: string): Thing => ({
  id, kind: "process", name, essence: "physical", affiliation: "systemic",
});

function buildWith(...fns: Array<(m: any) => any>) {
  let m = createModel("Test");
  for (const fn of fns) {
    const r = fn(m);
    if (r && "ok" in r && r.ok) m = r.value;
    else if (r && "value" in r) m = r.value;
    else m = r;
  }
  return m;
}

function add<T>(fn: (m: any, e: T) => any, entity: T) {
  return (m: any) => fn(m, entity);
}

function errorsOf(model: ReturnType<typeof createModel>, code: string) {
  return validate(model).filter(e => e.code === code);
}

// === I-17: Process must have at least one transformation link ===

describe("I-17: orphan processes", () => {
  it("flags process with no transformation link", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    const errors = errorsOf(m, "I-17");
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].entity).toBe("proc-boil");
  });

  it("passes when process has an effect link", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = (addLink(m, { id: "lnk-eff", type: "effect", source: "proc-boil", target: "obj-water" }) as any).value;
    const errors = errorsOf(m, "I-17");
    expect(errors).toHaveLength(0);
  });

  it("does not count agent link as transformation", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-barista", "Barista")) as any).value;
    m = (addLink(m, { id: "lnk-ag", type: "agent", source: "obj-barista", target: "proc-boil" }) as any).value;
    const errors = errorsOf(m, "I-17");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});

// === I-20: Object with states must have >= 2 states ===

describe("I-20: single state objects", () => {
  it("flags object with exactly 1 state", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    const errors = errorsOf(m, "I-20");
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].entity).toBe("obj-water");
  });

  it("passes with 0 states (stateless object)", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    const errors = errorsOf(m, "I-20");
    expect(errors).toHaveLength(0);
  });

  it("passes with 2+ states", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-hot", parent: "obj-water", name: "hot", initial: false, final: false, default: false }) as any).value;
    const errors = errorsOf(m, "I-20");
    expect(errors).toHaveLength(0);
  });
});

// === I-22: Generalization same perseverance ===

describe("I-22: generalization perseverance", () => {
  it("flags generalization between object and process", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-vehicle", "Vehicle")) as any).value;
    m = (addThing(m, proc("proc-car", "Car")) as any).value;
    // Manually add link to bypass addLink guards
    m = { ...m, links: new Map(m.links).set("lnk-gen", {
      id: "lnk-gen", type: "generalization", source: "proc-car", target: "obj-vehicle",
    }) };
    const errors = errorsOf(m, "I-22");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("passes when both are objects", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-vehicle", "Vehicle")) as any).value;
    m = (addThing(m, obj("obj-car", "Car")) as any).value;
    m = (addLink(m, { id: "lnk-gen", type: "generalization", source: "obj-car", target: "obj-vehicle" }) as any).value;
    const errors = errorsOf(m, "I-22");
    expect(errors).toHaveLength(0);
  });
});

// === I-23: Classification same perseverance ===

describe("I-23: classification perseverance", () => {
  it("flags classification between object and process", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-class", "VehicleClass")) as any).value;
    m = (addThing(m, proc("proc-inst", "CarInstance")) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-cls", {
      id: "lnk-cls", type: "classification", source: "proc-inst", target: "obj-class",
    }) };
    const errors = errorsOf(m, "I-23");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("passes when both are same kind", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-class", "VehicleClass")) as any).value;
    m = (addThing(m, obj("obj-inst", "MyCar")) as any).value;
    m = (addLink(m, { id: "lnk-cls", type: "classification", source: "obj-inst", target: "obj-class" }) as any).value;
    const errors = errorsOf(m, "I-23");
    expect(errors).toHaveLength(0);
  });
});

// === I-24: Invocation links must connect processes only ===

describe("I-24: invocation links process-only", () => {
  it("flags invocation with object source", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-y", "Y")) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-inv", {
      id: "lnk-inv", type: "invocation", source: "obj-x", target: "proc-y",
    }) };
    const errors = errorsOf(m, "I-24");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("passes when both are processes", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-main", "Main")) as any).value;
    m = (addThing(m, proc("proc-sub", "Sub")) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-inv", {
      id: "lnk-inv", type: "invocation", source: "proc-main", target: "proc-sub",
    }) };
    const errors = errorsOf(m, "I-24");
    expect(errors).toHaveLength(0);
  });
});

// === I-25: Exception links must connect processes only ===

describe("I-25: exception links process-only", () => {
  it("flags exception with object target", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-x", "X")) as any).value;
    m = (addThing(m, obj("obj-y", "Y")) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-exc", {
      id: "lnk-exc", type: "exception", source: "proc-x", target: "obj-y",
    }) };
    const errors = errorsOf(m, "I-25");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});

// === I-26: Aggregation same perseverance ===

describe("I-26: aggregation perseverance", () => {
  it("flags aggregation of object into process", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-whole", "Assembly")) as any).value;
    m = (addThing(m, obj("obj-part", "Component")) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-agg", {
      id: "lnk-agg", type: "aggregation", source: "obj-part", target: "proc-whole",
    }) };
    const errors = errorsOf(m, "I-26");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("passes when both are objects", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-car", "Car")) as any).value;
    m = (addThing(m, obj("obj-wheel", "Wheel")) as any).value;
    m = (addLink(m, { id: "lnk-agg", type: "aggregation", source: "obj-wheel", target: "obj-car" }) as any).value;
    const errors = errorsOf(m, "I-26");
    expect(errors).toHaveLength(0);
  });
});

// === I-27: Exhibition perseverance — REMOVED per ISO §7.2.2 ===
// Exhibition-characterization is explicitly exempt from perseverance rule.
// Objects CAN exhibit process features (operations) and vice versa.

describe("I-27: exhibition perseverance (removed)", () => {
  it("allows exhibition of process by object — ISO §7.2.2 exemption", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-exhibitor", "Car")) as any).value;
    m = (addThing(m, proc("proc-feature", "Speed")) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-exh", {
      id: "lnk-exh", type: "exhibition", source: "obj-exhibitor", target: "proc-feature",
    }) };
    const errors = errorsOf(m, "I-27");
    expect(errors).toHaveLength(0);
  });
});

// === I-28: State-specified links valid state references ===

describe("I-28: state-specified link validation", () => {
  it("flags link with non-existent source_state", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-eff", {
      id: "lnk-eff", type: "effect", source: "proc-boil", target: "obj-water",
      source_state: "state-ghost",
    }) };
    const errors = errorsOf(m, "I-28");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("flags link with non-existent target_state", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-eff", {
      id: "lnk-eff", type: "effect", source: "proc-boil", target: "obj-water",
      target_state: "state-ghost",
    }) };
    const errors = errorsOf(m, "I-28");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("flags effect link source_state not belonging to target object", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = (addThing(m, obj("obj-other", "Other")) as any).value;
    m = (addState(m, { id: "state-x", parent: "obj-other", name: "x", initial: true, final: false, default: true }) as any).value;
    // Effect: source_state should belong to target (Water), but it belongs to Other
    m = { ...m, links: new Map(m.links).set("lnk-eff", {
      id: "lnk-eff", type: "effect", source: "proc-boil", target: "obj-water",
      source_state: "state-x",
    }) };
    const errors = errorsOf(m, "I-28");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("passes with valid state references on effect link", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = (addState(m, { id: "state-liquid", parent: "obj-water", name: "liquid", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-gas", parent: "obj-water", name: "gas", initial: false, final: false, default: false }) as any).value;
    m = { ...m, links: new Map(m.links).set("lnk-eff", {
      id: "lnk-eff", type: "effect", source: "proc-boil", target: "obj-water",
      source_state: "state-liquid", target_state: "state-gas",
    }) };
    const errors = errorsOf(m, "I-28");
    expect(errors).toHaveLength(0);
  });

  it("validates agent link source_state belongs to source (agent object)", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-barista", "Barista")) as any).value;
    m = (addThing(m, proc("proc-brew", "Brewing")) as any).value;
    m = (addThing(m, obj("obj-other", "Other")) as any).value;
    m = (addState(m, { id: "state-ready", parent: "obj-other", name: "ready", initial: true, final: false, default: true }) as any).value;
    // Agent: source_state should belong to source (Barista), but it belongs to Other
    m = { ...m, links: new Map(m.links).set("lnk-ag", {
      id: "lnk-ag", type: "agent", source: "obj-barista", target: "proc-brew",
      source_state: "state-ready",
    }) };
    const errors = errorsOf(m, "I-28");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});

// === I-29: Fan members same link type (eager in addFan/updateFan) ===

describe("I-29: fan member type consistency", () => {
  it("flags fan with mixed link types (validate)", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = (addThing(m, obj("obj-cup", "Cup")) as any).value;
    m = (addLink(m, { id: "lnk-eff", type: "effect", source: "proc-boil", target: "obj-water" }) as any).value;
    m = (addLink(m, { id: "lnk-con", type: "consumption", source: "obj-cup", target: "proc-boil" }) as any).value;
    // Bypass addFan guard by manually setting
    m = { ...m, fans: new Map(m.fans).set("fan-1", { id: "fan-1", type: "xor", members: ["lnk-eff", "lnk-con"] }) };
    const errors = errorsOf(m, "I-29");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects addFan with mixed link types (I-29 eager)", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = (addThing(m, obj("obj-cup", "Cup")) as any).value;
    m = (addLink(m, { id: "lnk-eff", type: "effect", source: "proc-boil", target: "obj-water" }) as any).value;
    m = (addLink(m, { id: "lnk-con", type: "consumption", source: "obj-cup", target: "proc-boil" }) as any).value;
    const r = addFan(m, { id: "fan-1", type: "xor", members: ["lnk-eff", "lnk-con"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-29");
  });

  it("rejects updateFan introducing mixed link types (I-29 eager)", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = (addThing(m, obj("obj-milk", "Milk")) as any).value;
    m = (addThing(m, obj("obj-cup", "Cup")) as any).value;
    m = (addLink(m, { id: "lnk-eff1", type: "effect", source: "proc-boil", target: "obj-water" }) as any).value;
    m = (addLink(m, { id: "lnk-eff2", type: "effect", source: "proc-boil", target: "obj-milk" }) as any).value;
    m = (addLink(m, { id: "lnk-con", type: "consumption", source: "obj-cup", target: "proc-boil" }) as any).value;
    m = (addFan(m, { id: "fan-1", type: "xor", members: ["lnk-eff1", "lnk-eff2"] }) as any).value;
    const r = updateFan(m, "fan-1", { members: ["lnk-eff1", "lnk-con"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-29");
  });

  it("passes when all members are same type", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = (addThing(m, obj("obj-milk", "Milk")) as any).value;
    m = (addLink(m, { id: "lnk-eff1", type: "effect", source: "proc-boil", target: "obj-water" }) as any).value;
    m = (addLink(m, { id: "lnk-eff2", type: "effect", source: "proc-boil", target: "obj-milk" }) as any).value;
    m = (addFan(m, { id: "fan-1", type: "xor", members: ["lnk-eff1", "lnk-eff2"] }) as any).value;
    const errors = errorsOf(m, "I-29");
    expect(errors).toHaveLength(0);
  });
});

// === I-30: OPD refines process (in-zoom) or object (unfold) ===

describe("I-30: OPD refinement type consistency", () => {
  it("flags in-zoom that refines an object (validate)", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    m = { ...m, opds: new Map(m.opds).set("opd-child", {
      id: "opd-child", name: "Water Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "obj-water", refinement_type: "in-zoom",
    }) };
    const errors = errorsOf(m, "I-30");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("flags unfold that refines a process (validate)", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = { ...m, opds: new Map(m.opds).set("opd-child", {
      id: "opd-child", name: "Boiling Unfold", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "proc-boil", refinement_type: "unfold",
    }) };
    const errors = errorsOf(m, "I-30");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("passes in-zoom refining a process (validate)", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = { ...m, opds: new Map(m.opds).set("opd-child", {
      id: "opd-child", name: "Boiling Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "proc-boil", refinement_type: "in-zoom",
    }) };
    const errors = errorsOf(m, "I-30");
    expect(errors).toHaveLength(0);
  });

  it("rejects addOPD with in-zoom refining an object (I-30 eager)", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-water", "Water")) as any).value;
    const r = addOPD(m, {
      id: "opd-child", name: "Water Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "obj-water", refinement_type: "in-zoom",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-30");
  });

  it("rejects addOPD with unfold refining a process (I-30 eager)", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    const r = addOPD(m, {
      id: "opd-child", name: "Boil Unfold", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "proc-boil", refinement_type: "unfold",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-30");
  });

  it("allows addOPD with in-zoom refining a process (I-30 eager valid)", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    const r = addOPD(m, {
      id: "opd-child", name: "Boil Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "proc-boil", refinement_type: "in-zoom",
    });
    expect(isOk(r)).toBe(true);
  });

  it("rejects updateOPD changing to invalid refinement (I-30 eager)", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    m = (addOPD(m, {
      id: "opd-child", name: "Boil Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "proc-boil", refinement_type: "in-zoom",
    }) as any).value;
    const r = updateOPD(m, "opd-child", { refinement_type: "unfold" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-30");
  });
});

// === INCONSISTENT_REFINEMENT: refines ↔ refinement_type must both be present or absent ===

describe("INCONSISTENT_REFINEMENT: eager in addOPD/updateOPD", () => {
  it("rejects addOPD with refines but no refinement_type", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    const r = addOPD(m, {
      id: "opd-child", name: "Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "proc-boil",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("INCONSISTENT_REFINEMENT");
  });

  it("rejects addOPD with refinement_type but no refines", () => {
    let m = createModel("Test");
    const r = addOPD(m, {
      id: "opd-child", name: "Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd", refinement_type: "in-zoom",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("INCONSISTENT_REFINEMENT");
  });

  it("allows addOPD with both refines and refinement_type", () => {
    let m = createModel("Test");
    m = (addThing(m, proc("proc-boil", "Boiling")) as any).value;
    const r = addOPD(m, {
      id: "opd-child", name: "Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "proc-boil", refinement_type: "in-zoom",
    });
    expect(isOk(r)).toBe(true);
  });

  it("allows addOPD with neither refines nor refinement_type", () => {
    let m = createModel("Test");
    const r = addOPD(m, {
      id: "opd-child", name: "Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd",
    });
    expect(isOk(r)).toBe(true);
  });

  it("rejects updateOPD introducing inconsistency", () => {
    let m = createModel("Test");
    m = (addOPD(m, {
      id: "opd-child", name: "Detail", opd_type: "hierarchical",
      parent_opd: "opd-sd",
    }) as any).value;
    const r = updateOPD(m, "opd-child", { refines: "proc-boil" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("INCONSISTENT_REFINEMENT");
  });
});
