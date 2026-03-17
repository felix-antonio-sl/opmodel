# NL → OPL Parser Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@opmodel/nl` package that converts natural language to OplEdit[] via LLM, with web editor integration.

**Architecture:** Three-phase pipeline: LLM generates `NlEditDescriptor[]` (name-space), `resolve` maps to `OplEdit[]` (ID-space), `applyOplEdit` applies to Model. New package `@opmodel/nl` with fetch-based LLM providers. Web integration extends existing OplEditorView with NL textarea above structured form.

**Tech Stack:** TypeScript, Bun workspaces, `@opmodel/core` types, native `fetch` for LLM APIs, React 19, Vitest

---

## Chunk 1: Package scaffolding + types + parse

### Task 1: Package scaffolding and types

**Files:**
- Create: `packages/nl/package.json`
- Create: `packages/nl/tsconfig.json`
- Create: `packages/nl/src/types.ts`
- Create: `packages/nl/src/index.ts`
- Verify: `package.json` (root — uses `"packages/*"` glob, so `packages/nl` is already covered; no modification needed)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@opmodel/nl",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@opmodel/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Create types.ts**

```typescript
import type {
  Model, OplEdit, Essence, Affiliation, LinkType, ModifierType,
} from "@opmodel/core";

// --- NlEditDescriptor: OplEdit in name-space ---

export type NlEditDescriptor =
  | { kind: "add-thing"; name: string; thingKind: "object" | "process";
      essence?: Essence; affiliation?: Affiliation }
  | { kind: "remove-thing"; name: string }
  | { kind: "add-states"; thingName: string; stateNames: string[] }
  | { kind: "remove-state"; thingName: string; stateName: string }
  | { kind: "add-link"; sourceName: string; targetName: string;
      linkType: LinkType; sourceState?: string; targetState?: string }
  | { kind: "remove-link"; sourceName: string; targetName: string;
      linkType: LinkType }
  | { kind: "add-modifier"; sourceName: string; targetName: string;
      linkType: LinkType; modifierType: ModifierType; negated?: boolean }
  | { kind: "remove-modifier"; sourceName: string; targetName: string;
      linkType: LinkType; modifierType: ModifierType };

// --- LLM Provider ---

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
}

// --- Pipeline ---

export interface NlContext {
  model: Model;
  opdId: string;
}

export interface NlResult {
  edits: OplEdit[];
  descriptors: NlEditDescriptor[];
  preview: string;
}

export interface NlPipeline {
  generate(nl: string, context: NlContext): Promise<NlResult>;
}

export interface NlConfig {
  provider: "claude" | "openai";
  apiKey: string;
  model?: string;
}

// --- Errors ---

export interface ParseError {
  raw: string;
  message: string;
  index?: number;
}

export interface ResolveError {
  descriptor: NlEditDescriptor;
  message: string;
  index: number;
}
```

- [ ] **Step 4: Create index.ts with type-only exports (source module exports added in Task 5 Step 6)**

```typescript
// Type-only re-exports (source module exports added after all modules exist)
export type {
  NlEditDescriptor, LLMMessage, LLMOptions, LLMProvider,
  NlContext, NlResult, NlPipeline, NlConfig,
  ParseError, ResolveError,
} from "./types";
```

Note: Source module exports (`parse`, `resolve`, `prompt`, `provider`, `pipeline`) are deferred to Task 5 Step 6 so that every commit compiles cleanly.

- [ ] **Step 5: Install dependencies**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bun install`
Expected: Resolves workspace dependencies, links `@opmodel/nl`

- [ ] **Step 6: Verify types compile**

Run: `cd packages/nl && bunx tsc --noEmit src/types.ts`
Expected: Clean (no errors). The index.ts will fail until other files exist — that's fine.

- [ ] **Step 7: Commit**

```bash
git add packages/nl/package.json packages/nl/tsconfig.json packages/nl/src/types.ts packages/nl/src/index.ts
git commit -m "feat(nl): scaffold @opmodel/nl package with types"
```

---

### Task 2: parse.ts — JSON extraction and validation (TDD)

**Files:**
- Create: `packages/nl/tests/parse.test.ts`
- Create: `packages/nl/src/parse.ts`

**Context:** `parse` takes a raw LLM response string (which may contain markdown fences or surrounding prose) and extracts/validates `NlEditDescriptor[]`. It uses the `Result` monad from `@opmodel/core`.

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, test, expect } from "vitest";
import { parse } from "../src/parse";

describe("parse", () => {
  // --- Valid inputs ---

  test("parses single add-thing descriptor", () => {
    const raw = '[{"kind":"add-thing","name":"Water","thingKind":"object"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      kind: "add-thing", name: "Water", thingKind: "object",
      essence: "informatical", affiliation: "systemic",
    });
  });

  test("parses multiple descriptors", () => {
    const raw = JSON.stringify([
      { kind: "add-thing", name: "Water", thingKind: "object" },
      { kind: "add-states", thingName: "Water", stateNames: ["cold", "hot"] },
      { kind: "add-thing", name: "Boiling", thingKind: "process" },
      { kind: "add-link", sourceName: "Boiling", targetName: "Water", linkType: "consumption" },
    ]);
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(4);
  });

  test("applies default essence and affiliation for add-thing", () => {
    const raw = '[{"kind":"add-thing","name":"X","thingKind":"process"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const desc = result.value[0] as Extract<typeof result.value[number], { kind: "add-thing" }>;
    expect(desc.essence).toBe("informatical");
    expect(desc.affiliation).toBe("systemic");
  });

  test("preserves explicit essence and affiliation", () => {
    const raw = '[{"kind":"add-thing","name":"X","thingKind":"object","essence":"physical","affiliation":"environmental"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const desc = result.value[0] as Extract<typeof result.value[number], { kind: "add-thing" }>;
    expect(desc.essence).toBe("physical");
    expect(desc.affiliation).toBe("environmental");
  });

  test("applies default negated=false for add-modifier", () => {
    const raw = '[{"kind":"add-modifier","sourceName":"A","targetName":"B","linkType":"agent","modifierType":"event"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const desc = result.value[0] as Extract<typeof result.value[number], { kind: "add-modifier" }>;
    expect(desc.negated).toBe(false);
  });

  test("trims whitespace from names", () => {
    const raw = '[{"kind":"add-thing","name":"  Water  ","thingKind":"object"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value[0] as any).name).toBe("Water");
  });

  // --- JSON extraction ---

  test("extracts JSON from markdown code block", () => {
    const raw = 'Here are the edits:\n```json\n[{"kind":"add-thing","name":"Water","thingKind":"object"}]\n```\nThese will add Water.';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });

  test("extracts JSON from bare code block", () => {
    const raw = '```\n[{"kind":"add-thing","name":"Water","thingKind":"object"}]\n```';
    const result = parse(raw);
    expect(result.ok).toBe(true);
  });

  test("extracts first JSON array from prose", () => {
    const raw = 'Sure! Here you go: [{"kind":"remove-thing","name":"Water"}] Hope that helps!';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });

  // --- Error cases ---

  test("rejects non-JSON input", () => {
    const result = parse("this is not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("JSON");
  });

  test("rejects non-array JSON", () => {
    const result = parse('{"kind":"add-thing","name":"X"}');
    expect(result.ok).toBe(false);
  });

  test("rejects unknown kind", () => {
    const result = parse('[{"kind":"add-widget","name":"X"}]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("kind");
  });

  test("rejects add-thing missing name", () => {
    const result = parse('[{"kind":"add-thing","thingKind":"object"}]');
    expect(result.ok).toBe(false);
  });

  test("rejects add-thing missing thingKind", () => {
    const result = parse('[{"kind":"add-thing","name":"Water"}]');
    expect(result.ok).toBe(false);
  });

  test("rejects add-link with invalid linkType", () => {
    const result = parse('[{"kind":"add-link","sourceName":"A","targetName":"B","linkType":"banana"}]');
    expect(result.ok).toBe(false);
  });

  test("rejects add-thing with invalid essence", () => {
    const result = parse('[{"kind":"add-thing","name":"X","thingKind":"object","essence":"banana"}]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("essence");
  });

  test("rejects add-thing with invalid affiliation", () => {
    const result = parse('[{"kind":"add-thing","name":"X","thingKind":"object","affiliation":"banana"}]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("affiliation");
  });

  test("rejects add-states with non-string stateNames elements", () => {
    const result = parse('[{"kind":"add-states","thingName":"Water","stateNames":[123, true]}]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("stateNames");
  });

  test("rejects empty array gracefully", () => {
    const result = parse("[]");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  // --- All 8 kinds parse correctly ---

  test("parses remove-thing", () => {
    const result = parse('[{"kind":"remove-thing","name":"Water"}]');
    expect(result.ok).toBe(true);
  });

  test("parses add-states", () => {
    const result = parse('[{"kind":"add-states","thingName":"Water","stateNames":["cold","hot"]}]');
    expect(result.ok).toBe(true);
  });

  test("parses remove-state", () => {
    const result = parse('[{"kind":"remove-state","thingName":"Water","stateName":"cold"}]');
    expect(result.ok).toBe(true);
  });

  test("parses add-link with optional states", () => {
    const result = parse('[{"kind":"add-link","sourceName":"Boiling","targetName":"Water","linkType":"effect","sourceState":"active","targetState":"hot"}]');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const desc = result.value[0] as Extract<typeof result.value[number], { kind: "add-link" }>;
    expect(desc.sourceState).toBe("active");
    expect(desc.targetState).toBe("hot");
  });

  test("parses remove-link", () => {
    const result = parse('[{"kind":"remove-link","sourceName":"A","targetName":"B","linkType":"agent"}]');
    expect(result.ok).toBe(true);
  });

  test("parses remove-modifier", () => {
    const result = parse('[{"kind":"remove-modifier","sourceName":"A","targetName":"B","linkType":"agent","modifierType":"event"}]');
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/nl/tests/parse.test.ts`
Expected: FAIL — cannot find module `../src/parse`

