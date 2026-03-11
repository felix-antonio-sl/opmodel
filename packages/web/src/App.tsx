import { useState, useEffect } from "react";
import { loadModel, isOk, validate, type Model } from "@opmodel/core";
import { OpdTree } from "./components/OpdTree";
import { OpdCanvas } from "./components/OpdCanvas";
import { OplPanel } from "./components/OplPanel";

export function App() {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentOpd, setCurrentOpd] = useState("opd-sd");
  const [selectedThing, setSelectedThing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/coffee-making.opmodel")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((json) => {
        const result = loadModel(json);
        if (isOk(result)) {
          setModel(result.value);
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

  if (!model) {
    return (
      <div className="loading">
        <div className="loading__spinner" />
      </div>
    );
  }

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
        <div className="header__badge">v{model.meta.schema_version}</div>
      </header>

      {/* Panels */}
      <OpdTree
        model={model}
        currentOpd={currentOpd}
        selectedThing={selectedThing}
        onSelectOpd={setCurrentOpd}
        onSelectThing={setSelectedThing}
      />
      <OpdCanvas
        model={model}
        opdId={currentOpd}
        selectedThing={selectedThing}
        onSelectThing={setSelectedThing}
      />
      <OplPanel
        model={model}
        opdId={currentOpd}
        selectedThing={selectedThing}
      />

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
        <span className="status-bar__version">opmodel {model.meta.schema_version}</span>
      </footer>
    </div>
  );
}
