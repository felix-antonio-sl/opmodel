# Refinement (In-zoom / Unfold) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `refineThing` as a parameterized universal construction in the Domain Engine, fix `removeThing` cascade gap, add new validation checks, and expose via `opmod refine` CLI command.

**Architecture:** `refineThing(model, thingId, parentOpdId, refinementType, childOpdId, childOpdName)` is a pure function that creates a child OPD with pullback-computed external appearances. The selector is parameterized by `RefinementType`: in-zoom pulls all connected things, unfold pulls aggregation+exhibition targets only. The CLI command `opmod refine` generates IDs/names and delegates to the core function.

**Tech Stack:** TypeScript, Bun, Vitest, Commander.js

**Spec:** `docs/superpowers/specs/2026-03-11-refinement-inzoom-unfold-design.md`

---

## Chunk 1: Core Domain Engine

### Task 1: `refineThing` function + in-zoom tests

**Files:**
- Modify: `packages/core/src/api.ts` (add `refineThing` after line 263, before Appearances section)
- Modify: `packages/core/src/index.ts` (add export)
- Create: `packages/core/tests/api-refinement.test.ts`

**Context:** The existing API pattern is pure functions returning `Result<Model, InvariantError>`. Uses `touch()` for timestamp, `collectAllIds()` for I-08 uniqueness, `ok()`/`err()` from `./result`. Appearances use composite key `${thing}::${opd}` in `model.appearances` Map.

- [ ] **Step 1: Write failing tests for `refineThing` in-zoom**

