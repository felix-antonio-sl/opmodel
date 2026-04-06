import { useState, useEffect, useRef, useCallback } from "react";
import type { Model, ValidationResult } from "@opmodel/core";
import { validateOpl, parseOplDocuments, compileOplDocuments } from "@opmodel/core";

interface OplImportPanelProps {
  onClose: () => void;
  onApply: (model: Model) => void;
}

export function OplImportPanel({ onClose, onApply }: OplImportPanelProps) {
  const [text, setText] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedValidate = useCallback((t: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!t.trim()) {
      setValidation(null);
      return;
    }
    timerRef.current = setTimeout(() => {
      const result = validateOpl(t);
      setValidation(result);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const t = e.target.value;
    setText(t);
    setApplyError(null);
    debouncedValidate(t);
  };

  const handleApply = () => {
    if (!text.trim()) return;
    try {
      const parsed = parseOplDocuments(text);
      if (!parsed.ok) {
        setApplyError(`Parse error: ${parsed.error.message}`);
        return;
      }
      const compiled = compileOplDocuments(parsed.value, { ignoreUnsupported: true });
      if (!compiled.ok) {
        setApplyError(`Compile error: ${compiled.error.message}`);
        return;
      }
      onApply(compiled.value);
      onClose();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : String(e));
    }
  };

  const canApply = validation && validation.ok && text.trim().length > 0;

  const statusColor = !validation
    ? "#666"
    : validation.ok
      ? validation.issues.length > 0
        ? "#f0ad4e"
        : "#5cb85c"
      : "#d9534f";

  const statusText = !validation
    ? "Type or paste OPL text…"
    : validation.ok
      ? validation.issues.length > 0
        ? `⚠ ${validation.issues.length} warning${validation.issues.length > 1 ? "s" : ""} (canonical)`
        : "✓ All checks passed (V1–V3)"
      : `✗ ${validation.issues.filter(i => i.severity === "error").length} error(s)`;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      width: 620,
      height: "100vh",
      background: "#1a1a2e",
      borderLeft: "1px solid #333",
      display: "flex",
      flexDirection: "column",
      zIndex: 1000,
      padding: 16,
      boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, color: "#eee", fontSize: 16 }}>Import OPL</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      <textarea
        value={text}
        onChange={handleTextChange}
        placeholder={"Coffee Making is a process, physical.\nWater is an object, physical.\nBarista handles Coffee Making."}
        spellCheck={false}
        style={{
          flex: 1,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          lineHeight: 1.5,
          background: "#0d0d1a",
          color: "#ddd",
          border: "1px solid #333",
          borderRadius: 4,
          padding: 12,
          resize: "none",
          outline: "none",
          minHeight: 300,
        }}
      />

      {/* Validation status bar */}
      <div style={{
        marginTop: 8,
        padding: "8px 12px",
        background: "#0d0d1a",
        border: "1px solid #333",
        borderRadius: 4,
        color: statusColor,
        fontSize: 13,
        fontFamily: "monospace",
      }}>
        <div>{statusText}</div>
        {validation && validation.issues.length > 0 && (
          <div style={{ marginTop: 4, maxHeight: 120, overflowY: "auto", fontSize: 12 }}>
            {validation.issues.map((issue, i) => (
              <div key={i} style={{ color: issue.severity === "error" ? "#d9534f" : "#f0ad4e", padding: "2px 0" }}>
                {issue.line != null && <span style={{ color: "#888" }}>L{issue.line}: </span>}
                <span style={{ color: "#666" }}>[{issue.phase}]</span> {issue.message}
              </div>
            ))}
          </div>
        )}
        {applyError && (
          <div style={{ color: "#d9534f", marginTop: 4, fontSize: 12 }}>{applyError}</div>
        )}
      </div>

      {/* Phase indicators */}
      {validation && (
        <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 11 }}>
          {(["syntax", "binding", "semantic", "canonical"] as const).map(phase => {
            const s = validation.phases[phase];
            const color = s === "pass" ? "#5cb85c" : s === "fail" ? "#d9534f" : "#666";
            return <span key={phase} style={{ color, fontFamily: "monospace" }}>{phase}: {s}</span>;
          })}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={handleApply}
          disabled={!canApply}
          style={{
            flex: 1,
            padding: "8px 16px",
            background: canApply ? "#5cb85c" : "#333",
            color: canApply ? "#fff" : "#666",
            border: "none",
            borderRadius: 4,
            cursor: canApply ? "pointer" : "not-allowed",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Apply
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 0,
            padding: "8px 16px",
            background: "#333",
            color: "#999",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