- [ ] **Step 3: Implement parse.ts**

```typescript
import { ok, err, type Result } from "@opmodel/core";
import type { NlEditDescriptor, ParseError } from "./types";

const VALID_KINDS = [
  "add-thing", "remove-thing", "add-states", "remove-state",
  "add-link", "remove-link", "add-modifier", "remove-modifier",
] as const;

const VALID_LINK_TYPES = [
  "agent", "instrument", "effect", "consumption", "result",
  "input", "output", "aggregation", "exhibition",
  "generalization", "classification", "tagged", "invocation", "exception",
];

const VALID_MODIFIER_TYPES = ["event", "condition"];
const VALID_ESSENCES = ["physical", "informatical"];
const VALID_AFFILIATIONS = ["systemic", "environmental"];

function extractJson(raw: string): string {
  // Try markdown fenced block first
  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Try bare JSON array
  const array = raw.match(/\[[\s\S]*\]/);
  if (array) return array[0];
  return raw.trim();
}

function validateDescriptor(item: unknown, index: number): Result<NlEditDescriptor, ParseError> {
  if (typeof item !== "object" || item === null || !("kind" in item)) {
    return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: missing kind`, index });
  }

  const obj = item as Record<string, unknown>;
  const kind = obj.kind as string;

  if (!VALID_KINDS.includes(kind as any)) {
    return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: unknown kind "${kind}"`, index });
  }

  const trimStr = (v: unknown): string | undefined =>
    typeof v === "string" ? v.trim() : undefined;

  switch (kind) {
    case "add-thing": {
      const name = trimStr(obj.name);
      const thingKind = obj.thingKind;
      if (!name) return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-thing requires name`, index });
      if (thingKind !== "object" && thingKind !== "process")
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-thing requires thingKind "object" or "process"`, index });
      const essence = obj.essence ?? "informatical";
      if (!VALID_ESSENCES.includes(essence as string))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-thing invalid essence "${essence}"`, index });
      const affiliation = obj.affiliation ?? "systemic";
      if (!VALID_AFFILIATIONS.includes(affiliation as string))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-thing invalid affiliation "${affiliation}"`, index });
      return ok({
        kind: "add-thing" as const,
        name,
        thingKind,
        essence: essence as any,
        affiliation: affiliation as any,
      });
    }
    case "remove-thing": {
      const name = trimStr(obj.name);
      if (!name) return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-thing requires name`, index });
      return ok({ kind: "remove-thing" as const, name });
    }
    case "add-states": {
      const thingName = trimStr(obj.thingName);
      if (!thingName) return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-states requires thingName`, index });
      if (!Array.isArray(obj.stateNames) || obj.stateNames.length === 0)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-states requires non-empty stateNames array`, index });
      if (!obj.stateNames.every((s: unknown) => typeof s === "string"))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-states stateNames must all be strings`, index });
      const stateNames = obj.stateNames.map((s: string) => s.trim());
      return ok({ kind: "add-states" as const, thingName, stateNames });
    }
    case "remove-state": {
      const thingName = trimStr(obj.thingName);
      const stateName = trimStr(obj.stateName);
      if (!thingName || !stateName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-state requires thingName and stateName`, index });
      return ok({ kind: "remove-state" as const, thingName, stateName });
    }
    case "add-link": {
      const sourceName = trimStr(obj.sourceName);
      const targetName = trimStr(obj.targetName);
      const linkType = obj.linkType as string;
      if (!sourceName || !targetName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-link requires sourceName and targetName`, index });
      if (!VALID_LINK_TYPES.includes(linkType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-link invalid linkType "${linkType}"`, index });
      const desc: NlEditDescriptor = { kind: "add-link", sourceName, targetName, linkType: linkType as any };
      const sourceState = trimStr(obj.sourceState);
      const targetState = trimStr(obj.targetState);
      if (sourceState) (desc as any).sourceState = sourceState;
      if (targetState) (desc as any).targetState = targetState;
      return ok(desc);
    }
    case "remove-link": {
      const sourceName = trimStr(obj.sourceName);
      const targetName = trimStr(obj.targetName);
      const linkType = obj.linkType as string;
      if (!sourceName || !targetName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-link requires sourceName and targetName`, index });
      if (!VALID_LINK_TYPES.includes(linkType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-link invalid linkType "${linkType}"`, index });
      return ok({ kind: "remove-link" as const, sourceName, targetName, linkType: linkType as any });
    }
    case "add-modifier": {
      const sourceName = trimStr(obj.sourceName);
      const targetName = trimStr(obj.targetName);
      const linkType = obj.linkType as string;
      const modifierType = obj.modifierType as string;
      if (!sourceName || !targetName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-modifier requires sourceName and targetName`, index });
      if (!VALID_LINK_TYPES.includes(linkType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-modifier invalid linkType`, index });
      if (!VALID_MODIFIER_TYPES.includes(modifierType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-modifier invalid modifierType "${modifierType}"`, index });
      return ok({
        kind: "add-modifier" as const, sourceName, targetName,
        linkType: linkType as any, modifierType: modifierType as any,
        negated: obj.negated === true,
      });
    }
    case "remove-modifier": {
      const sourceName = trimStr(obj.sourceName);
      const targetName = trimStr(obj.targetName);
      const linkType = obj.linkType as string;
      const modifierType = obj.modifierType as string;
      if (!sourceName || !targetName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-modifier requires sourceName and targetName`, index });
      if (!VALID_LINK_TYPES.includes(linkType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-modifier invalid linkType`, index });
      if (!VALID_MODIFIER_TYPES.includes(modifierType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-modifier invalid modifierType`, index });
      return ok({
        kind: "remove-modifier" as const, sourceName, targetName,
        linkType: linkType as any, modifierType: modifierType as any,
      });
    }
    default:
      return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: unknown kind`, index });
  }
}

export function parse(raw: string): Result<NlEditDescriptor[], ParseError> {
  const jsonStr = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return err({ raw, message: "Failed to extract valid JSON from response" });
  }

  if (!Array.isArray(parsed)) {
    return err({ raw, message: "Expected JSON array of descriptors" });
  }

  const descriptors: NlEditDescriptor[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const result = validateDescriptor(parsed[i], i);
    if (!result.ok) return result;
    descriptors.push(result.value);
  }

  return ok(descriptors);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/nl/tests/parse.test.ts`
