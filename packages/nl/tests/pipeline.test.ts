import { describe, test, expect } from "vitest";
import { createPipeline } from "../src/pipeline";
import type { LLMProvider } from "../src/types";
import { createModel, addThing, addOPD, addAppearance } from "@opmodel/core";
import type { Model } from "@opmodel/core";

function mockProvider(response: string): LLMProvider {
  return {
    complete: async () => response,
  };
}

function buildTestModel(): { model: Model; opdId: string } {
  let m = createModel("test");
  const opdId = "opd-main";
  let r = addOPD(m, { id: opdId, name: "Main", opd_type: "hierarchical", parent_opd: null });
  m = r.ok ? r.value : m;
  r = addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" });
  m = r.ok ? r.value : m;
  r = addAppearance(m, { thing: "obj-water", opd: opdId, x: 50, y: 50, w: 120, h: 60 });
  m = r.ok ? r.value : m;
  return { model: m, opdId };
}

describe("pipeline", () => {
  const { model, opdId } = buildTestModel();

  test("end-to-end: add-thing via mocked LLM", async () => {
    const provider = mockProvider(JSON.stringify([
      { kind: "add-thing", name: "Steam", thingKind: "object" },
    ]));
    const pipeline = createPipeline({ provider });
    const result = await pipeline.generate("Add a Steam object", { model, opdId });

    expect(result.edits).toHaveLength(1);
    expect(result.edits[0]!.kind).toBe("add-thing");
    expect(result.descriptors).toHaveLength(1);
    expect(result.preview).toContain("Steam");
  });

  test("end-to-end: batch with cross-reference", async () => {
    const provider = mockProvider(JSON.stringify([
      { kind: "add-thing", name: "Heating", thingKind: "process" },
      { kind: "add-link", sourceName: "Water", targetName: "Heating", linkType: "consumption" },
    ]));
    const pipeline = createPipeline({ provider });
    const result = await pipeline.generate("Add heating process that consumes water", { model, opdId });

    expect(result.edits).toHaveLength(2);
    expect(result.preview).toContain("Heating");
    expect(result.preview).toContain("Water");
  });

  test("rejects empty input", async () => {
    const provider = mockProvider("[]");
    const pipeline = createPipeline({ provider });
    await expect(pipeline.generate("", { model, opdId })).rejects.toThrow("Empty input");
  });

  test("rejects input over 10000 chars", async () => {
    const provider = mockProvider("[]");
    const pipeline = createPipeline({ provider });
    await expect(pipeline.generate("x".repeat(10001), { model, opdId })).rejects.toThrow("too long");
  });

  test("throws on LLM returning invalid JSON", async () => {
    const provider = mockProvider("I don't understand your request.");
    const pipeline = createPipeline({ provider });
    await expect(pipeline.generate("do something", { model, opdId })).rejects.toThrow("Parse error");
  });

  test("throws on resolve failure (unknown thing)", async () => {
    const provider = mockProvider(JSON.stringify([
      { kind: "remove-thing", name: "NonExistent" },
    ]));
    const pipeline = createPipeline({ provider });
    await expect(pipeline.generate("remove NonExistent", { model, opdId })).rejects.toThrow("Resolve error");
  });
});
