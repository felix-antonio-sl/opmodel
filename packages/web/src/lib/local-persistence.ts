import { isOk, loadModel, saveModel, type Model } from "@opmodel/core";

export const CURRENT_STORAGE_KEY = "opmodel:current";
export const BACKUPS_STORAGE_KEY = "opmodel:backups";
const MAX_BACKUPS = 5;

export interface LocalSnapshot {
  id: string;
  name: string;
  savedAt: string;
  json: string;
}

function safeParseSnapshots(raw: string | null): LocalSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LocalSnapshot[];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry?.json === "string") : [];
  } catch {
    return [];
  }
}

export interface LocalRecoveryInfo {
  model: Model;
  lastSavedAt: string | null;
  snapshotCount: number;
}

export function loadCurrentFromStorage(): Model | null {
  try {
    const json = localStorage.getItem(CURRENT_STORAGE_KEY);
    if (!json) return null;
    const result = loadModel(json);
    return isOk(result) ? result.value : null;
  } catch {
    return null;
  }
}

export function loadRecoveryInfo(): LocalRecoveryInfo | null {
  const model = loadCurrentFromStorage();
  if (!model) return null;
  const backups = listBackups();
  return {
    model,
    lastSavedAt: backups[0]?.savedAt ?? null,
    snapshotCount: backups.length,
  };
}

export function listBackups(): LocalSnapshot[] {
  try {
    return safeParseSnapshots(localStorage.getItem(BACKUPS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveToLocalSnapshots(model: Model, now = new Date()): { current: LocalSnapshot; backups: LocalSnapshot[] } {
  const json = saveModel(model);
  const snapshot: LocalSnapshot = {
    id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: model.meta.name,
    savedAt: now.toISOString(),
    json,
  };

  localStorage.setItem(CURRENT_STORAGE_KEY, json);

  const existing = listBackups();
  const deduped = existing.filter((entry) => entry.json !== json);
  const backups = [snapshot, ...deduped].slice(0, MAX_BACKUPS);
  localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(backups));

  return { current: snapshot, backups };
}

export function clearLocalSnapshots() {
  localStorage.removeItem(CURRENT_STORAGE_KEY);
  localStorage.removeItem(BACKUPS_STORAGE_KEY);
}

export function restoreSnapshot(snapshot: LocalSnapshot): Model | null {
  const result = loadModel(snapshot.json);
  return isOk(result) ? result.value : null;
}
