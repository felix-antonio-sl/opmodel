// packages/core/tests/semi-fold.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, addAppearance, getSemiFoldedParts } from "../src/api";
import { isOk } from "../src/result";
import type { Thing } from "../src/types";

function ok<T>(r: { ok: boolean; value?: T; error?: unknown }): T {
  if (!isOk(r)) throw new Error(`Expected ok: ${JSON.stringify((r as any).error)}`);
  return r.value;
}

const car: Thing = { id: "obj-car", kind: "object", name: "Car", essence: "physical", affiliation: "systemic" };
const engine: Thing = { id: "obj-engine", kind: "object", name: "Engine", essence: "physical", affiliation: "systemic" };
const wheel: Thing = { id: "obj-wheel", kind: "object", name: "Wheel", essence: "physical", affiliation: "systemic" };
const door: Thing = { id: "obj-door", kind: "object", name: "Door", essence: "physical", affiliation: "systemic" };
const color: Thing = { id: "obj-color", kind: "object", name: "Color", essence: "informatical", affiliation: "systemic" };
const weight: Thing = { id: "obj-weight", kind: "object", name: "Weight", essence: "informatical", affiliation: "systemic" };
const speed: Thing = { id: "obj-speed", kind: "object", name: "Speed", essence: "informatical", affiliation: "systemic" };

function buildModel() {
  let m = createModel("SemiFoldTest");
  m = ok(addThing(m, car));
  m = ok(addThing(m, engine));
  m = ok(addThing(m, wheel));
  m = ok(addThing(m, door));
  m = ok(addThing(m, color));
  m = ok(addThing(m, weight));
  // aggregation: source=whole, target=part — wait, let me check convention
  // From pullback code: "aggregation: Part→Whole (source=Part, target=Whole)"
  // So aggregation link: source=part, target=whole
  m = ok(addLink(m, { id: "lnk-engine-car", type: "aggregation", source: "obj-car", target: "obj-engine" }));
  m = ok(addLink(m, { id: "lnk-wheel-car", type: "aggregation", source: "obj-car", target: "obj-wheel" }));
  m = ok(addLink(m, { id: "lnk-door-car", type: "aggregation", source: "obj-car", target: "obj-door" }));
  // exhibition: source=feature, target=exhibitor
  m = ok(addLink(m, { id: "lnk-color-car", type: "exhibition", source: "obj-color", target: "obj-car" }));
  m = ok(addLink(m, { id: "lnk-weight-car", type: "exhibition", source: "obj-weight", target: "obj-car" }));
  return m;
}

describe("getSemiFoldedParts", () => {
  it("returns aggregation parts", () => {
    const m = buildModel();
    const result = getSemiFoldedParts(m, "obj-car");
    const partNames = result.visible.filter(e => e.linkType === "aggregation").map(e => e.name);
    expect(partNames).toContain("Engine");
    expect(partNames).toContain("Wheel");
    expect(partNames).toContain("Door");
  });

  it("returns exhibition features", () => {
    const m = buildModel();
    const result = getSemiFoldedParts(m, "obj-car");
    const featureNames = result.visible.filter(e => e.linkType === "exhibition").map(e => e.name);
    expect(featureNames).toContain("Color");
    expect(featureNames).toContain("Weight");
  });

  it("returns all 5 items with hiddenCount=0 when maxVisible >= total", () => {
    const m = buildModel();
    const result = getSemiFoldedParts(m, "obj-car", 10);
    expect(result.visible).toHaveLength(5);
    expect(result.hiddenCount).toBe(0);
  });

  it("truncates with hiddenCount when maxVisible < total", () => {
    const m = buildModel();
    const result = getSemiFoldedParts(m, "obj-car", 3);
    expect(result.visible).toHaveLength(3);
    expect(result.hiddenCount).toBe(2);
  });

  it("returns empty for thing with no structural children", () => {
    const m = buildModel();
    const result = getSemiFoldedParts(m, "obj-engine");
    expect(result.visible).toHaveLength(0);
    expect(result.hiddenCount).toBe(0);
  });

  it("returns empty for process", () => {
    let m = createModel("ProcTest");
    const proc: Thing = { id: "proc-x", kind: "process", name: "Doing", essence: "physical", affiliation: "systemic" };
    m = ok(addThing(m, proc));
    const result = getSemiFoldedParts(m, "proc-x");
    expect(result.visible).toHaveLength(0);
    expect(result.hiddenCount).toBe(0);
  });
});
