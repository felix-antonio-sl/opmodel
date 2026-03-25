// packages/core/tests/integration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createModel } from "../src/model";
import { loadModel, saveModel } from "../src/serialization";
import {
  addThing, addState, addLink, addOPD,
  addAppearance, addModifier, addAssertion, validate,
} from "../src/api";
import { isOk, type Result } from "../src/result";
import type { Model } from "../src/types";

// Test utility: unwrap Result or throw with context
function unwrap<T>(r: Result<T, any>, context = ""): T {
  if (!isOk(r)) throw new Error(`Expected ok${context ? ` (${context})` : ""}: ${JSON.stringify(r.error)}`);
  return r.value;
}

describe("Coffee Making System (end-to-end)", () => {
  it("builds the full model via API and validates", () => {
    let m = createModel("Coffee Making System", "artificial");

    // Things
    m = unwrap(addThing(m, { id: "obj-barista", kind: "object", name: "Barista", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-coffee", kind: "object", name: "Coffee", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-coffee-beans", kind: "object", name: "Coffee Beans", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "proc-coffee-making", kind: "process", name: "Coffee Making", essence: "physical", affiliation: "systemic", duration: { nominal: 120, unit: "s" } }));

    // States
    m = unwrap(addState(m, { id: "state-coffee-unmade", parent: "obj-coffee", name: "unmade", initial: true, final: false, default: true, current: true }));
    m = unwrap(addState(m, { id: "state-coffee-ready", parent: "obj-coffee", name: "ready", initial: false, final: true, default: false }));
    m = unwrap(addState(m, { id: "state-water-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true, current: true }));
    m = unwrap(addState(m, { id: "state-water-hot", parent: "obj-water", name: "hot", initial: false, final: true, default: false }));

    // OPDs (SD already created by createModel)
    m = unwrap(addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-coffee-making", refinement_type: "in-zoom" }));

    // Links
    m = unwrap(addLink(m, { id: "lnk-barista-agent-coffee-making", type: "agent", source: "obj-barista", target: "proc-coffee-making" }));
    m = unwrap(addLink(m, { id: "lnk-coffee-making-consumption-beans", type: "consumption", source: "obj-coffee-beans", target: "proc-coffee-making" }));
    m = unwrap(addLink(m, { id: "lnk-coffee-making-effect-water", type: "effect", source: "proc-coffee-making", target: "obj-water", source_state: "state-water-cold", target_state: "state-water-hot" }));
    m = unwrap(addLink(m, { id: "lnk-coffee-making-result-coffee", type: "result", source: "proc-coffee-making", target: "obj-coffee" }));

    // Modifier
    m = unwrap(addModifier(m, { id: "mod-water-event", over: "lnk-coffee-making-effect-water", type: "event" }));

    // Appearances
    m = unwrap(addAppearance(m, { thing: "obj-barista", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50 }));
    m = unwrap(addAppearance(m, { thing: "obj-coffee", opd: "opd-sd", x: 500, y: 200, w: 120, h: 50 }));
    m = unwrap(addAppearance(m, { thing: "obj-coffee-beans", opd: "opd-sd", x: 50, y: 200, w: 140, h: 50 }));
    m = unwrap(addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 350, w: 120, h: 50 }));
    m = unwrap(addAppearance(m, { thing: "proc-coffee-making", opd: "opd-sd", x: 280, y: 180, w: 180, h: 80 }));
    m = unwrap(addAppearance(m, { thing: "obj-water", opd: "opd-sd1", x: 50, y: 100, w: 120, h: 50, internal: false }));

    // Assertion
    m = unwrap(addAssertion(m, { id: "ast-coffee-ready", target: "proc-coffee-making", predicate: "after Coffee Making, Coffee is ready", category: "correctness", enabled: true }));

    // Validate — I-CONTOUR-RESTRICT expected: consumption + result target in-zoomed process
    const errors = validate(m);
    const contourErrors = errors.filter(e => e.code === "I-CONTOUR-RESTRICT");
    const otherErrors = errors.filter(e => e.code !== "I-CONTOUR-RESTRICT" && (!e.severity || e.severity === "error"));
    expect(otherErrors).toEqual([]);
    expect(contourErrors.length).toBe(2); // consumption + result
    expect(m.things.size).toBe(5);
    expect(m.states.size).toBe(4);
    expect(m.links.size).toBe(4);
    expect(m.appearances.size).toBe(6);
  });

  it("loads fixture file and validates it", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const result = loadModel(json);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const errors = validate(result.value);
    expect(errors.filter(e => !e.severity || e.severity === "error")).toEqual([]);
  });
});
