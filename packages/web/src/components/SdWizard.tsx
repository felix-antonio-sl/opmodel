import { useState } from "react";
import type { Model, Thing, State, Link } from "@opmodel/core";
import { createModel, addThing, addState, addLink, addAppearance, updateSettings, isOk } from "@opmodel/core";

interface Props {
  onComplete: (model: Model) => void;
  onCancel: () => void;
}

interface WizardState {
  step: number;
  systemType: "artificial" | "natural" | "social" | "socio-technical";
  mainProcessName: string;
  beneficiaryName: string;
  beneficiaryAttrName: string;
  beneficiaryStateInput: string;
  beneficiaryStateOutput: string;
  transformeeName: string;
  transformeeAttrName: string;
  transformeeStateInput: string;
  transformeeStateOutput: string;
  agents: string[];
  systemName: string;
  instruments: string[];
  consumedObjects: string[];
  resultObjects: string[];
  environmentalObjects: string[];
  problemProcessName: string;
}

const INITIAL: WizardState = {
  step: 1,
  systemType: "artificial",
  mainProcessName: "",
  beneficiaryName: "",
  beneficiaryAttrName: "",
  beneficiaryStateInput: "",
  beneficiaryStateOutput: "",
  transformeeName: "",
  transformeeAttrName: "",
  transformeeStateInput: "",
  transformeeStateOutput: "",
  agents: [""],
  systemName: "",
  instruments: [""],
  consumedObjects: [""],
  resultObjects: [""],
  environmentalObjects: [""],
  problemProcessName: "",
};

const STEPS = [
  { num: 1, title: "Main Process", desc: "The function that provides value" },
  { num: 2, title: "Beneficiary", desc: "Who benefits from the system" },
  { num: 3, title: "Beneficiary Attribute", desc: "How the beneficiary benefits" },
  { num: 4, title: "Main Transformee", desc: "What the system transforms" },
  { num: 5, title: "Agents", desc: "Human enablers" },
  { num: 6, title: "System Name", desc: "The system itself" },
  { num: 7, title: "Instruments", desc: "Non-human enablers" },
  { num: 8, title: "Input/Output", desc: "Consumed and created objects" },
  { num: 9, title: "Environment", desc: "External context objects" },
  { num: 10, title: "Problem", desc: "The problem the system solves" },
];

function genId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }

