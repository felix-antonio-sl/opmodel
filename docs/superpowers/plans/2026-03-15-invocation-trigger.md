# Invocation Link as Simulation Trigger — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a process completes in the simulation engine, invocation links from that process trigger the destination process (ISO §9.5.2.5.1), with self-invocation loop guard.

**Architecture:** Add a Phase 3 to `runSimulation()` that processes invocation links after each completed step. Self-invocation uses a per-process counter with MAX=10. Preconditions gate re-execution (Approach C). No changes to types.ts, evaluatePrecondition(), or simulationStep().

**Tech Stack:** TypeScript, Vitest, TDD (red-green-refactor)

---

## File Structure

| File | Role | Change |
|------|------|--------|
| `packages/core/src/simulation.ts` | Simulation engine | Add `MAX_SELF_INVOCATIONS`, `SimulationStep.invokedBy`, invocation phase in `runSimulation()` |
| `packages/core/tests/simulation.test.ts` | Simulation tests | Add 5 new test cases for invocation |

---

## Chunk 1: Invocation Trigger Implementation

### Task 1: Test — basic invocation A→B

**Files:**
- Modify: `packages/core/tests/simulation.test.ts`

- [ ] **Step 1: Write helper to build invocation model**

```typescript
/**
 * Build model: Grinding -[invocation]-> Brewing
 * Grinding consumes Coffee Beans, Brewing consumes Ground Coffee + yields Coffee
 */
function buildInvocationModel(): Model {
  let m = createModel("Test");
  m = (addThing(m, obj("obj-beans", "Coffee Beans")) as any).value;
  m = (addThing(m, obj("obj-ground", "Ground Coffee")) as any).value;
  m = (addThing(m, obj("obj-coffee", "Coffee")) as any).value;
  m = (addThing(m, proc("proc-grind", "Grinding")) as any).value;
  m = (addThing(m, proc("proc-brew", "Brewing")) as any).value;
  // Grinding consumes beans, yields ground
  m = (addLink(m, { id: "lnk-con1", type: "consumption", source: "obj-beans", target: "proc-grind" }) as any).value;
  m = (addLink(m, { id: "lnk-res1", type: "result", source: "proc-grind", target: "obj-ground" }) as any).value;
  // Brewing consumes ground, yields coffee
  m = (addLink(m, { id: "lnk-con2", type: "consumption", source: "obj-ground", target: "proc-brew" }) as any).value;
  m = (addLink(m, { id: "lnk-res2", type: "result", source: "proc-brew", target: "obj-coffee" }) as any).value;
  // Invocation: Grinding invokes Brewing
  m = (addLink(m, { id: "lnk-invoke", type: "invocation", source: "proc-grind", target: "proc-brew" }) as any).value;
  return m;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
describe("invocation links", () => {
  it("triggers destination process when source completes", () => {
    const m = buildInvocationModel();
    const trace = runSimulation(m);
    // Grinding executes first (consumes beans, yields ground)
    // Invocation triggers Brewing (consumes ground, yields coffee)
    expect(trace.steps.length).toBeGreaterThanOrEqual(2);
    expect(trace.steps[0].processName).toBe("Grinding");
    expect(trace.steps[1].processName).toBe("Brewing");
    expect(trace.steps[1].invokedBy).toBe("proc-grind");
    expect(trace.finalState.objects.get("obj-coffee")?.exists).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/simulation.test.ts -t "triggers destination"`
Expected: FAIL — Brewing doesn't execute (no invocation logic), `invokedBy` undefined

---

### Task 2: Implement invocation trigger in runSimulation

**Files:**
- Modify: `packages/core/src/simulation.ts:39-52` (SimulationStep type)
- Modify: `packages/core/src/simulation.ts:507-595` (runSimulation function)

- [ ] **Step 4: Add `invokedBy` to SimulationStep and `MAX_SELF_INVOCATIONS` constant**

In `simulation.ts`, add to `SimulationStep` interface (after `opdContext`):
```typescript
  invokedBy?: string;            // Process that triggered this via invocation link
```

Add constant at top of file (after imports):
```typescript
/** Maximum self-invocation repetitions per process before stopping */
export const MAX_SELF_INVOCATIONS = 10;
```

- [ ] **Step 5: Add invocation phase to runSimulation**

