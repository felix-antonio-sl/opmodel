import type { ParsedSentenceRef } from "../lib/opl-navigation";

interface Props {
  activeSentenceRef: ParsedSentenceRef;
  activeSentenceText: string;
  onReveal: () => void;
}

export function OplFocusCard({ activeSentenceRef, activeSentenceText, onReveal }: Props) {
  return (
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
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}>
        {activeSentenceText}
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)" }}>
        L{activeSentenceRef.span.line}:{activeSentenceRef.span.column}
        {activeSentenceRef.doc.opdName ? ` • ${activeSentenceRef.doc.opdName}` : ""}
      </div>
    </div>
  );
}
