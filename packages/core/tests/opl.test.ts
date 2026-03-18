// packages/core/tests/opl.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, addState, addLink, addAppearance, addModifier,
  updateSettings,
} from "../src/api";
import { isOk, isErr } from "../src/result";
import { expose, render, applyOplEdit, oplSlug, editsFrom } from "../src/opl";
import type { OplEdit, OplDocument } from "../src/opl-types";
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

  it("produces link sentences for non-structural links with both endpoints visible", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const links = doc.sentences.filter(s => s.kind === "link");
    // Aggregation is now grouped-structural, only effect remains as individual link
    expect(links).toHaveLength(1);
    // Grouped structural should have the aggregation
    const grouped = doc.sentences.filter(s => s.kind === "grouped-structural");
    expect(grouped).toHaveLength(1);
  });

  it("produces modifier sentences", () => {
    let m = buildModel();
    let r = addModifier(m, { id: "mod-event", over: "lnk-boiling-effect-water", type: "event" });
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
    r = addLink(m, { id: "lnk-1", type: "consumption", source: "obj-water", target: "proc-boiling" });
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
    expect(text).toContain("Water is an object, physical.");
    expect(text).toContain("Boiling is a process, physical.");
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
    expect(text).toContain("Cup consists of Water.");
  });

  it("renders effect link with states", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling changes Water from liquid to gas.");
  });

  it("renders non-state-specified instrument as 'Process requires Instrument'", () => {
    let m = buildModel();
    let r = addLink(m, { id: "lnk-cup-instrument-boiling", type: "instrument", source: "obj-cup", target: "proc-boiling" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling requires Cup.");
    expect(text).not.toContain("is an instrument of");
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
    expect(text).toContain("Water is an object.");
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
    expect(text).toContain("Water is an object.");
    expect(text).toContain("Cup is an object, environmental.");
  });

  it("omits systemic affiliation from rendering (ISO default)", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water is an object, physical.");
    expect(text).not.toContain("systemic");
  });

  it("renders environmental affiliation (non-default)", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Cup is an object, physical, environmental.");
  });

  it("omits both defaults when informatical+systemic with non_default essence", () => {
    let m = buildModel();
    // Add an informatical+systemic object (both ISO defaults)
    let r = addThing(m, { id: "obj-data", kind: "object", name: "Data", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "obj-data", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
    if (!isOk(r)) throw r.error; m = r.value;
    let r2 = updateSettings(m, { opl_essence_visibility: "non_default" });
    if (!isOk(r2)) throw r2.error; m = r2.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Data is an object.");
  });

  it("renders both non-default essence and affiliation", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    // Cup is physical + environmental (both non-default)
    expect(text).toContain("Cup is an object, physical, environmental.");
  });

  // DT-07: Classification OPL sentence
  it("renders classification as 'B is an instance of A'", () => {
    let m = buildModel();
    let r = addThing(m, { id: "obj-beverage", kind: "object", name: "Beverage", essence: "physical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "obj-beverage", opd: "opd-sd", x: 200, y: 300, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-classify", type: "classification", source: "obj-beverage", target: "obj-water" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water is an instance of Beverage.");
  });

  // DT-08: Generalization OPL — objects with article
  it("renders generalization between objects with article", () => {
    let m = buildModel();
    let r = addThing(m, { id: "obj-beverage", kind: "object", name: "Beverage", essence: "physical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "obj-beverage", opd: "opd-sd", x: 200, y: 300, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-gen", type: "generalization", source: "obj-beverage", target: "obj-water" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water is a Beverage.");
  });

  // DT-08: Generalization OPL — objects with 'an' before vowel
  it("renders generalization between objects with 'an' before vowel", () => {
    let m = buildModel();
    let r = addThing(m, { id: "obj-entity", kind: "object", name: "Entity", essence: "physical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "obj-entity", opd: "opd-sd", x: 200, y: 300, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-gen-vowel", type: "generalization", source: "obj-entity", target: "obj-water" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water is an Entity.");
  });

  // DT-08: Generalization OPL — processes without article
  it("renders generalization between processes without article", () => {
    let m = buildModel();
    let r = addThing(m, { id: "proc-processing", kind: "process", name: "Processing", essence: "physical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "proc-processing", opd: "opd-sd", x: 200, y: 300, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-gen-proc", type: "generalization", source: "proc-processing", target: "proc-boiling" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling is Processing.");
    expect(text).not.toContain("Boiling is a Processing.");
  });

  // DT-08: Incomplete generalization — now grouped (GAP-OPL-04)
  it("renders incomplete generalization with grouped format", () => {
    let m = buildModel();
    let r = addThing(m, { id: "obj-beverage", kind: "object", name: "Beverage", essence: "physical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "obj-beverage", opd: "opd-sd", x: 200, y: 300, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-gen-inc", type: "generalization", source: "obj-water", target: "obj-beverage", incomplete: true });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    // GAP-OPL-04: grouped structural — parent=Water (general), child=Beverage (specialization), incomplete
    expect(text).toContain("Beverage and at least one other specialization are a Water.");
  });
});

// === oplSlug tests ===

describe("oplSlug", () => {
  it("converts names to kebab-case", () => {
    expect(oplSlug("Hot Water")).toBe("hot-water");
    expect(oplSlug("Café Latte")).toBe("caf-latte");
    expect(oplSlug("  spaces  ")).toBe("spaces");
  });
});

// === applyOplEdit tests ===

describe("applyOplEdit", () => {
  it("add-thing creates thing + appearance", () => {
    const m = createModel("Test");
    const edit: OplEdit = {
      kind: "add-thing",
      opdId: "opd-sd",
      thing: { kind: "object", name: "Milk", essence: "physical", affiliation: "systemic" },
      position: { x: 50, y: 50 },
    };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.things.size).toBe(1);
    const thing = [...r.value.things.values()][0]!;
    expect(thing.name).toBe("Milk");
    expect(thing.kind).toBe("object");
    expect(thing.id).toMatch(/^obj-/);
    // Appearance created
    expect(r.value.appearances.size).toBe(1);
    const app = [...r.value.appearances.values()][0]!;
    expect(app.opd).toBe("opd-sd");
    expect(app.w).toBe(120);
    expect(app.h).toBe(60);
  });

  it("add-states creates states with auto-generated IDs", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    const edit: OplEdit = {
      kind: "add-states",
      thingId: "obj-water",
      states: [
        { name: "cold", initial: true, final: false, default: true },
        { name: "hot", initial: false, final: false, default: false },
      ],
    };
    const r2 = applyOplEdit(m, edit);
    expect(isOk(r2)).toBe(true);
    if (!isOk(r2)) return;
    expect(r2.value.states.size).toBe(2);
    const stateIds = [...r2.value.states.keys()];
    expect(stateIds.every(id => id.startsWith("state-"))).toBe(true);
  });

  it("add-link creates link with auto-generated ID", () => {
    const m = buildModel();
    const edit: OplEdit = {
      kind: "add-link",
      link: { type: "agent", source: "obj-water", target: "proc-boiling" },
    };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.links.size).toBe(3); // 2 existing + 1 new
  });

  it("remove-thing cascades correctly", () => {
    const m = buildModel();
    const edit: OplEdit = { kind: "remove-thing", thingId: "obj-water" };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.things.has("obj-water")).toBe(false);
    expect(r.value.states.size).toBe(0);
    // Links referencing Water are removed
    expect(r.value.links.size).toBe(0);
  });

  it("handles ID collision with numeric suffix", () => {
    let m = createModel("Test");
    const edit1: OplEdit = {
      kind: "add-thing", opdId: "opd-sd",
      thing: { kind: "object", name: "Water", essence: "physical", affiliation: "systemic" },
      position: { x: 0, y: 0 },
    };
    let r = applyOplEdit(m, edit1);
    if (!isOk(r)) throw r.error; m = r.value;
    // Add another "Water" — should get obj-water-2
    r = applyOplEdit(m, edit1);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.things.size).toBe(2);
    expect(r.value.things.has("obj-water")).toBe(true);
    expect(r.value.things.has("obj-water-2")).toBe(true);
  });

  it("add-modifier creates modifier with auto-generated ID", () => {
    let m = buildModel();
    const edit: OplEdit = {
      kind: "add-modifier",
      modifier: { over: "lnk-boiling-effect-water", type: "event" },
    };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.modifiers.size).toBe(1);
    const mod = [...r.value.modifiers.values()][0]!;
    expect(mod.type).toBe("event");
    expect(mod.over).toBe("lnk-boiling-effect-water");
  });

  it("remove-state removes a state", () => {
    const m = buildModel();
    const edit: OplEdit = { kind: "remove-state", stateId: "state-liquid" };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.states.has("state-liquid")).toBe(false);
    expect(r.value.states.size).toBe(1); // state-gas remains
  });

  it("fails when adding thing to non-existent OPD", () => {
    const m = createModel("Test");
    const edit: OplEdit = {
      kind: "add-thing", opdId: "opd-nonexistent",
      thing: { kind: "object", name: "X", essence: "physical", affiliation: "systemic" },
      position: { x: 0, y: 0 },
    };
    const r = applyOplEdit(m, edit);
    expect(isErr(r)).toBe(true);
  });

  it("fails when adding link with non-existent source", () => {
    const m = createModel("Test");
    const edit: OplEdit = {
      kind: "add-link",
      link: { type: "agent", source: "obj-ghost", target: "proc-x" },
    };
    const r = applyOplEdit(m, edit);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("fails when removing non-existent thing", () => {
    const m = createModel("Test");
    const edit: OplEdit = { kind: "remove-thing", thingId: "obj-ghost" };
    const r = applyOplEdit(m, edit);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });
});

// === Lens Laws ===

describe("PutGet", () => {
  it("add-thing → expose contains the new declaration", () => {
    const m = createModel("Test");
    const edit: OplEdit = {
      kind: "add-thing", opdId: "opd-sd",
      thing: { kind: "object", name: "Sugar", essence: "physical", affiliation: "systemic" },
      position: { x: 0, y: 0 },
    };
    const r = applyOplEdit(m, edit);
    if (!isOk(r)) throw r.error;
    const doc = expose(r.value, "opd-sd");
    const decl = doc.sentences.find(s => s.kind === "thing-declaration" && s.name === "Sugar");
    expect(decl).toBeDefined();
  });

  it("add-states → expose contains state enumeration", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
    const edit: OplEdit = {
      kind: "add-states", thingId: "obj-water",
      states: [{ name: "frozen", initial: false, final: false, default: false }],
    };
    const r2 = applyOplEdit(m, edit);
    if (!isOk(r2)) throw r2.error;
    const doc = expose(r2.value, "opd-sd");
    const stateEnum = doc.sentences.find(s => s.kind === "state-enumeration");
    expect(stateEnum).toBeDefined();
    expect((stateEnum as any).stateNames).toContain("frozen");
  });

  it("add-link → expose contains link sentence", () => {
    const m = buildModel();
    const edit: OplEdit = {
      kind: "add-link",
      link: { type: "agent", source: "obj-water", target: "proc-boiling" },
    };
    const r = applyOplEdit(m, edit);
    if (!isOk(r)) throw r.error;
    const doc = expose(r.value, "opd-sd");
    const agentLink = doc.sentences.find(
      s => s.kind === "link" && s.linkType === "agent"
    );
    expect(agentLink).toBeDefined();
  });

  it("remove-thing → expose no longer contains it", () => {
    const m = buildModel();
    const edit: OplEdit = { kind: "remove-thing", thingId: "obj-water" };
    const r = applyOplEdit(m, edit);
    if (!isOk(r)) throw r.error;
    const doc = expose(r.value, "opd-sd");
    const waterDecl = doc.sentences.find(
      s => s.kind === "thing-declaration" && s.name === "Water"
    );
    expect(waterDecl).toBeUndefined();
  });

  it("remove-link → expose no longer contains it", () => {
    const m = buildModel();
    const edit: OplEdit = { kind: "remove-link", linkId: "lnk-boiling-effect-water" };
    const r = applyOplEdit(m, edit);
    if (!isOk(r)) throw r.error;
    const doc = expose(r.value, "opd-sd");
    const effectLink = doc.sentences.find(
      s => s.kind === "link" && s.linkId === "lnk-boiling-effect-water"
    );
    expect(effectLink).toBeUndefined();
  });
});

describe("GetPut", () => {
  function sentencesWithoutIds(doc: OplDocument) {
    return doc.sentences.map(s => {
      switch (s.kind) {
        case "thing-declaration": return { kind: s.kind, name: s.name, thingKind: s.thingKind, essence: s.essence, affiliation: s.affiliation };
        case "state-enumeration": return { kind: s.kind, thingName: s.thingName, stateNames: s.stateNames };
        case "duration": return { kind: s.kind, thingName: s.thingName, nominal: s.nominal, unit: s.unit };
        case "link": return { kind: s.kind, linkType: s.linkType, sourceName: s.sourceName, targetName: s.targetName, sourceStateName: s.sourceStateName, targetStateName: s.targetStateName, tag: s.tag };
        case "modifier": return { kind: s.kind, linkType: s.linkType, sourceName: s.sourceName, targetName: s.targetName, modifierType: s.modifierType, negated: s.negated, conditionMode: s.conditionMode };
        case "state-description": return { kind: s.kind, thingName: (s as any).thingName, stateName: (s as any).stateName };
        case "grouped-structural": return { kind: s.kind, linkType: (s as any).linkType, parentName: (s as any).parentName, childNames: (s as any).childNames };
        case "in-zoom-sequence": return { kind: s.kind, parentName: (s as any).parentName };
        case "attribute-value": return { kind: s.kind, thingName: (s as any).thingName, valueName: (s as any).valueName };
      }
    });
  }

  it("round-trip on model with things and links", () => {
    const m = buildModel();
    const doc1 = expose(m, "opd-sd");

    // Reconstruct from empty model
    let fresh = createModel("Test-RT");
    const edits = editsFrom(doc1);
    for (const edit of edits) {
      const r = applyOplEdit(fresh, edit);
      if (!isOk(r)) throw new Error(`Edit failed: ${JSON.stringify(r.error)}`);
      fresh = r.value;
    }

    const doc2 = expose(fresh, "opd-sd");
    // Sort by JSON serialization to ignore link ordering differences from auto-generated IDs
    const sort = (arr: any[]) => [...arr].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(sort(sentencesWithoutIds(doc2))).toEqual(sort(sentencesWithoutIds(doc1)));
  });

  it("round-trip on empty model", () => {
    const m = createModel("Test");
    const doc1 = expose(m, "opd-sd");
    const edits = editsFrom(doc1);
    expect(edits).toHaveLength(0);
    expect(doc1.sentences).toHaveLength(0);
  });
});

// === render — state descriptions (GAP-OPL-02) ===

describe("render — state descriptions (GAP-OPL-02)", () => {
  it("renders 'State S of O is initial.' for initial-only state", () => {
    let m = buildModel();
    // Add a state that is only initial (not default)
    let r = addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: false });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("State cold of Water is initial.");
  });

  it("does not emit state-description for states with no qualifiers", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    // state-gas has initial: false, final: false, default: false
    const descriptions = doc.sentences.filter(
      s => s.kind === "state-description" && (s as any).stateName === "gas"
    );
    expect(descriptions).toHaveLength(0);
  });

  it("renders combined 'is initial and default' for state with both", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    // state-liquid has initial: true AND default: true
    expect(text).toContain("State liquid of Water is initial and default.");
  });

  it("renders 'State S of O is final.' for final state", () => {
    let m = buildModel();
    // Add a final state
    let r = addState(m, { id: "state-vapor", parent: "obj-water", name: "vapor", initial: false, final: true, default: false });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("State vapor of Water is final.");
  });
});

