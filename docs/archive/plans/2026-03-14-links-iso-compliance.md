# Links ISO 19450 Compliance — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 7 ISO 19450 link compliance gaps (2 critical + 5 important) with 6 new/fixed invariants and 1 type field, bringing link validation to ~95% ISO compliance.

**Architecture:** All changes in `packages/core/` — add eager guards in `addLink()`, fix I-27 bug in `validate()`, extend I-16 scope, add `exception_type` field. TDD throughout. Each invariant gets its own test block. No web/CLI changes needed (they use core API).

**Tech Stack:** TypeScript, Bun workspaces, Vitest, `@opmodel/core` types and Result monad

**Spec:** `docs/superpowers/specs/2026-03-14-links-iso-compliance-design.md`
**Prior work:** ISO Gap Analysis (`2026-03-13-iso-gap-analysis.md`), C2+C3 closed in session c8326d5b

**Design note — link direction convention:** The codebase uses a consistent convention where the process is the source of transforming links (`consumption: process→object`, `result: process→object`, `effect: process→object`). This differs from ISO's convention where the consumed object is the source of a consumption link. This is a deliberate design decision. I-33 validates that procedural links connect object↔process (either direction), not the specific ISO directionality. A future migration to strict ISO directionality would be a separate plan touching all test files, simulation engine, and OPL renderer.

---

## Chunk 1: Critical fixes (C7 + C8) and type changes

### Task 1: Add `exception_type` field to Link (I5-ext)

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `docs/superpowers/specs/2026-03-10-opm-json-schema.json`

- [ ] **Step 1: Add field to Link interface**

In `packages/core/src/types.ts`, inside the `Link` interface, after the `incomplete?: boolean;` line, add:

```typescript
  exception_type?: "overtime" | "undertime"; // ISO §9.5.4. Only when type === "exception"
```

- [ ] **Step 2: Add to JSON Schema**

In `docs/superpowers/specs/2026-03-10-opm-json-schema.json`, inside the Link `properties` object, add:

```json
"exception_type": {
  "type": "string",
  "enum": ["overtime", "undertime"]
}
```

And add a conditional rule in the Link `allOf` array (after the existing conditionals):

```json
{
  "if": {
    "not": {
      "properties": { "type": { "const": "exception" } },
      "required": ["type"]
    }
  },
  "then": {
    "properties": { "exception_type": false }
  }
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/packages/core && bunx tsc --noEmit`
Expected: Same pre-existing TS2532 errors only (no new errors)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts docs/superpowers/specs/2026-03-10-opm-json-schema.json
git commit -m "feat(core): add Link.exception_type for overtime/undertime distinction (ISO §9.5.4)"
```

---

### Task 2: Fix I-27 Exhibition perseverance bug (C7)

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api-links.test.ts`

**Context:** I-27 currently rejects exhibition links where exhibitor and feature have different perseverance (kind). ISO §7.2.2 explicitly exempts exhibition-characterization from the perseverance rule. An object CAN exhibit process features (operations) and vice versa.

- [ ] **Step 1: Add import for `validate` in test file**

In `packages/core/tests/api-links.test.ts`, update the import line to include `validate`:

```typescript
import { addThing, addLink, removeLink, validate } from "../src/api";
```

- [ ] **Step 2: Write test proving cross-type exhibition is valid**

Append inside the `describe("addLink", ...)` block:

```typescript
  it("allows exhibition link between object and process — ISO §7.2.2 exception (I-27 fix)", () => {
    const operation: Thing = { id: "proc-op", kind: "process", name: "GetColor", essence: "informatical", affiliation: "systemic" };
    let m = buildModel();
    m = (addThing(m, operation) as any).value;
    const link: Link = { id: "lnk-exhibit-cross", type: "exhibition", source: "proc-op", target: "obj-water" };
    const r = addLink(m, link);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      const errors = validate(r.value);
      const i27 = errors.filter(e => e.code === "I-27");
      expect(i27).toHaveLength(0);
    }
  });
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/api-links.test.ts`
Expected: FAIL — `validate()` returns I-27 error for cross-type exhibition

- [ ] **Step 4: Remove I-27 from validate()**

In `packages/core/src/api.ts`, in the `validate()` function, find and delete the entire I-27 block. It looks like:

