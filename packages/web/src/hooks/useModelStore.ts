/* ═══════════════════════════════════════════════════
   Model Store — Store Comonad over History<Model>

   AppState = History<Model> × UIState

   History tracks domain mutations (undoable).
   UIState is ephemeral (selection, OPD, never in undo).
   Dispatch interprets Commands via η into Effects.
   ═══════════════════════════════════════════════════ */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  type LegacyProjection,
  type Model,
  type History,
  createHistory,
  pushHistory,
  undo,
  redo,
  isOk,
  saveModel,
  runSimulation,
  projectLegacyModel,
} from "@opmodel/core";
import { type Command, interpret } from "../lib/commands";
import type { EditorMode, LinkTypeChoice, SimulationUIState } from "../lib/commands";
import { buildPatchableOpdProjectionSliceFromProjection, type PatchableOpdProjectionSlice } from "../lib/projection-view";

const STORAGE_KEY = "opmodel:current";

export interface UIState {
  currentOpd: string;
  selectedThing: string | null;
  selectedLink: string | null;
  mode: EditorMode;
  linkSource: string | null;
  linkType: LinkTypeChoice;
  simulation: SimulationUIState | null;
}

export type SaveStatus = "saved" | "saving" | "error";

export interface ModelStore {
  /** Current model — extract from History comonad */
  model: Model;
  /** Projection bridge from legacy model into kernel + atlas + layout */
  projection: LegacyProjection;
  /** Current OPD slice used by visual consumers */
  currentProjectionSlice: PatchableOpdProjectionSlice;
  /** Ephemeral UI state — orthogonal to History */
  ui: UIState;
  /** Can undo? */
  canUndo: boolean;
  /** Can redo? */
  canRedo: boolean;
  /** Has unsaved model mutations? */
  isDirty: boolean;
  /** Dispatch a Command through η: Command → Effect. Returns true if successful. */
  dispatch: (cmd: Command) => boolean;
  /** Undo last model mutation */
  doUndo: () => void;
  /** Redo last undone mutation */
  doRedo: () => void;
  /** Last error from a rejected mutation */
  lastError: string | null;
  /** Save model to .opmodel file */
  save: () => void;
  /** Autosave status: saved | saving | error */
  saveStatus: SaveStatus;
}

