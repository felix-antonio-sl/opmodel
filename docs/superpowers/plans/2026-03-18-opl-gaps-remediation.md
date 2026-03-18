# OPL Gaps Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 6 OPL gaps (GAP-OPL-02..07) by extending the OPL AST with 4 new sentence types and fixing 1 existing rendering, achieving ISO 19450 compliance for state descriptions, grouped structural links, exhibition feature declarations, in-zoom sequences, and instrument link form.

**Architecture:** Extend `OplSentence` union from 5 to 9 variants. `expose()` gains: exhibition feature lookup, state-description emission, grouped structural phase, in-zoom sequence detection, attribute-value emission. `renderSentence()` gains 4 new cases + 1 fix. `editsFrom()` gains: state qualifier enrichment, grouped structural desfold.

**Tech Stack:** TypeScript, Vitest, Bun workspaces. All changes in `packages/core/`.

**Spec:** `docs/superpowers/specs/2026-03-18-opl-gaps-remediation-design.md`

**Run tests:** `bunx vitest run` (from repo root, requires `export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"`)

**Baseline:** 586 tests passing on 77 commits.

---

### Task 1: GAP-OPL-06 — Instrument Link Form Fix

**Files:**
- Modify: `packages/core/src/opl.ts:184`
- Modify: `packages/core/tests/driver-rescuing.test.ts:77-78`
- Test: `packages/core/tests/opl.test.ts`

- [ ] **Step 1: Write the failing test**

In `packages/core/tests/opl.test.ts`, add after the "renders effect link with states" test (around line 195):

```typescript
it("renders non-state-specified instrument as 'Process requires Instrument'", () => {
  let m = buildModel();
  let r = addLink(m, { id: "lnk-cup-instrument-boiling", type: "instrument", source: "obj-cup", target: "proc-boiling" });
  if (!isOk(r)) throw r.error; m = r.value;
  const doc = expose(m, "opd-sd");
  const text = render(doc);
  expect(text).toContain("Boiling requires Cup.");
  expect(text).not.toContain("is an instrument of");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: FAIL — "Boiling requires Cup." not found, gets "Cup is an instrument of Boiling." instead

- [ ] **Step 3: Fix the instrument rendering**

In `packages/core/src/opl.ts`, change line 184 from:
```typescript
return `${s.sourceName} is an instrument of ${s.targetName}.`;
```
to:
```typescript
return `${s.targetName} requires ${s.sourceName}.`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: PASS

- [ ] **Step 5: Update driver-rescuing integration test**

In `packages/core/tests/driver-rescuing.test.ts`, change lines 77-78 from:
```typescript
// Non-state-specified instrument renders as "X is an instrument of Y" (GAP-OPL-06: ISO uses "requires")
expect(text).toContain("OnStar System is an instrument of Driver Rescuing.");
```
to:
```typescript
// ISO §9.2.3: "Processing requires Instrument."
expect(text).toContain("Driver Rescuing requires OnStar System.");
```

- [ ] **Step 6: Run all tests**

Run: `bunx vitest run`
Expected: 586 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/opl.ts packages/core/tests/opl.test.ts packages/core/tests/driver-rescuing.test.ts
git commit -m "fix(opl): instrument link ISO form — 'Process requires Instrument' (GAP-OPL-06)"
```

---

### Task 2: AST Extension — New Types in opl-types.ts

**Files:**
- Modify: `packages/core/src/opl-types.ts`

- [ ] **Step 1: Add OplStateDescription interface**

In `packages/core/src/opl-types.ts`, after the `OplDuration` interface (line 34), add:

```typescript
export interface OplStateDescription {
  kind: "state-description";
  thingId: string;
  thingName: string;
  stateId: string;
  stateName: string;
  initial: boolean;
  final: boolean;
  default: boolean;
  exhibitorName?: string;
}
```

- [ ] **Step 2: Add OplGroupedStructuralSentence interface**

After `OplModifierSentence`, add:

```typescript
export interface OplGroupedStructuralSentence {
  kind: "grouped-structural";
  linkType: "aggregation" | "exhibition" | "generalization" | "classification";
  parentId: string;
  parentName: string;
  parentKind: Kind;
  childIds: string[];
  childNames: string[];
  childKinds: Kind[];
  incomplete: boolean;
}
```

- [ ] **Step 3: Add OplInZoomSequence interface**

```typescript
export interface OplInZoomSequence {
  kind: "in-zoom-sequence";
  parentId: string;
  parentName: string;
  steps: {
    thingIds: string[];
    thingNames: string[];
    parallel: boolean;
  }[];
}
```

- [ ] **Step 4: Add OplAttributeValue interface**

```typescript
export interface OplAttributeValue {
  kind: "attribute-value";
  thingId: string;
  thingName: string;
  exhibitorId: string;
  exhibitorName: string;
  valueName: string;
}
```

- [ ] **Step 5: Add exhibitorName to existing types**

Add `exhibitorName?: string;` to both `OplThingDeclaration` (after `alias`) and `OplStateEnumeration` (after `stateNames`).

- [ ] **Step 6: Update the OplSentence union**

Change the union to:
```typescript
export type OplSentence =
  | OplThingDeclaration
  | OplStateEnumeration
  | OplDuration
  | OplLinkSentence
  | OplModifierSentence
  | OplStateDescription
  | OplGroupedStructuralSentence
  | OplInZoomSequence
  | OplAttributeValue;
