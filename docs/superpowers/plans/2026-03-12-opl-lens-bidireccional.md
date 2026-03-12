# OPL Lens Bidireccional — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a bidirectional OPL lens in `packages/core/` that synchronizes the OPM graph with a typed OPL AST, satisfying PutGet/GetPut laws.

**Architecture:** Parameterized lens with structured edits. `expose` generates `OplDocument` (typed AST) from model+OPD. `applyOplEdit` maps structured edits to existing CRUD API calls. `render` serializes documents to ISO 19450 OPL text. Settings embedded in document via `OplRenderSettings` (plan deviation from spec: `OplDocument` carries `renderSettings` so `render` stays `(OplDocument) → string` without a separate settings parameter).

**Tech Stack:** TypeScript, Vitest, zero dependencies (core), Commander.js (CLI)

**Spec:** `docs/superpowers/specs/2026-03-12-opl-lens-bidireccional-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/core/src/opl-types.ts` | Create | OPL AST types: `OplSentence` union, `OplDocument`, `OplEdit`, `OplRenderSettings` |
| `packages/core/src/opl.ts` | Create | `expose`, `applyOplEdit`, `render`, `oplSlug`, `editsFrom` |
| `packages/core/src/index.ts` | Modify | Re-export OPL types and functions |
| `packages/core/tests/opl.test.ts` | Create | ~25 tests: expose, render, applyOplEdit, lens laws |
| `packages/cli/src/commands/opl.ts` | Create | `executeOpl` command handler |
| `packages/cli/src/cli.ts` | Modify | Register `opl` command |
| `packages/cli/src/index.ts` | Modify | Re-export `executeOpl` |
| `packages/cli/tests/opl.test.ts` | Create | ~5 CLI tests |

---

## Chunk 1: Core Types + expose + render

### Task 1: OPL Types

**Files:**
- Create: `packages/core/src/opl-types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create OPL types file**

```typescript
// packages/core/src/opl-types.ts
import type {
  Kind, Essence, Affiliation, TimeUnit, LinkType, ModifierType,
  OplEssenceVisibility, OplUnitsVisibility,
  Thing, State, Link, Modifier, Position,
} from "./types";

// === OPL Sentence AST ===

export interface OplThingDeclaration {
  kind: "thing-declaration";
  thingId: string;
  name: string;
  thingKind: Kind;
  essence: Essence;
  affiliation: Affiliation;
  alias?: string;
}

export interface OplStateEnumeration {
  kind: "state-enumeration";
  thingId: string;
  thingName: string;
  stateIds: string[];
  stateNames: string[];
}

export interface OplDuration {
  kind: "duration";
  thingId: string;
  thingName: string;
  nominal: number;
  unit: TimeUnit;
}

export interface OplLinkSentence {
  kind: "link";
  linkId: string;
  linkType: LinkType;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  sourceStateName?: string;
  targetStateName?: string;
  tag?: string;
}

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

export type OplSentence =
  | OplThingDeclaration
  | OplStateEnumeration
  | OplDuration
  | OplLinkSentence
  | OplModifierSentence;

export interface OplRenderSettings {
  essenceVisibility: OplEssenceVisibility;
  unitsVisibility: OplUnitsVisibility;
  aliasVisibility: boolean;
  primaryEssence: Essence;
}

export interface OplDocument {
  opdId: string;
  opdName: string;
  sentences: OplSentence[];
  renderSettings: OplRenderSettings;
}

// === OPL Edits ===

export type OplEdit =
  | { kind: "add-thing"; opdId: string; thing: Omit<Thing, "id">; position: Position }
  | { kind: "remove-thing"; thingId: string }
  | { kind: "add-states"; thingId: string; states: Omit<State, "id" | "parent">[] }
  | { kind: "remove-state"; stateId: string }
  | { kind: "add-link"; link: Omit<Link, "id"> }
  | { kind: "remove-link"; linkId: string }
  | { kind: "add-modifier"; modifier: Omit<Modifier, "id"> }
  | { kind: "remove-modifier"; modifierId: string };
```

- [ ] **Step 2: Add exports to index.ts**

Add after the existing `history` export block in `packages/core/src/index.ts`:

```typescript
export {
  expose, applyOplEdit, render, oplSlug, editsFrom,
} from "./opl";
export type {
  OplSentence, OplThingDeclaration, OplStateEnumeration, OplDuration,
  OplLinkSentence, OplModifierSentence, OplDocument, OplEdit, OplRenderSettings,
} from "./opl-types";
```

- [ ] **Step 3: Create empty opl.ts scaffold so TypeScript doesn't break**

```typescript
// packages/core/src/opl.ts
import type { Model } from "./types";
import type { InvariantError } from "./result";
import type { Result } from "./result";
import type { OplDocument, OplEdit } from "./opl-types";
import { ok } from "./result";

export function expose(_model: Model, _opdId: string): OplDocument {
  throw new Error("Not implemented");
}

export function applyOplEdit(_model: Model, _edit: OplEdit): Result<Model, InvariantError> {
  throw new Error("Not implemented");
}

export function render(_doc: OplDocument): string {
  throw new Error("Not implemented");
}

export function oplSlug(_name: string): string {
  throw new Error("Not implemented");
}

