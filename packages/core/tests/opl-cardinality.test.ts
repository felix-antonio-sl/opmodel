// packages/core/tests/opl-cardinality.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, addAppearance } from "../src/api";
import { isOk, type Result } from "../src/result";
import { expose, render } from "../src/opl";
import type { Thing } from "../src/types";

function ok<T>(r: Result<T, unknown>): T {
  if (!isOk(r)) throw new Error(`Expected ok: ${JSON.stringify(r.error)}`);
  return r.value;
}

const car: Thing = { id: "obj-car", kind: "object", name: "Car", essence: "physical", affiliation: "systemic" };
const wheel: Thing = { id: "obj-wheel", kind: "object", name: "Wheel", essence: "physical", affiliation: "systemic" };
const sunroof: Thing = { id: "obj-sunroof", kind: "object", name: "Sunroof", essence: "physical", affiliation: "systemic" };
const tire: Thing = { id: "obj-tire", kind: "object", name: "Spare Tire", essence: "physical", affiliation: "systemic" };
const driving: Thing = { id: "proc-driving", kind: "process", name: "Driving", essence: "physical", affiliation: "systemic" };
const fuel: Thing = { id: "obj-fuel", kind: "object", name: "Fuel", essence: "physical", affiliation: "systemic" };

function buildModel() {
  let m = createModel("CardinalityTest");
  m = ok(addThing(m, car));
  m = ok(addThing(m, wheel));
  m = ok(addThing(m, sunroof));
  m = ok(addThing(m, tire));
  m = ok(addThing(m, driving));
  m = ok(addThing(m, fuel));
  m = ok(addAppearance(m, { thing: "obj-car", opd: "opd-sd", x: 200, y: 200, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-wheel", opd: "opd-sd", x: 400, y: 100, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-sunroof", opd: "opd-sd", x: 400, y: 200, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-tire", opd: "opd-sd", x: 400, y: 300, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "proc-driving", opd: "opd-sd", x: 200, y: 400, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-fuel", opd: "opd-sd", x: 400, y: 400, w: 120, h: 60 }));
  return m;
}

describe("OPL Cardinality Rendering", () => {
  it("renders '+' as 'at least one' in aggregation", () => {
    let m = buildModel();
    m = ok(addLink(m, { id: "lnk-car-tire", type: "aggregation", source: "obj-car", target: "obj-tire", multiplicity_target: "+" }));
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Car consists of at least one Spare Tire.");
  });

  it("renders '?' as 'an optional' in aggregation", () => {
    let m = buildModel();
    m = ok(addLink(m, { id: "lnk-car-sunroof", type: "aggregation", source: "obj-car", target: "obj-sunroof", multiplicity_target: "?" }));
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Car consists of an optional Sunroof.");
  });

  it("renders '*' as 'zero or more' in aggregation", () => {
    let m = buildModel();
    m = ok(addLink(m, { id: "lnk-car-wheel", type: "aggregation", source: "obj-car", target: "obj-wheel", multiplicity_target: "*" }));
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Car consists of zero or more Wheel.");
  });

  it("renders 'm..n' range in aggregation", () => {
    let m = buildModel();
    m = ok(addLink(m, { id: "lnk-car-wheel", type: "aggregation", source: "obj-car", target: "obj-wheel", multiplicity_target: "4..5" }));
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Car consists of 4 to 5 Wheel.");
  });

  it("renders no multiplicity phrase for default (1)", () => {
    let m = buildModel();
    m = ok(addLink(m, { id: "lnk-car-wheel", type: "aggregation", source: "obj-car", target: "obj-wheel" }));
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Car consists of Wheel.");
    expect(text).not.toContain("at least one");
    expect(text).not.toContain("optional");
  });

  it("renders multiplicity in consumption link", () => {
    let m = buildModel();
    m = ok(addLink(m, { id: "lnk-fuel-driving", type: "consumption", source: "obj-fuel", target: "proc-driving", multiplicity_source: "+" }));
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Driving consumes at least one Fuel.");
  });

  it("renders multiplicity in grouped structural (multiple children)", () => {
    let m = buildModel();
    m = ok(addLink(m, { id: "lnk-car-wheel", type: "aggregation", source: "obj-car", target: "obj-wheel", multiplicity_target: "+" }));
    m = ok(addLink(m, { id: "lnk-car-sunroof", type: "aggregation", source: "obj-car", target: "obj-sunroof", multiplicity_target: "?" }));
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    // Grouped: "Car consists of at least one Wheel and an optional Sunroof."
    expect(text).toContain("at least one Wheel");
    expect(text).toContain("an optional Sunroof");
  });
});
