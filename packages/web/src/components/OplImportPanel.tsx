import { useState, useEffect, useRef, useCallback } from "react";
import type { Model, ValidationResult } from "@opmodel/core";
import { validateOpl, parseOplDocuments, compileToKernel, legacyModelFromSemanticKernel, exposeSemanticKernel } from "@opmodel/core";

interface OplImportPanelProps {
  model: Model;
  onClose: () => void;
  onApply: (model: Model) => void;
}

export function OplImportPanel({ model, onClose, onApply }: OplImportPanelProps) {
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
        setApplyError(`Compile error: ${compiled.error.message}`);
        return;
      }
      const kernel = compiled.value;
      const atlas = exposeSemanticKernel(kernel);
      onApply(legacyModelFromSemanticKernel(kernel, atlas));
      onClose();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : String(e));
    }
  };

  const canApply = validation && validation.ok && text.trim().length > 0;

  const statusColor = !validation
    ? "var(--text-muted)"
    : validation.ok
      ? validation.issues.length > 0
        ? "var(--warning)"
        : "var(--success)"
      : "var(--error)";

  const statusText = !validation
    ? "Type or paste OPL text…"
    : validation.ok
      ? validation.issues.length > 0
        ? `⚠ ${validation.issues.length} warning${validation.issues.length > 1 ? "s" : ""} (canonical)`
        : "✓ All checks passed (V1–V3)"
      : `✗ ${validation.issues.filter(i => i.severity === "error").length} error(s)`;

  return (
    <div className="opl-import-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, color: "var(--code-text)", fontSize: 16 }}>Import OPL</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      <textarea
        className="code-editor"
        value={text}
        onChange={handleTextChange}
        placeholder={"Coffee Making is a process, physical.\nWater is an object, physical.\nBarista handles Coffee Making."}
        spellCheck={false}
        style={{ flex: 1, fontSize: 13, minHeight: 300 }}
      />

      {/* Validation status bar */}
      <div className="opl-status-bar" style={{ color: statusColor }}>
        <div>{statusText}</div>
        {validation && validation.issues.length > 0 && (
          <div style={{ marginTop: 4, maxHeight: 120, overflowY: "auto", fontSize: 12 }}>
            {validation.issues.map((issue, i) => (
              <div key={i} style={{ color: issue.severity === "error" ? "var(--error)" : "var(--warning)", padding: "2px 0" }}>
                {issue.line != null && <span style={{ color: "var(--text-muted)" }}>L{issue.line}: </span>}
                <span style={{ color: "var(--text-muted)" }}>[{issue.phase}]</span> {issue.message}
              </div>
            ))}
          </div>
        )}
        {applyError && (
          <div style={{ color: "var(--error)", marginTop: 4, fontSize: 12 }}>{applyError}</div>
        )}
      </div>

      {/* Phase indicators */}
      {validation && (
        <div className="opl-status-bar__phases">
          {(["syntax", "binding", "semantic", "canonical"] as const).map(phase => {
            const s = validation.phases[phase];
            const color = s === "pass" ? "var(--success)" : s === "fail" ? "var(--error)" : "var(--text-muted)";
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
            background: canApply ? "var(--success)" : "var(--code-border)",
            color: canApply ? "#fff" : "var(--text-muted)",
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
            background: "var(--text-primary)",
            color: "var(--text-muted)",
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
