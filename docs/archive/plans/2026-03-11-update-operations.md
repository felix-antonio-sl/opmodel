# Update Operations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 14 `update*` functions, `touch()` timestamp management, and `History<T>` undo/redo to `@opmodel/core`.

**Architecture:** Pure immutable functions using `Partial<Omit<Entity, "id">>` patches with `cleanPatch()` to strip undefined values. Fibered re-validation checks only invariants affected by changed fields. `touch()` composes into every mutation's return path. History is a generic stream coalgebra.

**Tech Stack:** TypeScript, Vitest, Bun

**Spec:** `docs/superpowers/specs/2026-03-11-update-operations-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/core/src/helpers.ts` | **Modify** | Add `touch()` and `cleanPatch()` helpers |
| `packages/core/src/api.ts` | **Modify** | Retrofit `touch()` into 24 existing mutations; add 14 `update*` functions |
| `packages/core/src/history.ts` | **Create** | `History<T>` type + `createHistory`, `pushHistory`, `undo`, `redo` |
| `packages/core/src/index.ts` | **Modify** | Export new functions and History module |
| `packages/core/tests/helpers.test.ts` | **Create** | Tests for `touch()` and `cleanPatch()` |
| `packages/core/tests/api-touch.test.ts` | **Create** | Tests verifying `touch()` composition in all mutations |
| `packages/core/tests/api-updates.test.ts` | **Create** | Tests for all 14 `update*` functions |
| `packages/core/tests/history.test.ts` | **Create** | Tests for History coalgebra |

---

## Chunk 1: Foundational Helpers + Singleton Updates

### Task 1: touch() and cleanPatch() Helpers

**Files:**
- Modify: `packages/core/src/helpers.ts`
- Create: `packages/core/tests/helpers.test.ts`

- [ ] **Step 1: Write failing tests for cleanPatch()**

Create `packages/core/tests/helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { cleanPatch } from "../src/helpers";

describe("cleanPatch", () => {
  it("strips undefined values from patch", () => {
    const patch = { name: "New", notes: undefined };
    const result = cleanPatch(patch);
    expect(result).toEqual({ name: "New" });
    expect("notes" in result).toBe(false);
  });

  it("keeps null values (they are not undefined)", () => {
    const patch = { parent_opd: null, name: "X" };
    const result = cleanPatch(patch);
    expect(result).toEqual({ parent_opd: null, name: "X" });
  });

  it("returns empty object when all values are undefined", () => {
    const patch = { a: undefined, b: undefined };
    const result = cleanPatch(patch);
    expect(result).toEqual({});
  });

  it("passes through object with no undefined values unchanged", () => {
    const patch = { name: "Test", essence: "physical" };
    const result = cleanPatch(patch);
    expect(result).toEqual({ name: "Test", essence: "physical" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bunx vitest run tests/helpers.test.ts`
Expected: FAIL — `cleanPatch` is not exported from `../src/helpers`

- [ ] **Step 3: Implement cleanPatch()**

Add to `packages/core/src/helpers.ts` (after existing `collectAllIds`):

```typescript
export function cleanPatch<T extends Record<string, unknown>>(patch: T): T {
  const cleaned = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return cleaned as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bunx vitest run tests/helpers.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Write failing test for touch()**

Add to `packages/core/tests/helpers.test.ts`:

```typescript
import { cleanPatch, touch } from "../src/helpers";
import { createModel } from "../src/model";
import { vi, beforeEach, afterEach } from "vitest";