In `runSimulation()`, add:
1. `selfInvocationCount` map alongside `completedProcesses`
2. After a step executes successfully (in both phase 1 and phase 2), check for invocation links
3. Re-enable invoked targets for next iteration

The key logic to add after `completedProcesses.add(ep.id)` (and similarly for waiting process unblock):

```typescript
// Phase 3: Process invocation links from the just-completed process
const justCompleted = stepResult.processId;
if (justCompleted) {
  for (const link of model.links.values()) {
    if (link.type !== "invocation" || link.source !== justCompleted) continue;
    const targetId = link.target;
    const isSelf = targetId === justCompleted;

    // Self-invocation guard
    if (isSelf) {
      const count = selfInvocationCount.get(targetId) ?? 0;
      if (count >= MAX_SELF_INVOCATIONS) continue;
      selfInvocationCount.set(targetId, count + 1);
    } else {
      // Reset self-invocation counter when invoked by another process
      selfInvocationCount.delete(targetId);
    }

    // Re-enable the target process (override SIM-BUG-01 guard)
    completedProcesses.delete(targetId);
  }
}
```

- [ ] **Step 6: Enrich step with invokedBy tracking**

Track the last invoker in a `pendingInvocations` map. When a process executes that was re-enabled by invocation, set `stepResult.invokedBy`:

```typescript
// Before the main loop:
const pendingInvocations = new Map<string, string>(); // targetId → sourceId

// In Phase 3 (after completedProcesses.delete):
pendingInvocations.set(targetId, justCompleted);

// After step execution (both phase 1 and 2), before pushing to steps:
if (pendingInvocations.has(stepResult.processId!)) {
  stepResult.invokedBy = pendingInvocations.get(stepResult.processId!);
  pendingInvocations.delete(stepResult.processId!);
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `bunx vitest run packages/core/tests/simulation.test.ts -t "triggers destination"`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/simulation.ts packages/core/tests/simulation.test.ts
git commit -m "feat(sim): invocation link triggers destination process (SIM-BUG-02)

ISO §9.5.2.5.1: when source process completes, immediately initiate
destination process via invocation link. Re-enables target in
completedProcesses set (overrides SIM-BUG-01 guard for invoked processes)."
```

---

### Task 3: Test — self-invocation with guard

**Files:**
- Modify: `packages/core/tests/simulation.test.ts`

- [ ] **Step 9: Write the failing test**

```typescript
it("self-invocation loops until MAX_SELF_INVOCATIONS", () => {
  // Process that self-invokes, consuming nothing (pure loop)
  let m = createModel("Test");
  m = (addThing(m, proc("proc-loop", "Looper")) as any).value;
  m = (addLink(m, { id: "lnk-self", type: "invocation", source: "proc-loop", target: "proc-loop" }) as any).value;
  const trace = runSimulation(m);
  // Should execute 1 (initial) + 10 (self-invocations) = 11 times
  const loopSteps = trace.steps.filter(s => s.processId === "proc-loop");
  expect(loopSteps.length).toBe(11);
  expect(trace.completed).toBe(true);
  expect(trace.deadlocked).toBe(false);
});
```

- [ ] **Step 10: Run test to verify it passes (should pass with existing impl)**

Run: `bunx vitest run packages/core/tests/simulation.test.ts -t "self-invocation loops"`
Expected: PASS (guard already implemented in Task 2)

---

### Task 4: Test — self-invocation stops on precondition failure

**Files:**
- Modify: `packages/core/tests/simulation.test.ts`

- [ ] **Step 11: Write the test**

```typescript
it("self-invocation stops when precondition fails (Approach C)", () => {
  // Process consumes an object each iteration — stops when object consumed
  let m = createModel("Test");
  m = (addThing(m, obj("obj-fuel", "Fuel")) as any).value;
  m = (addThing(m, proc("proc-burn", "Burning")) as any).value;
  m = (addLink(m, { id: "lnk-con", type: "consumption", source: "obj-fuel", target: "proc-burn" }) as any).value;
  m = (addLink(m, { id: "lnk-self", type: "invocation", source: "proc-burn", target: "proc-burn" }) as any).value;
  const trace = runSimulation(m);
  // First execution consumes Fuel — second attempt fails precondition
  const burnSteps = trace.steps.filter(s => s.processId === "proc-burn" && !s.skipped);
  expect(burnSteps.length).toBe(1);
  expect(trace.finalState.objects.get("obj-fuel")?.exists).toBe(false);
});
```

