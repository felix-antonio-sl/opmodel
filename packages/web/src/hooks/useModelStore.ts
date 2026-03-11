/* ═══════════════════════════════════════════════════
   Model Store — Store Comonad over History<Model>

   AppState = History<Model> × UIState

   History tracks domain mutations (undoable).
   UIState is ephemeral (selection, OPD, never in undo).
   Dispatch interprets Commands via η into Effects.
   ═══════════════════════════════════════════════════ */

import { useState, useCallback } from "react";
import {
  type Model,
  type History,
  createHistory,
  pushHistory,
  undo,
  redo,
  isOk,
} from "@opmodel/core";
import { type Command, interpret } from "../lib/commands";

export interface UIState {
  currentOpd: string;
  selectedThing: string | null;
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
}

export function useModelStore(initialModel: Model): ModelStore {
  const [history, setHistory] = useState<History<Model>>(() =>
    createHistory(initialModel),
  );
  const [ui, setUi] = useState<UIState>({
    currentOpd: "opd-sd",
    selectedThing: null,
  });
  const [lastError, setLastError] = useState<string | null>(null);

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

  return {
    model: history.present,
    ui,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dispatch,
    doUndo,
    doRedo,
    lastError,
  };
}