// === render — modifier sentences (C2) ===

describe("render — modifier sentences (C2)", () => {
  function buildModelWithModifier(modType: "event" | "condition", condMode?: "skip" | "wait", negated = false) {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, boilingProc); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, boilingApp); if (!isOk(r)) throw r.error; m = r.value;
    r = addState(m, { id: "state-liquid", parent: "obj-water", name: "liquid", initial: true, final: false, default: true });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addState(m, { id: "state-gas", parent: "obj-water", name: "gas", initial: false, final: false, default: false });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-agent", type: "agent", source: "obj-water", target: "proc-boiling", source_state: "state-liquid" });
    if (!isOk(r)) throw r.error; m = r.value;
    const mod: any = { id: "mod-1", over: "lnk-agent", type: modType, negated };
    if (condMode) mod.condition_mode = condMode;
    r = addModifier(m, mod); if (!isOk(r)) throw r.error; m = r.value;
    return m;
  }

  it("renders condition(wait)+state-specified as 'Process requires State Object'", () => {
    const m = buildModelWithModifier("condition", "wait");
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling requires liquid Water");
  });

  it("renders condition(skip)+state-specified as 'Process occurs if Object is State'", () => {
    const m = buildModelWithModifier("condition", "skip");
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling occurs if Water is liquid");
  });

  it("renders condition(wait)+negated as 'Process requires Object not to be State'", () => {
    const m = buildModelWithModifier("condition", "wait", true);
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling requires Water not to be liquid");
  });

  it("renders condition(skip)+negated as 'Process occurs if Object is not State, otherwise Process is skipped'", () => {
    const m = buildModelWithModifier("condition", "skip", true);
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling occurs if Water is not liquid, otherwise Boiling is skipped");
  });

  it("renders event+state-specified as 'State Object triggers Process'", () => {
    const m = buildModelWithModifier("event");
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("liquid Water triggers Boiling");
  });
});

