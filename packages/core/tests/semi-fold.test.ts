// packages/core/tests/semi-fold.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, addAppearance, getSemiFoldedParts, updateAppearance } from "../src/api";
import { resolveLinksForOpd } from "../src/simulation";
import { isOk, type Result } from "../src/result";
import type { Thing } from "../src/types";

function ok<T>(r: Result<T, unknown>): T {
  if (!isOk(r)) throw new Error(`Expected ok: ${JSON.stringify(r.error)}`);
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
  // exhibition: source=exhibitor, target=feature
  m = ok(addLink(m, { id: "lnk-color-car", type: "exhibition", source: "obj-car", target: "obj-color" }));
  m = ok(addLink(m, { id: "lnk-weight-car", type: "exhibition", source: "obj-car", target: "obj-weight" }));
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

// === R-SF-6/9: Links to semi-folded parts ===

describe("R-SF-6/9: links resolve to semi-folded parts", () => {
  function buildSemiFoldLinkModel() {
    let m = buildModel();
    // Add a process that has an effect link to a semi-fold part (Engine)
    m = ok(addThing(m, { id: "proc-repair", kind: "process", name: "Repairing", essence: "physical", affiliation: "systemic" }));
    // Appearances in SD
    m = ok(addAppearance(m, { thing: "obj-car", opd: "opd-sd", x: 100, y: 100, w: 150, h: 80, semi_folded: true }));
    m = ok(addAppearance(m, { thing: "proc-repair", opd: "opd-sd", x: 400, y: 100, w: 120, h: 60 }));
    // Effect link: Repairing affects Engine (which is semi-folded inside Car)
    m = ok(addLink(m, { id: "lnk-repair-engine", type: "effect", source: "obj-engine", target: "proc-repair" }));
    return m;
  }

  it("link to semi-folded part resolves in parent OPD", () => {
    const m = buildSemiFoldLinkModel();
    const resolved = resolveLinksForOpd(m, "opd-sd");
    const repair = resolved.find(r => r.link.id === "lnk-repair-engine");
    expect(repair).toBeDefined();
    expect(repair!.visualSource).toBe("obj-engine");
    expect(repair!.visualTarget).toBe("proc-repair");
  });

  it("link to non-semi-folded part without appearance does not resolve", () => {
    let m = buildModel();
    m = ok(addThing(m, { id: "proc-x", kind: "process", name: "X", essence: "informatical", affiliation: "systemic" }));
    // Car NOT semi-folded
    m = ok(addAppearance(m, { thing: "obj-car", opd: "opd-sd", x: 100, y: 100, w: 150, h: 80 }));
    m = ok(addAppearance(m, { thing: "proc-x", opd: "opd-sd", x: 400, y: 100, w: 120, h: 60 }));
    m = ok(addLink(m, { id: "lnk-x-engine", type: "effect", source: "obj-engine", target: "proc-x" }));
    const resolved = resolveLinksForOpd(m, "opd-sd");
    const link = resolved.find(r => r.link.id === "lnk-x-engine");
    // Engine has no appearance and Car is not semi-folded → link should not resolve
    expect(link).toBeUndefined();
  });
});
