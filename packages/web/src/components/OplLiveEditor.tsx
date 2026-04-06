import { useState, useCallback, useRef, useEffect } from "react";
import type { Model } from "@opmodel/core";
import { expose, renderAll, parseOplDocuments, compileOplDocuments, validateOpl } from "@opmodel/core";
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
      const compiled = compileOplDocuments(parsed.value, { ignoreUnsupported: true });
      if (!compiled.ok) {
        setErrorMsg(`Compile: ${compiled.error.message}`);
        setStatus("error");
        return;
      }
      dispatch({ tag: "importOpl", model: compiled.value });
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
        handleApply();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleApply]);

  const statusColor = status === "valid" ? "#5cb85c" : status === "error" ? "#d9534f" : status === "dirty" ? "#f0ad4e" : "#666";
  const statusText = status === "idle" ? "Synced" : status === "dirty" ? "Modified (Ctrl+S to apply)" : status === "valid" ? "✓ Valid — press Apply" : "✗ Error";

  return (
    <div className="opl-panel__content" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ color: statusColor, fontSize: 11, fontFamily: "monospace" }}>{statusText}</span>
        <button
          onClick={handleApply}
          disabled={status === "idle"}
          style={{
            padding: "4px 12px",
            background: status === "idle" ? "#333" : "#5cb85c",
            color: status === "idle" ? "#666" : "#fff",
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
        value={text}
        onChange={handleChange}
        spellCheck={false}
        style={{
          flex: 1,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 11,
          lineHeight: 1.6,
          background: "#0d0d1a",
          color: "#ddd",
          border: "1px solid #333",
          borderRadius: 4,
          padding: 10,
          resize: "none",
          outline: "none",
          minHeight: 200,
        }}
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
