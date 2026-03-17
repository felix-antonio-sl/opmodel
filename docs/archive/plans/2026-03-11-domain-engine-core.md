# Domain Engine Core Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `packages/core` — the zero-dependency Domain Engine that loads, validates, mutates, and serializes OPM models.

**Architecture:** Immutable Model with Maps for O(1) lookups. Pure functions return `Result<Model, InvariantError>`. Invariants split into guards (pre-mutation) and effects (during mutation). Serialization handles round-trip with `.opmodel` JSON format conventions.

**Tech Stack:** TypeScript, Bun workspaces, Vitest

**Spec:** `docs/superpowers/specs/2026-03-11-domain-engine-stack-design.md`
**Data Model:** `specs/opm-data-model.md` Rev.3
**JSON Schema:** `specs/opm-json-schema.json`
**Test Fixture:** `tests/coffee-making.opmodel`

---

## Chunk 1: Foundation

### Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (workspace root)
- Create: `tsconfig.json` (base)
- Create: `vitest.config.ts`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `.gitignore`
- Create: `.gitattributes`

**Prerequisites:** Install Bun if not present: `curl -fsSL https://bun.sh/install | bash`

- [ ] **Step 1: Create root package.json with Bun workspaces**

```json
{
  "name": "opmodel",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["packages/*/tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create packages/core/package.json**

```json
{
  "name": "@opmodel/core",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "files": ["src"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 5: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 6: Create .gitignore and .gitattributes**

```
# .gitignore
node_modules/
dist/
.opmod-session
*.tsbuildinfo
```

```
# .gitattributes
bun.lockb binary
```

- [ ] **Step 7: Install dependencies**

Run: `bun install && bun add -d vitest`
Expected: `node_modules` created, lockfile generated.

- [ ] **Step 8: Verify setup compiles**

Create `packages/core/src/index.ts` with `export {};`
Run: `bunx vitest run`
Expected: No tests found, but no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts packages/core/ .gitignore bun.lockb
git commit -m "feat: scaffold monorepo with Bun workspaces and Vitest"
```

---

### Task 2: Core Types — Enums, Primitives, Entities

**Files:**
- Create: `packages/core/src/types.ts`
- Test: `packages/core/tests/types.test.ts`

Reference: `specs/opm-data-model.md` §2-§5 for every field, `specs/opm-json-schema.json` for enums.

- [ ] **Step 1: Write type smoke test**

```typescript
// packages/core/tests/types.test.ts
import { describe, it, expect } from "vitest";
import type { Thing, State, Link, Model } from "../src/types";

describe("types", () => {
  it("Thing with kind=object compiles", () => {
    const t: Thing = {
      id: "obj-water",
      kind: "object",
      name: "Water",
      essence: "physical",
      affiliation: "systemic",
    };
    expect(t.kind).toBe("object");
  });

  it("Thing with kind=process and duration compiles", () => {
    const t: Thing = {
      id: "proc-heating",
      kind: "process",
      name: "Heating",
      essence: "physical",
      affiliation: "systemic",
      duration: { nominal: 60, unit: "s" },
    };
    expect(t.duration?.nominal).toBe(60);
  });

  it("Link with type=tagged requires tag", () => {
    const l: Link = {
      id: "lnk-foo",
      type: "tagged",
      source: "obj-a",
      target: "obj-b",
      tag: "relates-to",
    };
    expect(l.tag).toBe("relates-to");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/types.test.ts`
Expected: FAIL — module `../src/types` not found.

- [ ] **Step 3: Implement all types**

Create `packages/core/src/types.ts` with all type definitions derived from the data model. This is the largest single file (~250 lines). Include:

```typescript
// packages/core/src/types.ts

// === Enums (string literal unions) ===

export type Essence = "physical" | "informatical";
export type Kind = "object" | "process";
export type Affiliation = "systemic" | "environmental";
export type Perseverance = "static" | "dynamic";
export type ValueType = "integer" | "float" | "string" | "character" | "boolean";
export type FunctionType = "predefined" | "user_defined";
export type TimeUnit = "ms" | "s" | "min" | "h" | "d";
export type OpdType = "hierarchical" | "view";
export type RefinementType = "in-zoom" | "unfold";
export type LinkType =
  | "effect" | "consumption" | "result" | "input" | "output"
  | "agent" | "instrument"
  | "aggregation" | "exhibition" | "generalization" | "classification" | "tagged"
  | "invocation" | "exception";
export type ModifierType = "event" | "condition";
export type FanType = "xor" | "or";
export type AssertionCategory = "safety" | "liveness" | "correctness";
export type ValidationLevel = "hard" | "soft";
export type SyncStatus = "synced" | "pending" | "unloaded" | "disconnected";
export type SystemType = "artificial" | "natural" | "social" | "socio-technical";
export type Direction = "unidirectional" | "bidirectional" | "reciprocal";
export type StateAlignment = "left" | "top" | "right" | "bottom";
export type OplEssenceVisibility = "all" | "non_default" | "none";
export type OplUnitsVisibility = "always" | "hide" | "when_applicable";
export type OpdNameFormat = "full" | "short";
export type OpdRearranging = "automatic" | "manual" | "inherited";

// === Primitives (§2.4-§2.5) ===

export interface Duration {
  nominal: number;
  min?: number;
  max?: number;
  unit: TimeUnit;
}

export interface Range {
  min: number;
  max: number;
  min_inclusive: boolean;
  max_inclusive: boolean;
}

export interface Position {
  x: number;
  y: number;
}

export interface Style {
  fill_color?: string;
  text_color?: string;
  border_color?: string;
}

export interface Rate {
  value: number;
  unit: string;
}

// === Computational (§2.1) ===

export interface ComputationalObject {
  value: unknown;
  value_type: ValueType;
  unit?: string;
  alias?: string;
  ranges?: Range[];
  default_value?: unknown;
}

export interface ComputationalProcess {
  function_type: FunctionType;
  function_name?: string;
  function_code?: string;
}

// === Requirement sub-types (§5.4) ===

export interface RequirementAttribute {
  name: string;
  value: string;
  validation: ValidationLevel;
}

export interface RequirementStereotype {
  essence: string;
  actual_name: string;
  attributes: RequirementAttribute[];
}

// === Entities (§2-§5) ===

export interface Thing {
  id: string;
  kind: Kind;
  name: string;
  essence: Essence;
  affiliation: Affiliation;
  perseverance?: Perseverance;
  duration?: Duration;
  notes?: string;
  hyperlinks?: string[];
  user_input_enabled?: boolean;
  computational?: ComputationalObject | ComputationalProcess;
}

export interface State {
  id: string;
  parent: string;
  name: string;
  initial: boolean;
  final: boolean;
  default: boolean;
  current?: boolean;
  duration?: Duration;
  hyperlinks?: string[];
}

export interface OPD {
  id: string;
  name: string;
  opd_type: OpdType;
  parent_opd: string | null;
  refines?: string;
  refinement_type?: RefinementType;
}

export interface Link {
  id: string;
  type: LinkType;
  source: string;
  target: string;
  source_state?: string;
  target_state?: string;
  multiplicity_source?: string;
  multiplicity_target?: string;
  probability?: number;
  rate?: Rate;
  path_label?: string;
  tag?: string;
  direction?: Direction;
  tag_reverse?: string;
  ordered?: boolean;
  invocation_interval?: Duration;
  discriminating?: boolean;
  discriminating_values?: string[];
  hyperlinks?: string[];
  vertices?: Position[];
}

export interface Modifier {
  id: string;
  over: string;
  type: ModifierType;
  negated?: boolean;
}

export interface Appearance {
  thing: string;
  opd: string;
  x: number;
  y: number;
  w: number;
  h: number;
  internal?: boolean;
  pinned?: boolean;
  auto_sizing?: boolean;
  state_alignment?: StateAlignment;
  suppressed_states?: string[];
  semi_folded?: boolean;
  style?: Style;
}

export interface Fan {
  id: string;
  type: FanType;
  members: string[];
}

export interface Scenario {
  id: string;
  name: string;
  path_labels: string[];
}

export interface Assertion {
  id: string;
  target?: string;
  predicate: string;
  category: AssertionCategory;
  enabled: boolean;
}

export interface Requirement {
  id: string;
  target: string;
  name: string;
  description?: string;
  req_id?: string;
  stereotype?: RequirementStereotype;
  hyperlinks?: string[];
}

export interface Stereotype {
  id: string;
  thing: string;
  stereotype_id: string;
  global: boolean;
  hyperlinks?: string[];
}

export interface SubModel {
  id: string;
  name: string;
  path: string;
  shared_things: string[];
  sync_status: SyncStatus;
}

export interface Meta {
  name: string;
  description?: string;
  system_type?: SystemType;
  created: string;
  modified: string;
}

export interface Settings {
  opl_language?: string;
  opl_essence_visibility?: OplEssenceVisibility;
  opl_units_visibility?: OplUnitsVisibility;
  opl_alias_visibility?: boolean;
  opl_highlight_opd?: boolean;
  opl_highlight_opl?: boolean;
  opl_color_sync?: boolean;
  autoformat?: boolean;
  autosave_interval_s?: number;
  decimal_precision?: number;
  notes_visible?: boolean;
  opd_name_format?: OpdNameFormat;
  opd_rearranging?: OpdRearranging;
  primary_essence?: Essence;
  range_validation_design?: ValidationLevel;
  range_validation_simulation?: ValidationLevel;
  methodology_coaching?: boolean;
}

// === Model (in-memory graph, §3.2 of design doc) ===

export interface Model {
  opmodel: string;
  meta: Meta;
  settings: Settings;
  things: Map<string, Thing>;
  states: Map<string, State>;
  opds: Map<string, OPD>;
  links: Map<string, Link>;
  modifiers: Map<string, Modifier>;
  appearances: Map<string, Appearance>; // key: `${thing}::${opd}`
  fans: Map<string, Fan>;
  scenarios: Map<string, Scenario>;
  assertions: Map<string, Assertion>;
  requirements: Map<string, Requirement>;
  stereotypes: Map<string, Stereotype>;
  subModels: Map<string, SubModel>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run packages/core/tests/types.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/tests/types.test.ts
git commit -m "feat(core): add all OPM type definitions derived from data model Rev.3"
```

---

### Task 3: Result Type and Model Factory

**Files:**
- Create: `packages/core/src/result.ts`
- Create: `packages/core/src/model.ts`
- Test: `packages/core/tests/model.test.ts`

- [ ] **Step 1: Write failing tests for Result and createModel**

```typescript
// packages/core/tests/model.test.ts
import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr } from "../src/result";
import { createModel } from "../src/model";

describe("Result", () => {
  it("ok wraps a value", () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it("err wraps an error", () => {
    const r = err({ code: "I-08", message: "duplicate id" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-08");
  });
});

describe("createModel", () => {
  it("creates empty model with name and defaults", () => {
    const model = createModel("Test System");
    expect(model.meta.name).toBe("Test System");
    expect(model.opmodel).toBe("1.1.0");
    expect(model.things.size).toBe(0);
    expect(model.states.size).toBe(0);
    expect(model.links.size).toBe(0);
    expect(model.opds.size).toBe(1); // SD root
    expect(model.opds.get("opd-sd")?.name).toBe("SD");
  });

  it("accepts optional system_type", () => {
    const model = createModel("Coffee", "artificial");
    expect(model.meta.system_type).toBe("artificial");
  });

  it("creates SD root OPD automatically", () => {
    const model = createModel("Test");
    const sd = model.opds.get("opd-sd");
    expect(sd).toBeDefined();
    expect(sd?.opd_type).toBe("hierarchical");
    expect(sd?.parent_opd).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/model.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement Result type**

```typescript
// packages/core/src/result.ts
export interface InvariantError {
  code: string;
  message: string;
  entity?: string;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
  return !r.ok;
}
```

- [ ] **Step 4: Implement createModel**

```typescript
// packages/core/src/model.ts
import type { Model, SystemType } from "./types";

const SCHEMA_VERSION = "1.1.0";

export function createModel(name: string, systemType?: SystemType): Model {
  const now = new Date().toISOString();
  const sdOPD = {
    id: "opd-sd",
    name: "SD",
    opd_type: "hierarchical" as const,
    parent_opd: null,
  };

  return {
    opmodel: SCHEMA_VERSION,
    meta: {
      name,
      system_type: systemType,
      created: now,
      modified: now,
    },
    settings: {},
    things: new Map(),
    states: new Map(),
    opds: new Map([["opd-sd", sdOPD]]),
    links: new Map(),
    modifiers: new Map(),
    appearances: new Map(),
    fans: new Map(),
    scenarios: new Map(),
    assertions: new Map(),
    requirements: new Map(),
    stereotypes: new Map(),
    subModels: new Map(),
  };
}
```

- [ ] **Step 5: Update index.ts barrel export**

```typescript
// packages/core/src/index.ts
export * from "./types";
export * from "./result";
export { createModel } from "./model";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/model.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/result.ts packages/core/src/model.ts packages/core/src/index.ts packages/core/tests/model.test.ts
git commit -m "feat(core): add Result type and createModel factory with SD root OPD"
```

---

## Chunk 2: Serialization

### Task 4: save() — Model to JSON string

**Files:**
- Create: `packages/core/src/serialization.ts`
- Test: `packages/core/tests/serialization.test.ts`

Reference: `specs/opm-data-model.md` §7.2 conventions:
1. Keys sorted alphabetically in each object
2. One object per line in arrays
3. Arrays sorted by `id` (appearances by `thing`, then `opd`)
4. Null/undefined fields omitted
5. Empty sections persisted as `[]`

- [ ] **Step 1: Write failing test for save()**

```typescript
// packages/core/tests/serialization.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { saveModel } from "../src/serialization";

describe("saveModel", () => {
  it("serializes empty model with sorted keys", () => {
    const model = createModel("Test", "artificial");
    const json = saveModel(model);
    const parsed = JSON.parse(json);

    expect(parsed.opmodel).toBe("1.1.0");
    expect(parsed.meta.name).toBe("Test");
    expect(parsed.things).toEqual([]);
    expect(parsed.opds).toHaveLength(1);
    expect(parsed.opds[0].id).toBe("opd-sd");

    // Verify keys are sorted alphabetically
    const rootKeys = Object.keys(parsed);
    const sortedKeys = [...rootKeys].sort();
    expect(rootKeys).toEqual(sortedKeys);
  });

  it("omits undefined/null fields", () => {
    const model = createModel("Test");
    const json = saveModel(model);
    const parsed = JSON.parse(json);

    // system_type is undefined, should be omitted
    expect("system_type" in parsed.meta).toBe(false);
  });

  it("sorts arrays by id", () => {
    const model = createModel("Test");
    model.things.set("obj-z", {
      id: "obj-z", kind: "object", name: "Z",
      essence: "physical", affiliation: "systemic",
    });
    model.things.set("obj-a", {
      id: "obj-a", kind: "object", name: "A",
      essence: "physical", affiliation: "systemic",
    });

    const json = saveModel(model);
    const parsed = JSON.parse(json);
    expect(parsed.things[0].id).toBe("obj-a");
    expect(parsed.things[1].id).toBe("obj-z");
  });

  it("sorts appearances by (thing, opd)", () => {
    const model = createModel("Test");
    model.appearances.set("obj-b::opd-sd", {
      thing: "obj-b", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50,
    });
    model.appearances.set("obj-a::opd-sd", {
      thing: "obj-a", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50,
    });

    const json = saveModel(model);
    const parsed = JSON.parse(json);
    expect(parsed.appearances[0].thing).toBe("obj-a");
    expect(parsed.appearances[1].thing).toBe("obj-b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/serialization.test.ts`
Expected: FAIL — `saveModel` not found.

- [ ] **Step 3: Implement saveModel**

```typescript
// packages/core/src/serialization.ts
import type { Model, Appearance } from "./types";

// NOTE: Only skip `undefined`. Preserve `null` — required for parent_opd: null
// (the ONLY required+nullable field, per §7.2 conv. 4 exception).
function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const val = obj[key];
    if (val === undefined) continue;
    if (val === null) {
      sorted[key] = null;
    } else if (Array.isArray(val)) {
      sorted[key] = val.map((item) =>
        typeof item === "object" && item !== null && !Array.isArray(item)
          ? sortKeys(item as Record<string, unknown>)
          : item
      );
    } else if (typeof val === "object") {
      sorted[key] = sortKeys(val as Record<string, unknown>);
    } else {
      sorted[key] = val;
    }
  }
  return sorted;
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function sortAppearances(items: Appearance[]): Appearance[] {
  return [...items].sort((a, b) => {
    const cmp = a.thing.localeCompare(b.thing);
    return cmp !== 0 ? cmp : a.opd.localeCompare(b.opd);
  });
}

export function saveModel(model: Model): string {
  const raw: Record<string, unknown> = {
    opmodel: model.opmodel,
    meta: model.meta,
    settings: model.settings,
    things: sortById([...model.things.values()]),
    states: sortById([...model.states.values()]),
    opds: sortById([...model.opds.values()]),
    links: sortById([...model.links.values()]),
    modifiers: sortById([...model.modifiers.values()]),
    appearances: sortAppearances([...model.appearances.values()]),
    fans: sortById([...model.fans.values()]),
    scenarios: sortById([...model.scenarios.values()]),
    assertions: sortById([...model.assertions.values()]),
    requirements: sortById([...model.requirements.values()]),
    stereotypes: sortById([...model.stereotypes.values()]),
    sub_models: sortById([...model.subModels.values()]),
  };

  const sorted = sortKeys(raw);

  // Custom format per §7.2:
  // - Root object keys indented 2 spaces
  // - Array items: one JSON object per line (compact), indented 4 spaces
  // - Non-array objects (meta, settings): pretty-printed with 4-space indent
  const sections = Object.entries(sorted).map(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `  "${key}": []`;
      }
      const items = value.map((item) => `    ${JSON.stringify(item)}`).join(",\n");
      return `  "${key}": [\n${items}\n  ]`;
    }
    if (typeof value === "object" && value !== null) {
      // Pretty-print objects like meta, settings (matches §7.3 example)
      const inner = JSON.stringify(value, null, 4)
        .split("\n")
        .map((line, i) => (i === 0 ? line : `  ${line}`))
        .join("\n");
      return `  "${key}": ${inner}`;
    }
    return `  "${key}": ${JSON.stringify(value)}`;
  });

  return `{\n${sections.join(",\n")}\n}\n`;
}
```

- [ ] **Step 4: Update index.ts**

Add: `export { saveModel } from "./serialization";`

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/serialization.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/serialization.ts packages/core/src/index.ts packages/core/tests/serialization.test.ts
git commit -m "feat(core): implement saveModel with §7.2 serialization conventions"
```

---

### Task 5: load() — JSON string to Model

**Files:**
- Modify: `packages/core/src/serialization.ts`
- Modify: `packages/core/tests/serialization.test.ts`

The load function does:
1. JSON.parse
2. Structural validation (required fields exist)
3. Convert arrays → Maps
4. Return Model (runtime invariant validation deferred to Task 10)

- [ ] **Step 1: Write failing tests for loadModel**

Add to `packages/core/tests/serialization.test.ts`:

```typescript
import { loadModel, saveModel } from "../src/serialization";
import { isOk, isErr } from "../src/result";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("loadModel", () => {
  it("loads valid JSON into Model with Maps", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const result = loadModel(json);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const model = result.value;
    expect(model.meta.name).toBe("Coffee Making System");
    expect(model.things.size).toBe(5);
    expect(model.states.size).toBe(4);
    expect(model.opds.size).toBe(2);
    expect(model.links.size).toBe(5);
    expect(model.modifiers.size).toBe(1);
    expect(model.appearances.size).toBe(6);
    expect(model.assertions.size).toBe(1);
  });

  it("indexes things by id", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const result = loadModel(json);
    if (!isOk(result)) return;

    expect(result.value.things.get("obj-water")?.name).toBe("Water");
    expect(result.value.things.get("proc-coffee-making")?.kind).toBe("process");
  });

  it("indexes appearances by thing::opd", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const result = loadModel(json);
    if (!isOk(result)) return;

    const app = result.value.appearances.get("obj-water::opd-sd");
    expect(app).toBeDefined();
    expect(app?.x).toBe(50);
  });

  it("rejects invalid JSON", () => {
    const result = loadModel("not json");
    expect(isErr(result)).toBe(true);
  });

  it("rejects JSON missing required sections", () => {
    const result = loadModel(JSON.stringify({ opmodel: "1.0.0" }));
    expect(isErr(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/serialization.test.ts`
Expected: FAIL — `loadModel` not found.

- [ ] **Step 3: Implement loadModel**

Add to `packages/core/src/serialization.ts`:

```typescript
import type { Model, Thing, State, OPD, Link, Modifier, Appearance,
  Fan, Scenario, Assertion, Requirement, Stereotype, SubModel } from "./types";
import type { InvariantError } from "./result";
import { ok, err, type Result } from "./result";

export interface LoadError {
  phase: "parse" | "structure" | "invariant";
  message: string;
  details?: InvariantError[];
}

const REQUIRED_SECTIONS = [
  "opmodel", "meta", "settings", "things", "states", "opds",
  "links", "modifiers", "appearances", "fans", "scenarios",
  "assertions", "requirements", "stereotypes", "sub_models",
] as const;

export function loadModel(json: string): Result<Model, LoadError> {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return err({ phase: "parse", message: "Invalid JSON" });
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return err({ phase: "structure", message: "Root must be an object" });
  }

  for (const key of REQUIRED_SECTIONS) {
    if (!(key in raw)) {
      return err({ phase: "structure", message: `Missing required section: ${key}` });
    }
  }

  if (typeof (raw as any).opmodel !== "string" || !/^\d+\.\d+\.\d+$/.test((raw as any).opmodel)) {
    return err({ phase: "structure", message: "Invalid opmodel version (must be semver)" });
  }

  const ARRAY_SECTIONS = [
    "things", "states", "opds", "links", "modifiers", "appearances",
    "fans", "scenarios", "assertions", "requirements", "stereotypes", "sub_models",
  ];
  for (const key of ARRAY_SECTIONS) {
    if (!Array.isArray((raw as any)[key])) {
      return err({ phase: "structure", message: `Section "${key}" must be an array` });
    }
  }

  const r = raw as Record<string, any>;

  const model: Model = {
    opmodel: r.opmodel,
    meta: r.meta,
    settings: r.settings,
    things: arrayToMap(r.things as Thing[]),
    states: arrayToMap(r.states as State[]),
    opds: arrayToMap(r.opds as OPD[]),
    links: arrayToMap(r.links as Link[]),
    modifiers: arrayToMap(r.modifiers as Modifier[]),
    appearances: appearancesToMap(r.appearances as Appearance[]),
    fans: arrayToMap(r.fans as Fan[]),
    scenarios: arrayToMap(r.scenarios as Scenario[]),
    assertions: arrayToMap(r.assertions as Assertion[]),
    requirements: arrayToMap(r.requirements as Requirement[]),
    stereotypes: arrayToMap(r.stereotypes as Stereotype[]),
    subModels: arrayToMap(r.sub_models as SubModel[]),
  };

  return ok(model);
}

function arrayToMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function appearancesToMap(items: Appearance[]): Map<string, Appearance> {
  return new Map(items.map((a) => [`${a.thing}::${a.opd}`, a]));
}
```

- [ ] **Step 4: Update index.ts**

Add: `export { loadModel, type LoadError } from "./serialization";`

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/serialization.test.ts`
Expected: All 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/serialization.ts packages/core/src/index.ts packages/core/tests/serialization.test.ts
git commit -m "feat(core): implement loadModel with structural validation and Map indexing"
```

---

### Task 6: Round-Trip Test (I-25)

**Files:**
- Modify: `packages/core/tests/serialization.test.ts`

Invariant I-25: `load(save(model)) === model` — the serialization round-trip preserves all data.

- [ ] **Step 1: Write round-trip test**

Add to `packages/core/tests/serialization.test.ts`:

```typescript
describe("round-trip (I-25)", () => {
  it("load(save(model)) preserves all data", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const r1 = loadModel(json);
    if (!isOk(r1)) throw new Error("Failed to load");

    const saved = saveModel(r1.value);
    const r2 = loadModel(saved);
    if (!isOk(r2)) throw new Error("Failed to reload");

    const m1 = r1.value;
    const m2 = r2.value;

    // Compare all entity counts
    expect(m2.things.size).toBe(m1.things.size);
    expect(m2.states.size).toBe(m1.states.size);
    expect(m2.opds.size).toBe(m1.opds.size);
    expect(m2.links.size).toBe(m1.links.size);
    expect(m2.modifiers.size).toBe(m1.modifiers.size);
    expect(m2.appearances.size).toBe(m1.appearances.size);

    // Compare specific entities
    expect(m2.things.get("obj-water")).toEqual(m1.things.get("obj-water"));
    expect(m2.links.get("lnk-barista-agent-coffee-making")).toEqual(
      m1.links.get("lnk-barista-agent-coffee-making")
    );
  });

  it("save(createModel()) produces valid JSON that re-loads", () => {
    const model = createModel("Round Trip Test", "natural");
    const json = saveModel(model);
    const result = loadModel(json);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.meta.name).toBe("Round Trip Test");
      expect(result.value.meta.system_type).toBe("natural");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bunx vitest run packages/core/tests/serialization.test.ts`
Expected: All 11 tests PASS. If any fail, debug the serialization logic (likely key sorting or null-omission issues).

- [ ] **Step 3: Commit**

```bash
git add packages/core/tests/serialization.test.ts
git commit -m "test(core): add round-trip test verifying I-25 (load∘save = id)"
```

---

## Chunk 3: Core API — Things & States

### Task 7: collectAllIds helper + addThing

**Files:**
- Create: `packages/core/src/helpers.ts`
- Create: `packages/core/src/api.ts`
- Test: `packages/core/tests/api.test.ts`

Guards: I-08 (unique ID globally).

- [ ] **Step 1: Write failing tests for addThing**

```typescript
// packages/core/tests/api.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing } from "../src/types";

const waterObj: Thing = {
  id: "obj-water",
  kind: "object",
  name: "Water",
  essence: "physical",
  affiliation: "systemic",
};

describe("addThing", () => {
  it("adds a thing to an empty model", () => {
    const model = createModel("Test");
    const result = addThing(model, waterObj);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.things.size).toBe(1);
    expect(result.value.things.get("obj-water")?.name).toBe("Water");
  });

  it("does not mutate original model (immutable)", () => {
    const model = createModel("Test");
    addThing(model, waterObj);
    expect(model.things.size).toBe(0);
  });

  it("rejects duplicate id (I-08)", () => {
    const model = createModel("Test");
    const r1 = addThing(model, waterObj);
    if (!isOk(r1)) return;
    const r2 = addThing(r1.value, { ...waterObj });
    expect(isErr(r2)).toBe(true);
    if (isErr(r2)) expect(r2.error.code).toBe("I-08");
  });

  it("rejects id colliding with existing state (I-08 global)", () => {
    const model = createModel("Test");
    const r1 = addThing(model, waterObj);
    if (!isOk(r1)) return;
    // Manually add a state to test cross-entity uniqueness
    const m = r1.value;
    const m2: typeof m = {
      ...m,
      states: new Map(m.states).set("state-x", {
        id: "state-x", parent: "obj-water", name: "x",
        initial: true, final: false, default: true,
      }),
    };
    const r2 = addThing(m2, {
      id: "state-x", kind: "object", name: "Clash",
      essence: "physical", affiliation: "systemic",
    });
    expect(isErr(r2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/api.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement collectAllIds helper**

```typescript
// packages/core/src/helpers.ts
import type { Model } from "./types";

export function collectAllIds(model: Model): Set<string> {
  const ids = new Set<string>();
  for (const id of model.things.keys()) ids.add(id);
  for (const id of model.states.keys()) ids.add(id);
  for (const id of model.opds.keys()) ids.add(id);
  for (const id of model.links.keys()) ids.add(id);
  for (const id of model.modifiers.keys()) ids.add(id);
  for (const id of model.fans.keys()) ids.add(id);
  for (const id of model.scenarios.keys()) ids.add(id);
  for (const id of model.assertions.keys()) ids.add(id);
  for (const id of model.requirements.keys()) ids.add(id);
  for (const id of model.stereotypes.keys()) ids.add(id);
  for (const id of model.subModels.keys()) ids.add(id);
  return ids;
}
```

- [ ] **Step 4: Implement addThing**

```typescript
// packages/core/src/api.ts
import type { Model, Thing } from "./types";
import type { InvariantError } from "./result";
import { ok, err, type Result } from "./result";
import { collectAllIds } from "./helpers";

export function addThing(
  model: Model,
  thing: Thing,
): Result<Model, InvariantError> {
  // I-08: unique ID globally
  if (collectAllIds(model).has(thing.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${thing.id}`, entity: thing.id });
  }

  return ok({
    ...model,
    things: new Map(model.things).set(thing.id, thing),
  });
}
```

- [ ] **Step 5: Update index.ts**

Add: `export { addThing } from "./api";`

- [ ] **Step 6: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/api.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/helpers.ts packages/core/src/api.ts packages/core/src/index.ts packages/core/tests/api.test.ts
git commit -m "feat(core): implement addThing with I-08 global uniqueness guard"
```

---

### Task 8: removeThing with Cascade Delete (I-02)

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api.test.ts`

Effect I-02: Delete(thing) cascades to states, links, modifiers, appearances, requirements.

- [ ] **Step 1: Write failing tests for removeThing**

Add to `packages/core/tests/api.test.ts`:

```typescript
import { addThing, removeThing, addState, addLink } from "../src/api";
import type { State, Link } from "../src/types";

describe("removeThing", () => {
  it("removes a thing", () => {
    const m0 = createModel("Test");
    const r1 = addThing(m0, waterObj);
    if (!isOk(r1)) return;
    const r2 = removeThing(r1.value, "obj-water");
    expect(isOk(r2)).toBe(true);
    if (isOk(r2)) expect(r2.value.things.size).toBe(0);
  });

  it("rejects removing non-existent thing", () => {
    const model = createModel("Test");
    const result = removeThing(model, "obj-ghost");
    expect(isErr(result)).toBe(true);
  });

  it("cascade deletes states (I-02)", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as any).value;
    const state: State = {
      id: "state-water-cold", parent: "obj-water", name: "cold",
      initial: true, final: false, default: true,
    };
    m = (addState(m, state) as any).value;
    expect(m.states.size).toBe(1);

    const r = removeThing(m, "obj-water");
    if (!isOk(r)) return;
    expect(r.value.states.size).toBe(0);
  });

  it("cascade deletes links touching thing (I-02)", () => {
    let m = createModel("Test");
    const proc: Thing = {
      id: "proc-heating", kind: "process", name: "Heating",
      essence: "physical", affiliation: "systemic",
    };
    m = (addThing(m, waterObj) as any).value;
    m = (addThing(m, proc) as any).value;
    const link: Link = {
      id: "lnk-effect", type: "effect",
      source: "proc-heating", target: "obj-water",
    };
    m = (addLink(m, link) as any).value;
    expect(m.links.size).toBe(1);

    const r = removeThing(m, "obj-water");
    if (!isOk(r)) return;
    expect(r.value.links.size).toBe(0);
  });

  it("cascade deletes appearances of thing (I-02)", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as any).value;
    m = {
      ...m,
      appearances: new Map(m.appearances).set("obj-water::opd-sd", {
        thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50,
      }),
    };

    const r = removeThing(m, "obj-water");
    if (!isOk(r)) return;
    expect(r.value.appearances.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/api.test.ts`
Expected: FAIL — `removeThing` not found.

- [ ] **Step 3: Implement removeThing with cascade**

Add to `packages/core/src/api.ts`:

```typescript
export function removeThing(
  model: Model,
  thingId: string,
): Result<Model, InvariantError> {
  if (!model.things.has(thingId)) {
    return err({ code: "NOT_FOUND", message: `Thing not found: ${thingId}`, entity: thingId });
  }

  // I-02 cascade: states, links, modifiers over those links, appearances, requirements
  const states = new Map(model.states);
  const stateIdsToRemove = new Set<string>();
  for (const [id, s] of states) {
    if (s.parent === thingId) {
      stateIdsToRemove.add(id);
      states.delete(id);
    }
  }

  const links = new Map(model.links);
  const linkIdsToRemove = new Set<string>();
  for (const [id, l] of links) {
    if (l.source === thingId || l.target === thingId) {
      linkIdsToRemove.add(id);
      links.delete(id);
    }
  }

  const modifiers = new Map(model.modifiers);
  for (const [id, m] of modifiers) {
    if (linkIdsToRemove.has(m.over)) {
      modifiers.delete(id);
    }
  }

  const appearances = new Map(model.appearances);
  for (const [key, a] of appearances) {
    if (a.thing === thingId) {
      appearances.delete(key);
    }
  }

  const requirements = new Map(model.requirements);
  for (const [id, r] of requirements) {
    if (r.target === thingId || stateIdsToRemove.has(r.target) || linkIdsToRemove.has(r.target)) {
      requirements.delete(id);
    }
  }

  // Cascade: fans that lost members (dangling references)
  const fans = new Map(model.fans);
  for (const [id, fan] of fans) {
    const remaining = fan.members.filter((m) => !linkIdsToRemove.has(m));
    if (remaining.length < 2) {
      fans.delete(id); // Fan invalid with < 2 members
    } else if (remaining.length < fan.members.length) {
      fans.set(id, { ...fan, members: remaining });
    }
  }

  // Cascade: assertions targeting this thing
  const assertions = new Map(model.assertions);
  for (const [id, a] of assertions) {
    if (a.target === thingId) assertions.delete(id);
  }

  // Cascade: stereotypes targeting this thing
  const stereotypes = new Map(model.stereotypes);
  for (const [id, s] of stereotypes) {
    if (s.thing === thingId) stereotypes.delete(id);
  }

  const things = new Map(model.things);
  things.delete(thingId);

  return ok({ ...model, things, states, links, modifiers, appearances, requirements, fans, assertions, stereotypes });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/api.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api.test.ts
git commit -m "feat(core): implement removeThing with I-02 cascade delete"
```

---

### Task 9: addState + removeState

**Files:**
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/tests/api.test.ts`

Guards: I-01 (parent must be object), I-08 (unique ID).

- [ ] **Step 1: Write failing tests for addState and removeState**

Add to `packages/core/tests/api.test.ts`:

```typescript
import { addState, removeState } from "../src/api";

describe("addState", () => {
  it("adds a state to an object", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as any).value;
    const state: State = {
      id: "state-water-cold", parent: "obj-water", name: "cold",
      initial: true, final: false, default: true,
    };
    const r = addState(m, state);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.states.size).toBe(1);
  });

  it("rejects state on non-existent parent (I-01)", () => {
    const m = createModel("Test");
    const state: State = {
      id: "state-ghost-x", parent: "obj-ghost", name: "x",
      initial: true, final: false, default: true,
    };
    const r = addState(m, state);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });

  it("rejects state on process (I-01: parent must be object)", () => {
    let m = createModel("Test");
    const proc: Thing = {
      id: "proc-heating", kind: "process", name: "Heating",
      essence: "physical", affiliation: "systemic",
    };
    m = (addThing(m, proc) as any).value;
    const state: State = {
      id: "state-heating-x", parent: "proc-heating", name: "x",
      initial: true, final: false, default: true,
    };
    const r = addState(m, state);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-01");
  });

  it("rejects duplicate id (I-08)", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as any).value;
    const state: State = {
      id: "state-water-cold", parent: "obj-water", name: "cold",
      initial: true, final: false, default: true,
    };
    m = (addState(m, state) as any).value;
    const r = addState(m, { ...state });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-08");
  });
});

describe("removeState", () => {
  it("removes a state", () => {
    let m = createModel("Test");
    m = (addThing(m, waterObj) as any).value;
    const state: State = {
      id: "state-water-cold", parent: "obj-water", name: "cold",
      initial: true, final: false, default: true,
    };
    m = (addState(m, state) as any).value;
    const r = removeState(m, "state-water-cold");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.states.size).toBe(0);
  });

  it("rejects removing non-existent state", () => {
    const r = removeState(createModel("Test"), "state-ghost");
    expect(isErr(r)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/api.test.ts`
Expected: FAIL — `addState`, `removeState` not found.

- [ ] **Step 3: Implement addState and removeState**

Add to `packages/core/src/api.ts`:

```typescript
import type { Model, Thing, State, Link } from "./types";

export function addState(
  model: Model,
  state: State,
): Result<Model, InvariantError> {
  // I-08: unique ID
  if (collectAllIds(model).has(state.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${state.id}`, entity: state.id });
  }

  // I-01: parent must be object
  const parent = model.things.get(state.parent);
  if (!parent) {
    return err({ code: "I-01", message: `Parent thing not found: ${state.parent}`, entity: state.id });
  }
  if (parent.kind !== "object") {
    return err({ code: "I-01", message: `State parent must be object, got process: ${state.parent}`, entity: state.id });
  }

  return ok({
    ...model,
    states: new Map(model.states).set(state.id, state),
  });
}

export function removeState(
  model: Model,
  stateId: string,
): Result<Model, InvariantError> {
  if (!model.states.has(stateId)) {
    return err({ code: "NOT_FOUND", message: `State not found: ${stateId}`, entity: stateId });
  }

  const states = new Map(model.states);
  states.delete(stateId);
  return ok({ ...model, states });
}
```

- [ ] **Step 4: Update index.ts**

Add: `export { addThing, removeThing, addState, removeState } from "./api";`

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/api.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/src/index.ts packages/core/tests/api.test.ts
git commit -m "feat(core): implement addState/removeState with I-01 and I-08 guards"
```

---

## Chunk 4: Core API — Links, OPDs, Appearances & Batch Validate

### Task 10: addLink + removeLink

**Files:**
- Modify: `packages/core/src/api.ts`
- Create: `packages/core/tests/api-links.test.ts`

Guards: I-05 (endpoints exist), I-08 (unique ID), I-18 (agent source must be physical), I-19 effect (exhibition forces informatical essence).

- [ ] **Step 1: Write failing tests for addLink**

```typescript
// packages/core/tests/api-links.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, removeLink } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, Link } from "../src/types";

const barista: Thing = {
  id: "obj-barista", kind: "object", name: "Barista",
  essence: "physical", affiliation: "systemic",
};
const water: Thing = {
  id: "obj-water", kind: "object", name: "Water",
  essence: "physical", affiliation: "systemic",
};
const heating: Thing = {
  id: "proc-heating", kind: "process", name: "Heating",
  essence: "physical", affiliation: "systemic",
};

function buildModel() {
  let m = createModel("Test");
  m = (addThing(m, barista) as any).value;
  m = (addThing(m, water) as any).value;
  m = (addThing(m, heating) as any).value;
  return m;
}

describe("addLink", () => {
  it("adds a valid link", () => {
    const m = buildModel();
    const link: Link = {
      id: "lnk-agent", type: "agent",
      source: "obj-barista", target: "proc-heating",
    };
    const r = addLink(m, link);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.links.size).toBe(1);
  });

  it("rejects link with non-existent source (I-05)", () => {
    const m = buildModel();
    const link: Link = {
      id: "lnk-bad", type: "effect",
      source: "proc-ghost", target: "obj-water",
    };
    const r = addLink(m, link);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("rejects link with non-existent target (I-05)", () => {
    const m = buildModel();
    const link: Link = {
      id: "lnk-bad", type: "effect",
      source: "proc-heating", target: "obj-ghost",
    };
    const r = addLink(m, link);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("rejects duplicate id (I-08)", () => {
    let m = buildModel();
    const link: Link = {
      id: "lnk-agent", type: "agent",
      source: "obj-barista", target: "proc-heating",
    };
    m = (addLink(m, link) as any).value;
    const r = addLink(m, { ...link });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-08");
  });

  it("exhibition link coerces source essence to informatical (I-19)", () => {
    const attr: Thing = {
      id: "obj-attr", kind: "object", name: "Color",
      essence: "physical", affiliation: "systemic",
    };
    let m = buildModel();
    m = (addThing(m, attr) as any).value;
    const link: Link = {
      id: "lnk-exhibit", type: "exhibition",
      source: "obj-attr", target: "obj-water",
    };
    const r = addLink(m, link);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      // I-19 effect: source thing's essence forced to informatical
      expect(r.value.things.get("obj-attr")?.essence).toBe("informatical");
    }
  });
});

describe("removeLink", () => {
  it("removes an existing link", () => {
    let m = buildModel();
    const link: Link = {
      id: "lnk-agent", type: "agent",
      source: "obj-barista", target: "proc-heating",
    };
    m = (addLink(m, link) as any).value;
    const r = removeLink(m, "lnk-agent");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.links.size).toBe(0);
  });

  it("cascade removes modifiers over the link", () => {
    let m = buildModel();
    const link: Link = {
      id: "lnk-effect", type: "effect",
      source: "proc-heating", target: "obj-water",
    };
    m = (addLink(m, link) as any).value;
    m = {
      ...m,
      modifiers: new Map(m.modifiers).set("mod-ev", {
        id: "mod-ev", over: "lnk-effect", type: "event",
      }),
    };
    const r = removeLink(m, "lnk-effect");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.modifiers.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/api-links.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement addLink and removeLink**

Add to `packages/core/src/api.ts`:

```typescript
export function addLink(
  model: Model,
  link: Link,
): Result<Model, InvariantError> {
  // I-08: unique ID
  if (collectAllIds(model).has(link.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${link.id}`, entity: link.id });
  }

  // I-05: source and target must exist (as things)
  if (!model.things.has(link.source)) {
    return err({ code: "I-05", message: `Source thing not found: ${link.source}`, entity: link.id });
  }
  if (!model.things.has(link.target)) {
    return err({ code: "I-05", message: `Target thing not found: ${link.target}`, entity: link.id });
  }

  // I-18: agent source must be physical
  if (link.type === "agent") {
    const source = model.things.get(link.source)!;
    if (source.essence !== "physical") {
      return err({ code: "I-18", message: `Agent source must be physical: ${link.source}`, entity: link.id });
    }
  }

  // I-14: exception link requires source process to have duration.max
  if (link.type === "exception") {
    const source = model.things.get(link.source)!;
    if (!source.duration?.max) {
      return err({ code: "I-14", message: `Exception source must have duration.max: ${link.source}`, entity: link.id });
    }
  }

  let things = model.things;

  // I-19 effect: exhibition forces source.essence := informatical
  if (link.type === "exhibition") {
    const source = things.get(link.source)!;
    if (source.essence !== "informatical") {
      things = new Map(things).set(source.id, { ...source, essence: "informatical" });
    }
  }

  return ok({
    ...model,
    things,
    links: new Map(model.links).set(link.id, link),
  });
}

export function removeLink(
  model: Model,
  linkId: string,
): Result<Model, InvariantError> {
  if (!model.links.has(linkId)) {
    return err({ code: "NOT_FOUND", message: `Link not found: ${linkId}`, entity: linkId });
  }

  const links = new Map(model.links);
  links.delete(linkId);

  // Cascade: remove modifiers over this link
  const modifiers = new Map(model.modifiers);
  for (const [id, m] of modifiers) {
    if (m.over === linkId) modifiers.delete(id);
  }

  // Cascade: remove fans that lost this member
  const fans = new Map(model.fans);
  for (const [id, fan] of fans) {
    if (fan.members.includes(linkId)) {
      const remaining = fan.members.filter((m) => m !== linkId);
      if (remaining.length < 2) {
        fans.delete(id);
      } else {
        fans.set(id, { ...fan, members: remaining });
      }
    }
  }

  return ok({ ...model, links, modifiers, fans });
}
```

- [ ] **Step 4: Update index.ts exports**

Add `addLink, removeLink` to exports from `./api`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/api-links.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/src/index.ts packages/core/tests/api-links.test.ts
git commit -m "feat(core): implement addLink/removeLink with I-05, I-08, I-19 guards"
```

---

### Task 11: addOPD + removeOPD

**Files:**
- Modify: `packages/core/src/api.ts`
- Create: `packages/core/tests/api-opds.test.ts`

Guards: I-03 (OPD tree — hierarchical forms acyclic tree, view has parent_opd=null), I-08 (unique ID).

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/tests/api-opds.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addOPD, removeOPD } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { OPD } from "../src/types";

describe("addOPD", () => {
  it("adds a hierarchical child OPD", () => {
    const m = createModel("Test");
    const opd: OPD = {
      id: "opd-sd1", name: "SD1", opd_type: "hierarchical",
      parent_opd: "opd-sd",
    };
    const r = addOPD(m, opd);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.opds.size).toBe(2);
  });

  it("rejects hierarchical OPD with non-existent parent (I-03)", () => {
    const m = createModel("Test");
    const opd: OPD = {
      id: "opd-orphan", name: "Orphan", opd_type: "hierarchical",
      parent_opd: "opd-ghost",
    };
    const r = addOPD(m, opd);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-03");
  });

  it("adds a view OPD with parent_opd=null", () => {
    const m = createModel("Test");
    const opd: OPD = {
      id: "opd-view1", name: "View 1", opd_type: "view",
      parent_opd: null,
    };
    const r = addOPD(m, opd);
    expect(isOk(r)).toBe(true);
  });

  it("rejects duplicate id (I-08)", () => {
    const m = createModel("Test");
    const opd: OPD = {
      id: "opd-sd", name: "Clash", opd_type: "hierarchical",
      parent_opd: null,
    };
    const r = addOPD(m, opd);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-08");
  });
});

describe("removeOPD", () => {
  it("removes an OPD", () => {
    let m = createModel("Test");
    const opd: OPD = {
      id: "opd-sd1", name: "SD1", opd_type: "hierarchical",
      parent_opd: "opd-sd",
    };
    m = (addOPD(m, opd) as any).value;
    const r = removeOPD(m, "opd-sd1");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.opds.size).toBe(1);
  });

  it("cascade removes appearances in removed OPD", () => {
    let m = createModel("Test");
    const opd: OPD = {
      id: "opd-sd1", name: "SD1", opd_type: "hierarchical",
      parent_opd: "opd-sd",
    };
    m = (addOPD(m, opd) as any).value;
    m = {
      ...m,
      appearances: new Map(m.appearances).set("obj-x::opd-sd1", {
        thing: "obj-x", opd: "opd-sd1", x: 0, y: 0, w: 100, h: 50,
      }),
    };
    const r = removeOPD(m, "opd-sd1");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.appearances.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/api-opds.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement addOPD and removeOPD**

Add to `packages/core/src/api.ts`:

```typescript
import type { Model, Thing, State, Link, OPD, Appearance } from "./types";

export function addOPD(
  model: Model,
  opd: OPD,
): Result<Model, InvariantError> {
  // I-08
  if (collectAllIds(model).has(opd.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${opd.id}`, entity: opd.id });
  }

  // I-03: hierarchical OPD parent must exist
  if (opd.opd_type === "hierarchical" && opd.parent_opd !== null) {
    if (!model.opds.has(opd.parent_opd)) {
      return err({ code: "I-03", message: `Parent OPD not found: ${opd.parent_opd}`, entity: opd.id });
    }
  }

  return ok({
    ...model,
    opds: new Map(model.opds).set(opd.id, opd),
  });
}

export function removeOPD(
  model: Model,
  opdId: string,
): Result<Model, InvariantError> {
  if (!model.opds.has(opdId)) {
    return err({ code: "NOT_FOUND", message: `OPD not found: ${opdId}`, entity: opdId });
  }

  // Collect this OPD and all descendant OPDs recursively
  const opdsToRemove = new Set<string>();
  const collectDescendants = (parentId: string) => {
    opdsToRemove.add(parentId);
    for (const [id, opd] of model.opds) {
      if (opd.parent_opd === parentId && !opdsToRemove.has(id)) {
        collectDescendants(id);
      }
    }
  };
  collectDescendants(opdId);

  const opds = new Map(model.opds);
  for (const id of opdsToRemove) opds.delete(id);

  // Cascade: remove appearances in any removed OPD
  const appearances = new Map(model.appearances);
  for (const [key, a] of appearances) {
    if (opdsToRemove.has(a.opd)) appearances.delete(key);
  }

  return ok({ ...model, opds, appearances });
}
```

- [ ] **Step 4: Update index.ts exports**

Add `addOPD, removeOPD`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/api-opds.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/src/index.ts packages/core/tests/api-opds.test.ts
git commit -m "feat(core): implement addOPD/removeOPD with I-03 and I-08 guards"
```

---

### Task 12: addAppearance + removeAppearance

**Files:**
- Modify: `packages/core/src/api.ts`
- Create: `packages/core/tests/api-appearances.test.ts`

Guards: I-04 (appearance unique per thing+opd), I-15 (internal only in refinement OPDs).

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/tests/api-appearances.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addOPD, addAppearance, removeAppearance } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, OPD, Appearance } from "../src/types";

const water: Thing = {
  id: "obj-water", kind: "object", name: "Water",
  essence: "physical", affiliation: "systemic",
};

describe("addAppearance", () => {
  it("adds an appearance", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const app: Appearance = {
      thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50,
    };
    const r = addAppearance(m, app);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.appearances.size).toBe(1);
  });

  it("rejects duplicate thing+opd (I-04)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const app: Appearance = {
      thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50,
    };
    m = (addAppearance(m, app) as any).value;
    const r = addAppearance(m, { ...app, x: 100 });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-04");
  });

  it("rejects internal=true in non-refinement OPD (I-15)", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const app: Appearance = {
      thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50,
      internal: true,
    };
    const r = addAppearance(m, app);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-15");
  });

  it("allows internal=true in refinement OPD (I-15 satisfied)", () => {
    let m = createModel("Test");
    const proc: Thing = {
      id: "proc-heating", kind: "process", name: "Heating",
      essence: "physical", affiliation: "systemic",
    };
    m = (addThing(m, water) as any).value;
    m = (addThing(m, proc) as any).value;
    const sd1: OPD = {
      id: "opd-sd1", name: "SD1", opd_type: "hierarchical",
      parent_opd: "opd-sd", refines: "proc-heating", refinement_type: "in-zoom",
    };
    m = (addOPD(m, sd1) as any).value;
    const app: Appearance = {
      thing: "obj-water", opd: "opd-sd1", x: 50, y: 50, w: 120, h: 50,
      internal: true,
    };
    const r = addAppearance(m, app);
    expect(isOk(r)).toBe(true);
  });
});

describe("removeAppearance", () => {
  it("removes by thing+opd key", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    const app: Appearance = {
      thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50,
    };
    m = (addAppearance(m, app) as any).value;
    const r = removeAppearance(m, "obj-water", "opd-sd");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.appearances.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/api-appearances.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement addAppearance and removeAppearance**

Add to `packages/core/src/api.ts`:

```typescript
export function addAppearance(
  model: Model,
  appearance: Appearance,
): Result<Model, InvariantError> {
  const key = `${appearance.thing}::${appearance.opd}`;

  // I-04: unique per (thing, opd)
  if (model.appearances.has(key)) {
    return err({ code: "I-04", message: `Appearance already exists: ${key}`, entity: key });
  }

  // I-15: internal only in refinement OPDs
  if (appearance.internal) {
    const opd = model.opds.get(appearance.opd);
    if (!opd || !opd.refines) {
      return err({
        code: "I-15",
        message: `internal=true only allowed in refinement OPDs, but ${appearance.opd} has no refines`,
        entity: key,
      });
    }
  }

  return ok({
    ...model,
    appearances: new Map(model.appearances).set(key, appearance),
  });
}

export function removeAppearance(
  model: Model,
  thing: string,
  opd: string,
): Result<Model, InvariantError> {
  const key = `${thing}::${opd}`;
  if (!model.appearances.has(key)) {
    return err({ code: "NOT_FOUND", message: `Appearance not found: ${key}`, entity: key });
  }

  const appearances = new Map(model.appearances);
  appearances.delete(key);
  return ok({ ...model, appearances });
}
```

- [ ] **Step 4: Update index.ts exports**

Add `addAppearance, removeAppearance`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run packages/core/tests/api-appearances.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/src/index.ts packages/core/tests/api-appearances.test.ts
git commit -m "feat(core): implement addAppearance/removeAppearance with I-04 and I-15 guards"
```

---

### Task 13: Remaining Entity Mutations + Batch Validate

**Files:**
- Modify: `packages/core/src/api.ts`
- Create: `packages/core/tests/api-secondary.test.ts`

Add/remove for: Modifier (I-06), Fan (I-07), Scenario, Assertion (I-09), Requirement (I-10), Stereotype (I-11), SubModel (I-12).
Plus: `validate(model)` batch validator.

- [ ] **Step 1: Write failing tests for secondary entities + validate**

```typescript
// packages/core/tests/api-secondary.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, addLink, addModifier, removeModifier,
  addFan, removeFan, addAssertion, addRequirement,
  addStereotype, addSubModel, validate,
} from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, Link, Modifier, Fan } from "../src/types";

const water: Thing = {
  id: "obj-water", kind: "object", name: "Water",
  essence: "physical", affiliation: "systemic",
};
const proc: Thing = {
  id: "proc-heating", kind: "process", name: "Heating",
  essence: "physical", affiliation: "systemic",
};

describe("addModifier", () => {
  it("adds modifier to existing link", () => {
    let m = createModel("Test");
    m = (addThing(m, water) as any).value;
    m = (addThing(m, proc) as any).value;
    const link: Link = {
      id: "lnk-effect", type: "effect",
      source: "proc-heating", target: "obj-water",
    };
    m = (addLink(m, link) as any).value;
    const mod: Modifier = {
      id: "mod-ev", over: "lnk-effect", type: "event",
    };
    const r = addModifier(m, mod);
    expect(isOk(r)).toBe(true);
  });

  it("rejects modifier on non-existent link (I-06)", () => {
    const m = createModel("Test");
    const mod: Modifier = {
      id: "mod-ev", over: "lnk-ghost", type: "event",
    };
    const r = addModifier(m, mod);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-06");
  });
});

describe("addFan", () => {
  it("rejects fan with non-existent member links (I-07)", () => {
    const m = createModel("Test");
    const fan: Fan = {
      id: "fan-1", type: "xor", members: ["lnk-ghost-1", "lnk-ghost-2"],
    };
    const r = addFan(m, fan);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-07");
  });
});

describe("validate", () => {
  it("returns empty array for valid model", () => {
    const m = createModel("Test");
    const errors = validate(m);
    expect(errors).toEqual([]);
  });

  it("catches orphaned state parent (I-01)", () => {
    let m = createModel("Test");
    // Manually insert invalid state (bypassing addState guard)
    m = {
      ...m,
      states: new Map(m.states).set("state-orphan", {
        id: "state-orphan", parent: "obj-ghost", name: "orphan",
        initial: true, final: false, default: true,
      }),
    };
    const errors = validate(m);
    expect(errors.some((e) => e.code === "I-01")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/core/tests/api-secondary.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement secondary entity mutations**

Add to `packages/core/src/api.ts`:

```typescript
import type {
  Model, Thing, State, Link, OPD, Appearance,
  Modifier, Fan, Scenario, Assertion, Requirement,
  Stereotype, SubModel,
} from "./types";

// --- Modifier ---

export function addModifier(model: Model, mod: Modifier): Result<Model, InvariantError> {
  if (collectAllIds(model).has(mod.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${mod.id}`, entity: mod.id });
  }
  // I-06: target link must exist
  if (!model.links.has(mod.over)) {
    return err({ code: "I-06", message: `Link not found: ${mod.over}`, entity: mod.id });
  }
  return ok({ ...model, modifiers: new Map(model.modifiers).set(mod.id, mod) });
}

export function removeModifier(model: Model, modId: string): Result<Model, InvariantError> {
  if (!model.modifiers.has(modId)) {
    return err({ code: "NOT_FOUND", message: `Modifier not found: ${modId}`, entity: modId });
  }
  const modifiers = new Map(model.modifiers);
  modifiers.delete(modId);
  return ok({ ...model, modifiers });
}

// --- Fan ---

export function addFan(model: Model, fan: Fan): Result<Model, InvariantError> {
  if (collectAllIds(model).has(fan.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${fan.id}`, entity: fan.id });
  }
  // I-07: members >= 2 and all must exist
  if (fan.members.length < 2) {
    return err({ code: "I-07", message: `Fan must have at least 2 members, got ${fan.members.length}`, entity: fan.id });
  }
  for (const memberId of fan.members) {
    if (!model.links.has(memberId)) {
      return err({ code: "I-07", message: `Fan member link not found: ${memberId}`, entity: fan.id });
    }
  }
  return ok({ ...model, fans: new Map(model.fans).set(fan.id, fan) });
}

export function removeFan(model: Model, fanId: string): Result<Model, InvariantError> {
  if (!model.fans.has(fanId)) {
    return err({ code: "NOT_FOUND", message: `Fan not found: ${fanId}`, entity: fanId });
  }
  const fans = new Map(model.fans);
  fans.delete(fanId);
  return ok({ ...model, fans });
}

// --- Assertion ---

export function addAssertion(model: Model, assertion: Assertion): Result<Model, InvariantError> {
  if (collectAllIds(model).has(assertion.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${assertion.id}`, entity: assertion.id });
  }
  // I-09: target must exist or be null
  if (assertion.target != null && !model.things.has(assertion.target) && !model.links.has(assertion.target)) {
    return err({ code: "I-09", message: `Assertion target not found: ${assertion.target}`, entity: assertion.id });
  }
  return ok({ ...model, assertions: new Map(model.assertions).set(assertion.id, assertion) });
}

// --- Requirement ---

export function addRequirement(model: Model, req: Requirement): Result<Model, InvariantError> {
  if (collectAllIds(model).has(req.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${req.id}`, entity: req.id });
  }
  // I-10: target must exist
  if (!model.things.has(req.target) && !model.states.has(req.target) && !model.links.has(req.target)) {
    return err({ code: "I-10", message: `Requirement target not found: ${req.target}`, entity: req.id });
  }
  return ok({ ...model, requirements: new Map(model.requirements).set(req.id, req) });
}

// --- Stereotype ---

export function addStereotype(model: Model, stp: Stereotype): Result<Model, InvariantError> {
  if (collectAllIds(model).has(stp.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${stp.id}`, entity: stp.id });
  }
  // I-11: thing must exist
  if (!model.things.has(stp.thing)) {
    return err({ code: "I-11", message: `Stereotype target thing not found: ${stp.thing}`, entity: stp.id });
  }
  return ok({ ...model, stereotypes: new Map(model.stereotypes).set(stp.id, stp) });
}

// --- SubModel ---

export function addSubModel(model: Model, sub: SubModel): Result<Model, InvariantError> {
  if (collectAllIds(model).has(sub.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${sub.id}`, entity: sub.id });
  }
  // I-12: shared things must exist
  for (const thingId of sub.shared_things) {
    if (!model.things.has(thingId)) {
      return err({ code: "I-12", message: `Shared thing not found: ${thingId}`, entity: sub.id });
    }
  }
  return ok({ ...model, subModels: new Map(model.subModels).set(sub.id, sub) });
}

// --- Scenario ---

export function addScenario(model: Model, scn: Scenario): Result<Model, InvariantError> {
  if (collectAllIds(model).has(scn.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${scn.id}`, entity: scn.id });
  }
  // I-13: path labels must exist in links
  const allPathLabels = new Set(
    [...model.links.values()].map((l) => l.path_label).filter(Boolean)
  );
  for (const pl of scn.path_labels) {
    if (!allPathLabels.has(pl)) {
      return err({ code: "I-13", message: `Path label not found in any link: ${pl}`, entity: scn.id });
    }
  }
  return ok({ ...model, scenarios: new Map(model.scenarios).set(scn.id, scn) });
}

// --- Remove functions for secondary entities ---

export function removeScenario(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.scenarios.has(id)) return err({ code: "NOT_FOUND", message: `Scenario not found: ${id}`, entity: id });
  const scenarios = new Map(model.scenarios);
  scenarios.delete(id);
  return ok({ ...model, scenarios });
}

export function removeAssertion(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.assertions.has(id)) return err({ code: "NOT_FOUND", message: `Assertion not found: ${id}`, entity: id });
  const assertions = new Map(model.assertions);
  assertions.delete(id);
  return ok({ ...model, assertions });
}

export function removeRequirement(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.requirements.has(id)) return err({ code: "NOT_FOUND", message: `Requirement not found: ${id}`, entity: id });
  const requirements = new Map(model.requirements);
  requirements.delete(id);
  return ok({ ...model, requirements });
}

export function removeStereotype(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.stereotypes.has(id)) return err({ code: "NOT_FOUND", message: `Stereotype not found: ${id}`, entity: id });
  const stereotypes = new Map(model.stereotypes);
  stereotypes.delete(id);
  return ok({ ...model, stereotypes });
}

export function removeSubModel(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.subModels.has(id)) return err({ code: "NOT_FOUND", message: `SubModel not found: ${id}`, entity: id });
  const subModels = new Map(model.subModels);
  subModels.delete(id);
  return ok({ ...model, subModels });
}
```

- [ ] **Step 4: Implement batch validate**

Add to `packages/core/src/api.ts`:

```typescript
export function validate(model: Model): InvariantError[] {
  const errors: InvariantError[] = [];

  // I-01: every state.parent must be an existing object
  for (const [id, state] of model.states) {
    const parent = model.things.get(state.parent);
    if (!parent) {
      errors.push({ code: "I-01", message: `State ${id} parent not found: ${state.parent}`, entity: id });
    } else if (parent.kind !== "object") {
      errors.push({ code: "I-01", message: `State ${id} parent must be object: ${state.parent}`, entity: id });
    }
  }

  // I-05: link endpoints exist
  for (const [id, link] of model.links) {
    if (!model.things.has(link.source)) {
      errors.push({ code: "I-05", message: `Link ${id} source not found: ${link.source}`, entity: id });
    }
    if (!model.things.has(link.target)) {
      errors.push({ code: "I-05", message: `Link ${id} target not found: ${link.target}`, entity: id });
    }
  }

  // I-06: modifier targets exist
  for (const [id, mod] of model.modifiers) {
    if (!model.links.has(mod.over)) {
      errors.push({ code: "I-06", message: `Modifier ${id} link not found: ${mod.over}`, entity: id });
    }
  }

  // I-03: OPD tree — hierarchical parent exists, views have null parent
  for (const [id, opd] of model.opds) {
    if (opd.opd_type === "hierarchical" && opd.parent_opd !== null) {
      if (!model.opds.has(opd.parent_opd)) {
        errors.push({ code: "I-03", message: `OPD ${id} parent not found: ${opd.parent_opd}`, entity: id });
      }
    }
    if (opd.opd_type === "view" && opd.parent_opd !== null) {
      errors.push({ code: "I-03", message: `View OPD ${id} must have parent_opd=null`, entity: id });
    }
  }

  // I-04: appearance (thing, opd) uniqueness — checked via Map key
  // (inherently unique if loaded correctly, but verify no duplicates)

  // I-07: fan members exist and >= 2
  for (const [id, fan] of model.fans) {
    if (fan.members.length < 2) {
      errors.push({ code: "I-07", message: `Fan ${id} must have >= 2 members`, entity: id });
    }
    for (const memberId of fan.members) {
      if (!model.links.has(memberId)) {
        errors.push({ code: "I-07", message: `Fan ${id} member not found: ${memberId}`, entity: id });
      }
    }
  }

  // I-08: global ID uniqueness (check for duplicates across Maps)
  const seen = new Map<string, string>();
  const checkId = (id: string, collection: string) => {
    if (seen.has(id)) {
      errors.push({ code: "I-08", message: `Duplicate id ${id} in ${collection} and ${seen.get(id)}`, entity: id });
    }
    seen.set(id, collection);
  };
  for (const id of model.things.keys()) checkId(id, "things");
  for (const id of model.states.keys()) checkId(id, "states");
  for (const id of model.opds.keys()) checkId(id, "opds");
  for (const id of model.links.keys()) checkId(id, "links");
  for (const id of model.modifiers.keys()) checkId(id, "modifiers");
  for (const id of model.fans.keys()) checkId(id, "fans");
  for (const id of model.scenarios.keys()) checkId(id, "scenarios");
  for (const id of model.assertions.keys()) checkId(id, "assertions");
  for (const id of model.requirements.keys()) checkId(id, "requirements");
  for (const id of model.stereotypes.keys()) checkId(id, "stereotypes");
  for (const id of model.subModels.keys()) checkId(id, "subModels");

  // I-09: assertion target exists (or null)
  for (const [id, a] of model.assertions) {
    if (a.target != null && !model.things.has(a.target) && !model.links.has(a.target)) {
      errors.push({ code: "I-09", message: `Assertion ${id} target not found: ${a.target}`, entity: id });
    }
  }

  // I-10: requirement target exists
  for (const [id, req] of model.requirements) {
    if (!model.things.has(req.target) && !model.states.has(req.target) && !model.links.has(req.target)) {
      errors.push({ code: "I-10", message: `Requirement ${id} target not found: ${req.target}`, entity: id });
    }
  }

  // I-11: stereotype thing exists
  for (const [id, stp] of model.stereotypes) {
    if (!model.things.has(stp.thing)) {
      errors.push({ code: "I-11", message: `Stereotype ${id} thing not found: ${stp.thing}`, entity: id });
    }
  }

  // I-12: sub-model shared things exist
  for (const [id, sub] of model.subModels) {
    for (const thingId of sub.shared_things) {
      if (!model.things.has(thingId)) {
        errors.push({ code: "I-12", message: `SubModel ${id} shared thing not found: ${thingId}`, entity: id });
      }
    }
  }

  // I-13: scenario path_labels exist in links
  const allPathLabels = new Set(
    [...model.links.values()].map((l) => l.path_label).filter(Boolean) as string[]
  );
  for (const [id, scn] of model.scenarios) {
    for (const pl of scn.path_labels) {
      if (!allPathLabels.has(pl)) {
        errors.push({ code: "I-13", message: `Scenario ${id} path label not found: ${pl}`, entity: id });
      }
    }
  }

  // I-14: exception link source must have duration.max
  for (const [id, link] of model.links) {
    if (link.type === "exception") {
      const source = model.things.get(link.source);
      if (source && !source.duration?.max) {
        errors.push({ code: "I-14", message: `Exception link ${id} source must have duration.max`, entity: id });
      }
    }
  }

  // I-15: internal appearance only in refinement OPDs
  for (const [key, app] of model.appearances) {
    if (app.internal) {
      const opd = model.opds.get(app.opd);
      if (!opd || !opd.refines) {
        errors.push({ code: "I-15", message: `Appearance ${key} internal=true in non-refinement OPD`, entity: key });
      }
    }
  }

  // I-18: agent source must be physical
  for (const [id, link] of model.links) {
    if (link.type === "agent") {
      const source = model.things.get(link.source);
      if (source && source.essence !== "physical") {
        errors.push({ code: "I-18", message: `Agent link ${id} source must be physical`, entity: id });
      }
    }
  }

  // I-19: exhibition source must be informatical
  for (const [id, link] of model.links) {
    if (link.type === "exhibition") {
      const source = model.things.get(link.source);
      if (source && source.essence !== "informatical") {
        errors.push({ code: "I-19", message: `Exhibition link ${id} source must be informatical`, entity: id });
      }
    }
  }

  return errors;
}
```

- [ ] **Step 5: Update index.ts with all exports**

```typescript
// packages/core/src/index.ts
export * from "./types";
export * from "./result";
export { createModel } from "./model";
export { loadModel, saveModel, type LoadError } from "./serialization";
export {
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
  validate,
} from "./api";
```

- [ ] **Step 6: Run all tests**

Run: `bunx vitest run`
Expected: All tests PASS across all test files.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/ packages/core/tests/
git commit -m "feat(core): implement remaining entity mutations and batch validate

Adds: addModifier (I-06), addFan (I-07), addAssertion (I-09),
addRequirement (I-10), addStereotype (I-11), addSubModel (I-12),
addScenario (I-13), and validate() batch checker."
```

---

## Chunk 5: Integration Test & Final Verification

### Task 14: Coffee Making System End-to-End Test

**Files:**
- Create: `packages/core/tests/integration.test.ts`

Build the Coffee Making example from scratch using the API, then verify it round-trips with the fixture file.

- [ ] **Step 1: Write integration test**

```typescript
// packages/core/tests/integration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createModel } from "../src/model";
import { loadModel, saveModel } from "../src/serialization";
import {
  addThing, addState, addLink, addOPD,
  addAppearance, addModifier, addAssertion, validate,
} from "../src/api";
import { isOk, type Result } from "../src/result";
import type { Model } from "../src/types";

// Test utility: unwrap Result or throw with context
function unwrap<T>(r: Result<T, any>, context = ""): T {
  if (!isOk(r)) throw new Error(`Expected ok${context ? ` (${context})` : ""}: ${JSON.stringify(r.error)}`);
  return r.value;
}

describe("Coffee Making System (end-to-end)", () => {
  it("builds the full model via API and validates", () => {
    let m = createModel("Coffee Making System", "artificial");

    // Things
    m = unwrap(addThing(m, { id: "obj-barista", kind: "object", name: "Barista", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-coffee", kind: "object", name: "Coffee", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-coffee-beans", kind: "object", name: "Coffee Beans", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "proc-coffee-making", kind: "process", name: "Coffee Making", essence: "physical", affiliation: "systemic", duration: { nominal: 120, unit: "s" } }));

    // States
    m = unwrap(addState(m, { id: "state-coffee-unmade", parent: "obj-coffee", name: "unmade", initial: true, final: false, default: true, current: true }));
    m = unwrap(addState(m, { id: "state-coffee-ready", parent: "obj-coffee", name: "ready", initial: false, final: true, default: false }));
    m = unwrap(addState(m, { id: "state-water-cold", parent: "obj-water", name: "cold", initial: true, final: false, default: true, current: true }));
    m = unwrap(addState(m, { id: "state-water-hot", parent: "obj-water", name: "hot", initial: false, final: true, default: false }));

    // OPDs (SD already created)
    m = unwrap(addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-coffee-making", refinement_type: "in-zoom" }));

    // Links
    m = unwrap(addLink(m, { id: "lnk-barista-agent-coffee-making", type: "agent", source: "obj-barista", target: "proc-coffee-making" }));
    m = unwrap(addLink(m, { id: "lnk-coffee-making-consumption-beans", type: "consumption", source: "proc-coffee-making", target: "obj-coffee-beans" }));
    m = unwrap(addLink(m, { id: "lnk-coffee-making-consumption-water", type: "consumption", source: "proc-coffee-making", target: "obj-water" }));
    m = unwrap(addLink(m, { id: "lnk-coffee-making-effect-water", type: "effect", source: "proc-coffee-making", target: "obj-water", source_state: "state-water-cold", target_state: "state-water-hot" }));
    m = unwrap(addLink(m, { id: "lnk-coffee-making-result-coffee", type: "result", source: "proc-coffee-making", target: "obj-coffee" }));

    // Modifier
    m = unwrap(addModifier(m, { id: "mod-water-event", over: "lnk-coffee-making-effect-water", type: "event" }));

    // Appearances
    m = unwrap(addAppearance(m, { thing: "obj-barista", opd: "opd-sd", x: 50, y: 50, w: 120, h: 50 }));
    m = unwrap(addAppearance(m, { thing: "obj-coffee", opd: "opd-sd", x: 500, y: 200, w: 120, h: 50 }));
    m = unwrap(addAppearance(m, { thing: "obj-coffee-beans", opd: "opd-sd", x: 50, y: 200, w: 140, h: 50 }));
    m = unwrap(addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 350, w: 120, h: 50 }));
    m = unwrap(addAppearance(m, { thing: "proc-coffee-making", opd: "opd-sd", x: 280, y: 180, w: 180, h: 80 }));
    m = unwrap(addAppearance(m, { thing: "obj-water", opd: "opd-sd1", x: 50, y: 100, w: 120, h: 50, internal: false }));

    // Assertion
    m = unwrap(addAssertion(m, { id: "ast-coffee-ready", target: "proc-coffee-making", predicate: "after Coffee Making, Coffee is ready", category: "correctness", enabled: true }));

    // Validate
    const errors = validate(m);
    expect(errors).toEqual([]);
    expect(m.things.size).toBe(5);
    expect(m.states.size).toBe(4);
    expect(m.links.size).toBe(5);
    expect(m.appearances.size).toBe(6);
  });

  it("loads fixture file and validates it", () => {
    const json = readFileSync(
      resolve(__dirname, "../../../tests/coffee-making.opmodel"),
      "utf-8"
    );
    const result = loadModel(json);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const errors = validate(result.value);
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `bunx vitest run packages/core/tests/integration.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `bunx vitest run`
Expected: All tests across all files PASS. Note the total count.

- [ ] **Step 4: Commit**

```bash
git add packages/core/tests/integration.test.ts
git commit -m "test(core): add end-to-end integration test with Coffee Making System"
```

---

### Task 15: Final Cleanup & Summary Commit

- [ ] **Step 1: Verify TypeScript compiles cleanly**

Run: `cd packages/core && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run full test suite one final time**

Run: `bunx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Verify the fixture round-trips cleanly**

Run a quick check that `load(fixture) → save → load` produces identical models. This is already covered by the round-trip test (Task 6), but verify it runs as part of the suite.

- [ ] **Step 4: Commit any final adjustments**

If any files were touched during verification:
```bash
git add -A && git commit -m "chore(core): final cleanup after integration verification"
```

---

## Summary of Invariants Implemented

| Invariant | Where | Type |
|-----------|-------|------|
| I-01 | addState guard + validate | Guard |
| I-02 | removeThing | Effect (cascade: states, links, modifiers, appearances, requirements, fans, assertions, stereotypes) |
| I-03 | addOPD guard + validate | Guard |
| I-04 | addAppearance guard | Guard |
| I-05 | addLink guard + validate | Guard |
| I-06 | addModifier guard + validate | Guard |
| I-07 | addFan guard + validate | Guard (members exist + count >= 2) |
| I-08 | all add* guards + validate | Guard |
| I-09 | addAssertion guard + validate | Guard |
| I-10 | addRequirement guard + validate | Guard |
| I-11 | addStereotype guard + validate | Guard |
| I-12 | addSubModel guard + validate | Guard |
| I-13 | addScenario guard + validate | Guard |
| I-14 | addLink guard + validate | Guard (exception requires duration.max) |
| I-15 | addAppearance guard + validate | Guard |
| I-18 | addLink guard + validate | Guard (agent source must be physical) |
| I-19 | addLink effect + validate | Effect (exhibition coerces essence) |
| I-25 | round-trip test | Test |

**Deferred to future work (not P0):**
- I-16 (unique procedural link per process+object) — requires link type grouping analysis, target P1
- I-17 (process must transform >= 1 object) — methodology coaching warning, not hard guard
- I-20 to I-32 — advanced domain/categorical invariants for later pulses

## File Structure Created

```
packages/core/
├── src/
│   ├── types.ts          (~250 lines) All OPM types
│   ├── result.ts         (~25 lines)  Result<T,E> monad
│   ├── model.ts          (~40 lines)  createModel factory
│   ├── helpers.ts         (~15 lines)  collectAllIds
│   ├── serialization.ts  (~120 lines) load + save
│   ├── api.ts            (~300 lines) All mutations + validate
│   └── index.ts          (~25 lines)  Public barrel
├── tests/
│   ├── types.test.ts
│   ├── model.test.ts
│   ├── serialization.test.ts
│   ├── api.test.ts
│   ├── api-links.test.ts
│   ├── api-opds.test.ts
│   ├── api-appearances.test.ts
│   ├── api-secondary.test.ts
│   └── integration.test.ts
├── package.json
└── tsconfig.json
```
