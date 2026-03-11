import { useState, useEffect, useCallback } from "react";
import { loadModel, isOk, validate, type Model } from "@opmodel/core";
import { useModelStore } from "./hooks/useModelStore";
import { OpdTree } from "./components/OpdTree";
import { OpdCanvas } from "./components/OpdCanvas";
import { OplPanel } from "./components/OplPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Toolbar } from "./components/Toolbar";

function Editor({ initialModel }: { initialModel: Model }) {
  const store = useModelStore(initialModel);
  const { model, ui, dispatch, doUndo, doRedo, canUndo, canRedo, lastError, save } = store;

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          doRedo();
        } else {
          doUndo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && ui.selectedThing && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        dispatch({ tag: "removeThing", thingId: ui.selectedThing });
      }
      if (e.key === "Escape") {
        dispatch({ tag: "setMode", mode: "select" });
      }
      // Only activate mode shortcuts when not typing in an input
      const target = e.target as HTMLElement;
      if (!e.metaKey && !e.ctrlKey && target.tagName !== "INPUT" && target.tagName !== "SELECT") {
        if (e.key === "o") dispatch({ tag: "setMode", mode: "addObject" });
        if (e.key === "p") dispatch({ tag: "setMode", mode: "addProcess" });
        if (e.key === "l") dispatch({ tag: "setMode", mode: "addLink" });
      }
    },
    [doUndo, doRedo, save, ui.selectedThing, dispatch],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const errors = validate(model);
  const isValid = errors.length === 0;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header__logo">
          <div className="header__logo-diamond" />
          OPModeling
        </div>
        <div className="header__sep" />
        <div className="header__model-name">{model.meta.name}</div>
        <div className="header__spacer" />

        {/* Undo/Redo */}
        <div className="header__actions">
          <button
            className={`header__action${canUndo ? "" : " header__action--disabled"}`}
            onClick={doUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            className={`header__action${canRedo ? "" : " header__action--disabled"}`}
            onClick={doRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷
          </button>
        </div>
        <div className="header__sep" />
        <div className="header__actions">
          <button className="header__action" onClick={save} title="Save (Ctrl+S)">
            ⤓
          </button>
        </div>
        <div className="header__sep" />
        <div className="header__badge">v{model.opmodel}</div>
      </header>

      {/* Toolbar */}
      <Toolbar mode={ui.mode} dispatch={dispatch} />

      {/* Panels */}
      <OpdTree
        model={model}
        currentOpd={ui.currentOpd}
        selectedThing={ui.selectedThing}
        onSelectOpd={(id) => dispatch({ tag: "selectOpd", opdId: id })}
        onSelectThing={(id) => dispatch({ tag: "selectThing", thingId: id })}
      />
      <OpdCanvas
        model={model}
        opdId={ui.currentOpd}
        selectedThing={ui.selectedThing}
        mode={ui.mode}
        dispatch={dispatch}
      />
      <aside className="right-panel">
        {ui.selectedThing && (
          <PropertiesPanel
            model={model}
            thingId={ui.selectedThing}
            opdId={ui.currentOpd}
            dispatch={dispatch}
          />
        )}
        <OplPanel model={model} opdId={ui.currentOpd} selectedThing={ui.selectedThing} />
      </aside>

      {/* Status Bar */}
      <footer className="status-bar">
        <div className="status-bar__indicator">
          <div className={`status-bar__dot status-bar__dot--${isValid ? "ok" : "error"}`} />
          <span>{isValid ? "Valid" : `${errors.length} errors`}</span>
        </div>
        <div className="status-bar__sep" />
        <span className="status-bar__count">{model.things.size} things</span>
        <span className="status-bar__count">{model.states.size} states</span>
        <span className="status-bar__count">{model.links.size} links</span>
        <span className="status-bar__count">{model.opds.size} OPDs</span>
        <div className="status-bar__spacer" />
        {ui.mode !== "select" && (
          <>
            <span className="status-bar__mode">
              {ui.mode === "addObject" ? "Add Object" : ui.mode === "addProcess" ? "Add Process" : "Add Link"}
            </span>
            <div className="status-bar__sep" />
          </>
        )}
        {lastError && (
          <>
            <span className="status-bar__error">{lastError}</span>
            <div className="status-bar__sep" />
          </>
        )}
        {canUndo && (
          <>
            <span className="status-bar__hint">Ctrl+Z undo</span>
            <div className="status-bar__sep" />
          </>
        )}
        <span className="status-bar__version">opmodel {model.opmodel}</span>
      </footer>
    </div>
  );
}

export function App() {
  const [initialModel, setInitialModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/coffee-making.opmodel")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((json) => {
        const result = loadModel(json);
        if (isOk(result)) {
          setInitialModel(result.value);
        } else {
          setError(`Load error: ${result.error.message}`);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="loading">
        <span style={{ color: "var(--danger)" }}>{error}</span>
      </div>
    );
  }

  if (!initialModel) {
    return (
      <div className="loading">
        <div className="loading__spinner" />
      </div>
    );
  }

  return <Editor initialModel={initialModel} />;
}
