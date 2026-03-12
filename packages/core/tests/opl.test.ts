// packages/core/tests/opl.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, addState, addLink, addAppearance, addModifier,
  updateSettings,
} from "../src/api";
import { isOk } from "../src/result";
import { expose, render } from "../src/opl";
import type { Thing, State, Appearance } from "../src/types";

// === Test fixtures ===

const waterObj: Thing = {
  id: "obj-water", kind: "object", name: "Water",
  essence: "physical", affiliation: "systemic",
};

const boilingProc: Thing = {
  id: "proc-boiling", kind: "process", name: "Boiling",
  essence: "physical", affiliation: "systemic",
  duration: { nominal: 5, unit: "min" },
};

const cupObj: Thing = {
  id: "obj-cup", kind: "object", name: "Cup",
  essence: "physical", affiliation: "environmental",
};

const waterApp: Appearance = {
  thing: "obj-water", opd: "opd-sd", x: 100, y: 100, w: 120, h: 60,
};

const boilingApp: Appearance = {
  thing: "proc-boiling", opd: "opd-sd", x: 300, y: 100, w: 120, h: 60,
};

const cupApp: Appearance = {
  thing: "obj-cup", opd: "opd-sd", x: 100, y: 300, w: 120, h: 60,
};

function buildModel() {
  let m = createModel("Test");
  let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
  r = addThing(m, boilingProc); if (!isOk(r)) throw r.error; m = r.value;
  r = addThing(m, cupObj); if (!isOk(r)) throw r.error; m = r.value;
  r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
  r = addAppearance(m, boilingApp); if (!isOk(r)) throw r.error; m = r.value;
  r = addAppearance(m, cupApp); if (!isOk(r)) throw r.error; m = r.value;
  r = addState(m, { id: "state-liquid", parent: "obj-water", name: "liquid", initial: true, final: false, default: true });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addState(m, { id: "state-gas", parent: "obj-water", name: "gas", initial: false, final: false, default: false });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addLink(m, { id: "lnk-boiling-consumption-water", type: "consumption", source: "proc-boiling", target: "obj-water" });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addLink(m, { id: "lnk-boiling-effect-water", type: "effect", source: "proc-boiling", target: "obj-water", source_state: "state-liquid", target_state: "state-gas" });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addLink(m, { id: "lnk-cup-aggregation-water", type: "aggregation", source: "obj-cup", target: "obj-water" });
  if (!isOk(r)) throw r.error; m = r.value;
  return m;
}

// === expose tests ===

describe("expose", () => {
  it("produces thing declarations for visible things", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const declarations = doc.sentences.filter(s => s.kind === "thing-declaration");
    expect(declarations).toHaveLength(3);
    // Objects first, then processes
    expect(declarations[0]!.name).toBe("Cup");
    expect(declarations[1]!.name).toBe("Water");
    expect(declarations[2]!.name).toBe("Boiling");
  });

  it("produces state enumerations", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const stateEnums = doc.sentences.filter(s => s.kind === "state-enumeration");
    expect(stateEnums).toHaveLength(1);
    const waterStates = stateEnums[0] as any;
    expect(waterStates.thingName).toBe("Water");
    expect(waterStates.stateNames).toEqual(["gas", "liquid"]);
  });

  it("produces duration sentences for things with duration", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const durations = doc.sentences.filter(s => s.kind === "duration");
    expect(durations).toHaveLength(1);
    const d = durations[0] as any;
    expect(d.thingName).toBe("Boiling");
    expect(d.nominal).toBe(5);
    expect(d.unit).toBe("min");
  });

  it("produces link sentences for links with both endpoints visible", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const links = doc.sentences.filter(s => s.kind === "link");
    expect(links).toHaveLength(3);
  });

  it("produces modifier sentences", () => {
    let m = buildModel();
    let r = addModifier(m, { id: "mod-event", over: "lnk-boiling-consumption-water", type: "event" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const modifiers = doc.sentences.filter(s => s.kind === "modifier");
    expect(modifiers).toHaveLength(1);
    const mod = modifiers[0] as any;
    expect(mod.modifierType).toBe("event");
    expect(mod.negated).toBe(false);
  });

  it("omits things without appearance in the OPD", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    expect(doc.sentences).toHaveLength(0);
  });

  it("omits links when one endpoint is outside the OPD", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, boilingProc); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-1", type: "consumption", source: "proc-boiling", target: "obj-water" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const links = doc.sentences.filter(s => s.kind === "link");
    expect(links).toHaveLength(0);
  });
});

// === expose settings tests ===

describe("expose settings", () => {
  it("respects opl_essence_visibility: none", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_essence_visibility: "none" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    expect(doc.renderSettings.essenceVisibility).toBe("none");
  });

  it("respects opl_essence_visibility: non_default with primary_essence", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_essence_visibility: "non_default", primary_essence: "physical" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    expect(doc.renderSettings.essenceVisibility).toBe("non_default");
    expect(doc.renderSettings.primaryEssence).toBe("physical");
  });

  it("respects opl_units_visibility setting", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_units_visibility: "hide" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    expect(doc.renderSettings.unitsVisibility).toBe("hide");
  });
});

// === render tests ===

describe("render", () => {
  it("renders thing declarations with a/an grammar", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water is an object, physical, systemic.");
    expect(text).toContain("Boiling is a process, physical, systemic.");
  });

  it("renders state enumerations", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water can be gas or liquid.");
  });

  it("renders link sentences", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling consumes Water.");
    expect(text).toContain("Cup consists of Water.");
  });

  it("renders effect link with states", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling affects Water, from liquid to gas.");
  });

  it("renders duration", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling requires 5min.");
  });

  it("renders empty document as empty string", () => {
    const m = createModel("Test");
    const doc = expose(m, "opd-sd");
    expect(render(doc)).toBe("");
  });

  it("omits essence when essenceVisibility is none", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_essence_visibility: "none" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water is an object, systemic.");
    expect(text).not.toContain("physical");
  });

  it("omits unit when unitsVisibility is hide", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_units_visibility: "hide" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling requires 5.");
    expect(text).not.toContain("5min");
  });

  it("omits essence only for default when non_default", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_essence_visibility: "non_default", primary_essence: "physical" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water is an object, systemic.");
    expect(text).toContain("Cup is an object, environmental.");
  });
});
