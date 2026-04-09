import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { Model, ValidationIssue } from "@opmodel/core";
import { renderAll, parseOplDocuments, compileToKernel, legacyModelFromSemanticKernel, exposeSemanticKernel, validateOpl, semanticKernelFromModel, exposeFromKernel, render } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { findOpdIdByName, findSentenceForSelection, findThingIdByName, lineColumnToOffset } from "../lib/opl-navigation";
import { useAutocomplete } from "../hooks/useAutocomplete";
import { useOplContext } from "../hooks/useOplContext";
import { OplAutocomplete } from "./OplAutocomplete";
import { OplContextCard } from "./OplContextCard";

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

function renderOplText(model: Model, opdId: string, showAll: boolean): string {
  if (showAll) return renderAll(model);
  const kernel = semanticKernelFromModel(model);
  const atlas = exposeSemanticKernel(kernel);
  const doc = exposeFromKernel(kernel, atlas, opdId);
  return render(doc);
}

export function OplLiveEditor({ model, opdId, selectedThing, selectedLink, dispatch }: Props) {
  const [showAll, setShowAll] = useState(true);
  const initialText = renderOplText(model, opdId, showAll);
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<"idle" | "dirty" | "valid" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateOpl> | null>(null);
  const [activeIssueKey, setActiveIssueKey] = useState<string | null>(null);
  const textRef = useRef(text);
  textRef.current = text;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const vocabulary = useMemo(() => {
    const names: string[] = [];
    for (const t of model.things.values()) names.push(t.name);
    for (const s of model.states.values()) names.push(s.name);
    return [...new Set(names)].sort();
  }, [model]);

  const handleAutocompleteTextChange = useCallback((newText: string) => {
    setText(newText);
    setStatus("dirty");
  }, []);

  const ac = useAutocomplete({
    text,
    textareaRef,
    vocabulary,
    onTextChange: handleAutocompleteTextChange,
  });

  useEffect(() => {
    const newText = renderOplText(model, opdId, showAll);
    if (status === "idle") setText(newText);
  }, [model, status, opdId, showAll]);

  const handleToggleScope = useCallback(() => {
    const nextShowAll = !showAll;
    if (status === "dirty" || status === "error") {
      setText(renderOplText(model, opdId, nextShowAll));
      setStatus("idle");
      setErrorMsg(null);
      setValidationResult(null);
      setActiveIssueKey(null);
      ac.setAcVisible(false);
    }
    setShowAll(nextShowAll);
  }, [showAll, status, model, opdId, ac]);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const lineCount = text.split("\n").length;
  const { sentenceRefs, activeSentenceRef, activeSentenceText, relatedSentenceRefs } = useOplContext({
    model,
    opdId,
    text,
    selectedThing,
    selectedLink,
  });
  const [contextIndex, setContextIndex] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    setContextIndex(0);
  }, [text, opdId, selectedThing, selectedLink]);
  const displayedSentenceRef = relatedSentenceRefs[contextIndex] ?? activeSentenceRef;
  const displayedSentenceText = useMemo(
    () => (displayedSentenceRef ? text.split("\n").slice(displayedSentenceRef.span.line - 1, displayedSentenceRef.span.endLine).join("\n").trim() : null),
    [displayedSentenceRef, text],
  );

  const refinementGuidance = useMemo(() => {
    const opd = model.opds.get(opdId);
    if (!opd?.refines || !opd.refinement_type) return null;
    const refinee = model.things.get(opd.refines);
    if (!refinee) return null;
    const internalThings = [...model.appearances.values()]
      .filter((app) => app.opd === opdId && app.internal === true && app.thing !== opd.refines)
      .map((app) => model.things.get(app.thing))
      .filter((thing): thing is NonNullable<typeof thing> => Boolean(thing));
    if (internalThings.length > 1) return null;

    const isES = model.settings.opl_language === "es";
    const template = opd.refinement_type === "in-zoom"
      ? (isES
        ? `${refinee.name} se descompone en Subproceso 1 y Subproceso 2, en esa secuencia.`
        : `${refinee.name} zooms into Subprocess 1 and Subprocess 2, in that sequence.`)
      : (isES
        ? `${refinee.name} se despliega en ${opd.name} en Parte 1 y Parte 2.`
        : `${refinee.name} unfolds in ${opd.name} into Part 1 and Part 2.`);

    const hint = opd.refinement_type === "in-zoom"
      ? (isES ? "Empieza declarando los subprocesses principales del refinement." : "Start by declaring the main subprocesses of this refinement.")
      : (isES ? "Empieza declarando las partes principales del objeto refinado." : "Start by declaring the main parts of the refined object.");

    return { template, hint, refineeName: refinee.name, type: opd.refinement_type };
  }, [model, opdId]);

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
      const timer = setTimeout(ac.updateAutocomplete, 150);
      return () => clearTimeout(timer);
    }
  }, [text, status, ac.updateAutocomplete]);

  useEffect(() => {
    if (!selectedThing && !selectedLink) return;
    if (status === "error") return;
    revealSelection(selectedThing, selectedLink);
  }, [selectedThing, selectedLink, revealSelection, status]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ac.handleAutocompleteKeyDown(e)) return;
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newText = text.substring(0, start) + "  " + text.substring(end);
      setText(newText);
      setStatus("dirty");
      requestAnimationFrame(() => { ta.setSelectionRange(start + 2, start + 2); });
    }
  }, [ac.handleAutocompleteKeyDown, text]);

  const insertRefinementTemplate = useCallback(() => {
    if (!refinementGuidance) return;
    const trimmed = textRef.current.trimEnd();
    const nextText = trimmed.includes(refinementGuidance.template)
      ? textRef.current
      : `${trimmed}${trimmed ? "\n" : ""}${refinementGuidance.template}\n`;
    setText(nextText);
    setStatus("dirty");
    setErrorMsg(null);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      const start = nextText.lastIndexOf(refinementGuidance.template);
      ta.setSelectionRange(start, start + refinementGuidance.template.length);
    });
  }, [refinementGuidance]);

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
      ac.setAcVisible(false);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [dispatch, focusIssue, model, ac]);

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
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            className={`opl-text__scope${showAll ? " opl-text__scope--active" : ""}`}
            onClick={handleToggleScope}
            title={showAll ? "Show current OPD only" : "Show all OPDs"}
            style={{
              border: "1px solid var(--border)",
              background: showAll ? "var(--accent)" : "var(--bg-panel)",
              color: showAll ? "#fff" : "var(--text-secondary)",
              borderRadius: 3,
              fontSize: 11,
              padding: "3px 8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {showAll ? "All" : "OPD"}
          </button>
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
      </div>

      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-muted)", marginBottom: 6, flexWrap: "wrap" }}>
        <span>Click an issue to jump to the exact source span.</span>
        {validationResult && validationResult.issues.length > 0 && (
          <span>
            {issueCounts.errors} error(s), {issueCounts.warnings} warning(s)
          </span>
        )}
      </div>

      <OplContextCard
        activeSentenceRef={displayedSentenceRef}
        activeSentenceText={displayedSentenceText ?? activeSentenceText}
        guidance={refinementGuidance}
        relatedIndex={contextIndex}
        relatedCount={relatedSentenceRefs.length}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((v) => !v)}
        onPrev={() => setContextIndex((i) => (i - 1 + relatedSentenceRefs.length) % relatedSentenceRefs.length)}
        onNext={() => setContextIndex((i) => (i + 1) % relatedSentenceRefs.length)}
        onReveal={() => displayedSentenceRef ? focusIssue({ phase: "V3-semantic", severity: "warning", message: displayedSentenceText ?? "", line: displayedSentenceRef.span.line, column: displayedSentenceRef.span.column, endLine: displayedSentenceRef.span.endLine, endColumn: displayedSentenceRef.span.endColumn }, null) : revealSelection(selectedThing, selectedLink)}
        onInsertTemplate={insertRefinementTemplate}
      />

      <div className="opl-editor-wrapper" style={{ flex: 1, display: "flex", minHeight: 200, position: "relative" }}>
        <div ref={lineNumbersRef} className={`opl-line-numbers${focusMode ? " opl-line-numbers--focus" : ""}`} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => {
            const lineNumber = i + 1;
            const severity = lineIssueSeverity.get(lineNumber);
            const isActiveLine = displayedSentenceRef && lineNumber >= displayedSentenceRef.span.line && lineNumber <= displayedSentenceRef.span.endLine;
            const isDimmed = focusMode && displayedSentenceRef && !isActiveLine;
            return (
              <div
                key={i}
                className={`opl-line-number${isActiveLine ? " opl-line-number--active" : ""}`}
                style={{
                  color: severity === "error" ? "#d9534f" : severity === "warning" ? "#f0ad4e" : isActiveLine ? "rgba(124, 92, 255, 0.95)" : undefined,
                  fontWeight: severity || isActiveLine ? 700 : undefined,
                  opacity: isDimmed ? 0.28 : 1,
                }}
              >
                {lineNumber}
              </div>
            );
          })}
        </div>
        <textarea
          ref={textareaRef}
          className={`code-editor opl-editor-textarea${focusMode ? " opl-editor-textarea--focus" : ""}`}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          style={{ flex: 1, paddingLeft: 4 }}
        />
        {ac.acVisible && ac.acItems.length > 0 && (
          <OplAutocomplete
            items={ac.acItems}
            activeIndex={ac.acIndex}
            position={ac.acPos}
            onSelect={ac.applyAutocomplete}
          />
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