Expected: All 25 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/nl/src/parse.ts packages/nl/tests/parse.test.ts
git commit -m "feat(nl): add parse module with JSON extraction and validation (TDD)"
```

---

## Chunk 2: resolve + prompt + provider + pipeline

### Task 3: resolve.ts — Name-space to ID-space resolution (TDD)

**Files:**
- Create: `packages/nl/tests/resolve.test.ts`
- Create: `packages/nl/src/resolve.ts`

**Context:** `resolve` maps `NlEditDescriptor[]` to `OplEdit[]` using the current Model for name→ID lookup. It folds sequentially, applying each edit to an accumulated model so that later descriptors can reference entities created by earlier ones. The `Thing` type uses field `kind` (not `thingKind` as in NlEditDescriptor) — resolveOne must handle this mapping.

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, test, expect } from "vitest";
import { resolve } from "../src/resolve";
import { createModel, addThing, addOPD, addAppearance, addState, addLink, addModifier } from "@opmodel/core";
import type { Model } from "@opmodel/core";

// Helper: build a test model with Water (object, states cold/hot), Boiling (process), consumption link
function buildTestModel(): { model: Model; opdId: string } {
  let m = createModel("test");
  const opdId = "opd-main";

  let r = addOPD(m, { id: opdId, name: "Main", parentId: null });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addAppearance(m, { thing: "obj-water", opd: opdId, x: 50, y: 50, w: 120, h: 60 });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addThing(m, { id: "proc-boiling", kind: "process", name: "Boiling", essence: "physical", affiliation: "systemic" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addAppearance(m, { thing: "proc-boiling", opd: opdId, x: 200, y: 50, w: 120, h: 60 });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addState(m, { id: "state-cold", parent: "obj-water", name: "cold" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addState(m, { id: "state-hot", parent: "obj-water", name: "hot" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addLink(m, { id: "lnk-consumption", type: "consumption", source: "proc-boiling", target: "obj-water" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addModifier(m, { id: "mod-event", over: "lnk-consumption", type: "event" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  return { model: m, opdId };
}

describe("resolve", () => {
  const { model, opdId } = buildTestModel();

  // --- add-thing (no resolution needed) ---

  test("resolves add-thing with defaults", () => {
    const result = resolve(
      [{ kind: "add-thing", name: "Steam", thingKind: "object" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    const edit = result.value[0];
    expect(edit.kind).toBe("add-thing");
    if (edit.kind !== "add-thing") return;
    expect(edit.thing.name).toBe("Steam");
    expect(edit.thing.kind).toBe("object"); // mapped from thingKind
    expect(edit.thing.essence).toBe("informatical"); // default
    expect(edit.position.x).toBe(100); // first thing at x=100
  });

  test("increments position for multiple add-thing", () => {
    const result = resolve([
      { kind: "add-thing", name: "A", thingKind: "object" },
      { kind: "add-thing", name: "B", thingKind: "process" },
    ], model, opdId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const e1 = result.value[0] as Extract<typeof result.value[0], { kind: "add-thing" }>;
    const e2 = result.value[1] as Extract<typeof result.value[1], { kind: "add-thing" }>;
    expect(e1.position.x).toBe(100);
    expect(e2.position.x).toBe(250); // 100 + 1*150
  });

  // --- remove-thing (name resolution) ---

  test("resolves remove-thing by name", () => {
    const result = resolve(
      [{ kind: "remove-thing", name: "Water" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ kind: "remove-thing", thingId: "obj-water" });
  });

  test("resolves case-insensitively", () => {
    const result = resolve(
      [{ kind: "remove-thing", name: "water" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
  });

  test("fails on unknown thing name", () => {
    const result = resolve(
      [{ kind: "remove-thing", name: "NonExistent" }],
      model, opdId,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("not found");
    expect(result.error.index).toBe(0);
  });

  // --- add-states ---

  test("resolves add-states by thing name", () => {
    const result = resolve(
      [{ kind: "add-states", thingName: "Water", stateNames: ["boiling", "frozen"] }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edit = result.value[0];
    expect(edit.kind).toBe("add-states");
    if (edit.kind !== "add-states") return;
    expect(edit.thingId).toBe("obj-water");
    expect(edit.states).toHaveLength(2);
  });

  // --- remove-state ---

  test("resolves remove-state by thing and state name", () => {
    const result = resolve(
      [{ kind: "remove-state", thingName: "Water", stateName: "cold" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ kind: "remove-state", stateId: "state-cold" });
  });

  // --- add-link ---

  test("resolves add-link by endpoint names", () => {
    const result = resolve(
      [{ kind: "add-link", sourceName: "Boiling", targetName: "Water", linkType: "effect" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edit = result.value[0];
    expect(edit.kind).toBe("add-link");
    if (edit.kind !== "add-link") return;
    expect(edit.link.source).toBe("proc-boiling");
    expect(edit.link.target).toBe("obj-water");
    expect(edit.link.type).toBe("effect");
  });

  test("resolves add-link with state names scoped to endpoints", () => {
    const result = resolve(
      [{
        kind: "add-link", sourceName: "Boiling", targetName: "Water",
        linkType: "effect", targetState: "hot",
      }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edit = result.value[0] as Extract<typeof result.value[0], { kind: "add-link" }>;
    expect(edit.link.target_state).toBe("state-hot");
  });

  // --- remove-link ---

  test("resolves remove-link by endpoint names and type", () => {
    const result = resolve(
      [{ kind: "remove-link", sourceName: "Boiling", targetName: "Water", linkType: "consumption" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ kind: "remove-link", linkId: "lnk-consumption" });
  });

  test("fails remove-link when no matching link", () => {
    const result = resolve(
      [{ kind: "remove-link", sourceName: "Boiling", targetName: "Water", linkType: "agent" }],
      model, opdId,
    );
    expect(result.ok).toBe(false);
  });

  // --- add-modifier ---

  test("resolves add-modifier by link endpoint names", () => {
    const result = resolve(
      [{ kind: "add-modifier", sourceName: "Boiling", targetName: "Water", linkType: "consumption", modifierType: "condition" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edit = result.value[0];
    expect(edit.kind).toBe("add-modifier");
    if (edit.kind !== "add-modifier") return;
    expect(edit.modifier.over).toBe("lnk-consumption");
  });

  // --- remove-modifier ---

  test("resolves remove-modifier", () => {
    const result = resolve(
      [{ kind: "remove-modifier", sourceName: "Boiling", targetName: "Water", linkType: "consumption", modifierType: "event" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ kind: "remove-modifier", modifierId: "mod-event" });
  });

  // --- Batch mode (accumulated model) ---

  test("batch: thing created in edit 1 available in edit 2", () => {
    const result = resolve([
      { kind: "add-thing", name: "Steam", thingKind: "object" },
      { kind: "add-link", sourceName: "Boiling", targetName: "Steam", linkType: "result" },
    ], model, opdId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[1].kind).toBe("add-link");
  });

  test("batch: states added in edit 1 available for link in edit 2", () => {
    const result = resolve([
      { kind: "add-states", thingName: "Water", stateNames: ["boiling"] },
      { kind: "add-link", sourceName: "Boiling", targetName: "Water", linkType: "effect", targetState: "boiling" },
    ], model, opdId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const linkEdit = result.value[1] as Extract<typeof result.value[1], { kind: "add-link" }>;
    expect(linkEdit.link.target_state).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/nl/tests/resolve.test.ts`
