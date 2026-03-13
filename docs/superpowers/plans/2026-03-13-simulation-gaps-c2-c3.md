# Simulation Gaps C2+C3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ISO 19450 gaps C3 (stateful/stateless objects) and C2 (skip/wait condition semantics) to enable correct simulation behavior.

**Architecture:** Extend `Thing` with `stateful?: boolean` (fibered classifier) and `Modifier` with `condition_mode?: "skip" | "wait"` (2-cell enrichment). Add 4 new invariant guards (I-STATELESS-STATES, I-STATELESS-EFFECT, I-CONDITION-MODE, I-STATELESS-DOWNGRADE) to CRUD operations and `validate`. Extend the simulation engine with trivalent `PreconditionResult.response` ("lost" | "skip" | "wait"), `waitingProcesses` set, and deadlock detection. Update OPL lens to render condition modes and propagate `conditionMode` through expose/editsFrom.

**Tech Stack:** TypeScript, Vitest, Bun workspaces

**Spec:** `docs/superpowers/specs/2026-03-13-simulation-gaps-c2-c3-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/core/src/types.ts` | Modify | Add `Thing.stateful?`, `Modifier.condition_mode?` |
| `packages/core/src/api.ts` | Modify | Guards in addState, addLink, addModifier, updateThing, updateModifier, updateLink, validate |
| `packages/core/src/simulation.ts` | Modify | PreconditionResult.response, ModelState.waitingProcesses, deadlock detection |
| `packages/core/src/opl-types.ts` | Modify | OplModifierSentence.conditionMode?, sourceStateName?, targetStateName? |
| `packages/core/src/opl.ts` | Modify | expose populates new fields, renderModifierSentence, editsFrom propagates condition_mode |
| `packages/core/tests/stateless-condition.test.ts` | Create | Tests for all 4 new invariants (14 tests) |
| `packages/core/tests/simulation.test.ts` | Modify | Tests for trivalent response, simulationStep wait/skip, deadlock (8 tests) |
| `packages/core/tests/opl.test.ts` | Modify | Tests for condition mode rendering + GetPut round-trip (6 tests) |

---

## Chunk 1: Types + Invariant Guards (C3 + C2 in types and API)

### Task 1: Add type fields

**Files:**
- Modify: `packages/core/src/types.ts:92-104` (Thing), `packages/core/src/types.ts:151-156` (Modifier)

- [ ] **Step 1: Add `stateful` to Thing interface**

In `packages/core/src/types.ts`, after line 103 (`computational?`), add:

```typescript
  stateful?: boolean; // ISO 19450 §3.66/§3.67. undefined ≡ true (backwards-compatible)
```

- [ ] **Step 2: Add `condition_mode` to Modifier interface**

In `packages/core/src/types.ts`, after line 155 (`negated?`), add:

```typescript
  condition_mode?: "skip" | "wait"; // ISO §8.2.3. Only when type === "condition". Default: "wait"
```

- [ ] **Step 3: Verify types compile**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: no errors (new fields are optional, zero breakage)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): add Thing.stateful and Modifier.condition_mode type fields (C2+C3)"
```

---

### Task 2: Write failing tests for I-STATELESS-STATES

**Files:**
- Create: `packages/core/tests/stateless-condition.test.ts`

- [ ] **Step 1: Write tests for I-STATELESS-STATES**

Create `packages/core/tests/stateless-condition.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, addState, addLink, addModifier,
  updateThing, updateModifier, updateLink, validate,
} from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, Link, Modifier } from "../src/types";

// === Helpers ===

const statefulObj = (id: string, name: string): Thing => ({
  id, kind: "object", name, essence: "physical", affiliation: "systemic",
  stateful: true,
});

const statelessObj = (id: string, name: string): Thing => ({
  id, kind: "object", name, essence: "physical", affiliation: "systemic",
  stateful: false,
});

const defaultObj = (id: string, name: string): Thing => ({
  id, kind: "object", name, essence: "physical", affiliation: "systemic",
  // stateful is undefined → treated as true
});

const proc = (id: string, name: string): Thing => ({
  id, kind: "process", name, essence: "physical", affiliation: "systemic",
});

