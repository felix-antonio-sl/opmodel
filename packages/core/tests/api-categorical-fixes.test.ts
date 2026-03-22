import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, addLink, addState, addAppearance, addOPD,
  removeState, updateState, updateLink, refineThing, validate,
} from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, Link, State, Model } from "../src/types";

function unwrap<T, E>(result: { ok: boolean; value?: T; error?: E }): T {
  if (!result.ok) throw new Error(`Expected ok, got error: ${JSON.stringify((result as any).error)}`);
  return result.value as T;
}

// ── P-01: Unfold selector direction ───────────────────────────────────

describe("P-01: unfold selector uses correct aggregation direction", () => {
  function buildCarModel() {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "obj-car", kind: "object", name: "Car", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-engine", kind: "object", name: "Engine", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-wheel", kind: "object", name: "Wheel", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-color", kind: "object", name: "Color", essence: "informatical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-garage", kind: "object", name: "Garage", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "proc-drive", kind: "process", name: "Driving", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addAppearance(m, { thing: "obj-car", opd: "opd-sd", x: 100, y: 100, w: 150, h: 80 }));
    m = unwrap(addAppearance(m, { thing: "obj-engine", opd: "opd-sd", x: 50, y: 200, w: 120, h: 60 }));
    m = unwrap(addAppearance(m, { thing: "obj-wheel", opd: "opd-sd", x: 200, y: 200, w: 120, h: 60 }));
    m = unwrap(addAppearance(m, { thing: "obj-color", opd: "opd-sd", x: 350, y: 200, w: 120, h: 60 }));
    m = unwrap(addAppearance(m, { thing: "obj-garage", opd: "opd-sd", x: 50, y: 50, w: 120, h: 60 }));
    m = unwrap(addAppearance(m, { thing: "proc-drive", opd: "opd-sd", x: 350, y: 100, w: 150, h: 80 }));
    // aggregation: Part → Whole (source=Part, target=Whole)
    // Engine and Wheel are Parts OF Car
    m = unwrap(addLink(m, { id: "lnk-agg1", type: "aggregation", source: "obj-engine", target: "obj-car" }));
    m = unwrap(addLink(m, { id: "lnk-agg2", type: "aggregation", source: "obj-wheel", target: "obj-car" }));
    // exhibition: Attribute → Exhibitor (source=Attribute, target=Exhibitor)
    // Color is an Attribute OF Car
    m = unwrap(addLink(m, { id: "lnk-exh1", type: "exhibition", source: "obj-color", target: "obj-car" }));
    // Car is a Part OF Garage (reverse direction — Car is contained in Garage)
    m = unwrap(addLink(m, { id: "lnk-agg3", type: "aggregation", source: "obj-car", target: "obj-garage" }));
    // effect: Process → Object (NOT aggregation/exhibition, should not appear in unfold)
    m = unwrap(addLink(m, { id: "lnk-eff1", type: "effect", source: "proc-drive", target: "obj-car" }));
    return m;
  }

  it("unfold of Car pulls in Parts (Engine, Wheel) and Attributes (Color)", () => {
    const m = buildCarModel();
    const model = unwrap(refineThing(m, "obj-car", "opd-sd", "unfold", "opd-sd1", "SD1"));
    // Parts and Attributes OF Car should appear as externals
    expect(model.appearances.has("obj-engine::opd-sd1")).toBe(true);
    expect(model.appearances.has("obj-wheel::opd-sd1")).toBe(true);
    expect(model.appearances.has("obj-color::opd-sd1")).toBe(true);
    expect(model.appearances.get("obj-engine::opd-sd1")!.internal).toBe(false);
  });

  it("unfold of Car does NOT pull in Garage (Car is part OF Garage, not the reverse)", () => {
    const m = buildCarModel();
    const model = unwrap(refineThing(m, "obj-car", "opd-sd", "unfold", "opd-sd1", "SD1"));
    // Garage is the Whole that contains Car — NOT a part of Car
    expect(model.appearances.has("obj-garage::opd-sd1")).toBe(false);
  });

  it("unfold of Car does NOT pull in Driving (effect link, not structural)", () => {
    const m = buildCarModel();
    const model = unwrap(refineThing(m, "obj-car", "opd-sd", "unfold", "opd-sd1", "SD1"));
    expect(model.appearances.has("proc-drive::opd-sd1")).toBe(false);
  });

  it("Car itself appears as internal container", () => {
    const m = buildCarModel();
    const model = unwrap(refineThing(m, "obj-car", "opd-sd", "unfold", "opd-sd1", "SD1"));
    const app = model.appearances.get("obj-car::opd-sd1");
    expect(app).toBeDefined();
    expect(app!.internal).toBe(true);
  });
});

// ── P-02: removeState cascade to links ────────────────────────────────