Expected: FAIL — cannot find module `../src/resolve`

- [ ] **Step 3: Implement resolve.ts**

```typescript
import { ok, err, type Result, type Model, type OplEdit, applyOplEdit } from "@opmodel/core";
import type { NlEditDescriptor, ResolveError } from "./types";

// O(n) linear scan — acceptable for typical model sizes (<500 things)
function findThingByName(model: Model, name: string) {
  const lower = name.toLowerCase();
  return [...model.things.values()].find(t => t.name.toLowerCase() === lower);
}

function findStateByName(model: Model, parentId: string, stateName: string) {
  const lower = stateName.toLowerCase();
  return [...model.states.values()].find(
    s => s.parent === parentId && s.name.toLowerCase() === lower,
  );
}

function findLinkByEndpoints(model: Model, sourceId: string, targetId: string, linkType: string) {
  return [...model.links.values()].find(
    l => l.source === sourceId && l.target === targetId && l.type === linkType,
  );
}

function findModifier(model: Model, linkId: string, modifierType: string) {
  return [...model.modifiers.values()].find(
    m => m.over === linkId && m.type === modifierType,
  );
}

function resolveOne(
  desc: NlEditDescriptor,
  model: Model,
  opdId: string,
  addThingCount: number,
): Result<OplEdit, Omit<ResolveError, "index">> {
  const mkErr = (message: string) => err({ descriptor: desc, message, index: -1 });

  switch (desc.kind) {
    case "add-thing":
      return ok({
        kind: "add-thing",
        opdId,
        thing: {
          name: desc.name,
          kind: desc.thingKind,                   // thingKind → kind mapping
          essence: desc.essence ?? "informatical",
          affiliation: desc.affiliation ?? "systemic",
        },
        position: { x: 100 + addThingCount * 150, y: 100 },
      });

    case "remove-thing": {
      const thing = findThingByName(model, desc.name);
      if (!thing) return mkErr(`Thing not found: "${desc.name}"`);
      return ok({ kind: "remove-thing", thingId: thing.id });
    }

    case "add-states": {
      const thing = findThingByName(model, desc.thingName);
      if (!thing) return mkErr(`Thing not found: "${desc.thingName}"`);
      return ok({
        kind: "add-states",
        thingId: thing.id,
        states: desc.stateNames.map(name => ({
          name, initial: false, final: false, default: false,
        })),
      });
    }

    case "remove-state": {
      const thing = findThingByName(model, desc.thingName);
      if (!thing) return mkErr(`Thing not found: "${desc.thingName}"`);
      const state = findStateByName(model, thing.id, desc.stateName);
      if (!state) return mkErr(`State "${desc.stateName}" not found on thing "${desc.thingName}"`);
      return ok({ kind: "remove-state", stateId: state.id });
    }

    case "add-link": {
      const source = findThingByName(model, desc.sourceName);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const link: Record<string, unknown> = {
        source: source.id,
        target: target.id,
        type: desc.linkType,
      };
      if (desc.sourceState) {
        const s = findStateByName(model, source.id, desc.sourceState);
        if (!s) return mkErr(`Source state "${desc.sourceState}" not found on "${desc.sourceName}"`);
        link.source_state = s.id;
      }
      if (desc.targetState) {
        const s = findStateByName(model, target.id, desc.targetState);
        if (!s) return mkErr(`Target state "${desc.targetState}" not found on "${desc.targetName}"`);
        link.target_state = s.id;
      }
      return ok({ kind: "add-link", link: link as any });
    }

    case "remove-link": {
      const source = findThingByName(model, desc.sourceName);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const link = findLinkByEndpoints(model, source.id, target.id, desc.linkType);
      if (!link) return mkErr(`Link not found: ${desc.sourceName} → ${desc.targetName} (${desc.linkType})`);
      return ok({ kind: "remove-link", linkId: link.id });
    }

    case "add-modifier": {
      const source = findThingByName(model, desc.sourceName);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const link = findLinkByEndpoints(model, source.id, target.id, desc.linkType);
      if (!link) return mkErr(`Link not found: ${desc.sourceName} → ${desc.targetName} (${desc.linkType})`);
      return ok({
        kind: "add-modifier",
        modifier: { over: link.id, type: desc.modifierType, negated: desc.negated ?? false },
      });
    }

    case "remove-modifier": {
      const source = findThingByName(model, desc.sourceName);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const link = findLinkByEndpoints(model, source.id, target.id, desc.linkType);
      if (!link) return mkErr(`Link not found: ${desc.sourceName} → ${desc.targetName} (${desc.linkType})`);
      const mod = findModifier(model, link.id, desc.modifierType);
      if (!mod) return mkErr(`Modifier not found: ${desc.modifierType} on ${desc.sourceName} → ${desc.targetName}`);
      return ok({ kind: "remove-modifier", modifierId: mod.id });
    }
  }
}

export function resolve(
  descriptors: NlEditDescriptor[],
  model: Model,
  opdId: string,
): Result<OplEdit[], ResolveError> {
  const edits: OplEdit[] = [];
  let current = model;
  let addThingCount = 0;

  for (let i = 0; i < descriptors.length; i++) {
    const desc = descriptors[i];

    const editResult = resolveOne(desc, current, opdId, addThingCount);
    if (desc.kind === "add-thing") addThingCount++;
    if (!editResult.ok) return err({ ...editResult.error, index: i });

    const edit = editResult.value;
    edits.push(edit);

    const nextModel = applyOplEdit(current, edit);
    if (!nextModel.ok) return err({
      descriptor: desc, index: i,
      message: `Edit application failed: ${nextModel.error.code}`,
    });
    current = nextModel.value;
  }

  return ok(edits);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/nl/tests/resolve.test.ts`
