// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createModel } from "@opmodel/core";
import { clearLocalSnapshots, listBackups, loadCurrentFromStorage, restoreSnapshot, saveToLocalSnapshots } from "../src/lib/local-persistence";

describe("local persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves current snapshot and rotates backups", () => {
    for (let i = 0; i < 7; i++) {
      const model = createModel(`Model ${i}`);
      saveToLocalSnapshots(model, new Date(`2026-04-09T0${i}:00:00.000Z`));
    }

    const current = loadCurrentFromStorage();
    expect(current?.meta.name).toBe("Model 6");

    const backups = listBackups();
    expect(backups).toHaveLength(5);
    expect(backups[0]?.name).toBe("Model 6");
    expect(backups[4]?.name).toBe("Model 2");
  });

  it("restores a stored snapshot back into a model", () => {
    const model = createModel("Recover Me");
    const { current } = saveToLocalSnapshots(model, new Date("2026-04-09T12:00:00.000Z"));
    const restored = restoreSnapshot(current);
    expect(restored?.meta.name).toBe("Recover Me");
  });

  it("can clear all local snapshots", () => {
    saveToLocalSnapshots(createModel("A"));
    clearLocalSnapshots();
    expect(loadCurrentFromStorage()).toBeNull();
    expect(listBackups()).toEqual([]);
  });
});
