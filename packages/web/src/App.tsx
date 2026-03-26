import { useState, useEffect, useCallback, useMemo, useRef, Component, type ErrorInfo, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("React Error Boundary:", error, info); }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 20, color: "red", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
        <h2>Error in OPModeling</h2>
        <p>{this.state.error.message}</p>
        <pre>{this.state.error.stack}</pre>
        <button onClick={() => { localStorage.clear(); location.reload(); }}>Clear Storage & Reload</button>
      </div>;
    }
    return this.props.children;
  }
}
import { loadModel, createModel, isOk, validate, saveModel, expose, render, renderAll, exportMarkdown, type Model, type Thing } from "@opmodel/core";
import { useModelStore } from "./hooks/useModelStore";
import { OpdTree } from "./components/OpdTree";
import { OpdCanvas } from "./components/OpdCanvas";
import { OplPanel } from "./components/OplPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Toolbar } from "./components/Toolbar";
import { SimulationPanel } from "./components/SimulationPanel";
import { ValidationPanel } from "./components/ValidationPanel";
import { auditVisualOpd, computeVisualQuality } from "./lib/visual-lint";
import { suggestLayoutForOpd } from "./lib/spatial-layout";
import { BugCapture } from "./components/BugCapture";
import type { NlConfig } from "@opmodel/nl";
import { createProvider, createPipeline } from "@opmodel/nl";
import { NlSettingsModal } from "./components/NlSettingsModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { VerificationChecklist } from "./components/VerificationChecklist";
import { SdWizard } from "./components/SdWizard";
import { VisualReportPanel } from "./components/VisualReportPanel";

const STORAGE_KEY = "opmodel:current";

