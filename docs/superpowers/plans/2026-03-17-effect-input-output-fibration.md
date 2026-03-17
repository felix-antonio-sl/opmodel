# DA-8: Effect/Input-Output Fibration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `transformingMode` computed functor and fix the canvas rendering of effect links so input-output pairs, input-specified, and output-specified modes show ISO-correct directed arrows instead of bidirectional ↔.

**Architecture:** A pure function `transformingMode(link)` in `helpers.ts` classifies effect links into 4 modes. The canvas pipeline gains `adjustEffectEndpoints()` that swaps visual endpoints and/or splits input-output pairs into two directed segments. Routing and markers adapt per mode. Zero schema change.

**Tech Stack:** TypeScript, Vitest, React (OpdCanvas.tsx)

**Spec:** `docs/superpowers/specs/2026-03-17-effect-input-output-fibration-design.md`

---

## Task 1: `transformingMode` functor — tests

**Files:**
- Modify: `packages/core/tests/helpers.test.ts`

- [ ] **Step 1: Write 7 failing tests for `transformingMode`**

Extend the existing import from `../src/helpers` and add a `Link` type import. The existing import line is:

```typescript
import { cleanPatch, touch } from "../src/helpers";
```

Change it to:

```typescript
import { cleanPatch, touch, transformingMode } from "../src/helpers";
```

And add below it:

```typescript
import type { Link } from "../src/types";
```

Then add at the end of `helpers.test.ts`:

```typescript

const baseLink: Link = {
  id: "lnk-test", type: "effect", source: "proc-a", target: "obj-b",
};

describe("transformingMode", () => {
  it("returns 'effect' for effect link without states", () => {
    expect(transformingMode(baseLink)).toBe("effect");
  });

  it("returns 'input-specified' for effect link with source_state only", () => {
    expect(transformingMode({ ...baseLink, source_state: "s1" })).toBe("input-specified");
  });

  it("returns 'output-specified' for effect link with target_state only", () => {
    expect(transformingMode({ ...baseLink, target_state: "s2" })).toBe("output-specified");
  });

  it("returns 'input-output' for effect link with both states", () => {
    expect(transformingMode({ ...baseLink, source_state: "s1", target_state: "s2" })).toBe("input-output");
  });

  it("returns null for non-effect link", () => {
    expect(transformingMode({ ...baseLink, type: "consumption" })).toBeNull();
  });

  it("returns null for non-effect link even with states", () => {
    expect(transformingMode({ ...baseLink, type: "consumption", source_state: "s1" })).toBeNull();
  });

  it("treats empty string state as absent", () => {
    expect(transformingMode({ ...baseLink, source_state: "" })).toBe("effect");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/helpers.test.ts`
Expected: FAIL — `transformingMode` is not exported from `../src/helpers`

- [ ] **Step 3: Commit red tests**

```bash
git add packages/core/tests/helpers.test.ts
git commit -m "test(DA-8): red — 7 tests for transformingMode functor"
```

---

## Task 2: `transformingMode` functor — implementation

**Files:**
- Modify: `packages/core/src/helpers.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Implement `transformingMode` in helpers.ts**

Add at the end of `packages/core/src/helpers.ts`:

```typescript
import type { Link } from "./types";

export type TransformingMode = "effect" | "input-specified" | "output-specified" | "input-output";

