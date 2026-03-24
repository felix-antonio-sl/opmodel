import { useState, useEffect, useRef, useCallback } from "react";
import type { Model, InvariantError } from "@opmodel/core";

interface BugReport {
  id: string;
  created_at: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description?: string;
  opd_id: string;
  opd_name: string;
  selected_thing?: string;
  selected_thing_name?: string;
  validation_errors: number;
  model_stats: string;
  screenshot?: string;
  url: string;
  viewport: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#e53e3e",
  HIGH: "#dd6b20",
  MEDIUM: "#3182ce",
  LOW: "#38a169",
};

async function loadBugsFromServer(): Promise<BugReport[]> {
  try {
    const res = await fetch("/api/dev/bugs");
    return res.ok ? await res.json() : [];
  } catch { return []; }
}

async function saveBugToServer(bug: BugReport): Promise<void> {
  await fetch("/api/dev/bugs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bug),
  });
}

async function deleteBugFromServer(id: string): Promise<void> {
  await fetch(`/api/dev/bugs/${id}`, { method: "DELETE" });
}

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  errors: InvariantError[];
}

export function BugCapture({ model, opdId, selectedThing, errors }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"form" | "list">("form");
  const [bugs, setBugs] = useState<BugReport[]>([]);

  // Load bugs from server on mount
  useEffect(() => { loadBugsFromServer().then(setBugs); }, []);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<BugReport["severity"]>("MEDIUM");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  // Clipboard paste for screenshots
  useEffect(() => {
    if (!open || view !== "form") return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => setScreenshot(reader.result as string);
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [open, view]);

  const opd = model.opds.get(opdId);
  const thing = selectedThing ? model.things.get(selectedThing) : null;

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    const bug: BugReport = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      title: title.trim(),
      severity,
      description: description.trim() || undefined,
      opd_id: opdId,
      opd_name: opd?.name ?? opdId,
      selected_thing: selectedThing ?? undefined,
      selected_thing_name: thing?.name,
      validation_errors: errors.length,
      model_stats: `${model.things.size}T ${model.states.size}S ${model.links.size}L ${model.opds.size}O`,
      screenshot,
      url: window.location.href,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    };
    const updated = [bug, ...bugs];
    setBugs(updated);
    saveBugToServer(bug);
    setTitle("");
    setDescription("");
    setScreenshot(undefined);
    setSeverity("MEDIUM");
    setOpen(false);
  }, [title, severity, description, screenshot, opdId, opd, selectedThing, thing, errors, model, bugs]);

  const handleDelete = (id: string) => {
    const updated = bugs.filter(b => b.id !== id);
    setBugs(updated);
    deleteBugFromServer(id);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(bugs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opmodel-bugs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* FAB */}
      <button
        className="bug-fab"
        onClick={() => { setOpen(o => !o); setView("form"); }}
        title="Bug Capture"
      >
        {bugs.length > 0 && <span className="bug-fab__count">{bugs.length}</span>}
        <span style={{ fontSize: 18 }}>B</span>
      </button>

      {/* Drawer */}
      {open && (
        <div className="bug-drawer">
          <div className="bug-drawer__header">
            <div className="bug-drawer__tabs">
              <button className={`bug-tab${view === "form" ? " bug-tab--active" : ""}`} onClick={() => setView("form")}>Report</button>
              <button className={`bug-tab${view === "list" ? " bug-tab--active" : ""}`} onClick={() => setView("list")}>Bugs ({bugs.length})</button>
            </div>
            <button className="bug-drawer__close" onClick={() => setOpen(false)}>x</button>
          </div>

          {view === "form" ? (
            <div className="bug-drawer__form">
              {/* Auto context */}
              <div className="bug-context">
                <span>OPD: {opd?.name ?? opdId}</span>
                {thing && <span>Thing: {thing.name}</span>}
                <span>Errors: {errors.length}</span>
                <span>{model.things.size}T {model.links.size}L {model.opds.size}O</span>
              </div>

              <input
                className="bug-input"
                placeholder="Bug title *"
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleSubmit(); }}
              />

              <div className="bug-severity">
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(s => (
                  <button
                    key={s}
                    className={`bug-sev-btn${severity === s ? " bug-sev-btn--active" : ""}`}
                    style={{ "--sev-color": SEVERITY_COLORS[s] } as React.CSSProperties}
                    onClick={() => setSeverity(s)}
                  >{s}</button>
                ))}
              </div>

              <textarea
                className="bug-textarea"
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />

              {/* Screenshot */}
              <div
                className="bug-screenshot-zone"
                onClick={() => fileRef.current?.click()}
              >
                {screenshot ? (
                  <div className="bug-screenshot-preview">
                    <img src={screenshot} alt="screenshot" />
                    <button className="bug-screenshot-remove" onClick={e => { e.stopPropagation(); setScreenshot(undefined); }}>x</button>
                  </div>
                ) : (
                  <span className="bug-screenshot-hint">Paste screenshot (Cmd+V) or click to upload</span>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} />
              </div>

              <button
                className="bug-submit"
                disabled={!title.trim()}
                onClick={handleSubmit}
              >Submit Bug</button>
            </div>
          ) : (
            <div className="bug-drawer__list">
              {bugs.length === 0 ? (
                <div className="bug-empty">No bugs captured</div>
              ) : (
                <>
                  <div className="bug-list-actions">
                    <button className="bug-export-btn" onClick={handleExport}>Export JSON</button>
                  </div>
                  {bugs.map(bug => (
                    <div key={bug.id} className="bug-card">
                      <div className="bug-card__header">
                        <span className="bug-card__sev" style={{ background: SEVERITY_COLORS[bug.severity] }}>{bug.severity}</span>
                        <span className="bug-card__title">{bug.title}</span>
                        <button className="bug-card__delete" onClick={() => handleDelete(bug.id)}>x</button>
                      </div>
                      <div className="bug-card__meta">
                        <span>{bug.opd_name}</span>
                        {bug.selected_thing_name && <span>{bug.selected_thing_name}</span>}
                        <span>{new Date(bug.created_at).toLocaleString()}</span>
                      </div>
                      {bug.description && <div className="bug-card__desc">{bug.description}</div>}
                      {bug.screenshot && <img className="bug-card__img" src={bug.screenshot} alt="" />}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