function buildModel(w: WizardState): Model {
  let m = createModel(w.systemName || w.mainProcessName + " System", w.systemType);
  const r0 = updateSettings(m, { opl_language: "en" });
  if (isOk(r0)) m = r0.value;

  const ids: Record<string, string> = {};
  let y = 300;

  // Step 1: Main Process
  const procId = genId("proc");
  ids.mainProcess = procId;
  m = isOk(addThing(m, { id: procId, kind: "process", name: w.mainProcessName, essence: "physical", affiliation: "systemic" })) ? (addThing(m, { id: procId, kind: "process", name: w.mainProcessName, essence: "physical", affiliation: "systemic" }) as any).value : m;
  m = isOk(addAppearance(m, { thing: procId, opd: "opd-sd", x: 350, y: 300, w: 280, h: 100 })) ? (addAppearance(m, { thing: procId, opd: "opd-sd", x: 350, y: 300, w: 280, h: 100 }) as any).value : m;

  // Helper
  const add = (thing: Omit<Thing, "id">, x: number, y: number, w = 180, h = 50) => {
    const id = genId(thing.kind === "process" ? "proc" : "obj");
    const r1 = addThing(m, { ...thing, id } as Thing);
    if (isOk(r1)) m = r1.value;
    const r2 = addAppearance(m, { thing: id, opd: "opd-sd", x, y, w, h });
    if (isOk(r2)) m = r2.value;
    return id;
  };

  const addLink_ = (link: Omit<Link, "id">) => {
    const id = genId("lnk");
    const r = addLink(m, { ...link, id } as Link);
    if (isOk(r)) m = r.value;
  };

  const addState_ = (parent: string, name: string, initial: boolean, final: boolean, def: boolean) => {
    const id = genId("s");
    const r = addState(m, { id, parent, name, initial, final, default: def });
    if (isOk(r)) m = r.value;
    return id;
  };

  // Step 2: Beneficiary
  if (w.beneficiaryName) {
    const id = add({ kind: "object", name: w.beneficiaryName, essence: "physical", affiliation: "environmental" } as any, 50, 50, 200);
    ids.beneficiary = id;
  }

  // Step 3: Beneficiary Attribute
  if (w.beneficiaryAttrName && ids.beneficiary) {
    const id = add({ kind: "object", name: w.beneficiaryAttrName, essence: "informatical", affiliation: "systemic" } as any, 300, 50, 200);
    ids.beneficiaryAttr = id;
    addLink_({ type: "exhibition", source: ids.beneficiary, target: id } as any);
    const sIn = addState_(id, w.beneficiaryStateInput || "initial", true, false, true);
    const sOut = addState_(id, w.beneficiaryStateOutput || "desired", false, true, false);
    addLink_({ type: "effect", source: procId, target: id, source_state: sIn, target_state: sOut } as any);
  }

  // Step 4: Transformee
  if (w.transformeeName) {
    const id = add({ kind: "object", name: w.transformeeName, essence: "physical", affiliation: "systemic" } as any, 600, 50, 220);
    ids.transformee = id;
    if (w.transformeeAttrName) {
      const attrId = add({ kind: "object", name: w.transformeeAttrName, essence: "informatical", affiliation: "systemic" } as any, 600, 130, 200);
      addLink_({ type: "exhibition", source: id, target: attrId } as any);
      const sIn = addState_(attrId, w.transformeeStateInput || "before", true, false, true);
      const sOut = addState_(attrId, w.transformeeStateOutput || "after", false, true, false);
      addLink_({ type: "effect", source: procId, target: attrId, source_state: sIn, target_state: sOut } as any);
    }
  }

  // Step 5: Agents
  let agentY = 200;
  for (const name of w.agents.filter(Boolean)) {
    const id = add({ kind: "object", name, essence: "physical", affiliation: "systemic" } as any, 50, agentY);
    addLink_({ type: "agent", source: id, target: procId } as any);
    agentY += 70;
  }

  // Step 6: System
  if (w.systemName) {
    const id = add({ kind: "object", name: w.systemName, essence: "physical", affiliation: "systemic" } as any, 350, 180, 200);
    ids.system = id;
    addLink_({ type: "exhibition", source: id, target: procId } as any);
    addLink_({ type: "instrument", source: id, target: procId } as any);
  }

  // Step 7: Instruments
  let instrY = 200;
  for (const name of w.instruments.filter(Boolean)) {
    const id = add({ kind: "object", name, essence: "physical", affiliation: "systemic" } as any, 700, instrY);
    addLink_({ type: "instrument", source: id, target: procId } as any);
    instrY += 70;
  }

  // Step 8: Input/Output
  let ioY = 450;
  for (const name of w.consumedObjects.filter(Boolean)) {
    const id = add({ kind: "object", name, essence: "physical", affiliation: "systemic" } as any, 50, ioY);
    addLink_({ type: "consumption", source: id, target: procId } as any);
    ioY += 60;
  }
  for (const name of w.resultObjects.filter(Boolean)) {
    const id = add({ kind: "object", name, essence: "physical", affiliation: "systemic" } as any, 700, ioY);
    addLink_({ type: "result", source: procId, target: id } as any);
    ioY += 60;
  }

  // Step 9: Environmental
  let envY = 550;
  for (const name of w.environmentalObjects.filter(Boolean)) {
    const id = add({ kind: "object", name, essence: "physical", affiliation: "environmental" } as any, 50, envY);
    addLink_({ type: "instrument", source: id, target: procId } as any);
    envY += 60;
  }

  // Step 10: Problem
  if (w.problemProcessName) {
    const id = add({ kind: "process", name: w.problemProcessName, essence: "physical", affiliation: "environmental" } as any, 350, envY + 20, 280, 70);
    if (ids.beneficiaryAttr) {
      addLink_({ type: "effect", source: id, target: ids.beneficiaryAttr } as any);
    }
  }

  return m;
}

