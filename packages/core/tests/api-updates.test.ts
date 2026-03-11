import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createModel } from "../src/model";
import { isOk, isErr } from "../src/result";
import { updateMeta, updateSettings, updateModifier, updateAssertion, updateRequirement, updateStereotype, updateSubModel, updateScenario, updateState, updateOPD, updateAppearance, updateFan, updateThing, updateLink, addThing, addLink, addState, addOPD, addAppearance, addFan, addModifier, addAssertion, addRequirement, addStereotype, addSubModel, addScenario } from "../src/api";
import type { Thing, Link } from "../src/types";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("updateMeta", () => {
  it("updates name", () => {
    const m = createModel("Old Name");
    const r = updateMeta(m, { name: "New Name" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.name).toBe("New Name");
    }
  });

  it("updates description", () => {
    const m = createModel("Test");
    const r = updateMeta(m, { description: "A test model" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.description).toBe("A test model");
    }
  });

  it("preserves created timestamp", () => {
    const m = createModel("Test");
    const r = updateMeta(m, { name: "Updated" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.created).toBe(m.meta.created);
    }
  });

  it("touch updates modified timestamp", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const m = createModel("Test");
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    const r = updateMeta(m, { name: "Updated" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.modified).not.toBe(m.meta.modified);
    }
  });

  it("does not mutate original model", () => {
    const m = createModel("Test");
    const originalName = m.meta.name;
    updateMeta(m, { name: "New" });
    expect(m.meta.name).toBe(originalName);
  });

  it("ignores undefined values in patch (cleanPatch)", () => {
    const m = createModel("Test");
    const r = updateMeta(m, { name: undefined as any, description: "desc" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.name).toBe("Test");
      expect(r.value.meta.description).toBe("desc");
    }
  });
});

describe("updateSettings", () => {
  it("updates a single setting", () => {
    const m = createModel("Test");
    const r = updateSettings(m, { autoformat: true });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.settings.autoformat).toBe(true);
    }
  });

  it("updates multiple settings at once", () => {
    const m = createModel("Test");
    const r = updateSettings(m, {
      opl_language: "en",
      decimal_precision: 3,
      notes_visible: true,
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.settings.opl_language).toBe("en");
      expect(r.value.settings.decimal_precision).toBe(3);
      expect(r.value.settings.notes_visible).toBe(true);
    }
  });

  it("touch updates modified timestamp", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const m = createModel("Test");
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    const r = updateSettings(m, { autoformat: true });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.modified).not.toBe(m.meta.modified);
    }
  });
});

const water: Thing = { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };
const proc: Thing = { id: "proc-heat", kind: "process", name: "Heat", essence: "physical", affiliation: "systemic" };

function buildModelWithLink() {
  let m = createModel("Test");
  m = (addThing(m, water) as any).value;
  m = (addThing(m, proc) as any).value;
  m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-water" }) as any).value;
  return m;
}

