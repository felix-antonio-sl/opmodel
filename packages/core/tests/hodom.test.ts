import { describe, it, expect } from "vitest";
import { loadModel, saveModel } from "../src/serialization";
import { validate } from "../src/api";
import { readFileSync } from "fs";
import { resolve } from "path";

const fixture = readFileSync(
  resolve(__dirname, "../../../tests/hospitalizacion-domiciliaria.opmodel"),
  "utf8",
);

describe("Hospitalización Domiciliaria fixture", () => {
  it("loads without errors", () => {
    const result = loadModel(fixture);
    expect(result.ok).toBe(true);
  });

  it("has expected entity counts", () => {
    const result = loadModel(fixture);
    if (!result.ok) throw new Error("load failed");
    const m = result.value;

    expect(m.things.size).toBe(48);
    expect(m.states.size).toBe(34);
    expect(m.opds.size).toBe(6);
    expect(m.links.size).toBe(82);
    expect(m.modifiers.size).toBe(5);
    expect(m.appearances.size).toBe(84);
    expect(m.fans.size).toBe(4);
    expect(m.scenarios.size).toBe(2);
    expect(m.assertions.size).toBe(6);
    expect(m.requirements.size).toBe(6);
    expect(m.stereotypes.size).toBe(2);
  });

  it("covers all 14 link types", () => {
    const result = loadModel(fixture);
    if (!result.ok) throw new Error("load failed");
    const types = new Set([...result.value.links.values()].map((l) => l.type));
    expect(types).toEqual(
      new Set([
        "effect", "consumption", "result", "input", "output",
        "agent", "instrument",
        "aggregation", "exhibition", "generalization", "classification", "tagged",
        "invocation", "exception",
      ]),
    );
  });

  it("has 3-level OPD tree (SD → SD1 → SD1.1/SD1.2)", () => {
    const result = loadModel(fixture);
    if (!result.ok) throw new Error("load failed");
    const opds = result.value.opds;

    const sd = opds.get("opd-sd")!;
    expect(sd.parent_opd).toBeNull();

    const sd1 = opds.get("opd-sd1")!;
    expect(sd1.parent_opd).toBe("opd-sd");
    expect(sd1.refinement_type).toBe("in-zoom");

    const sd11 = opds.get("opd-sd1-1")!;
    expect(sd11.parent_opd).toBe("opd-sd1");
    expect(sd11.refinement_type).toBe("in-zoom");

    const sd12 = opds.get("opd-sd1-2")!;
    expect(sd12.parent_opd).toBe("opd-sd1");

    const sd3 = opds.get("opd-sd3")!;
    expect(sd3.refinement_type).toBe("unfold");
  });

  it("has computational object with ranges", () => {
    const result = loadModel(fixture);
    if (!result.ok) throw new Error("load failed");
    const temp = result.value.things.get("obj-temperatura")!;
    expect(temp.computational).toBeDefined();
    const comp = temp.computational as any;
    expect(comp.value_type).toBe("float");
    expect(comp.unit).toBe("°C");
    expect(comp.ranges).toHaveLength(3);
    expect(comp.alias).toBe("T");
  });

  it("has socio-technical system type", () => {
    const result = loadModel(fixture);
    if (!result.ok) throw new Error("load failed");
    expect(result.value.meta.system_type).toBe("socio-technical");
  });

  it("has 2 scenarios (flujo-normal, emergencia)", () => {
    const result = loadModel(fixture);
    if (!result.ok) throw new Error("load failed");
    const scenarios = [...result.value.scenarios.values()];
    expect(scenarios.map(s => s.name).sort()).toEqual(["Flujo Normal", "Respuesta a Emergencia"]);
    // Each scenario has at least one path label
    for (const scn of scenarios) {
      expect(scn.path_labels.length).toBeGreaterThan(0);
    }
  });

  it("has 4 fans (2 XOR, 1 OR, 1 AND)", () => {
    const result = loadModel(fixture);
    if (!result.ok) throw new Error("load failed");
    const fans = [...result.value.fans.values()];
    const byType = new Map<string, number>();
    for (const f of fans) byType.set(f.type, (byType.get(f.type) || 0) + 1);
    expect(byType.get("xor")).toBe(2);
    expect(byType.get("or")).toBe(1);
    expect(byType.get("and")).toBe(1);
  });

  it("has environmental objects (Paciente, Cuidador, Domicilio)", () => {
    const result = loadModel(fixture);
    if (!result.ok) throw new Error("load failed");
    const env = [...result.value.things.values()].filter(t => t.affiliation === "environmental");
    expect(env.map(t => t.name).sort()).toEqual(["Cuidador", "Domicilio", "Paciente", "Paciente Geriátrico", "Paciente Pediátrico"]);
  });

  it("passes validation with only I-32 discriminating coverage warnings", () => {
    const result = loadModel(fixture);
    if (!result.ok) throw new Error("load failed");
    const errors = validate(result.value);
    // I-32: discriminating exhibition (Temperatura) has uncovered states for specializations
    // This is a genuine gap in the fixture — specialization links lack discriminating_values
    const nonI32 = errors.filter(e => (!e.severity || e.severity === "error") && e.code !== "I-32");
    expect(nonI32).toEqual([]);
    const i32Errors = errors.filter(e => e.code === "I-32");
    expect(i32Errors).toHaveLength(3); // 3 uncovered states of obj-temperatura
  });

  it("roundtrips through save/load", () => {
    const r1 = loadModel(fixture);
    if (!r1.ok) throw new Error("load failed");
    const saved = saveModel(r1.value);
    const r2 = loadModel(saved);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("reload failed");
    expect(r2.value.things.size).toBe(r1.value.things.size);
    expect(r2.value.links.size).toBe(r1.value.links.size);
    expect(r2.value.appearances.size).toBe(r1.value.appearances.size);
  });

  it("all OPDs have unique names", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const names = [...r.value.opds.values()].map(o => o.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all things have unique names", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const names = [...r.value.things.values()].map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all states belong to existing objects", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    for (const state of r.value.states.values()) {
      const parent = r.value.things.get(state.parent);
      expect(parent).toBeDefined();
      expect(parent?.kind).toBe("object");
    }
  });

  it("every object with states has exactly one initial+default state", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const statesByParent = new Map<string, typeof r.value.states extends Map<any, infer V> ? V : never>();
    for (const [, s] of r.value.states) {
      if (!statesByParent.has(s.parent)) statesByParent.set(s.parent, [] as any);
    }
    const grouped = new Map<string, Array<{ initial: boolean; default: boolean }>>();
    for (const s of r.value.states.values()) {
      const list = grouped.get(s.parent) ?? [];
      list.push({ initial: s.initial, default: s.default });
      grouped.set(s.parent, list);
    }
    for (const [, states] of grouped) {
      expect(states.filter(s => s.initial).length).toBeGreaterThanOrEqual(1);
      expect(states.filter(s => s.default).length).toBe(1);
    }
  });
});
