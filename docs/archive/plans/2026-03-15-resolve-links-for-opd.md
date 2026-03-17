# resolveLinksForOpd Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute link visibility per OPD via fibration pullback, so the SD shows subprocess links connected to the parent process contour.

**Architecture:** Pure function `resolveLinksForOpd(model, opdId)` in core computes `ResolvedLink[]` with visual endpoint resolution. `OpdCanvas.tsx` consumes it in place of the current direct-filter `visibleLinks` useMemo.

**Tech Stack:** TypeScript, Vitest, React (OpdCanvas)

**Spec:** `docs/superpowers/specs/2026-03-15-resolve-links-for-opd-design.md`

---

## Chunk 1: Core function + unit tests

### Task 1: Type and function implementation

**Files:**
- Modify: `packages/core/src/simulation.ts` (after `getExecutableProcesses`, ~line 165)
- Modify: `packages/core/src/index.ts:32-47`

- [ ] **Step 1: Add `ResolvedLink` type and `resolveLinksForOpd` function**

In `packages/core/src/simulation.ts`, after the closing `}` of `getExecutableProcesses` (~line 165), add:

```typescript
/** Link resolved for OPD visibility with visual endpoint mapping */
export interface ResolvedLink {
  link: Link;
  visualSource: string;
  visualTarget: string;
  aggregated: boolean;
}

/**
 * Compute visible links for an OPD by resolving endpoints through in-zoom containers.
 * Implements the pullback π* of I-LINK-VISIBILITY.
 * Only processes participate in subprocess-to-parent resolution; objects need direct appearances.
 */
export function resolveLinksForOpd(model: Model, opdId: string): ResolvedLink[] {
  // 1. Appearances in this OPD
  const appearances = new Set<string>();
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) appearances.add(app.thing);
  }

  // 2. Build subprocessToAncestor: subprocess ID → visible ancestor process ID
  //    Transitively resolves nested in-zoom chains.
  const subprocessToAncestor = new Map<string, string>();

  // Find all in-zoom OPDs
  const inZoomOpds = new Map<string, OPD>();
  for (const opd of model.opds.values()) {
    if (opd.refines && opd.refinement_type === "in-zoom") {
      inZoomOpds.set(opd.refines, opd);
    }
  }

  // Recursive: given a process visible in this OPD, register all its descendants
  function registerDescendants(ancestorId: string, processId: string): void {
    const childOpd = inZoomOpds.get(processId);
    if (!childOpd) return;
    for (const app of model.appearances.values()) {
      if (app.opd !== childOpd.id) continue;
      if (app.thing === processId) continue; // Skip container
      const thing = model.things.get(app.thing);
      if (thing?.kind === "process") {
        subprocessToAncestor.set(thing.id, ancestorId);
        registerDescendants(ancestorId, thing.id); // Transitive
      }
    }
  }

  for (const thingId of appearances) {
    const thing = model.things.get(thingId);
    if (thing?.kind === "process") {
      registerDescendants(thingId, thingId);
    }
  }

  // 3. Resolve each link
  function resolve(thingId: string): string | null {
    if (appearances.has(thingId)) return thingId;
    return subprocessToAncestor.get(thingId) ?? null;
  }

  const result: ResolvedLink[] = [];
  const seen = new Set<string>(); // Dedup key: "type|visualSource|visualTarget"

  for (const link of model.links.values()) {
    const vs = resolve(link.source);
    const vt = resolve(link.target);
    if (!vs || !vt) continue;
    if (vs === vt) continue; // Skip self-loops from same-parent resolution

    const key = `${link.type}|${vs}|${vt}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      link,
      visualSource: vs,
      visualTarget: vt,
      aggregated: vs !== link.source || vt !== link.target,
    });
  }

  return result;
}
```

- [ ] **Step 2: Export from index.ts**

In `packages/core/src/index.ts`, add to the simulation exports block:

```typescript
export {
  createInitialState,
  evaluatePrecondition,
  simulationStep,
  runSimulation,
  getPreprocessSet,
  getPostprocessSet,
  getExecutableProcesses,
  resolveLinksForOpd,
  type ModelState,
  type ObjectState,
  type SimulationEvent,
  type SimulationStep,
  type SimulationTrace,
  type PreconditionResult,
  type ExecutableProcess,
  type ResolvedLink,
} from "./simulation";
```

- [ ] **Step 3: Verify compilation**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: No new errors (pre-existing TS2532 in test files only).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/simulation.ts packages/core/src/index.ts
git commit -m "feat(core): add resolveLinksForOpd for OPD link visibility via pullback"
```