describe("P-02: removeState cascades to link state references", () => {
  function buildStateModel() {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "proc-heat", kind: "process", name: "Heating", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }));
    m = unwrap(addState(m, { id: "state-hot", parent: "obj-water", name: "hot", initial: false, final: true, default: false }));
    m = unwrap(addLink(m, {
      id: "lnk-eff", type: "effect", source: "proc-heat", target: "obj-water",
      source_state: undefined, target_state: "state-hot",
    }));
    m = unwrap(addLink(m, {
      id: "lnk-inp", type: "instrument", source: "obj-water", target: "proc-heat",
      source_state: "state-cold", target_state: undefined,
    }));
    return m;
  }

  it("clears target_state when referenced state is removed", () => {
    const m = buildStateModel();
    const model = unwrap(removeState(m, "state-hot"));
    const link = model.links.get("lnk-eff")!;
    expect(link.target_state).toBeUndefined();
  });

  it("clears source_state when referenced state is removed", () => {
    const m = buildStateModel();
    const model = unwrap(removeState(m, "state-cold"));
    const link = model.links.get("lnk-inp")!;
    expect(link.source_state).toBeUndefined();
  });

  it("does not touch links that don't reference the removed state", () => {
    const m = buildStateModel();
    const model = unwrap(removeState(m, "state-hot"));
    const link = model.links.get("lnk-inp")!;
    expect(link.source_state).toBe("state-cold");
  });
});

// ── I-21: Exclusive current state (radio button coercion) ─────────────

describe("I-21: exclusive current state coercion", () => {
  it("addState with current=true unsets sibling current states", () => {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "obj-a", kind: "object", name: "A", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addState(m, { id: "s1", parent: "obj-a", name: "s1", initial: true, final: false, default: true, current: true }));
    expect(m.states.get("s1")!.current).toBe(true);
    m = unwrap(addState(m, { id: "s2", parent: "obj-a", name: "s2", initial: false, final: false, default: false, current: true }));
    // s2 is now current, s1 should be unset
    expect(m.states.get("s2")!.current).toBe(true);
    expect(m.states.get("s1")!.current).toBe(false);
  });

  it("updateState with current=true unsets sibling current states", () => {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "obj-a", kind: "object", name: "A", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addState(m, { id: "s1", parent: "obj-a", name: "s1", initial: true, final: false, default: true, current: true }));
    m = unwrap(addState(m, { id: "s2", parent: "obj-a", name: "s2", initial: false, final: false, default: false }));
    m = unwrap(updateState(m, "s2", { current: true }));
    expect(m.states.get("s2")!.current).toBe(true);
    expect(m.states.get("s1")!.current).toBe(false);
  });

  it("does not affect states of different objects", () => {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "obj-a", kind: "object", name: "A", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-b", kind: "object", name: "B", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addState(m, { id: "s1", parent: "obj-a", name: "s1", initial: true, final: false, default: true, current: true }));
    m = unwrap(addState(m, { id: "s2", parent: "obj-b", name: "s2", initial: true, final: false, default: true, current: true }));
    // Both should remain current — different parent objects
    expect(m.states.get("s1")!.current).toBe(true);
    expect(m.states.get("s2")!.current).toBe(true);
  });

  it("validate detects multiple current states on same object", () => {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "obj-a", kind: "object", name: "A", essence: "physical", affiliation: "systemic" }));
    // Bypass coercion by directly inserting into map
    const states = new Map(m.states);
    states.set("s1", { id: "s1", parent: "obj-a", name: "s1", initial: true, final: false, default: true, current: true });
    states.set("s2", { id: "s2", parent: "obj-a", name: "s2", initial: false, final: false, default: false, current: true });
    m = { ...m, states };
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-21")).toBe(true);
  });
});

// ── I-16: Unique transforming link per (process, object) pair ──────────

describe("I-16: validate detects duplicate transforming links", () => {
  it("flags two transforming links between same process and object", () => {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "proc-p", kind: "process", name: "P", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-o", kind: "object", name: "O", essence: "physical", affiliation: "systemic" }));
    // Bypass eager I-16 guard to test validate() detection
    const links = new Map(m.links);
    links.set("lnk-1", { id: "lnk-1", type: "effect", source: "proc-p", target: "obj-o" });
    links.set("lnk-2", { id: "lnk-2", type: "consumption", source: "obj-o", target: "proc-p" });
    m = { ...m, links };
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-16")).toBe(true);
  });

  it("allows transforming links between different (process, object) pairs", () => {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "proc-p", kind: "process", name: "P", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-a", kind: "object", name: "A", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-b", kind: "object", name: "B", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addLink(m, { id: "lnk-1", type: "effect", source: "proc-p", target: "obj-a" }));
    m = unwrap(addLink(m, { id: "lnk-2", type: "consumption", source: "obj-b", target: "proc-p" }));
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-16")).toBe(false);
  });

  it("allows agent + effect on same (process, object) pair (enabling ≠ transforming)", () => {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "proc-p", kind: "process", name: "P", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-o", kind: "object", name: "O", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addLink(m, { id: "lnk-1", type: "effect", source: "proc-p", target: "obj-o" }));
    m = unwrap(addLink(m, { id: "lnk-2", type: "agent", source: "obj-o", target: "proc-p" }));
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-16")).toBe(false);
  });
});

// ── I-31: ≤1 discriminating exhibition per exhibitor ──────────────────

