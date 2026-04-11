interface GeneratorOplPanelProps {
  text: string;
}

export function OplPanel({ text }: GeneratorOplPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>OPL</div>
      <textarea
        readOnly
        value={text}
        style={{ flex: 1, minHeight: 260, resize: "vertical", background: "#020617", color: "#e2e8f0", border: "1px solid var(--code-border)", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}
      />
    </div>
  );
}
