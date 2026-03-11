import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createModel } from "../src/model";
import { isOk, isErr } from "../src/result";
import { updateMeta, updateSettings } from "../src/api";

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
