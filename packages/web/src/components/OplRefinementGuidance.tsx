interface RefinementGuidanceData {
  template: string;
  hint: string;
  refineeName: string;
  type: string;
}

interface Props {
  guidance: RefinementGuidanceData;
  onInsertTemplate: () => void;
}

export function OplRefinementGuidance({ guidance, onInsertTemplate }: Props) {
  return (
    <div
      className="opl-editor-refinement-card"
      style={{
        marginBottom: 8,
        padding: "8px 10px",
        border: "1px solid rgba(92, 184, 92, 0.35)",
        background: "rgba(92, 184, 92, 0.08)",
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(92, 184, 92, 0.95)", fontWeight: 700 }}>
          Next OPL step
        </div>
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
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 4 }}>
        {guidance.hint}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}>
        {guidance.template}
      </div>
    </div>
  );
}
