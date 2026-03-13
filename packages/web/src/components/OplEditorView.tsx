import { useState, useMemo } from "react";
import type { Model, OplEdit, LinkType, ModifierType, Essence, Affiliation } from "@opmodel/core";
import { expose, render, type OplDocument } from "@opmodel/core";
import type { Command } from "../lib/commands";

interface Props {
  model: Model;
  opdId: string;
  dispatch: (cmd: Command) => boolean;
}

interface EditorFormState {
  action: OplEdit["kind"];
  name: string;
  thingKind: "object" | "process";
  essence: Essence;
  affiliation: Affiliation;
  selectedThing: string;
  selectedLink: string;
  selectedState: string;
  selectedModifier: string;
  stateNames: string;
  linkSource: string;
  linkTarget: string;
  linkType: LinkType;
  linkSourceState: string;
  linkTargetState: string;
  modifierType: ModifierType;
  negated: boolean;
}

const INITIAL_FORM: EditorFormState = {
  action: "add-thing",
  name: "", thingKind: "object", essence: "informatical", affiliation: "systemic",
  selectedThing: "", selectedLink: "", selectedState: "", selectedModifier: "",
  stateNames: "",
  linkSource: "", linkTarget: "", linkType: "agent",
  linkSourceState: "", linkTargetState: "",
  modifierType: "event", negated: false,
};

const ACTIONS: { value: OplEdit["kind"]; label: string }[] = [
  { value: "add-thing", label: "Add Thing" },
  { value: "remove-thing", label: "Remove Thing" },
  { value: "add-states", label: "Add States" },
  { value: "remove-state", label: "Remove State" },
  { value: "add-link", label: "Add Link" },
  { value: "remove-link", label: "Remove Link" },
  { value: "add-modifier", label: "Add Modifier" },
  { value: "remove-modifier", label: "Remove Modifier" },
];

const LINK_TYPES: LinkType[] = [
  "agent", "instrument", "effect", "consumption", "result",
  "input", "output", "aggregation", "exhibition",
  "generalization", "classification", "tagged", "invocation", "exception",
];