```typescript
// packages/core/tests/api-refinement.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addOPD, addAppearance, addLink, refineThing } from "../src/api";

function unwrap<T, E>(result: { ok: boolean; value?: T; error?: E }): T {
  if (!result.ok) throw new Error(`Expected ok, got error: ${JSON.stringify((result as any).error)}`);
  return result.value as T;
}

function buildTestModel() {
  let m = createModel("test");
  // Root OPD
  m = unwrap(addOPD(m, { id: "opd-sd", name: "SD", opd_type: "hierarchical", parent_opd: null }));
  // Process to refine
  m = unwrap(addThing(m, { id: "proc-make-coffee", kind: "process", name: "Making Coffee", essence: "physical", affiliation: "systemic" }));
  // Connected objects
  m = unwrap(addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-beans", kind: "object", name: "Coffee Beans", essence: "physical", affiliation: "systemic" }));
  // Unconnected object (should NOT appear in pullback)
  m = unwrap(addThing(m, { id: "obj-sugar", kind: "object", name: "Sugar", essence: "physical", affiliation: "systemic" }));
  // Appearances in SD
  m = unwrap(addAppearance(m, { thing: "proc-make-coffee", opd: "opd-sd", x: 100, y: 100, w: 150, h: 80 }));
  m = unwrap(addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 60 }));
  m = unwrap(addAppearance(m, { thing: "obj-beans", opd: "opd-sd", x: 200, y: 50, w: 120, h: 60 }));
  m = unwrap(addAppearance(m, { thing: "obj-sugar", opd: "opd-sd", x: 350, y: 50, w: 120, h: 60 }));
  // Links: water→process (effect), beans→process (consumption)
  m = unwrap(addLink(m, { id: "lnk-1", type: "effect", source: "obj-water", target: "proc-make-coffee" }));
  m = unwrap(addLink(m, { id: "lnk-2", type: "consumption", source: "obj-beans", target: "proc-make-coffee" }));
  return m;
}

describe("refineThing", () => {
  describe("in-zoom", () => {
    it("creates child OPD with correct fields", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(true);
      const model = unwrap(result);
      const opd = model.opds.get("opd-sd1");
      expect(opd).toBeDefined();
      expect(opd!.opd_type).toBe("hierarchical");
      expect(opd!.parent_opd).toBe("opd-sd");
      expect(opd!.refines).toBe("proc-make-coffee");
      expect(opd!.refinement_type).toBe("in-zoom");
      expect(opd!.name).toBe("SD1");
    });

    it("creates external appearances for connected things only", () => {
      const m = buildTestModel();
      const model = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      // Water and Beans are connected — should have external appearances
      const waterApp = model.appearances.get("obj-water::opd-sd1");
      expect(waterApp).toBeDefined();
      expect(waterApp!.internal).toBe(false);
      const beansApp = model.appearances.get("obj-beans::opd-sd1");
      expect(beansApp).toBeDefined();
      expect(beansApp!.internal).toBe(false);
      // Sugar is NOT connected — should NOT appear
      expect(model.appearances.has("obj-sugar::opd-sd1")).toBe(false);
    });

    it("creates internal appearance for refined thing", () => {
      const m = buildTestModel();
      const model = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      const app = model.appearances.get("proc-make-coffee::opd-sd1");
      expect(app).toBeDefined();
      expect(app!.internal).toBe(true);
    });

    it("returns correct total appearances count", () => {
      const m = buildTestModel();
      const model = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      // Original 4 + 3 new (water external, beans external, process internal)
      expect(model.appearances.size).toBe(7);
    });
  });

  describe("pre-conditions", () => {
    it("rejects non-existent thing", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-nonexistent", "opd-sd", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("NOT_FOUND");
    });

    it("rejects non-existent parent OPD", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-make-coffee", "opd-nonexistent", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("NOT_FOUND");
    });

    it("rejects thing without appearance in parent OPD", () => {
      let m = buildTestModel();
      m = unwrap(addThing(m, { id: "obj-orphan", kind: "object", name: "Orphan", essence: "physical", affiliation: "systemic" }));
      const result = refineThing(m, "obj-orphan", "opd-sd", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("NOT_FOUND");
    });

    it("rejects duplicate refinement", () => {
      const m = buildTestModel();
      const m2 = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      const result = refineThing(m2, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd2", "SD2");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("ALREADY_REFINED");
    });

    it("rejects duplicate child OPD ID (I-08)", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("I-08");
    });

    it("rejects refinement from view OPD", () => {
      let m = buildTestModel();
      m = unwrap(addOPD(m, { id: "opd-view", name: "View1", opd_type: "view", parent_opd: null }));
      m = unwrap(addAppearance(m, { thing: "proc-make-coffee", opd: "opd-view", x: 0, y: 0, w: 100, h: 50 }));
      const result = refineThing(m, "proc-make-coffee", "opd-view", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("INVALID_REFINEMENT");
    });

    it("rejects unfold on process (only objects)", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-make-coffee", "opd-sd", "unfold", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("INVALID_REFINEMENT");
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run packages/core/tests/api-refinement.test.ts`
Expected: FAIL — `refineThing` not exported

- [ ] **Step 3: Implement `refineThing` in api.ts**

Add after the `removeOPD` function (after line 263), before the Appearances section:

```typescript
// ── Refinement (In-zoom / Unfold) ─────────────────────────────────────

export function refineThing(
  model: Model,
  thingId: string,
  parentOpdId: string,
  refinementType: RefinementType,
  childOpdId: string,
  childOpdName: string,
): Result<Model, InvariantError> {
  // Pre-condition 1: Thing exists
  const thing = model.things.get(thingId);
  if (!thing) {
    return err({ code: "NOT_FOUND", message: `Thing not found: ${thingId}`, entity: thingId });
  }
  // Pre-condition 2: Parent OPD exists
  const parentOpd = model.opds.get(parentOpdId);
  if (!parentOpd) {
    return err({ code: "NOT_FOUND", message: `OPD not found: ${parentOpdId}`, entity: parentOpdId });
  }
  // Pre-condition 3: Parent OPD is hierarchical
  if (parentOpd.opd_type !== "hierarchical") {
    return err({ code: "INVALID_REFINEMENT", message: `Cannot refine from view OPD: ${parentOpdId}`, entity: parentOpdId });
  }
  // Pre-condition 4: Thing has appearance in parent OPD
  const thingAppKey = `${thingId}::${parentOpdId}`;
  if (!model.appearances.has(thingAppKey)) {
    return err({ code: "NOT_FOUND", message: `Thing ${thingId} has no appearance in OPD ${parentOpdId}`, entity: thingId });
  }
  // Pre-condition 5: Unfold only for objects
  if (refinementType === "unfold" && thing.kind !== "object") {
    return err({ code: "INVALID_REFINEMENT", message: `Unfold only applies to objects, not processes: ${thingId}`, entity: thingId });
  }
  // Pre-condition 6: Not already refined with same type from same OPD
  for (const opd of model.opds.values()) {
    if (opd.refines === thingId && opd.parent_opd === parentOpdId && opd.refinement_type === refinementType) {
      return err({ code: "ALREADY_REFINED", message: `Thing ${thingId} already has ${refinementType} refinement from OPD ${parentOpdId}`, entity: thingId });
    }
  }
  // Pre-condition 7: Unique child OPD ID (I-08)
  if (collectAllIds(model).has(childOpdId)) {
    return err({ code: "I-08", message: `Duplicate id: ${childOpdId}`, entity: childOpdId });
  }

  // Compute pullback: things in fiber(parentOpd) connected to thingId via selector
  const thingsInFiber = new Set<string>();
  for (const app of model.appearances.values()) {
    if (app.opd === parentOpdId) thingsInFiber.add(app.thing);
  }

  const externalThings = new Set<string>();
  for (const link of model.links.values()) {
    if (refinementType === "in-zoom") {
      // In-zoom: any link connecting thingId to another thing in fiber
      if (link.source === thingId && thingsInFiber.has(link.target) && link.target !== thingId) {
        externalThings.add(link.target);
      }
      if (link.target === thingId && thingsInFiber.has(link.source) && link.source !== thingId) {
        externalThings.add(link.source);
      }
    } else {
      // Unfold: aggregation or exhibition where thingId is source
      if ((link.type === "aggregation" || link.type === "exhibition") &&
          link.source === thingId && thingsInFiber.has(link.target) && link.target !== thingId) {
        externalThings.add(link.target);
      }
    }
  }

  // Create child OPD
  const childOpd: OPD = {
    id: childOpdId,
    name: childOpdName,
    opd_type: "hierarchical",
    parent_opd: parentOpdId,
    refines: thingId,
    refinement_type: refinementType,
  };
  const opds = new Map(model.opds).set(childOpdId, childOpd);

  // Generate appearances
  const appearances = new Map(model.appearances);
  // Internal appearance for refined thing
  appearances.set(`${thingId}::${childOpdId}`, {
    thing: thingId, opd: childOpdId,
    x: 0, y: 0, w: 200, h: 150, internal: true,
  });
  // External appearances for pullback things
  let index = 0;
  for (const extThingId of externalThings) {
    appearances.set(`${extThingId}::${childOpdId}`, {
      thing: extThingId, opd: childOpdId,
      x: 50 + index * 150, y: 50, w: 120, h: 60, internal: false,
    });
    index++;
  }

  return ok(touch({ ...model, opds, appearances }));
}
```

Add `RefinementType` to the imports at the top of api.ts:

```typescript
import type {
  Model, Thing, State, Link, OPD, Appearance,
  Modifier, Fan, Assertion, Requirement, Stereotype,
  SubModel, Scenario, Meta, Settings, RefinementType,
} from "./types";
```

- [ ] **Step 4: Export `refineThing` from index.ts**

Add `refineThing` to the export list in `packages/core/src/index.ts`:

```typescript
export {
  addThing, removeThing, updateThing,
  ...
  validate,
  refineThing,
} from "./api";
```