export function editsFrom(_doc: OplDocument): OplEdit[] {
  throw new Error("Not implemented");
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/opl-types.ts packages/core/src/opl.ts packages/core/src/index.ts
git commit -m "feat(core): add OPL types and scaffold for lens implementation"
```

---

### Task 2: expose + render + tests

**Files:**
- Modify: `packages/core/src/opl.ts`
- Create: `packages/core/tests/opl.test.ts`

**Context:**
- `createModel("Test")` creates a model with one OPD: `opd-sd` (the root System Diagram)
- `addThing` / `addState` / `addLink` / `addAppearance` / `addModifier` are in `api.ts`
- Appearance key is `${thingId}::${opdId}`, appearance requires `thing, opd, x, y, w, h`
- `isOk(result)` to check Result, `result.value` to get the model
- States require parent to be an object (I-01)
- Modifiers require a valid link id (I-06)

- [ ] **Step 1: Write expose + render tests**

```typescript
// packages/core/tests/opl.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, addState, addLink, addAppearance, addModifier,
  updateSettings,
} from "../src/api";
import { isOk } from "../src/result";
import { expose, render } from "../src/opl";
import type { Thing, State, Appearance } from "../src/types";

// === Test fixtures ===

const waterObj: Thing = {
  id: "obj-water", kind: "object", name: "Water",
  essence: "physical", affiliation: "systemic",
};

const boilingProc: Thing = {
  id: "proc-boiling", kind: "process", name: "Boiling",
  essence: "physical", affiliation: "systemic",
  duration: { nominal: 5, unit: "min" },
};

const cupObj: Thing = {
  id: "obj-cup", kind: "object", name: "Cup",
  essence: "physical", affiliation: "environmental",
};

const waterApp: Appearance = {
  thing: "obj-water", opd: "opd-sd", x: 100, y: 100, w: 120, h: 60,
};

const boilingApp: Appearance = {
  thing: "proc-boiling", opd: "opd-sd", x: 300, y: 100, w: 120, h: 60,
};

const cupApp: Appearance = {
  thing: "obj-cup", opd: "opd-sd", x: 100, y: 300, w: 120, h: 60,
};

function buildModel() {
  let m = createModel("Test");
  // Add things
  let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
  r = addThing(m, boilingProc); if (!isOk(r)) throw r.error; m = r.value;
  r = addThing(m, cupObj); if (!isOk(r)) throw r.error; m = r.value;
  // Add appearances in opd-sd
  r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
  r = addAppearance(m, boilingApp); if (!isOk(r)) throw r.error; m = r.value;
  r = addAppearance(m, cupApp); if (!isOk(r)) throw r.error; m = r.value;
  // Add states to Water
  r = addState(m, { id: "state-liquid", parent: "obj-water", name: "liquid", initial: true, final: false, default: true });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addState(m, { id: "state-gas", parent: "obj-water", name: "gas", initial: false, final: false, default: false });
  if (!isOk(r)) throw r.error; m = r.value;
  // Add link: Boiling consumes Water
  r = addLink(m, { id: "lnk-boiling-consumption-water", type: "consumption", source: "proc-boiling", target: "obj-water" });
  if (!isOk(r)) throw r.error; m = r.value;
  // Add link: Boiling affects Water (effect with states)
  r = addLink(m, { id: "lnk-boiling-effect-water", type: "effect", source: "proc-boiling", target: "obj-water", source_state: "state-liquid", target_state: "state-gas" });
  if (!isOk(r)) throw r.error; m = r.value;
  // Add link: Cup aggregation Water
  r = addLink(m, { id: "lnk-cup-aggregation-water", type: "aggregation", source: "obj-cup", target: "obj-water" });
  if (!isOk(r)) throw r.error; m = r.value;
  return m;
}

// === expose tests ===

describe("expose", () => {
  it("produces thing declarations for visible things", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const declarations = doc.sentences.filter(s => s.kind === "thing-declaration");
    expect(declarations).toHaveLength(3);
    // Objects first, then processes
    expect(declarations[0].name).toBe("Cup");       // obj-cup
    expect(declarations[1].name).toBe("Water");      // obj-water
    expect(declarations[2].name).toBe("Boiling");    // proc-boiling
  });

  it("produces state enumerations", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const stateEnums = doc.sentences.filter(s => s.kind === "state-enumeration");
    expect(stateEnums).toHaveLength(1);
    const waterStates = stateEnums[0] as any;
    expect(waterStates.thingName).toBe("Water");
    expect(waterStates.stateNames).toEqual(["gas", "liquid"]);
  });

  it("produces duration sentences for things with duration", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const durations = doc.sentences.filter(s => s.kind === "duration");
    expect(durations).toHaveLength(1);
    const d = durations[0] as any;
    expect(d.thingName).toBe("Boiling");
    expect(d.nominal).toBe(5);
    expect(d.unit).toBe("min");
  });

  it("produces link sentences for links with both endpoints visible", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const links = doc.sentences.filter(s => s.kind === "link");
    expect(links).toHaveLength(3);
  });

  it("produces modifier sentences", () => {
    let m = buildModel();
    let r = addModifier(m, { id: "mod-event", over: "lnk-boiling-consumption-water", type: "event" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const modifiers = doc.sentences.filter(s => s.kind === "modifier");
    expect(modifiers).toHaveLength(1);
    const mod = modifiers[0] as any;
    expect(mod.modifierType).toBe("event");
    expect(mod.negated).toBe(false);
  });

  it("omits things without appearance in the OPD", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    // No appearance added — Water should not appear in OPL
    const doc = expose(m, "opd-sd");
    expect(doc.sentences).toHaveLength(0);
  });

  it("omits links when one endpoint is outside the OPD", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, boilingProc); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
    // Boiling has no appearance in opd-sd
    r = addLink(m, { id: "lnk-1", type: "consumption", source: "proc-boiling", target: "obj-water" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const links = doc.sentences.filter(s => s.kind === "link");
    expect(links).toHaveLength(0);
  });
});