describe("updateModifier", () => {
  it("updates modifier type", () => {
    let m = buildModelWithLink();
    m = (addModifier(m, { id: "mod-1", over: "lnk-1", type: "event" }) as any).value;
    const r = updateModifier(m, "mod-1", { type: "condition" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.modifiers.get("mod-1")?.type).toBe("condition");
  });

  it("rejects update to non-existent modifier", () => {
    const r = updateModifier(createModel("Test"), "mod-ghost", { type: "condition" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects update with non-existent link reference (I-06)", () => {
    let m = buildModelWithLink();
    m = (addModifier(m, { id: "mod-1", over: "lnk-1", type: "event" }) as any).value;
    const r = updateModifier(m, "mod-1", { over: "lnk-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-06");
  });
});

describe("updateAssertion", () => {
  it("updates predicate", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAssertion(m, { id: "ast-1", target: "obj-water", predicate: "exists", category: "safety", enabled: true }) as any).value;
    const r = updateAssertion(m, "ast-1", { predicate: "temperature > 0" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.assertions.get("ast-1")?.predicate).toBe("temperature > 0");
  });

  it("rejects update with non-existent target (I-09)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAssertion(m, { id: "ast-1", target: "obj-water", predicate: "p", category: "safety", enabled: true }) as any).value;
    const r = updateAssertion(m, "ast-1", { target: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-09");
  });
});

describe("updateRequirement", () => {
  it("updates name", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addRequirement(m, { id: "req-1", target: "obj-water", name: "Req1" }) as any).value;
    const r = updateRequirement(m, "req-1", { name: "Updated Req" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.requirements.get("req-1")?.name).toBe("Updated Req");
  });

  it("rejects update with non-existent target (I-10)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addRequirement(m, { id: "req-1", target: "obj-water", name: "R" }) as any).value;
    const r = updateRequirement(m, "req-1", { target: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-10");
  });
});

describe("updateStereotype", () => {
  it("updates stereotype_id", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addStereotype(m, { id: "stp-1", thing: "obj-water", stereotype_id: "agent", global: false }) as any).value;
    const r = updateStereotype(m, "stp-1", { stereotype_id: "sensor" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.stereotypes.get("stp-1")?.stereotype_id).toBe("sensor");
  });

  it("rejects update with non-existent thing (I-11)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addStereotype(m, { id: "stp-1", thing: "obj-water", stereotype_id: "x", global: false }) as any).value;
    const r = updateStereotype(m, "stp-1", { thing: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-11");
  });
});

describe("updateSubModel", () => {
  it("updates name", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addSubModel(m, { id: "sub-1", name: "Sub1", path: "/sub", shared_things: ["obj-water"], sync_status: "synced" }) as any).value;
    const r = updateSubModel(m, "sub-1", { name: "Renamed Sub" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.subModels.get("sub-1")?.name).toBe("Renamed Sub");
  });

  it("rejects update with non-existent shared thing (I-12)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addSubModel(m, { id: "sub-1", name: "S", path: "/s", shared_things: ["obj-water"], sync_status: "synced" }) as any).value;
    const r = updateSubModel(m, "sub-1", { shared_things: ["obj-ghost"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-12");
  });
});

describe("updateScenario", () => {
  it("updates name", () => {
    let m = buildModelWithLink();
    const link = m.links.get("lnk-1")!;
    m = { ...m, links: new Map(m.links).set("lnk-1", { ...link, path_label: "main" }) };
    m = (addScenario(m, { id: "scn-1", name: "Scenario1", path_labels: ["main"] }) as any).value;
    const r = updateScenario(m, "scn-1", { name: "Updated Scenario" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.scenarios.get("scn-1")?.name).toBe("Updated Scenario");
  });

  it("rejects update with non-existent path label (I-13)", () => {
    let m = buildModelWithLink();
    const link = m.links.get("lnk-1")!;
    m = { ...m, links: new Map(m.links).set("lnk-1", { ...link, path_label: "main" }) };
    m = (addScenario(m, { id: "scn-1", name: "S", path_labels: ["main"] }) as any).value;
    const r = updateScenario(m, "scn-1", { path_labels: ["nonexistent"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-13");
  });
});

describe("updateState", () => {
  it("updates state name", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    const r = updateState(m, "state-cold", { name: "freezing" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.states.get("state-cold")?.name).toBe("freezing");
  });

  it("rejects update to non-existent state", () => {
    const r = updateState(createModel("Test"), "state-ghost", { name: "x" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects reparenting to non-existent thing (I-01)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    const r = updateState(m, "state-cold", { parent: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });

  it("rejects reparenting to process (I-01)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    const r = updateState(m, "state-cold", { parent: "proc-heat" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });
});

describe("updateOPD", () => {
  it("updates OPD name", () => {
    const m = createModel("Test");
    const r = updateOPD(m, "opd-sd", { name: "System Diagram" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.opds.get("opd-sd")?.name).toBe("System Diagram");
  });

  it("rejects update to non-existent OPD", () => {
    const r = updateOPD(createModel("Test"), "opd-ghost", { name: "x" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects reparenting to non-existent OPD (I-03)", () => {
    let m = createModel("Test");
    m = (addOPD(m, { id: "opd-child", name: "Child", opd_type: "hierarchical", parent_opd: "opd-sd" }) as any).value;
    const r = updateOPD(m, "opd-child", { parent_opd: "opd-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-03");
  });

  it("rejects view OPD with non-null parent (I-03)", () => {
    let m = createModel("Test");
    m = (addOPD(m, { id: "opd-view", name: "View", opd_type: "view", parent_opd: null }) as any).value;
    const r = updateOPD(m, "opd-view", { parent_opd: "opd-sd" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-03");
  });
});

describe("updateAppearance", () => {
  it("updates position", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 }) as any).value;
    const r = updateAppearance(m, "obj-water", "opd-sd", { x: 200, y: 150 });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      const app = r.value.appearances.get("obj-water::opd-sd");
      expect(app?.x).toBe(200);
      expect(app?.y).toBe(150);
      expect(app?.w).toBe(100); // unchanged
    }
  });

  it("rejects update to non-existent appearance", () => {
    const r = updateAppearance(createModel("Test"), "obj-ghost", "opd-sd", { x: 10 });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects internal=true in non-refinement OPD (I-15)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 }) as any).value;
    const r = updateAppearance(m, "obj-water", "opd-sd", { internal: true });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-15");
  });
});

describe("updateFan", () => {
  it("updates fan type", () => {
    let m = buildModelWithLink();
    m = (addLink(m, { id: "lnk-2", type: "consumption", source: "proc-heat", target: "obj-water" }) as any).value;
    m = (addFan(m, { id: "fan-1", type: "xor", members: ["lnk-1", "lnk-2"] }) as any).value;
    const r = updateFan(m, "fan-1", { type: "or" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.fans.get("fan-1")?.type).toBe("or");
  });

  it("rejects update with fewer than 2 members (I-07)", () => {
    let m = buildModelWithLink();
    m = (addLink(m, { id: "lnk-2", type: "consumption", source: "proc-heat", target: "obj-water" }) as any).value;
    m = (addFan(m, { id: "fan-1", type: "xor", members: ["lnk-1", "lnk-2"] }) as any).value;
    const r = updateFan(m, "fan-1", { members: ["lnk-1"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-07");
  });

  it("rejects update with non-existent member link (I-07)", () => {
    let m = buildModelWithLink();
    m = (addLink(m, { id: "lnk-2", type: "consumption", source: "proc-heat", target: "obj-water" }) as any).value;
    m = (addFan(m, { id: "fan-1", type: "xor", members: ["lnk-1", "lnk-2"] }) as any).value;
    const r = updateFan(m, "fan-1", { members: ["lnk-1", "lnk-ghost"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-07");
  });
});

describe("updateThing", () => {
  it("updates thing name", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const r = updateThing(m, "obj-water", { name: "H2O" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.things.get("obj-water")?.name).toBe("H2O");
  });

  it("rejects update to non-existent thing", () => {
    const r = updateThing(createModel("Test"), "obj-ghost", { name: "x" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects kind change object→process when states exist (I-01)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    const r = updateThing(m, "obj-water", { kind: "process" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });

  it("allows kind change object→process when no states", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const r = updateThing(m, "obj-water", { kind: "process" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.things.get("obj-water")?.kind).toBe("process");
  });

  it("rejects essence change to informatical when thing is agent source (I-18)", () => {
    let m = createModel("Test");
    const barista: Thing = { id: "obj-barista", kind: "object", name: "Barista", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, barista) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-barista", target: "proc-heat" }) as any).value;
    const r = updateThing(m, "obj-barista", { essence: "informatical" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-18");
  });

  it("rejects essence change to physical when thing is exhibition source (I-19)", () => {
    let m = createModel("Test");
    const attr: Thing = { id: "obj-attr", kind: "object", name: "Color", essence: "informatical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, attr) as any).value;
    m = (addLink(m, { id: "lnk-exhibit", type: "exhibition", source: "obj-attr", target: "obj-water" }) as any).value;
    const r = updateThing(m, "obj-attr", { essence: "physical" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-19");
  });

  it("rejects removing duration.max when exception link depends on it (I-14)", () => {
    let m = createModel("Test");
    const timedProc: Thing = { id: "proc-timed", kind: "process", name: "Timed", essence: "physical", affiliation: "systemic", duration: { nominal: 60, max: 120, unit: "s" } };
    const handler: Thing = { id: "proc-handler", kind: "process", name: "Handler", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, timedProc) as any).value;
    m = (addThing(m, handler) as any).value;
    m = (addLink(m, { id: "lnk-exc", type: "exception", source: "proc-timed", target: "proc-handler" }) as any).value;
    const r = updateThing(m, "proc-timed", { duration: { nominal: 60, unit: "s" } });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-14");
  });

  it("does not mutate original model", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const originalName = m.things.get("obj-water")!.name;
    updateThing(m, "obj-water", { name: "New" });
    expect(m.things.get("obj-water")!.name).toBe(originalName);
  });
});

describe("updateLink", () => {
  it("updates link type", () => {
    let m = buildModelWithLink();
    const r = updateLink(m, "lnk-1", { type: "result" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.links.get("lnk-1")?.type).toBe("result");
  });

  it("rejects update to non-existent link", () => {
    const r = updateLink(createModel("Test"), "lnk-ghost", { type: "result" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects update with non-existent source (I-05)", () => {
    let m = buildModelWithLink();
    const r = updateLink(m, "lnk-1", { source: "proc-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("rejects update with non-existent target (I-05)", () => {
    let m = buildModelWithLink();
    const r = updateLink(m, "lnk-1", { target: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("rejects type change to agent when source is not physical (I-18)", () => {
    let m = createModel("Test");
    const infoObj: Thing = { id: "obj-info", kind: "object", name: "Info", essence: "informatical", affiliation: "systemic" };
    m = (addThing(m, infoObj) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "instrument", source: "obj-info", target: "proc-heat" }) as any).value;
    const r = updateLink(m, "lnk-1", { type: "agent" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-18");
  });

  it("coerces source to informatical when type changes to exhibition (I-19)", () => {
    let m = createModel("Test");
    const physObj: Thing = { id: "obj-phys", kind: "object", name: "Phys", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, physObj) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "aggregation", source: "obj-phys", target: "obj-water" }) as any).value;
    const r = updateLink(m, "lnk-1", { type: "exhibition" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.things.get("obj-phys")?.essence).toBe("informatical");
    }
  });

  it("coerces new source to informatical on exhibition link (I-19)", () => {
    let m = createModel("Test");
    const attr1: Thing = { id: "obj-attr1", kind: "object", name: "Attr1", essence: "informatical", affiliation: "systemic" };
    const attr2: Thing = { id: "obj-attr2", kind: "object", name: "Attr2", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, attr1) as any).value;
    m = (addThing(m, attr2) as any).value;
    m = (addLink(m, { id: "lnk-ex", type: "exhibition", source: "obj-attr1", target: "obj-water" }) as any).value;
    const r = updateLink(m, "lnk-ex", { source: "obj-attr2" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.things.get("obj-attr2")?.essence).toBe("informatical");
    }
  });

  it("rejects type change to exception when source has no duration.max (I-14)", () => {
    let m = createModel("Test");
    const proc2: Thing = { id: "proc-main", kind: "process", name: "Main", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, proc) as any).value;
    m = (addThing(m, proc2) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "invocation", source: "proc-heat", target: "proc-main" }) as any).value;
    const r = updateLink(m, "lnk-1", { type: "exception" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-14");
  });

  it("rejects target change when target_state would dangle", () => {
    let m = createModel("Test");
    const obj2: Thing = { id: "obj-cup", kind: "object", name: "Cup", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, obj2) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-water", target_state: "state-cold" }) as any).value;
    // Change target to obj-cup — state-cold belongs to obj-water, not obj-cup
    const r = updateLink(m, "lnk-1", { target: "obj-cup" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("DANGLING_STATE");
  });

  it("rejects patching target_state to state not belonging to target", () => {
    let m = createModel("Test");
    const obj2: Thing = { id: "obj-cup", kind: "object", name: "Cup", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, obj2) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    // Link from proc-heat to obj-cup (no states on obj-cup)
    m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-cup" }) as any).value;
    // Try to set target_state to state-cold which belongs to obj-water, not obj-cup
    const r = updateLink(m, "lnk-1", { target_state: "state-cold" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("DANGLING_STATE");
  });

  it("rejects patching source_state to state not belonging to source", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    // Link from proc-heat to obj-water — proc-heat is a process, has no states
    m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-water" }) as any).value;
    // Try to set source_state to state-cold which belongs to obj-water, not proc-heat
    const r = updateLink(m, "lnk-1", { source_state: "state-cold" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("DANGLING_STATE");
  });

  it("does not revert source essence when type changes from exhibition (I-19 irreversibility)", () => {
    let m = createModel("Test");
    const attr: Thing = { id: "obj-attr", kind: "object", name: "Attr", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, attr) as any).value;
    // Add exhibition link — coerces attr to informatical
    m = (addLink(m, { id: "lnk-ex", type: "exhibition", source: "obj-attr", target: "obj-water" }) as any).value;
    expect(m.things.get("obj-attr")?.essence).toBe("informatical");
    // Change type from exhibition to aggregation — source stays informatical
    const r = updateLink(m, "lnk-ex", { type: "aggregation" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.things.get("obj-attr")?.essence).toBe("informatical");
    }
  });
});