function parseStateNames(raw: string): string[] {
  return raw.split(",").map(s => s.trim()).filter(s => s.length > 0)
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

function buildEdit(form: EditorFormState, opdId: string): OplEdit | null {
  switch (form.action) {
    case "add-thing":
      if (!form.name.trim()) return null;
      return {
        kind: "add-thing",
        opdId,
        thing: {
          name: form.name.trim(),
          kind: form.thingKind,
          essence: form.essence,
          affiliation: form.affiliation,
        } as any,
        position: { x: 100, y: 100 },
      };
    case "remove-thing":
      if (!form.selectedThing) return null;
      return { kind: "remove-thing", thingId: form.selectedThing };
    case "add-states": {
      if (!form.selectedThing) return null;
      const names = parseStateNames(form.stateNames);
      if (names.length === 0) return null;
      return {
        kind: "add-states",
        thingId: form.selectedThing,
        states: names.map(name => ({ name, initial: false, final: false, default: false })),
      };
    }
    case "remove-state":
      if (!form.selectedState) return null;
      return { kind: "remove-state", stateId: form.selectedState };
    case "add-link": {
      if (!form.linkSource || !form.linkTarget) return null;
      if (form.linkSource === form.linkTarget) return null;
      const link: any = {
        source: form.linkSource,
        target: form.linkTarget,
        type: form.linkType,
      };
      if (form.linkSourceState) link.source_state = form.linkSourceState;
      if (form.linkTargetState) link.target_state = form.linkTargetState;
      return { kind: "add-link", link };
    }
    case "remove-link":
      if (!form.selectedLink) return null;
      return { kind: "remove-link", linkId: form.selectedLink };
    case "add-modifier": {
      if (!form.selectedLink) return null;
      return {
        kind: "add-modifier",
        modifier: { over: form.selectedLink, type: form.modifierType, negated: form.negated } as any,
      };
    }
    case "remove-modifier":
      if (!form.selectedModifier) return null;
      return { kind: "remove-modifier", modifierId: form.selectedModifier };
  }
}

function getPreviewText(form: EditorFormState, model: Model, opdId: string): string {
  const doc = expose(model, opdId);

  if (form.action === "remove-thing" && form.selectedThing) {
    const s = doc.sentences.find(s => s.kind === "thing-declaration" && s.thingId === form.selectedThing);
    return s ? render({ ...doc, sentences: [s] }) : form.selectedThing;
  }
  if (form.action === "remove-state" && form.selectedState) {
    return `Remove state: ${model.states.get(form.selectedState)?.name ?? form.selectedState}`;
  }
  if (form.action === "remove-link" && form.selectedLink) {
    const s = doc.sentences.find(s => s.kind === "link" && s.linkId === form.selectedLink);
    return s ? render({ ...doc, sentences: [s] }) : form.selectedLink;
  }
  if (form.action === "remove-modifier" && form.selectedModifier) {
    const s = doc.sentences.find(s => s.kind === "modifier" && s.modifierId === form.selectedModifier);
    return s ? render({ ...doc, sentences: [s] }) : form.selectedModifier;
  }

  if (form.action === "add-thing" && form.name.trim()) {
    const previewDoc: OplDocument = {
      ...doc,
      sentences: [{
        kind: "thing-declaration",
        thingId: "preview",
        name: form.name.trim(),
        thingKind: form.thingKind,
        essence: form.essence,
        affiliation: form.affiliation,
      }],
    };
    return render(previewDoc);
  }

  if (form.action === "add-states" && form.selectedThing) {
    const names = parseStateNames(form.stateNames);
    if (names.length === 0) return "";
    const thingName = model.things.get(form.selectedThing)?.name ?? "?";
    return `${thingName} can be ${names.join(", ")}.`;
  }

  if (form.action === "add-link" && form.linkSource && form.linkTarget) {
    const srcName = model.things.get(form.linkSource)?.name ?? "?";
    const tgtName = model.things.get(form.linkTarget)?.name ?? "?";
    const previewDoc: OplDocument = {
      ...doc,
      sentences: [{
        kind: "link",
        linkId: "preview",
        linkType: form.linkType,
        sourceId: form.linkSource,
        targetId: form.linkTarget,
        sourceName: srcName,
        targetName: tgtName,
        ...(form.linkSourceState ? { sourceStateName: model.states.get(form.linkSourceState)?.name } : {}),
        ...(form.linkTargetState ? { targetStateName: model.states.get(form.linkTargetState)?.name } : {}),
      }],
    };
    return render(previewDoc);
  }

  if (form.action === "add-modifier" && form.selectedLink) {
    const link = model.links.get(form.selectedLink);
    if (!link) return "";
    const srcName = model.things.get(link.source)?.name ?? "?";
    const tgtName = model.things.get(link.target)?.name ?? "?";
    const previewDoc: OplDocument = {
      ...doc,
      sentences: [{
        kind: "modifier",
        modifierId: "preview",
        linkId: form.selectedLink,
        linkType: link.type,
        sourceName: srcName,
        targetName: tgtName,
        modifierType: form.modifierType,
        negated: form.negated,
      }],
    };
    return render(previewDoc);
  }

  return "";
}

export function OplEditorView({ model, opdId, dispatch }: Props) {
  const [form, setForm] = useState<EditorFormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);

  const things = useMemo(() => [...model.things.values()], [model.things]);
  const objects = useMemo(() => things.filter(t => t.kind === "object"), [things]);
  const links = useMemo(() => [...model.links.values()], [model.links]);
  const modifiers = useMemo(() => [...model.modifiers.values()], [model.modifiers]);

  const statesForThing = (thingId: string) =>
    [...model.states.values()].filter(s => s.parent === thingId);

  const statesForSource = form.linkSource ? statesForThing(form.linkSource) : [];
  const statesForTarget = form.linkTarget ? statesForThing(form.linkTarget) : [];

  const set = <K extends keyof EditorFormState>(field: K, value: EditorFormState[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleActionChange = (action: OplEdit["kind"]) => {
    setForm({ ...INITIAL_FORM, action });
    setError(null);
  };

  const preview = getPreviewText(form, model, opdId);
  const edit = buildEdit(form, opdId);
  const isNameDuplicate = form.action === "add-thing" && form.name.trim() &&
    things.some(t => t.name.toLowerCase() === form.name.trim().toLowerCase());

  const handleApply = () => {
    if (!edit) return;
    const ok = dispatch({ tag: "applyOplEdit", edit });
    if (ok) {
      setForm({ ...INITIAL_FORM, action: form.action });
      setError(null);
    } else {
      setError("Edit rejected by model invariants");
    }
  };

  return (
    <div className="opl-panel__content opl-editor">
      <div className="opl-editor__field">
        <label className="opl-editor__label">Action</label>
        <select
          className="opl-editor__select"
          value={form.action}
          onChange={(e) => handleActionChange(e.target.value as OplEdit["kind"])}
        >
          {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      {form.action === "add-thing" && (
        <>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Name</label>
            <input className="opl-editor__input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Water" />
            {isNameDuplicate && <span className="opl-editor__warning">Name already exists</span>}
          </div>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Kind</label>
            <div className="opl-editor__radio-group">
              <label><input type="radio" checked={form.thingKind === "object"} onChange={() => set("thingKind", "object")} /> Object</label>
              <label><input type="radio" checked={form.thingKind === "process"} onChange={() => set("thingKind", "process")} /> Process</label>
            </div>
          </div>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Essence</label>
            <select className="opl-editor__select" value={form.essence} onChange={(e) => set("essence", e.target.value as Essence)}>
              <option value="informatical">Informatical</option>
              <option value="physical">Physical</option>
            </select>
          </div>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Affiliation</label>
            <select className="opl-editor__select" value={form.affiliation} onChange={(e) => set("affiliation", e.target.value as Affiliation)}>
              <option value="systemic">Systemic</option>
              <option value="environmental">Environmental</option>
            </select>
          </div>
        </>
      )}

      {form.action === "remove-thing" && (
        <div className="opl-editor__field">
          <label className="opl-editor__label">Thing</label>
          <select className="opl-editor__select" value={form.selectedThing} onChange={(e) => set("selectedThing", e.target.value)}>
            <option value="">Select...</option>
            {things.map(t => <option key={t.id} value={t.id}>{t.name} ({t.kind})</option>)}
          </select>
        </div>
      )}

      {form.action === "add-states" && (
        <>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Object</label>
            <select className="opl-editor__select" value={form.selectedThing} onChange={(e) => set("selectedThing", e.target.value)}>
              <option value="">Select...</option>
              {objects.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="opl-editor__field">
            <label className="opl-editor__label">State Names (comma-separated)</label>
            <input className="opl-editor__input" value={form.stateNames} onChange={(e) => set("stateNames", e.target.value)} placeholder="e.g. cold, hot, boiling" />
          </div>
        </>
      )}

      {form.action === "remove-state" && (
        <>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Object</label>
            <select className="opl-editor__select" value={form.selectedThing} onChange={(e) => { set("selectedThing", e.target.value); set("selectedState", ""); }}>
              <option value="">Select...</option>
              {objects.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {form.selectedThing && (
            <div className="opl-editor__field">
              <label className="opl-editor__label">State</label>
              <select className="opl-editor__select" value={form.selectedState} onChange={(e) => set("selectedState", e.target.value)}>
                <option value="">Select...</option>
                {statesForThing(form.selectedThing).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      {form.action === "add-link" && (
        <>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Source</label>
            <select className="opl-editor__select" value={form.linkSource} onChange={(e) => { set("linkSource", e.target.value); set("linkSourceState", ""); }}>
              <option value="">Select...</option>
              {things.map(t => <option key={t.id} value={t.id}>{t.name} ({t.kind})</option>)}
            </select>
          </div>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Target</label>
            <select className="opl-editor__select" value={form.linkTarget} onChange={(e) => { set("linkTarget", e.target.value); set("linkTargetState", ""); }}>
              <option value="">Select...</option>
              {things.map(t => <option key={t.id} value={t.id}>{t.name} ({t.kind})</option>)}
            </select>
          </div>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Link Type</label>
            <select className="opl-editor__select" value={form.linkType} onChange={(e) => set("linkType", e.target.value as LinkType)}>
              {LINK_TYPES.map(lt => <option key={lt} value={lt}>{lt}</option>)}
            </select>
          </div>
          {statesForSource.length > 0 && (
            <div className="opl-editor__field">
              <label className="opl-editor__label">Source State (optional)</label>
              <select className="opl-editor__select" value={form.linkSourceState} onChange={(e) => set("linkSourceState", e.target.value)}>
                <option value="">None</option>
                {statesForSource.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {statesForTarget.length > 0 && (
            <div className="opl-editor__field">
              <label className="opl-editor__label">Target State (optional)</label>
              <select className="opl-editor__select" value={form.linkTargetState} onChange={(e) => set("linkTargetState", e.target.value)}>
                <option value="">None</option>
                {statesForTarget.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {form.linkSource && form.linkTarget && form.linkSource === form.linkTarget && (
            <span className="opl-editor__error">Source and target must differ</span>
          )}
        </>
      )}

      {form.action === "remove-link" && (
        <div className="opl-editor__field">
          <label className="opl-editor__label">Link</label>
          <select className="opl-editor__select" value={form.selectedLink} onChange={(e) => set("selectedLink", e.target.value)}>
            <option value="">Select...</option>
            {links.map(l => {
              const src = model.things.get(l.source)?.name ?? l.source;
              const tgt = model.things.get(l.target)?.name ?? l.target;
              return <option key={l.id} value={l.id}>{src} → {tgt} ({l.type})</option>;
            })}
          </select>
        </div>
      )}

      {form.action === "add-modifier" && (
        <>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Link</label>
            <select className="opl-editor__select" value={form.selectedLink} onChange={(e) => set("selectedLink", e.target.value)}>
              <option value="">Select...</option>
              {links.map(l => {
                const src = model.things.get(l.source)?.name ?? l.source;
                const tgt = model.things.get(l.target)?.name ?? l.target;
                return <option key={l.id} value={l.id}>{src} → {tgt} ({l.type})</option>;
              })}
            </select>
          </div>
          <div className="opl-editor__field">
            <label className="opl-editor__label">Type</label>
            <select className="opl-editor__select" value={form.modifierType} onChange={(e) => set("modifierType", e.target.value as ModifierType)}>
              <option value="event">Event</option>
              <option value="condition">Condition</option>
            </select>
          </div>
          <div className="opl-editor__field">
            <label className="opl-editor__checkbox-label">
              <input type="checkbox" checked={form.negated} onChange={(e) => set("negated", e.target.checked)} />
              Negated
            </label>
          </div>
        </>
      )}

      {form.action === "remove-modifier" && (
        <div className="opl-editor__field">
          <label className="opl-editor__label">Modifier</label>
          <select className="opl-editor__select" value={form.selectedModifier} onChange={(e) => set("selectedModifier", e.target.value)}>
            <option value="">Select...</option>
            {modifiers.map(m => {
              const link = model.links.get(m.over);
              const linkLabel = link
                ? `${model.things.get(link.source)?.name ?? "?"} → ${model.things.get(link.target)?.name ?? "?"}`
                : m.over;
              return <option key={m.id} value={m.id}>{m.type} on {linkLabel}</option>;
            })}
          </select>
        </div>
      )}

      {preview && (
        <div className="opl-editor__preview">
          <label className="opl-editor__label">Preview</label>
          <div className="opl-editor__preview-text">{preview}</div>
        </div>
      )}

      {error && <div className="opl-editor__error">{error}</div>}

      <button
        className="opl-editor__apply"
        disabled={!edit}
        onClick={handleApply}
      >
        Apply Edit
      </button>
    </div>
  );
}
