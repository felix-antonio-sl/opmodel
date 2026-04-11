import type { CSSProperties } from "react";
import type { SdDraft } from "@opmodel/core";
import type { GeneratorStep } from "../types";

interface SdWizardProps {
  step: GeneratorStep;
  draft: SdDraft;
  canGoNext: boolean;
  onChange: <K extends keyof SdDraft>(key: K, value: SdDraft[K]) => void;
  onBack: () => void;
  onNext: () => void;
  onGenerate: () => void;
}

function ListEditor({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {value.map((item, index) => (
        <div key={`${placeholder}-${index}`} style={{ display: "flex", gap: 8 }}>
          <input
            value={item}
            onChange={(event) => {
              const next = [...value];
              next[index] = event.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            style={{ flex: 1 }}
          />
          <button type="button" onClick={() => onChange(value.filter((_, current) => current !== index))}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, ""])} style={{ justifySelf: "start" }}>+ Add</button>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--code-border)",
  background: "#0b1220",
  color: "var(--code-text)",
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 6,
};

export function SdWizard({ step, draft, canGoNext, onChange, onBack, onNext, onGenerate }: SdWizardProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Wizard SD · paso {step}/4</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--code-text)" }}>
            {step === 1 ? "Sistema y función" : step === 2 ? "Valor y beneficiario" : step === 3 ? "Enablers e I/O" : "Review"}
          </div>
        </div>
      </div>

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={labelStyle}>System type</div>
            <select value={draft.systemType} onChange={(event) => onChange("systemType", event.target.value as SdDraft["systemType"])} style={inputStyle}>
              <option value="artificial">Artificial</option>
              <option value="natural">Natural</option>
              <option value="social">Social</option>
              <option value="socio-technical">Socio-technical</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>System name</div>
            <input value={draft.systemName} onChange={(event) => onChange("systemName", event.target.value)} placeholder="Battery Charging System" style={inputStyle} />
          </div>
          <div style={{ gridColumn: "1 / span 2" }}>
            <div style={labelStyle}>Main process</div>
            <input value={draft.mainProcess} onChange={(event) => onChange("mainProcess", event.target.value)} placeholder="Battery Charging" style={inputStyle} />
          </div>
          <div style={{ gridColumn: "1 / span 2", fontSize: 12, color: "var(--text-muted)" }}>
            Usa naming de proceso real. Esta superficie no es canvas-first: parte desde función y estructura mínima.
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={labelStyle}>Beneficiary</div>
            <input value={draft.beneficiary} onChange={(event) => onChange("beneficiary", event.target.value)} placeholder="Driver Group" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Beneficiary attribute</div>
            <input value={draft.beneficiaryAttribute} onChange={(event) => onChange("beneficiaryAttribute", event.target.value)} placeholder="Mobility Convenience" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Before state</div>
            <input value={draft.beneficiaryStateIn} onChange={(event) => onChange("beneficiaryStateIn", event.target.value)} placeholder="limited" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>After state</div>
            <input value={draft.beneficiaryStateOut} onChange={(event) => onChange("beneficiaryStateOut", event.target.value)} placeholder="enhanced" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Value object</div>
            <input value={draft.valueObject} onChange={(event) => onChange("valueObject", event.target.value)} placeholder="Battery" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Problem occurrence (optional)</div>
            <input value={draft.problemOccurrence ?? ""} onChange={(event) => onChange("problemOccurrence", event.target.value || null)} placeholder="Power Loss Occurring" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Value state in</div>
            <input value={draft.valueStateIn} onChange={(event) => onChange("valueStateIn", event.target.value)} placeholder="depleted" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Value state out</div>
            <input value={draft.valueStateOut} onChange={(event) => onChange("valueStateOut", event.target.value)} placeholder="charged" style={inputStyle} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={labelStyle}>Agents</div>
            <ListEditor value={draft.agents} onChange={(value) => onChange("agents", value)} placeholder="Operator" />
          </div>
          <div>
            <div style={labelStyle}>Instruments</div>
            <ListEditor value={draft.instruments} onChange={(value) => onChange("instruments", value)} placeholder="Charging Station" />
          </div>
          <div>
            <div style={labelStyle}>Inputs</div>
            <ListEditor value={draft.inputs} onChange={(value) => onChange("inputs", value)} placeholder="Electrical Energy" />
          </div>
          <div>
            <div style={labelStyle}>Outputs</div>
            <ListEditor value={draft.outputs} onChange={(value) => onChange("outputs", value)} placeholder="Charged Battery" />
          </div>
          <div style={{ gridColumn: "1 / span 2" }}>
            <div style={labelStyle}>Environment</div>
            <ListEditor value={draft.environment} onChange={(value) => onChange("environment", value)} placeholder="Power Grid" />
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 16, background: "rgba(15,23,42,0.55)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Review</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#cbd5e1", fontSize: 13 }}>{JSON.stringify(draft, null, 2)}</pre>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} disabled={step === 1} style={{ opacity: step === 1 ? 0.5 : 1 }}>Back</button>
        {step < 4 ? (
          <button onClick={onNext} disabled={!canGoNext} style={{ opacity: canGoNext ? 1 : 0.5 }}>Next</button>
        ) : (
          <button onClick={onGenerate} style={{ background: "#1d4ed8", color: "white", border: "1px solid #2563eb", borderRadius: 10, padding: "10px 14px" }}>Generate model</button>
        )}
      </div>
    </div>
  );
}
