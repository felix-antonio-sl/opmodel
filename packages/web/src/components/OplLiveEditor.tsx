import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { Model, ValidationIssue } from "@opmodel/core";
import { renderAll, parseOplDocuments, compileToKernel, legacyModelFromSemanticKernel, exposeSemanticKernel, validateOpl } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { findOpdIdByName, findSentenceForSelection, findThingIdByName, lineColumnToOffset, parseSentenceRefs } from "../lib/opl-navigation";

interface Props {
  model: Model;
  opdId: string;
  selectedThing?: string | null;
  selectedLink?: string | null;
  dispatch: (cmd: Command) => boolean;
}

function issueKey(issue: ValidationIssue, index: number) {
  return `${index}:${issue.phase}:${issue.line ?? 0}:${issue.column ?? 0}:${issue.message}`;
}

export function OplLiveEditor({ model, opdId, selectedThing, selectedLink, dispatch }: Props) {
  const initialText = renderAll(model);
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<"idle" | "dirty" | "valid" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateOpl> | null>(null);
  const [activeIssueKey, setActiveIssueKey] = useState<string | null>(null);
  const textRef = useRef(text);
  textRef.current = text;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const [acVisible, setAcVisible] = useState(false);
  const [acItems, setAcItems] = useState<string[]>([]);
  const [acIndex, setAcIndex] = useState(0);
  const [acPos, setAcPos] = useState({ top: 0, left: 0 });

  const vocabulary = useMemo(() => {
    const names: string[] = [];
    for (const t of model.things.values()) names.push(t.name);
    for (const s of model.states.values()) names.push(s.name);
    return [...new Set(names)].sort();
  }, [model]);

  useEffect(() => {
    const newText = renderAll(model);
    if (status === "idle") setText(newText);
  }, [model, status]);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const lineCount = text.split("\n").length;
  const currentOpdName = model.opds.get(opdId)?.name ?? "SD";
  const sentenceRefs = useMemo(() => parseSentenceRefs(text, currentOpdName), [text, currentOpdName]);

  const activeSentenceRef = useMemo(
    () => findSentenceForSelection(sentenceRefs, model, selectedThing ?? null, selectedLink ?? null, opdId),
    [sentenceRefs, model, selectedThing, selectedLink, opdId],
  );

  const activeSentenceText = useMemo(() => {
    if (!activeSentenceRef) return null;
    const lines = text.split("\n");
    return lines.slice(activeSentenceRef.span.line - 1, activeSentenceRef.span.endLine).join("\n").trim() || null;
  }, [activeSentenceRef, text]);

  const issueCounts = useMemo(() => {
    const issues = validationResult?.issues ?? [];
    return {
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
    };
  }, [validationResult]);

  const lineIssueSeverity = useMemo(() => {
    const map = new Map<number, "error" | "warning">();
    for (const issue of validationResult?.issues ?? []) {
      if (issue.line == null) continue;
      const prev = map.get(issue.line);
      if (!prev || issue.severity === "error") map.set(issue.line, issue.severity);
    }
    return map;
  }, [validationResult]);

  const focusIssue = useCallback((issue: ValidationIssue, key?: string | null) => {
    if (key) setActiveIssueKey(key);

    const opdMatch = findOpdIdByName(model, issue.opdName);
    if (opdMatch && opdMatch !== opdId) dispatch({ tag: "selectOpd", opdId: opdMatch });

    const thingMatch = findThingIdByName(model, issue.focusThingName);
    if (thingMatch) dispatch({ tag: "selectThing", thingId: thingMatch });

    const start = lineColumnToOffset(textRef.current, issue.line, issue.column);
    const end = lineColumnToOffset(textRef.current, issue.endLine ?? issue.line, issue.endColumn ?? issue.column);
    if (start == null) return;

    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start, end != null && end > start ? end : start);
      const lineIndex = Math.max(0, (issue.line ?? 1) - 1);
      const lineHeight = 16;
      const targetScroll = Math.max(0, lineIndex * lineHeight - ta.clientHeight / 3);
      ta.scrollTop = targetScroll;
      if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = targetScroll;
    });
  }, [dispatch, model, opdId]);

  const revealSelection = useCallback((thingId?: string | null, linkId?: string | null) => {
    const match = findSentenceForSelection(sentenceRefs, model, thingId, linkId, opdId);
    if (!match) return;
    const targetOpdId = findOpdIdByName(model, match.doc.opdName);
    if (targetOpdId && targetOpdId !== opdId) dispatch({ tag: "selectOpd", opdId: targetOpdId });
    const start = lineColumnToOffset(textRef.current, match.span.line, match.span.column);
    const end = lineColumnToOffset(textRef.current, match.span.endLine, match.span.endColumn);
    if (start == null) return;
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start, end != null && end > start ? end : start);
      const lineIndex = Math.max(0, match.span.line - 1);
      const lineHeight = 16;
      const targetScroll = Math.max(0, lineIndex * lineHeight - ta.clientHeight / 3);
      ta.scrollTop = targetScroll;
      if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = targetScroll;
    });
  }, [dispatch, model, opdId, sentenceRefs]);

  const getWordAtCursor = useCallback((): { word: string; start: number; end: number } | null => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const pos = ta.selectionStart;
    const before = text.substring(0, pos);
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
    const matches = vocabulary.filter((name) =>
      name.toLowerCase().startsWith(prefix) && name.toLowerCase() !== prefix,
    ).slice(0, 8);
    if (matches.length === 0) {
      setAcVisible(false);
      return;
    }
    setAcItems(matches);
    setAcIndex(0);
    const ta = textareaRef.current;
    if (ta) {
      const rect = ta.getBoundingClientRect();
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
    const newPos = wordInfo.start + name.length;
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    });
  }, [text, getWordAtCursor]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = e.target.value;
    setText(nextText);
    setStatus("dirty");
    setErrorMsg(null);
    setActiveIssueKey(null);

    if (!nextText.trim()) {
      setValidationResult(null);
      return;
    }

    const result = validateOpl(nextText);
    setValidationResult(result);
    setStatus(result.ok ? "valid" : "error");
  }, []);

  useEffect(() => {
    if (status !== "idle") {
      const timer = setTimeout(updateAutocomplete, 150);
      return () => clearTimeout(timer);
    }
  }, [text, status, updateAutocomplete]);

  useEffect(() => {
    if (!selectedThing && !selectedLink) return;
    if (status === "error") return;
    revealSelection(selectedThing, selectedLink);
  }, [selectedThing, selectedLink, revealSelection, status]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (acVisible) {
      if (e.key === "ArrowDown") { e.preventDefault(); setAcIndex((i) => Math.min(i + 1, acItems.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setAcIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        if (acItems[acIndex]) { e.preventDefault(); applyAutocomplete(acItems[acIndex]!); return; }
      }
      if (e.key === "Escape") { e.preventDefault(); setAcVisible(false); return; }
    }
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

    const validation = validateOpl(t);
    setValidationResult(validation);
    if (!validation.ok) {
      setStatus("error");
      setErrorMsg("Fix the highlighted OPL issues before applying.");
      const firstError = validation.issues.find((issue) => issue.severity === "error") ?? validation.issues[0];
      if (firstError) focusIssue(firstError);
      return;
    }

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
        if (thing) layoutHints.set(thing.name, { x: app.x, y: app.y, w: app.w, h: app.h });
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
      setValidationResult(null);
      setActiveIssueKey(null);
      setAcVisible(false);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [dispatch, focusIssue, model]);

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
  const statusText = status === "idle"
    ? "Synced"
    : status === "dirty"
      ? "Modified (Ctrl+S to apply)"
      : status === "valid"
        ? "Valid, ready to apply"
        : "Issues found";

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

      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-muted)", marginBottom: 6, flexWrap: "wrap" }}>
        <span>Click an issue to jump to the exact source span.</span>
        {validationResult && validationResult.issues.length > 0 && (
          <span>
            {issueCounts.errors} error(s), {issueCounts.warnings} warning(s)
          </span>
        )}
      </div>

      {activeSentenceRef && activeSentenceText && (
        <div
          className="opl-editor-focus-card"
          style={{
            marginBottom: 8,
            padding: "8px 10px",
            border: "1px solid rgba(124, 92, 255, 0.35)",
            background: "rgba(124, 92, 255, 0.07)",
            borderRadius: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(124, 92, 255, 0.95)", fontWeight: 700 }}>
              Current focus
            </div>
            <button
              type="button"
              onClick={() => revealSelection(selectedThing, selectedLink)}
              style={{
                border: "1px solid var(--border)",
                background: "var(--bg-panel)",
                color: "var(--text-secondary)",
                borderRadius: 4,
                fontSize: 11,
                padding: "2px 6px",
                cursor: "pointer",
              }}
            >
              Reveal
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}>
            {activeSentenceText}
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)" }}>
            L{activeSentenceRef.span.line}:{activeSentenceRef.span.column}
            {activeSentenceRef.doc.opdName ? ` • ${activeSentenceRef.doc.opdName}` : ""}
          </div>
        </div>
      )}

      <div className="opl-editor-wrapper" style={{ flex: 1, display: "flex", minHeight: 200, position: "relative" }}>
        <div ref={lineNumbersRef} className="opl-line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => {
            const lineNumber = i + 1;
            const severity = lineIssueSeverity.get(lineNumber);
            const isActiveLine = activeSentenceRef && lineNumber >= activeSentenceRef.span.line && lineNumber <= activeSentenceRef.span.endLine;
            return (
              <div
                key={i}
                className={`opl-line-number${isActiveLine ? " opl-line-number--active" : ""}`}
                style={{
                  color: severity === "error" ? "#d9534f" : severity === "warning" ? "#f0ad4e" : isActiveLine ? "rgba(124, 92, 255, 0.95)" : undefined,
                  fontWeight: severity || isActiveLine ? 700 : undefined,
                }}
              >
                {lineNumber}
              </div>
            );
          })}
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
        {acVisible && acItems.length > 0 && (
          <div className="opl-autocomplete" style={{ position: "fixed", top: acPos.top, left: acPos.left }}>
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
        <div style={{ color: "#d9534f", fontSize: 11, fontFamily: "monospace", marginTop: 4 }}>
          {errorMsg}
        </div>
      )}

      {validationResult && validationResult.issues.length > 0 && status !== "idle" && (
        <div style={{ maxHeight: 140, overflowY: "auto", marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {validationResult.issues.slice(0, 8).map((issue, i) => {
            const key = issueKey(issue, i);
            const active = activeIssueKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => focusIssue(issue, key)}
                style={{
                  textAlign: "left",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "rgba(124, 92, 255, 0.08)" : "var(--bg-panel)",
                  color: issue.severity === "error" ? "#f38b8b" : "#f3c96b",
                  borderRadius: 4,
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
                title="Jump to source"
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 2, color: "var(--text-muted)" }}>
                  <span>{issue.phase}</span>
                  {issue.code && <span>{issue.code}</span>}
                  {issue.opdName && <span>{issue.opdName}</span>}
                  {issue.line != null && <span>L{issue.line}:{issue.column ?? 1}</span>}
                </div>
                <div>{issue.message}</div>
              </button>
            );
          })}
          {validationResult.issues.length > 8 && (
            <div style={{ color: "#666", fontSize: 10 }}>...+{validationResult.issues.length - 8} more</div>
          )}
        </div>
      )}
    </div>
  );
}