```

- [ ] **Step 7: Update the import in opl.ts**

In `packages/core/src/opl.ts` line 5, add the new types to the import:
```typescript
import type {
  OplDocument, OplEdit, OplSentence,
  OplThingDeclaration, OplLinkSentence, OplModifierSentence, OplRenderSettings,
  OplStateDescription, OplGroupedStructuralSentence, OplInZoomSequence, OplAttributeValue,
} from "./opl-types";
```

- [ ] **Step 8: Update index.ts re-exports**

In `packages/core/src/index.ts`, ensure the new types are re-exported. If the file uses `export * from "./opl-types"`, no change needed. Otherwise add the new type names.

- [ ] **Step 9: Run type check**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: Compile errors in `renderSentence` (exhaustive switch) and `sentencesWithoutIds` (incomplete cases). These are expected — we'll fix them in subsequent tasks.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/opl-types.ts packages/core/src/opl.ts packages/core/src/index.ts
git commit -m "feat(opl): AST extension — 4 new sentence types + exhibitorName fields"
```

---

### Task 3: GAP-OPL-02 — State Descriptions (initial/final/default)

**Files:**
- Modify: `packages/core/src/opl.ts` — `expose()` and `renderSentence()`
- Test: `packages/core/tests/opl.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/core/tests/opl.test.ts`, add a new describe block after the "render" describe:

```typescript
describe("render — state descriptions (GAP-OPL-02)", () => {
  it("renders 'State S of O is initial.' for initial state", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    // state-liquid has initial: true
    expect(text).toContain("State liquid of Water is initial.");
  });

  it("does not emit state-description for states with no qualifiers", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    // state-gas has initial: false, final: false, default: false
    const descriptions = doc.sentences.filter(
      s => s.kind === "state-description" && s.stateName === "gas"
    );
    expect(descriptions).toHaveLength(0);
  });

  it("renders combined 'is initial and default' for state with both", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    // state-liquid has initial: true AND default: true
    expect(text).toContain("State liquid of Water is initial and default.");
  });

  it("renders 'State S of O is final.' for final state", () => {
    let m = buildModel();
    // Add a final state
    let r = addState(m, { id: "state-vapor", parent: "obj-water", name: "vapor", initial: false, final: true, default: false });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("State vapor of Water is final.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: FAIL — "State liquid of Water is initial." not found

- [ ] **Step 3: Add state-description emission in expose()**

In `packages/core/src/opl.ts`, inside the `expose()` function, after the state-enumeration block (after line 75), add:

```typescript
    // State descriptions (initial/final/default markers) — ISO §A.4.4.4
    for (const st of thingStates) {
      if (st.initial || st.final || st.default) {
        sentences.push({
          kind: "state-description",
          thingId,
          thingName: thing.name,
          stateId: st.id,
          stateName: st.name,
          initial: st.initial,
          final: st.final,
          default: st.default,
        } as OplStateDescription);
      }
    }