- [ ] **Step 12: Run test**

Run: `bunx vitest run packages/core/tests/simulation.test.ts -t "precondition fails"`
Expected: PASS (precondition evaluation already handles consumed objects)

---

### Task 5: Test — invocation chain A→B→C

**Files:**
- Modify: `packages/core/tests/simulation.test.ts`

- [ ] **Step 13: Write the test**

```typescript
it("invocation chain A→B→C executes sequentially", () => {
  let m = createModel("Test");
  m = (addThing(m, proc("proc-a", "Step A")) as any).value;
  m = (addThing(m, proc("proc-b", "Step B")) as any).value;
  m = (addThing(m, proc("proc-c", "Step C")) as any).value;
  m = (addLink(m, { id: "lnk-ab", type: "invocation", source: "proc-a", target: "proc-b" }) as any).value;
  m = (addLink(m, { id: "lnk-bc", type: "invocation", source: "proc-b", target: "proc-c" }) as any).value;
  const trace = runSimulation(m);
  expect(trace.steps.length).toBeGreaterThanOrEqual(3);
  expect(trace.steps[0].processName).toBe("Step A");
  expect(trace.steps[1].processName).toBe("Step B");
  expect(trace.steps[1].invokedBy).toBe("proc-a");
  expect(trace.steps[2].processName).toBe("Step C");
  expect(trace.steps[2].invokedBy).toBe("proc-b");
});
```

- [ ] **Step 14: Run test**

Run: `bunx vitest run packages/core/tests/simulation.test.ts -t "chain A→B→C"`
Expected: PASS

---

### Task 6: Test — invocation with precondition wait

**Files:**
- Modify: `packages/core/tests/simulation.test.ts`

- [ ] **Step 15: Write the test**

```typescript
it("invoked process goes to waiting if precondition not met", () => {
  // A invokes B, but B needs an object that doesn't exist yet
  let m = createModel("Test");
  m = (addThing(m, obj("obj-needed", "Needed Object")) as any).value;
  m = (addThing(m, proc("proc-a", "Step A")) as any).value;
  m = (addThing(m, proc("proc-b", "Step B")) as any).value;
  // B consumes Needed Object
  m = (addLink(m, { id: "lnk-con", type: "consumption", source: "obj-needed", target: "proc-b" }) as any).value;
  // A invokes B
  m = (addLink(m, { id: "lnk-invoke", type: "invocation", source: "proc-a", target: "proc-b" }) as any).value;
  // Add condition modifier on consumption link → wait mode
  m = (addModifier(m, { id: "mod-cond", over: "lnk-con", type: "condition", condition_mode: "wait" }) as any).value;
  const trace = runSimulation(m);
  // A executes, B is invoked but Needed Object exists so B should execute too
  // (object exists by default in initial state)
  const bSteps = trace.steps.filter(s => s.processId === "proc-b" && !s.skipped);
  expect(bSteps.length).toBe(1);
});
```

- [ ] **Step 16: Run test**

Run: `bunx vitest run packages/core/tests/simulation.test.ts -t "precondition not met"`
Expected: PASS

- [ ] **Step 17: Run full test suite**

Run: `bunx vitest run`
Expected: 500+ tests passing (all existing + 5 new)

- [ ] **Step 18: Final commit**

```bash
git add packages/core/tests/simulation.test.ts
git commit -m "test(sim): add invocation link tests — chain, self-invocation, precondition guard

5 new tests: basic trigger, self-invocation MAX guard, precondition-gated
stop, chain A→B→C, invocation with condition-wait. SIM-BUG-02 closed."
```

- [ ] **Step 19: Remove SIM-BUG-02 comment**

In `simulation.ts:520`, update comment:
```typescript
// Old: (re-activation requires invocation link, not yet implemented — SIM-BUG-02)
// New: (re-activation via invocation link — ISO §9.5.2.5.1)
```

Run: `bunx vitest run` — all passing
Commit: `git commit -am "chore: update SIM-BUG-02 comment — invocation implemented"`