---

### Task 2: Unit tests

**Files:**
- Modify: `packages/core/tests/simulation.test.ts`

- [ ] **Step 1: Add import**

Add `resolveLinksForOpd` to the import from `../src/simulation`.

- [ ] **Step 2: Write 6 tests**

After the `getExecutableProcesses` describe block, add:

```typescript
// === resolveLinksForOpd ===

describe("resolveLinksForOpd", () => {
  it("returns direct links for flat model (no in-zoom)", () => {
    const m = buildGrindingModel();
    const resolved = resolveLinksForOpd(m, "opd-sd");
    // All links have both endpoints with appearances in opd-sd by default
    // buildGrindingModel doesn't add appearances, so no links visible
    expect(resolved).toHaveLength(0);
  });

  it("resolves subprocess endpoints to parent contour", () => {
    const m = loadCoffeeMakingModel();
    const resolved = resolveLinksForOpd(m, "opd-sd");
    // Should find links resolved through proc-coffee-making
    expect(resolved.length).toBeGreaterThan(0);
    // No link should have a subprocess as visual endpoint
    for (const rl of resolved) {
      expect(rl.visualSource).not.toBe("proc-grinding");
      expect(rl.visualSource).not.toBe("proc-boiling");
      expect(rl.visualSource).not.toBe("proc-brewing");
      expect(rl.visualTarget).not.toBe("proc-grinding");
      expect(rl.visualTarget).not.toBe("proc-boiling");
      expect(rl.visualTarget).not.toBe("proc-brewing");
    }
    // All aggregated
    expect(resolved.every(rl => rl.aggregated)).toBe(true);
  });

  it("deduplicates agent links to same resolved endpoints", () => {
    const m = loadCoffeeMakingModel();
    const resolved = resolveLinksForOpd(m, "opd-sd");
    const agentLinks = resolved.filter(rl => rl.link.type === "agent");
    // 3 agent links (Barista→Grinding/Boiling/Brewing) should dedup to 1
    expect(agentLinks).toHaveLength(1);
    expect(agentLinks[0].visualSource).toBe("obj-barista");
    expect(agentLinks[0].visualTarget).toBe("proc-coffee-making");
  });

  it("skips links with non-resolvable endpoints (internal objects)", () => {
    const m = loadCoffeeMakingModel();
    const resolved = resolveLinksForOpd(m, "opd-sd");
    // Ground Coffee has no appearance in SD — links touching it are skipped
    const groundLinks = resolved.filter(rl =>
      rl.link.source === "obj-ground-coffee" || rl.link.target === "obj-ground-coffee"
    );
    expect(groundLinks).toHaveLength(0);
  });

  it("returns direct links inside in-zoom OPD (not aggregated)", () => {
    const m = loadCoffeeMakingModel();
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    // Inside SD1, links connect directly — not aggregated
    expect(resolved.length).toBeGreaterThan(0);
    const directLinks = resolved.filter(rl => !rl.aggregated);
    expect(directLinks.length).toBeGreaterThan(0);
  });

  it("produces exactly 5 visible links in SD for Coffee Making", () => {
    const m = loadCoffeeMakingModel();
    const resolved = resolveLinksForOpd(m, "opd-sd");
    // agent(1 deduped) + consumption + effect + instrument + result = 5
    expect(resolved).toHaveLength(5);
    const types = resolved.map(rl => rl.link.type).sort();
    expect(types).toEqual(["agent", "consumption", "effect", "instrument", "result"]);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `bunx vitest run packages/core/tests/simulation.test.ts`
Expected: All tests pass (41 existing + 6 new = 47).

- [ ] **Step 4: Commit**

```bash
git add packages/core/tests/simulation.test.ts
git commit -m "test(core): add resolveLinksForOpd unit tests"
```

---

## Chunk 2: OpdCanvas integration

### Task 3: Wire resolveLinksForOpd into OpdCanvas

**Files:**
- Modify: `packages/web/src/components/OpdCanvas.tsx:2,468-477,696-728`

- [ ] **Step 1: Add import**

At line 3 of `OpdCanvas.tsx`, add `resolveLinksForOpd` to the `@opmodel/core` import:

```typescript
import { createInitialState, resolveLinksForOpd, type ModelState } from "@opmodel/core";
```

- [ ] **Step 2: Replace visibleLinks useMemo**

Replace lines 467-477:

```typescript
  // Collect visible links (with endpoint resolution for in-zoom containers)
  const visibleLinks = useMemo(() => {
    const resolved = resolveLinksForOpd(model, opdId);
    return resolved.map(rl => ({
      link: rl.link,
      modifier: [...model.modifiers.values()].find((m) => m.over === rl.link.id),
      visualSource: rl.visualSource,
      visualTarget: rl.visualTarget,
    }));
  }, [model, opdId]);