```

- [ ] **Step 4: Add state-description case in renderSentence()**

In `packages/core/src/opl.ts`, in the `renderSentence()` function, add a new case before the default fallthrough:

```typescript
    case "state-description": {
      const qualifiers: string[] = [];
      if (s.initial) qualifiers.push("initial");
      if (s.final) qualifiers.push("final");
      if (s.default) qualifiers.push("default");
      const thingDisplay = s.exhibitorName
        ? `${s.thingName} of ${s.exhibitorName}`
        : s.thingName;
      return `State ${s.stateName} of ${thingDisplay} is ${qualifiers.join(" and ")}.`;
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: PASS

- [ ] **Step 6: Update editsFrom() for state qualifier enrichment**

In `packages/core/src/opl.ts`, in `editsFrom()`:

First, build a qualifier lookup map at the top of the function (after `stateIdByName`):

```typescript
  // Build state qualifier lookup from state-description sentences
  const stateQualifiers = new Map<string, { initial: boolean; final: boolean; default: boolean }>();
  for (const s of doc.sentences) {
    if (s.kind === "state-description") {
      stateQualifiers.set(`${s.thingId}::${s.stateName}`, {
        initial: s.initial, final: s.final, default: s.default,
      });
    }
  }
```

Then in the `case "state-enumeration":` block, change the states mapping from:
```typescript
        states: s.stateNames.map(name => ({
            name,
            initial: false,
            final: false,
            default: false,
          })),
```
to:
```typescript
        states: s.stateNames.map(name => {
            const q = stateQualifiers.get(`${s.thingId}::${name}`);
            return {
              name,
              initial: q?.initial ?? false,
              final: q?.final ?? false,
              default: q?.default ?? false,
            };
          }),
```

- [ ] **Step 7: Update sentencesWithoutIds in GetPut test**

In `packages/core/tests/opl.test.ts`, in the `sentencesWithoutIds` function (line 577-587), add the new case:

```typescript
        case "state-description": return { kind: s.kind, thingName: s.thingName, stateName: s.stateName, initial: s.initial, final: s.final, default: s.default };
```

- [ ] **Step 8: Run all tests**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/opl.ts packages/core/tests/opl.test.ts
git commit -m "feat(opl): state descriptions — initial/final/default markers (GAP-OPL-02)"
```

---

### Task 4: GAP-OPL-07 — Exhibition Feature "of Exhibitor" + Attribute Value

**Files:**
- Modify: `packages/core/src/opl.ts` — `expose()` and `renderSentence()`
- Test: `packages/core/tests/opl.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/core/tests/opl.test.ts`, add a helper and test block:

```typescript
describe("render — exhibition feature form (GAP-OPL-07)", () => {
  function buildExhibitionModel() {
    let m = createModel("Test");
    // Exhibitor: Vehicle (object)
    let r = addThing(m, { id: "obj-vehicle", kind: "object", name: "Vehicle", essence: "physical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // Feature: Colour (object attribute of Vehicle)
    r = addThing(m, { id: "obj-colour", kind: "object", name: "Colour", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // Appearances
    r = addAppearance(m, { thing: "obj-vehicle", opd: "opd-sd", x: 100, y: 100, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "obj-colour", opd: "opd-sd", x: 100, y: 250, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    // Exhibition link: source=feature, target=exhibitor
    r = addLink(m, { id: "lnk-exhibit-colour", type: "exhibition", source: "obj-colour", target: "obj-vehicle" });
    if (!isOk(r)) throw r.error; m = r.value;
    // States on the feature (attribute values)
    r = addState(m, { id: "state-red", parent: "obj-colour", name: "red", initial: false, final: false, default: true });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addState(m, { id: "state-blue", parent: "obj-colour", name: "blue", initial: false, final: false, default: false });
    if (!isOk(r)) throw r.error; m = r.value;
    return m;
  }

  it('renders thing declaration as "Feature of Exhibitor is a..."', () => {
    const m = buildExhibitionModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Colour of Vehicle is an object.");
  });

  it('renders state enumeration as "Feature of Exhibitor can be..."', () => {
    const m = buildExhibitionModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Colour of Vehicle can be blue or red.");
  });

  it('renders state description as "State S of Feature of Exhibitor is..."', () => {
    const m = buildExhibitionModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("State red of Colour of Vehicle is default.");
  });

  it('renders attribute value as "Feature of Exhibitor is value."', () => {
    const m = buildExhibitionModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Colour of Vehicle is red.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: FAIL

- [ ] **Step 3: Build exhibition lookup in expose()**

In `packages/core/src/opl.ts`, inside `expose()`, after the `visibleThings` collection (after line 32) and BEFORE the thing declarations loop (line 46), add:

```typescript
  // Build exhibition feature lookup: featureId → exhibitorName
  // Convention: exhibition link source=feature, target=exhibitor
  // Must be built before thing declarations loop since declarations use it.
  // Uses model.links (not sortedLinks) because sortedLinks is computed later.
  const exhibitorOf = new Map<string, { id: string; name: string }>();
  for (const link of model.links.values()) {
    if (link.type === "exhibition" && visibleThings.has(link.source) && visibleThings.has(link.target)) {
      const exhibitor = model.things.get(link.target);
      if (exhibitor) {
        exhibitorOf.set(link.source, { id: link.target, name: exhibitor.name });
      }
    }
  }
```

Note: this uses `model.links` filtered by `visibleThings` (not `sortedLinks` which is computed later). The result is equivalent since `sortedLinks` is just `model.links` filtered by `visibleThings`.

- [ ] **Step 4: Enrich thing declarations with exhibitorName**

In `expose()`, in the thing declarations loop, after building the `declaration` object (after line 61), add:

```typescript
    const exhibitor = exhibitorOf.get(thingId);
    if (exhibitor) {
      declaration.exhibitorName = exhibitor.name;
    }
```

- [ ] **Step 5: Enrich state enumerations with exhibitorName**

In the state enumeration block, add `exhibitorName` to the pushed sentence:

Change the push from:
```typescript
      sentences.push({
        kind: "state-enumeration",
        thingId,
        thingName: thing.name,
        stateIds: thingStates.map(s => s.id),
        stateNames: thingStates.map(s => s.name),
      });
```
to:
```typescript
      sentences.push({
        kind: "state-enumeration",
        thingId,
        thingName: thing.name,
        stateIds: thingStates.map(s => s.id),
        stateNames: thingStates.map(s => s.name),
        exhibitorName: exhibitorOf.get(thingId)?.name,
      });
```

- [ ] **Step 6: Enrich state descriptions with exhibitorName**

In the state-description emission block (added in Task 3), add exhibitorName:

After `default: st.default,` add:
```typescript
          exhibitorName: exhibitorOf.get(thingId)?.name,
```

- [ ] **Step 7: Add attribute-value emission in expose()**

After the state-description loop (still inside the per-thing loop), add:

```typescript
    // Attribute value — ISO §10.3.3.2.2: "Feature of Exhibitor is value."
    const exh = exhibitorOf.get(thingId);
    if (exh) {
      const defaultState = thingStates.find(s => s.default);
      if (defaultState) {
        sentences.push({
          kind: "attribute-value",
          thingId,
          thingName: thing.name,
          exhibitorId: exh.id,
          exhibitorName: exh.name,
          valueName: defaultState.name,
        } as OplAttributeValue);
      }
    }
```

- [ ] **Step 8: Update renderSentence() for "of Exhibitor" in thing-declaration**

In `renderSentence()`, modify the `case "thing-declaration"` to use exhibitorName:

Change:
```typescript
    case "thing-declaration": {
      let text = `${s.name} is ${aOrAn(s.thingKind)}`;
```
to:
```typescript
    case "thing-declaration": {
      const displayName = s.exhibitorName ? `${s.name} of ${s.exhibitorName}` : s.name;
      let text = `${displayName} is ${aOrAn(s.thingKind)}`;
```

- [ ] **Step 9: Update renderSentence() for "of Exhibitor" in state-enumeration**

In `renderSentence()`, modify the `case "state-enumeration"` to use exhibitorName:

Change:
```typescript
    case "state-enumeration": {
      if (s.stateNames.length === 0) return "";
      if (s.stateNames.length === 1) return `${s.thingName} can be ${s.stateNames[0]}.`;
      const last = s.stateNames[s.stateNames.length - 1];
      const rest = s.stateNames.slice(0, -1);
      return `${s.thingName} can be ${rest.join(", ")} or ${last}.`;
    }
```
to:
```typescript
    case "state-enumeration": {
      const displayName = s.exhibitorName ? `${s.thingName} of ${s.exhibitorName}` : s.thingName;
      if (s.stateNames.length === 0) return "";
      if (s.stateNames.length === 1) return `${displayName} can be ${s.stateNames[0]}.`;
      const last = s.stateNames[s.stateNames.length - 1];
      const rest = s.stateNames.slice(0, -1);
      return `${displayName} can be ${rest.join(", ")} or ${last}.`;
    }
```

- [ ] **Step 10: Add renderSentence() case for attribute-value**

```typescript
    case "attribute-value":
      return `${s.thingName} of ${s.exhibitorName} is ${s.valueName}.`;
```

- [ ] **Step 11: Update sentencesWithoutIds for new types**

In the `sentencesWithoutIds` function, add:

```typescript
        case "attribute-value": return { kind: s.kind, thingName: s.thingName, exhibitorName: s.exhibitorName, valueName: s.valueName };
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: PASS

- [ ] **Step 13: Run all tests**

Run: `bunx vitest run`
Expected: All PASS

- [ ] **Step 14: Commit**

```bash
git add packages/core/src/opl.ts packages/core/tests/opl.test.ts
git commit -m "feat(opl): exhibition 'Feature of Exhibitor' form + attribute values (GAP-OPL-07)"
```

---

### Task 5: GAP-OPL-04 — Grouped Structural Links

**Files:**
- Modify: `packages/core/src/opl.ts` — `expose()`, new `renderGroupedStructural()`, `formatList()`, `editsFrom()`
- Modify: `packages/core/tests/driver-rescuing.test.ts` — update aggregation assertions
- Test: `packages/core/tests/opl.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/core/tests/opl.test.ts`, add:

```typescript
describe("render — grouped structural links (GAP-OPL-04)", () => {
  function buildGroupedModel() {
    let m = createModel("Test");
    // Whole: System
    let r = addThing(m, { id: "obj-system", kind: "object", name: "System", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // Parts: A, B, C
    r = addThing(m, { id: "obj-a", kind: "object", name: "Part A", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-b", kind: "object", name: "Part B", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-c", kind: "object", name: "Part C", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // Appearances
    for (const id of ["obj-system", "obj-a", "obj-b", "obj-c"]) {
      r = addAppearance(m, { thing: id, opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
      if (!isOk(r)) throw r.error; m = r.value;
    }
    // Aggregation links: system → parts
    r = addLink(m, { id: "lnk-agg-a", type: "aggregation", source: "obj-system", target: "obj-a" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-agg-b", type: "aggregation", source: "obj-system", target: "obj-b" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-agg-c", type: "aggregation", source: "obj-system", target: "obj-c" });
    if (!isOk(r)) throw r.error; m = r.value;
    return m;
  }

  it("groups aggregation into single sentence", () => {
    const m = buildGroupedModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("System consists of Part A, Part B, and Part C.");
    expect(text).not.toContain("System consists of Part A.");
  });

  it("renders incomplete aggregation with 'at least one other part'", () => {
    let m = buildGroupedModel();
    // Mark one link as incomplete
    const links = [...m.links.values()];
    const aggLink = links.find(l => l.id === "lnk-agg-a")!;
    m = { ...m, links: new Map(m.links).set(aggLink.id, { ...aggLink, incomplete: true }) };
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("at least one other part");
  });

  it("groups generalization (objects) with article", () => {
    let m = createModel("Test");
    let r = addThing(m, { id: "obj-camera", kind: "object", name: "Camera", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-analog", kind: "object", name: "Analog Camera", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-digital", kind: "object", name: "Digital Camera", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    for (const id of ["obj-camera", "obj-analog", "obj-digital"]) {
      r = addAppearance(m, { thing: id, opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
      if (!isOk(r)) throw r.error; m = r.value;
    }
    r = addLink(m, { id: "lnk-gen-a", type: "generalization", source: "obj-camera", target: "obj-analog" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-gen-d", type: "generalization", source: "obj-camera", target: "obj-digital" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Analog Camera and Digital Camera are a Camera.");
  });

  it("groups classification", () => {
    let m = createModel("Test");
    let r = addThing(m, { id: "obj-class", kind: "object", name: "Vehicle", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-inst-a", kind: "object", name: "Car A", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-inst-b", kind: "object", name: "Car B", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    for (const id of ["obj-class", "obj-inst-a", "obj-inst-b"]) {
      r = addAppearance(m, { thing: id, opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
      if (!isOk(r)) throw r.error; m = r.value;
    }
    r = addLink(m, { id: "lnk-cls-a", type: "classification", source: "obj-class", target: "obj-inst-a" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-cls-b", type: "classification", source: "obj-class", target: "obj-inst-b" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Car A and Car B are instances of Vehicle.");
  });

  it("groups exhibition with 'as well as' for mixed kinds", () => {
    let m = createModel("Test");
    let r = addThing(m, { id: "obj-adult", kind: "object", name: "Adult", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // Attributes (objects)
    r = addThing(m, { id: "obj-height", kind: "object", name: "Height", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "obj-weight", kind: "object", name: "Weight", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // Operation (process)
    r = addThing(m, { id: "proc-walking", kind: "process", name: "Walking", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    for (const id of ["obj-adult", "obj-height", "obj-weight", "proc-walking"]) {
      r = addAppearance(m, { thing: id, opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
      if (!isOk(r)) throw r.error; m = r.value;
    }
    // Exhibition links: source=feature, target=exhibitor
    r = addLink(m, { id: "lnk-ex-h", type: "exhibition", source: "obj-height", target: "obj-adult" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-ex-w", type: "exhibition", source: "obj-weight", target: "obj-adult" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-ex-walk", type: "exhibition", source: "proc-walking", target: "obj-adult" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    // Object exhibitor: attributes first, then operations
    expect(text).toContain("Adult exhibits Height and Weight, as well as Walking.");
  });

  it("editsFrom desfolds grouped structural to N individual add-links", () => {
    const m = buildGroupedModel();
    const doc = expose(m, "opd-sd");
    const edits = editsFrom(doc);
    const linkEdits = edits.filter(e => e.kind === "add-link");
    // 3 aggregation links desfolded
    const aggEdits = linkEdits.filter(e => e.kind === "add-link" && e.link.type === "aggregation");
    expect(aggEdits).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: FAIL

- [ ] **Step 3: Add formatList helper**

In `packages/core/src/opl.ts`, after the `aOrAn` helper (line 165), add:

```typescript
function formatList(names: string[], incomplete?: boolean, incompletePhrase?: string): string {
  if (names.length === 0) return "";
  if (names.length === 1) {
    return incomplete && incompletePhrase ? `${names[0]} and ${incompletePhrase}` : names[0]!;
  }
  if (names.length === 2) {
    // No Oxford comma for 2 items: "A and B"
    if (incomplete && incompletePhrase) {
      return `${names[0]}, ${names[1]}, and ${incompletePhrase}`;
    }
    return `${names[0]} and ${names[1]}`;
  }
  const last = names[names.length - 1]!;
  const rest = names.slice(0, -1);
  if (incomplete && incompletePhrase) {
    return `${rest.join(", ")}, ${last}, and ${incompletePhrase}`;
  }
  return `${rest.join(", ")}, and ${last}`;
}

const STRUCTURAL_TYPES = new Set(["aggregation", "exhibition", "generalization", "classification"]);

const INCOMPLETE_PHRASES: Record<string, string> = {
  aggregation: "at least one other part",
  exhibition: "at least one other feature",
  generalization: "at least one other specialization",
  classification: "at least one other instance",
};
```

- [ ] **Step 4: Add grouped structural emission in expose()**

In `expose()`, replace the individual link emission loop. Change the block from:

```typescript
  for (const link of sortedLinks) {
    const sentence: OplLinkSentence = {
      ...
    };
    ...
    sentences.push(sentence);
  }
```

to a version that separates structural from non-structural:

```typescript
  // Separate structural links for grouping (GAP-OPL-04)
  const structuralLinks: typeof sortedLinks = [];
  const nonStructuralLinks: typeof sortedLinks = [];
  for (const link of sortedLinks) {
    if (STRUCTURAL_TYPES.has(link.type)) {
      structuralLinks.push(link);
    } else {
      nonStructuralLinks.push(link);
    }
  }

  // Group structural links by (parentId, linkType)
  const structuralGroups = new Map<string, { parentId: string; linkType: string; links: Link[] }>();
  for (const link of structuralLinks) {
    // Parent depends on convention:
    // aggregation/generalization/classification: source=parent
    // exhibition: target=parent (exhibitor)
    const parentId = link.type === "exhibition" ? link.target : link.source;
    const key = `${parentId}::${link.type}`;
    if (!structuralGroups.has(key)) {
      structuralGroups.set(key, { parentId, linkType: link.type, links: [] });
    }
    structuralGroups.get(key)!.links.push(link);
  }

  for (const group of structuralGroups.values()) {
    const parent = model.things.get(group.parentId);
    if (!parent) continue;
    // Children depend on convention (mirror of parent):
    const childIds = group.links.map(l => l.type === "exhibition" ? l.source : l.target);
    const childNames = childIds.map(id => model.things.get(id)?.name ?? id);
    const childKinds = childIds.map(id => model.things.get(id)?.kind ?? "object" as const);
    sentences.push({
      kind: "grouped-structural",
      linkType: group.linkType as any,
      parentId: group.parentId,
      parentName: parent.name,
      parentKind: parent.kind,
      childIds,
      childNames,
      childKinds,
      incomplete: group.links.some(l => l.incomplete),
    } as OplGroupedStructuralSentence);
  }

  // Non-structural links: emit individually (unchanged)
  for (const link of nonStructuralLinks) {
    const sentence: OplLinkSentence = {
      kind: "link",
      linkId: link.id,
      linkType: link.type,
      sourceId: link.source,
      targetId: link.target,
      sourceName: model.things.get(link.source)?.name ?? link.source,
      targetName: model.things.get(link.target)?.name ?? link.target,
      sourceKind: model.things.get(link.source)?.kind,
      targetKind: model.things.get(link.target)?.kind,
      incomplete: link.incomplete ?? false,
    };
    if (link.source_state) {
      sentence.sourceStateName = model.states.get(link.source_state)?.name;
    }
    if (link.target_state) {
      sentence.targetStateName = model.states.get(link.target_state)?.name;
    }
    if (link.tag) {
      sentence.tag = link.tag;
    }
    if (link.direction) {
      sentence.direction = link.direction;
    }
    sentences.push(sentence);
  }
```

- [ ] **Step 5: Add renderGroupedStructural function**

In `packages/core/src/opl.ts`, after the `renderModifierSentence` function, add:

```typescript
function renderGroupedStructural(s: OplGroupedStructuralSentence): string {
  const phrase = INCOMPLETE_PHRASES[s.linkType] ?? "at least one other";

  switch (s.linkType) {
    case "aggregation":
      return `${s.parentName} consists of ${formatList(s.childNames, s.incomplete, phrase)}.`;

    case "exhibition": {
      // ISO §10.3.3: object exhibitor → attributes first, then operations
      // Process exhibitor → operations first, then attributes
      const attrs = s.childNames.filter((_, i) => s.childKinds[i] === "object");
      const ops = s.childNames.filter((_, i) => s.childKinds[i] === "process");

      const isObjectExhibitor = s.parentKind === "object";
      const first = isObjectExhibitor ? attrs : ops;
      const second = isObjectExhibitor ? ops : attrs;

      if (second.length === 0) {
        return `${s.parentName} exhibits ${formatList(first, s.incomplete, phrase)}.`;
      }
      const firstList = formatList(first);
      const secondList = formatList(second);
      return `${s.parentName} exhibits ${firstList}, as well as ${secondList}.`;
    }

    case "generalization": {
      const list = formatList(s.childNames, s.incomplete, phrase);
      // ISO §10.3.4: objects use article, processes don't
      if (s.parentKind === "object") {
        return `${list} are ${aOrAn(s.parentName)}.`;
      }
      return `${list} are ${s.parentName}.`;
    }

    case "classification":
      return `${formatList(s.childNames, s.incomplete, phrase)} are instances of ${s.parentName}.`;

    default:
      return "";
  }
}
```

- [ ] **Step 6: Add case in renderSentence()**

```typescript
    case "grouped-structural":
      return renderGroupedStructural(s);
```

- [ ] **Step 7: Add grouped-structural handling in editsFrom()**

In `editsFrom()`, in the switch statement, add:

```typescript
      case "grouped-structural": {
        // Desfold: emit N individual add-link edits
        const directionMap: Record<string, "source" | "target"> = {
          aggregation: "source",   // source=parent
          exhibition: "target",    // target=parent (exhibitor)
          generalization: "source", // source=parent (general)
          classification: "source", // source=parent (class)
        };
        const parentRole = directionMap[s.linkType] ?? "source";
        for (let i = 0; i < s.childIds.length; i++) {
          const linkData: Omit<Link, "id"> = {
            type: s.linkType,
            source: parentRole === "source" ? s.parentId : s.childIds[i]!,
            target: parentRole === "source" ? s.childIds[i]! : s.parentId,
            incomplete: s.incomplete || undefined,
          };
          linkEdits.push({ kind: "add-link", link: linkData });
        }
        break;
      }
```

- [ ] **Step 8: Update sentencesWithoutIds for grouped-structural**

```typescript
        case "grouped-structural": return { kind: s.kind, linkType: s.linkType, parentName: s.parentName, childNames: s.childNames, incomplete: s.incomplete };
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: PASS

- [ ] **Step 10: Update driver-rescuing aggregation test**

In `packages/core/tests/driver-rescuing.test.ts`, change lines 87-94 from:
```typescript
    it('renders aggregation "OnStar System consists of GPS."', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd"));
      expect(text).toContain("OnStar System consists of GPS.");
      expect(text).toContain("OnStar System consists of Cellular Network.");
      expect(text).toContain("OnStar System consists of OnStar Console.");
      expect(text).toContain("OnStar System consists of VCIM.");
    });
```
to:
```typescript
    it('renders grouped aggregation "OnStar System consists of ..."', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd"));
      // GAP-OPL-04: grouped structural — 4 parts in one sentence
      expect(text).toContain("OnStar System consists of");
      expect(text).toContain("GPS");
      expect(text).toContain("Cellular Network");
      expect(text).toContain("OnStar Console");
      expect(text).toContain("VCIM");
      // Should NOT be individual sentences
      expect(text).not.toContain("OnStar System consists of GPS.");
    });
```

- [ ] **Step 11: Update driver-rescuing exhibition test for SD1**

In `packages/core/tests/driver-rescuing.test.ts`, change line 109 from:
```typescript
      expect(text).toContain("Driver exhibits Danger Status.");
```
to:
```typescript
      // GAP-OPL-04: grouped structural exhibition
      expect(text).toContain("Driver exhibits Danger Status.");
```

This should still pass since there's only 1 exhibition feature — the grouped form with 1 child produces the same text.

- [ ] **Step 12: Run all tests**

Run: `bunx vitest run`
Expected: All PASS

- [ ] **Step 13: Commit**

```bash
git add packages/core/src/opl.ts packages/core/tests/opl.test.ts packages/core/tests/driver-rescuing.test.ts
git commit -m "feat(opl): grouped structural links — aggregation, exhibition, generalization, classification (GAP-OPL-04)"
```

---

### Task 6: GAP-OPL-03/05 — In-Zoom Sequence Sentence

**Files:**
- Modify: `packages/core/src/opl.ts` — `expose()` and `renderSentence()`
- Test: `packages/core/tests/opl.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/core/tests/opl.test.ts`, add:

```typescript
describe("render — in-zoom sequence (GAP-OPL-03/05)", () => {
  function buildInZoomModel() {
    let m = createModel("Test");
    // Parent process
    let r = addThing(m, { id: "proc-main", kind: "process", name: "Main Processing", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // Subprocesses
    r = addThing(m, { id: "proc-step-a", kind: "process", name: "Step A", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "proc-step-b", kind: "process", name: "Step B", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "proc-step-c", kind: "process", name: "Step C", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    // SD: parent process appearance
    r = addAppearance(m, { thing: "proc-main", opd: "opd-sd", x: 100, y: 100, w: 120, h: 60 });
    if (!isOk(r)) throw r.error; m = r.value;
    // Add in-zoom OPD
    const opd1 = { id: "opd-sd1", name: "SD1", opd_type: "hierarchical" as const, parent_opd: "opd-sd", refines: "proc-main", refinement_type: "in-zoom" as const };
    m = { ...m, opds: new Map(m.opds).set("opd-sd1", opd1) };
    // SD1: container + subprocess appearances (internal, ordered by Y)
    r = addAppearance(m, { thing: "proc-main", opd: "opd-sd1", x: 50, y: 50, w: 300, h: 400 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "proc-step-a", opd: "opd-sd1", x: 100, y: 100, w: 120, h: 50, internal: true });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "proc-step-b", opd: "opd-sd1", x: 100, y: 200, w: 120, h: 50, internal: true });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "proc-step-c", opd: "opd-sd1", x: 100, y: 300, w: 120, h: 50, internal: true });
    if (!isOk(r)) throw r.error; m = r.value;
    return m;
  }

  it("renders sequential in-zoom sentence", () => {
    const m = buildInZoomModel();
    const doc = expose(m, "opd-sd1");
    const text = render(doc);
    expect(text).toContain("Main Processing zooms into Step A, Step B, and Step C, in that sequence.");
  });

  it("in-zoom sentence is first in the OPL output", () => {
    const m = buildInZoomModel();
    const doc = expose(m, "opd-sd1");
    expect(doc.sentences[0]?.kind).toBe("in-zoom-sequence");
  });

  it("single subprocess omits 'in that sequence'", () => {
    let m = createModel("Test");
    let r = addThing(m, { id: "proc-parent", kind: "process", name: "Parent", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, { id: "proc-child", kind: "process", name: "Child", essence: "informatical", affiliation: "systemic" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "proc-parent", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
    if (!isOk(r)) throw r.error; m = r.value;
    const opd1 = { id: "opd-sd1", name: "SD1", opd_type: "hierarchical" as const, parent_opd: "opd-sd", refines: "proc-parent", refinement_type: "in-zoom" as const };
    m = { ...m, opds: new Map(m.opds).set("opd-sd1", opd1) };
    r = addAppearance(m, { thing: "proc-parent", opd: "opd-sd1", x: 0, y: 0, w: 300, h: 300 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "proc-child", opd: "opd-sd1", x: 50, y: 50, w: 100, h: 50, internal: true });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd1");
    const text = render(doc);
    expect(text).toContain("Parent zooms into Child.");
    expect(text).not.toContain("in that sequence");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: FAIL

- [ ] **Step 3: Add in-zoom sequence emission in expose()**

In `expose()`, after the `renderSettings` block and the `exhibitorOf` declaration, but BEFORE the thing declarations loop, add the in-zoom detection:

```typescript
  // In-zoom sequence sentence — ISO §14.2.1.3
  if (containerThingId) {
    const containerThing = model.things.get(containerThingId);
    if (containerThing) {
      // Collect internal subprocess appearances sorted by Y
      const subprocessApps: Array<{ thingId: string; name: string; y: number }> = [];
      for (const app of model.appearances.values()) {
        if (app.opd !== opdId) continue;
        if (app.thing === containerThingId) continue;
        if (!app.internal) continue;
        const thing = model.things.get(app.thing);
        if (thing?.kind === "process") {
          subprocessApps.push({ thingId: thing.id, name: thing.name, y: app.y });
        }
      }
      subprocessApps.sort((a, b) => a.y - b.y || a.thingId.localeCompare(b.thingId));

      if (subprocessApps.length > 0) {
        sentences.push({
          kind: "in-zoom-sequence",
          parentId: containerThingId,
          parentName: containerThing.name,
          steps: subprocessApps.map(sp => ({
            thingIds: [sp.thingId],
            thingNames: [sp.name],
            parallel: false,
          })),
        } as OplInZoomSequence);
      }
    }
  }
```

Note: `containerThingId` is already declared at line 95. This block must come before the thing declarations loop so the in-zoom sentence appears first.

- [ ] **Step 4: Add in-zoom-sequence case in renderSentence()**

```typescript
    case "in-zoom-sequence": {
      const allNames = s.steps.flatMap(step =>
        step.parallel
          ? [`parallel ${formatList(step.thingNames)}`]
          : step.thingNames
      );
      const list = formatList(allNames);
      if (s.steps.length === 1 && s.steps[0]!.thingNames.length === 1) {
        return `${s.parentName} zooms into ${list}.`;
      }
      return `${s.parentName} zooms into ${list}, in that sequence.`;
    }
```

- [ ] **Step 5: Update sentencesWithoutIds**

```typescript
        case "in-zoom-sequence": return { kind: s.kind, parentName: s.parentName, steps: s.steps.map(st => ({ thingNames: st.thingNames, parallel: st.parallel })) };
```

- [ ] **Step 6: Handle in-zoom-sequence in editsFrom (no-op)**

In `editsFrom()`, add a no-op case to prevent the exhaustive switch from failing:

```typescript
      case "state-description":
      case "in-zoom-sequence":
      case "attribute-value":
        // Derived/supplementary sentences — no edits generated
        // (state-description qualifiers are consumed via the stateQualifiers pre-scan above)
        break;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: PASS

- [ ] **Step 8: Run all tests**

Run: `bunx vitest run`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/opl.ts packages/core/tests/opl.test.ts
git commit -m "feat(opl): in-zoom sequence sentence — 'P zooms into A, B, C, in that sequence' (GAP-OPL-03/05)"
```

---

### Task 7: Integration — Driver Rescuing + Lens Laws

**Files:**
- Modify: `packages/core/tests/driver-rescuing.test.ts`
- Modify: `packages/core/tests/opl.test.ts`

- [ ] **Step 1: Add driver-rescuing in-zoom OPL test**

In `packages/core/tests/driver-rescuing.test.ts`, in the "OPL rendering — SD1" describe, add:

```typescript
    it('renders in-zoom sequence for Driver Rescuing (GAP-OPL-03/05)', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd1"));
      expect(text).toContain("Driver Rescuing zooms into");
      expect(text).toContain("Call Making");
      expect(text).toContain("Call Transmitting");
      expect(text).toContain("Vehicle Location Calculating");
      expect(text).toContain("Call Handling");
      expect(text).toContain("in that sequence");
    });
```

- [ ] **Step 2: Add driver-rescuing state description test**

In "OPL rendering — SD1", add:

```typescript
    it('renders state descriptions for Call and Danger Status (GAP-OPL-02)', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd1"));
      // Call: state-call-requested has initial: true
      expect(text).toContain("State requested of Call is initial.");
      // Danger Status: state-danger-safe has final: true
      expect(text).toContain("State safe of Danger Status is final.");
      // Danger Status: state-danger-endangered has initial: true
      expect(text).toContain("State endangered of Danger Status is initial.");
    });
```

- [ ] **Step 3: Add driver-rescuing exhibition "of Exhibitor" test**

In "OPL rendering — SD1", update the exhibition test to check for "of" form:

```typescript
    it('renders exhibition feature with "of Exhibitor" form (GAP-OPL-07)', () => {
      const m = loadDriverRescuingModel();
      const doc = expose(m, "opd-sd1");
      const text = render(doc);
      // Danger Status is exhibited by Driver
      expect(text).toContain("Danger Status of Driver");
    });
```

- [ ] **Step 4: Add lens law test for state qualifier round-trip**

In `packages/core/tests/opl.test.ts`, in the "GetPut" describe, add:

```typescript
  it("round-trip preserves state initial/final/default qualifiers", () => {
    const m = buildModel();
    const doc1 = expose(m, "opd-sd");

    // Reconstruct
    let fresh = createModel("Test-RT");
    const edits = editsFrom(doc1);
    for (const edit of edits) {
      const r = applyOplEdit(fresh, edit);
      if (!isOk(r)) throw new Error(`Edit failed: ${JSON.stringify(r.error)}`);
      fresh = r.value;
    }

    // Verify state qualifiers survived
    const liquidState = [...fresh.states.values()].find(s => s.name === "liquid");
    expect(liquidState?.initial).toBe(true);
    expect(liquidState?.default).toBe(true);
    const gasState = [...fresh.states.values()].find(s => s.name === "gas");
    expect(gasState?.initial).toBe(false);
    expect(gasState?.default).toBe(false);
  });
```

- [ ] **Step 5: Run all tests**

Run: `bunx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/tests/driver-rescuing.test.ts packages/core/tests/opl.test.ts
git commit -m "test(opl): integration tests — driver-rescuing + lens law for state qualifiers"
```

---

### Task 8: Final Verification + Session Handoff

- [ ] **Step 1: Run full test suite**

Run: `bunx vitest run`
Expected: All tests PASS (586 + ~22 new ≈ 608)

- [ ] **Step 2: Type check**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: Only pre-existing TS2532 warnings in test files

- [ ] **Step 3: Verify no regressions in driver-rescuing fixture**

Run: `bunx vitest run packages/core/tests/driver-rescuing.test.ts`
Expected: All PASS

- [ ] **Step 4: Push**

```bash
git push
```
