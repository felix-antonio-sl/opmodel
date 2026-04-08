import { useState, useCallback, useRef, useEffect } from "react";
import type { Model } from "@opmodel/core";
import { expose, renderAll, parseOplDocuments, compileToKernel, legacyModelFromSemanticKernel, exposeSemanticKernel, validateOpl } from "@opmodel/core";
import type { Command } from "../lib/commands";

interface Props {
  model: Model;
  opdId: string;
  dispatch: (cmd: Command) => boolean;
}

export function OplLiveEditor({ model, opdId, dispatch }: Props) {
  const initialText = renderAll(model);
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<"idle" | "dirty" | "valid" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateOpl> | null>(null);
  const textRef = useRef(text);
  textRef.current = text;

  // Sync text when model changes externally
  useEffect(() => {
    const newText = renderAll(model);
    // Only sync if the user hasn't edited
    if (status === "idle") {
      setText(newText);
    }
  }, [model, status]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setStatus("dirty");
    setErrorMsg(null);

    // Quick validation on change
    if (!e.target.value.trim()) return;
    const result = validateOpl(e.target.value);
    setValidationResult(result);
    setStatus(result.ok ? "valid" : "error");
  }, []);

  const handleApply = useCallback(() => {
    const t = textRef.current;
    if (!t.trim()) return;

    try {
      const parsed = parseOplDocuments(t);
      if (!parsed.ok) {
        setErrorMsg(`Parse: ${parsed.error.message}`);
        setStatus("error");
        return;
      }
      // Build layout hints from current model (by thing name)
      const layoutHints = new Map<string, { x: number; y: number; w: number; h: number }>();
      for (const [, app] of model.appearances) {
        const thing = model.things.get(app.thing);
        if (thing) {
          layoutHints.set(thing.name, { x: app.x, y: app.y, w: app.w, h: app.h });
        }
      }
      const compiled = compileToKernel(parsed.value, {
        ignoreUnsupported: true,
        preserveLayout: model.appearances,
        layoutHints,
      });
      if (!compiled.ok) {
        setErrorMsg(`Compile: ${compiled.error.message}`);
        setStatus("error");
        return;
      }
      const kernel = compiled.value;
      const atlas = exposeSemanticKernel(kernel);
      dispatch({ tag: "importOpl", model: legacyModelFromSemanticKernel(kernel, atlas) });
      setStatus("idle");
      setErrorMsg(null);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [dispatch]);

  // Ctrl+S / Cmd+S to apply
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleApply();
      }
    };
    window.addEventListener("keydown", handler, true);  // capture phase
    return () => window.removeEventListener("keydown", handler, true);
  }, [handleApply]);

  const statusColor = status === "valid" ? "#5cb85c" : status === "error" ? "#d9534f" : status === "dirty" ? "#f0ad4e" : "#666";
  const statusText = status === "idle" ? "Synced" : status === "dirty" ? "Modified (Ctrl+S to apply)" : status === "valid" ? "✓ Valid — press Apply" : "✗ Error";

  return (
    <div className="opl-panel__content" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ color: statusColor }} className="opl-status-bar__text">{statusText}</span>
        <button
          onClick={handleApply}
          disabled={status === "idle"}
          style={{
            padding: "4px 12px",
            background: status === "idle" ? "var(--bg-active)" : "var(--success)",
            color: status === "idle" ? "var(--text-muted)" : "#fff",
            border: "none",
            borderRadius: 3,
            cursor: status === "idle" ? "default" : "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Apply
        </button>
      </div>

      <textarea
        className="code-editor"
        value={text}
        onChange={handleChange}
        spellCheck={false}
        style={{ flex: 1, minHeight: 200 }}
      />

      {errorMsg && (
        <div style={{ color: "#d9534f", fontSize: 11, fontFamily: "monospace", marginTop: 4, maxHeight: 60, overflowY: "auto" }}>
          {errorMsg}
        </div>
      )}

      {validationResult && validationResult.issues.length > 0 && status !== "idle" && (
        <div style={{ maxHeight: 80, overflowY: "auto", marginTop: 4 }}>
          {validationResult.issues.slice(0, 5).map((issue, i) => (
            <div key={i} style={{ color: issue.severity === "error" ? "#d9534f" : "#f0ad4e", fontSize: 10, fontFamily: "monospace" }}>
              {issue.line != null && <span style={{ color: "#888" }}>L{issue.line}: </span>}
              {issue.message}
            </div>
          ))}
          {validationResult.issues.length > 5 && (
            <div style={{ color: "#666", fontSize: 10 }}>...+{validationResult.issues.length - 5} more</div>
          )}
        </div>
      )}
    </div>
  );
}
