# Minimal Modeling Loop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the minimal modeling loop — create things, connect with links, edit properties, manage states, and save/export models — transforming the viewer into a fully functional OPM editor.

**Architecture:** Extend the existing Command Algebra (discriminated coproduct) with new commands. Each UI feature is a thin presentation layer that dispatches commands through η: Command → Effect. New editor modes (placement, link creation) are ephemeral UIState. Properties editing reuses existing `updateThingProps` command. Save uses `saveModel()` from core.

**Tech Stack:** React 19, TypeScript, SVG, @opmodel/core (saveModel, addThing, addLink, addState, removeState, removeThing), Vite

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/ids.ts` | Create | ID generation: `genId(prefix) → "prefix-xxxxxxxx"` |
| `src/lib/commands.ts` | Modify | +4 commands: addState, removeState, setMode, updateLink |
| `src/hooks/useModelStore.ts` | Modify | Extend UIState with `mode` + `linkSource`; expose `save()` |
| `src/components/Toolbar.tsx` | Create | Action bar: Add Object, Add Process, Add Link, Save |
| `src/components/PropertiesPanel.tsx` | Create | Inspector: thing props (essence, affiliation) + states list |
| `src/components/OpdCanvas.tsx` | Modify | Handle placement mode, link mode, Delete key |
| `src/App.tsx` | Modify | Wire Toolbar, PropertiesPanel, Delete shortcut |
| `src/App.css` | Modify | Styles for toolbar, properties, link mode feedback |

---

## Chunk 1: Foundation + Save + Delete

### Task 1: ID generation, command extensions, save, and delete

**Files:**
- Create: `packages/web/src/lib/ids.ts`
- Modify: `packages/web/src/lib/commands.ts`
- Modify: `packages/web/src/hooks/useModelStore.ts`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/App.css`

**Context:** The Command Algebra in `commands.ts` currently has 10 commands. We need to extend it with `addState`, `removeState`, `updateLink`, and `setMode`. We also need ID generation for creating new entities, a save/export function, and Delete key support.

- [ ] **Step 1: Create ID generation utility**

```typescript
// src/lib/ids.ts
export function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 2: Extend Command Algebra and UIState**

In `src/lib/commands.ts`, add to the `Command` type:

```typescript
| { tag: "addState"; state: { id: string; parent: string; name: string; initial: boolean; final: boolean; default: boolean } }
| { tag: "removeState"; stateId: string }
| { tag: "updateLink"; linkId: string; patch: Partial<Omit<Link, "id">> }
| { tag: "setMode"; mode: EditorMode }
```

Add at the top of the file:

```typescript
export type EditorMode = "select" | "addObject" | "addProcess" | "addLink";
```

Extend the `Effect` type:

```typescript
| { type: "uiTransition"; field: "mode"; value: EditorMode }
| { type: "uiTransition"; field: "linkSource"; value: string | null }
```

Add cases to `interpret()`:

```typescript
case "addState":
  return {
    type: "modelMutation",
    apply: (m) => addState(m, cmd.state as any),
  };

case "removeState":
  return {
    type: "modelMutation",
    apply: (m) => removeState(m, cmd.stateId),
  };

case "updateLink":
  return {
    type: "modelMutation",
    apply: (m) => updateLink(m, cmd.linkId, cmd.patch),
  };

case "setMode":
  return { type: "uiTransition", field: "mode", value: cmd.mode };
```

Add `addState`, `removeState`, `updateLink` to the imports from `@opmodel/core`.

- [ ] **Step 3: Extend UIState in useModelStore**

In `src/hooks/useModelStore.ts`, extend UIState:

```typescript
import type { EditorMode } from "../lib/commands";

