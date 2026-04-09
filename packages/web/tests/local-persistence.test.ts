// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createModel, saveModel } from "@opmodel/core";
import { CURRENT_STORAGE_KEY, BACKUPS_STORAGE_KEY, clearLocalSnapshots, listBackups, loadCurrentFromStorage, loadRecoveryInfo, restoreSnapshot, saveToLocalSnapshots } from "../src/lib/local-persistence";

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

  it("reports recovery info for the current local snapshot", () => {
    const model = createModel("Recovered");
    saveToLocalSnapshots(model, new Date("2026-04-09T12:00:00.000Z"));
    const info = loadRecoveryInfo();
    expect(info?.model.meta.name).toBe("Recovered");
    expect(info?.snapshotCount).toBe(1);
    expect(info?.lastSavedAt).toBe("2026-04-09T12:00:00.000Z");
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

  it("uses localStorage for small models (below IDB threshold)", () => {
    const model = createModel("Small");
    saveToLocalSnapshots(model);
    // Small model should be in localStorage
    expect(localStorage.getItem(CURRENT_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(BACKUPS_STORAGE_KEY)).toBeTruthy();
  });

  it("deduplicates identical snapshots", () => {
    const model = createModel("Same");
    saveToLocalSnapshots(model, new Date("2026-04-09T01:00:00Z"));
    saveToLocalSnapshots(model, new Date("2026-04-09T02:00:00Z"));
    saveToLocalSnapshots(model, new Date("2026-04-09T03:00:00Z"));
    const backups = listBackups();
    // All same content → only the latest should remain
    expect(backups).toHaveLength(1);
    expect(backups[0]?.savedAt).toBe("2026-04-09T03:00:00.000Z");
  });

  it("returns null from loadCurrentFromStorage when localStorage is empty", () => {
    expect(loadCurrentFromStorage()).toBeNull();
  });

  it("returns null from loadRecoveryInfo when no data stored", () => {
    expect(loadRecoveryInfo()).toBeNull();
  });
});