```

- [ ] **Step 3: Update link rendering to use visual endpoints**

Replace the link rendering block (lines 696-728) to use `visualSource`/`visualTarget` instead of `link.source`/`link.target`:

```tsx
          {visibleLinks.map(({ link, modifier, visualSource, visualTarget }) => {
            const srcRect = getEffectiveRect(visualSource);
            const tgtRect = getEffectiveRect(visualTarget);
            const srcThing = model.things.get(visualSource);
            const tgtThing = model.things.get(visualTarget);
            if (!srcRect || !tgtRect || !srcThing || !tgtThing) return null;

            let linkSimClass = "";
            if (simModelState) {
              const isActiveLink = simActiveProcessId && (visualSource === simActiveProcessId || visualTarget === simActiveProcessId);
              if (isActiveLink) {
                linkSimClass = " link-line--sim-active";
              } else {
                const srcObj = simModelState.objects.get(visualSource);
                const tgtObj = simModelState.objects.get(visualTarget);
                if ((srcObj && !srcObj.exists) || (tgtObj && !tgtObj.exists)) {
                  linkSimClass = " link-line--sim-dimmed";
                }
              }
            }

            return (
              <g key={link.id} className={linkSimClass || undefined}>
                <LinkLine
                  link={link}
                  sourceRect={srcRect}
                  targetRect={tgtRect}
                  sourceKind={srcThing.kind}
                  targetKind={tgtThing.kind}
                  modifier={modifier}
                />
              </g>
            );
          })}
```

- [ ] **Step 4: Verify build**

Run: `cd packages/web && bunx tsc --noEmit` (or `bun run dev` and check browser console for errors).

- [ ] **Step 5: Visual verification**

1. Open http://localhost:5173
2. Load Coffee Making fixture (import `tests/coffee-making.opmodel`)
3. In SD OPD: verify 5 links visible (agent, consumption, effect, instrument, result) connecting objects to Coffee Making
4. Navigate to SD1: verify all 9 links visible connecting directly to subprocesses

- [ ] **Step 6: Run full test suite**

Run: `bunx vitest run`
Expected: All tests pass (494 existing + 6 new = 500).

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/OpdCanvas.tsx
git commit -m "feat(web): wire resolveLinksForOpd into OpdCanvas for in-zoom link visibility"
```