Expected: All 17 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/nl/src/resolve.ts packages/nl/tests/resolve.test.ts
git commit -m "feat(nl): add resolve module with name→ID resolution and accumulated model fold (TDD)"
```

---

### Task 4: prompt.ts — System prompt and context builders (TDD)

**Files:**
- Create: `packages/nl/tests/prompt.test.ts`
- Create: `packages/nl/src/prompt.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, test, expect } from "vitest";
import { buildSystemPrompt, buildContextMessage, buildUserMessage } from "../src/prompt";
import { createModel, addThing, addOPD, addAppearance, addState } from "@opmodel/core";
import type { Model } from "@opmodel/core";

function buildTestModel(): { model: Model; opdId: string } {
  let m = createModel("test");
  const opdId = "opd-main";
  let r = addOPD(m, { id: opdId, name: "Main", parentId: null });
  m = r.ok ? r.value : m;
  r = addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" });
  m = r.ok ? r.value : m;
  r = addAppearance(m, { thing: "obj-water", opd: opdId, x: 50, y: 50, w: 120, h: 60 });
  m = r.ok ? r.value : m;
  r = addState(m, { id: "s1", parent: "obj-water", name: "cold" });
  m = r.ok ? r.value : m;
  r = addState(m, { id: "s2", parent: "obj-water", name: "hot" });
  m = r.ok ? r.value : m;
  return { model: m, opdId };
}

describe("prompt", () => {
  test("buildSystemPrompt contains all 8 edit kinds", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("add-thing");
    expect(prompt).toContain("remove-thing");
    expect(prompt).toContain("add-states");
    expect(prompt).toContain("remove-state");
    expect(prompt).toContain("add-link");
    expect(prompt).toContain("remove-link");
    expect(prompt).toContain("add-modifier");
    expect(prompt).toContain("remove-modifier");
  });

  test("buildSystemPrompt mentions JSON array format", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("JSON array");
  });

  test("buildContextMessage includes existing things", () => {
    const { model, opdId } = buildTestModel();
    const ctx = buildContextMessage(model, opdId);
    expect(ctx).toContain("Water");
    expect(ctx).toContain("object");
  });

  test("buildContextMessage includes states", () => {
    const { model, opdId } = buildTestModel();
    const ctx = buildContextMessage(model, opdId);
    expect(ctx).toContain("cold");
    expect(ctx).toContain("hot");
  });

  test("buildContextMessage handles empty model", () => {
    const m = createModel("empty");
    let r = addOPD(m, { id: "opd-x", name: "X", parentId: null });
    const model = r.ok ? r.value : m;
    const ctx = buildContextMessage(model, "opd-x");
    expect(ctx).toContain("(none)");
  });

  test("buildUserMessage wraps user input", () => {
    const msg = buildUserMessage("Add a Water object");
    expect(msg).toContain("Add a Water object");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/nl/tests/prompt.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement prompt.ts**

```typescript
import type { Model } from "@opmodel/core";
import { expose, render } from "@opmodel/core";

const SCHEMA_DESCRIPTION = `
1. Add a thing:
   {"kind":"add-thing","name":"...","thingKind":"object"|"process","essence":"informatical"|"physical","affiliation":"systemic"|"environmental"}
   - essence and affiliation are optional (default: informatical, systemic)

2. Remove a thing:
   {"kind":"remove-thing","name":"..."}

3. Add states to a thing:
   {"kind":"add-states","thingName":"...","stateNames":["state1","state2",...]}

4. Remove a state:
   {"kind":"remove-state","thingName":"...","stateName":"..."}

5. Add a link:
   {"kind":"add-link","sourceName":"...","targetName":"...","linkType":"agent"|"instrument"|"effect"|"consumption"|"result"|"input"|"output"|"aggregation"|"exhibition"|"generalization"|"classification"|"tagged"|"invocation"|"exception","sourceState":"...","targetState":"..."}
   - sourceState and targetState are optional (for state-specified links)

6. Remove a link:
   {"kind":"remove-link","sourceName":"...","targetName":"...","linkType":"..."}

7. Add a modifier:
   {"kind":"add-modifier","sourceName":"...","targetName":"...","linkType":"...","modifierType":"event"|"condition","negated":false}
   - negated is optional (default: false)

8. Remove a modifier:
   {"kind":"remove-modifier","sourceName":"...","targetName":"...","linkType":"...","modifierType":"event"|"condition"}
`;

export function buildSystemPrompt(): string {
  return `You are an OPM (Object Process Methodology, ISO 19450) modeling assistant.
Your task: convert natural language descriptions into structured JSON edits.

You MUST respond with a JSON array of edit descriptors. Nothing else — no explanation, no markdown.

Each descriptor is one of these 8 kinds:
${SCHEMA_DESCRIPTION}
Rules:
- Use the EXACT names of existing things when referencing them.
- For new things, choose clear descriptive names in the user's language.
- Default essence: "informatical", default affiliation: "systemic".
- Links require both source and target to exist or be created earlier in the array.
- Order matters: create things BEFORE referencing them in links or states.
- Preserve the user's language for entity names (do not translate names).
- Respond ONLY with the JSON array. No prose, no markdown fences.`;
}

export function buildContextMessage(model: Model, opdId: string): string {
  const doc = expose(model, opdId);
  const text = render(doc);

  // Filter things by OPD fiber: only things with an appearance in this OPD
  const visibleThingIds = new Set(
    [...model.appearances.values()]
      .filter(a => a.opd === opdId)
      .map(a => a.thing),
  );
  const things = [...model.things.values()].filter(t => visibleThingIds.has(t.id));
  const thingList = things.length > 0
    ? things.map(t => `- ${t.name} (${t.kind}, ${t.essence}, ${t.affiliation})`).join("\n")
    : "(none)";

  // States scoped to visible things only
  const statesByThing = new Map<string, string[]>();
  for (const s of model.states.values()) {
    if (!visibleThingIds.has(s.parent)) continue;
    const parent = model.things.get(s.parent);
    if (parent) {
      const list = statesByThing.get(parent.name) ?? [];
      list.push(s.name);
      statesByThing.set(parent.name, list);
    }
  }
  const stateList = statesByThing.size > 0
    ? [...statesByThing.entries()].map(([thing, names]) => `- ${thing}: ${names.join(", ")}`).join("\n")
    : "(none)";

  return `Current model (OPD: "${doc.opdName}"):

Things:
${thingList}

States:
${stateList}

Current OPL:
${text || "(empty model)"}

Generate edits that integrate with the existing model. Reuse existing thing names when the user refers to them.`;
}

export function buildUserMessage(nl: string): string {
  return `User request:\n${nl}\n\nGenerate the JSON array of edit descriptors.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/nl/tests/prompt.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/nl/src/prompt.ts packages/nl/tests/prompt.test.ts
git commit -m "feat(nl): add prompt module with system prompt, context builder, and schema description (TDD)"
```

---

### Task 5: provider.ts + pipeline.ts (TDD)

**Files:**
- Create: `packages/nl/src/provider.ts`
- Create: `packages/nl/src/pipeline.ts`
- Create: `packages/nl/tests/pipeline.test.ts`

- [ ] **Step 1: Implement provider.ts**

```typescript
import type { LLMProvider, LLMMessage, LLMOptions, NlConfig } from "./types";

export class ClaudeProvider implements LLMProvider {
  constructor(private apiKey: string, private model = "claude-sonnet-4-20250514") {}

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const systemMsg = messages.find(m => m.role === "system");
    const nonSystem = messages.filter(m => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        system: systemMsg?.content,
        messages: nonSystem.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Claude API error ${response.status}: ${body}`);
    }
    const data = await response.json() as { content: { text: string }[] };
    return data.content[0].text;
  }
}

export class OpenAIProvider implements LLMProvider {
  constructor(private apiKey: string, private model = "gpt-4o") {}

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_completion_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI API error ${response.status}: ${body}`);
    }
    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  }
}

