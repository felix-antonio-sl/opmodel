/* ═══════════════════════════════════════════════════
   Model Store — Store Comonad over History<Model>

   AppState = History<Model> × UIState

   History tracks domain mutations (undoable).
   UIState is ephemeral (selection, OPD, never in undo).
   Dispatch interprets Commands via η into Effects.
   ═══════════════════════════════════════════════════ */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  type Model,
  type History,
  createHistory,
  pushHistory,
  undo,
  redo,
  isOk,
  saveModel,
} from "@opmodel/core";
import { type Command, interpret } from "../lib/commands";
import type { EditorMode, LinkTypeChoice } from "../lib/commands";

const STORAGE_KEY = "opmodel:current";

export interface UIState {
  currentOpd: string;
  selectedThing: string | null;
  mode: EditorMode;
  linkSource: string | null;
  linkType: LinkTypeChoice;
}

export interface ModelStore {
  /** Current model — extract from History comonad */
  model: Model;
  /** Ephemeral UI state — orthogonal to History */
  ui: UIState;
  /** Can undo? */
  canUndo: boolean;
  /** Can redo? */
  canRedo: boolean;
  /** Dispatch a Command through η: Command → Effect */
  dispatch: (cmd: Command) => void;
  /** Undo last model mutation */
  doUndo: () => void;
  /** Redo last undone mutation */
  doRedo: () => void;
  /** Last error from a rejected mutation */
  lastError: string | null;
  /** Save model to .opmodel file */
  save: () => void;
}

export function useModelStore(initialModel: Model): ModelStore {
  const [history, setHistory] = useState<History<Model>>(() =>
    createHistory(initialModel),
  );
  const [ui, setUi] = useState<UIState>({
    currentOpd: "opd-sd",
    selectedThing: null,
    mode: "select",
    linkSource: null,
    linkType: "auto" as LinkTypeChoice,
  });
  const [lastError, setLastError] = useState<string | null>(null);

  // Auto-save to localStorage on model changes (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, saveModel(history.present));
      } catch {
        // Storage full or unavailable — silently ignore
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [history.present]);

  const dispatch = useCallback((cmd: Command) => {
    const effect = interpret(cmd);

    if (effect.type === "uiTransition") {
      setUi((prev) => ({ ...prev, [effect.field]: effect.value }));
      setLastError(null);
      return;
    }

    // ModelMutation — apply to present, push to History
    setHistory((h) => {
      const result = effect.apply(h.present);
      if (isOk(result)) {
        setLastError(null);
        return pushHistory(h, result.value);
      } else {
        setLastError(`${result.error.code}: ${result.error.message}`);
        return h;
      }
    });
  }, []);

  const doUndo = useCallback(() => {
    setHistory((h) => undo(h) ?? h);
  }, []);

  const doRedo = useCallback(() => {
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

  return {
    model: history.present,
    ui,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dispatch,
    doUndo,
    doRedo,
    lastError,
    save,
  };
}