function ListInput({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          <input
            className="wizard-input"
            value={item}
            onChange={(e) => { const next = [...items]; next[i] = e.target.value; onChange(next); }}
            placeholder={placeholder}
          />
          {items.length > 1 && (
            <button className="wizard-remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          )}
        </div>
      ))}
      <button className="wizard-add" onClick={() => onChange([...items, ""])}>+ Add</button>
    </div>
  );
}

export function SdWizard({ onComplete, onCancel }: Props) {
  const [w, setW] = useState<WizardState>(INITIAL);
  const set = <K extends keyof WizardState>(key: K, val: WizardState[K]) => setW(prev => ({ ...prev, [key]: val }));
  const step = STEPS[w.step - 1]!;
  const isLast = w.step === 10;
  const canNext = w.step === 1 ? w.mainProcessName.length > 0 : true;

  return (
    <div className="wizard-overlay" onClick={onCancel}>
      <div className="wizard-panel" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <span className="wizard-step-num">Step {w.step}/10</span>
          <span className="wizard-step-title">{step.title}</span>
          <button className="wizard-close" onClick={onCancel}>✕</button>
        </div>
        <p className="wizard-desc">{step.desc}</p>

        <div className="wizard-body">
          {w.step === 1 && (
            <>
              <label className="wizard-label">System type</label>
              <select className="wizard-select" value={w.systemType} onChange={(e) => set("systemType", e.target.value as any)}>
                <option value="artificial">Artificial (technological)</option>
                <option value="natural">Natural</option>
                <option value="social">Social</option>
                <option value="socio-technical">Socio-technical</option>
              </select>
              <label className="wizard-label">Main process name (English: -ing; Spanish: gerund or -ción)</label>
              <input className="wizard-input" value={w.mainProcessName} onChange={(e) => set("mainProcessName", e.target.value)}
                placeholder="e.g. Battery Charging, Road Danger Warning" autoFocus />
              {w.mainProcessName && !/(?:ing|ando|iendo|ción)$/i.test(w.mainProcessName) && (
                <div className="wizard-warn">⚠ Use accepted process naming: English -ing; Spanish -ando/-iendo or forms like -ción</div>
              )}
            </>
          )}
          {w.step === 2 && (
            <>
              <label className="wizard-label">Beneficiary group name</label>
              <input className="wizard-input" value={w.beneficiaryName} onChange={(e) => set("beneficiaryName", e.target.value)}
                placeholder="e.g. Passenger Group, Urban Commuter Group" autoFocus />
              {w.beneficiaryName && !/(?:Group|Set)$/i.test(w.beneficiaryName) && (
                <div className="wizard-warn">⚠ Should end in Group or Set</div>
              )}
            </>
          )}
          {w.step === 3 && (
            <>
              <label className="wizard-label">Beneficiary attribute</label>
              <input className="wizard-input" value={w.beneficiaryAttrName} onChange={(e) => set("beneficiaryAttrName", e.target.value)}
                placeholder="e.g. Safety Level, Mobility Convenience" autoFocus />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="wizard-label">Input state (before)</label>
                  <input className="wizard-input" value={w.beneficiaryStateInput} onChange={(e) => set("beneficiaryStateInput", e.target.value)}
                    placeholder="e.g. low, limited" />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="wizard-label">Output state (after)</label>
                  <input className="wizard-input" value={w.beneficiaryStateOutput} onChange={(e) => set("beneficiaryStateOutput", e.target.value)}
                    placeholder="e.g. high, enhanced" />
                </div>
              </div>
            </>
          )}
          {w.step === 4 && (
            <>
              <label className="wizard-label">Main transformee (benefit-providing object)</label>
              <input className="wizard-input" value={w.transformeeName} onChange={(e) => set("transformeeName", e.target.value)}
                placeholder="e.g. Battery, Vehicle, Document" autoFocus />
              <label className="wizard-label">Transformee attribute (optional)</label>
              <input className="wizard-input" value={w.transformeeAttrName} onChange={(e) => set("transformeeAttrName", e.target.value)}
                placeholder="e.g. Charge Level, Operational Readiness" />
              {w.transformeeAttrName && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label className="wizard-label">Before state</label>
                    <input className="wizard-input" value={w.transformeeStateInput} onChange={(e) => set("transformeeStateInput", e.target.value)} placeholder="e.g. depleted" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="wizard-label">After state</label>
                    <input className="wizard-input" value={w.transformeeStateOutput} onChange={(e) => set("transformeeStateOutput", e.target.value)} placeholder="e.g. charged" />
                  </div>
                </div>
              )}
            </>
          )}
          {w.step === 5 && (
            <>
              <label className="wizard-label">Agents (human enablers)</label>
              <ListInput items={w.agents} onChange={(v) => set("agents", v)} placeholder="e.g. Operator, Engineer" />
              {w.systemType === "natural" && <div className="wizard-warn">Natural systems have no human agents</div>}
            </>
          )}
          {w.step === 6 && (
            <>
              <label className="wizard-label">System name</label>
              <input className="wizard-input" value={w.systemName || (w.mainProcessName + " System")} onChange={(e) => set("systemName", e.target.value)} autoFocus />
            </>
          )}
          {w.step === 7 && (
            <>
              <label className="wizard-label">Instruments (non-human enablers)</label>
              <ListInput items={w.instruments} onChange={(v) => set("instruments", v)} placeholder="e.g. Machine, Software, Station" />
            </>
          )}
          {w.step === 8 && (
            <>
              <label className="wizard-label">Consumed objects (inputs destroyed)</label>
              <ListInput items={w.consumedObjects} onChange={(v) => set("consumedObjects", v)} placeholder="e.g. Raw Material, Fuel" />
              <label className="wizard-label" style={{ marginTop: 8 }}>Result objects (outputs created)</label>
              <ListInput items={w.resultObjects} onChange={(v) => set("resultObjects", v)} placeholder="e.g. Product, Report" />
            </>
          )}
          {w.step === 9 && (
            <>
              <label className="wizard-label">Environmental objects (external context)</label>
              <ListInput items={w.environmentalObjects} onChange={(v) => set("environmentalObjects", v)} placeholder="e.g. Weather, Regulation, Road Network" />
            </>
          )}
          {w.step === 10 && (
            <>
              <label className="wizard-label">Problem process (environmental, optional)</label>
              <input className="wizard-input" value={w.problemProcessName} onChange={(e) => set("problemProcessName", e.target.value)}
                placeholder="e.g. Manual Operation Causing Delays" autoFocus />
              {w.systemType === "natural" && <div className="wizard-warn">Natural systems don't model problem occurrence</div>}
            </>
          )}
        </div>

        <div className="wizard-footer">
          <button className="wizard-btn wizard-btn--secondary" onClick={() => w.step > 1 ? set("step", w.step - 1) : onCancel()}>
            {w.step === 1 ? "Cancel" : "← Back"}
          </button>
          <div className="wizard-progress">
            {STEPS.map((s, i) => <div key={i} className={`wizard-dot${i < w.step ? " wizard-dot--done" : ""}`} />)}
          </div>
          <button className="wizard-btn wizard-btn--primary" disabled={!canNext}
            onClick={() => {
              if (isLast) {
                onComplete(buildModel(w));
              } else {
                set("step", w.step + 1);
              }
            }}>
            {isLast ? "Create Model ✓" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