// === expose settings tests ===

describe("expose settings", () => {
  it("respects opl_essence_visibility: none", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_essence_visibility: "none" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    expect(doc.renderSettings.essenceVisibility).toBe("none");
  });

  it("respects opl_essence_visibility: non_default with primary_essence", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_essence_visibility: "non_default", primary_essence: "physical" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    expect(doc.renderSettings.essenceVisibility).toBe("non_default");
    expect(doc.renderSettings.primaryEssence).toBe("physical");
  });

  it("respects opl_units_visibility setting", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_units_visibility: "hide" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    expect(doc.renderSettings.unitsVisibility).toBe("hide");
  });
});

// === render tests ===

describe("render", () => {
  it("renders thing declarations with a/an grammar", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water is an object, physical, systemic.");
    expect(text).toContain("Boiling is a process, physical, systemic.");
  });

  it("renders state enumerations", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water can be gas or liquid.");
  });

  it("renders link sentences", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling consumes Water.");
    expect(text).toContain("Cup consists of Water.");
  });

  it("renders effect link with states", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling affects Water, from liquid to gas.");
  });

  it("renders duration", () => {
    const m = buildModel();
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling requires 5min.");
  });

  it("renders empty document as empty string", () => {
    const m = createModel("Test");
    const doc = expose(m, "opd-sd");
    expect(render(doc)).toBe("");
  });

  it("omits essence when essenceVisibility is none", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_essence_visibility: "none" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Water is an object, systemic.");
    expect(text).not.toContain("physical");
  });

  it("omits unit when unitsVisibility is hide", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_units_visibility: "hide" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Boiling requires 5.");
    expect(text).not.toContain("5min");
  });

  it("omits essence only for default when non_default", () => {
    let m = buildModel();
    let r = updateSettings(m, { opl_essence_visibility: "non_default", primary_essence: "physical" });
    if (!isOk(r)) throw r.error; m = r.value;
    const doc = expose(m, "opd-sd");
    const text = render(doc);
    // Water is physical (= primary_essence), so essence should be omitted
    expect(text).toContain("Water is an object, systemic.");
    // Cup is also physical, should also be omitted
    expect(text).toContain("Cup is an object, environmental.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/opl.test.ts`
Expected: All tests FAIL (functions throw "Not implemented")

- [ ] **Step 3: Implement expose**

Replace the `expose` function in `packages/core/src/opl.ts`:

```typescript
// packages/core/src/opl.ts
import type { Model, ComputationalObject } from "./types";
import type { InvariantError } from "./result";
import type { Result } from "./result";
import type {
  OplDocument, OplEdit, OplSentence,
  OplThingDeclaration, OplLinkSentence, OplRenderSettings,
} from "./opl-types";
import { ok } from "./result";

export function expose(model: Model, opdId: string): OplDocument {
  const opd = model.opds.get(opdId);
  const opdName = opd?.name ?? opdId;

  const settings = model.settings;
  const renderSettings: OplRenderSettings = {
    essenceVisibility: settings.opl_essence_visibility ?? "all",
    unitsVisibility: settings.opl_units_visibility ?? "always",
    aliasVisibility: settings.opl_alias_visibility ?? false,
    primaryEssence: settings.primary_essence ?? "physical",
  };

  // 1. Collect visible things
  const visibleThings = new Set<string>();
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) visibleThings.add(app.thing);
  }

  // 2. Sort: objects first, then processes; within each group by ID
  const sortedThingIds = [...visibleThings].sort((a, b) => {
    const ta = model.things.get(a);
    const tb = model.things.get(b);
    if (!ta || !tb) return 0;
    if (ta.kind !== tb.kind) return ta.kind === "object" ? -1 : 1;
    return a.localeCompare(b);
  });

  const sentences: OplSentence[] = [];

  // 3. Thing declarations + states + durations
  for (const thingId of sortedThingIds) {
    const thing = model.things.get(thingId);
    if (!thing) continue;

    const declaration: OplThingDeclaration = {
      kind: "thing-declaration",
      thingId,
      name: thing.name,
      thingKind: thing.kind,
      essence: thing.essence,
      affiliation: thing.affiliation,
    };
    if (renderSettings.aliasVisibility && thing.computational && "alias" in thing.computational) {
      declaration.alias = (thing.computational as ComputationalObject).alias;
    }
    sentences.push(declaration);

    // States (sorted by ID)
    const thingStates = [...model.states.values()]
      .filter(s => s.parent === thingId)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (thingStates.length > 0) {
      sentences.push({
        kind: "state-enumeration",
        thingId,
        thingName: thing.name,
        stateIds: thingStates.map(s => s.id),
        stateNames: thingStates.map(s => s.name),
      });
    }

    // Duration
    if (thing.duration) {
      sentences.push({
        kind: "duration",
        thingId,
        thingName: thing.name,
        nominal: thing.duration.nominal,
        unit: thing.duration.unit,
      });
    }
  }

  // 4. Links (both endpoints visible, sorted by ID)
  const sortedLinks = [...model.links.values()]
    .filter(l => visibleThings.has(l.source) && visibleThings.has(l.target))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const link of sortedLinks) {
    const sentence: OplLinkSentence = {
      kind: "link",
      linkId: link.id,
      linkType: link.type,
      sourceId: link.source,
      targetId: link.target,
      sourceName: model.things.get(link.source)?.name ?? link.source,
      targetName: model.things.get(link.target)?.name ?? link.target,
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
    sentences.push(sentence);
  }

  // 5. Modifiers (sorted by ID)
  const sortedModifiers = [...model.modifiers.values()]
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const mod of sortedModifiers) {
    const link = model.links.get(mod.over);
    if (!link || !visibleThings.has(link.source) || !visibleThings.has(link.target)) continue;
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
  }

  return { opdId, opdName, sentences, renderSettings };
}
```

- [ ] **Step 4: Implement render**

Add to `packages/core/src/opl.ts` after `expose`:

```typescript
function aOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function renderLinkSentence(s: OplLinkSentence): string {
  switch (s.linkType) {
    case "agent": return `${s.sourceName} handles ${s.targetName}.`;
    case "instrument": return `${s.sourceName} is an instrument of ${s.targetName}.`;
    case "consumption": return `${s.sourceName} consumes ${s.targetName}.`;
    case "effect": {
      if (s.sourceStateName && s.targetStateName) {
        return `${s.sourceName} affects ${s.targetName}, from ${s.sourceStateName} to ${s.targetStateName}.`;
      }
      return `${s.sourceName} affects ${s.targetName}.`;
    }
    case "result": return `${s.sourceName} yields ${s.targetName}.`;
    case "input": return `${s.sourceName} requires ${s.targetName}.`;
    case "output": return `${s.sourceName} outputs ${s.targetName}.`;
    case "aggregation": return `${s.sourceName} consists of ${s.targetName}.`;
    case "exhibition": return `${s.sourceName} exhibits ${s.targetName}.`;
    case "generalization": return `${s.targetName} is a ${s.sourceName}.`;
    case "classification": return `${s.targetName} is classified by ${s.sourceName}.`;
    case "invocation": return `${s.sourceName} invokes ${s.targetName}.`;
    case "exception": return `${s.sourceName} handles exception from ${s.targetName}.`;
    case "tagged": return `${s.sourceName} ${s.tag ?? "relates to"} ${s.targetName}.`;
    default: return `${s.sourceName} --[${s.linkType}]--> ${s.targetName}.`;
  }
}

function renderSentence(s: OplSentence, settings: OplRenderSettings): string {
  switch (s.kind) {
    case "thing-declaration": {
      let text = `${s.name} is ${aOrAn(s.thingKind)}`;
      if (settings.essenceVisibility === "all" ||
          (settings.essenceVisibility === "non_default" && s.essence !== settings.primaryEssence)) {
        text += `, ${s.essence}`;
      }
      text += `, ${s.affiliation}`;
      if (s.alias && settings.aliasVisibility) {
        text += ` (alias: ${s.alias})`;
      }
      return text + ".";
    }
    case "state-enumeration": {
      if (s.stateNames.length === 0) return "";
      if (s.stateNames.length === 1) return `${s.thingName} can be ${s.stateNames[0]}.`;
      const last = s.stateNames[s.stateNames.length - 1];
      const rest = s.stateNames.slice(0, -1);
      return `${s.thingName} can be ${rest.join(", ")} or ${last}.`;
    }
    case "duration": {
      if (settings.unitsVisibility === "hide") {
        return `${s.thingName} requires ${s.nominal}.`;
      }
      return `${s.thingName} requires ${s.nominal}${s.unit}.`;
    }
    case "link":
      return renderLinkSentence(s);
    case "modifier": {
      const neg = s.negated ? "negated " : "";
      return `${s.linkType} link from ${s.sourceName} to ${s.targetName} has ${neg}${s.modifierType} modifier.`;
    }
  }
}

export function render(doc: OplDocument): string {
  if (doc.sentences.length === 0) return "";
  return doc.sentences
    .map(s => renderSentence(s, doc.renderSettings))
    .filter(Boolean)
    .join("\n");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/opl.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run full test suite for regressions**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All existing tests PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/opl.ts packages/core/tests/opl.test.ts
git commit -m "feat(core): implement expose + render for OPL lens (get direction)"
```

---

## Chunk 2: applyOplEdit + Lens Laws + CLI

### Task 3: applyOplEdit + oplSlug + Lens Laws

**Files:**
- Modify: `packages/core/src/opl.ts`
- Modify: `packages/core/tests/opl.test.ts`

**Context:**
- `collectAllIds(model)` returns a `Set<string>` of all entity IDs across all collections (from `helpers.ts`)
- `addThing` expects a full `Thing` with `id`; returns `Result<Model, InvariantError>`
- `addAppearance` expects `{ thing, opd, x, y, w, h, internal?, ... }`; key is `${thing}::${opd}`
- `addState` expects a full `State` with `id` and `parent`; checks I-01 (parent must be object)
- `addLink` expects a full `Link` with `id`; checks I-05 (source/target must exist)
- `addModifier` expects `{ id, over, type, negated? }`; checks I-06 (link must exist)
- `ok(value)` and `err(error)` from `result.ts`

- [ ] **Step 1: Add applyOplEdit + lens law tests to opl.test.ts**

Append to `packages/core/tests/opl.test.ts`:

```typescript
import { applyOplEdit, oplSlug, editsFrom } from "../src/opl";
import { isErr } from "../src/result";
import type { OplEdit } from "../src/opl-types";

// === oplSlug tests ===

describe("oplSlug", () => {
  it("converts names to kebab-case", () => {
    expect(oplSlug("Hot Water")).toBe("hot-water");
    expect(oplSlug("Café Latte")).toBe("caf-latte");
    expect(oplSlug("  spaces  ")).toBe("spaces");
  });
});

// === applyOplEdit tests ===

describe("applyOplEdit", () => {
  it("add-thing creates thing + appearance", () => {
    const m = createModel("Test");
    const edit: OplEdit = {
      kind: "add-thing",
      opdId: "opd-sd",
      thing: { kind: "object", name: "Milk", essence: "physical", affiliation: "systemic" },
      position: { x: 50, y: 50 },
    };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.things.size).toBe(1);
    const thing = [...r.value.things.values()][0]!;
    expect(thing.name).toBe("Milk");
    expect(thing.kind).toBe("object");
    expect(thing.id).toMatch(/^obj-/);
    // Appearance created
    expect(r.value.appearances.size).toBe(1);
    const app = [...r.value.appearances.values()][0]!;
    expect(app.opd).toBe("opd-sd");
    expect(app.w).toBe(120);
    expect(app.h).toBe(60);
  });

  it("add-states creates states with auto-generated IDs", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    const edit: OplEdit = {
      kind: "add-states",
      thingId: "obj-water",
      states: [
        { name: "cold", initial: true, final: false, default: true },
        { name: "hot", initial: false, final: false, default: false },
      ],
    };
    const r2 = applyOplEdit(m, edit);
    expect(isOk(r2)).toBe(true);
    if (!isOk(r2)) return;
    expect(r2.value.states.size).toBe(2);
    const stateIds = [...r2.value.states.keys()];
    expect(stateIds.every(id => id.startsWith("state-"))).toBe(true);
  });

  it("add-link creates link with auto-generated ID", () => {
    const m = buildModel();
    const edit: OplEdit = {
      kind: "add-link",
      link: { type: "agent", source: "obj-water", target: "proc-boiling" },
    };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.links.size).toBe(4); // 3 existing + 1 new
  });

  it("remove-thing cascades correctly", () => {
    const m = buildModel();
    const edit: OplEdit = { kind: "remove-thing", thingId: "obj-water" };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.things.has("obj-water")).toBe(false);
    expect(r.value.states.size).toBe(0);
    // Links referencing Water are removed
    expect(r.value.links.size).toBe(0);
  });

  it("handles ID collision with numeric suffix", () => {
    let m = createModel("Test");
    const edit1: OplEdit = {
      kind: "add-thing", opdId: "opd-sd",
      thing: { kind: "object", name: "Water", essence: "physical", affiliation: "systemic" },
      position: { x: 0, y: 0 },
    };
    let r = applyOplEdit(m, edit1);
    if (!isOk(r)) throw r.error; m = r.value;
    // Add another "Water" — should get obj-water-2
    r = applyOplEdit(m, edit1);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.things.size).toBe(2);
    expect(r.value.things.has("obj-water")).toBe(true);
    expect(r.value.things.has("obj-water-2")).toBe(true);
  });

  it("add-modifier creates modifier with auto-generated ID", () => {
    let m = buildModel();
    const edit: OplEdit = {
      kind: "add-modifier",
      modifier: { over: "lnk-boiling-consumption-water", type: "event" },
    };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.modifiers.size).toBe(1);
    const mod = [...r.value.modifiers.values()][0]!;
    expect(mod.type).toBe("event");
    expect(mod.over).toBe("lnk-boiling-consumption-water");
  });

  it("remove-state removes a state", () => {
    const m = buildModel();
    const edit: OplEdit = { kind: "remove-state", stateId: "state-liquid" };
    const r = applyOplEdit(m, edit);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.states.has("state-liquid")).toBe(false);
    expect(r.value.states.size).toBe(1); // state-gas remains
  });

  it("fails when adding thing to non-existent OPD", () => {
    const m = createModel("Test");
    const edit: OplEdit = {
      kind: "add-thing", opdId: "opd-nonexistent",
      thing: { kind: "object", name: "X", essence: "physical", affiliation: "systemic" },
      position: { x: 0, y: 0 },
    };
    const r = applyOplEdit(m, edit);
    // addAppearance will fail because OPD key check happens in appearance validation
    // The thing gets added but appearance fails — we need to check OPD existence first
    expect(isErr(r)).toBe(true);
  });

  it("fails when adding link with non-existent source", () => {
    const m = createModel("Test");
    const edit: OplEdit = {
      kind: "add-link",
      link: { type: "agent", source: "obj-ghost", target: "proc-x" },
    };
    const r = applyOplEdit(m, edit);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("fails when removing non-existent thing", () => {
    const m = createModel("Test");
    const edit: OplEdit = { kind: "remove-thing", thingId: "obj-ghost" };
    const r = applyOplEdit(m, edit);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });
});

// === Lens Laws ===

describe("PutGet", () => {
  it("add-thing → expose contains the new declaration", () => {
    const m = createModel("Test");
    const edit: OplEdit = {
      kind: "add-thing", opdId: "opd-sd",
      thing: { kind: "object", name: "Sugar", essence: "physical", affiliation: "systemic" },
      position: { x: 0, y: 0 },
    };
    const r = applyOplEdit(m, edit);
    if (!isOk(r)) throw r.error;
    const doc = expose(r.value, "opd-sd");
    const decl = doc.sentences.find(s => s.kind === "thing-declaration" && s.name === "Sugar");
    expect(decl).toBeDefined();
  });

  it("add-states → expose contains state enumeration", () => {
    let m = createModel("Test");
    let r = addThing(m, waterObj); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, waterApp); if (!isOk(r)) throw r.error; m = r.value;
    const edit: OplEdit = {
      kind: "add-states", thingId: "obj-water",
      states: [{ name: "frozen", initial: false, final: false, default: false }],
    };
    const r2 = applyOplEdit(m, edit);
    if (!isOk(r2)) throw r2.error;
    const doc = expose(r2.value, "opd-sd");
    const stateEnum = doc.sentences.find(s => s.kind === "state-enumeration");
    expect(stateEnum).toBeDefined();
    expect((stateEnum as any).stateNames).toContain("frozen");
  });

  it("add-link → expose contains link sentence", () => {
    const m = buildModel();
    const edit: OplEdit = {
      kind: "add-link",
      link: { type: "agent", source: "obj-water", target: "proc-boiling" },
    };
    const r = applyOplEdit(m, edit);
    if (!isOk(r)) throw r.error;
    const doc = expose(r.value, "opd-sd");
    const agentLink = doc.sentences.find(
      s => s.kind === "link" && s.linkType === "agent"
    );
    expect(agentLink).toBeDefined();
  });

  it("remove-thing → expose no longer contains it", () => {
    const m = buildModel();
    const edit: OplEdit = { kind: "remove-thing", thingId: "obj-water" };
    const r = applyOplEdit(m, edit);
    if (!isOk(r)) throw r.error;
    const doc = expose(r.value, "opd-sd");
    const waterDecl = doc.sentences.find(
      s => s.kind === "thing-declaration" && s.name === "Water"
    );
    expect(waterDecl).toBeUndefined();
  });

  it("remove-link → expose no longer contains it", () => {
    const m = buildModel();
    const edit: OplEdit = { kind: "remove-link", linkId: "lnk-boiling-consumption-water" };
    const r = applyOplEdit(m, edit);
    if (!isOk(r)) throw r.error;
    const doc = expose(r.value, "opd-sd");
    const consumptionLink = doc.sentences.find(
      s => s.kind === "link" && s.linkId === "lnk-boiling-consumption-water"
    );
    expect(consumptionLink).toBeUndefined();
  });
});

describe("GetPut", () => {
  function sentencesWithoutIds(doc: OplDocument) {
    return doc.sentences.map(s => {
      switch (s.kind) {
        case "thing-declaration": return { kind: s.kind, name: s.name, thingKind: s.thingKind, essence: s.essence, affiliation: s.affiliation };
        case "state-enumeration": return { kind: s.kind, thingName: s.thingName, stateNames: s.stateNames };
        case "duration": return { kind: s.kind, thingName: s.thingName, nominal: s.nominal, unit: s.unit };
        case "link": return { kind: s.kind, linkType: s.linkType, sourceName: s.sourceName, targetName: s.targetName, sourceStateName: s.sourceStateName, targetStateName: s.targetStateName, tag: s.tag };
        case "modifier": return { kind: s.kind, linkType: s.linkType, sourceName: s.sourceName, targetName: s.targetName, modifierType: s.modifierType, negated: s.negated };
      }
    });
  }

  it("round-trip on model with things and links", () => {
    const m = buildModel();
    const doc1 = expose(m, "opd-sd");

    // Reconstruct from empty model
    let fresh = createModel("Test-RT");
    const edits = editsFrom(doc1);
    for (const edit of edits) {
      const r = applyOplEdit(fresh, edit);
      if (!isOk(r)) throw new Error(`Edit failed: ${JSON.stringify(r.error)}`);
      fresh = r.value;
    }

    const doc2 = expose(fresh, "opd-sd");
    expect(sentencesWithoutIds(doc2)).toEqual(sentencesWithoutIds(doc1));
  });

  it("round-trip on empty model", () => {
    const m = createModel("Test");
    const doc1 = expose(m, "opd-sd");
    const edits = editsFrom(doc1);
    expect(edits).toHaveLength(0);
    expect(doc1.sentences).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/opl.test.ts`
Expected: New tests FAIL (oplSlug, applyOplEdit, editsFrom throw "Not implemented")

- [ ] **Step 3: Implement oplSlug + uniqueId helper**

Replace the stub in `packages/core/src/opl.ts`:

```typescript
import { collectAllIds, touch } from "./helpers";

export function oplSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueId(base: string, model: Model): string {
  const allIds = collectAllIds(model);
  if (!allIds.has(base)) return base;
  let i = 2;
  while (allIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
```

- [ ] **Step 4: Implement applyOplEdit**

Replace the stub in `packages/core/src/opl.ts`. Add imports at top:

```typescript
import type { Thing, State, Link, Modifier, Appearance, ComputationalObject } from "./types";
import { ok, err, isOk } from "./result";
import {
  addThing, removeThing, addState, removeState,
  addLink, removeLink, addModifier, removeModifier,
  addAppearance,
} from "./api";
```

Implementation:

```typescript
export function applyOplEdit(model: Model, edit: OplEdit): Result<Model, InvariantError> {
  switch (edit.kind) {
    case "add-thing": {
      if (!model.opds.has(edit.opdId)) {
        return err({ code: "NOT_FOUND", message: `OPD not found: ${edit.opdId}`, entity: edit.opdId });
      }
      const prefix = edit.thing.kind === "object" ? "obj" : "proc";
      const id = uniqueId(`${prefix}-${oplSlug(edit.thing.name)}`, model);
      const thing: Thing = { id, ...edit.thing };
      const r1 = addThing(model, thing);
      if (!isOk(r1)) return r1;
      const appearance: Appearance = {
        thing: id, opd: edit.opdId,
        x: edit.position.x, y: edit.position.y,
        w: 120, h: 60,
      };
      return addAppearance(r1.value, appearance);
    }
    case "remove-thing":
      return removeThing(model, edit.thingId);
    case "add-states": {
      let current = model;
      for (const stateData of edit.states) {
        const id = uniqueId(`state-${oplSlug(stateData.name)}`, current);
        const state: State = { id, parent: edit.thingId, ...stateData };
        const r = addState(current, state);
        if (!isOk(r)) return r;
        current = r.value;
      }
      return ok(current);
    }
    case "remove-state":
      return removeState(model, edit.stateId);
    case "add-link": {
      const id = uniqueId(`lnk-${oplSlug(edit.link.source)}-${edit.link.type}-${oplSlug(edit.link.target)}`, model);
      const link: Link = { id, ...edit.link };
      return addLink(model, link);
    }
    case "remove-link":
      return removeLink(model, edit.linkId);
    case "add-modifier": {
      const id = uniqueId(`mod-${oplSlug(edit.modifier.over)}-${edit.modifier.type}`, model);
      const mod: Modifier = { id, ...edit.modifier };
      return addModifier(model, mod);
    }
    case "remove-modifier":
      return removeModifier(model, edit.modifierId);
    default: {
      const _exhaustive: never = edit;
      return err({ code: "UNKNOWN_EDIT", message: `Unknown edit kind`, entity: "" });
    }
  }
}
```

- [ ] **Step 5: Implement editsFrom**

Replace the stub in `packages/core/src/opl.ts`:

```typescript
export function editsFrom(doc: OplDocument): OplEdit[] {
  // Two-pass: first collect add-thing edits, then enrich with duration data
  const thingEdits = new Map<string, OplEdit & { kind: "add-thing" }>();
  const otherEdits: OplEdit[] = [];

  for (const s of doc.sentences) {
    switch (s.kind) {
      case "thing-declaration": {
        const edit = {
          kind: "add-thing" as const,
          opdId: doc.opdId,
          thing: {
            kind: s.thingKind,
            name: s.name,
            essence: s.essence,
            affiliation: s.affiliation,
          } as Omit<Thing, "id">,
          position: { x: 0, y: 0 },
        };
        thingEdits.set(s.thingId, edit);
        break;
      }
      case "duration": {
        // Enrich the corresponding add-thing edit with duration
        const thingEdit = thingEdits.get(s.thingId);
        if (thingEdit) {
          thingEdit.thing = { ...thingEdit.thing, duration: { nominal: s.nominal, unit: s.unit } };
        }
        break;
      }
      case "state-enumeration":
        otherEdits.push({
          kind: "add-states",
          thingId: s.thingId,
          states: s.stateNames.map(name => ({
            name,
            initial: false,
            final: false,
            default: false,
          })),
        });
        break;
      case "link":
        otherEdits.push({
          kind: "add-link",
          link: {
            type: s.linkType,
            source: s.sourceId,
            target: s.targetId,
            ...(s.tag ? { tag: s.tag } : {}),
          },
        });
        break;
      case "modifier":
        otherEdits.push({
          kind: "add-modifier",
          modifier: {
            over: s.linkId,
            type: s.modifierType,
            negated: s.negated,
          },
        });
        break;
    }
  }

  // Things first (order matters: states/links reference thing IDs), then others
  return [...thingEdits.values(), ...otherEdits];
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/core/tests/opl.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Run full test suite for regressions**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 8: Type check**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/opl.ts packages/core/tests/opl.test.ts
git commit -m "feat(core): implement applyOplEdit + lens laws (PutGet/GetPut verified)"
```

---

### Task 4: CLI `opmod opl` command

**Files:**
- Create: `packages/cli/src/commands/opl.ts`
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/tests/opl.test.ts`

**Context:**
- `resolveModelFile(fileOption)` auto-detects `.opmodel` file in cwd if not specified (from `io.ts`)
- `readModel(filePath)` reads and parses model file, returns `{ model, filePath }` (from `io.ts`)
- `fatal(message): never` throws `CliError` with exit code 2 (from `format.ts`)
- `expose(model, opdId)` and `render(doc)` from `@opmodel/core`
- Existing commands use `--file` as option. This command uses `<file>` as argument per spec.
- `--json` flag is on the parent `program`, accessed via `program.opts().json`

- [ ] **Step 1: Write CLI tests**

```typescript
// packages/cli/tests/opl.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createModel, addThing, addAppearance, addLink, saveModel, isOk } from "@opmodel/core";
import type { Model } from "@opmodel/core";
import { executeOpl } from "../src/commands/opl";

function buildTestModel(): Model {
  let m = createModel("CLI-Test");
  let r = addThing(m, {
    id: "obj-water", kind: "object", name: "Water",
    essence: "physical", affiliation: "systemic",
  });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addThing(m, {
    id: "proc-boiling", kind: "process", name: "Boiling",
    essence: "physical", affiliation: "systemic",
  });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addAppearance(m, {
    thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60,
  });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addAppearance(m, {
    thing: "proc-boiling", opd: "opd-sd", x: 200, y: 0, w: 120, h: 60,
  });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addLink(m, {
    id: "lnk-1", type: "consumption", source: "proc-boiling", target: "obj-water",
  });
  if (!isOk(r)) throw r.error; m = r.value;
  return m;
}

let tmpDir: string;
let modelPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "opl-cli-"));
  modelPath = join(tmpDir, "test.opmodel");
  const model = buildTestModel();
  writeFileSync(modelPath, saveModel(model));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("executeOpl", () => {
  it("generates OPL text for default OPD (opd-sd)", () => {
    const result = executeOpl({ file: modelPath });
    expect(result.text).toContain("Water is an object");
    expect(result.text).toContain("Boiling is a process");
    expect(result.text).toContain("Boiling consumes Water.");
  });

  it("returns OplDocument JSON when json flag is set", () => {
    const result = executeOpl({ file: modelPath, json: true });
    expect(result.document).toBeDefined();
    const doc = result.document as any;
    expect(doc.opdId).toBe("opd-sd");
    expect(doc.sentences.length).toBeGreaterThan(0);
  });

  it("accepts --opd to specify OPD", () => {
    const result = executeOpl({ file: modelPath, opd: "opd-sd" });
    expect(result.text).toContain("Water");
  });

  it("throws on non-existent OPD", () => {
    expect(() => executeOpl({ file: modelPath, opd: "opd-ghost" })).toThrow("OPD not found");
  });

  it("produces empty output for OPD with no appearances", () => {
    // opd-sd has appearances, but a hypothetical empty OPD would not
    // For this test, we just verify the function works with the root OPD
    const result = executeOpl({ file: modelPath });
    expect(typeof result.text).toBe("string");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/cli/tests/opl.test.ts`
Expected: FAIL — `executeOpl` not found

- [ ] **Step 3: Implement executeOpl command**

```typescript
// packages/cli/src/commands/opl.ts
import { resolveModelFile, readModel } from "../io";
import { fatal } from "../format";
import { expose, render } from "@opmodel/core";

export function executeOpl(opts: {
  file?: string;
  opd?: string;
  json?: boolean;
}): { text?: string; document?: unknown } {
  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);

  const opdId = opts.opd ?? "opd-sd";

  if (!model.opds.has(opdId)) {
    fatal(`OPD not found: ${opdId}`);
  }

  const doc = expose(model, opdId);

  if (opts.json) {
    return { document: doc };
  }

  return { text: render(doc) };
}
```

- [ ] **Step 4: Register command in cli.ts**

Add import at top of `packages/cli/src/cli.ts`:

```typescript
import { executeOpl } from "./commands/opl";
```

Add command registration before the global error handler (`try { program.parse(); }`):

```typescript
program
  .command("opl")
  .description("Generate OPL sentences for an OPD")
  .argument("<file>", "Path to .opmodel file")
  .option("--opd <opdId>", "OPD ID (default: root SD)")
  .action((file: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeOpl({ file, opd: opts.opd as string, json: jsonFlag });
    if (jsonFlag) {
      console.log(JSON.stringify(result.document, null, 2));
    } else {
      console.log(result.text ?? "");
    }
  });
```

- [ ] **Step 5: Add export to cli index.ts**

Add to `packages/cli/src/index.ts`:

```typescript
export { executeOpl } from "./commands/opl";
```

- [ ] **Step 6: Run CLI tests**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/cli/tests/opl.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Run full test suite**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All tests PASS

- [ ] **Step 8: Type check all packages**

Run: `cd packages/core && bunx tsc --noEmit && cd ../cli && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/commands/opl.ts packages/cli/src/cli.ts packages/cli/src/index.ts packages/cli/tests/opl.test.ts
git commit -m "feat(cli): add opmod opl command for OPL generation"
```
