import type { ParsedSentenceRef } from "../lib/opl-navigation";

type Guidance = {
  template: string;
  hint: string;
  refineeName: string;
  type: string;
};

interface Props {
  activeSentenceRef?: ParsedSentenceRef | null;
  activeSentenceText?: string | null;
  guidance?: Guidance | null;
  relatedIndex?: number;
  relatedCount?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onReveal?: () => void;
  onInsertTemplate?: () => void;
}

export function OplContextCard({ activeSentenceRef, activeSentenceText, guidance, relatedIndex = 0, relatedCount = 0, onPrev, onNext, onReveal, onInsertTemplate }: Props) {
  if (!activeSentenceRef && !guidance) return null;

  return (
    <div
      className="opl-editor-context-card"
      style={{
        marginBottom: 8,
        padding: "8px 10px",
        border: "1px solid rgba(124, 92, 255, 0.22)",
        background: "linear-gradient(180deg, rgba(124, 92, 255, 0.06), rgba(92, 184, 92, 0.04))",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 700 }}>
        Context
      </div>

      {activeSentenceRef && activeSentenceText && (
        <div className="opl-editor-context-card__focus">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(124, 92, 255, 0.95)", fontWeight: 700 }}>
              Current focus
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {relatedCount > 1 && (
                <>
                  <button type="button" onClick={onPrev} style={{ border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-secondary)", borderRadius: 4, fontSize: 11, padding: "2px 6px", cursor: "pointer" }}>←</button>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 34, textAlign: "center" }}>{relatedIndex + 1}/{relatedCount}</span>
                  <button type="button" onClick={onNext} style={{ border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-secondary)", borderRadius: 4, fontSize: 11, padding: "2px 6px", cursor: "pointer" }}>→</button>
                </>
              )}
              {onReveal && (
                <button
                  type="button"
                  onClick={onReveal}
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
              )}
            </div>
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

      {guidance && (
        <div className="opl-editor-context-card__guidance">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(92, 184, 92, 0.95)", fontWeight: 700 }}>
              Next OPL step
            </div>
            {onInsertTemplate && (
              <button
                type="button"
                onClick={onInsertTemplate}
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
                Insert template
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 4 }}>
            {guidance.hint}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}>
            {guidance.template}
          </div>
        </div>
      )}
    </div>
  );
}
