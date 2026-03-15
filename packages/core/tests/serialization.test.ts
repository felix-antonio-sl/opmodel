import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createModel } from "../src/model";
import { saveModel, loadModel } from "../src/serialization";
import { isOk, isErr } from "../src/result";

describe("saveModel", () => {
  it("serializes empty model with sorted keys", () => {
    const model = createModel("Test", "artificial");
    const json = saveModel(model);
    const parsed = JSON.parse(json);
    expect(parsed.opmodel).toBe("1.1.0");
    expect(parsed.meta.name).toBe("Test");
    expect(parsed.things).toEqual([]);
    expect(parsed.opds).toHaveLength(1);
    expect(parsed.opds[0].id).toBe("opd-sd");
    // Verify root keys are sorted
    const rootKeys = Object.keys(parsed);
    expect(rootKeys).toEqual([...rootKeys].sort());
  });

  it("omits undefined fields but preserves null", () => {
    const model = createModel("Test");
    const json = saveModel(model);
    const parsed = JSON.parse(json);
    // system_type is undefined, should be omitted
    expect("system_type" in parsed.meta).toBe(false);
    // parent_opd is null, MUST be preserved
    expect(parsed.opds[0].parent_opd).toBeNull();
  });

  it("sorts arrays by id", () => {
    const model = createModel("Test");
    model.things.set("obj-z", {
      id: "obj-z",
      kind: "object",
      name: "Z",
      essence: "physical",
      affiliation: "systemic",
    });
    model.things.set("obj-a", {
      id: "obj-a",
      kind: "object",
      name: "A",
      essence: "physical",
      affiliation: "systemic",
    });
    const json = saveModel(model);
    const parsed = JSON.parse(json);
    expect(parsed.things[0].id).toBe("obj-a");
    expect(parsed.things[1].id).toBe("obj-z");
  });

  it("sorts appearances by (thing, opd)", () => {
    const model = createModel("Test");
    model.appearances.set("obj-b::opd-sd", {
      thing: "obj-b",
      opd: "opd-sd",
      x: 0,
      y: 0,
      w: 100,
      h: 50,
    });
    model.appearances.set("obj-a::opd-sd", {
      thing: "obj-a",
      opd: "opd-sd",
      x: 0,
      y: 0,
      w: 100,
      h: 50,
    });
    const json = saveModel(model);
    const parsed = JSON.parse(json);
    expect(parsed.appearances[0].thing).toBe("obj-a");
    expect(parsed.appearances[1].thing).toBe("obj-b");
  });

  it("maps subModels to sub_models in JSON", () => {
    const model = createModel("Test");
    const json = saveModel(model);
    const parsed = JSON.parse(json);
    expect("sub_models" in parsed).toBe(true);
    expect("subModels" in parsed).toBe(false);
  });
});

describe("loadModel", () => {
  it("loads valid JSON into Model with Maps", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const result = loadModel(json);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const model = result.value;
    expect(model.meta.name).toBe("Coffee Making System");
    expect(model.things.size).toBe(9);
    expect(model.states.size).toBe(4);
    expect(model.opds.size).toBe(2);
    expect(model.links.size).toBe(9);
    expect(model.modifiers.size).toBe(0);
    expect(model.appearances.size).toBe(14);
    expect(model.assertions.size).toBe(1);
  });

  it("indexes things by id", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const result = loadModel(json);
    if (!isOk(result)) return;
    expect(result.value.things.get("obj-water")?.name).toBe("Water");
    expect(result.value.things.get("proc-coffee-making")?.kind).toBe("process");
  });

  it("indexes appearances by thing::opd", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const result = loadModel(json);
    if (!isOk(result)) return;
    const app = result.value.appearances.get("obj-water::opd-sd");
    expect(app).toBeDefined();
    expect(app?.x).toBe(50);
  });

  it("rejects invalid JSON", () => {
    const result = loadModel("not json");
    expect(isErr(result)).toBe(true);
  });

  it("rejects JSON missing required sections", () => {
    const result = loadModel(JSON.stringify({ opmodel: "1.0.0" }));
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid opmodel version", () => {
    const full = JSON.parse(
      readFileSync(resolve(__dirname, "../../../tests/coffee-making.opmodel"), "utf-8")
    );
    full.opmodel = "not-semver";
    const result = loadModel(JSON.stringify(full));
    expect(isErr(result)).toBe(true);
  });

  it("rejects non-array sections", () => {
    const full = JSON.parse(
      readFileSync(resolve(__dirname, "../../../tests/coffee-making.opmodel"), "utf-8")
    );
    full.things = "not-array";
    const result = loadModel(JSON.stringify(full));
    expect(isErr(result)).toBe(true);
  });
});

// I-25: round-trip invariant — serialization must be lossless.
// load(save(m)) ≅ m for all Models m.
describe("round-trip (I-25)", () => {
  it("load(save(model)) preserves all data", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const r1 = loadModel(json);
    if (!isOk(r1)) throw new Error("Failed to load");
    const saved = saveModel(r1.value);
    const r2 = loadModel(saved);
    if (!isOk(r2)) throw new Error("Failed to reload");
    const m1 = r1.value;
    const m2 = r2.value;
    // Compare all entity counts
    expect(m2.things.size).toBe(m1.things.size);
    expect(m2.states.size).toBe(m1.states.size);
    expect(m2.opds.size).toBe(m1.opds.size);
    expect(m2.links.size).toBe(m1.links.size);
    expect(m2.modifiers.size).toBe(m1.modifiers.size);
    expect(m2.appearances.size).toBe(m1.appearances.size);
    // Compare specific entities
    expect(m2.things.get("obj-water")).toEqual(m1.things.get("obj-water"));
    expect(m2.links.get("lnk-barista-agent-coffee-making")).toEqual(
      m1.links.get("lnk-barista-agent-coffee-making")
    );
  });

  it("save(createModel()) produces valid JSON that re-loads", () => {
    const model = createModel("Round Trip Test", "natural");
    const json = saveModel(model);
    const result = loadModel(json);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.meta.name).toBe("Round Trip Test");
      expect(result.value.meta.system_type).toBe("natural");
    }
  });
});