export function useModelStore(initialModel: Model): ModelStore {
  const [history, setHistory] = useState<History<Model>>(() =>
    createHistory(initialModel),
  );
  const [ui, setUi] = useState<UIState>({
    currentOpd: "opd-sd",
    selectedThing: null,
    selectedLink: null,
    mode: "select",
    linkSource: null,
    linkType: "auto" as LinkTypeChoice,
    simulation: null,
  });
  const [lastError, setLastError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  const projection = useMemo(() => projectLegacyModel(history.present), [history.present]);
  const currentProjectionSlice = useMemo(
    () => buildPatchableOpdProjectionSliceFromProjection(projection, history.present, ui.currentOpd),
    [projection, history.present, ui.currentOpd],
  );

  // Refs for accessing current state inside useCallback without stale closures
  const historyRef = useRef(history);
  historyRef.current = history;
  const uiRef = useRef(ui);
  uiRef.current = ui;

  // Auto-save to localStorage on model changes (debounced, respects autosave_interval_s)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    const intervalMs = (history.present.settings.autosave_interval_s ?? 0.3) * 1000;
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, saveModel(history.present));
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, intervalMs);
    return () => clearTimeout(saveTimer.current);
  }, [history.present]);

  const dispatch = useCallback((cmd: Command): boolean => {
    const effect = interpret(cmd);

    if (effect.type === "uiTransition") {
      setUi((prev) => {
        const next = { ...prev, [effect.field]: effect.value };
        // Clear selectedThing when navigating to a different OPD (thing may not exist there)
        if (effect.field === "currentOpd" && prev.selectedThing) {
          next.selectedThing = null;
        }
        return next;
      });
      setLastError(null);
      return true;
    }

    // Simulation effect — ephemeral state machine
    if (effect.type === "simulationEffect") {
      setUi((prev) => {
        const sim = prev.simulation;
        switch (effect.action) {
          case "start": {
            // Read current model from history ref
            const model = historyRef.current.present;
            const trace = runSimulation(model);
            if (trace.steps.length === 0) {
              setLastError("No executable processes found");
              return prev;
            }
            setLastError(null);
            return {
              ...prev,
              mode: "select" as EditorMode,
              simulation: {
                trace,
                currentStepIndex: -1,
                status: "paused",
                speed: 800,
                frozenModel: model,
              },
            };
          }
          case "step": {
            if (!sim) return prev;
            const dir = (effect.payload ?? 1) as number;
            const maxIdx = sim.trace.steps.length - 1;
            const newIdx = Math.max(-1, Math.min(maxIdx, sim.currentStepIndex + dir));
            const atEnd = newIdx >= maxIdx;
            return {
              ...prev,
              simulation: {
                ...sim,
                currentStepIndex: newIdx,
                status: atEnd
                  ? (sim.trace.deadlocked ? "deadlocked" : "completed")
                  : sim.status === "running" ? "running" : "paused",
              },
            };
          }
          case "reset":
            setLastError(null);
            return { ...prev, simulation: null };
          case "setStep": {
            if (!sim) return prev;
            const idx = effect.payload as number;
            const maxIdx = sim.trace.steps.length - 1;
            const clamped = Math.max(-1, Math.min(maxIdx, idx));
            return {
              ...prev,
              simulation: {
                ...sim,
                currentStepIndex: clamped,
                status: clamped >= maxIdx
                  ? (sim.trace.deadlocked ? "deadlocked" : "completed")
                  : "paused",
              },
            };
          }
          case "setSpeed": {
            if (!sim) return prev;
            return { ...prev, simulation: { ...sim, speed: effect.payload as number } };
          }
          case "toggleAutoRun": {
            if (!sim) return prev;
            if (sim.status === "completed" || sim.status === "deadlocked") return prev;
            return {
              ...prev,
              simulation: {
                ...sim,
                status: sim.status === "running" ? "paused" : "running",
              },
            };
          }
          default:
            return prev;
        }
      });
      return true;
    }

    // Guard: block model mutations during simulation
    if (uiRef.current.simulation) {
      setLastError("Exit simulation to edit the model");
      return false;
    }

    // ModelMutation — apply to present, push to History
    if (effect.type === "replaceModel") {
      let success = false;
      setHistory((h) => {
        setLastError(null);
        success = true;
        return pushHistory(h, effect.model);
      });
      return success;
    }

    let success = false;
    setHistory((h) => {
      const result = effect.apply(h.present);
      if (isOk(result)) {

        setLastError(null);
        success = true;
        return pushHistory(h, result.value);
      } else {

        setLastError(`${result.error.code}: ${result.error.message}`);
        return h;
      }
    });
    return success;
  }, []);

  const doUndo = useCallback(() => {
    if (uiRef.current.simulation) return;
    setHistory((h) => undo(h) ?? h);
  }, []);

  const doRedo = useCallback(() => {
    if (uiRef.current.simulation) return;
    setHistory((h) => redo(h) ?? h);
  }, []);

  const save = useCallback(() => {
    const json = saveModel(history.present);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${history.present.meta.name.toLowerCase().replace(/\s+/g, "-")}.opmodel`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [history]);

  // G-16: Track whether model has unsaved changes (dirty = past exists)
  const isDirty = history.past.length > 0;

  // G-16: beforeunload warning when model has changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return {
    model: history.present,
    projection,
    currentProjectionSlice,
    ui,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    isDirty,
    dispatch,
    doUndo,
    doRedo,
    lastError,
    save,
    saveStatus,
  };
}