describe("I-STATELESS-STATES", () => {
  it("rejects addState on stateless object", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    const r = addState(m, {
      id: "state-a", parent: "obj-x", name: "A",
      initial: true, final: false, default: true,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-STATES");
  });

  it("allows addState on stateful object", () => {
    let m = createModel("Test");
    m = (addThing(m, statefulObj("obj-x", "X")) as any).value;
    const r = addState(m, {
      id: "state-a", parent: "obj-x", name: "A",
      initial: true, final: false, default: true,
    });
    expect(isOk(r)).toBe(true);
  });

  it("allows addState on object with undefined stateful (backwards-compatible)", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    const r = addState(m, {
      id: "state-a", parent: "obj-x", name: "A",
      initial: true, final: false, default: true,
    });
    expect(isOk(r)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: FAIL — `addState` does not check `stateful` yet, so the first test fails (it allows the state).

---

### Task 3: Implement I-STATELESS-STATES guard in addState

**Files:**
- Modify: `packages/core/src/api.ts:124-151` (addState)

- [ ] **Step 1: Add guard after I-01 check**

In `packages/core/src/api.ts`, after line 139 (the `parent.kind !== "object"` check), add:

```typescript
  // I-STATELESS-STATES: stateless objects cannot have states (ISO §3.67)
  if (parent.stateful === false) {
    return err({ code: "I-STATELESS-STATES", message: "Stateless objects cannot have states (ISO §3.67)", entity: state.id });
  }
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/stateless-condition.test.ts
git commit -m "feat(core): add I-STATELESS-STATES guard in addState"
```

---

### Task 4: Write failing tests for I-STATELESS-EFFECT

**Files:**
- Modify: `packages/core/tests/stateless-condition.test.ts`

- [ ] **Step 1: Add I-STATELESS-EFFECT tests**

Append to `stateless-condition.test.ts`:

```typescript
describe("I-STATELESS-EFFECT", () => {
  it("rejects addLink(effect) to stateless object", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    const r = addLink(m, {
      id: "lnk-1", type: "effect", source: "proc-p", target: "obj-x",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-EFFECT");
  });

  it("allows addLink(consumption) to stateless object", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    const r = addLink(m, {
      id: "lnk-1", type: "consumption", source: "proc-p", target: "obj-x",
    });
    expect(isOk(r)).toBe(true);
  });

  it("allows addLink(result) to stateless object", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    const r = addLink(m, {
      id: "lnk-1", type: "result", source: "proc-p", target: "obj-x",
    });
    expect(isOk(r)).toBe(true);
  });

  it("rejects addLink with source_state referencing stateless object's state", () => {
    // Since addState blocks states on stateless objects, we construct inconsistency directly
    // Simulate: obj-x was once stateful (has state), then data is loaded with stateful=false
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value; // stateful=undefined → ok to add states
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    // Directly mutate obj-x to stateless (bypass updateThing guard)
    m = { ...m, things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }) };
    // Now try to add link with source_state pointing to stateless object's state
    const r = addLink(m, {
      id: "lnk-1", type: "input", source: "proc-p", target: "obj-x",
      source_state: "state-a",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-EFFECT");
  });

  it("rejects addLink with target_state referencing stateless object's state", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    // Directly mutate obj-x to stateless
    m = { ...m, things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }) };
    const r = addLink(m, {
      id: "lnk-1", type: "effect", source: "proc-p", target: "obj-x",
      target_state: "state-b",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-EFFECT");
  });
});
```

- [ ] **Step 2: Run tests to verify first test fails**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: FAIL — first test in I-STATELESS-EFFECT (effect to stateless) should pass when it shouldn't.

---

### Task 5: Implement I-STATELESS-EFFECT guard in addLink

**Files:**
- Modify: `packages/core/src/api.ts:184-237` (addLink)

- [ ] **Step 1: Add guards after I-31 check (before the I-19 exhibition block)**

In `packages/core/src/api.ts`, after line 221 (end of I-31 block), before `let things = model.things;` (line 223), add:

```typescript
  // I-STATELESS-EFFECT: effect links cannot target stateless objects
  if (link.type === "effect") {
    const target = model.things.get(link.target);
    if (target?.stateful === false) {
      return err({ code: "I-STATELESS-EFFECT", message: "Stateless objects cannot be affected — use consumption or result links", entity: link.id });
    }
  }
  // I-STATELESS-EFFECT: state-specified links cannot reference stateless objects
  if (link.source_state) {
    const sourceState = model.states.get(link.source_state);
    if (sourceState) {
      const parent = model.things.get(sourceState.parent);
      if (parent?.stateful === false) {
        return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects", entity: link.id });
      }
    }
  }
  if (link.target_state) {
    const targetState = model.states.get(link.target_state);
    if (targetState) {
      const parent = model.things.get(targetState.parent);
      if (parent?.stateful === false) {
        return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects", entity: link.id });
      }
    }
  }
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/stateless-condition.test.ts
git commit -m "feat(core): add I-STATELESS-EFFECT guard in addLink"
```

---

### Task 6: Write failing tests + implement I-STATELESS-DOWNGRADE

**Files:**
- Modify: `packages/core/tests/stateless-condition.test.ts`
- Modify: `packages/core/src/api.ts:800-840` (updateThing)

- [ ] **Step 1: Write failing tests**

Append to `stateless-condition.test.ts`:

```typescript
describe("I-STATELESS-DOWNGRADE", () => {
  it("rejects updateThing(stateful=false) when object has states", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    const r = updateThing(m, "obj-x", { stateful: false });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-DOWNGRADE");
  });

  it("allows updateThing(stateful=false) when object has no states", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    const r = updateThing(m, "obj-x", { stateful: false });
    expect(isOk(r)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify first test fails**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: FAIL — `updateThing` does not check stateless downgrade yet.

- [ ] **Step 3: Implement guard in updateThing**

In `packages/core/src/api.ts`, inside `updateThing`, after the existing I-01 kind-change block (after line 817), add:

```typescript
  // I-STATELESS-DOWNGRADE: cannot mark as stateless if states exist
  if (cleaned.stateful === false) {
    const hasStates = [...model.states.values()].some(s => s.parent === id);
    if (hasStates) {
      return err({ code: "I-STATELESS-DOWNGRADE", message: "Remove all states before marking as stateless", entity: id });
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/stateless-condition.test.ts
git commit -m "feat(core): add I-STATELESS-DOWNGRADE guard in updateThing"
```

---

### Task 7: Write failing tests + implement I-CONDITION-MODE

**Files:**
- Modify: `packages/core/tests/stateless-condition.test.ts`
- Modify: `packages/core/src/api.ts:461-465` (addModifier), `packages/core/src/api.ts:603-616` (updateModifier)

- [ ] **Step 1: Write failing tests**

Append to `stateless-condition.test.ts`:

```typescript
describe("I-CONDITION-MODE", () => {
  it("rejects addModifier(condition_mode='skip', type='event')", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "proc-p", target: "obj-x" }) as any).value;
    const r = addModifier(m, {
      id: "mod-1", over: "lnk-1", type: "event", condition_mode: "skip",
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-CONDITION-MODE");
  });

  it("allows addModifier(condition_mode='skip', type='condition')", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "proc-p", target: "obj-x" }) as any).value;
    const r = addModifier(m, {
      id: "mod-1", over: "lnk-1", type: "condition", condition_mode: "skip",
    });
    expect(isOk(r)).toBe(true);
  });

  it("rejects updateModifier(type='event') on modifier with condition_mode='skip'", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "proc-p", target: "obj-x" }) as any).value;
    m = (addModifier(m, { id: "mod-1", over: "lnk-1", type: "condition", condition_mode: "skip" }) as any).value;
    const r = updateModifier(m, "mod-1", { type: "event" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-CONDITION-MODE");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: FAIL — both add and update don't check condition_mode yet.

- [ ] **Step 3: Implement guard in addModifier**

In `packages/core/src/api.ts`, in `addModifier` (line 461-465), after the `I-06` check (line 463), add:

```typescript
  // I-CONDITION-MODE: condition_mode only valid on condition modifiers
  if (mod.condition_mode && mod.type !== "condition") {
    return err({ code: "I-CONDITION-MODE", message: "condition_mode is only valid on condition modifiers", entity: mod.id });
  }
```

- [ ] **Step 4: Implement guard in updateModifier**

In `packages/core/src/api.ts`, in `updateModifier` (line 603-616), after the `I-06` check (line 614), add:

```typescript
  // I-CONDITION-MODE: merged state must not have condition_mode on non-condition type
  if (updated.condition_mode && updated.type !== "condition") {
    return err({ code: "I-CONDITION-MODE", message: "condition_mode is only valid on condition modifiers", entity: id });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/stateless-condition.test.ts
git commit -m "feat(core): add I-CONDITION-MODE guard in addModifier + updateModifier"
```

---

### Task 8: Write failing tests + implement I-STATELESS-EFFECT in updateLink

**Files:**
- Modify: `packages/core/tests/stateless-condition.test.ts`
- Modify: `packages/core/src/api.ts:844-910` (updateLink)

- [ ] **Step 1: Write failing test**

Append to `stateless-condition.test.ts`:

```typescript
describe("I-STATELESS-EFFECT in updateLink", () => {
  it("rejects updateLink(type='effect') when target is stateless", () => {
    let m = createModel("Test");
    m = (addThing(m, statelessObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    // Start with consumption (allowed on stateless)
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "proc-p", target: "obj-x" }) as any).value;
    // Try to change to effect (not allowed on stateless)
    const r = updateLink(m, "lnk-1", { type: "effect" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-STATELESS-EFFECT");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: FAIL — `updateLink` does not check I-STATELESS-EFFECT yet.

- [ ] **Step 3: Implement guard in updateLink**

In `packages/core/src/api.ts`, in `updateLink`, after the `I-31` block (after line 907), before the final return (line 909), add:

```typescript
  // I-STATELESS-EFFECT: effect links cannot target stateless objects
  if (updated.type === "effect") {
    const target = model.things.get(updated.target);
    if (target?.stateful === false) {
      return err({ code: "I-STATELESS-EFFECT", message: "Stateless objects cannot be affected — use consumption or result links", entity: id });
    }
  }
  // I-STATELESS-EFFECT: state-specified links cannot reference stateless objects
  if (updated.source_state) {
    const sourceState = model.states.get(updated.source_state);
    if (sourceState) {
      const parent = model.things.get(sourceState.parent);
      if (parent?.stateful === false) {
        return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects", entity: id });
      }
    }
  }
  if (updated.target_state) {
    const targetState = model.states.get(updated.target_state);
    if (targetState) {
      const parent = model.things.get(targetState.parent);
      if (parent?.stateful === false) {
        return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects", entity: id });
      }
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/stateless-condition.test.ts
git commit -m "feat(core): add I-STATELESS-EFFECT guard in updateLink"
```

---

### Task 9: Write failing tests + implement validate for new invariants

**Files:**
- Modify: `packages/core/tests/stateless-condition.test.ts`
- Modify: `packages/core/src/api.ts:914-1310` (validate)

- [ ] **Step 1: Write failing validate tests**

Append to `stateless-condition.test.ts`:

```typescript
describe("validate — new invariants", () => {
  it("detects stateless object with pre-existing states (I-STATELESS-STATES)", () => {
    // Construct invalid model directly (bypass guards)
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    // Directly mutate to create inconsistency (simulate loaded data)
    const badModel = {
      ...m,
      things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }),
    };
    const errors = validate(badModel);
    expect(errors.some(e => e.code === "I-STATELESS-STATES")).toBe(true);
  });

  it("detects condition_mode on event modifier (I-CONDITION-MODE)", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "consumption", source: "proc-p", target: "obj-x" }) as any).value;
    m = (addModifier(m, { id: "mod-1", over: "lnk-1", type: "event" }) as any).value;
    // Directly mutate to create inconsistency
    const badModel = {
      ...m,
      modifiers: new Map(m.modifiers).set("mod-1", { ...m.modifiers.get("mod-1")!, condition_mode: "skip" as const }),
    };
    const errors = validate(badModel);
    expect(errors.some(e => e.code === "I-CONDITION-MODE")).toBe(true);
  });

  it("detects effect link to stateless object (I-STATELESS-EFFECT)", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addThing(m, proc("proc-p", "P")) as any).value;
    m = (addLink(m, { id: "lnk-1", type: "effect", source: "proc-p", target: "obj-x" }) as any).value;
    // Downgrade obj-x to stateless directly
    const badModel = {
      ...m,
      things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }),
    };
    const errors = validate(badModel);
    expect(errors.some(e => e.code === "I-STATELESS-EFFECT")).toBe(true);
  });

  it("detects stateful=false with existing states (I-STATELESS-DOWNGRADE)", () => {
    let m = createModel("Test");
    m = (addThing(m, defaultObj("obj-x", "X")) as any).value;
    m = (addState(m, { id: "state-a", parent: "obj-x", name: "A", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-b", parent: "obj-x", name: "B", initial: false, final: false, default: false }) as any).value;
    const badModel = {
      ...m,
      things: new Map(m.things).set("obj-x", { ...m.things.get("obj-x")!, stateful: false }),
    };
    const errors = validate(badModel);
    // Should catch either I-STATELESS-STATES (states on stateless) or I-STATELESS-DOWNGRADE
    expect(errors.some(e => e.code === "I-STATELESS-STATES")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: FAIL — validate doesn't check these invariants yet.

- [ ] **Step 3: Add invariants to validate function**

In `packages/core/src/api.ts`, in `validate`, before the final `return errors;` (line 1309), add:

```typescript
  // I-STATELESS-STATES: stateless objects cannot have states
  for (const [id, state] of model.states) {
    const parent = model.things.get(state.parent);
    if (parent?.stateful === false) {
      errors.push({ code: "I-STATELESS-STATES", message: `State ${id} belongs to stateless object ${state.parent}`, entity: id });
    }
  }

  // I-STATELESS-EFFECT: effect links cannot target stateless objects + state-specified links
  for (const [id, link] of model.links) {
    if (link.type === "effect") {
      const target = model.things.get(link.target);
      if (target?.stateful === false) {
        errors.push({ code: "I-STATELESS-EFFECT", message: `Effect link ${id} targets stateless object ${link.target}`, entity: id });
      }
    }
    if (link.source_state) {
      const sourceState = model.states.get(link.source_state);
      if (sourceState) {
        const parent = model.things.get(sourceState.parent);
        if (parent?.stateful === false) {
          errors.push({ code: "I-STATELESS-EFFECT", message: `Link ${id} source_state references stateless object`, entity: id });
        }
      }
    }
    if (link.target_state) {
      const targetState = model.states.get(link.target_state);
      if (targetState) {
        const parent = model.things.get(targetState.parent);
        if (parent?.stateful === false) {
          errors.push({ code: "I-STATELESS-EFFECT", message: `Link ${id} target_state references stateless object`, entity: id });
        }
      }
    }
  }

  // I-CONDITION-MODE: condition_mode only valid on condition modifiers
  for (const [id, mod] of model.modifiers) {
    if (mod.condition_mode && mod.type !== "condition") {
      errors.push({ code: "I-CONDITION-MODE", message: `Modifier ${id} has condition_mode but type is ${mod.type}`, entity: id });
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/stateless-condition.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `bunx vitest run`
Expected: All tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/stateless-condition.test.ts
git commit -m "feat(core): add 4 new invariants to validate (I-STATELESS-STATES, I-STATELESS-EFFECT, I-CONDITION-MODE)"
```

---

## Chunk 2: Simulation Engine (C2 trivalent response + waitingProcesses + deadlock)

### Task 10: Write failing tests for trivalent PreconditionResult

**Files:**
- Modify: `packages/core/tests/simulation.test.ts`

- [ ] **Step 1: Add trivalent response tests**

Append to `packages/core/tests/simulation.test.ts`, after the existing `evaluatePrecondition` describe block:

```typescript
describe("evaluatePrecondition — trivalent response (C2)", () => {
  it("returns response 'wait' for condition(wait) with unsatisfied precondition", () => {
    // Build model: obj with state liquid, proc, condition(wait) modifier on agent link
    let m = createModel("Test");
    m = (addThing(m, obj("obj-w", "Water")) as any).value;
    m = (addThing(m, proc("proc-b", "Boiling")) as any).value;
    m = (addState(m, { id: "state-liquid", parent: "obj-w", name: "liquid", initial: true, final: false, default: true }) as any).value;
    m = (addState(m, { id: "state-gas", parent: "obj-w", name: "gas", initial: false, final: false, default: false }) as any).value;
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-w", target: "proc-b" }) as any).value;
    m = (addModifier(m, { id: "mod-cond", over: "lnk-agent", type: "condition", condition_mode: "wait" }) as any).value;

    const state = createInitialState(m);
    // Make water not exist → precondition fails
    state.objects.get("obj-w")!.exists = false;
    const result = evaluatePrecondition(m, state, "proc-b");
    expect(result.satisfied).toBe(false);
    if (!result.satisfied) {
      expect(result.response).toBe("wait");
    }
  });

  it("returns response 'skip' for condition(skip) with unsatisfied precondition", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-w", "Water")) as any).value;
    m = (addThing(m, proc("proc-b", "Boiling")) as any).value;
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-w", target: "proc-b" }) as any).value;
    m = (addModifier(m, { id: "mod-cond", over: "lnk-agent", type: "condition", condition_mode: "skip" }) as any).value;

    const state = createInitialState(m);
    state.objects.get("obj-w")!.exists = false;
    const result = evaluatePrecondition(m, state, "proc-b");
    expect(result.satisfied).toBe(false);
    if (!result.satisfied) {
      expect(result.response).toBe("skip");
    }
  });

  it("returns response 'lost' for event modifier with unsatisfied precondition", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-w", "Water")) as any).value;
    m = (addThing(m, proc("proc-b", "Boiling")) as any).value;
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-w", target: "proc-b" }) as any).value;
    m = (addModifier(m, { id: "mod-ev", over: "lnk-agent", type: "event" }) as any).value;

    const state = createInitialState(m);
    state.objects.get("obj-w")!.exists = false;
    const result = evaluatePrecondition(m, state, "proc-b");
    expect(result.satisfied).toBe(false);
    if (!result.satisfied) {
      expect(result.response).toBe("lost");
    }
  });

  it("returns response 'lost' for link without modifier", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-w", "Water")) as any).value;
    m = (addThing(m, proc("proc-b", "Boiling")) as any).value;
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-w", target: "proc-b" }) as any).value;
    // No modifier on this link

    const state = createInitialState(m);
    state.objects.get("obj-w")!.exists = false;
    const result = evaluatePrecondition(m, state, "proc-b");
    expect(result.satisfied).toBe(false);
    if (!result.satisfied) {
      expect(result.response).toBe("lost");
    }
  });
});
```

You'll need to add `addModifier` to the imports at the top of `simulation.test.ts`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/simulation.test.ts`
Expected: FAIL — PreconditionResult doesn't have `response` field yet.

---

### Task 11: Implement trivalent PreconditionResult + waitingProcesses + deadlock

**Files:**
- Modify: `packages/core/src/simulation.ts`

- [ ] **Step 1: Update PreconditionResult type**

In `packages/core/src/simulation.ts`, replace lines 33-35:

```typescript
export type PreconditionResult =
  | { satisfied: true }
  | { satisfied: false; reason: string };
```

With:

```typescript
export type PreconditionResult =
  | { satisfied: true }
  | { satisfied: false; reason: string; response: "lost" | "skip" | "wait" };
```

- [ ] **Step 2: Update ModelState with waitingProcesses**

Replace lines 18-22:

```typescript
export interface ModelState {
  objects: Map<string, ObjectState>;
  step: number;
  timestamp: number;
}
```

With:

```typescript
export interface ModelState {
  objects: Map<string, ObjectState>;
  step: number;
  timestamp: number;
  waitingProcesses: Set<string>;
}
```

- [ ] **Step 3: Update SimulationTrace with deadlocked**

Replace lines 52-56:

```typescript
export interface SimulationTrace {
  steps: SimulationStep[];
  finalState: ModelState;
  completed: boolean;
}
```

With:

```typescript
export interface SimulationTrace {
  steps: SimulationStep[];
  finalState: ModelState;
  completed: boolean;
  deadlocked: boolean;
}
```

- [ ] **Step 4: Update createInitialState to include waitingProcesses**

Replace lines 79-83:

```typescript
  return {
    objects,
    step: 0,
    timestamp: 0,
  };
```

With:

```typescript
  return {
    objects,
    step: 0,
    timestamp: 0,
    waitingProcesses: new Set(),
  };
```

- [ ] **Step 5: Update evaluatePrecondition to return response**

Replace the two `return { satisfied: false, reason: ... }` blocks in `evaluatePrecondition` to include `response`. Each unsatisfied return needs to look up the modifier on the failing link.

Replace the entire `evaluatePrecondition` function (lines 90-141) with:

```typescript
export function evaluatePrecondition(
  model: Model,
  state: ModelState,
  processId: string
): PreconditionResult {
  const links = [...model.links.values()].filter(
    l => l.target === processId || l.source === processId
  );

  for (const link of links) {
    // For transforming links, verify that the objects exist
    if (["consumption", "effect", "input", "output"].includes(link.type)) {
      // Direction: source=process, target=object for transforming links
      if (link.source !== processId) continue;
      const objectId = link.target;
      const objState = state.objects.get(objectId);

      if (!objState?.exists) {
        return { satisfied: false, reason: `Object ${objectId} does not exist`, response: getResponse(model, link.id) };
      }

      if (link.source_state) {
        const requiredState = model.states.get(link.source_state);
        if (requiredState && objState.currentState !== link.source_state) {
          return { satisfied: false, reason: `Object ${objectId} not in required state ${requiredState.name}`, response: getResponse(model, link.id) };
        }
      }
    }

    // For enabling links (agent, instrument), verify existence
    if (["agent", "instrument"].includes(link.type)) {
      // Direction: source=object, target=process for enabling links
      if (link.target !== processId) continue;
      const objectId = link.source;
      const objState = state.objects.get(objectId);

      if (!objState?.exists) {
        return { satisfied: false, reason: `${link.type} ${objectId} does not exist`, response: getResponse(model, link.id) };
      }

      if (link.source_state) {
        const requiredState = model.states.get(link.source_state);
        if (requiredState && objState.currentState !== link.source_state) {
          return {
            satisfied: false,
            reason: `${link.type} ${objectId} not in required state ${requiredState.name}`,
            response: getResponse(model, link.id),
          };
        }
      }
    }
  }

  return { satisfied: true };
}

/** Determine response for a failed precondition based on modifiers on the link */
function getResponse(model: Model, linkId: string): "lost" | "skip" | "wait" {
  const mod = [...model.modifiers.values()].find(m => m.over === linkId);
  if (!mod) return "lost";
  if (mod.type === "event") return "lost";
  if (mod.type === "condition") {
    return mod.condition_mode === "skip" ? "skip" : "wait";
  }
  return "lost";
}
```

- [ ] **Step 6: Fix process discovery for `manual` events + handle waitingProcesses**

The current `simulationStep` only discovers processes via `object-entered-state` + event link matching. For `manual` events (used by `runSimulation`), `targetId` IS the process. Fix the process discovery block (lines 163-180).

Replace the entire process discovery block in `simulationStep` (from `// Encontrar proceso a ejecutar` to `step.skipped = true; return step;` at line 180):

```typescript
  // Encontrar proceso a ejecutar basado en evento
  let processId: string | undefined;

  if (event.kind === "manual" && event.targetId) {
    // Manual events: targetId IS the processId directly
    if (model.things.get(event.targetId)?.kind === "process") {
      processId = event.targetId;
    }
  } else if (event.kind === "object-entered-state" && event.targetId) {
    // Encontrar procesos que tienen event link desde este objeto
    for (const [id, link] of model.links) {
      const mod = [...model.modifiers.values()].find(m => m.over === id && m.type === "event");
      if (mod && link.source === event.targetId) {
        processId = link.target;
        break;
      }
    }
  }

  if (!processId) {
    step.skipped = true;
    return step;
  }
```

Also replace the `newState` construction in `simulationStep` (line 160) with:

```typescript
    newState: { ...state, objects: new Map(state.objects), waitingProcesses: new Set(state.waitingProcesses), step: state.step + 1 },
```

And replace the precondition-failed block (lines 189-192):

```typescript
  if (!precondition.satisfied) {
    step.skipped = true; // Evento perdido (Maybe monad +1)
    return step;
  }
```

With:

```typescript
  if (!precondition.satisfied) {
    if (precondition.response === "wait") {
      step.newState.waitingProcesses.add(processId);
    }
    step.skipped = true;
    return step;
  }
```

- [ ] **Step 7: Update runSimulation with waitingProcesses + deadlock detection**

Replace the entire `runSimulation` function (lines 241-279) with:

```typescript
export function runSimulation(
  model: Model,
  initialState?: ModelState,
  maxSteps: number = 100
): SimulationTrace {
  const state = initialState ?? createInitialState(model);
  const steps: SimulationStep[] = [];
  let currentState = state;

  const processes = [...model.things.values()]
    .filter(t => t.kind === "process")
    .sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 0; i < maxSteps; i++) {
    let executed = false;

    // 1. Re-evaluate waiting processes first
    for (const waitingId of [...currentState.waitingProcesses]) {
      const precond = evaluatePrecondition(model, currentState, waitingId);
      if (precond.satisfied) {
        // Create new state without this process in waitingProcesses (immutable)
        const unblocked: ModelState = {
          ...currentState,
          objects: new Map(currentState.objects),
          waitingProcesses: new Set([...currentState.waitingProcesses].filter(id => id !== waitingId)),
        };
        const event: SimulationEvent = { kind: "manual", targetId: waitingId };
        const stepResult = simulationStep(model, unblocked, event);
        if (!stepResult.skipped) {
          steps.push(stepResult);
          currentState = stepResult.newState;
          executed = true;
          break;
        }
      }
    }

    if (executed) continue;

    // 2. Evaluate normal processes
    for (const proc of processes) {
      if (currentState.waitingProcesses.has(proc.id)) continue;
      const event: SimulationEvent = { kind: "manual", targetId: proc.id };
      const stepResult = simulationStep(model, currentState, event);

      if (!stepResult.skipped) {
        steps.push(stepResult);
        currentState = stepResult.newState;
        executed = true;
        break;
      } else if (stepResult.processId && stepResult.newState.waitingProcesses.has(stepResult.processId)) {
        // Process was added to waiting by simulationStep — propagate the new state
        currentState = stepResult.newState;
      }
    }

    if (!executed) {
      // Deadlock: waiting processes exist but none can execute
      if (currentState.waitingProcesses.size > 0) {
        return { steps, finalState: currentState, completed: false, deadlocked: true };
      }
      break;
    }
  }

  return {
    steps,
    finalState: currentState,
    completed: steps.length < maxSteps,
    deadlocked: false,
  };
}
```

- [ ] **Step 8: Run simulation tests to verify they pass**

Run: `bunx vitest run packages/core/tests/simulation.test.ts`
Expected: PASS (existing + new trivalent tests). Note: `waitingProcesses` is a new required field on `ModelState`, but all existing tests use `createInitialState()` (now includes `waitingProcesses: new Set()`) — no manual `ModelState` constructions exist in the test suite, so no adjustments needed.

- [ ] **Step 9: Run full test suite**

Run: `bunx vitest run`
Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/simulation.ts packages/core/tests/simulation.test.ts
git commit -m "feat(core): implement trivalent PreconditionResult, waitingProcesses, deadlock detection (C2)"
```

---

### Task 12: Write + run additional simulation tests (deadlock, wait satisfaction)

**Files:**
- Modify: `packages/core/tests/simulation.test.ts`

- [ ] **Step 1: Add deadlock and wait-satisfaction tests**

Append to `packages/core/tests/simulation.test.ts`:

```typescript
describe("simulationStep — wait/skip response handling", () => {
  it("adds process to waitingProcesses when response is 'wait'", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-w", "Water")) as any).value;
    m = (addThing(m, proc("proc-b", "Boiling")) as any).value;
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-w", target: "proc-b" }) as any).value;
    m = (addModifier(m, { id: "mod-cond", over: "lnk-agent", type: "condition", condition_mode: "wait" }) as any).value;

    const state = createInitialState(m);
    state.objects.get("obj-w")!.exists = false; // precondition fails
    const event = { kind: "manual" as const, targetId: "proc-b" };
    const step = simulationStep(m, state, event);
    expect(step.skipped).toBe(true);
    expect(step.newState.waitingProcesses.has("proc-b")).toBe(true);
  });

  it("skips process without adding to waitingProcesses when response is 'skip'", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-w", "Water")) as any).value;
    m = (addThing(m, proc("proc-b", "Boiling")) as any).value;
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-w", target: "proc-b" }) as any).value;
    m = (addModifier(m, { id: "mod-cond", over: "lnk-agent", type: "condition", condition_mode: "skip" }) as any).value;

    const state = createInitialState(m);
    state.objects.get("obj-w")!.exists = false;
    const event = { kind: "manual" as const, targetId: "proc-b" };
    const step = simulationStep(m, state, event);
    expect(step.skipped).toBe(true);
    expect(step.newState.waitingProcesses.has("proc-b")).toBe(false);
  });
});

describe("runSimulation — deadlock detection", () => {
  it("detects deadlock when condition(wait) is never satisfied", () => {
    let m = createModel("Test");
    m = (addThing(m, obj("obj-fuel", "Fuel")) as any).value;
    m = (addThing(m, proc("proc-burn", "Burning")) as any).value;
    // Agent link with condition(wait) — fuel must exist
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-fuel", target: "proc-burn" }) as any).value;
    m = (addModifier(m, { id: "mod-cond", over: "lnk-agent", type: "condition", condition_mode: "wait" }) as any).value;

    const initState = createInitialState(m);
    // Fuel doesn't exist → process waits forever
    initState.objects.get("obj-fuel")!.exists = false;
    const trace = runSimulation(m, initState, 10);
    expect(trace.deadlocked).toBe(true);
    expect(trace.completed).toBe(false);
  });

  it("unblocks waiting process when state changes satisfy condition", () => {
    // Two processes: P1 produces Fuel (result), P2 needs Fuel (condition wait)
    let m = createModel("Test");
    m = (addThing(m, obj("obj-fuel", "Fuel")) as any).value;
    m = (addThing(m, obj("obj-raw", "Raw")) as any).value;
    m = (addThing(m, proc("proc-produce", "Producing")) as any).value;
    m = (addThing(m, proc("proc-burn", "Burning")) as any).value;
    // P1: consumes Raw, produces Fuel
    m = (addLink(m, { id: "lnk-con", type: "consumption", source: "proc-produce", target: "obj-raw" }) as any).value;
    m = (addLink(m, { id: "lnk-res", type: "result", source: "proc-produce", target: "obj-fuel" }) as any).value;
    // P2: needs Fuel (condition wait)
    m = (addLink(m, { id: "lnk-con2", type: "consumption", source: "proc-burn", target: "obj-fuel" }) as any).value;
    m = (addModifier(m, { id: "mod-cond", over: "lnk-con2", type: "condition", condition_mode: "wait" }) as any).value;

    const initState = createInitialState(m);
    // Fuel starts non-existent; Raw exists
    initState.objects.get("obj-fuel")!.exists = false;
    const trace = runSimulation(m, initState, 20);
    // P1 should execute first (produces fuel), then P2 should unblock and execute
    expect(trace.deadlocked).toBe(false);
    // At least 2 steps: P1 produces Fuel, P2 consumes Fuel
    expect(trace.steps.length).toBeGreaterThanOrEqual(2);
    // Verify P2 actually ran (not just P1)
    expect(trace.steps.some(s => s.processId === "proc-burn")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/simulation.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/tests/simulation.test.ts
git commit -m "test(core): add deadlock and wait-satisfaction simulation tests"
```

---

## Chunk 3: OPL Lens (condition mode rendering + expose + editsFrom)

### Task 13: Update OplModifierSentence type

**Files:**
- Modify: `packages/core/src/opl-types.ts:50-59`

- [ ] **Step 1: Add new fields to OplModifierSentence**

In `packages/core/src/opl-types.ts`, replace lines 50-59:

```typescript
export interface OplModifierSentence {
  kind: "modifier";
  modifierId: string;
  linkId: string;
  linkType: LinkType;
  sourceName: string;
  targetName: string;
  modifierType: ModifierType;
  negated: boolean;
}
```

With:

```typescript
export interface OplModifierSentence {
  kind: "modifier";
  modifierId: string;
  linkId: string;
  linkType: LinkType;
  sourceName: string;
  targetName: string;
  modifierType: ModifierType;
  negated: boolean;
  conditionMode?: "skip" | "wait";
  sourceStateName?: string;
  targetStateName?: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/opl-types.ts
git commit -m "feat(core): extend OplModifierSentence with conditionMode and state names"
```

---

### Task 14: Write failing OPL rendering tests

**Files:**
- Modify: `packages/core/tests/opl.test.ts`

- [ ] **Step 1: Add modifier rendering tests**

Append to `packages/core/tests/opl.test.ts`, inside a new describe block:

```typescript
describe("render — modifier sentences (C2)", () => {
  function buildModelWithModifier(modType: "event" | "condition", condMode?: "skip" | "wait", negated = false) {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, boilingProc); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, boilingApp); if (!isOk(r)) throw r.error; m = r.value;
    r = addState(m, { id: "state-liquid", parent: "obj-water", name: "liquid", initial: true, final: false, default: true });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addState(m, { id: "state-gas", parent: "obj-water", name: "gas", initial: false, final: false, default: false });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-agent", type: "agent", source: "obj-water", target: "proc-boiling", source_state: "state-liquid" });
    if (!isOk(r)) throw r.error; m = r.value;
    const mod: any = { id: "mod-1", over: "lnk-agent", type: modType, negated };
    if (condMode) mod.condition_mode = condMode;
    r = addModifier(m, mod); if (!isOk(r)) throw r.error; m = r.value;
    return m;
  }

  it("renders condition(wait) as 'Process requires Object'", () => {
    const m = buildModelWithModifier("condition", "wait");
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling requires Water");
  });

  it("renders condition(skip) as 'Process occurs if Object exists, otherwise Process is skipped'", () => {
    const m = buildModelWithModifier("condition", "skip");
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling occurs if Water exists, otherwise Boiling is skipped");
  });

  it("renders condition(wait)+negated as 'Process requires Object not to be State'", () => {
    const m = buildModelWithModifier("condition", "wait", true);
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling requires Water not to be liquid");
  });

  it("renders condition(skip)+negated as 'Process occurs if Object is not State, otherwise Process is skipped'", () => {
    const m = buildModelWithModifier("condition", "skip", true);
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling occurs if Water is not liquid, otherwise Boiling is skipped");
  });

  it("renders event+state-specified as 'State Object triggers Process'", () => {
    const m = buildModelWithModifier("event");
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("liquid Water triggers Boiling");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: FAIL — current modifier rendering is generic, not condition-aware.

---

### Task 15: Implement expose + renderModifierSentence

**Files:**
- Modify: `packages/core/src/opl.ts:117-133` (expose modifiers block), `packages/core/src/opl.ts:254-258` (renderSentence modifier case)

- [ ] **Step 1: Update expose to populate new OplModifierSentence fields**

In `packages/core/src/opl.ts`, replace lines 123-132 (the modifier sentence construction):

```typescript
    sentences.push({
      kind: "modifier",
      modifierId: mod.id,
      linkId: mod.over,
      linkType: link.type,
      sourceName: model.things.get(link.source)?.name ?? link.source,
      targetName: model.things.get(link.target)?.name ?? link.target,
      modifierType: mod.type,
      negated: mod.negated ?? false,
    });
```

With:

```typescript
    const sourceState = link.source_state ? model.states.get(link.source_state) : undefined;
    const targetState = link.target_state ? model.states.get(link.target_state) : undefined;
    sentences.push({
      kind: "modifier",
      modifierId: mod.id,
      linkId: mod.over,
      linkType: link.type,
      sourceName: model.things.get(link.source)?.name ?? link.source,
      targetName: model.things.get(link.target)?.name ?? link.target,
      modifierType: mod.type,
      negated: mod.negated ?? false,
      conditionMode: mod.type === "condition" ? (mod.condition_mode ?? "wait") : undefined,
      sourceStateName: sourceState?.name,
      targetStateName: targetState?.name,
    });
```

- [ ] **Step 2: Replace renderModifierSentence in renderSentence**

In `packages/core/src/opl.ts`, replace the modifier case in `renderSentence` (lines 254-258):

```typescript
    case "modifier": {
      const neg = s.negated ? "negated " : "";
      return `${s.linkType} link from ${s.sourceName} to ${s.targetName} has ${neg}${s.modifierType} modifier.`;
    }
```

With:

```typescript
    case "modifier": {
      return renderModifierSentence(s);
    }
```

And add the `renderModifierSentence` function before `renderSentence` (after `renderLinkSentence`):

```typescript
function renderModifierSentence(s: OplModifierSentence): string {
  // Determine process/object names based on link direction convention:
  // Enabling links (agent, instrument): source=object, target=process
  // Transforming links (consumption, effect, etc.): source=process, target=object
  const isEnabling = ["agent", "instrument"].includes(s.linkType);
  const processName = isEnabling ? s.targetName : s.sourceName;
  const objectName = isEnabling ? s.sourceName : s.targetName;
  // State name: for enabling links it's on source (object); for transforming on target (object)
  const stateName = isEnabling ? s.sourceStateName : s.targetStateName;

  if (s.modifierType === "event") {
    if (s.negated && stateName) {
      return `non-${stateName} ${objectName} triggers ${processName}.`;
    }
    if (stateName) {
      return `${stateName} ${objectName} triggers ${processName}.`;
    }
    return `${objectName} triggers ${processName}.`;
  }

  if (s.modifierType === "condition") {
    const mode = s.conditionMode ?? "wait";

    if (mode === "wait") {
      if (s.negated && stateName) {
        return `${processName} requires ${objectName} not to be ${stateName}.`;
      }
      if (stateName) {
        return `${processName} requires ${stateName} ${objectName}.`;
      }
      return `${processName} requires ${objectName}.`;
    }

    if (mode === "skip") {
      if (s.negated && stateName) {
        return `${processName} occurs if ${objectName} is not ${stateName}, otherwise ${processName} is skipped.`;
      }
      if (stateName) {
        return `${processName} occurs if ${objectName} is ${stateName}, otherwise ${processName} is skipped.`;
      }
      return `${processName} occurs if ${objectName} exists, otherwise ${processName} is skipped.`;
    }
  }

  // Fallback
  const neg = s.negated ? "negated " : "";
  return `${s.linkType} link from ${s.sourceName} to ${s.targetName} has ${neg}${s.modifierType} modifier.`;
}
```

You need to add `OplModifierSentence` to the import from `./opl-types` at the top of opl.ts.

- [ ] **Step 3: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/opl.ts packages/core/tests/opl.test.ts
git commit -m "feat(core): implement condition-mode aware OPL modifier rendering"
```

---

### Task 16: Write failing test + implement editsFrom propagation

**Files:**
- Modify: `packages/core/tests/opl.test.ts`
- Modify: `packages/core/src/opl.ts:425-434` (editsFrom modifier case)

- [ ] **Step 1: Write failing GetPut round-trip test**

Append to `packages/core/tests/opl.test.ts`:

```typescript
describe("editsFrom — condition_mode propagation (GetPut)", () => {
  it("preserves condition_mode in round-trip expose → editsFrom", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, boilingProc); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, boilingApp); if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, { id: "lnk-agent", type: "agent", source: "obj-water", target: "proc-boiling" });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addModifier(m, { id: "mod-1", over: "lnk-agent", type: "condition", condition_mode: "skip" });
    if (!isOk(r)) throw r.error; m = r.value;

    const doc = expose(m, "opd-sd");
    const edits = editsFrom(doc);

    // Find the add-modifier edit
    const modEdit = edits.find(e => e.kind === "add-modifier");
    expect(modEdit).toBeDefined();
    if (modEdit && modEdit.kind === "add-modifier") {
      expect(modEdit.modifier.condition_mode).toBe("skip");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: FAIL — `editsFrom` does not propagate `condition_mode`.

- [ ] **Step 3: Update editsFrom modifier case**

In `packages/core/src/opl.ts`, replace the modifier case in `editsFrom` (lines 425-434):

```typescript
      case "modifier":
        modifierEdits.push({
          kind: "add-modifier",
          modifier: {
            over: s.linkId,
            type: s.modifierType,
            negated: s.negated,
          },
        });
        break;
```

With:

```typescript
      case "modifier":
        // Note: expose normalizes undefined condition_mode to "wait" for condition modifiers,
        // so editsFrom will emit explicit condition_mode: "wait" even if the original was undefined.
        // This is a semantic no-op (undefined ≡ "wait") but a structural difference. Acceptable
        // because the lens law GetPut only requires semantic equivalence, not structural identity.
        modifierEdits.push({
          kind: "add-modifier",
          modifier: {
            over: s.linkId,
            type: s.modifierType,
            negated: s.negated,
            ...(s.conditionMode ? { condition_mode: s.conditionMode } : {}),
          },
        });
        break;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/opl.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `bunx vitest run`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/opl.ts packages/core/tests/opl.test.ts
git commit -m "feat(core): propagate condition_mode in editsFrom for GetPut lens law"
```

---

## Chunk 4: Final verification + JSON Schema

### Task 17: Update JSON Schema

**Files:**
- Modify: `docs/superpowers/specs/2026-03-10-opm-json-schema.json`

- [ ] **Step 1: Add `stateful` to Thing definition**

In the JSON Schema file, find the `Thing` definition's `properties` object and add:

```json
"stateful": { "type": "boolean" }
```

- [ ] **Step 2: Add `condition_mode` to Modifier definition**

In the `Modifier` definition's `properties` object, add:

```json
"condition_mode": { "enum": ["skip", "wait"] }
```

- [ ] **Step 3: Add `if/then/else` conditional validation for Modifier**

In the `Modifier` definition, add conditional: `condition_mode` is only allowed when `type === "condition"`:

```json
"if": {
  "properties": { "type": { "const": "condition" } }
},
"then": {
  "properties": { "condition_mode": { "enum": ["skip", "wait"] } }
},
"else": {
  "not": { "required": ["condition_mode"] }
}
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-03-10-opm-json-schema.json
git commit -m "feat(schema): add Thing.stateful and Modifier.condition_mode to JSON Schema"
```

---

### Task 18: Full regression + type check

- [ ] **Step 1: Run full test suite**

Run: `bunx vitest run`
Expected: All tests pass (existing + ~29 new tests).

- [ ] **Step 2: Run type check**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A && git commit -m "fix: address any regression issues from C2+C3 implementation"
```

(Skip this step if no fixes are needed.)
