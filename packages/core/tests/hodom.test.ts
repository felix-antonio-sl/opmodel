import { describe, it, expect } from "vitest";
import { loadModel, saveModel } from "../src/serialization";
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
    expect(m.states.size).toBe(29);
    expect(m.opds.size).toBe(6);
    expect(m.links.size).toBe(82);
    expect(m.modifiers.size).toBe(5);
    expect(m.appearances.size).toBe(76);
    expect(m.fans.size).toBe(4);
    expect(m.scenarios.size).toBe(2);
    expect(m.assertions.size).toBe(5);
    expect(m.requirements.size).toBe(4);
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
});
