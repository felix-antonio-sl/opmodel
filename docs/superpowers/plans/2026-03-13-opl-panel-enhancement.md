# OPL Panel Enhancement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the OPL Panel from a read-only sentence view to a tabbed component with Sentences, Text (copyable), and Editor (8 OplEdit form) tabs.

**Architecture:** Three child components factored by variance (covariant get vs contravariant put), orchestrated by a tab-switching OplPanel. Editor integrates via a new `applyOplEdit` Command summand.

**Tech Stack:** React 19, TypeScript, @opmodel/core (expose, render, applyOplEdit, OplEdit types), Vite, existing CSS patterns from App.css.

**Spec:** `docs/superpowers/specs/2026-03-13-opl-panel-enhancement-design.md`

**Test runner:** `export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run`

**Type check:** `cd packages/web && bunx tsc --noEmit`

**Dev server:** `cd packages/web && bunx vite`

---

## Chunk 1: Foundation (Command extension + SentencesView extraction + Tab shell)

### Task 1: Extend Command algebra with `applyOplEdit`

**Files:**
- Modify: `packages/web/src/lib/commands.ts`

- [ ] **Step 1: Add imports to commands.ts**

At line 9, add `applyOplEdit` and `type OplEdit` to the imports from `@opmodel/core`:

```ts
import type { Model, Thing, Link, State, InvariantError, RefinementType, OplEdit } from "@opmodel/core";
import {
  updateAppearance,
  updateThing,
  updateState,
  updateLink,
  updateOPD,
  addThing,
  addState,
  addLink,
  addAppearance,
  removeThing,
  removeState,
  removeLink,
  refineThing,
  applyOplEdit,
  isOk,
  type Result,
} from "@opmodel/core";
```

- [ ] **Step 2: Add Command variant**

After line 51 (`refineThing` variant), before `setMode`, add:

```ts
  | { tag: "applyOplEdit"; edit: OplEdit }
```

- [ ] **Step 3: Add interpret case**

After the `refineThing` case (line 161-165), before `setMode`, add:

```ts
    case "applyOplEdit":
      return {
        type: "modelMutation",
        apply: (m) => applyOplEdit(m, cmd.edit),
      };
```

- [ ] **Step 4: Type check**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run`
Expected: 325 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/lib/commands.ts
git commit -m "feat(web): extend Command algebra with applyOplEdit summand"
```

---

### Task 2: Extract OplSentencesView from OplPanel

**Files:**
- Create: `packages/web/src/components/OplSentencesView.tsx`
- Modify: `packages/web/src/components/OplPanel.tsx` (temporary — will be refactored in Task 4)

- [ ] **Step 1: Create OplSentencesView.tsx**

Extract the existing OplPanel rendering logic into a new component. This is the full file:

```tsx
import type { Model } from "@opmodel/core";
import { expose, render, type OplSentence, type OplDocument } from "@opmodel/core";

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
}

function getEntityIds(sentence: OplSentence): string[] {
  switch (sentence.kind) {
    case "thing-declaration":
      return [sentence.thingId];
    case "state-enumeration":
      return [sentence.thingId];
    case "duration":
      return [sentence.thingId];
    case "link":
      return [sentence.linkId, sentence.sourceId, sentence.targetId];
    case "modifier":
      return [sentence.modifierId, sentence.linkId];
  }
}

function sentenceCategory(sentence: OplSentence): "thing" | "link" | "modifier" {
  switch (sentence.kind) {
    case "thing-declaration":
    case "state-enumeration":
    case "duration":
      return "thing";
    case "link":
      return "link";
    case "modifier":
      return "modifier";
  }
}

function renderSentence(sentence: OplSentence, doc: OplDocument): string {
  return render({ ...doc, sentences: [sentence] });
}

function sentenceClass(sentence: OplSentence, selectedThing: string | null): string {
  const ids = getEntityIds(sentence);
  const category = sentenceCategory(sentence);
  const base = `opl-sentence opl-sentence--${category}`;
  if (selectedThing && ids.includes(selectedThing)) {
    return `${base} opl-sentence--highlighted`;
  }
  return base;
}

export function OplSentencesView({ model, opdId, selectedThing }: Props) {
  const doc = expose(model, opdId);

  const thingSentences = doc.sentences.filter(
    (s): s is OplSentence =>
      s.kind === "thing-declaration" ||
      s.kind === "state-enumeration" ||
      s.kind === "duration"
  );
  const linkSentences = doc.sentences.filter(
    (s): s is OplSentence => s.kind === "link" || s.kind === "modifier"
  );

  return (
    <div className="opl-panel__content">
      {thingSentences.map((sentence, i) => (
        <div key={`t-${i}`} className={sentenceClass(sentence, selectedThing)}>
          {renderSentence(sentence, doc)}
        </div>
      ))}
      {thingSentences.length > 0 && linkSentences.length > 0 && <div className="opl-divider" />}
      {linkSentences.map((sentence, i) => (
        <div key={`l-${i}`} className={sentenceClass(sentence, selectedThing)}>
          {renderSentence(sentence, doc)}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update OplPanel.tsx to use OplSentencesView**

Replace entire `OplPanel.tsx` with:

```tsx
import { useState } from "react";
import type { Model } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { OplSentencesView } from "./OplSentencesView";

