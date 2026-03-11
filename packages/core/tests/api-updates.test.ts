import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createModel } from "../src/model";
import { isOk, isErr } from "../src/result";
import { updateMeta, updateSettings, updateModifier, updateAssertion, updateRequirement, updateStereotype, updateSubModel, updateScenario, addThing, addLink, addModifier, addAssertion, addRequirement, addStereotype, addSubModel, addScenario } from "../src/api";
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