export function createProvider(config: NlConfig): LLMProvider {
  switch (config.provider) {
    case "claude": return new ClaudeProvider(config.apiKey, config.model);
    case "openai": return new OpenAIProvider(config.apiKey, config.model);
  }
}
```

- [ ] **Step 2: Implement pipeline.ts**

```typescript
import type { LLMProvider, NlContext, NlResult, NlPipeline } from "./types";
import { parse } from "./parse";
import { resolve } from "./resolve";
import { buildSystemPrompt, buildContextMessage, buildUserMessage } from "./prompt";
import { applyOplEdit, expose, render } from "@opmodel/core";

export function createPipeline(config: { provider: LLMProvider }): NlPipeline {
  return {
    async generate(nl: string, context: NlContext): Promise<NlResult> {
      // Input validation
      const trimmed = nl.trim();
      if (!trimmed) throw new Error("Empty input");
      if (trimmed.length > 10000) throw new Error("Input too long (max 10000 characters)");

      // Build messages (context + user merged in single user message for API alternation)
      const messages = [
        { role: "system" as const, content: buildSystemPrompt() },
        { role: "user" as const, content: buildContextMessage(context.model, context.opdId)
            + "\n\n" + buildUserMessage(trimmed) },
      ];

      // Call LLM
      const raw = await config.provider.complete(messages, { temperature: 0 });

      // Parse response
      const parseResult = parse(raw);
      if (!parseResult.ok) throw new Error(`Parse error: ${parseResult.error.message}`);
      const descriptors = parseResult.value;

      // Resolve names → IDs
      const resolveResult = resolve(descriptors, context.model, context.opdId);
      if (!resolveResult.ok) throw new Error(`Resolve error: ${resolveResult.error.message}`);
      const edits = resolveResult.value;

      // Compute preview
      let projected = context.model;
      for (const edit of edits) {
        const r = applyOplEdit(projected, edit);
        if (r.ok) projected = r.value;
      }
      const preview = render(expose(projected, context.opdId));

      return { edits, descriptors, preview };
    },
  };
}
```

- [ ] **Step 3: Write pipeline tests with mocked provider**

```typescript
import { describe, test, expect } from "vitest";
import { createPipeline } from "../src/pipeline";
import type { LLMProvider } from "../src/types";
import { createModel, addThing, addOPD, addAppearance } from "@opmodel/core";
import type { Model } from "@opmodel/core";

function mockProvider(response: string): LLMProvider {
  return {
    complete: async () => response,
  };
}

function buildTestModel(): { model: Model; opdId: string } {
  let m = createModel("test");
  const opdId = "opd-main";
  let r = addOPD(m, { id: opdId, name: "Main", parentId: null });
  m = r.ok ? r.value : m;
  r = addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" });
  m = r.ok ? r.value : m;
  r = addAppearance(m, { thing: "obj-water", opd: opdId, x: 50, y: 50, w: 120, h: 60 });
  m = r.ok ? r.value : m;
  return { model: m, opdId };
}

describe("pipeline", () => {
  const { model, opdId } = buildTestModel();

  test("end-to-end: add-thing via mocked LLM", async () => {
    const provider = mockProvider(JSON.stringify([
      { kind: "add-thing", name: "Steam", thingKind: "object" },
    ]));
    const pipeline = createPipeline({ provider });
    const result = await pipeline.generate("Add a Steam object", { model, opdId });

    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].kind).toBe("add-thing");
    expect(result.descriptors).toHaveLength(1);
    expect(result.preview).toContain("Steam");
  });

  test("end-to-end: batch with cross-reference", async () => {
    const provider = mockProvider(JSON.stringify([
      { kind: "add-thing", name: "Heating", thingKind: "process" },
      { kind: "add-link", sourceName: "Heating", targetName: "Water", linkType: "consumption" },
    ]));
    const pipeline = createPipeline({ provider });
    const result = await pipeline.generate("Add heating process that consumes water", { model, opdId });

    expect(result.edits).toHaveLength(2);
    expect(result.preview).toContain("Heating");
    expect(result.preview).toContain("Water");
  });

  test("rejects empty input", async () => {
    const provider = mockProvider("[]");
    const pipeline = createPipeline({ provider });
    await expect(pipeline.generate("", { model, opdId })).rejects.toThrow("Empty input");
  });

  test("rejects input over 10000 chars", async () => {
    const provider = mockProvider("[]");
    const pipeline = createPipeline({ provider });
    await expect(pipeline.generate("x".repeat(10001), { model, opdId })).rejects.toThrow("too long");
  });

  test("throws on LLM returning invalid JSON", async () => {
    const provider = mockProvider("I don't understand your request.");
    const pipeline = createPipeline({ provider });
    await expect(pipeline.generate("do something", { model, opdId })).rejects.toThrow("Parse error");
  });

  test("throws on resolve failure (unknown thing)", async () => {
    const provider = mockProvider(JSON.stringify([
      { kind: "remove-thing", name: "NonExistent" },
    ]));
    const pipeline = createPipeline({ provider });
    await expect(pipeline.generate("remove NonExistent", { model, opdId })).rejects.toThrow("Resolve error");
  });
});
```

- [ ] **Step 4: Run all nl tests**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/nl/`
Expected: All tests PASS (parse: ~25, resolve: ~17, prompt: ~6, pipeline: ~6 = ~54 total)