```typescript
  // I-27: Exhibition - features must have same perseverance as exhibitor
  for (const [id, link] of model.links) {
    if (link.type === "exhibition") {
      const exhibitor = model.things.get(link.target);
      const feature = model.things.get(link.source);
      if (exhibitor && feature && exhibitor.kind !== feature.kind) {
        errors.push({ code: "I-27", message: `Exhibition ${id}: exhibitor and feature must have same perseverance`, entity: id });
      }
    }
  }
```

Delete this entire block.

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All tests PASS (no test depends on I-27 rejecting cross-type exhibition)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-links.test.ts
git commit -m "fix(core): remove I-27 exhibition perseverance check — ISO §7.2.2 exempts exhibition"
```

---

### Task 3: Add I-33 procedural link endpoint validation + refactor addLink scope (C8)

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api-links.test.ts`

**Context:** ISO requires procedural links to connect object↔process. The codebase uses a convention where process is typically the source of transforming links. I-33 validates that exactly one endpoint is object and one is process — without imposing direction.

- [ ] **Step 1: Write failing tests**

Append inside `describe("addLink", ...)` in `packages/core/tests/api-links.test.ts`:

```typescript
  // --- I-33: Procedural link endpoint type validation ---

  it("rejects consumption link between two processes (I-33)", () => {
    const proc2: Thing = { id: "proc-2", kind: "process", name: "P2", essence: "physical", affiliation: "systemic" };
    let m = buildModel();
    m = (addThing(m, proc2) as any).value;
    const r = addLink(m, { id: "lnk-bad", type: "consumption", source: "proc-heating", target: "proc-2" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-33");
  });

  it("rejects consumption link between two objects (I-33)", () => {
    const r = addLink(buildModel(), { id: "lnk-bad", type: "consumption", source: "obj-barista", target: "obj-water" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-33");
  });

  it("rejects effect link between two objects (I-33)", () => {
    const r = addLink(buildModel(), { id: "lnk-bad", type: "effect", source: "obj-barista", target: "obj-water" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-33");
  });

  it("rejects instrument link between two processes (I-33)", () => {
    const proc2: Thing = { id: "proc-2", kind: "process", name: "P2", essence: "physical", affiliation: "systemic" };
    let m = buildModel();
    m = (addThing(m, proc2) as any).value;
    const r = addLink(m, { id: "lnk-bad", type: "instrument", source: "proc-heating", target: "proc-2" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-33");
  });

  it("allows consumption link from process to object (I-33 valid — codebase convention)", () => {
    const r = addLink(buildModel(), { id: "lnk-ok", type: "consumption", source: "proc-heating", target: "obj-water" });
    expect(isOk(r)).toBe(true);
  });

  it("allows effect link from process to object (I-33 valid)", () => {
    const r = addLink(buildModel(), { id: "lnk-ok", type: "effect", source: "proc-heating", target: "obj-water" });
    expect(isOk(r)).toBe(true);
  });

  it("allows result link from process to object (I-33 valid)", () => {
    const r = addLink(buildModel(), { id: "lnk-ok", type: "result", source: "proc-heating", target: "obj-water" });
    expect(isOk(r)).toBe(true);
  });

  it("does not apply I-33 to structural links (tagged between two objects is valid)", () => {
    const r = addLink(buildModel(), { id: "lnk-tagged", type: "tagged", source: "obj-barista", target: "obj-water", tag: "knows" });
    expect(isOk(r)).toBe(true);
  });
```

- [ ] **Step 2: Run tests — expect FAIL (4 rejection tests fail)**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/api-links.test.ts`
Expected: 4 rejection tests FAIL (addLink currently allows any endpoint types for procedural links)

- [ ] **Step 3: Refactor addLink() — hoist source/target declarations**

In `packages/core/src/api.ts`, in the `addLink()` function, immediately after the two I-05 checks, add two lines to declare `source` and `target` at function scope:

```typescript
  const source = model.things.get(link.source)!;
  const target = model.things.get(link.target)!;
