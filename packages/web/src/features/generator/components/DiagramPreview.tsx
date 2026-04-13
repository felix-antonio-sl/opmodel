interface DiagramPreviewProps {
  svg: string;
}

export function DiagramPreview({ svg }: DiagramPreviewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Derived SVG via VisualRenderSpec</div>
      <div
        style={{ border: "1px solid var(--code-border)", borderRadius: 12, overflow: "hidden", background: "#020617" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
