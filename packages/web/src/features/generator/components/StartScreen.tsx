import { useState } from "react";

interface StartScreenProps {
  onUseWizard: () => void;
  onClose: () => void;
}

export function StartScreen({ onUseWizard, onClose }: StartScreenProps) {
  const [description] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--text-primary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--code-text)" }}>OPM Graph Generator</div>
          <div style={{ color: "var(--text-muted)", marginTop: 6, maxWidth: 760 }}>
            Nuevo slice primario para pasar de intención a <code>SemanticKernel</code>, OPL y diagrama derivado sin depender del canvas como superficie autora.
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.95fr", gap: 16 }}>
        <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 16, background: "rgba(15,23,42,0.6)" }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Describe your system</div>
          <textarea
            value={description}
            readOnly
            placeholder="Próximo corte: prompt -> wizard seeding. En este primer slice, el camino activo es el wizard SD."
            style={{ width: "100%", minHeight: 180, resize: "vertical", background: "#0b1220", color: "#94a3b8", border: "1px solid var(--code-border)", borderRadius: 10, padding: 12, fontFamily: "inherit" }}
          />
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
            Este bloque queda explícitamente marcado como siguiente corte. No lo estoy fingiendo todavía.
          </div>
        </div>

        <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 16, background: "rgba(2,6,23,0.85)" }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Wizard SD activo</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-muted)", display: "grid", gap: 8, fontSize: 13 }}>
            <li>captura de sistema, proceso principal y valor</li>
            <li>agentes, instrumentos, inputs y outputs</li>
            <li><code>SdDraft -&gt; SemanticKernel</code></li>
            <li>OPL derivado</li>
            <li>preview SVG derivado</li>
            <li>abrir el resultado en el editor actual</li>
          </ul>
          <button
            onClick={onUseWizard}
            style={{ marginTop: 16, width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #2563eb", background: "#1d4ed8", color: "white", cursor: "pointer", fontWeight: 600 }}
          >
            Abrir wizard SD
          </button>
        </div>
      </div>
    </div>
  );
}