const EXAMPLES = [
  { name: "Coffee Making", file: "coffee-making.opmodel" },
  { name: "OnStar Driver Rescuing", file: "driver-rescuing.opmodel" },
  { name: "Hospitalización Domiciliaria (legacy)", file: "hospitalizacion-domiciliaria.opmodel" },
  { name: "HODOM V2 (Metodología OPM)", file: "hodom-v2.opmodel" },
  { name: "EV-AMS (Canonical)", file: "ev-ams.opmodel" },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function FileMenu({ model, onNew, onLoadExample, onImport, onSave, onAutoLayoutAll, onShowVisualReport }: {
  model: Model;
  onNew: () => void;
  onLoadExample: (file: string) => void;
  onImport: (model: Model) => void;
  onSave: () => void;
  onAutoLayoutAll?: () => void;
  onShowVisualReport?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const baseName = model.meta.name.toLowerCase().replace(/\s+/g, "-");

  const handleOpen = () => {
    fileInputRef.current?.click();
    setOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((json) => {
      const result = loadModel(json);
      if (isOk(result)) onImport(result.value);
      else alert(`Open failed: ${result.error.message}`);
    });
    e.target.value = "";
  };

  const exportOpl = () => {
    downloadBlob(new Blob([renderAll(model)], { type: "text/plain" }), `${baseName}.opl.txt`);
    setOpen(false);
  };

  const exportMd = () => {
    downloadBlob(new Blob([exportMarkdown(model)], { type: "text/markdown" }), `${baseName}.md`);
    setOpen(false);
  };

  const exportSvg = () => {
    const svg = document.querySelector(".opd-canvas svg") as SVGSVGElement | null;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    // Remove grid and set viewBox to content
    const grid = clone.querySelector("rect[fill='url(#grid-dots)']");
    grid?.remove();
    const bbox = svg.getBBox();
    const pad = 20;
    clone.setAttribute("viewBox", `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    clone.setAttribute("width", String(bbox.width + pad * 2));
    clone.setAttribute("height", String(bbox.height + pad * 2));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const serializer = new XMLSerializer();
    downloadBlob(new Blob([serializer.serializeToString(clone)], { type: "image/svg+xml" }), `${baseName}.svg`);
    setOpen(false);
  };

  const exportPng = () => {
    const svg = document.querySelector(".opd-canvas svg") as SVGSVGElement | null;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const grid = clone.querySelector("rect[fill='url(#grid-dots)']");
    grid?.remove();
    const bbox = svg.getBBox();
    const pad = 20;
    const w = bbox.width + pad * 2;
    const h = bbox.height + pad * 2;
    clone.setAttribute("viewBox", `${bbox.x - pad} ${bbox.y - pad} ${w} ${h}`);
    clone.setAttribute("width", String(w * 2));
    clone.setAttribute("height", String(h * 2));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgStr = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#f0f2f5";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${baseName}.png`);
      }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
    setOpen(false);
  };

  return (
    <div className="header__actions" ref={menuRef} style={{ position: "relative" }}>
      <button className="header__action" onClick={() => setOpen(!open)}>
        File
      </button>
      <input ref={fileInputRef} type="file" accept=".opmodel,.json" style={{ display: "none" }} onChange={handleFileChange} />
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 100,
          background: "var(--bg-panel)", border: "1px solid var(--border)",
          borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          minWidth: 160, padding: "4px 0",
        }}>
          <button className="file-menu__item" onClick={() => { onNew(); setOpen(false); }}>New Empty Model</button>
          <button className="file-menu__item" onClick={() => { (window as any).__openWizard?.(); setOpen(false); }} style={{ color: "var(--accent)" }}>✨ New with SD Wizard</button>
          <button className="file-menu__item" onClick={handleOpen}>Open...</button>
          <button className="file-menu__item" onClick={() => { onSave(); setOpen(false); }}>Save .opmodel</button>
          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
          {EXAMPLES.map(ex => (
            <button key={ex.file} className="file-menu__item" onClick={() => { onLoadExample(ex.file); setOpen(false); }}>
              {ex.name}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
          <button className="file-menu__item" onClick={exportOpl}>Export OPL text</button>
          <button className="file-menu__item" onClick={exportMd}>Export Markdown</button>
          <button className="file-menu__item" onClick={exportSvg}>Export SVG</button>
          <button className="file-menu__item" onClick={exportPng}>Export PNG</button>
          {onShowVisualReport && <button className="file-menu__item" onClick={() => { onShowVisualReport(); setOpen(false); }}>Visual Quality Report</button>}
          {onAutoLayoutAll && (
            <>
              <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
              <button className="file-menu__item" onClick={() => { onAutoLayoutAll(); setOpen(false); }}>⇄ Auto Layout All OPDs</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Editor({ initialModel, onNew, onLoadExample, onImport }: { initialModel: Model; onNew: () => void; onLoadExample: (file: string) => void; onImport: (model: Model) => void }) {
  const store = useModelStore(initialModel);
  const { model, ui, dispatch, doUndo, doRedo, canUndo, canRedo, lastError, save, saveStatus } = store;

  // NL pipeline
  const [nlConfig, setNlConfig] = useState<NlConfig | null>(() => {
    const stored = localStorage.getItem("opmodel:nl-config");
    if (stored) {
      try { return JSON.parse(stored) as NlConfig; } catch { /* ignore */ }
    }
    const key = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
    if (key) return { provider: "claude" as const, apiKey: key };
    return null;
  });
  const [showNlSettings, setShowNlSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showVisualReport, setShowVisualReport] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  (window as any).__openWizard = () => setShowWizard(true);
  const [searchQuery, setSearchQuery] = useState("");

  const nlPipeline = useMemo(() => {
    if (!nlConfig) return undefined;
    const provider = createProvider(nlConfig);
    return createPipeline({ provider });
  }, [nlConfig]);

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
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        // Ctrl+A handled by canvas via custom event
        window.dispatchEvent(new CustomEvent("opmodel:selectAll"));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        if (ui.selectedThing && !ui.simulation) {
          const thing = model.things.get(ui.selectedThing);
          if (thing) {
            const newId = `${thing.kind === "object" ? "obj" : "proc"}-${Date.now().toString(36)}`;
            const app = [...model.appearances.values()].find(a => a.thing === ui.selectedThing && a.opd === ui.currentOpd);
            dispatch({
              tag: "addThing",
              thing: { ...thing, id: newId, name: `${thing.name} (copy)` },
              opdId: ui.currentOpd,
              x: (app?.x ?? 100) + 40,
              y: (app?.y ?? 100) + 40,
              w: app?.w ?? 120,
              h: app?.h ?? 60,
            });
            // Copy states
            for (const state of model.states.values()) {
              if (state.parent === ui.selectedThing) {
                dispatch({
                  tag: "addState",
                  state: {
                    id: `${state.id}-${Date.now().toString(36)}`,
                    parent: newId,
                    name: state.name,
                    initial: state.initial,
                    final: state.final,
                    default: state.default,
                  },
                });
              }
            }
            dispatch({ tag: "selectThing", thingId: newId });
          }
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch((v) => !v);
        setSearchQuery("");
      }
      if ((e.key === "Delete" || e.key === "Backspace") && ui.selectedThing && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        const thing = model.things.get(ui.selectedThing);
        const stateCount = [...model.states.values()].filter(s => s.parent === ui.selectedThing).length;
        const linkCount = [...model.links.values()].filter(l => l.source === ui.selectedThing || l.target === ui.selectedThing).length;
        if ((stateCount > 0 || linkCount > 0) && !window.confirm(
          `Delete "${thing?.name}"? This will also remove ${stateCount} state(s) and ${linkCount} link(s).`
        )) return;
        dispatch({ tag: "removeThing", thingId: ui.selectedThing });
      }
      if (e.key === "Escape") {
        dispatch({ tag: "setMode", mode: "select" });
      }
      // R-NT-5: Ctrl+Up = parent OPD, Ctrl+Down = first child OPD
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowUp") {
        const currentOpdObj = model.opds.get(ui.currentOpd);
        if (currentOpdObj?.parent_opd) {
          e.preventDefault();
          dispatch({ tag: "selectOpd", opdId: currentOpdObj.parent_opd });
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowDown") {
        const childOpd = [...model.opds.values()].find(o => o.parent_opd === ui.currentOpd);
        if (childOpd) {
          e.preventDefault();
          dispatch({ tag: "selectOpd", opdId: childOpd.id });
        }
      }
      // Only activate mode shortcuts when not typing in an input
      const target = e.target as HTMLElement;
      if (!e.metaKey && !e.ctrlKey && target.tagName !== "INPUT" && target.tagName !== "SELECT") {
        // Simulation shortcuts
        if (e.key === "s") {
          dispatch({ tag: ui.simulation ? "resetSimulation" : "startSimulation" });
          return;
        }
        if (ui.simulation) {
          if (e.key === " ") { e.preventDefault(); dispatch({ tag: "toggleSimulationAutoRun" }); }
          if (e.key === "ArrowRight") { e.preventDefault(); dispatch({ tag: "stepSimulation", direction: 1 }); }
          if (e.key === "ArrowLeft") { e.preventDefault(); dispatch({ tag: "stepSimulation", direction: -1 }); }
          return;
        }
        if (e.key === "o") dispatch({ tag: "setMode", mode: "addObject" });
        if (e.key === "p") dispatch({ tag: "setMode", mode: "addProcess" });
        if (e.key === "l") dispatch({ tag: "setMode", mode: "addLink" });
        if (e.key === "?") setShowHelp(v => !v);
      }
    },
    [doUndo, doRedo, save, ui.selectedThing, ui.currentOpd, ui.simulation, model.opds, dispatch],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Dynamic page title
  useEffect(() => {
    document.title = `${model.meta.name} — OPModeling`;
  }, [model.meta.name]);

  const errors = validate(model);
  const hardErrors = errors.filter(e => !e.severity || e.severity === "error");
  const isValid = hardErrors.length === 0;
  const errorEntities = useMemo(() => {
    const set = new Set<string>();
    for (const e of errors) { if (e.entity) set.add(e.entity); }
    return set;
  }, [errors]);
  const visualFindings = useMemo(() => {
    const appearances = [...model.appearances.values()].filter((a) => a.opd === ui.currentOpd);
    const ids = new Set(appearances.map((a) => a.thing));
    const links = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
    return auditVisualOpd({ appearances, links, things: model.things.values(), states: model.states.values() });
  }, [model, ui.currentOpd]);
  const visualQuality = useMemo(() => computeVisualQuality(visualFindings), [visualFindings]);

  const [layoutAllToast, setLayoutAllToast] = useState<string | null>(null);
  const autoLayoutAll = useCallback(() => {
    const opds = [...model.opds.values()];
    let totalPatches = 0;
    let beforeSum = 0;
    let afterSum = 0;
    const allUpdates: Array<{ thingId: string; opdId: string; patch: Record<string, unknown> }> = [];

    for (const opd of opds) {
      const apps = [...model.appearances.values()].filter((a) => a.opd === opd.id);
      const ids = new Set(apps.map((a) => a.thing));
      const links = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
      const beforeFindings = auditVisualOpd({ appearances: apps, links, things: model.things.values(), states: model.states.values() });
      beforeSum += computeVisualQuality(beforeFindings).score;

      const suggestion = suggestLayoutForOpd(model, opd.id);
      afterSum += computeVisualQuality(suggestion.findings).score;
      totalPatches += suggestion.patches.length;
      for (const p of suggestion.patches) {
        allUpdates.push({ thingId: p.thingId, opdId: p.opdId, patch: p.patch as Record<string, unknown> });
      }
    }

    if (allUpdates.length === 0) {
      setLayoutAllToast(`All OPDs optimal — avg ${Math.round(beforeSum / opds.length)}`);
      setTimeout(() => setLayoutAllToast(null), 3000);
      return;
    }

    dispatch({ tag: "updateAppearancesBatch", updates: allUpdates });
    const avgBefore = Math.round(beforeSum / opds.length);
    const avgAfter = Math.round(afterSum / opds.length);
    const arrow = avgAfter > avgBefore ? "↑" : avgAfter < avgBefore ? "↓" : "→";
    setLayoutAllToast(`${opds.length} OPDs — avg ${avgBefore} ${arrow} ${avgAfter} (${totalPatches} patches)`);
    setTimeout(() => setLayoutAllToast(null), 5000);
  }, [model, dispatch]);

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
        <FileMenu
          model={model}
          onNew={onNew}
          onLoadExample={onLoadExample}
          onImport={onImport}
          onSave={save}
          onAutoLayoutAll={autoLayoutAll}
          onShowVisualReport={() => setShowVisualReport(true)}
        />
        <div className="header__sep" />
        <div className="header__badge">v{model.opmodel}</div>
        <button
          className={`header__action${ui.simulation ? " header__action--active" : ""}`}
          onClick={() => dispatch({ tag: ui.simulation ? "resetSimulation" : "startSimulation" })}
          title="Toggle Simulation (S)"
        >
          {ui.simulation ? "Exit Sim" : "Simulate"}
        </button>
        <button onClick={() => setShowSettings(true)} title="Model Settings">⚙</button>
        <button onClick={() => setShowNlSettings(true)} title="NL Settings" style={{ fontSize: "11px" }}>NL</button>
      </header>

      {/* Toolbar */}
      <Toolbar mode={ui.mode} linkType={ui.linkType} dispatch={dispatch} />

      {/* Left sidebar: OPD tree + Minimap */}
      <div className="left-sidebar">
        <OpdTree
          model={model}
          currentOpd={ui.currentOpd}
          selectedThing={ui.selectedThing}
          onSelectOpd={(id) => dispatch({ tag: "selectOpd", opdId: id })}
          onSelectThing={(id) => dispatch({ tag: "selectThing", thingId: id })}
          onRenameOpd={(opdId, name) => dispatch({ tag: "renameOpd", opdId, name })}
          onCreateViewOpd={() => {
            const id = `opd-view-${Date.now()}`;
            const name = `View ${[...model.opds.values()].filter(o => o.opd_type === "view").length + 1}`;
            dispatch({ tag: "addViewOpd", opdId: id, name });
          }}
          onRemoveViewOpd={(opdId) => {
            if (ui.currentOpd === opdId) dispatch({ tag: "selectOpd", opdId: "opd-sd" });
            dispatch({ tag: "removeOpd", opdId });
          }}
          onAddThingToView={(thingId, opdId) => {
            dispatch({ tag: "addThingToView", thingId, opdId });
          }}
        />
        {/* Minimap (H-07) */}
        {(() => {
          const apps = [...model.appearances.values()].filter((a) => a.opd === ui.currentOpd);
          if (apps.length === 0) return null;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const a of apps) {
            minX = Math.min(minX, a.x);
            minY = Math.min(minY, a.y);
            maxX = Math.max(maxX, a.x + a.w);
            maxY = Math.max(maxY, a.y + a.h);
          }
          const pad = 20;
          minX -= pad; minY -= pad; maxX += pad; maxY += pad;
          const vw = maxX - minX;
          const vh = maxY - minY;
          return (
            <div className="minimap">
              <div className="minimap__title">Minimap</div>
              <svg className="minimap__svg" viewBox={`${minX} ${minY} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
                {apps.map((a) => {
                  const thing = model.things.get(a.thing);
                  if (!thing) return null;
                  const isProc = thing.kind === "process";
                  const isSelected = ui.selectedThing === a.thing;
                  const fill = isProc ? "var(--process-fill)" : "var(--object-fill)";
                  const stroke = isSelected ? "var(--accent)" : (isProc ? "var(--process-stroke)" : "var(--object-stroke)");
                  return isProc ? (
                    <ellipse key={a.thing} cx={a.x + a.w / 2} cy={a.y + a.h / 2} rx={a.w / 2} ry={a.h / 2}
                      fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 1} />
                  ) : (
                    <rect key={a.thing} x={a.x} y={a.y} width={a.w} height={a.h}
                      fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 1} />
                  );
                })}
              </svg>
            </div>
          );
        })()}
      </div>
      <OpdCanvas
        model={ui.simulation ? ui.simulation.frozenModel : model}
        opdId={ui.currentOpd}
        selectedThing={ui.selectedThing}
        mode={ui.mode}
        linkType={ui.linkType}
        dispatch={dispatch}
        simulation={ui.simulation}
        errorEntities={errorEntities}
      />
      {/* Search panel — floating over canvas */}
      {showSearch && (() => {
        const q = searchQuery.toLowerCase();
        const results = q.length > 0
          ? [...model.things.values()]
              .filter((t) => {
                if (t.name.toLowerCase().includes(q)) return true;
                // Also search states
                const states = [...model.states.values()].filter(s => s.parent === t.id);
                if (states.some(s => s.name.toLowerCase().includes(q))) return true;
                // Search notes
                if (t.notes?.toLowerCase().includes(q)) return true;
                return false;
              })
              .slice(0, 20)
          : [...model.things.values()].slice(0, 20);
        // Find which OPDs each thing appears in
        const thingOpds = (thingId: string): string[] => {
          const opds: string[] = [];
          for (const app of model.appearances.values()) {
            if (app.thing === thingId) {
              const opd = model.opds.get(app.opd);
              if (opd) opds.push(opd.name);
            }
          }
          return opds;
        };
        return (
          <div className="search-panel">
            <div className="search-panel__header">
              <input
                className="search-panel__input"
                placeholder="Search things..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); }
                  if (e.key === "Enter" && results.length > 0) {
                    const first = results[0]!;
                    // Navigate to first OPD containing this thing
                    for (const app of model.appearances.values()) {
                      if (app.thing === first.id) {
                        dispatch({ tag: "selectOpd", opdId: app.opd });
                        break;
                      }
                    }
                    dispatch({ tag: "selectThing", thingId: first.id });
                    setShowSearch(false);
                    setSearchQuery("");
                  }
                }}
                autoFocus
              />
              <button className="search-panel__close" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>×</button>
            </div>
            <div className="search-panel__results">
              {results.map((t) => (
                <div
                  key={t.id}
                  className="search-panel__item"
                  onClick={() => {
                    for (const app of model.appearances.values()) {
                      if (app.thing === t.id) {
                        dispatch({ tag: "selectOpd", opdId: app.opd });
                        break;
                      }
                    }
                    dispatch({ tag: "selectThing", thingId: t.id });
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                >
                  <span className={`search-panel__kind search-panel__kind--${t.kind}`}>
                    {t.kind === "object" ? "▭" : "⬭"}
                  </span>
                  <span className="search-panel__name">{t.name}</span>
                  <span className="search-panel__opds">{thingOpds(t.id).join(", ")}</span>
                </div>
              ))}
              {results.length === 0 && q.length > 0 && (
                <div className="search-panel__empty">No results</div>
              )}
            </div>
          </div>
        );
      })()}

      <aside className="right-panel">
        {ui.simulation ? (
          <SimulationPanel model={ui.simulation.frozenModel} simulation={ui.simulation} dispatch={dispatch} />
        ) : (
          ui.selectedThing && (
            <PropertiesPanel
              model={model}
              thingId={ui.selectedThing}
              opdId={ui.currentOpd}
              dispatch={dispatch}
            />
          )
        )}
        <OplPanel model={model} opdId={ui.currentOpd} selectedThing={ui.selectedThing} dispatch={dispatch} nlPipeline={nlPipeline} lastError={lastError} />
      </aside>

      {/* Validation Panel (floating, above status bar) */}
      {showValidation && (
        <ValidationPanel
          model={model}
          errors={errors}
          visualFindings={visualFindings}
          dispatch={dispatch}
          onClose={() => setShowValidation(false)}
        />
      )}
      {showVisualReport && (
        <VisualReportPanel model={model} onClose={() => setShowVisualReport(false)} />
      )}

      {/* Status Bar */}
      <footer className="status-bar">
        <div
          className="status-bar__indicator status-bar__indicator--clickable"
          onClick={() => setShowValidation(v => !v)}
          title="Toggle validation panel"
        >
          <div className={`status-bar__dot status-bar__dot--${isValid ? "ok" : "error"}`} />
          <span>{isValid ? (errors.length > 0 ? `${errors.length} hints` : "Valid") : `${hardErrors.length} errors`}</span>
        </div>
        <button
          className="status-bar__indicator status-bar__indicator--clickable"
          onClick={() => setShowVerification(true)}
          title="Methodology verification checklist"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--accent)" }}
        >✓ Verify</button>
        <div
          className="status-bar__indicator status-bar__indicator--clickable"
          onClick={() => setShowValidation(true)}
          title={`Visual quality: ${visualQuality.grade} (${visualQuality.score}/100) — ${visualQuality.errorCount} errors, ${visualQuality.warningCount} warnings, ${visualQuality.infoCount} info`}
          style={{ cursor: "pointer" }}
        >
          <span style={{ color: visualQuality.grade === "A" ? "var(--success)" : visualQuality.grade === "F" ? "var(--error, #e53e3e)" : "var(--text)" }}>
            {visualQuality.grade} {visualQuality.score}
          </span>
        </div>
        <button
          className="status-bar__indicator status-bar__indicator--clickable"
          onClick={() => setShowVisualReport(true)}
          title="Open model-level visual quality report"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--accent)" }}
        >📊 Visual Report</button>
        <div className="status-bar__sep" />
        <span className="status-bar__count">{model.things.size} things</span>
        <span className="status-bar__count">{model.states.size} states</span>
        <span className="status-bar__count">{model.links.size} links</span>
        <span className="status-bar__count">{model.opds.size} OPDs</span>
        {layoutAllToast && <span className="layout-toast" style={{ position: "relative", bottom: "auto" }}>{layoutAllToast}</span>}
        <div className="status-bar__spacer" />
        {ui.simulation && (
          <>
            <span className="status-bar__mode">
              Simulation: {ui.simulation.currentStepIndex >= 0
                ? `Step ${ui.simulation.currentStepIndex + 1}/${ui.simulation.trace.steps.length}`
                : "Initial"}
              {ui.simulation.status === "deadlocked" && " — DEADLOCKED"}
              {ui.simulation.status === "completed" && " — Complete"}
            </span>
            <div className="status-bar__sep" />
          </>
        )}
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
        <span className={`status-bar__save status-bar__save--${saveStatus}`}>
          {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Storage full"}
        </span>
        <div className="status-bar__sep" />
        <span className="status-bar__version">opmodel {model.opmodel}</span>
      </footer>
      {showNlSettings && (
        <NlSettingsModal
          config={nlConfig}
          onSave={setNlConfig}
          onClose={() => setShowNlSettings(false)}
        />
      )}
      <BugCapture model={model} opdId={ui.currentOpd} selectedThing={ui.selectedThing} errors={errors} />
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="help-dialog__title">Keyboard Shortcuts</div>
            <div className="help-dialog__grid">
              <kbd>O</kbd><span>Add Object</span>
              <kbd>P</kbd><span>Add Process</span>
              <kbd>L</kbd><span>Add Link</span>
              <kbd>Esc</kbd><span>Select Mode</span>
              <kbd>Del</kbd><span>Delete Selected</span>
              <kbd>⌘Z</kbd><span>Undo</span>
              <kbd>⌘⇧Z</kbd><span>Redo</span>
              <kbd>⌘S</kbd><span>Save</span>
              <kbd>⌘A</kbd><span>Select All</span>
              <kbd>⌘D</kbd><span>Duplicate Thing</span>
              <kbd>⌘F</kbd><span>Search</span>
              <kbd>⌘↑</kbd><span>Parent OPD</span>
              <kbd>⌘↓</kbd><span>Child OPD</span>
              <kbd>S</kbd><span>Toggle Simulation</span>
              <kbd>Space</kbd><span>Play/Pause Sim</span>
              <kbd>→</kbd><span>Step Forward</span>
              <kbd>←</kbd><span>Step Back</span>
              <kbd>+/−</kbd><span>Zoom In/Out (scroll)</span>
              <kbd>?</kbd><span>This Help</span>
            </div>
            <button className="help-dialog__close" onClick={() => setShowHelp(false)}>Close</button>
          </div>
        </div>
      )}
      {showWizard && (
        <SdWizard
          onComplete={(newModel) => {
            setShowWizard(false);
            // Replace current model with wizard output
            localStorage.setItem("opmodel:current", saveModel(newModel));
            location.reload();
          }}
          onCancel={() => setShowWizard(false)}
        />
      )}
      {showVerification && (
        <VerificationChecklist model={model} onClose={() => setShowVerification(false)} />
      )}
      {showSettings && (
        <SettingsPanel model={model} dispatch={dispatch} onClose={() => setShowSettings(false)} />
      )}
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

function loadExample(file = "coffee-making.opmodel"): Promise<Model> {
  return fetch(`/${file}`)
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

  const handleLoadExample = useCallback((file: string) => {
    loadExample(file)
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

  return <ErrorBoundary><Editor key={editorKey} initialModel={initialModel} onNew={handleNew} onLoadExample={handleLoadExample} onImport={handleImport} /></ErrorBoundary>;
}