export function transformingMode(link: Link): TransformingMode | null {
  if (link.type !== "effect") return null;
  const hasSource = !!link.source_state;
  const hasTarget = !!link.target_state;
  if (hasSource && hasTarget) return "input-output";
  if (hasSource) return "input-specified";
  if (hasTarget) return "output-specified";
  return "effect";
}
```

**Note:** `helpers.ts` currently imports only `Model` from `./types`. The new import adds `Link`. Check the existing import line and extend it:

```typescript
import type { Model, Link } from "./types";
```

- [ ] **Step 2: Re-export from index.ts**

In `packages/core/src/index.ts`, find the line:

```typescript
export { appearanceKey } from "./helpers";
```

Replace with:

```typescript
export { appearanceKey, transformingMode, type TransformingMode } from "./helpers";
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/helpers.test.ts`
Expected: 14 tests passing (7 existing + 7 new), 0 failures

- [ ] **Step 4: Run full suite to check for regressions**

Run: `bunx vitest run`
Expected: 570+ tests, 0 failures

- [ ] **Step 5: Commit green**

```bash
git add packages/core/src/helpers.ts packages/core/src/index.ts
git commit -m "feat(DA-8): transformingMode functor — 4 modes for effect links"
```

---

## Task 3: Canvas — `adjustEffectEndpoints` + pipeline integration

**Files:**
- Modify: `packages/web/src/components/OpdCanvas.tsx`

**Context:** The `visibleLinks` useMemo (line ~560) builds visual entries from resolved links. Currently step 2 handles DA-7 merged pairs. We add step 3: `adjustEffectEndpoints`.

- [ ] **Step 1: Add import of `transformingMode` at top of OpdCanvas.tsx**

Find the import from `@opmodel/core` (line 3):

```typescript
import { createInitialState, resolveLinksForOpd, findConsumptionResultPairs, type ModelState } from "@opmodel/core";
```

Add `transformingMode` to the import:

```typescript
import { createInitialState, resolveLinksForOpd, findConsumptionResultPairs, transformingMode, type ModelState } from "@opmodel/core";
```

- [ ] **Step 2: Define `adjustEffectEndpoints` function**

Add this function BEFORE the `OpdCanvas` component (after the `LINK_COLORS` constant block, around line 55). It operates on the same entry shape that the `visibleLinks` useMemo produces:

```typescript
/* ─── DA-8: Adjust effect link endpoints per transformingMode ─── */

function adjustEffectEndpoints(
  entries: {
    link: Link;
    modifier: Modifier | undefined;
    visualSource: string;
    visualTarget: string;
    labelOverride: string | undefined;
    isMergedPair: boolean;
    isInputHalf?: boolean;
    isOutputHalf?: boolean;
  }[],
  model: Model,
) {
  return entries.flatMap(entry => {
    const mode = transformingMode(entry.link);
    if (!mode || mode === "effect") return [entry];

    // Resolve object/process endpoints (I-33 guarantees object↔process)
    const srcThing = model.things.get(entry.visualSource);
    const objectId = srcThing?.kind === "object" ? entry.visualSource : entry.visualTarget;
    const processId = srcThing?.kind === "process" ? entry.visualSource : entry.visualTarget;

    switch (mode) {
      case "input-specified":
        return [{
          ...entry,
          visualSource: objectId,
          visualTarget: processId,
          isInputHalf: true as const,
        }];

      case "output-specified":
        return [{
          ...entry,
          visualSource: processId,
          visualTarget: objectId,
          isOutputHalf: true as const,
        }];

      case "input-output":
        return [
          {
            ...entry,
            link: { ...entry.link, target_state: undefined },
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true as const,
          },
        ];

      default:
        return [entry];
    }
  });
}
```

- [ ] **Step 3: Wire `adjustEffectEndpoints` into the `visibleLinks` pipeline**

Find the return statement of the `visibleLinks` useMemo (line ~595):

```typescript
    return entries
      .filter(e => !resultIds.has(e.link.id))
      .map(e => mergedEntries.get(e.link.id) ?? e);
```

Replace with:

```typescript
    const filtered = entries
      .filter(e => !resultIds.has(e.link.id))
      .map(e => mergedEntries.get(e.link.id) ?? e);

    return adjustEffectEndpoints(filtered, model);
```

- [ ] **Step 4: Run dev server and visually verify**

Run: `cd packages/web && bunx vite`

Open browser, load `driver-rescuing.opmodel`, navigate to SD1. Links should still render (no crashes). Visual direction changes come in Tasks 4-5.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/OpdCanvas.tsx
git commit -m "feat(DA-8): adjustEffectEndpoints pipeline step in canvas"
```

---

## Task 4: Canvas — markers per transformingMode

**Files:**
- Modify: `packages/web/src/components/OpdCanvas.tsx`

**Context:** The `LinkLine` function (line ~388) assigns markers per link type. Currently, `case "effect"` always sets both `markerStart` and `markerEnd` (bidirectional ↔). We need to check the mode and only use bidirectional for basic effect.

- [ ] **Step 1: Add `isInputHalf`/`isOutputHalf` props to `LinkLine`**

Find the LinkLine props destructuring (line ~388-406). Add the new props:

```typescript
function LinkLine({
  link,
  sourceRect,
  targetRect,
  sourceKind,
  targetKind,
  modifier,
  labelOverride,
  isMergedPair,
  isInputHalf,
  isOutputHalf,
}: {
  link: Link;
  sourceRect: Rect;
  targetRect: Rect;
  sourceKind: "object" | "process";
  targetKind: "object" | "process";
  modifier?: Modifier;
  labelOverride?: string;
  isMergedPair?: boolean;
  isInputHalf?: boolean;
  isOutputHalf?: boolean;
}) {
```

- [ ] **Step 2: Replace the `case "effect"` marker block**

Find (line ~435-438):

```typescript
    case "effect":
      markerEnd = "url(#arrow-proc)";       // ↔ bidirectional
      markerStart = "url(#arrow-proc)";
      break;
```

Replace with:

```typescript
    case "effect": {
      const isDirected = isInputHalf || isOutputHalf;
      if (isDirected) {
        markerEnd = "url(#arrow-proc)";       // → unidirectional
      } else {
        markerEnd = "url(#arrow-proc)";       // ↔ bidirectional
        markerStart = "url(#arrow-proc)";
      }
      break;
    }
```

- [ ] **Step 3: Pass the new props from the render site**

Find the `<LinkLine` JSX call (line ~911-919). Add the new props:

```typescript
                <LinkLine
                  link={link}
                  sourceRect={srcRect}
                  targetRect={tgtRect}
                  sourceKind={srcKindOverride ?? srcThing.kind}
                  targetKind={tgtKindOverride ?? tgtThing.kind}
                  modifier={modifier}
                  labelOverride={labelOverride}
                  isMergedPair={isMergedPair}
                  isInputHalf={isInputHalf}
                  isOutputHalf={isOutputHalf}
                />
```

This requires that `isInputHalf` and `isOutputHalf` are destructured from the `visibleLinks.map(...)` call. Find the destructuring (line ~825):

```typescript
          {visibleLinks.map(({ link, modifier, visualSource, visualTarget, labelOverride, isMergedPair }) => {
```

Add the new fields:

```typescript
          {visibleLinks.map(({ link, modifier, visualSource, visualTarget, labelOverride, isMergedPair, isInputHalf, isOutputHalf }) => {
```

- [ ] **Step 4: Fix React key collision for split halves**

When `input-output` mode splits one link into two entries, both share the same `link.id`, causing React key warnings. Find the `<g key={link.id}>` element (line ~910):

```typescript
              <g key={link.id} className={linkSimClass || undefined}>
```

Replace with a composite key that distinguishes halves:

```typescript
              <g key={isInputHalf ? `${link.id}__in` : isOutputHalf ? `${link.id}__out` : link.id} className={linkSimClass || undefined}>
```

- [ ] **Step 5: Visual verification**

Run dev server. Load `driver-rescuing.opmodel`, navigate to SD1:
- `lnk-callhandling-effect-danger` (endangered→safe): should now show → arrows (not ↔). Two segments visible (one for each half).
- `lnk-rescuing-effect-driver` (no states, in SD): should still show ↔ bidirectional.
- No React key warnings in browser console.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/OpdCanvas.tsx
git commit -m "feat(DA-8): per-mode markers — unidirectional for state-specified effects"
```

---

## Task 5: Canvas — routing `isOutputHalf` to target_state pill

**Files:**
- Modify: `packages/web/src/components/OpdCanvas.tsx`

**Context:** The routing block (line ~841-893) currently has two branches:
1. `if (link.type === "effect" || isMergedPair)` — routes `source_state` to object endpoint only
2. `else` — routes `source_state` to source, `target_state` to target (for non-effect links)

After `adjustEffectEndpoints`, input halves have `visualSource = objectId` and `source_state` set. The existing effect branch at line 841 routes `source_state` to the object endpoint — since `visualSource` is now the object, the routing sets `srcRect` to the pill. This works correctly for input halves.

For output halves, `visualSource = processId` and `visualTarget = objectId`. The link has `target_state` set but `source_state` is either cleared (split) or was never set (output-specified). The existing code does NOT route `target_state` for effect links (line 862: "target_state is NOT routed"). We need to add this routing.

- [ ] **Step 1: Add target_state routing for output halves**

Find the comment on line ~862:

```typescript
              // target_state (TO state) is NOT routed — it's the destination state, not a visual endpoint