export interface UIState {
  currentOpd: string;
  selectedThing: string | null;
  mode: EditorMode;
  linkSource: string | null;
}
```

Update initial state:

```typescript
const [ui, setUi] = useState<UIState>({
  currentOpd: "opd-sd",
  selectedThing: null,
  mode: "select",
  linkSource: null,
});
```

Add `save` to ModelStore interface and implementation:

```typescript
import { saveModel } from "@opmodel/core";

export interface ModelStore {
  // ... existing fields ...
  save: () => void;
}
```

Implementation:

```typescript
const save = useCallback(() => {
  const json = saveModel(history.present);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${history.present.meta.name.toLowerCase().replace(/\s+/g, "-")}.opmodel`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}, [history]);
```

Return `save` in the returned object.

- [ ] **Step 4: Add Save button to header and Delete shortcut**

In `src/App.tsx`, destructure `save` from store. Add to the header actions (next to undo/redo):

```tsx
<button className="header__action" onClick={save} title="Save (Ctrl+S)">
  ⤓
</button>
```

Add Delete and Ctrl+S shortcuts to `handleKeyDown`:

```typescript
if ((e.metaKey || e.ctrlKey) && e.key === "s") {
  e.preventDefault();
  save();
}
if ((e.key === "Delete" || e.key === "Backspace") && ui.selectedThing && !e.metaKey && !e.ctrlKey) {
  e.preventDefault();
  dispatch({ tag: "removeThing", thingId: ui.selectedThing });
}
```

- [ ] **Step 5: Add separator between action groups in CSS**

In `src/App.css`, add:

```css
.header__actions + .header__sep + .header__actions {
  margin-left: 0;
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Test save — load app, click save, verify .opmodel downloads**

Run: open `http://localhost:5173`, click save button (⤓). Verify JSON file downloads.
Run: Ctrl+S should also trigger save.

- [ ] **Step 8: Test delete — select a thing, press Delete, verify removal + undo**

Select "Barista" → press Delete → should disappear from canvas, tree, OPL.
Press Cmd+Z → should reappear.

- [ ] **Step 9: Run all tests**

Run: `bunx vitest run` from workspace root
Expected: 216 tests passing (no regressions)

- [ ] **Step 10: Commit**

```bash
git add packages/web/src/lib/ids.ts packages/web/src/lib/commands.ts packages/web/src/hooks/useModelStore.ts packages/web/src/App.tsx packages/web/src/App.css
git commit -m "feat(web): add save/export, delete thing, extend command algebra

Add ID generation utility, extend Command Algebra with addState,
removeState, updateLink, setMode. Add save/export via Blob download
(Ctrl+S). Add Delete key to remove selected thing. Extend UIState
with editor mode and linkSource for upcoming creation features."
```

---

## Chunk 2: Toolbar + Add Thing

### Task 2: Toolbar component and thing placement mode

**Files:**
- Create: `packages/web/src/components/Toolbar.tsx`
- Modify: `packages/web/src/components/OpdCanvas.tsx`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/App.css`

**Context:** The editor needs a toolbar below the header to trigger creation actions. When user clicks "Add Object" or "Add Process", the editor enters placement mode. Next click on canvas creates the thing at that position and returns to select mode. The `addThing` command already exists in `commands.ts` and chains `addThing()` + `addAppearance()` from core.

- [ ] **Step 1: Create Toolbar component**

```tsx
// src/components/Toolbar.tsx
import type { EditorMode, Command } from "../lib/commands";

interface Props {
  mode: EditorMode;
  dispatch: (cmd: Command) => void;
}

export function Toolbar({ mode, dispatch }: Props) {
  const btn = (m: EditorMode, label: string, title: string) => (
    <button
      className={`toolbar__btn${mode === m ? " toolbar__btn--active" : ""}`}
      onClick={() => dispatch({ tag: "setMode", mode: mode === m ? "select" : m })}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div className="toolbar">
      <div className="toolbar__group">
        {btn("addObject", "▭ Object", "Add Object (O)")}
        {btn("addProcess", "⬭ Process", "Add Process (P)")}
      </div>
      <div className="toolbar__sep" />
      <div className="toolbar__group">
        {btn("addLink", "↗ Link", "Add Link (L)")}
      </div>
      {mode !== "select" && (
        <div className="toolbar__hint">
          {mode === "addLink" ? "Click source thing, then target" : "Click on canvas to place"}
          <button
            className="toolbar__cancel"
            onClick={() => dispatch({ tag: "setMode", mode: "select" })}
          >
            Esc to cancel
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add toolbar styles to App.css**

```css
/* ═══════════════════
   Toolbar
   ═══════════════════ */

.toolbar {
  grid-area: toolbar;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  height: 32px;
  user-select: none;
}

.toolbar__group {
  display: flex;
  gap: 2px;
}

.toolbar__btn {
  padding: 3px 10px;
  font-family: var(--font-ui);
  font-size: 11px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar__btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.toolbar__btn--active {
  background: var(--accent-glow);
  border-color: var(--accent-dim);
  color: var(--accent);
}

.toolbar__sep {
  width: 1px;
  height: 16px;
  background: var(--border);
}

.toolbar__hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar__cancel {
  font-size: 10px;
  padding: 1px 6px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--text-muted);
  cursor: pointer;
}

.toolbar__cancel:hover {
  border-color: var(--danger);
  color: var(--danger);
}
```

- [ ] **Step 3: Update App.tsx grid layout to include toolbar**

Change the grid in App.tsx:

```tsx
// Add --toolbar-h to CSS: 32px
// Update grid-template-rows: var(--header-h) 32px 1fr var(--status-h)
// Update grid-template-areas:
//   "header  header  header"
//   "tree    toolbar toolbar"
//   "tree    canvas  opl"
//   "status  status  status"
```

Add Toolbar import and render between header and panels:

```tsx
import { Toolbar } from "./components/Toolbar";

// In Editor render, add after header:
<Toolbar mode={ui.mode} dispatch={dispatch} />
```

Add Escape and O/P/L keyboard shortcuts:

```typescript
if (e.key === "Escape") {
  dispatch({ tag: "setMode", mode: "select" });
}
if (!e.metaKey && !e.ctrlKey && e.target === document.body) {
  if (e.key === "o") dispatch({ tag: "setMode", mode: "addObject" });
  if (e.key === "p") dispatch({ tag: "setMode", mode: "addProcess" });
  if (e.key === "l") dispatch({ tag: "setMode", mode: "addLink" });
}
```

- [ ] **Step 4: Handle placement click in OpdCanvas**

In `OpdCanvas.tsx`, receive `mode` from props (add to Props interface):

```typescript
interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  mode: EditorMode;
  dispatch: (cmd: Command) => void;
}
```

Import `genId`:

```typescript
import { genId } from "../lib/ids";
```

In `onCanvasClick`, before the deselect logic, add placement handling:

```typescript
const onCanvasClick = useCallback(
  (e: React.MouseEvent) => {
    if (dragTarget) return;

    if (mode === "addObject" || mode === "addProcess") {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const x = (e.clientX - svgRect.left - pan.x) / zoom;
      const y = (e.clientY - svgRect.top - pan.y) / zoom;
      const kind = mode === "addObject" ? "object" : "process";
      const prefix = kind === "object" ? "obj" : "proc";
      const id = genId(prefix);

      dispatch({
        tag: "addThing",
        thing: {
          id,
          kind,
          name: `New ${kind.charAt(0).toUpperCase() + kind.slice(1)}`,
          essence: "informatical",
          affiliation: "systemic",
        },
        opdId,
        x: Math.round(x - 60),
        y: Math.round(y - 25),
        w: 120,
        h: 50,
      });
      dispatch({ tag: "selectThing", thingId: id });
      dispatch({ tag: "setMode", mode: "select" });
      return;
    }

    dispatch({ tag: "selectThing", thingId: null });
    setRenaming(null);
  },
  [dragTarget, mode, pan, zoom, opdId, dispatch],
);
```

Update cursor class to reflect mode:

```typescript
const cursorClass = dragTarget
  ? "opd-canvas--dragging"
  : mode === "addObject" || mode === "addProcess"
    ? "opd-canvas--placing"
    : mode === "addLink"
      ? "opd-canvas--linking"
      : "";
```

- [ ] **Step 5: Add cursor styles for placement and link modes**

```css
.opd-canvas--placing {
  cursor: crosshair !important;
}

.opd-canvas--linking {
  cursor: cell !important;
}
```

- [ ] **Step 6: Pass mode to OpdCanvas from App.tsx**

```tsx
<OpdCanvas
  model={model}
  opdId={ui.currentOpd}
  selectedThing={ui.selectedThing}
  mode={ui.mode}
  dispatch={dispatch}
/>
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Test — click Add Object, click on canvas, verify thing appears**

1. Click "▭ Object" in toolbar → button highlights, cursor becomes crosshair
2. Click on empty canvas area → new object "New Object" appears
3. Verify it's selected, shows in tree and OPL
4. Undo → thing disappears
5. Repeat with "⬭ Process"

- [ ] **Step 9: Run tests and commit**

```bash
bunx vitest run
git add packages/web/src/
git commit -m "feat(web): add toolbar with thing creation (placement mode)

Add Toolbar component with Add Object/Add Process/Add Link buttons.
Placement mode: click toolbar → click canvas → thing created at
position → returns to select mode. Keyboard shortcuts O/P/L/Esc."
```

---

### Task 3: Link creation mode

**Files:**
- Modify: `packages/web/src/components/OpdCanvas.tsx`
- Modify: `packages/web/src/App.css`

**Context:** When user activates "Add Link" mode (toolbar or L key), they click a source thing, then a target thing. A default link is created between them. The `addLink` command already exists in `commands.ts`. Link source tracking uses local state in OpdCanvas.

- [ ] **Step 1: Add link creation state to OpdCanvas**

Add local state for link creation:

```typescript
const [linkSource, setLinkSource] = useState<string | null>(null);
```

- [ ] **Step 2: Handle thing clicks in link mode**

Modify the `onSelect` handler in the ThingNode rendering. In the `onClick` on ThingNode:

```typescript
onClick={(e) => {
  e.stopPropagation();
  if (mode === "addLink") {
    if (!linkSource) {
      // First click — set source
      setLinkSource(thingId);
      dispatch({ tag: "selectThing", thingId });
    } else if (linkSource !== thingId) {
      // Second click — create link
      const srcThing = model.things.get(linkSource);
      const tgtThing = model.things.get(thingId);
      // Default type: agent if source is object+target is process, else effect
      let linkType: string = "agent";
      if (srcThing?.kind === "process") linkType = "effect";
      if (srcThing?.kind === "object" && tgtThing?.kind === "object") linkType = "aggregation";

      dispatch({
        tag: "addLink",
        link: {
          id: genId("lnk"),
          type: linkType as any,
          source: linkSource,
          target: thingId,
        },
      });
      setLinkSource(null);
      dispatch({ tag: "setMode", mode: "select" });
    }
    return;
  }
  dispatch({
    tag: "selectThing",
    thingId: selectedThing === thingId ? null : thingId,
  });
}}
```

- [ ] **Step 3: Reset link source on mode change or Escape**

Add useEffect to clear linkSource when mode changes:

```typescript
useEffect(() => {
  if (mode !== "addLink") setLinkSource(null);
}, [mode]);
```

- [ ] **Step 4: Visual feedback for link source selection**

In the ThingNode rendering, add visual hint for link source:

```typescript
const isLinkSource = linkSource === thingId;

// In the className:
const className = `thing-group${isSelected ? " thing-group--selected" : ""}${isDragging ? " thing-group--dragging" : ""}${isLinkSource ? " thing-group--link-source" : ""}`;
```

Add CSS:

```css
.thing-group--link-source .thing-shape {
  stroke: var(--accent) !important;
  stroke-width: 2.5;
  stroke-dasharray: 6,3;
  animation: pulse-link 1s ease-in-out infinite;
}

@keyframes pulse-link {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

- [ ] **Step 5: Prevent pan during link mode canvas click**

In `onCanvasClick`, when in addLink mode and clicking empty space, reset link source instead of deselecting:

```typescript
if (mode === "addLink") {
  setLinkSource(null);
  return;
}
```

- [ ] **Step 6: Verify and test link creation**

1. Click "↗ Link" in toolbar
2. Click "Barista" → it pulses with dashed amber stroke
3. Click "Coffee Making" → agent link created between them
4. Verify link appears in canvas and OPL
5. Undo → link disappears
6. Press Escape → exits link mode

- [ ] **Step 7: Run tests and commit**

```bash
bunx vitest run
git add packages/web/src/
git commit -m "feat(web): add link creation mode (click source → click target)

In addLink mode, click source thing (pulses with dashed amber),
click target → link created with auto-detected type (agent for
object→process, effect for process→*, aggregation for object→object).
Escape cancels. Click empty canvas resets source."
```

---

## Chunk 2: Properties + State Editing

### Task 4: Properties panel

**Files:**
- Create: `packages/web/src/components/PropertiesPanel.tsx`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/App.css`

**Context:** When a thing is selected, the right panel should show editable properties (name, essence, affiliation) plus a list of its states. Uses the existing `updateThingProps` command. The OPL panel moves below or becomes a tab.

- [ ] **Step 1: Create PropertiesPanel component**

```tsx
// src/components/PropertiesPanel.tsx
import { useState } from "react";
import type { Model, Thing, State, Link } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { genId } from "../lib/ids";

interface Props {
  model: Model;
  thingId: string;
  opdId: string;
  dispatch: (cmd: Command) => void;
}

function statesOf(model: Model, thingId: string): State[] {
  return [...model.states.values()]
    .filter((s) => s.parent === thingId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function linksOf(model: Model, thingId: string): Link[] {
  return [...model.links.values()]
    .filter((l) => l.source === thingId || l.target === thingId);
}

export function PropertiesPanel({ model, thingId, opdId, dispatch }: Props) {
  const thing = model.things.get(thingId);
  if (!thing) return null;

  const states = statesOf(model, thingId);
  const links = linksOf(model, thingId);

  return (
    <div className="props-panel">
      <div className="props-panel__title">Properties</div>

      <div className="props-panel__section">
        <label className="props-panel__label">Name</label>
        <input
          className="props-panel__input"
          value={thing.name}
          onChange={(e) =>
            dispatch({ tag: "renameThing", thingId, name: e.target.value })
          }
        />
      </div>

      <div className="props-panel__row">
        <div className="props-panel__section">
          <label className="props-panel__label">Kind</label>
          <div className="props-panel__value">{thing.kind}</div>
        </div>
        <div className="props-panel__section">
          <label className="props-panel__label">Essence</label>
          <select
            className="props-panel__select"
            value={thing.essence}
            onChange={(e) =>
              dispatch({
                tag: "updateThingProps",
                thingId,
                patch: { essence: e.target.value as "physical" | "informatical" },
              })
            }
          >
            <option value="physical">physical</option>
            <option value="informatical">informatical</option>
          </select>
        </div>
      </div>

      <div className="props-panel__section">
        <label className="props-panel__label">Affiliation</label>
        <select
          className="props-panel__select"
          value={thing.affiliation}
          onChange={(e) =>
            dispatch({
              tag: "updateThingProps",
              thingId,
              patch: { affiliation: e.target.value as "systemic" | "environmental" },
            })
          }
        >
          <option value="systemic">systemic</option>
          <option value="environmental">environmental</option>
        </select>
      </div>

      {/* States section — only for objects */}
      {thing.kind === "object" && (
        <div className="props-panel__states">
          <div className="props-panel__states-header">
            <span className="props-panel__label">States ({states.length})</span>
            <button
              className="props-panel__add-btn"
              onClick={() =>
                dispatch({
                  tag: "addState",
                  state: {
                    id: genId("state"),
                    parent: thingId,
                    name: `state${states.length + 1}`,
                    initial: states.length === 0,
                    final: false,
                    default: states.length === 0,
                  },
                })
              }
            >
              + State
            </button>
          </div>
          {states.map((s) => (
            <StateRow key={s.id} state={s} dispatch={dispatch} />
          ))}
        </div>
      )}

      {/* Links summary */}
      {links.length > 0 && (
        <div className="props-panel__section">
          <span className="props-panel__label">Links ({links.length})</span>
          {links.map((l) => {
            const other = l.source === thingId ? l.target : l.source;
            const otherName = model.things.get(other)?.name ?? other;
            const dir = l.source === thingId ? "→" : "←";
            return (
              <div key={l.id} className="props-panel__link-row">
                <span className="props-panel__link-type">{l.type}</span>
                <span>{dir} {otherName}</span>
                <button
                  className="props-panel__remove-btn"
                  onClick={() => dispatch({ tag: "removeLink", linkId: l.id })}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="props-panel__delete-btn"
        onClick={() => dispatch({ tag: "removeThing", thingId })}
      >
        Delete {thing.kind}
      </button>
    </div>
  );
}

function StateRow({ state, dispatch }: { state: State; dispatch: (cmd: Command) => void }) {
  return (
    <div className="props-panel__state-row">
      <span className="props-panel__state-name">{state.name}</span>
      <span className="props-panel__state-flags">
        {state.initial && "I"}
        {state.default && "D"}
        {state.current && "●"}
      </span>
      <button
        className="props-panel__remove-btn"
        onClick={() => dispatch({ tag: "removeState", stateId: state.id })}
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add PropertiesPanel styles**

```css
/* ═══════════════════
   Properties Panel
   ═══════════════════ */

.props-panel {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--border);
}

.props-panel__title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.props-panel__section {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.props-panel__row {
  display: flex;
  gap: 10px;
}

.props-panel__row > * {
  flex: 1;
}

.props-panel__label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.props-panel__value {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 0;
}

.props-panel__input {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 4px 8px;
  outline: none;
}

.props-panel__input:focus {
  border-color: var(--accent-dim);
}

.props-panel__select {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 6px;
  outline: none;
  cursor: pointer;
}

.props-panel__select:focus {
  border-color: var(--accent-dim);
}

.props-panel__states {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.props-panel__states-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.props-panel__add-btn {
  font-size: 10px;
  padding: 2px 8px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--accent-dim);
  cursor: pointer;
  transition: all 0.15s;
}

.props-panel__add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.props-panel__state-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: var(--bg-surface);
  border-radius: 3px;
  font-size: 11px;
}

.props-panel__state-name {
  flex: 1;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.props-panel__state-flags {
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.props-panel__link-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.props-panel__link-type {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  min-width: 70px;
}

.props-panel__remove-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  line-height: 1;
  margin-left: auto;
}

.props-panel__remove-btn:hover {
  color: var(--danger);
}

.props-panel__delete-btn {
  margin-top: 6px;
  padding: 5px 12px;
  background: transparent;
  border: 1px solid var(--danger);
  border-radius: 3px;
  color: var(--danger);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.props-panel__delete-btn:hover {
  background: rgba(217, 79, 79, 0.1);
}
```

- [ ] **Step 3: Wire PropertiesPanel into App.tsx**

Modify the right panel area. Replace the standalone `<OplPanel>` with a right panel container:

```tsx
import { PropertiesPanel } from "./components/PropertiesPanel";

// In Editor render, replace <OplPanel.../> with:
<aside className="right-panel">
  {ui.selectedThing && (
    <PropertiesPanel
      model={model}
      thingId={ui.selectedThing}
      opdId={ui.currentOpd}
      dispatch={dispatch}
    />
  )}
  <OplPanel model={model} opdId={ui.currentOpd} selectedThing={ui.selectedThing} />
</aside>
```

Update OplPanel grid area class:

```css
.right-panel {
  grid-area: opl;
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
```

Remove `grid-area: opl` from `.opl-panel` (the right-panel wrapper now has it).

- [ ] **Step 4: Verify TypeScript compiles and test**

Run: `cd packages/web && bunx tsc --noEmit`

Test:
1. Click a thing → Properties panel appears above OPL
2. Change essence to "physical" → stroke thickness changes on canvas (2.5px)
3. Change affiliation to "environmental" → dashed stroke appears
4. Undo each change
5. Click away → Properties panel disappears, only OPL visible

- [ ] **Step 5: Run tests and commit**

```bash
bunx vitest run
git add packages/web/src/
git commit -m "feat(web): add properties panel with essence/affiliation editing

PropertiesPanel shows when thing selected: name input, essence and
affiliation dropdowns, states list, links summary with delete, and
delete thing button. Right panel is now a flex container with
PropertiesPanel (conditional) + OplPanel (always visible)."
```

---

### Task 5: State editing in properties panel

**Files:**
- Modify: `packages/web/src/components/PropertiesPanel.tsx`

**Context:** The PropertiesPanel from Task 4 already shows states and has "Add State" and remove buttons. The `addState` and `removeState` commands were added in Task 1. This task verifies the full flow works and adds inline state renaming.

- [ ] **Step 1: Add inline state name editing**

Update `StateRow` to support inline editing:

```tsx
function StateRow({ state, dispatch }: { state: State; dispatch: (cmd: Command) => void }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="props-panel__state-row">
      {editing ? (
        <input
          className="props-panel__state-input"
          defaultValue={state.name}
          autoFocus
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val && val !== state.name) {
              // Use updateThingProps wouldn't work for states.
              // We need a dedicated command or use the generic approach.
              // For now, remove + re-add with new name (atomic via undo).
            }
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <span
          className="props-panel__state-name"
          onDoubleClick={() => setEditing(true)}
        >
          {state.name}
        </span>
      )}
      <span className="props-panel__state-flags">
        {state.initial && "I"}
        {state.default && "D"}
        {state.current && "●"}
      </span>
      <button
        className="props-panel__remove-btn"
        onClick={() => dispatch({ tag: "removeState", stateId: state.id })}
      >
        ×
      </button>
    </div>
  );
}
```

Add state input styles:

```css
.props-panel__state-input {
  flex: 1;
  background: var(--bg-active);
  border: 1px solid var(--accent-dim);
  border-radius: 2px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 4px;
  outline: none;
}
```

Note: Full state renaming requires an `updateState` command which already exists in the core but isn't wired in commands.ts. The implementer should add an `updateState` command if needed, or use the simpler remove+re-add approach.

- [ ] **Step 2: Test state creation and deletion**

1. Select "Coffee" (has states: unmade, ready)
2. Click "+ State" → new state appears in list and on canvas
3. Click × on a state → state removed from list and canvas
4. Undo → state reappears
5. Verify canvas re-renders state pills correctly

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/
git commit -m "feat(web): add state editing (add/remove/rename) in properties panel

States section shows for objects with inline name editing
(double-click), add and remove buttons. All operations are undoable."
```

---

## Chunk 3: Polish and Integration

### Task 6: OPD navigation verification, integration testing, final polish

**Files:**
- Modify: `packages/web/src/App.css` (minor polish)
- Modify: `packages/web/src/components/OpdCanvas.tsx` (minor)

**Context:** OPD navigation already works via the tree (selectOpd dispatches through η). This task verifies the full integration, fixes any edge cases, and ensures all features work together.

- [ ] **Step 1: Verify OPD navigation**

1. Click "SD1" in OPD tree → canvas should show only things with appearances in SD1
2. Click "SD" → back to root diagram
3. Verify things list in tree updates when OPD changes
4. Verify OPL updates when OPD changes

- [ ] **Step 2: Test full modeling loop**

Perform this complete workflow:

1. Start fresh (reload app)
2. Click "Add Object" → click canvas → "New Object" appears
3. Double-click to rename it "Grinder"
4. Select it → change essence to "physical" in Properties
5. Click "Add Process" → click canvas → "New Process" appears
6. Rename it "Grinding"
7. Click "Add Link" → click Grinder → click Grinding → link created
8. Verify OPL shows: "Grinder handles Grinding."
9. Ctrl+S → save file downloads
10. Multiple Ctrl+Z → undo everything back to original state
11. Multiple Ctrl+Shift+Z → redo everything back

- [ ] **Step 3: Add visual feedback — mode indicator in status bar**

In App.tsx, add mode indicator to status bar:

```tsx
{ui.mode !== "select" && (
  <>
    <span className="status-bar__mode">
      {ui.mode === "addObject" ? "Add Object" : ui.mode === "addProcess" ? "Add Process" : "Add Link"}
    </span>
    <div className="status-bar__sep" />
  </>
)}
```

Add CSS:

```css
.status-bar__mode {
  color: var(--accent);
  font-weight: 500;
}
```

- [ ] **Step 4: Run all tests, verify TypeScript**

```bash
cd /Users/felixsanhueza/Developer/_workspaces/opmodel
bunx vitest run
cd packages/web && bunx tsc --noEmit
```

Expected: 216+ tests passing, 0 TS errors

- [ ] **Step 5: Final commit**

```bash
git add packages/web/src/
git commit -m "feat(web): complete minimal modeling loop

Verified: create things, connect with links, edit properties,
manage states, navigate OPDs, save/export. Full undo/redo support
for all operations. Mode indicator in status bar."
```

---

## Verification Checklist

After all tasks complete, verify:

| Feature | Test |
|---------|------|
| Save/Export | Ctrl+S downloads valid .opmodel JSON |
| Delete thing | Select + Delete key removes thing, links, appearances |
| Add Object | Toolbar → click canvas → object appears |
| Add Process | Toolbar → click canvas → process appears |
| Add Link | Toolbar → click source → click target → link created |
| Edit essence | Properties dropdown → stroke changes on canvas |
| Edit affiliation | Properties dropdown → dash pattern changes |
| Add state | Properties + State → state pill appears on canvas |
| Remove state | Properties × → state pill disappears |
| OPD navigation | Tree click → canvas shows correct fiber |
| Undo all | Cmd+Z through entire history |
| Redo all | Cmd+Shift+Z restores |
| Keyboard shortcuts | O, P, L, Escape, Delete, Cmd+Z, Cmd+S |

---

## Summary

| Task | Files | New LOC (est) |
|------|-------|---------------|
| 1. Foundation + Save + Delete | ids.ts, commands.ts, useModelStore.ts, App.tsx, App.css | ~80 |
| 2. Toolbar + Add Thing | Toolbar.tsx, OpdCanvas.tsx, App.tsx, App.css | ~150 |
| 3. Add Link mode | OpdCanvas.tsx, App.css | ~80 |
| 4. Properties Panel | PropertiesPanel.tsx, App.tsx, App.css | ~250 |
| 5. State Editing | PropertiesPanel.tsx, App.css | ~30 |
| 6. Polish + Integration | App.tsx, App.css | ~20 |
| **Total** | **8 files (2 new, 6 modified)** | **~610 LOC** |