describe("I-31: unique discriminating attribute per exhibitor", () => {
  function buildExhibitionModel() {
    let m = createModel("test");
    m = unwrap(addThing(m, { id: "obj-animal", kind: "object", name: "Animal", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-size", kind: "object", name: "Size", essence: "informatical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-color", kind: "object", name: "Color", essence: "informatical", affiliation: "systemic" }));
    return m;
  }

  it("allows first discriminating exhibition link", () => {
    const m = buildExhibitionModel();
    const r = addLink(m, { id: "lnk-exh1", type: "exhibition", source: "obj-size", target: "obj-animal", discriminating: true });
    expect(isOk(r)).toBe(true);
  });

  it("rejects second discriminating exhibition to same exhibitor", () => {
    let m = buildExhibitionModel();
    m = unwrap(addLink(m, { id: "lnk-exh1", type: "exhibition", source: "obj-size", target: "obj-animal", discriminating: true }));
    const r = addLink(m, { id: "lnk-exh2", type: "exhibition", source: "obj-color", target: "obj-animal", discriminating: true });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-31");
  });

  it("allows non-discriminating exhibition to same exhibitor", () => {
    let m = buildExhibitionModel();
    m = unwrap(addLink(m, { id: "lnk-exh1", type: "exhibition", source: "obj-size", target: "obj-animal", discriminating: true }));
    const r = addLink(m, { id: "lnk-exh2", type: "exhibition", source: "obj-color", target: "obj-animal" });
    expect(isOk(r)).toBe(true);
  });

  it("rejects via updateLink when setting discriminating=true", () => {
    let m = buildExhibitionModel();
    m = unwrap(addLink(m, { id: "lnk-exh1", type: "exhibition", source: "obj-size", target: "obj-animal", discriminating: true }));
    m = unwrap(addLink(m, { id: "lnk-exh2", type: "exhibition", source: "obj-color", target: "obj-animal" }));
    const r = updateLink(m, "lnk-exh2", { discriminating: true });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-31");
  });

  it("validate detects multiple discriminating on same exhibitor", () => {
    let m = buildExhibitionModel();
    // Bypass guard by inserting directly
    const links = new Map(m.links);
    links.set("lnk-exh1", { id: "lnk-exh1", type: "exhibition" as const, source: "obj-size", target: "obj-animal", discriminating: true });
    links.set("lnk-exh2", { id: "lnk-exh2", type: "exhibition" as const, source: "obj-color", target: "obj-animal", discriminating: true });
    m = { ...m, links };
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-31")).toBe(true);
  });
});

// ── I-32: Discriminating values disjoint and exhaustive ───────────────

describe("I-32: discriminating values coverage", () => {
  function buildDiscriminationModel() {
    let m = createModel("test");
    // General: Animal. Specializations: Dog, Cat
    m = unwrap(addThing(m, { id: "obj-animal", kind: "object", name: "Animal", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-dog", kind: "object", name: "Dog", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-cat", kind: "object", name: "Cat", essence: "physical", affiliation: "systemic" }));
    // Discriminating attribute: Size (informatical)
    m = unwrap(addThing(m, { id: "obj-size", kind: "object", name: "Size", essence: "informatical", affiliation: "systemic" }));
    // States of Size: small, large
    m = unwrap(addState(m, { id: "state-small", parent: "obj-size", name: "small", initial: true, final: false, default: true }));
    m = unwrap(addState(m, { id: "state-large", parent: "obj-size", name: "large", initial: false, final: false, default: false }));
    // Exhibition: Size → Animal (discriminating)
    m = unwrap(addLink(m, { id: "lnk-exh", type: "exhibition", source: "obj-size", target: "obj-animal", discriminating: true }));
    // Generalization: Dog → Animal, Cat → Animal
    m = unwrap(addLink(m, { id: "lnk-gen-dog", type: "generalization", source: "obj-dog", target: "obj-animal" }));
    m = unwrap(addLink(m, { id: "lnk-gen-cat", type: "generalization", source: "obj-cat", target: "obj-animal" }));
    return m;
  }

  it("passes when values are disjoint and exhaustive", () => {
    let m = buildDiscriminationModel();
    m = unwrap(updateLink(m, "lnk-gen-dog", { discriminating_values: ["state-small"] }));
    m = unwrap(updateLink(m, "lnk-gen-cat", { discriminating_values: ["state-large"] }));
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-32")).toBe(false);
  });

  it("detects overlapping discriminating values (non-disjoint)", () => {
    let m = buildDiscriminationModel();
    m = unwrap(updateLink(m, "lnk-gen-dog", { discriminating_values: ["state-small", "state-large"] }));
    m = unwrap(updateLink(m, "lnk-gen-cat", { discriminating_values: ["state-large"] }));
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-32")).toBe(true);
  });

  it("detects incomplete coverage (non-exhaustive)", () => {
    let m = buildDiscriminationModel();
    m = unwrap(updateLink(m, "lnk-gen-dog", { discriminating_values: ["state-small"] }));
    // Cat has no discriminating_values — state-large is uncovered
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-32")).toBe(true);
  });
});