// === render — exhibition feature form (GAP-OPL-07) ===

describe("render — exhibition feature form (GAP-OPL-07)", () => {
  function buildExhibitionModel() {
    let m = createModel("Test");
    // Exhibitor: Vehicle (object)
    let r = addThing(m, { id: "obj-vehicle", kind: "object", name: "Vehicle", essence: "physical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // Feature: Colour (object attribute of Vehicle)
    r = addThing(m, { id: "obj-colour", kind: "object", name: "Colour", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // Appearances
    r = addAppearance(m, { thing: "obj-vehicle", opd: "opd-sd", x: 100, y: 100, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "obj-colour", opd: "opd-sd", x: 100, y: 250, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    // Exhibition link: source=feature, target=exhibitor
    r = addLink(m, { id: "lnk-exhibit-colour", type: "exhibition", source: "obj-colour", target: "obj-vehicle" });
    if (!isOk(r)) throw r.error; m = r.value;
    // States on the feature (attribute values)
    r = addState(m, { id: "state-red", parent: "obj-colour", name: "red", initial: false, final: false, default: true });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addState(m, { id: "state-blue", parent: "obj-colour", name: "blue", initial: false, final: false, default: false });
    if (!isOk(r)) throw r.error; m = r.value;
    return m;
  }

  it('renders thing declaration as "Feature of Exhibitor is a..."', () => {
    const m = buildExhibitionModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    // Colour is informatical (rendered with all-essence setting)
    expect(text).toContain("Colour of Vehicle is an object, informatical.");
  });

  it('renders state enumeration as "Feature of Exhibitor can be..."', () => {
    const m = buildExhibitionModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Colour of Vehicle can be blue or red.");
  });

  it('renders state description as "State S of Feature of Exhibitor is..."', () => {
    const m = buildExhibitionModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("State red of Colour of Vehicle is default.");
  });

  it('renders attribute value as "Feature of Exhibitor is value."', () => {
    const m = buildExhibitionModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Colour of Vehicle is red.");
  });
});

// === render — grouped structural links (GAP-OPL-04) ===

describe("render — grouped structural links (GAP-OPL-04)", () => {
  function buildGroupedModel() {
    let m = createModel("Test");
    let r = addThing(m, { id: "obj-system", kind: "object", name: "System", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-a", kind: "object", name: "Part A", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-b", kind: "object", name: "Part B", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-c", kind: "object", name: "Part C", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    for (const id of ["obj-system", "obj-a", "obj-b", "obj-c"]) {
      r = addAppearance(m, { thing: id, opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
      if (!isOk(r)) throw r.error; m = r.value;
    }
    r = addLink(m, { id: "lnk-agg-a", type: "aggregation", source: "obj-system", target: "obj-a" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-agg-b", type: "aggregation", source: "obj-system", target: "obj-b" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-agg-c", type: "aggregation", source: "obj-system", target: "obj-c" });
    if (!isOk(r)) throw r.error; m = r.value;
    return m;
  }

  it("groups aggregation into single sentence", () => {
    const m = buildGroupedModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("System consists of Part A, Part B, and Part C.");
    expect(text).not.toContain("System consists of Part A.");
  });

  it("renders incomplete aggregation with 'at least one other part'", () => {
    let m = buildGroupedModel();
    const links = [...m.links.values()];
    const aggLink = links.find(l => l.id === "lnk-agg-a")!;
    m = { ...m, links: new Map(m.links).set(aggLink.id, { ...aggLink, incomplete: true }) };
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("at least one other part");
  });

  it("groups generalization (objects) with article", () => {
    let m = createModel("Test");
    let r = addThing(m, { id: "obj-camera", kind: "object", name: "Camera", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-analog", kind: "object", name: "Analog Camera", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-digital", kind: "object", name: "Digital Camera", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    for (const id of ["obj-camera", "obj-analog", "obj-digital"]) {
      r = addAppearance(m, { thing: id, opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
      if (!isOk(r)) throw r.error; m = r.value;
    }
    r = addLink(m, { id: "lnk-gen-a", type: "generalization", source: "obj-camera", target: "obj-analog" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-gen-d", type: "generalization", source: "obj-camera", target: "obj-digital" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Analog Camera and Digital Camera are a Camera.");
  });

  it("groups classification", () => {
    let m = createModel("Test");
    let r = addThing(m, { id: "obj-class", kind: "object", name: "Vehicle", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-inst-a", kind: "object", name: "Car A", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-inst-b", kind: "object", name: "Car B", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    for (const id of ["obj-class", "obj-inst-a", "obj-inst-b"]) {
      r = addAppearance(m, { thing: id, opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
      if (!isOk(r)) throw r.error; m = r.value;
    }
    r = addLink(m, { id: "lnk-cls-a", type: "classification", source: "obj-class", target: "obj-inst-a" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-cls-b", type: "classification", source: "obj-class", target: "obj-inst-b" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Car A and Car B are instances of Vehicle.");
  });

  it("groups exhibition with 'as well as' for mixed kinds", () => {
    let m = createModel("Test");
    let r = addThing(m, { id: "obj-adult", kind: "object", name: "Adult", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-height", kind: "object", name: "Height", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-weight", kind: "object", name: "Weight", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "proc-walking", kind: "process", name: "Walking", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    for (const id of ["obj-adult", "obj-height", "obj-weight", "proc-walking"]) {
      r = addAppearance(m, { thing: id, opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
      if (!isOk(r)) throw r.error; m = r.value;
    }
    r = addLink(m, { id: "lnk-ex-h", type: "exhibition", source: "obj-height", target: "obj-adult" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-ex-w", type: "exhibition", source: "obj-weight", target: "obj-adult" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-ex-walk", type: "exhibition", source: "proc-walking", target: "obj-adult" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Adult exhibits Height and Weight, as well as Walking.");
  });

  it("editsFrom unfolds grouped structural to N individual add-links", () => {
    const m = buildGroupedModel();
    const doc = expose(m, "opd-sd");
    const edits = editsFrom(doc);
    const linkEdits = edits.filter(e => e.kind === "add-link");
    const aggEdits = linkEdits.filter(e => e.kind === "add-link" && (e as any).link.type === "aggregation");
    expect(aggEdits).toHaveLength(3);
  });
});

// === editsFrom — condition_mode propagation (GetPut) ===

describe("editsFrom — condition_mode propagation (GetPut)", () => {
  it("preserves condition_mode in round-trip expose → editsFrom", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, boilingProc); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, boilingApp); if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-agent", type: "agent", source: "obj-water", target: "proc-boiling" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addModifier(m, { id: "mod-1", over: "lnk-agent", type: "condition", condition_mode: "skip" });
    if (!isOk(r)) throw r.error; m = r.value;

    const doc = expose(m, "opd-sd");
    const edits = editsFrom(doc);

    // Find the add-modifier edit
    const modEdit = edits.find(e => e.kind === "add-modifier");
    expect(modEdit).toBeDefined();
    if (modEdit && modEdit.kind === "add-modifier") {
      expect(modEdit.modifier.condition_mode).toBe("skip");
    }
  });
});