type OplTab = "sentences" | "text" | "editor";

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  dispatch: (cmd: Command) => boolean;
}

export function OplPanel({ model, opdId, selectedThing, dispatch }: Props) {
  const [activeTab, setActiveTab] = useState<OplTab>("sentences");
  const opd = model.opds.get(opdId);

  return (
    <aside className="opl-panel">
      <div className="opl-panel__title">
        OPL — {opd?.name ?? opdId}
      </div>
      <div className="opl-tabs">
        {(["sentences", "text", "editor"] as const).map((tab) => (
          <button
            key={tab}
            className={`opl-tab${activeTab === tab ? " opl-tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "sentences" ? "Sentences" : tab === "text" ? "Text" : "Editor"}
          </button>
        ))}
      </div>
      {activeTab === "sentences" && (
        <OplSentencesView model={model} opdId={opdId} selectedThing={selectedThing} />
      )}
      {activeTab === "text" && (
        <div className="opl-panel__content">
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Text view — coming next</p>
        </div>
      )}
      {activeTab === "editor" && (
        <div className="opl-panel__content">
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Editor — coming next</p>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Update App.tsx to pass dispatch to OplPanel**

In `packages/web/src/App.tsx`, line 153, change:

```tsx
<OplPanel model={model} opdId={ui.currentOpd} selectedThing={ui.selectedThing} />
```

to:

```tsx
<OplPanel model={model} opdId={ui.currentOpd} selectedThing={ui.selectedThing} dispatch={dispatch} />
```

Where `dispatch` comes from destructuring `store` on line 14.

- [ ] **Step 4: Add tab CSS to App.css**

After the `.opl-panel__title` block (after line 942), add:

```css
.opl-tabs {
  display: flex;
  gap: 0;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.opl-tab {
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.opl-tab:hover {
  color: var(--text-secondary);
}

.opl-tab--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
```

- [ ] **Step 5: Type check**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Visual verification**

Run: `cd packages/web && bunx vite`
Open browser. Verify:
- Tab bar shows "SENTENCES", "TEXT", "EDITOR"
- Sentences tab renders identically to before (same sentences, same highlight)
- Text and Editor tabs show placeholder text
- Tab switching works

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/OplSentencesView.tsx packages/web/src/components/OplPanel.tsx packages/web/src/App.tsx packages/web/src/App.css
git commit -m "feat(web): extract OplSentencesView and add tab shell to OplPanel"
```

---

## Chunk 2: OplTextView (copy-to-clipboard)

### Task 3: Create OplTextView component

**Files:**
- Create: `packages/web/src/components/OplTextView.tsx`
- Modify: `packages/web/src/components/OplPanel.tsx`
- Modify: `packages/web/src/App.css`

- [ ] **Step 1: Create OplTextView.tsx**

Full file:

```tsx
import { useState } from "react";
import type { Model } from "@opmodel/core";
import { expose, render } from "@opmodel/core";

interface Props {
  model: Model;
  opdId: string;
}

export function OplTextView({ model, opdId }: Props) {
  const [copied, setCopied] = useState(false);
  const doc = expose(model, opdId);
  const text = render(doc);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="opl-panel__content">
      <div className="opl-text__header">
        <button className={`opl-text__copy${copied ? " opl-text__copy--copied" : ""}`} onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="opl-text__pre">{text}</pre>
    </div>
  );
}
```

- [ ] **Step 2: Wire into OplPanel.tsx**

Add import at top:

```tsx
import { OplTextView } from "./OplTextView";
```

Replace the text placeholder:

```tsx
{activeTab === "text" && (
  <div className="opl-panel__content">
    <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Text view — coming next</p>
  </div>
)}
```

with:

```tsx
{activeTab === "text" && (
  <OplTextView model={model} opdId={opdId} />
)}
```

- [ ] **Step 3: Add text view CSS to App.css**

After the `.opl-tab--active` block, add:

```css
.opl-text__header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.opl-text__copy {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 10px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--accent);
  cursor: pointer;
  transition: all 0.15s;
}

.opl-text__copy:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
}

.opl-text__copy--copied {
  color: var(--success);
  border-color: var(--success);
}

.opl-text__pre {
  margin: 0;
  padding: 10px;
  background: var(--bg-surface);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-secondary);
}
```

- [ ] **Step 4: Type check**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Visual verification**

Run dev server. Verify:
- Text tab shows full OPL text in monospace
- Copy button works (check clipboard)
- "Copied!" feedback appears for 2 seconds
- Text wraps properly in narrow panel

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/OplTextView.tsx packages/web/src/components/OplPanel.tsx packages/web/src/App.css
git commit -m "feat(web): add OplTextView with copy-to-clipboard"
```

---

## Chunk 3: OplEditorView (the put direction)

### Task 4: Create OplEditorView component — form state and action selector

**Files:**
- Create: `packages/web/src/components/OplEditorView.tsx`
- Modify: `packages/web/src/components/OplPanel.tsx`
- Modify: `packages/web/src/App.css`

- [ ] **Step 1: Create OplEditorView.tsx with form state, action selector, and all 8 edit forms**

This is the largest component. Full file:

```tsx
import { useState, useMemo } from "react";
import type { Model, OplEdit, LinkType, ModifierType, Essence, Affiliation } from "@opmodel/core";
import { expose, render, applyOplEdit, isOk, type OplDocument } from "@opmodel/core";
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

  // For remove actions, find existing sentence
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

  // For add actions, build synthetic preview
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
      {/* Action selector */}
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

      {/* Dynamic fields per action */}
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

      {/* Preview */}
      {preview && (
        <div className="opl-editor__preview">
          <label className="opl-editor__label">Preview</label>
          <div className="opl-editor__preview-text">{preview}</div>
        </div>
      )}

      {/* Error */}
      {error && <div className="opl-editor__error">{error}</div>}

      {/* Apply button */}
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
```

- [ ] **Step 2: Wire into OplPanel.tsx**

Add import:

```tsx
import { OplEditorView } from "./OplEditorView";
```

Replace the editor placeholder:

```tsx
{activeTab === "editor" && (
  <div className="opl-panel__content">
    <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Editor — coming next</p>
  </div>
)}
```

with:

```tsx
{activeTab === "editor" && (
  <OplEditorView model={model} opdId={opdId} dispatch={dispatch} />
)}
```

- [ ] **Step 3: Add editor CSS to App.css**

After the text view CSS block, add:

```css
/* ─── Editor View ─── */

.opl-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opl-editor__field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.opl-editor__label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.opl-editor__select {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 11px;
  padding: 5px 6px;
  outline: none;
  cursor: pointer;
}

.opl-editor__select:focus {
  border-color: var(--accent);
}

.opl-editor__input {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
}

.opl-editor__input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(43, 108, 176, 0.1);
}

.opl-editor__radio-group {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.opl-editor__radio-group label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.opl-editor__checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.opl-editor__preview {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.opl-editor__preview-text {
  padding: 8px;
  background: var(--bg-surface);
  border-radius: 4px;
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.opl-editor__apply {
  margin-top: 6px;
  padding: 7px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.opl-editor__apply:hover:not(:disabled) {
  background: var(--accent-dim);
}

.opl-editor__apply:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.opl-editor__error {
  font-size: 11px;
  color: var(--danger);
  padding: 4px 0;
}

.opl-editor__warning {
  font-size: 10px;
  color: var(--warning);
}
```

- [ ] **Step 4: Type check**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Run all tests**

Run: `export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run`
Expected: 325 tests pass (core tests validate applyOplEdit still works).

- [ ] **Step 6: Visual verification**

Run dev server. Verify all 8 edit types:
1. **Add Thing:** Fill name, select kind/essence/affiliation → preview shows OPL sentence → Apply creates thing
2. **Remove Thing:** Select from dropdown → preview shows sentence → Apply removes
3. **Add States:** Select object, type comma-separated names → Apply adds states
4. **Remove State:** Cascading dropdowns (object → state) → Apply removes
5. **Add Link:** Select source, target, type → optional state selectors appear if states exist → Apply creates link
6. **Remove Link:** Dropdown shows `src → tgt (type)` → Apply removes
7. **Add Modifier:** Select link, type, negated checkbox → Apply adds
8. **Remove Modifier:** Dropdown shows `type on linkLabel` → Apply removes

Verify error case: try creating a link with source = target → inline error message.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/OplEditorView.tsx packages/web/src/components/OplPanel.tsx packages/web/src/App.css
git commit -m "feat(web): add OplEditorView with 8 OplEdit types, preview, and validation"
```

---

## Chunk 4: Final cleanup

### Task 5: Final integration verification

- [ ] **Step 1: Full type check**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Full test suite**

Run: `export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run`
Expected: 325 tests pass.

- [ ] **Step 3: End-to-end visual verification**

Run dev server. Full workflow:
1. Load Coffee Making example
2. Sentences tab: verify all sentences render with highlight on selection
3. Text tab: verify full OPL text, copy to clipboard works
4. Editor tab: add a new object "Sugar" → switch to Sentences tab → verify Sugar appears
5. Editor tab: add states "white, brown" to Sugar → verify in Sentences
6. Editor tab: add agent link Sugar → Boiling → verify in Sentences
7. Undo (Ctrl+Z) → verify link removed
8. Switch OPDs → verify tabs update correctly

- [ ] **Step 4: Build check**

Run: `cd packages/web && bunx vite build`
Expected: Build succeeds without errors.

- [ ] **Step 5: Final commit (if any cleanup needed)**

Only if adjustments were made during verification.