```

Replace lines 841-862 (the body of the `if (link.type === "effect" || isMergedPair)` block, up to and including the `target_state` comment). **Preserve line 863 (`} else {`) and the entire non-effect routing branch below it unchanged.**

New content for lines 841-862:

```typescript
            if (link.type === "effect" || isMergedPair) {
              // Effect / merged consumption+result: route state-specified endpoints to pills
              const objectEnd = srcThing.kind === "object" ? visualSource : visualTarget;
              // Route source_state (FROM state) to object endpoint — used by isInputHalf and basic effect
              if (link.source_state) {
                const objApp = appearances.get(objectEnd);
                if (objApp) {
                  const ox = dragTarget === objectEnd ? dragDelta.x : 0;
                  const oy = dragTarget === objectEnd ? dragDelta.y : 0;
                  const adj = { x: objApp.x + ox, y: objApp.y + oy, w: objApp.w, h: objApp.h };
                  const allObjStates = statesForThing(model, objectEnd);
                  const visObjStates = objApp.suppressed_states
                    ? allObjStates.filter((s) => !objApp.suppressed_states!.includes(s.id))
                    : allObjStates;
                  const pill = statePillRect(adj, visObjStates, link.source_state);
                  if (pill) {
                    if (objectEnd === visualSource) { srcRect = pill; srcKindOverride = "object"; }
                    else { tgtRect = pill; tgtKindOverride = "object"; }
                  }
                }
              }
              // Route target_state (TO state) to object endpoint — used by isOutputHalf
              if (isOutputHalf && link.target_state) {
                const objApp = appearances.get(objectEnd);
                if (objApp) {
                  const ox = dragTarget === objectEnd ? dragDelta.x : 0;
                  const oy = dragTarget === objectEnd ? dragDelta.y : 0;
                  const adj = { x: objApp.x + ox, y: objApp.y + oy, w: objApp.w, h: objApp.h };
                  const allObjStates = statesForThing(model, objectEnd);
                  const visObjStates = objApp.suppressed_states
                    ? allObjStates.filter((s) => !objApp.suppressed_states!.includes(s.id))
                    : allObjStates;
                  const pill = statePillRect(adj, visObjStates, link.target_state);
                  if (pill) {
                    if (objectEnd === visualTarget) { tgtRect = pill; tgtKindOverride = "object"; }
                    else { srcRect = pill; srcKindOverride = "object"; }
                  }
                }
              }
```

**Note:** `isOutputHalf` must be available in this scope. It comes from the `visibleLinks.map()` destructuring (added in Task 4 Step 3).

**Known pre-existing issue:** The drag offset uses `dragTarget === objectEnd` instead of `draggedThings.has(objectEnd)`. This is inherited from the original code (line 848) and causes pills to not follow during container drag. Deferred to a separate fix — out of scope for DA-8.

- [ ] **Step 2: Run full test suite**

Run: `bunx vitest run`
Expected: 570+ tests, 0 failures

- [ ] **Step 3: Visual verification with both fixtures**

Run dev server. Check:

1. **driver-rescuing SD1**: `lnk-callhandling-effect-danger` — two → segments, each routed to its respective state pill ("endangered" and "safe")
2. **driver-rescuing SD1**: `lnk-calltrans-effect-call` — two → segments routed to "requested" and "online" pills
3. **driver-rescuing SD**: `lnk-rescuing-effect-driver` — ↔ bidirectional, no pill routing
4. **coffee-making SD1**: `lnk-boiling-effect-water` — two → segments routed to "cold" and "hot" pills

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/OpdCanvas.tsx
git commit -m "feat(DA-8): route isOutputHalf to target_state pill — ISO input-output visual"
```

---

## Task 6: Final verification + update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (DA table)

- [ ] **Step 1: Run full test suite one final time**

Run: `bunx vitest run`
Expected: 577+ tests (570 existing + 7 new), 0 failures

- [ ] **Step 2: Update DA table in CLAUDE.md**

Find the DA table in CLAUDE.md. Add DA-8:

```markdown
| DA-8 | Effect Fibration (effect ≅ 4 visual modes via transformingMode) | Implemented (transformingMode functor, adjustEffectEndpoints, per-mode markers+routing) |
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(DA-8): add Effect Fibration to DA table"
```

- [ ] **Step 4: Visual smoke test — all 4 modes**

Using browser, manually verify the 4 modes render correctly:
- `effect`: ↔ bidirectional, no pill routing
- `input-specified`: → from source_state pill to process
- `output-specified`: → from process to target_state pill
- `input-output`: two → segments (pill→process, process→pill)
