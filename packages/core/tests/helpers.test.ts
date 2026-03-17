import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanPatch, touch, transformingMode } from "../src/helpers";
import type { Link } from "../src/types";
import { createModel } from "../src/model";

describe("cleanPatch", () => {
  it("strips undefined values from patch", () => {
    const patch = { name: "New", notes: undefined };
    const result = cleanPatch(patch);
    expect(result).toEqual({ name: "New" });
    expect("notes" in result).toBe(false);
  });

  it("keeps null values (they are not undefined)", () => {
    const patch = { parent_opd: null, name: "X" };
    const result = cleanPatch(patch);
    expect(result).toEqual({ parent_opd: null, name: "X" });
  });

  it("returns empty object when all values are undefined", () => {
    const patch = { a: undefined, b: undefined };
    const result = cleanPatch(patch);
    expect(result).toEqual({});
  });

  it("passes through object with no undefined values unchanged", () => {
    const patch = { name: "Test", essence: "physical" };
    const result = cleanPatch(patch);
    expect(result).toEqual({ name: "Test", essence: "physical" });
  });
});

describe("touch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates meta.modified to current ISO timestamp", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const model = createModel("Test");
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    const touched = touch(model);
    expect(touched.meta.modified).toBe("2026-01-01T00:00:01.000Z");
    expect(touched.meta.modified).not.toBe(model.meta.modified);
  });

  it("preserves all other model fields", () => {
    const model = createModel("Test");
    const touched = touch(model);
    expect(touched.meta.name).toBe(model.meta.name);
    expect(touched.meta.created).toBe(model.meta.created);
    expect(touched.things).toBe(model.things); // same reference
    expect(touched.opds).toBe(model.opds); // same reference
  });

  it("does not mutate original model", () => {
    const model = createModel("Test");
    const originalModified = model.meta.modified;
    touch(model);
    expect(model.meta.modified).toBe(originalModified);
  });
});

const baseLink: Link = {
  id: "lnk-test", type: "effect", source: "proc-a", target: "obj-b",
};

describe("transformingMode", () => {
  it("returns 'effect' for effect link without states", () => {
    expect(transformingMode(baseLink)).toBe("effect");
  });

  it("returns 'input-specified' for effect link with source_state only", () => {
    expect(transformingMode({ ...baseLink, source_state: "s1" })).toBe("input-specified");
  });

  it("returns 'output-specified' for effect link with target_state only", () => {
    expect(transformingMode({ ...baseLink, target_state: "s2" })).toBe("output-specified");
  });

  it("returns 'input-output' for effect link with both states", () => {
    expect(transformingMode({ ...baseLink, source_state: "s1", target_state: "s2" })).toBe("input-output");
  });

  it("returns null for non-effect link", () => {
    expect(transformingMode({ ...baseLink, type: "consumption" })).toBeNull();
  });

  it("returns null for non-effect link even with states", () => {
    expect(transformingMode({ ...baseLink, type: "consumption", source_state: "s1" })).toBeNull();
  });

  it("treats empty string state as absent", () => {
    expect(transformingMode({ ...baseLink, source_state: "" })).toBe("effect");
  });
});