- [ ] **Step 5: Update index.ts with all source module exports**

Now that all source files exist, update `packages/nl/src/index.ts` to add the source module exports:

```typescript
// Type-only re-exports
export type {
  NlEditDescriptor, LLMMessage, LLMOptions, LLMProvider,
  NlContext, NlResult, NlPipeline, NlConfig,
  ParseError, ResolveError,
} from "./types";

// Source module exports
export { parse } from "./parse";
export { resolve } from "./resolve";
export { buildSystemPrompt, buildContextMessage, buildUserMessage } from "./prompt";
export { ClaudeProvider, OpenAIProvider, createProvider } from "./provider";
export { createPipeline } from "./pipeline";
```

- [ ] **Step 6: Verify type check**

Run: `cd packages/nl && bunx tsc --noEmit`
Expected: Clean (no errors)

- [ ] **Step 7: Commit**

```bash
git add packages/nl/src/index.ts packages/nl/src/provider.ts packages/nl/src/pipeline.ts packages/nl/tests/pipeline.test.ts
git commit -m "feat(nl): add provider and pipeline modules with mocked LLM tests (TDD)"
```

---

## Chunk 3: Web integration + final verification

### Task 6: Extend OplEditorView with NL textarea

**Files:**
- Modify: `packages/web/package.json` (add `@opmodel/nl` dependency)
- Modify: `packages/web/src/components/OplEditorView.tsx`
- Modify: `packages/web/src/components/OplPanel.tsx`
- Modify: `packages/web/src/App.css`

**Context:** The NL textarea goes **above** the existing structured form in `OplEditorView`, separated by a divider. If `nlPipeline` prop is undefined, the NL section is hidden entirely. The OplPanel must pass the new prop through.

- [ ] **Step 1: Add @opmodel/nl dependency to web package**

In `packages/web/package.json`, add to dependencies:

```json
"@opmodel/nl": "workspace:*"
```

Then run: `bun install`

- [ ] **Step 2: Add nlPipeline prop to OplEditorView**

In `packages/web/src/components/OplEditorView.tsx`, update imports, Props interface, and component destructuring:

```typescript
// Add to existing imports at top
import type { NlPipeline, NlResult } from "@opmodel/nl";

// Update Props interface
interface Props {
  model: Model;
  opdId: string;
  dispatch: (cmd: Command) => boolean;
  nlPipeline?: NlPipeline;
}

// Update component function signature to destructure the new prop
export function OplEditorView({ model, opdId, dispatch, nlPipeline }: Props) {
```

- [ ] **Step 3: Add NL state and handlers inside OplEditorView**

After the existing `const [error, setError]` state line, add:

```typescript
  // NL generation state
  const [nlText, setNlText] = useState("");
  const [nlResult, setNlResult] = useState<NlResult | null>(null);
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!nlPipeline || !nlText.trim()) return;
    setNlLoading(true);
    setNlError(null);
    setNlResult(null);
    try {
      const result = await nlPipeline.generate(nlText, { model, opdId });
      setNlResult(result);
    } catch (e) {
      setNlError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setNlLoading(false);
    }
  };

  const handleApplyAll = () => {
    if (!nlResult) return;
    for (const edit of nlResult.edits) {
      if (!dispatch({ tag: "applyOplEdit", edit })) {
        setNlError("Edit rejected by model invariants");
        return;
      }
    }
    setNlText("");
    setNlResult(null);
    setNlError(null);
  };

  const handleClearNl = () => {
    setNlText("");
    setNlResult(null);
    setNlError(null);
  };
```

- [ ] **Step 4: Add NL section JSX**

At the beginning of the returned JSX (right after `<div className="opl-panel__content opl-editor">`), add the NL section before the existing form:

```tsx
      {nlPipeline && (
        <>
          <div className="opl-editor__nl-section">
            <textarea
              className="opl-editor__nl-textarea"
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
              placeholder="Describe your model changes in natural language..."
              rows={3}
            />
            <button
              className={`opl-editor__nl-generate${nlLoading ? " opl-editor__nl-generate--loading" : ""}`}
              onClick={handleGenerate}
              disabled={nlLoading || !nlText.trim()}
            >
              {nlLoading ? "Generating..." : "Generate"}
            </button>
            {nlResult && (
              <div className="opl-editor__nl-preview">
                <label className="opl-editor__label">Preview ({nlResult.edits.length} edits)</label>
                <pre className="opl-editor__preview-text">{nlResult.preview}</pre>
                <div className="opl-editor__nl-actions">
                  <button className="opl-editor__apply" onClick={handleApplyAll}>Apply All</button>
                  <button className="opl-editor__nl-clear" onClick={handleClearNl}>Clear</button>
                </div>
              </div>
            )}
            {nlError && <div className="opl-editor__error">{nlError}</div>}
          </div>
          <div className="opl-editor__nl-divider">or use structured form</div>
        </>
      )}
```

- [ ] **Step 5: Update OplPanel to pass nlPipeline**

In `packages/web/src/components/OplPanel.tsx`:

```typescript
// Add import
import type { NlPipeline } from "@opmodel/nl";

// Update Props interface
interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  dispatch: (cmd: Command) => boolean;
  nlPipeline?: NlPipeline;
}

// Update component signature
export function OplPanel({ model, opdId, selectedThing, dispatch, nlPipeline }: Props) {

// Update OplEditorView rendering
      {activeTab === "editor" && (
        <OplEditorView model={model} opdId={opdId} dispatch={dispatch} nlPipeline={nlPipeline} />
      )}
```

- [ ] **Step 6: Add NL CSS styles**

Append to `packages/web/src/App.css`:

