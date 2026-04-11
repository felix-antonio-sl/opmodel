import type { DraftValidationReport, Model } from "@opmodel/core";
import { DiagramPreview } from "./DiagramPreview";
import { OplPanel } from "./OplPanel";
import { ValidationPanel } from "./ValidationPanel";

interface ModelWorkspaceProps {
  model: Model;
  opl: string;
  svg: string;
  validation: DraftValidationReport;
  onOpenInEditor: () => void;
  onBackToWizard: () => void;
}

export function ModelWorkspace({ model, opl, svg, validation, onOpenInEditor, onBackToWizard }: ModelWorkspaceProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--text-primary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--code-text)" }}>{model.meta.name}</div>
          <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 13 }}>
            Primer vertical slice operativo: <code>SdDraft -&gt; SemanticKernel -&gt; OPL + SVG</code>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onBackToWizard}>Back to wizard</button>
          <button onClick={onOpenInEditor} style={{ background: "#1d4ed8", color: "white", border: "1px solid #2563eb", borderRadius: 10, padding: "10px 14px" }}>
            Open in editor
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <DiagramPreview svg={svg} />
        <ValidationPanel report={validation} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <OplPanel text={opl} />
        <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 16, background: "rgba(15,23,42,0.55)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>Model summary</div>
          <div style={{ display: "grid", gap: 8, fontSize: 13, color: "var(--code-text)" }}>
            <div>{model.things.size} things</div>
            <div>{model.states.size} states</div>
            <div>{model.links.size} links</div>
            <div>{model.opds.size} OPDs</div>
            <div>Current slice: SD only</div>
            <div style={{ color: "var(--text-muted)" }}>Next cut: SD1 refinement and prompt-to-wizard seeding.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