```

Then update the existing I-18 block to use the hoisted `source` instead of re-declaring it:

Change:
```typescript
  if (link.type === "agent") {
    const source = model.things.get(link.source)!;
    if (source.essence !== "physical") {
```
To:
```typescript
  if (link.type === "agent") {
    if (source.essence !== "physical") {
```

Similarly update the I-14 block — change:
```typescript
  if (link.type === "exception") {
    const source = model.things.get(link.source)!;
    if (!source.duration?.max) {
```
To:
```typescript
  if (link.type === "exception") {
    if (!source.duration?.max) {
```

And update the I-19 coercion at the end — change:
```typescript
  if (link.type === "exhibition") {
    const source = things.get(link.source)!;
    if (source.essence !== "informatical") {
```
To:
```typescript
  if (link.type === "exhibition") {
    const exhibitSource = things.get(link.source)!;
    if (exhibitSource.essence !== "informatical") {
      things = new Map(things).set(exhibitSource.id, { ...exhibitSource, essence: "informatical" });
```

Note: The I-19 block uses `things` (the potentially-mutated copy), not `model.things`. Keep this distinction — rename to `exhibitSource` to avoid shadowing.

- [ ] **Step 4: Add I-33 validation**

In `addLink()`, immediately after the hoisted `source`/`target` declarations and before the I-18 check, add:

```typescript
  // I-33: Procedural links must connect object↔process (ISO §6.1-§6.3)
  const PROCEDURAL_TYPES = new Set([
    "consumption", "result", "effect", "input", "output", "agent", "instrument",
  ]);
  if (PROCEDURAL_TYPES.has(link.type) && source.kind === target.kind) {
    return err({ code: "I-33", message: `${link.type} link must connect object↔process, not ${source.kind}↔${source.kind}`, entity: link.id });
  }
```

- [ ] **Step 5: Add I-33 to validate()**

In `validate()`, after the I-19 block, add:

```typescript
  // I-33: Procedural links must connect object↔process (ISO §6.1-§6.3)
  const PROCEDURAL_TYPES = new Set([
    "consumption", "result", "effect", "input", "output", "agent", "instrument",
  ]);
  for (const [id, link] of model.links) {
    if (PROCEDURAL_TYPES.has(link.type)) {
      const src = model.things.get(link.source);
      const tgt = model.things.get(link.target);
      if (src && tgt && src.kind === tgt.kind) {
        errors.push({ code: "I-33", message: `${link.type} link ${id} must connect object↔process`, entity: id });
      }
    }
  }
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/api-links.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Run full test suite — verify no regressions**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All 458 tests PASS. Since I-33 only rejects same-kind endpoints and the codebase consistently uses object↔process for procedural links, no existing tests should break.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-links.test.ts
git commit -m "feat(core): add I-33 procedural link endpoint type validation (ISO §6.1-§6.3)"
```

---

## Chunk 2: Important invariants (I-34, I-16-EXT, I-22..I-26 in addLink, I-28 in addLink)

### Task 4: Add I-34 self-loop prevention (I18)

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api-links.test.ts`

- [ ] **Step 1: Write failing tests**

Append inside `describe("addLink", ...)`:

```typescript
  // --- I-34: Self-loop prevention (except invocation) ---

  it("rejects self-loop aggregation link (I-34)", () => {
    const r = addLink(buildModel(), { id: "lnk-self", type: "aggregation", source: "obj-water", target: "obj-water" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-34");
  });

  it("rejects self-loop tagged link (I-34)", () => {
    const r = addLink(buildModel(), { id: "lnk-self-tag", type: "tagged", source: "obj-water", target: "obj-water", tag: "self" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-34");
  });

  it("allows self-invocation link (I-34 exception, ISO §8.5)", () => {
    const r = addLink(buildModel(), { id: "lnk-self-invoke", type: "invocation", source: "proc-heating", target: "proc-heating" });
    expect(isOk(r)).toBe(true);
  });
```

- [ ] **Step 2: Run tests — expect FAIL (first two tests)**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/api-links.test.ts`

- [ ] **Step 3: Implement I-34 in addLink() and validate()**

In `addLink()`, immediately after the I-05 checks and before the hoisted `source`/`target` declarations, add:

```typescript
  // I-34: No self-loops except invocation (ISO §8.5)
  if (link.source === link.target && link.type !== "invocation") {
    return err({ code: "I-34", message: `Self-loop not allowed for ${link.type} links`, entity: link.id });
  }
```

In `validate()`, after the I-33 block, add:

```typescript
  // I-34: No self-loops except invocation (ISO §8.5)
  for (const [id, link] of model.links) {
    if (link.source === link.target && link.type !== "invocation") {
      errors.push({ code: "I-34", message: `Self-loop not allowed for ${link.type} link ${id}`, entity: id });
    }
  }
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/api-links.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-links.test.ts
git commit -m "feat(core): add I-34 self-loop prevention except invocation (ISO §8.5)"
```

---

### Task 5: Extend I-16 to enabling links (I15) and add I-22..I-26 to addLink (I16)

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api-links.test.ts`

- [ ] **Step 1: Write failing tests**

Append inside `describe("addLink", ...)`:

```typescript
  // --- I-16-EXT: Enabling link uniqueness ---

  it("rejects duplicate enabling role for same (object, process) pair (I-16-EXT)", () => {
    let m = buildModel();
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-barista", target: "proc-heating" }) as any).value;
    const r = addLink(m, { id: "lnk-instrument", type: "instrument", source: "obj-barista", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-16");
  });

  it("rejects duplicate enabling — instrument then agent (I-16-EXT)", () => {
    let m = buildModel();
    m = (addLink(m, { id: "lnk-inst", type: "instrument", source: "obj-water", target: "proc-heating" }) as any).value;
    const r = addLink(m, { id: "lnk-agent2", type: "agent", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-16");
  });

  it("allows different objects as enablers of same process (I-16-EXT valid)", () => {
    let m = buildModel();
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-barista", target: "proc-heating" }) as any).value;
    const r = addLink(m, { id: "lnk-inst", type: "instrument", source: "obj-water", target: "proc-heating" });
    expect(isOk(r)).toBe(true);
  });

  // --- I-22..I-26: Structural invariants in addLink ---

  it("rejects generalization between object and process (I-22)", () => {
    const r = addLink(buildModel(), { id: "lnk-gen", type: "generalization", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-22");
  });

  it("rejects classification between object and process (I-23)", () => {
    const r = addLink(buildModel(), { id: "lnk-cls", type: "classification", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-23");
  });

  it("rejects invocation from object to process (I-24)", () => {
    const r = addLink(buildModel(), { id: "lnk-inv", type: "invocation", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-24");
  });

  it("rejects exception between process and object (I-25)", () => {
    const procTimed: Thing = { id: "proc-timed", kind: "process", name: "Timed", essence: "physical", affiliation: "systemic", duration: { nominal: 60, max: 120, unit: "s" } };
    let m = buildModel();
    m = (addThing(m, procTimed) as any).value;
    const r = addLink(m, { id: "lnk-exc", type: "exception", source: "proc-timed", target: "obj-water" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-25");
  });

  it("rejects aggregation between object and process (I-26)", () => {
    const r = addLink(buildModel(), { id: "lnk-agg", type: "aggregation", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-26");
  });

  it("allows generalization between two objects (I-22 valid)", () => {
    const r = addLink(buildModel(), { id: "lnk-gen-ok", type: "generalization", source: "obj-water", target: "obj-barista" });
    expect(isOk(r)).toBe(true);
  });
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/api-links.test.ts`

- [ ] **Step 3: Implement in addLink()**

In `addLink()`, after the I-33 check, add:

```typescript
  // I-16-EXT: Enabling link uniqueness — max 1 enabling link per (object, process) pair (ISO §8.1.2)
  if (link.type === "agent" || link.type === "instrument") {
    const enablingTypes = new Set(["agent", "instrument"]);
    for (const existing of model.links.values()) {
      if (enablingTypes.has(existing.type)) {
        if (existing.source === link.source && existing.target === link.target) {
          return err({ code: "I-16", message: `Multiple enabling links between ${link.source} and ${link.target}`, entity: link.id });
        }
        // Also check reversed endpoints (in case convention differs)
        if (existing.source === link.target && existing.target === link.source) {
          return err({ code: "I-16", message: `Multiple enabling links between ${link.source} and ${link.target}`, entity: link.id });
        }
      }
    }
  }

  // I-22: Generalization requires same perseverance
  if (link.type === "generalization" && source.kind !== target.kind) {
    return err({ code: "I-22", message: `Generalization: source and target must have same kind`, entity: link.id });
  }
  // I-23: Classification requires same perseverance
  if (link.type === "classification" && source.kind !== target.kind) {
    return err({ code: "I-23", message: `Classification: source and target must have same kind`, entity: link.id });
  }
  // I-24: Invocation requires both processes
  if (link.type === "invocation" && (source.kind !== "process" || target.kind !== "process")) {
    return err({ code: "I-24", message: `Invocation link must connect processes only`, entity: link.id });
  }
  // I-25: Exception requires both processes
  if (link.type === "exception" && (source.kind !== "process" || target.kind !== "process")) {
    return err({ code: "I-25", message: `Exception link must connect processes only`, entity: link.id });
  }
  // I-26: Aggregation requires same perseverance
  if (link.type === "aggregation" && source.kind !== target.kind) {
    return err({ code: "I-26", message: `Aggregation: source and target must have same kind`, entity: link.id });
  }
```

- [ ] **Step 4: Add I-16-EXT to validate()**

In `validate()`, after the existing I-16 block, add:

```typescript
  // I-16-EXT: Enabling link uniqueness (ISO §8.1.2)
  const enablingTypes = new Set(["agent", "instrument"]);
  const enablingPairs = new Map<string, string>();
  for (const [id, link] of model.links) {
    if (enablingTypes.has(link.type)) {
      const src = model.things.get(link.source);
      const tgt = model.things.get(link.target);
      if (src && tgt) {
        const objId = src.kind === "object" ? link.source : link.target;
        const procId = src.kind === "process" ? link.source : link.target;
        const pairKey = `${procId}::${objId}`;
        if (enablingPairs.has(pairKey)) {
          errors.push({ code: "I-16", message: `Multiple enabling links between process ${procId} and object ${objId}`, entity: id });
        } else {
          enablingPairs.set(pairKey, id);
        }
      }
    }
  }
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/api-links.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Run full test suite**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-links.test.ts
git commit -m "feat(core): add I-16-EXT enabling uniqueness and I-22..I-26 guards in addLink"
```

---

### Task 6: Add I-28 state-specified validation in addLink + fix validate() consistency (I17)

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api-links.test.ts`

**Context:** `addLink()` does not validate that `source_state`/`target_state` belong to the correct parent Thing. The existing `validate()` I-28 logic uses `link.target` as parent for transforming links — but this is wrong for consumption links (where `source=process, target=object` in codebase convention, so `link.target` IS the object). We need both addLink and validate to use the **object endpoint** (whichever endpoint is the object) as the expected parent.

- [ ] **Step 1: Write failing tests**

Add `addState` to imports:

```typescript
import { addThing, addLink, removeLink, validate, addState } from "../src/api";
```

Append inside `describe("addLink", ...)`:

```typescript
  // --- I-28: State-specified link validation in addLink ---

  it("rejects source_state not belonging to source thing (I-28)", () => {
    let m = buildModel();
    m = (addState(m, { id: "st-cold", parent: "obj-water", name: "cold", initial: false, final: false, default: false }) as any).value;
    // agent link: barista→heating with source_state=st-cold (belongs to water, not barista)
    const r = addLink(m, { id: "lnk-bad", type: "agent", source: "obj-barista", target: "proc-heating", source_state: "st-cold" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-28");
  });

  it("rejects non-existent source_state (I-28)", () => {
    const r = addLink(buildModel(), { id: "lnk-bad", type: "agent", source: "obj-barista", target: "proc-heating", source_state: "st-nonexistent" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-28");
  });

  it("rejects target_state not belonging to object endpoint (I-28)", () => {
    let m = buildModel();
    m = (addState(m, { id: "st-cold", parent: "obj-water", name: "cold", initial: false, final: false, default: false }) as any).value;
    // consumption: heating→water, target_state=st-cold (belongs to water which IS the object endpoint — valid)
    // Instead test with barista state on water endpoint:
    m = (addState(m, { id: "st-ready", parent: "obj-barista", name: "ready", initial: false, final: false, default: false }) as any).value;
    const r = addLink(m, { id: "lnk-bad", type: "consumption", source: "proc-heating", target: "obj-water", target_state: "st-ready" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-28");
  });

  it("allows valid source_state on enabling link (I-28 valid)", () => {
    let m = buildModel();
    m = (addState(m, { id: "st-awake", parent: "obj-barista", name: "awake", initial: false, final: false, default: false }) as any).value;
    const r = addLink(m, { id: "lnk-ok", type: "agent", source: "obj-barista", target: "proc-heating", source_state: "st-awake" });
    expect(isOk(r)).toBe(true);
  });
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/api-links.test.ts`

- [ ] **Step 3: Implement I-28 in addLink()**

In `addLink()`, after the I-26 check and before the I-STATELESS-EFFECT block, add:

```typescript
  // I-28: State-specified link validation — states must exist and belong to correct parent
  if (link.source_state) {
    const state = model.states.get(link.source_state);
    if (!state) {
      return err({ code: "I-28", message: `source_state not found: ${link.source_state}`, entity: link.id });
    }
    // For enabling links: source_state belongs to source (the object enabler)
    // For transforming links: source_state belongs to the object endpoint
    const enablingSet = new Set(["agent", "instrument"]);
    const expectedParent = enablingSet.has(link.type) ? link.source :
      (source.kind === "object" ? link.source : link.target);
    if (state.parent !== expectedParent) {
      return err({ code: "I-28", message: `source_state ${link.source_state} does not belong to ${expectedParent}`, entity: link.id });
    }
  }
  if (link.target_state) {
    const state = model.states.get(link.target_state);
    if (!state) {
      return err({ code: "I-28", message: `target_state not found: ${link.target_state}`, entity: link.id });
    }
    // target_state always belongs to the object endpoint
    const objectId = source.kind === "object" ? link.source : link.target;
    if (state.parent !== objectId) {
      return err({ code: "I-28", message: `target_state ${link.target_state} does not belong to object ${objectId}`, entity: link.id });
    }
  }
```

- [ ] **Step 4: Fix validate() I-28 to use consistent logic**

In `validate()`, find the existing I-28 block and update it to use the same "object endpoint" logic instead of always using `link.target`. Replace the existing I-28 block with:

```typescript
  // I-28: State-specified links reference valid states (fixed: use object endpoint, not always link.target)
  for (const [id, link] of model.links) {
    const src = model.things.get(link.source);
    const tgt = model.things.get(link.target);
    const enablingSet = new Set(["agent", "instrument"]);
    if (link.source_state) {
      const state = model.states.get(link.source_state);
      if (!state) {
        errors.push({ code: "I-28", message: `Link ${id} source_state references non-existent state`, entity: id });
      } else {
        const expectedParent = enablingSet.has(link.type)
          ? link.source
          : (src?.kind === "object" ? link.source : link.target);
        if (state.parent !== expectedParent) {
          errors.push({ code: "I-28", message: `Link ${id} source_state does not belong to expected parent`, entity: id });
        }
      }
    }
    if (link.target_state) {
      const state = model.states.get(link.target_state);
      if (!state) {
        errors.push({ code: "I-28", message: `Link ${id} target_state references non-existent state`, entity: id });
      } else {
        const objectId = src?.kind === "object" ? link.source : link.target;
        if (state.parent !== objectId) {
          errors.push({ code: "I-28", message: `Link ${id} target_state does not belong to object endpoint`, entity: id });
        }
      }
    }
  }
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api-links.test.ts
git commit -m "feat(core): add I-28 state-specified validation in addLink + fix validate() consistency"
```

---

### Task 7: Update documentation and gap analysis

**Files:**
- Modify: `docs/superpowers/specs/2026-03-13-iso-gap-analysis.md`
- Modify: `docs/superpowers/specs/2026-03-10-opm-data-model.md`

- [ ] **Step 1: Update ISO gap analysis — add C7, C8 as closed**

In `docs/superpowers/specs/2026-03-13-iso-gap-analysis.md`, after the Gap-C6 entry in Section 1, add:

```markdown
### Gap-C7: I-27 Exhibition Perseverance Bug
- **ISO:** 7.2.2
- **Problema:** I-27 rechazaba exhibition links cross-type. ISO §7.2.2 explícitamente exime exhibition-characterization de la regla de perseverancia.
- **Status:** ✅ CERRADO — I-27 eliminado de validate()

### Gap-C8: Procedural Link Endpoint Type Validation
- **ISO:** 6.1-6.3
- **Problema:** addLink() no validaba que procedural links conecten object↔process.
- **Status:** ✅ CERRADO — I-33 implementado en addLink() y validate()
```

Update the Resumen Ejecutivo table count to show 8 CRITICAL (4 closed: C2, C3, C7, C8).

- [ ] **Step 2: Update data model spec — remove I-27, add I-33, I-34**

In `docs/superpowers/specs/2026-03-10-opm-data-model.md`:
- Mark I-27 as "REMOVED — ISO §7.2.2 exempts exhibition from perseverance rule"
- Add I-33: "Procedural links must connect object↔process"
- Add I-34: "Self-loop prevention (except invocation)"
- Add I-16-EXT note: "Enabling link uniqueness per (object, process) pair"

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-03-13-iso-gap-analysis.md docs/superpowers/specs/2026-03-10-opm-data-model.md
git commit -m "docs: update ISO gap analysis and data model spec with C7, C8, I-33, I-34"
```

---

### Task 8: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full type check**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/packages/core && bunx tsc --noEmit`
Expected: Same pre-existing TS2532 errors only (no new errors)

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All tests pass (~458 original + ~20 new = ~478 total)

- [ ] **Step 3: Git log summary**

Run: `git log --oneline -10`
Expected: 7 new commits for this plan