```css
/* NL Generation */
.opl-editor__nl-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.opl-editor__nl-textarea {
  width: 100%;
  min-height: 60px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  resize: vertical;
  box-sizing: border-box;
  background: var(--bg-surface);
  color: var(--text-primary);
}
.opl-editor__nl-textarea:focus {
  outline: none;
  border-color: var(--accent);
}
.opl-editor__nl-generate {
  padding: 7px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.opl-editor__nl-generate:disabled {
  opacity: 0.4;
  cursor: default;
}
.opl-editor__nl-generate--loading {
  opacity: 0.7;
}
.opl-editor__nl-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.opl-editor__nl-actions {
  display: flex;
  gap: 8px;
}
.opl-editor__nl-clear {
  padding: 7px 14px;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.opl-editor__nl-divider {
  text-align: center;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  padding: 8px 0;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}
```

- [ ] **Step 7: Verify type check**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: Clean (dependency `@opmodel/nl` was added in Step 1)

- [ ] **Step 8: Commit**

```bash
git add packages/web/package.json packages/web/src/components/OplEditorView.tsx packages/web/src/components/OplPanel.tsx packages/web/src/App.css
git commit -m "feat(web): extend OplEditorView with NL textarea, preview, and apply-all"
```

---

### Task 7: NlSettingsModal + App.tsx wiring

**Files:**
- Create: `packages/web/src/components/NlSettingsModal.tsx`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/App.css`

Note: `@opmodel/nl` dependency was already added to `packages/web/package.json` in Task 6 Step 1.

- [ ] **Step 1: Create NlSettingsModal**

```typescript
import { useState } from "react";
import type { NlConfig } from "@opmodel/nl";

interface Props {
  config: NlConfig | null;
  onSave: (config: NlConfig) => void;
  onClose: () => void;
}

export function NlSettingsModal({ config, onSave, onClose }: Props) {
  const [provider, setProvider] = useState<"claude" | "openai">(config?.provider ?? "claude");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [model, setModel] = useState(config?.model ?? "");

  const isKeyValid = provider === "claude"
    ? apiKey.startsWith("sk-ant-")
    : apiKey.startsWith("sk-");

  const handleSave = () => {
    const cfg: NlConfig = { provider, apiKey, ...(model ? { model } : {}) };
    localStorage.setItem("opmodel:nl-config", JSON.stringify(cfg));
    onSave(cfg);
    onClose();
  };

  return (
    <div className="nl-settings__overlay" onClick={onClose}>
      <div className="nl-settings" onClick={(e) => e.stopPropagation()}>
        <h3 className="nl-settings__title">NL Settings</h3>
        <div className="nl-settings__field">
          <label className="opl-editor__label">Provider</label>
          <select className="opl-editor__select" value={provider} onChange={(e) => setProvider(e.target.value as any)}>
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div className="nl-settings__field">
          <label className="opl-editor__label">API Key</label>
          <input
            className="opl-editor__input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "claude" ? "sk-ant-..." : "sk-..."}
          />
          {apiKey && !isKeyValid && (
            <span className="opl-editor__warning">
              Key should start with {provider === "claude" ? "sk-ant-" : "sk-"}
            </span>
          )}
        </div>
        <div className="nl-settings__field">
          <label className="opl-editor__label">Model (optional)</label>
          <input
            className="opl-editor__input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={provider === "claude" ? "claude-sonnet-4-20250514" : "gpt-4o"}
          />
        </div>
        <div className="nl-settings__actions">
          <button className="opl-editor__apply" onClick={handleSave} disabled={!apiKey || !isKeyValid}>Save</button>
          <button className="opl-editor__nl-clear" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire App.tsx with pipeline and settings**

In `packages/web/src/App.tsx`, add the following. **Important:** All state and JSX additions go inside the `Editor` component function (not `App`), since `Editor` has access to model/dispatch and renders the OplPanel.

```typescript
// Add to EXISTING React import (do NOT replace — keep useEffect, useCallback, etc.)
import { useState, useEffect, useCallback, useMemo } from "react";
// Add new imports
import type { NlConfig } from "@opmodel/nl";
import { createProvider, createPipeline } from "@opmodel/nl";
import { NlSettingsModal } from "./components/NlSettingsModal";
```

Add state and pipeline creation inside the `Editor` component function (near other state declarations):

```typescript
  // NL pipeline
  const [nlConfig, setNlConfig] = useState<NlConfig | null>(() => {
    const stored = localStorage.getItem("opmodel:nl-config");
    if (stored) {
      try { return JSON.parse(stored) as NlConfig; } catch { /* ignore */ }
    }
    const key = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
    if (key) return { provider: "claude" as const, apiKey: key };
    return null;
  });
  const [showNlSettings, setShowNlSettings] = useState(false);

  const nlPipeline = useMemo(() => {
    if (!nlConfig) return undefined;
    const provider = createProvider(nlConfig);
    return createPipeline({ provider });
  }, [nlConfig]);
```

Update OplPanel to pass nlPipeline:

```tsx
<OplPanel
  model={model}
  opdId={ui.currentOpd}
  selectedThing={ui.selectedThing}
  dispatch={dispatch}
  nlPipeline={nlPipeline}
/>
```

Add settings button to the header — insert it after the `<div className="header__badge">` (the very last element in `<header>`, line 122 of App.tsx):

```tsx
<button onClick={() => setShowNlSettings(true)} title="NL Settings">⚙</button>
```

Add the modal at the **end** of the `Editor` return statement, as the last child inside `<div className="app">` (avoids z-index stacking issues):

```tsx
{showNlSettings && (
  <NlSettingsModal
    config={nlConfig}
    onSave={setNlConfig}
    onClose={() => setShowNlSettings(false)}
  />
)}
```

- [ ] **Step 3: Add NlSettingsModal CSS**

Append to `packages/web/src/App.css`:

```css
/* NL Settings Modal */
.nl-settings__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.nl-settings {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
.nl-settings__title {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
}
.nl-settings__field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 12px;
}
.nl-settings__actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
```

- [ ] **Step 4: Verify type check and build**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: Clean

Run: `cd packages/web && bunx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/NlSettingsModal.tsx packages/web/src/App.tsx packages/web/src/App.css
git commit -m "feat(web): add NlSettingsModal and wire NL pipeline in App.tsx"
```

---

### Task 8: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full type check across all packages**

Run: `cd packages/nl && bunx tsc --noEmit && cd ../web && bunx tsc --noEmit && cd ../core && bunx tsc --noEmit`
Expected: All clean

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All tests pass (existing ~406 + new ~49 = ~455 total)

- [ ] **Step 3: Build web**

Run: `cd packages/web && bunx vite build`
Expected: Build succeeds

- [ ] **Step 4: Visual verification**

Run: `cd packages/web && bunx vite`

1. Open browser to localhost
2. Switch to Editor tab in OPL panel
3. Verify NL textarea appears above the structured form (if API key configured)
4. Verify structured form still works as before
5. Verify ⚙ settings button opens NlSettingsModal
6. If API key available: test "Add a Steam object" → verify preview → apply

- [ ] **Step 5: Commit any fixes and finalize**

If fixes needed:
```bash
git add -A
git commit -m "fix(nl): address final verification issues"
```