- [ ] **Step 5: Run tests — expect all passing**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run packages/core/tests/api-refinement.test.ts`
Expected: PASS (all 11 tests)

- [ ] **Step 6: Run full suite to verify no regressions**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run`
Expected: All 243 tests pass (232 existing + 11 new)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/api.ts packages/core/src/index.ts packages/core/tests/api-refinement.test.ts
git commit -m "feat(core): add refineThing with in-zoom pullback and pre-conditions"
```

---

### Task 2: Unfold tests + `removeThing` cascade fix

**Files:**
- Modify: `packages/core/tests/api-refinement.test.ts` (add unfold + cascade tests)
- Modify: `packages/core/src/api.ts` (fix `removeThing` cascade)

**Context:** `removeThing` at lines 25-100 of api.ts cascades states, links, modifiers, appearances, requirements, fans, assertions, stereotypes — but NOT OPDs where `refines === thingId`. The existing `removeOPD` (lines 235-263) already handles recursive descendant + appearance cascade.

- [ ] **Step 1: Write failing tests for unfold + removeThing cascade**

Add to `packages/core/tests/api-refinement.test.ts`:

```typescript
// Add these imports at top:
import { removeThing } from "../src/api";

// Add inside describe("refineThing"):
describe("unfold", () => {
  function buildUnfoldModel() {
    let m = createModel("test");
    m = unwrap(addOPD(m, { id: "opd-sd", name: "SD", opd_type: "hierarchical", parent_opd: null }));
    // Object to unfold
    m = unwrap(addThing(m, { id: "obj-car", kind: "object", name: "Car", essence: "physical", affiliation: "systemic" }));
    // Parts (aggregation targets)
    m = unwrap(addThing(m, { id: "obj-engine", kind: "object", name: "Engine", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-wheel", kind: "object", name: "Wheel", essence: "physical", affiliation: "systemic" }));
    // Attribute (exhibition target)
    m = unwrap(addThing(m, { id: "obj-color", kind: "object", name: "Color", essence: "informatical", affiliation: "systemic" }));
    // Unrelated object connected via effect (should NOT appear in unfold)
    m = unwrap(addThing(m, { id: "proc-drive", kind: "process", name: "Driving", essence: "physical", affiliation: "systemic" }));
    // Appearances
    m = unwrap(addAppearance(m, { thing: "obj-car", opd: "opd-sd", x: 100, y: 100, w: 150, h: 80 }));
    m = unwrap(addAppearance(m, { thing: "obj-engine", opd: "opd-sd", x: 50, y: 200, w: 120, h: 60 }));
    m = unwrap(addAppearance(m, { thing: "obj-wheel", opd: "opd-sd", x: 200, y: 200, w: 120, h: 60 }));
    m = unwrap(addAppearance(m, { thing: "obj-color", opd: "opd-sd", x: 350, y: 200, w: 120, h: 60 }));
    m = unwrap(addAppearance(m, { thing: "proc-drive", opd: "opd-sd", x: 350, y: 100, w: 150, h: 80 }));
    // Aggregation links: car → engine, car → wheel
    m = unwrap(addLink(m, { id: "lnk-agg1", type: "aggregation", source: "obj-car", target: "obj-engine" }));
    m = unwrap(addLink(m, { id: "lnk-agg2", type: "aggregation", source: "obj-car", target: "obj-wheel" }));
    // Exhibition link: car → color
    m = unwrap(addLink(m, { id: "lnk-exh1", type: "exhibition", source: "obj-car", target: "obj-color" }));
    // Effect link: car → drive (NOT structural)
    m = unwrap(addLink(m, { id: "lnk-eff1", type: "effect", source: "proc-drive", target: "obj-car" }));
    return m;
  }

  it("pulls back aggregation and exhibition targets only", () => {
    const m = buildUnfoldModel();
    const model = unwrap(refineThing(m, "obj-car", "opd-sd", "unfold", "opd-sd1", "SD1"));
    // Engine, Wheel (aggregation) and Color (exhibition) should appear
    expect(model.appearances.has("obj-engine::opd-sd1")).toBe(true);
    expect(model.appearances.has("obj-wheel::opd-sd1")).toBe(true);
    expect(model.appearances.has("obj-color::opd-sd1")).toBe(true);
    // Driving process is connected via effect — should NOT appear
    expect(model.appearances.has("proc-drive::opd-sd1")).toBe(false);
    // All external
    expect(model.appearances.get("obj-engine::opd-sd1")!.internal).toBe(false);
    expect(model.appearances.get("obj-color::opd-sd1")!.internal).toBe(false);
  });

  it("creates internal appearance for unfolded object", () => {
    const m = buildUnfoldModel();
    const model = unwrap(refineThing(m, "obj-car", "opd-sd", "unfold", "opd-sd1", "SD1"));
    const app = model.appearances.get("obj-car::opd-sd1");
    expect(app).toBeDefined();
    expect(app!.internal).toBe(true);
  });
});

// Add after the refineThing describe block:
describe("removeThing cascade to refinement OPDs", () => {
  it("removes refinement OPDs when thing is deleted", () => {
    let m = buildTestModel();
    m = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
    expect(m.opds.has("opd-sd1")).toBe(true);
    // Remove the refined thing
    const result = removeThing(m, "proc-make-coffee");
    expect(result.ok).toBe(true);
    const model = unwrap(result);
    // Refinement OPD should be cascaded
    expect(model.opds.has("opd-sd1")).toBe(false);
    // Appearances in that OPD should also be gone
    expect(model.appearances.has("obj-water::opd-sd1")).toBe(false);
    expect(model.appearances.has("proc-make-coffee::opd-sd1")).toBe(false);
  });

  it("cascades nested refinement OPDs", () => {
    let m = buildTestModel();
    m = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
    // Add a sub-process inside SD1 and refine it too
    m = unwrap(addThing(m, { id: "proc-grind", kind: "process", name: "Grinding", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addAppearance(m, { thing: "proc-grind", opd: "opd-sd1", x: 50, y: 50, w: 120, h: 60, internal: true }));
    m = unwrap(addOPD(m, { id: "opd-sd1-1", name: "SD1.1", opd_type: "hierarchical", parent_opd: "opd-sd1", refines: "proc-grind", refinement_type: "in-zoom" }));
    // Remove the top-level thing
    const model = unwrap(removeThing(m, "proc-make-coffee"));
    expect(model.opds.has("opd-sd1")).toBe(false);
    expect(model.opds.has("opd-sd1-1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect cascade tests to fail**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run packages/core/tests/api-refinement.test.ts`
Expected: Unfold tests PASS, cascade tests FAIL (removeThing doesn't cascade OPDs yet)

- [ ] **Step 3: Fix `removeThing` in api.ts — add refinement OPD cascade**

In `removeThing` (line 25-100 of api.ts), add refinement OPD cascade BEFORE the final `things.delete(thingId)` and `return`. Insert after the stereotypes cascade (after line 94) and before `const things = new Map(model.things)` (line 96):

```typescript
  // Cascade: remove OPDs that refine this thing (DANGLING_REFINES prevention)
  let opds = new Map(model.opds);
  const opdsToRemove = new Set<string>();
  for (const [id, opd] of opds) {
    if (opd.refines === thingId) {
      // Collect this OPD and all descendants
      const collectDescendants = (parentId: string) => {
        opdsToRemove.add(parentId);
        for (const [cid, copd] of opds) {
          if (copd.parent_opd === parentId && !opdsToRemove.has(cid)) {
            collectDescendants(cid);
          }
        }
      };
      collectDescendants(id);
    }
  }
  for (const id of opdsToRemove) opds.delete(id);
  // Also remove appearances in cascaded OPDs
  for (const [key, a] of appearances) {
    if (opdsToRemove.has(a.opd)) appearances.delete(key);
  }
```

Then update the return statement to include `opds`:

```typescript
  return ok(touch({ ...model, things, states, links, modifiers, appearances, requirements, fans, assertions, stereotypes, opds }));
```

- [ ] **Step 4: Run tests — expect all passing**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run packages/core/tests/api-refinement.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full suite**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run`
Expected: All tests pass (existing + new)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-refinement.test.ts
git commit -m "feat(core): add unfold selector and fix removeThing cascade to refinement OPDs"
```

---

### Task 3: New validation checks in `validate()`

**Files:**
- Modify: `packages/core/src/api.ts` (add DANGLING_REFINES + INCONSISTENT_REFINEMENT to `validate()`)
- Modify: `packages/core/tests/api-refinement.test.ts` (add validation tests)

**Context:** `validate()` is at lines 737-866 of api.ts. It iterates over all entities checking invariants and returns `InvariantError[]`. Add new checks after the I-15 block (line 847).

- [ ] **Step 1: Write failing validation tests**

Add to `packages/core/tests/api-refinement.test.ts`:

```typescript
import { validate } from "../src/api";

describe("validate() refinement checks", () => {
  it("detects DANGLING_REFINES — OPD refines non-existent thing", () => {
    let m = createModel("test");
    m = unwrap(addOPD(m, { id: "opd-sd", name: "SD", opd_type: "hierarchical", parent_opd: null }));
    // Manually insert OPD with dangling refines (bypass addOPD guards)
    const opds = new Map(m.opds);
    opds.set("opd-sd1", { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-nonexistent", refinement_type: "in-zoom" });
    m = { ...m, opds };
    const errors = validate(m);
    expect(errors.some(e => e.code === "DANGLING_REFINES")).toBe(true);
  });

  it("detects INCONSISTENT_REFINEMENT — refines without refinement_type", () => {
    let m = createModel("test");
    m = unwrap(addOPD(m, { id: "opd-sd", name: "SD", opd_type: "hierarchical", parent_opd: null }));
    const opds = new Map(m.opds);
    opds.set("opd-sd1", { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-something" } as any);
    m = { ...m, opds };
    const errors = validate(m);
    expect(errors.some(e => e.code === "INCONSISTENT_REFINEMENT")).toBe(true);
  });

  it("detects INCONSISTENT_REFINEMENT — refinement_type without refines", () => {
    let m = createModel("test");
    m = unwrap(addOPD(m, { id: "opd-sd", name: "SD", opd_type: "hierarchical", parent_opd: null }));
    const opds = new Map(m.opds);
    opds.set("opd-sd1", { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refinement_type: "in-zoom" } as any);
    m = { ...m, opds };
    const errors = validate(m);
    expect(errors.some(e => e.code === "INCONSISTENT_REFINEMENT")).toBe(true);
  });

  it("passes validation for correctly formed refinement", () => {
    let m = buildTestModel();
    m = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
    const errors = validate(m);
    expect(errors.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — expect new validation tests to fail**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run packages/core/tests/api-refinement.test.ts`
Expected: New validation tests FAIL (codes not recognized yet)

- [ ] **Step 3: Add validation checks to `validate()` in api.ts**

Add after the I-15 block in `validate()` (after line 847):

```typescript
  // DANGLING_REFINES: OPD.refines must reference existing thing
  for (const [id, opd] of model.opds) {
    if (opd.refines !== undefined && !model.things.has(opd.refines)) {
      errors.push({ code: "DANGLING_REFINES", message: `OPD ${id} refines non-existent thing: ${opd.refines}`, entity: id });
    }
  }

  // INCONSISTENT_REFINEMENT: refines and refinement_type must be both present or both absent
  for (const [id, opd] of model.opds) {
    const hasRefines = opd.refines !== undefined;
    const hasType = opd.refinement_type !== undefined;
    if (hasRefines !== hasType) {
      errors.push({ code: "INCONSISTENT_REFINEMENT", message: `OPD ${id} has refines without refinement_type or vice versa`, entity: id });
    }
  }
```

- [ ] **Step 4: Run tests — expect all passing**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-refinement.test.ts
git commit -m "feat(core): add DANGLING_REFINES and INCONSISTENT_REFINEMENT validation checks"
```

---

## Chunk 2: CLI Command

### Task 4: `opmod refine` command + tests

**Files:**
- Create: `packages/cli/src/commands/refine.ts`
- Modify: `packages/cli/src/cli.ts` (register command)
- Modify: `packages/cli/src/index.ts` (add export)
- Create: `packages/cli/tests/refine.test.ts`

**Context:** CLI pattern: command handler in `src/commands/`, registered in `cli.ts`, tested in `tests/`. Uses `readModel`/`writeModel`/`resolveModelFile` from `../io`, `handleResult`/`fatal` from `../format`, `slug` from `../slug` for ID generation. The `generateId` helper doesn't exist — use `slug` function which converts name to kebab-case, then prefix with `opd-`.

- [ ] **Step 1: Write the CLI tests**

```typescript
// packages/cli/tests/refine.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createModel, addThing, addOPD, addAppearance, addLink,
  saveModel,
} from "@opmodel/core";
import { executeRefine } from "../src/commands/refine";
import { readModel } from "../src/io";

function unwrap<T, E>(result: { ok: boolean; value?: T; error?: E }): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${JSON.stringify((result as any).error)}`);
  return result.value as T;
}

let dir: string;
let TEST_FILE: string;

function setupModel(): void {
  let m = createModel("test");
  m = unwrap(addOPD(m, { id: "opd-sd", name: "SD", opd_type: "hierarchical", parent_opd: null }));
  m = unwrap(addThing(m, { id: "proc-heat", kind: "process", name: "Heating", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addAppearance(m, { thing: "proc-heat", opd: "opd-sd", x: 100, y: 100, w: 150, h: 80 }));
  m = unwrap(addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 60 }));
  m = unwrap(addLink(m, { id: "lnk-1", type: "effect", source: "obj-water", target: "proc-heat" }));
  const json = saveModel(m);
  writeFileSync(TEST_FILE, json);
}

describe("executeRefine", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "opmod-test-"));
    TEST_FILE = join(dir, "test-refine.opmodel");
    setupModel();
  });
  afterEach(() => rmSync(dir, { recursive: true }));

  it("creates refinement OPD with auto-generated ID and name", () => {
    const result = executeRefine("proc-heat", {
      opd: "opd-sd",
      type: "in-zoom",
      file: TEST_FILE,
    });
    expect(result.type).toBe("refinement");
    expect(result.opd.refinement_type).toBe("in-zoom");
    expect(result.opd.refines).toBe("proc-heat");
    expect(result.opd.name).toBe("SD1");
    expect(result.opd.parent_opd).toBe("opd-sd");
    expect(result.appearancesCreated).toBeGreaterThan(0);
  });

  it("persists the model after refinement", () => {
    executeRefine("proc-heat", { opd: "opd-sd", type: "in-zoom", file: TEST_FILE });
    // Re-read from disk and check OPD exists
    const { model: loaded } = readModel(TEST_FILE);
    const refinementOpds = [...loaded.opds.values()].filter(o => o.refines === "proc-heat");
    expect(refinementOpds.length).toBe(1);
  });

  it("auto-names with dot notation for sub-levels", () => {
    // First refinement: SD → SD1
    executeRefine("proc-heat", { opd: "opd-sd", type: "in-zoom", file: TEST_FILE });
    // Reload and check
    const { model } = readModel(TEST_FILE);
    const sd1 = [...model.opds.values()].find(o => o.name === "SD1");
    expect(sd1).toBeDefined();
  });

  it("throws on non-existent thing", () => {
    expect(() => executeRefine("proc-nonexistent", { opd: "opd-sd", type: "in-zoom", file: TEST_FILE })).toThrow();
  });

  it("throws on invalid refinement type", () => {
    // Unfold on process should fail
    expect(() => executeRefine("proc-heat", { opd: "opd-sd", type: "unfold", file: TEST_FILE })).toThrow();
  });
});
```

- [ ] **Step 2: Create `refine.ts` command handler**

```typescript
// packages/cli/src/commands/refine.ts
import {
  refineThing, type Model, type RefinementType,
} from "@opmodel/core";
import { handleResult, fatal } from "../format";
import { readModel, writeModel, resolveModelFile } from "../io";

interface RefineOptions {
  file?: string;
  opd: string;
  type: RefinementType;
}

interface RefineResult {
  type: "refinement";
  opd: { id: string; name: string; refines: string; refinement_type: string; parent_opd: string };
  appearancesCreated: number;
}

function computeChildOpdName(parentName: string, existingChildCount: number): string {
  const index = existingChildCount + 1;
  return parentName.length <= 2
    ? `${parentName}${index}`
    : `${parentName}.${index}`;
}

function generateOpdId(name: string): string {
  return `opd-${name.toLowerCase().replace(/\./g, "-")}`;
}

export function executeRefine(
  thingId: string,
  opts: RefineOptions,
): RefineResult {
  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);

  // Get parent OPD for naming
  const parentOpd = model.opds.get(opts.opd);
  if (!parentOpd) fatal(`OPD not found: ${opts.opd}`);

  // Count existing children for auto-naming
  let childCount = 0;
  for (const opd of model.opds.values()) {
    if (opd.parent_opd === opts.opd) childCount++;
  }

  const childName = computeChildOpdName(parentOpd!.name, childCount);
  const childId = generateOpdId(childName);

  const appearancesBefore = model.appearances.size;
  const newModel = handleResult(
    refineThing(model, thingId, opts.opd, opts.type, childId, childName),
    { json: false },
  );
  const appearancesCreated = newModel.appearances.size - appearancesBefore;

  writeModel(newModel, filePath);

  const createdOpd = newModel.opds.get(childId)!;
  return {
    type: "refinement",
    opd: {
      id: createdOpd.id,
      name: createdOpd.name,
      refines: createdOpd.refines!,
      refinement_type: createdOpd.refinement_type!,
      parent_opd: createdOpd.parent_opd!,
    },
    appearancesCreated,
  };
}
```

- [ ] **Step 3: Register the command in cli.ts**

Add import at top of `packages/cli/src/cli.ts`:

```typescript
import { executeRefine } from "./commands/refine";
```

Add before the global error handler (before `// Global error handler`):

```typescript
program
  .command("refine")
  .description("Refine a thing (in-zoom or unfold)")
  .argument("<thingId>", "Thing ID to refine")
  .requiredOption("--opd <opd>", "Parent OPD ID")
  .requiredOption("--type <type>", "Refinement type (in-zoom|unfold)")
  .option("--file <file>", "Path to .opmodel file")
  .action((thingId: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeRefine(thingId, {
      opd: opts.opd as string,
      type: opts.type as any,
      file: opts.file as string,
    });
    if (jsonFlag) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Refined ${thingId} → ${result.opd.name} (${result.opd.refinement_type}, ${result.appearancesCreated} appearances)`);
    }
  });
```

- [ ] **Step 4: Add export to cli index.ts**

In `packages/cli/src/index.ts`, add:

```typescript
export { executeRefine } from "./commands/refine";
```

- [ ] **Step 5: Run CLI tests**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run packages/cli/tests/refine.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 6: Run full suite**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx vitest run`
Expected: All tests pass

- [ ] **Step 7: Type check**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/.worktrees/refinement/packages/core && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/commands/refine.ts packages/cli/src/cli.ts packages/cli/src/index.ts packages/cli/tests/refine.test.ts
git commit -m "feat(cli): add opmod refine command with auto-naming"
```
