import { isOk, loadModel, saveModel, type Model } from "@opmodel/core";

export const CURRENT_STORAGE_KEY = "opmodel:current";
export const BACKUPS_STORAGE_KEY = "opmodel:backups";
const MAX_BACKUPS = 5;
const IDB_NAME = "opmodel";
const IDB_STORE = "snapshots";
const IDB_VERSION = 1;
/** Threshold in bytes above which we prefer IndexedDB over localStorage */
const IDB_THRESHOLD = 2 * 1024 * 1024; // 2 MB

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

// ── IndexedDB helpers ──────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut<T>(key: string, value: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const req = tx.objectStore(IDB_STORE).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const req = tx.objectStore(IDB_STORE).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
  );
}

// ── Public API ─────────────────────────────────────

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

/** Try localStorage first, then IndexedDB (async). */
export async function loadCurrentAsync(): Promise<Model | null> {
  const sync = loadCurrentFromStorage();
  if (sync) return sync;
  try {
    const json = await idbGet<string>("current");
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

/** Async recovery that checks both localStorage and IndexedDB */
export async function loadRecoveryInfoAsync(): Promise<LocalRecoveryInfo | null> {
  const sync = loadRecoveryInfo();
  if (sync) return sync;
  try {
    const model = await loadCurrentAsync();
    if (!model) return null;
    const backups = (await idbGet<LocalSnapshot[]>("backups")) ?? [];
    return {
      model,
      lastSavedAt: backups[0]?.savedAt ?? null,
      snapshotCount: backups.length,
    };
  } catch {
    return null;
  }
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

  const existing = listBackups();
  const deduped = existing.filter((entry) => entry.json !== json);
  const backups = [snapshot, ...deduped].slice(0, MAX_BACKUPS);

  if (json.length > IDB_THRESHOLD) {
    // Large model — write to IndexedDB, clear localStorage to free space
    idbPut("current", json).catch(() => {});
    idbPut("backups", backups).catch(() => {});
    try { localStorage.removeItem(CURRENT_STORAGE_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem(BACKUPS_STORAGE_KEY); } catch { /* ignore */ }
  } else {
    // Small model — use localStorage (faster, sync)
    localStorage.setItem(CURRENT_STORAGE_KEY, json);
    localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(backups));
  }

  return { current: snapshot, backups };
}

export function clearLocalSnapshots() {
  localStorage.removeItem(CURRENT_STORAGE_KEY);
  localStorage.removeItem(BACKUPS_STORAGE_KEY);
  idbDelete("current").catch(() => {});
  idbDelete("backups").catch(() => {});
}

export function restoreSnapshot(snapshot: LocalSnapshot): Model | null {
  const result = loadModel(snapshot.json);
  return isOk(result) ? result.value : null;
}