describe("touch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates meta.modified to current ISO timestamp", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const model = createModel("Test");
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    const touched = touch(model);
    expect(touched.meta.modified).toBe("2026-01-01T00:00:01.000Z");
    expect(touched.meta.modified).not.toBe(model.meta.modified);
  });

  it("preserves all other model fields", () => {
    const model = createModel("Test");
    const touched = touch(model);
    expect(touched.meta.name).toBe(model.meta.name);
    expect(touched.meta.created).toBe(model.meta.created);
    expect(touched.things).toBe(model.things); // same reference
    expect(touched.opds).toBe(model.opds); // same reference
  });

  it("does not mutate original model", () => {
    const model = createModel("Test");
    const originalModified = model.meta.modified;
    touch(model);
    expect(model.meta.modified).toBe(originalModified);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/core && bunx vitest run tests/helpers.test.ts`
Expected: FAIL — `touch` is not exported from `../src/helpers`

- [ ] **Step 7: Implement touch()**

Add to `packages/core/src/helpers.ts`:

```typescript
import type { Model } from "./types";

export function touch(model: Model): Model {
  return {
    ...model,
    meta: { ...model.meta, modified: new Date().toISOString() },
  };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/core && bunx vitest run tests/helpers.test.ts`
Expected: 7 tests PASS

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/helpers.ts packages/core/tests/helpers.test.ts
git commit -m "feat(core): add touch() and cleanPatch() helpers"
```

---

### Task 2: Retrofit touch() Into Existing 24 Mutations

**Files:**
- Modify: `packages/core/src/api.ts`
- Create: `packages/core/tests/api-touch.test.ts`

**Context:** Every `return ok(...)` in api.ts must become `return ok(touch(...))`. There are 24 functions (12 `add*` + 12 `remove*`), each with one or more `return ok(...)` paths.

- [ ] **Step 1: Write failing test for touch composition**

Create `packages/core/tests/api-touch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, removeThing,
  addState, removeState,
  addLink, removeLink,
  addOPD, removeOPD,
  addAppearance, removeAppearance,
  addModifier, removeModifier,
  addFan, removeFan,
  addScenario, removeScenario,
  addAssertion, removeAssertion,
  addRequirement, removeRequirement,
  addStereotype, removeStereotype,
  addSubModel, removeSubModel,
} from "../src/api";
import { isOk } from "../src/result";
import type { Model, Thing, State, Link, OPD, Appearance } from "../src/types";
import type { Result } from "../src/result";
import type { InvariantError } from "../src/result";

const water: Thing = { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };
const proc: Thing = { id: "proc-heat", kind: "process", name: "Heat", essence: "physical", affiliation: "systemic" };

let timeCounter = 0;
beforeEach(() => {
  vi.useFakeTimers();
  timeCounter = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

function advanceTime() {
  timeCounter += 1000;
  vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 0, timeCounter / 1000)));
}

function expectTouched(original: Model, result: Result<Model, InvariantError>) {
  if (!isOk(result)) throw new Error("Expected ok result");
  expect(result.value.meta.modified).not.toBe(original.meta.modified);
  expect(result.value.meta.created).toBe(original.meta.created);
}

describe("touch() composition", () => {
  it("addThing updates meta.modified", () => {
    advanceTime();
    const m = createModel("Test");
    advanceTime();
    const r = addThing(m, water);
    expectTouched(m, r);
  });

  it("removeThing updates meta.modified", () => {
    advanceTime();
    const m = createModel("Test");
    advanceTime();
    const r1 = addThing(m, water);
    if (!isOk(r1)) return;
    advanceTime();
    const r2 = removeThing(r1.value, "obj-water");
    expectTouched(r1.value, r2);
  });

  it("addState updates meta.modified", () => {
    advanceTime();
    let m = createModel("Test");
    advanceTime();
    m = (addThing(m, water) as any).value;
    advanceTime();
    const r = addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true });
    expectTouched(m, r);
  });

  it("addLink updates meta.modified", () => {
    advanceTime();
    let m = createModel("Test");
    advanceTime();
    m = (addThing(m, water) as any).value;
    advanceTime();
    m = (addThing(m, proc) as any).value;
    advanceTime();
    const r = addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-water" });
    expectTouched(m, r);
  });

  it("addOPD updates meta.modified", () => {
    advanceTime();
    const m = createModel("Test");
    advanceTime();
    const r = addOPD(m, { id: "opd-child", name: "Child", opd_type: "hierarchical", parent_opd: "opd-sd" });
    expectTouched(m, r);
  });

  it("addAppearance updates meta.modified", () => {
    advanceTime();
    let m = createModel("Test");
    advanceTime();
    m = (addThing(m, water) as any).value;
    advanceTime();
    const r = addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
    expectTouched(m, r);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bunx vitest run tests/api-touch.test.ts`
Expected: FAIL — `meta.modified` is unchanged (same reference)

- [ ] **Step 3: Retrofit touch() into all 24 mutations in api.ts**

Add import at top of `packages/core/src/api.ts`:

```typescript
import { collectAllIds, touch } from "./helpers";
```

Then replace every `return ok({` with `return ok(touch({` and close with `}))` instead of `})`.

Specifically, wrap every successful `ok(...)` return with `touch()`. There are these return points:
- `addThing`: 1 return
- `removeThing`: 1 return
- `addState`: 1 return
- `removeState`: 1 return
- `addLink`: 1 return
- `removeLink`: 1 return
- `addOPD`: 1 return
- `removeOPD`: 1 return
- `addAppearance`: 1 return
- `removeAppearance`: 1 return
- `addModifier`: 1 return
- `removeModifier`: 1 return
- `addFan`: 1 return
- `removeFan`: 1 return
- `addScenario`: 1 return
- `removeScenario`: 1 return
- `addAssertion`: 1 return
- `removeAssertion`: 1 return
- `addRequirement`: 1 return
- `removeRequirement`: 1 return
- `addStereotype`: 1 return
- `removeStereotype`: 1 return
- `addSubModel`: 1 return
- `removeSubModel`: 1 return

Pattern for each:
```typescript
// Before:
return ok({ ...model, things: newThings });
// After:
return ok(touch({ ...model, things: newThings }));
```

- [ ] **Step 4: Run touch tests to verify they pass**

Run: `cd packages/core && bunx vitest run tests/api-touch.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Run all existing tests to verify no regressions**

Run: `cd packages/core && bunx vitest run`
Expected: All existing tests PASS (touch adds modified but doesn't break any assertions)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-touch.test.ts
git commit -m "feat(core): retrofit touch() into all 24 existing mutations"
```

---

### Task 3: updateMeta + updateSettings

**Files:**
- Modify: `packages/core/src/api.ts`
- Create: `packages/core/tests/api-updates.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/tests/api-updates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { isOk, isErr } from "../src/result";
import { updateMeta, updateSettings } from "../src/api";

describe("updateMeta", () => {
  it("updates name", () => {
    const m = createModel("Old Name");
    const r = updateMeta(m, { name: "New Name" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.name).toBe("New Name");
    }
  });

  it("updates description", () => {
    const m = createModel("Test");
    const r = updateMeta(m, { description: "A test model" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.description).toBe("A test model");
    }
  });

  it("preserves created timestamp", () => {
    const m = createModel("Test");
    const r = updateMeta(m, { name: "Updated" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.created).toBe(m.meta.created);
    }
  });

  it("touch updates modified timestamp", () => {
    const m = createModel("Test");
    const r = updateMeta(m, { name: "Updated" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.modified).not.toBe(m.meta.modified);
    }
  });

  it("does not mutate original model", () => {
    const m = createModel("Test");
    const originalName = m.meta.name;
    updateMeta(m, { name: "New" });
    expect(m.meta.name).toBe(originalName);
  });

  it("ignores undefined values in patch (cleanPatch)", () => {
    const m = createModel("Test");
    const r = updateMeta(m, { name: undefined as any, description: "desc" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.name).toBe("Test");
      expect(r.value.meta.description).toBe("desc");
    }
  });
});

describe("updateSettings", () => {
  it("updates a single setting", () => {
    const m = createModel("Test");
    const r = updateSettings(m, { autoformat: true });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.settings.autoformat).toBe(true);
    }
  });

  it("updates multiple settings at once", () => {
    const m = createModel("Test");
    const r = updateSettings(m, {
      opl_language: "en",
      decimal_precision: 3,
      notes_visible: true,
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.settings.opl_language).toBe("en");
      expect(r.value.settings.decimal_precision).toBe(3);
      expect(r.value.settings.notes_visible).toBe(true);
    }
  });

  it("touch updates modified timestamp", () => {
    const m = createModel("Test");
    const r = updateSettings(m, { autoformat: true });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.meta.modified).not.toBe(m.meta.modified);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: FAIL — `updateMeta` and `updateSettings` are not exported

- [ ] **Step 3: Implement updateMeta and updateSettings**

Add to `packages/core/src/api.ts` (after the `removeSubModel` function, before `validate`):

First, update the import at the top of `packages/core/src/api.ts`:

```typescript
// Change the existing helpers import to:
import { collectAllIds, touch, cleanPatch } from "./helpers";

// Change the existing types import to include Meta and Settings:
import type {
  Model, Thing, State, Link, OPD, Appearance,
  Modifier, Fan, Assertion, Requirement, Stereotype,
  SubModel, Scenario, Meta, Settings,
} from "./types";
```

Then add these functions after `removeSubModel`, before `validate`:

```typescript
// ── Singleton Updates ─────────────────────────────────────────────────

export function updateMeta(
  model: Model,
  patch: Partial<Omit<Meta, "created" | "modified">>,
): Result<Model, InvariantError> {
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  return ok(touch({
    ...model,
    meta: { ...model.meta, ...cleaned },
  }));
}

export function updateSettings(
  model: Model,
  patch: Partial<Settings>,
): Result<Model, InvariantError> {
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  return ok(touch({
    ...model,
    settings: { ...model.settings, ...cleaned },
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: 9 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `cd packages/core && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-updates.test.ts
git commit -m "feat(core): add updateMeta and updateSettings"
```

---

## Chunk 2: Entity Update Functions

### Task 4: Simple Entity Updates (6 functions)

These entities have simple reference checks: `updateModifier` (I-06), `updateAssertion` (I-09), `updateRequirement` (I-10), `updateStereotype` (I-11), `updateSubModel` (I-12), `updateScenario` (I-13).

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api-updates.test.ts`

- [ ] **Step 1: Write failing tests for 6 simple update functions**

Append to `packages/core/tests/api-updates.test.ts`. First, **merge** these into the existing `import` from `"../src/api"` at the top of the file (do NOT add a second import statement):

Add to the api import: `updateModifier, updateAssertion, updateRequirement, updateStereotype, updateSubModel, updateScenario, addThing, addLink, addModifier, addAssertion, addRequirement, addStereotype, addSubModel, addScenario`

Add a new import: `import type { Thing, Link } from "../src/types";`

Then append this code after the existing `updateSettings` describe block:

```typescript
const water: Thing = { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };
const proc: Thing = { id: "proc-heat", kind: "process", name: "Heat", essence: "physical", affiliation: "systemic" };

function buildModelWithLink() {
  let m = createModel("Test");
  m = (addThing(m, water) as any).value;
  m = (addThing(m, proc) as any).value;
  m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-water" }) as any).value;
  return m;
}

describe("updateModifier", () => {
  it("updates modifier type", () => {
    let m = buildModelWithLink();
    m = (addModifier(m, { id: "mod-1", over: "lnk-1", type: "event" }) as any).value;
    const r = updateModifier(m, "mod-1", { type: "condition" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.modifiers.get("mod-1")?.type).toBe("condition");
  });

  it("rejects update to non-existent modifier", () => {
    const r = updateModifier(createModel("Test"), "mod-ghost", { type: "condition" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects update with non-existent link reference (I-06)", () => {
    let m = buildModelWithLink();
    m = (addModifier(m, { id: "mod-1", over: "lnk-1", type: "event" }) as any).value;
    const r = updateModifier(m, "mod-1", { over: "lnk-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-06");
  });
});

describe("updateAssertion", () => {
  it("updates predicate", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAssertion(m, { id: "ast-1", target: "obj-water", predicate: "exists", category: "safety", enabled: true }) as any).value;
    const r = updateAssertion(m, "ast-1", { predicate: "temperature > 0" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.assertions.get("ast-1")?.predicate).toBe("temperature > 0");
  });

  it("rejects update with non-existent target (I-09)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAssertion(m, { id: "ast-1", target: "obj-water", predicate: "p", category: "safety", enabled: true }) as any).value;
    const r = updateAssertion(m, "ast-1", { target: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-09");
  });
});

describe("updateRequirement", () => {
  it("updates name", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addRequirement(m, { id: "req-1", target: "obj-water", name: "Req1" }) as any).value;
    const r = updateRequirement(m, "req-1", { name: "Updated Req" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.requirements.get("req-1")?.name).toBe("Updated Req");
  });

  it("rejects update with non-existent target (I-10)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addRequirement(m, { id: "req-1", target: "obj-water", name: "R" }) as any).value;
    const r = updateRequirement(m, "req-1", { target: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-10");
  });
});

describe("updateStereotype", () => {
  it("updates stereotype_id", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addStereotype(m, { id: "stp-1", thing: "obj-water", stereotype_id: "agent", global: false }) as any).value;
    const r = updateStereotype(m, "stp-1", { stereotype_id: "sensor" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.stereotypes.get("stp-1")?.stereotype_id).toBe("sensor");
  });

  it("rejects update with non-existent thing (I-11)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addStereotype(m, { id: "stp-1", thing: "obj-water", stereotype_id: "x", global: false }) as any).value;
    const r = updateStereotype(m, "stp-1", { thing: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-11");
  });
});

describe("updateSubModel", () => {
  it("updates name", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addSubModel(m, { id: "sub-1", name: "Sub1", path: "/sub", shared_things: ["obj-water"], sync_status: "synced" }) as any).value;
    const r = updateSubModel(m, "sub-1", { name: "Renamed Sub" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.subModels.get("sub-1")?.name).toBe("Renamed Sub");
  });

  it("rejects update with non-existent shared thing (I-12)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addSubModel(m, { id: "sub-1", name: "S", path: "/s", shared_things: ["obj-water"], sync_status: "synced" }) as any).value;
    const r = updateSubModel(m, "sub-1", { shared_things: ["obj-ghost"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-12");
  });
});

describe("updateScenario", () => {
  it("updates name", () => {
    let m = buildModelWithLink();
    const link = m.links.get("lnk-1")!;
    m = { ...m, links: new Map(m.links).set("lnk-1", { ...link, path_label: "main" }) };
    m = (addScenario(m, { id: "scn-1", name: "Scenario1", path_labels: ["main"] }) as any).value;
    const r = updateScenario(m, "scn-1", { name: "Updated Scenario" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.scenarios.get("scn-1")?.name).toBe("Updated Scenario");
  });

  it("rejects update with non-existent path label (I-13)", () => {
    let m = buildModelWithLink();
    const link = m.links.get("lnk-1")!;
    m = { ...m, links: new Map(m.links).set("lnk-1", { ...link, path_label: "main" }) };
    m = (addScenario(m, { id: "scn-1", name: "S", path_labels: ["main"] }) as any).value;
    const r = updateScenario(m, "scn-1", { path_labels: ["nonexistent"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-13");
  });
});
```

Update the import block at the top of the file to include all needed imports (merge with existing).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: FAIL — `updateModifier`, etc. not exported

- [ ] **Step 3: Implement 6 update functions**

Add to `packages/core/src/api.ts` (after `updateSettings`, before `validate`):

```typescript
// ── Entity Updates (simple reference checks) ──────────────────────────

export function updateModifier(
  model: Model,
  id: string,
  patch: Partial<Omit<Modifier, "id">>,
): Result<Model, InvariantError> {
  const existing = model.modifiers.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Modifier not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Modifier;
  // I-06: link must exist
  if (cleaned.over !== undefined && !model.links.has(updated.over)) {
    return err({ code: "I-06", message: `Link not found: ${updated.over}`, entity: id });
  }
  return ok(touch({ ...model, modifiers: new Map(model.modifiers).set(id, updated) }));
}

export function updateAssertion(
  model: Model,
  id: string,
  patch: Partial<Omit<Assertion, "id">>,
): Result<Model, InvariantError> {
  const existing = model.assertions.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Assertion not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Assertion;
  // I-09: target must exist (thing or link)
  if (cleaned.target !== undefined && updated.target != null) {
    if (!model.things.has(updated.target) && !model.links.has(updated.target)) {
      return err({ code: "I-09", message: `Assertion target not found: ${updated.target}`, entity: id });
    }
  }
  return ok(touch({ ...model, assertions: new Map(model.assertions).set(id, updated) }));
}

export function updateRequirement(
  model: Model,
  id: string,
  patch: Partial<Omit<Requirement, "id">>,
): Result<Model, InvariantError> {
  const existing = model.requirements.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Requirement not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Requirement;
  // I-10: target must exist (thing, state, or link)
  if (cleaned.target !== undefined) {
    if (!model.things.has(updated.target) && !model.states.has(updated.target) && !model.links.has(updated.target)) {
      return err({ code: "I-10", message: `Requirement target not found: ${updated.target}`, entity: id });
    }
  }
  return ok(touch({ ...model, requirements: new Map(model.requirements).set(id, updated) }));
}

export function updateStereotype(
  model: Model,
  id: string,
  patch: Partial<Omit<Stereotype, "id">>,
): Result<Model, InvariantError> {
  const existing = model.stereotypes.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Stereotype not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Stereotype;
  // I-11: thing must exist
  if (cleaned.thing !== undefined && !model.things.has(updated.thing)) {
    return err({ code: "I-11", message: `Stereotype target thing not found: ${updated.thing}`, entity: id });
  }
  return ok(touch({ ...model, stereotypes: new Map(model.stereotypes).set(id, updated) }));
}

export function updateSubModel(
  model: Model,
  id: string,
  patch: Partial<Omit<SubModel, "id">>,
): Result<Model, InvariantError> {
  const existing = model.subModels.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `SubModel not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as SubModel;
  // I-12: shared things must exist
  if (cleaned.shared_things !== undefined) {
    for (const thingId of updated.shared_things) {
      if (!model.things.has(thingId)) {
        return err({ code: "I-12", message: `Shared thing not found: ${thingId}`, entity: id });
      }
    }
  }
  return ok(touch({ ...model, subModels: new Map(model.subModels).set(id, updated) }));
}

export function updateScenario(
  model: Model,
  id: string,
  patch: Partial<Omit<Scenario, "id">>,
): Result<Model, InvariantError> {
  const existing = model.scenarios.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Scenario not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Scenario;
  // I-13: path labels must exist in links
  if (cleaned.path_labels !== undefined) {
    const allPathLabels = new Set(
      [...model.links.values()].map((l) => l.path_label).filter(Boolean) as string[]
    );
    for (const pl of updated.path_labels) {
      if (!allPathLabels.has(pl)) {
        return err({ code: "I-13", message: `Path label not found in any link: ${pl}`, entity: id });
      }
    }
  }
  return ok(touch({ ...model, scenarios: new Map(model.scenarios).set(id, updated) }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `cd packages/core && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-updates.test.ts
git commit -m "feat(core): add 6 simple entity update functions"
```

---

### Task 5: Structural Entity Updates (4 functions)

`updateState` (I-01), `updateOPD` (I-03), `updateAppearance` (I-15), `updateFan` (I-07).

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api-updates.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/core/tests/api-updates.test.ts`:

**Merge into existing imports:** Add `updateState, updateOPD, updateAppearance, updateFan, addState, addOPD, addAppearance, addFan` to the existing `import` from `"../src/api"` at the top of the file.

Then append these describe blocks after the existing tests:

```typescript

describe("updateState", () => {
  it("updates state name", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    const r = updateState(m, "state-cold", { name: "freezing" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.states.get("state-cold")?.name).toBe("freezing");
  });

  it("rejects update to non-existent state", () => {
    const r = updateState(createModel("Test"), "state-ghost", { name: "x" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects reparenting to non-existent thing (I-01)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    const r = updateState(m, "state-cold", { parent: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });

  it("rejects reparenting to process (I-01)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    const r = updateState(m, "state-cold", { parent: "proc-heat" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });
});

describe("updateOPD", () => {
  it("updates OPD name", () => {
    const m = createModel("Test");
    const r = updateOPD(m, "opd-sd", { name: "System Diagram" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.opds.get("opd-sd")?.name).toBe("System Diagram");
  });

  it("rejects update to non-existent OPD", () => {
    const r = updateOPD(createModel("Test"), "opd-ghost", { name: "x" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects reparenting to non-existent OPD (I-03)", () => {
    let m = createModel("Test");
    m = (addOPD(m, { id: "opd-child", name: "Child", opd_type: "hierarchical", parent_opd: "opd-sd" }) as any).value;
    const r = updateOPD(m, "opd-child", { parent_opd: "opd-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-03");
  });

  it("rejects view OPD with non-null parent (I-03)", () => {
    let m = createModel("Test");
    m = (addOPD(m, { id: "opd-view", name: "View", opd_type: "view", parent_opd: null }) as any).value;
    const r = updateOPD(m, "opd-view", { parent_opd: "opd-sd" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-03");
  });
});

describe("updateAppearance", () => {
  it("updates position", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 }) as any).value;
    const r = updateAppearance(m, "obj-water", "opd-sd", { x: 200, y: 150 });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      const app = r.value.appearances.get("obj-water::opd-sd");
      expect(app?.x).toBe(200);
      expect(app?.y).toBe(150);
      expect(app?.w).toBe(100); // unchanged
    }
  });

  it("rejects update to non-existent appearance", () => {
    const r = updateAppearance(createModel("Test"), "obj-ghost", "opd-sd", { x: 10 });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects internal=true in non-refinement OPD (I-15)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 }) as any).value;
    const r = updateAppearance(m, "obj-water", "opd-sd", { internal: true });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-15");
  });
});

describe("updateFan", () => {
  it("updates fan type", () => {
    let m = buildModelWithLink();
    m = (addLink(m, { id: "lnk-2", type: "consumption", source: "proc-heat", target: "obj-water" }) as any).value;
    m = (addFan(m, { id: "fan-1", type: "xor", members: ["lnk-1", "lnk-2"] }) as any).value;
    const r = updateFan(m, "fan-1", { type: "or" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.fans.get("fan-1")?.type).toBe("or");
  });

  it("rejects update with fewer than 2 members (I-07)", () => {
    let m = buildModelWithLink();
    m = (addLink(m, { id: "lnk-2", type: "consumption", source: "proc-heat", target: "obj-water" }) as any).value;
    m = (addFan(m, { id: "fan-1", type: "xor", members: ["lnk-1", "lnk-2"] }) as any).value;
    const r = updateFan(m, "fan-1", { members: ["lnk-1"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-07");
  });

  it("rejects update with non-existent member link (I-07)", () => {
    let m = buildModelWithLink();
    m = (addLink(m, { id: "lnk-2", type: "consumption", source: "proc-heat", target: "obj-water" }) as any).value;
    m = (addFan(m, { id: "fan-1", type: "xor", members: ["lnk-1", "lnk-2"] }) as any).value;
    const r = updateFan(m, "fan-1", { members: ["lnk-1", "lnk-ghost"] });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-07");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement 4 structural update functions**

Add to `packages/core/src/api.ts`:

```typescript
// ── Entity Updates (structural checks) ────────────────────────────────

export function updateState(
  model: Model,
  id: string,
  patch: Partial<Omit<State, "id">>,
): Result<Model, InvariantError> {
  const existing = model.states.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `State not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as State;
  // I-01: parent must be an object
  if (cleaned.parent !== undefined) {
    const parent = model.things.get(updated.parent);
    if (!parent) return err({ code: "I-01", message: `Parent thing not found: ${updated.parent}`, entity: id });
    if (parent.kind !== "object") return err({ code: "I-01", message: `State parent must be object, got process: ${updated.parent}`, entity: id });
  }
  return ok(touch({ ...model, states: new Map(model.states).set(id, updated) }));
}

export function updateOPD(
  model: Model,
  id: string,
  patch: Partial<Omit<OPD, "id">>,
): Result<Model, InvariantError> {
  const existing = model.opds.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `OPD not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as OPD;
  // I-03: hierarchy rules
  if (updated.opd_type === "view" && updated.parent_opd !== null) {
    return err({ code: "I-03", message: `View OPD must have parent_opd=null`, entity: id });
  }
  if (updated.opd_type === "hierarchical" && updated.parent_opd !== null) {
    if (!model.opds.has(updated.parent_opd)) {
      return err({ code: "I-03", message: `Parent OPD not found: ${updated.parent_opd}`, entity: id });
    }
  }
  return ok(touch({ ...model, opds: new Map(model.opds).set(id, updated) }));
}

export function updateAppearance(
  model: Model,
  thing: string,
  opd: string,
  patch: Partial<Omit<Appearance, "thing" | "opd">>,
): Result<Model, InvariantError> {
  const key = `${thing}::${opd}`;
  const existing = model.appearances.get(key);
  if (!existing) return err({ code: "NOT_FOUND", message: `Appearance not found: ${key}`, entity: key });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Appearance;
  // I-15: internal only in refinement OPDs
  if (updated.internal) {
    const opdEntity = model.opds.get(opd);
    if (!opdEntity || !opdEntity.refines) {
      return err({ code: "I-15", message: `internal=true only allowed in refinement OPDs`, entity: key });
    }
  }
  return ok(touch({ ...model, appearances: new Map(model.appearances).set(key, updated) }));
}

export function updateFan(
  model: Model,
  id: string,
  patch: Partial<Omit<Fan, "id">>,
): Result<Model, InvariantError> {
  const existing = model.fans.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Fan not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Fan;
  // I-07: must have >= 2 members, all must be links
  if (cleaned.members !== undefined) {
    if (updated.members.length < 2) {
      return err({ code: "I-07", message: `Fan must have at least 2 members, got ${updated.members.length}`, entity: id });
    }
    for (const memberId of updated.members) {
      if (!model.links.has(memberId)) {
        return err({ code: "I-07", message: `Fan member link not found: ${memberId}`, entity: id });
      }
    }
  }
  return ok(touch({ ...model, fans: new Map(model.fans).set(id, updated) }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `cd packages/core && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-updates.test.ts
git commit -m "feat(core): add updateState, updateOPD, updateAppearance, updateFan"
```

---

### Task 6: updateThing (Complex Fibered Checks)

`updateThing` checks I-01 (kind→object required for states), I-14 (duration.max for exception links), I-18 (physical for agent links), I-19 (informatical for exhibition links). All use **reject** semantics.

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api-updates.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/core/tests/api-updates.test.ts`:

**Merge into existing imports:** Add `updateThing` to the existing `import` from `"../src/api"`.

Then append:

```typescript
describe("updateThing", () => {
  it("updates thing name", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const r = updateThing(m, "obj-water", { name: "H2O" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.things.get("obj-water")?.name).toBe("H2O");
  });

  it("rejects update to non-existent thing", () => {
    const r = updateThing(createModel("Test"), "obj-ghost", { name: "x" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects kind change object→process when states exist (I-01)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    const r = updateThing(m, "obj-water", { kind: "process" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });

  it("allows kind change object→process when no states", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const r = updateThing(m, "obj-water", { kind: "process" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.things.get("obj-water")?.kind).toBe("process");
  });

  it("rejects essence change to informatical when thing is agent source (I-18)", () => {
    let m = createModel("Test");
    const barista: Thing = { id: "obj-barista", kind: "object", name: "Barista", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, barista) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-barista", target: "proc-heat" }) as any).value;
    const r = updateThing(m, "obj-barista", { essence: "informatical" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-18");
  });

  it("rejects essence change to physical when thing is exhibition source (I-19)", () => {
    let m = createModel("Test");
    const attr: Thing = { id: "obj-attr", kind: "object", name: "Color", essence: "informatical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, attr) as any).value;
    m = (addLink(m, { id: "lnk-exhibit", type: "exhibition", source: "obj-attr", target: "obj-water" }) as any).value;
    const r = updateThing(m, "obj-attr", { essence: "physical" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-19");
  });

  it("rejects removing duration.max when exception link depends on it (I-14)", () => {
    let m = createModel("Test");
    const timedProc: Thing = { id: "proc-timed", kind: "process", name: "Timed", essence: "physical", affiliation: "systemic", duration: { nominal: 60, max: 120, unit: "s" } };
    const handler: Thing = { id: "proc-handler", kind: "process", name: "Handler", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, timedProc) as any).value;
    m = (addThing(m, handler) as any).value;
    m = (addLink(m, { id: "lnk-exc", type: "exception", source: "proc-timed", target: "proc-handler" }) as any).value;
    const r = updateThing(m, "proc-timed", { duration: { nominal: 60, unit: "s" } });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-14");
  });

  it("does not mutate original model", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const originalName = m.things.get("obj-water")!.name;
    updateThing(m, "obj-water", { name: "New" });
    expect(m.things.get("obj-water")!.name).toBe(originalName);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: FAIL — `updateThing` not exported

- [ ] **Step 3: Implement updateThing**

Add to `packages/core/src/api.ts`:

```typescript
// ── updateThing (complex fibered checks) ──────────────────────────────

export function updateThing(
  model: Model,
  id: string,
  patch: Partial<Omit<Thing, "id">>,
): Result<Model, InvariantError> {
  const existing = model.things.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Thing not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Thing;

  // I-01: if kind changes to process, reject if states exist
  if (cleaned.kind !== undefined && updated.kind === "process") {
    for (const state of model.states.values()) {
      if (state.parent === id) {
        return err({ code: "I-01", message: `Cannot change kind to process: thing has states`, entity: id });
      }
    }
  }

  // Check links where this thing is source
  if (cleaned.essence !== undefined || cleaned.duration !== undefined) {
    for (const link of model.links.values()) {
      if (link.source === id) {
        // I-18: agent source must be physical
        if (link.type === "agent" && updated.essence !== "physical") {
          return err({ code: "I-18", message: `Agent source must be physical: ${id}`, entity: id });
        }
        // I-19: exhibition source must be informatical
        if (link.type === "exhibition" && updated.essence !== "informatical") {
          return err({ code: "I-19", message: `Exhibition source must be informatical: ${id}`, entity: id });
        }
        // I-14: exception source must have duration.max
        if (link.type === "exception" && !updated.duration?.max) {
          return err({ code: "I-14", message: `Exception source must have duration.max: ${id}`, entity: id });
        }
      }
    }
  }

  return ok(touch({ ...model, things: new Map(model.things).set(id, updated) }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `cd packages/core && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-updates.test.ts
git commit -m "feat(core): add updateThing with fibered I-01/I-14/I-18/I-19 checks"
```

---

### Task 7: updateLink (Most Complex)

`updateLink` handles: I-05 (endpoints exist), I-14/I-18/I-19 (re-check all three when any of `{source, target, type}` changes), I-19 coercion (exhibition → informatical), source_state/target_state dangling reference validation.

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api-updates.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/core/tests/api-updates.test.ts`:

**Merge into existing imports:** Add `updateLink` to the existing `import` from `"../src/api"`.

Then append:

```typescript
describe("updateLink", () => {
  it("updates link type", () => {
    let m = buildModelWithLink();
    const r = updateLink(m, "lnk-1", { type: "result" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.links.get("lnk-1")?.type).toBe("result");
  });

  it("rejects update to non-existent link", () => {
    const r = updateLink(createModel("Test"), "lnk-ghost", { type: "result" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects update with non-existent source (I-05)", () => {
    let m = buildModelWithLink();
    const r = updateLink(m, "lnk-1", { source: "proc-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("rejects update with non-existent target (I-05)", () => {
    let m = buildModelWithLink();
    const r = updateLink(m, "lnk-1", { target: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("rejects type change to agent when source is not physical (I-18)", () => {
    let m = createModel("Test");
    const infoObj: Thing = { id: "obj-info", kind: "object", name: "Info", essence: "informatical", affiliation: "systemic" };
    m = (addThing(m, infoObj) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "instrument", source: "obj-info", target: "proc-heat" }) as any).value;
    const r = updateLink(m, "lnk-1", { type: "agent" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-18");
  });

  it("coerces source to informatical when type changes to exhibition (I-19)", () => {
    let m = createModel("Test");
    const physObj: Thing = { id: "obj-phys", kind: "object", name: "Phys", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, physObj) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "aggregation", source: "obj-phys", target: "obj-water" }) as any).value;
    const r = updateLink(m, "lnk-1", { type: "exhibition" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.things.get("obj-phys")?.essence).toBe("informatical");
    }
  });

  it("coerces new source to informatical on exhibition link (I-19)", () => {
    let m = createModel("Test");
    const attr1: Thing = { id: "obj-attr1", kind: "object", name: "Attr1", essence: "informatical", affiliation: "systemic" };
    const attr2: Thing = { id: "obj-attr2", kind: "object", name: "Attr2", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, attr1) as any).value;
    m = (addThing(m, attr2) as any).value;
    m = (addLink(m, { id: "lnk-ex", type: "exhibition", source: "obj-attr1", target: "obj-water" }) as any).value;
    const r = updateLink(m, "lnk-ex", { source: "obj-attr2" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.things.get("obj-attr2")?.essence).toBe("informatical");
    }
  });

  it("rejects type change to exception when source has no duration.max (I-14)", () => {
    let m = createModel("Test");
    const proc2: Thing = { id: "proc-main", kind: "process", name: "Main", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, proc) as any).value;
    m = (addThing(m, proc2) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "invocation", source: "proc-heat", target: "proc-main" }) as any).value;
    const r = updateLink(m, "lnk-1", { type: "exception" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-14");
  });

  it("rejects target change when target_state would dangle", () => {
    let m = createModel("Test");
    const obj2: Thing = { id: "obj-cup", kind: "object", name: "Cup", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, obj2) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-water", target_state: "state-cold" }) as any).value;
    // Change target to obj-cup — state-cold belongs to obj-water, not obj-cup
    const r = updateLink(m, "lnk-1", { target: "obj-cup" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("DANGLING_STATE");
  });

  it("rejects patching target_state to state not belonging to target", () => {
    let m = createModel("Test");
    const obj2: Thing = { id: "obj-cup", kind: "object", name: "Cup", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, obj2) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    // Link from proc-heat to obj-cup (no states on obj-cup)
    m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-cup" }) as any).value;
    // Try to set target_state to state-cold which belongs to obj-water, not obj-cup
    const r = updateLink(m, "lnk-1", { target_state: "state-cold" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("DANGLING_STATE");
  });

  it("rejects patching source_state to state not belonging to source", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addThing(m, proc) as any).value;
    m = (addState(m, { id: "state-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true }) as any).value;
    // Link from proc-heat to obj-water — proc-heat is a process, has no states
    m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-heat", target: "obj-water" }) as any).value;
    // Try to set source_state to state-cold which belongs to obj-water, not proc-heat
    const r = updateLink(m, "lnk-1", { source_state: "state-cold" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("DANGLING_STATE");
  });

  it("does not revert source essence when type changes from exhibition (I-19 irreversibility)", () => {
    let m = createModel("Test");
    const attr: Thing = { id: "obj-attr", kind: "object", name: "Attr", essence: "physical", affiliation: "systemic" };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, attr) as any).value;
    // Add exhibition link — coerces attr to informatical
    m = (addLink(m, { id: "lnk-ex", type: "exhibition", source: "obj-attr", target: "obj-water" }) as any).value;
    expect(m.things.get("obj-attr")?.essence).toBe("informatical");
    // Change type from exhibition to aggregation — source stays informatical
    const r = updateLink(m, "lnk-ex", { type: "aggregation" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.things.get("obj-attr")?.essence).toBe("informatical");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: FAIL — `updateLink` not exported

- [ ] **Step 3: Implement updateLink**

Add to `packages/core/src/api.ts`:

```typescript
// ── updateLink (complex fibered checks + I-19 coercion) ───────────────

export function updateLink(
  model: Model,
  id: string,
  patch: Partial<Omit<Link, "id">>,
): Result<Model, InvariantError> {
  const existing = model.links.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Link not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Link;

  // I-05: source and target must exist
  if (cleaned.source !== undefined && !model.things.has(updated.source)) {
    return err({ code: "I-05", message: `Source thing not found: ${updated.source}`, entity: id });
  }
  if (cleaned.target !== undefined && !model.things.has(updated.target)) {
    return err({ code: "I-05", message: `Target thing not found: ${updated.target}`, entity: id });
  }

  // Validate source_state/target_state when source, target, source_state, or target_state changes
  if ((cleaned.source !== undefined || cleaned.source_state !== undefined) && updated.source_state) {
    const state = model.states.get(updated.source_state);
    if (!state || state.parent !== updated.source) {
      return err({ code: "DANGLING_STATE", message: `source_state ${updated.source_state} does not belong to source ${updated.source}`, entity: id });
    }
  }
  if ((cleaned.target !== undefined || cleaned.target_state !== undefined) && updated.target_state) {
    const state = model.states.get(updated.target_state);
    if (!state || state.parent !== updated.target) {
      return err({ code: "DANGLING_STATE", message: `target_state ${updated.target_state} does not belong to target ${updated.target}`, entity: id });
    }
  }

  // If any of {source, target, type} changed, re-check I-14, I-18, I-19
  let things = model.things;
  if (cleaned.source !== undefined || cleaned.target !== undefined || cleaned.type !== undefined) {
    const source = things.get(updated.source);
    if (!source) return err({ code: "I-05", message: `Source thing not found: ${updated.source}`, entity: id });

    // I-18: agent source must be physical
    if (updated.type === "agent" && source.essence !== "physical") {
      return err({ code: "I-18", message: `Agent source must be physical: ${updated.source}`, entity: id });
    }

    // I-14: exception source must have duration.max
    if (updated.type === "exception" && !source.duration?.max) {
      return err({ code: "I-14", message: `Exception source must have duration.max: ${updated.source}`, entity: id });
    }

    // I-19: exhibition coercion
    if (updated.type === "exhibition") {
      if (source.essence !== "informatical") {
        things = new Map(things).set(source.id, { ...source, essence: "informatical" });
      }
    }
  }

  return ok(touch({ ...model, things, links: new Map(model.links).set(id, updated) }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && bunx vitest run tests/api-updates.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `cd packages/core && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-updates.test.ts
git commit -m "feat(core): add updateLink with I-05/I-14/I-18/I-19 + coercion"
```

---

## Chunk 3: History + Exports + Integration

### Task 8: History<T> Module

**Files:**
- Create: `packages/core/src/history.ts`
- Create: `packages/core/tests/history.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/tests/history.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createHistory, pushHistory, undo, redo } from "../src/history";

describe("createHistory", () => {
  it("creates history with initial present and empty stacks", () => {
    const h = createHistory("A");
    expect(h.present).toBe("A");
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
  });
});

describe("pushHistory", () => {
  it("moves present to past and sets new present", () => {
    const h = createHistory("A");
    const h2 = pushHistory(h, "B");
    expect(h2.present).toBe("B");
    expect(h2.past).toEqual(["A"]);
    expect(h2.future).toEqual([]);
  });

  it("clears future on push", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = pushHistory(h, "C");
    h = undo(h)!; // present=B, future=[C]
    const h2 = pushHistory(h, "D"); // should clear future
    expect(h2.present).toBe("D");
    expect(h2.past).toEqual(["A", "B"]);
    expect(h2.future).toEqual([]);
  });

  it("preserves immutability", () => {
    const h = createHistory("A");
    pushHistory(h, "B");
    expect(h.present).toBe("A");
    expect(h.past).toEqual([]);
  });
});

describe("undo", () => {
  it("returns null when no past", () => {
    const h = createHistory("A");
    expect(undo(h)).toBeNull();
  });

  it("moves present to future and pops past", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = pushHistory(h, "C");
    const u = undo(h);
    expect(u).not.toBeNull();
    expect(u!.present).toBe("B");
    expect(u!.past).toEqual(["A"]);
    expect(u!.future).toEqual(["C"]);
  });

  it("supports multiple undos", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = pushHistory(h, "C");
    h = undo(h)!;
    h = undo(h)!;
    expect(h.present).toBe("A");
    expect(h.past).toEqual([]);
    expect(h.future).toEqual(["B", "C"]);
  });
});

describe("redo", () => {
  it("returns null when no future", () => {
    const h = createHistory("A");
    expect(redo(h)).toBeNull();
  });

  it("moves present to past and pops future", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = pushHistory(h, "C");
    h = undo(h)!;
    h = undo(h)!;
    const r = redo(h);
    expect(r).not.toBeNull();
    expect(r!.present).toBe("B");
    expect(r!.past).toEqual(["A"]);
    expect(r!.future).toEqual(["C"]);
  });

  it("supports undo-redo-undo roundtrip", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = undo(h)!;      // present=A
    h = redo(h)!;      // present=B
    h = undo(h)!;      // present=A
    expect(h.present).toBe("A");
    expect(h.future).toEqual(["B"]);
  });
});

describe("structural sharing", () => {
  it("History<object> shares unchanged references", () => {
    const objA = { things: new Map([["a", 1]]), settings: { x: true } };
    const objB = { ...objA, things: new Map([["a", 1], ["b", 2]]) };
    const h = createHistory(objA);
    const h2 = pushHistory(h, objB);
    // Settings is same reference in both snapshots
    expect(h2.past[0].settings).toBe(objA.settings);
    expect(h2.present.settings).toBe(objA.settings);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bunx vitest run tests/history.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement History module**

Create `packages/core/src/history.ts`:

```typescript
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] };
}

export function pushHistory<T>(h: History<T>, snapshot: T): History<T> {
  return {
    past: [...h.past, h.present],
    present: snapshot,
    future: [],
  };
}

export function undo<T>(h: History<T>): History<T> | null {
  if (h.past.length === 0) return null;
  const past = [...h.past];
  const prev = past.pop()!;
  return { past, present: prev, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> | null {
  if (h.future.length === 0) return null;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bunx vitest run tests/history.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/history.ts packages/core/tests/history.test.ts
git commit -m "feat(core): add History<T> stream coalgebra (create/push/undo/redo)"
```

---

### Task 9: Exports + Integration Verification

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Update index.ts exports**

Replace the api export block in `packages/core/src/index.ts`:

```typescript
export * from "./types";
export * from "./result";
export { createModel } from "./model";
export { loadModel, saveModel, type LoadError } from "./serialization";
export {
  addThing, removeThing, updateThing,
  addState, removeState, updateState,
  addLink, removeLink, updateLink,
  addOPD, removeOPD, updateOPD,
  addAppearance, removeAppearance, updateAppearance,
  addModifier, removeModifier, updateModifier,
  addFan, removeFan, updateFan,
  addScenario, removeScenario, updateScenario,
  addAssertion, removeAssertion, updateAssertion,
  addRequirement, removeRequirement, updateRequirement,
  addStereotype, removeStereotype, updateStereotype,
  addSubModel, removeSubModel, updateSubModel,
  updateMeta, updateSettings,
  validate,
} from "./api";
export {
  type History,
  createHistory, pushHistory, undo, redo,
} from "./history";
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run full test suite**

Run: `cd packages/core && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export all update functions and History module"
```

- [ ] **Step 5: Verify final mutation count**

Run: `cd packages/core && grep -c "^export function" src/api.ts`
Expected: 39 (24 existing add/remove + 14 new update* + validate)

Run: `cd packages/core && bunx vitest run --reporter=verbose 2>&1 | tail -5`
Expected: All tests pass, total count shown
