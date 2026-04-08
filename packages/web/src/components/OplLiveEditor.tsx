import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { Model } from "@opmodel/core";
import { renderAll, parseOplDocuments, compileToKernel, legacyModelFromSemanticKernel, exposeSemanticKernel, validateOpl } from "@opmodel/core";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Autocomplete state
  const [acVisible, setAcVisible] = useState(false);
  const [acItems, setAcItems] = useState<string[]>([]);
  const [acIndex, setAcIndex] = useState(0);
  const [acPos, setAcPos] = useState({ top: 0, left: 0 });
  const [acPrefix, setAcPrefix] = useState("");

  // Build vocabulary from model
  const vocabulary = useMemo(() => {
    const names: string[] = [];
    for (const t of model.things.values()) names.push(t.name);
    for (const s of model.states.values()) names.push(s.name);
    return [...new Set(names)].sort();
  }, [model]);

  // Sync text when model changes externally
  useEffect(() => {
    const newText = renderAll(model);
    if (status === "idle") setText(newText);
  }, [model, status]);

  // Sync line numbers scroll
  const syncScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const lineCount = text.split("\n").length;

  // Get word being typed at cursor
  const getWordAtCursor = useCallback((): { word: string; start: number; end: number } | null => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const pos = ta.selectionStart;
    const before = text.substring(0, pos);
    // Find word boundary (letters, digits, spaces in names, hyphens)
    const match = before.match(/[A-Za-z][\w\s-]*$/);
    if (!match) return null;
    return { word: match[0], start: pos - match[0].length, end: pos };
  }, [text]);

  const updateAutocomplete = useCallback(() => {
    const wordInfo = getWordAtCursor();
    if (!wordInfo || wordInfo.word.length < 2) {
      setAcVisible(false);
      return;
    }
    const prefix = wordInfo.word.toLowerCase();
    const matches = vocabulary.filter(name =>
      name.toLowerCase().startsWith(prefix) && name.toLowerCase() !== prefix
    ).slice(0, 8);
    if (matches.length === 0) {
      setAcVisible(false);
      return;
    }
    setAcItems(matches);
    setAcPrefix(wordInfo.word);
    setAcIndex(0);
    // Position near cursor
    const ta = textareaRef.current;
    if (ta) {
      const rect = ta.getBoundingClientRect();
      // Approximate position from text content
      const lines = text.substring(0, ta.selectionStart).split("\n");
      const lineIdx = lines.length - 1;
      const lineHeight = 16;
      setAcPos({
        top: rect.top + (lineIdx * lineHeight) - ta.scrollTop + lineHeight + 4,
        left: rect.left + 8,
      });
    }
    setAcVisible(true);
  }, [getWordAtCursor, vocabulary, text]);

  const applyAutocomplete = useCallback((name: string) => {
    const wordInfo = getWordAtCursor();
    if (!wordInfo) return;
    const newText = text.substring(0, wordInfo.start) + name + text.substring(wordInfo.end);
    setText(newText);
    setAcVisible(false);
    setStatus("dirty");
    // Restore cursor position
    const newPos = wordInfo.start + name.length;
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    });
  }, [text, getWordAtCursor]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setStatus("dirty");
    setErrorMsg(null);

    if (!e.target.value.trim()) return;
    const result = validateOpl(e.target.value);
    setValidationResult(result);
    setStatus(result.ok ? "valid" : "error");
  }, []);

  // Trigger autocomplete after change
  useEffect(() => {
    if (status !== "idle") {
      const timer = setTimeout(updateAutocomplete, 150);
      return () => clearTimeout(timer);
    }
  }, [text, status, updateAutocomplete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (acVisible) {
      if (e.key === "ArrowDown") { e.preventDefault(); setAcIndex(i => Math.min(i + 1, acItems.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setAcIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        if (acItems[acIndex]) { e.preventDefault(); applyAutocomplete(acItems[acIndex]); return; }
      }
      if (e.key === "Escape") { e.preventDefault(); setAcVisible(false); return; }
    }
    // Tab inserts 2 spaces
    if (e.key === "Tab" && !acVisible) {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newText = text.substring(0, start) + "  " + text.substring(end);
      setText(newText);
      setStatus("dirty");
      requestAnimationFrame(() => { ta.setSelectionRange(start + 2, start + 2); });
    }
  }, [acVisible, acItems, acIndex, applyAutocomplete, text]);

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
      setAcVisible(false);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [dispatch, model]);

  // Ctrl+S / Cmd+S to apply
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleApply();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [handleApply]);

  const statusColor = status === "valid" ? "#5cb85c" : status === "error" ? "#d9534f" : status === "dirty" ? "#f0ad4e" : "#666";
  const statusText = status === "idle" ? "Synced" : status === "dirty" ? "Modified (Ctrl+S to apply)" : status === "valid" ? "Valid — press Apply" : "Error";

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

      {/* Editor with line numbers */}
      <div className="opl-editor-wrapper" style={{ flex: 1, display: "flex", minHeight: 200, position: "relative" }}>
        <div
          ref={lineNumbersRef}
          className="opl-line-numbers"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="opl-line-number">{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="code-editor opl-editor-textarea"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          style={{ flex: 1, paddingLeft: 4 }}
        />
        {/* Autocomplete dropdown */}
        {acVisible && acItems.length > 0 && (
          <div
            className="opl-autocomplete"
            style={{ position: "fixed", top: acPos.top, left: acPos.left }}
          >
            {acItems.map((item, i) => (
              <div
                key={item}
                className={`opl-autocomplete__item${i === acIndex ? " opl-autocomplete__item--active" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); applyAutocomplete(item); }}
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>

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
