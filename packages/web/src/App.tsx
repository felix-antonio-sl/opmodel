import { useState, useEffect, useCallback } from "react";
import { loadModel, createModel, isOk, validate, type Model } from "@opmodel/core";
import { useModelStore } from "./hooks/useModelStore";
import { OpdTree } from "./components/OpdTree";
import { OpdCanvas } from "./components/OpdCanvas";
import { OplPanel } from "./components/OplPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Toolbar } from "./components/Toolbar";

const STORAGE_KEY = "opmodel:current";

function Editor({ initialModel, onNew, onLoadExample, onImport }: { initialModel: Model; onNew: () => void; onLoadExample: () => void; onImport: (model: Model) => void }) {
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
          <button className="header__action" onClick={onNew} title="New Model">
            +
          </button>
          <button className="header__action" onClick={onLoadExample} title="Load Example">
            ☰
          </button>
          <label className="header__action" title="Import .opmodel" style={{ cursor: "pointer" }}>
            ⇧
            <input
              type="file"
              accept=".opmodel,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                file.text().then((json) => {
                  const result = loadModel(json);
                  if (isOk(result)) {
                    onImport(result.value);
                  } else {
                    alert(`Import failed: ${result.error.message}`);
                  }
                });
                e.target.value = "";
              }}
            />
          </label>
          <button className="header__action" onClick={save} title="Export .opmodel (Ctrl+S)">
            ⤓
          </button>
        </div>
        <div className="header__sep" />
        <div className="header__badge">v{model.opmodel}</div>
      </header>

      {/* Toolbar */}
      <Toolbar mode={ui.mode} linkType={ui.linkType} dispatch={dispatch} />

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
        linkType={ui.linkType}
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
        <OplPanel model={model} opdId={ui.currentOpd} selectedThing={ui.selectedThing} dispatch={dispatch} />
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

function loadFromStorage(): Model | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    const result = loadModel(json);
    return isOk(result) ? result.value : null;
  } catch {
    return null;
  }
}

function loadExample(): Promise<Model> {
  return fetch("/coffee-making.opmodel")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then((json) => {
      const result = loadModel(json);
      if (isOk(result)) return result.value;
      throw new Error(`Load error: ${result.error.message}`);
    });
}

export function App() {
  const [initialModel, setInitialModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Increment key to force Editor remount when switching models
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    // Try localStorage first, fallback to example
    const stored = loadFromStorage();
    if (stored) {
      setInitialModel(stored);
      return;
    }
    loadExample()
      .then(setInitialModel)
      .catch((e) => setError(e.message));
  }, []);

  const handleNew = useCallback(() => {
    const m = createModel("New Model");
    localStorage.setItem(STORAGE_KEY, "");
    setInitialModel(m);
    setEditorKey((k) => k + 1);
  }, []);

  const handleLoadExample = useCallback(() => {
    loadExample()
      .then((m) => {
        setInitialModel(m);
        setEditorKey((k) => k + 1);
      })
      .catch((e) => setError(e.message));
  }, []);

  const handleImport = useCallback((m: Model) => {
    setInitialModel(m);
    setEditorKey((k) => k + 1);
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

  return <Editor key={editorKey} initialModel={initialModel} onNew={handleNew} onLoadExample={handleLoadExample} onImport={handleImport} />;
}
