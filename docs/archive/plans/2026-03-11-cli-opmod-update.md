# CLI `opmod update` Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `opmod update` command to the CLI, exposing the core's 6 update functions (thing, state, link, opd, meta, settings) with hybrid flags + `--input` JSON patch mode.

**Architecture:** Single new file `commands/update.ts` following the Map dispatch pattern of add.ts/remove.ts. Custom output in cli.ts action handlers (not formatOutput) to handle singletons without ID. Barrel export added to index.ts.

**Tech Stack:** TypeScript, Commander.js, @opmodel/core (updateThing, updateState, updateLink, updateOPD, updateMeta, updateSettings), Vitest.

**Spec:** `docs/superpowers/specs/2026-03-11-cli-opmod-update-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/cli/src/commands/update.ts` | Create | 6 update handlers, parseInputPatch, executeUpdate entry point |
| `packages/cli/src/cli.ts` | Modify | Register 6 `update` subcommands with flags |
| `packages/cli/src/index.ts` | Modify | Add barrel export for executeUpdate |
| `packages/cli/tests/update.test.ts` | Create | 15 tests covering all handlers, errors, and safety |

---

## Chunk 1: Core update module and tests

### Task 1: Scaffold update.ts with parseInputPatch and handleUpdateThing

**Files:**
- Create: `packages/cli/src/commands/update.ts`
- Create: `packages/cli/tests/update.test.ts`

**Context:** The update module follows the exact same pattern as `commands/add.ts` and `commands/remove.ts`. Key reference files:
- `packages/cli/src/commands/add.ts` — Map dispatch, parseInput, handler pattern
- `packages/cli/src/commands/remove.ts` — executeRemove entry point pattern
- `packages/core/src/api.ts` — updateThing signature: `updateThing(model, id, patch: Partial<Omit<Thing, "id">>): Result<Model, InvariantError>`

**Important:** The core uses snake_case field names (`source_state`, `parent_opd`, `opd_type`, `refinement_type`, `system_type`), but Commander.js generates camelCase from kebab-case flags (`--source-state` → `opts.sourceState`). Handlers must map camelCase → snake_case for fields that differ.

- [ ] **Step 1: Write failing tests for updateThing**

```typescript
// packages/cli/tests/update.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { executeUpdate } from "../src/commands/update";
import { executeAdd } from "../src/commands/add";
import { createModel, saveModel } from "@opmodel/core";
import { CliError } from "../src/format";
import { readModel } from "../src/io";

function setupModel(dir: string, name = "Test") {
  const model = createModel(name, "artificial");
  const filePath = join(dir, "test.opmodel");
  writeFileSync(filePath, saveModel(model));
  return filePath;
}

describe("opmod update thing", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates thing name and essence via flags", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    const result = executeUpdate("thing", "obj-water", { name: "Hot Water", essence: "informational", file: filePath });
    expect(result.type).toBe("thing");
    expect(result.id).toBe("obj-water");

    const { model } = readModel(filePath);
    expect(model.things.get("obj-water")!.name).toBe("Hot Water");
    expect(model.things.get("obj-water")!.essence).toBe("informational");
  });

  it("updates thing via --input JSON", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    const result = executeUpdate("thing", "obj-water", {
      input: '{"name":"Ice Water","essence":"informational"}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    const thing = model.things.get("obj-water")!;
    expect(thing.name).toBe("Ice Water");
    expect(thing.essence).toBe("informational");
  });

  it("--input strips id field", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeUpdate("thing", "obj-water", {
      input: '{"id":"obj-hacked","name":"Safe Water"}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.things.has("obj-hacked")).toBe(false);
    expect(model.things.get("obj-water")!.name).toBe("Safe Water");
  });

  it("--input takes precedence over flags", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeUpdate("thing", "obj-water", {
      name: "Ignored",
      input: '{"name":"From Input"}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.things.get("obj-water")!.name).toBe("From Input");
  });

  it("throws on non-existent thing", () => {
    const filePath = setupModel(dir);
    expect(() =>
      executeUpdate("thing", "obj-missing", { name: "X", file: filePath })
    ).toThrow(CliError);
  });

  it("throws on empty patch", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    expect(() =>
      executeUpdate("thing", "obj-water", { file: filePath })
    ).toThrow(CliError);
  });

  it("throws on invalid JSON in --input", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    expect(() =>
      executeUpdate("thing", "obj-water", { input: "{bad json", file: filePath })
    ).toThrow(CliError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/cli/tests/update.test.ts`
Expected: FAIL — cannot resolve `../src/commands/update`

- [ ] **Step 3: Implement update.ts with parseInputPatch and handleUpdateThing**

```typescript
// packages/cli/src/commands/update.ts
import {
  updateThing, updateState, updateLink, updateOPD, updateMeta, updateSettings,
  type Model, type Kind, type Essence, type Affiliation, type LinkType,
  type OpdType, type RefinementType, type SystemType,
} from "@opmodel/core";
import { handleResult, fatal } from "../format";
import { readModel, writeModel, resolveModelFile } from "../io";

interface UpdateOptions {
  file?: string;
  input?: string;
  // Thing
  name?: string;
  kind?: Kind;
  essence?: Essence;
  affiliation?: Affiliation;
  // State
  parent?: string;
  initial?: boolean;
  final?: boolean;
  default?: boolean;
  // Link
  type?: LinkType;
  source?: string;
  target?: string;
  sourceState?: string;
  targetState?: string;
  // OPD
  opdType?: OpdType;
  refines?: string;
  refinement?: RefinementType;
  // Meta
  description?: string;
  systemType?: SystemType;
}

interface UpdateResult {
  id?: string;
  type: string;
  entity: unknown;
}

function parseInputPatch<T>(input: string, entityType: string): T {
  try {
    const parsed = JSON.parse(input);
    delete parsed.id;
    delete parsed.thing;
    delete parsed.opd;
    delete parsed.created;
    delete parsed.modified;
    return parsed as T;
  } catch {
    fatal(`Invalid JSON input for ${entityType}: ${input.slice(0, 80)}`);
  }
}

type UpdateHandler = (model: Model, id: string, opts: UpdateOptions) => { model: Model; result: UpdateResult };
type SingletonUpdateHandler = (model: Model, opts: UpdateOptions) => { model: Model; result: UpdateResult };

function handleUpdateThing(model: Model, id: string, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "thing");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.kind !== undefined) patch.kind = opts.kind;
    if (opts.essence !== undefined) patch.essence = opts.essence;
    if (opts.affiliation !== undefined) patch.affiliation = opts.affiliation;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateThing(model, id, patch as any), { json: false });
  const entity = newModel.things.get(id);
  return { model: newModel, result: { id, type: "thing", entity } };
}

function handleUpdateState(model: Model, id: string, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "state");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.parent !== undefined) patch.parent = opts.parent;
    if (opts.initial !== undefined) patch.initial = opts.initial;
    if (opts.final !== undefined) patch.final = opts.final;
    if (opts.default !== undefined) patch.default = opts.default;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateState(model, id, patch as any), { json: false });
  const entity = newModel.states.get(id);
  return { model: newModel, result: { id, type: "state", entity } };
}

function handleUpdateLink(model: Model, id: string, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "link");
  } else {
    patch = {};
    if (opts.type !== undefined) patch.type = opts.type;
    if (opts.source !== undefined) patch.source = opts.source;
    if (opts.target !== undefined) patch.target = opts.target;
    if (opts.sourceState !== undefined) patch.source_state = opts.sourceState;
    if (opts.targetState !== undefined) patch.target_state = opts.targetState;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateLink(model, id, patch as any), { json: false });
  const entity = newModel.links.get(id);
  return { model: newModel, result: { id, type: "link", entity } };
}

function handleUpdateOPD(model: Model, id: string, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "opd");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.opdType !== undefined) patch.opd_type = opts.opdType;
    if (opts.parent !== undefined) patch.parent_opd = opts.parent;
    if (opts.refines !== undefined) patch.refines = opts.refines;
    if (opts.refinement !== undefined) patch.refinement_type = opts.refinement;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateOPD(model, id, patch as any), { json: false });
  const entity = newModel.opds.get(id);
  return { model: newModel, result: { id, type: "opd", entity } };
}

function handleUpdateMeta(model: Model, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "meta");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.description !== undefined) patch.description = opts.description;
    if (opts.systemType !== undefined) patch.system_type = opts.systemType;
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateMeta(model, patch as any), { json: false });
  return { model: newModel, result: { type: "meta", entity: newModel.meta } };
}

function handleUpdateSettings(model: Model, opts: UpdateOptions): { model: Model; result: UpdateResult } {
  if (!opts.input) fatal("Settings requires --input with JSON patch.");
  const patch = parseInputPatch(opts.input, "settings");
  const newModel = handleResult(updateSettings(model, patch as any), { json: false });
  return { model: newModel, result: { type: "settings", entity: newModel.settings } };
}

const handlers = new Map<string, UpdateHandler>([
  ["thing", handleUpdateThing],
  ["state", handleUpdateState],
  ["link", handleUpdateLink],
  ["opd", handleUpdateOPD],
]);

const singletonHandlers = new Map<string, SingletonUpdateHandler>([
  ["meta", handleUpdateMeta],
  ["settings", handleUpdateSettings],
]);

export function executeUpdate(
  entityType: string,
  id: string | undefined,
  opts: UpdateOptions,
): UpdateResult {
  const singletonHandler = singletonHandlers.get(entityType);
  if (singletonHandler) {
    const filePath = resolveModelFile(opts.file);
    const { model } = readModel(filePath);
    const { model: newModel, result } = singletonHandler(model, opts);
    writeModel(newModel, filePath);
    return result;
  }

  const handler = handlers.get(entityType);
  if (!handler) {
    fatal(`Unknown entity type: ${entityType}. Valid: ${[...handlers.keys(), ...singletonHandlers.keys()].join(", ")}`);
  }
  if (!id) fatal(`Missing required: <id> for ${entityType}`);

  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);
  const { model: newModel, result } = handler(model, id, opts);
  writeModel(newModel, filePath);
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/cli/tests/update.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/update.ts packages/cli/tests/update.test.ts
git commit -m "feat(cli): add update command with thing handler and parseInputPatch"
```

---

### Task 2: Add tests and verify state, link, OPD, meta, settings handlers

**Files:**
- Modify: `packages/cli/tests/update.test.ts`

**Context:** All 6 handlers are already implemented in Task 1. This task adds the remaining tests to verify they work correctly. The state handler tests the `--no-initial`/`--final` boolean toggle pattern. The link handler tests camelCase → snake_case field mapping. The OPD handler tests `opts.parent` → `patch.parent_opd` mapping. Meta/settings test singleton handlers.

- [ ] **Step 1: Add remaining tests**

Append to `packages/cli/tests/update.test.ts`:

```typescript
describe("opmod update state", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("toggles boolean flags (--no-initial --final)", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("state", { name: "cold", parent: "obj-water", initial: true, file: filePath });

    executeUpdate("state", "state-cold", { initial: false, final: true, file: filePath });

    const { model } = readModel(filePath);
    const state = model.states.get("state-cold")!;
    expect(state.initial).toBe(false);
    expect(state.final).toBe(true);
  });
});

describe("opmod update link", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates link source-state and target-state via flags", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("thing", { name: "Heating", kind: "process", essence: "physical", file: filePath });
    executeAdd("state", { name: "cold", parent: "obj-water", file: filePath });
    executeAdd("state", { name: "hot", parent: "obj-water", file: filePath });
    executeAdd("link", {
      type: "effect", source: "proc-heating", target: "obj-water",
      file: filePath,
    });

    const linkId = "lnk-effect-proc-heating-obj-water";
    executeUpdate("link", linkId, {
      sourceState: "state-cold", targetState: "state-hot",
      file: filePath,
    });

    const { model } = readModel(filePath);
    const link = model.links.get(linkId)!;
    expect(link.source_state).toBe("state-cold");
    expect(link.target_state).toBe("state-hot");
  });
});

describe("opmod update opd", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates OPD name and opdType via flags", () => {
    const filePath = setupModel(dir);
    executeAdd("opd", { name: "Custom View", opdType: "view", file: filePath });

    executeUpdate("opd", "opd-custom-view", { name: "Main View", file: filePath });

    const { model } = readModel(filePath);
    expect(model.opds.get("opd-custom-view")!.name).toBe("Main View");
  });

  it("maps opdType flag to opd_type and parent to parent_opd", () => {
    const filePath = setupModel(dir);
    executeAdd("opd", { name: "SD1", parent: "opd-sd", file: filePath });

    executeUpdate("opd", "opd-sd1", {
      input: '{"opd_type":"view","parent_opd":null}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.opds.get("opd-sd1")!.opd_type).toBe("view");
    expect(model.opds.get("opd-sd1")!.parent_opd).toBeNull();
  });
});

describe("opmod update meta", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates meta name and description via flags", () => {
    const filePath = setupModel(dir);

    executeUpdate("meta", undefined, { name: "Renamed", description: "A new description", file: filePath });

    const { model } = readModel(filePath);
    expect(model.meta.name).toBe("Renamed");
    expect(model.meta.description).toBe("A new description");
  });

  it("--input strips created and modified", () => {
    const filePath = setupModel(dir);

    executeUpdate("meta", undefined, {
      input: '{"name":"Hacked","created":"1970-01-01","modified":"1970-01-01"}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.meta.name).toBe("Hacked");
    expect(model.meta.created).not.toBe("1970-01-01");
  });
});

describe("opmod update settings", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates settings via --input", () => {
    const filePath = setupModel(dir);

    executeUpdate("settings", undefined, {
      input: '{"autosave_interval_s":30,"decimal_precision":5}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.settings.autosave_interval_s).toBe(30);
    expect(model.settings.decimal_precision).toBe(5);
  });

  it("throws without --input", () => {
    const filePath = setupModel(dir);
    expect(() =>
      executeUpdate("settings", undefined, { file: filePath })
    ).toThrow(CliError);
  });
});

describe("opmod update <invalid>", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("throws on unknown entity type", () => {
    const filePath = setupModel(dir);
    expect(() => executeUpdate("unknown" as any, "x", { file: filePath })).toThrow(CliError);
  });
});
```

- [ ] **Step 2: Run all tests to verify they pass**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run packages/cli/tests/update.test.ts`
Expected: 15 tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/cli/tests/update.test.ts
git commit -m "test(cli): add comprehensive tests for all update handlers"
```

---

## Chunk 2: CLI registration and barrel export

### Task 3: Register update subcommands in cli.ts

**Files:**
- Modify: `packages/cli/src/cli.ts`

**Context:** The update command needs 6 subcommands registered in cli.ts. The action handlers produce output directly (not via `formatOutput`) because singletons lack `id` and `formatOutput` requires `obj.id` for the human-friendly format. This follows the same pattern as `remove` which also uses custom output for cascade summaries. See spec Section 6 for the output format.

- [ ] **Step 1: Add import for executeUpdate in cli.ts**

In `packages/cli/src/cli.ts`, after line 9 (`import { executeValidate } from "./commands/validate";`), add:

```typescript
import { executeUpdate } from "./commands/update";
```

- [ ] **Step 2: Register all 6 update subcommands**

In `packages/cli/src/cli.ts`, after the `validate` command registration (after line 255) and before the global error handler (before `// Global error handler`), add:

```typescript
const update = program
  .command("update")
  .description("Update an entity in the model");

update
  .command("thing")
  .description("Update a thing")
  .argument("<id>", "Thing ID")
  .option("--name <name>", "New name")
  .option("--kind <kind>", "New kind (object|process)")
  .option("--essence <essence>", "New essence (physical|informatical)")
  .option("--affiliation <aff>", "New affiliation (systemic|environmental)")
  .option("--input <input>", "JSON patch (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((id: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("thing", id, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, id: result.id, entity: result.entity }, null, 2));
    } else {
      const nameStr = (result.entity as any)?.name ? ` (${(result.entity as any).name})` : "";
      console.log(`Updated ${result.type} ${result.id}${nameStr}`);
    }
  });

update
  .command("state")
  .description("Update a state")
  .argument("<id>", "State ID")
  .option("--name <name>", "New name")
  .option("--parent <parent>", "New parent object ID")
  .option("--initial", "Set as initial state (use --no-initial to unset)")
  .option("--final", "Set as final state (use --no-final to unset)")
  .option("--default", "Set as default state (use --no-default to unset)")
  .option("--input <input>", "JSON patch (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((id: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("state", id, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, id: result.id, entity: result.entity }, null, 2));
    } else {
      const nameStr = (result.entity as any)?.name ? ` (${(result.entity as any).name})` : "";
      console.log(`Updated ${result.type} ${result.id}${nameStr}`);
    }
  });

update
  .command("link")
  .description("Update a link")
  .argument("<id>", "Link ID")
  .option("--type <type>", "New link type")
  .option("--source <source>", "New source thing ID")
  .option("--target <target>", "New target thing ID")
  .option("--source-state <state>", "New source state ID")
  .option("--target-state <state>", "New target state ID")
  .option("--input <input>", "JSON patch (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((id: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("link", id, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, id: result.id, entity: result.entity }, null, 2));
    } else {
      console.log(`Updated ${result.type} ${result.id}`);
    }
  });

update
  .command("opd")
  .description("Update an OPD")
  .argument("<id>", "OPD ID")
  .option("--name <name>", "New name")
  .option("--opd-type <type>", "New OPD type (hierarchical|view)")
  .option("--parent <parent>", "New parent OPD ID")
  .option("--refines <thing>", "Thing this OPD refines")
  .option("--refinement <type>", "Refinement type (in-zoom|unfold)")
  .option("--input <input>", "JSON patch (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((id: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("opd", id, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, id: result.id, entity: result.entity }, null, 2));
    } else {
      const nameStr = (result.entity as any)?.name ? ` (${(result.entity as any).name})` : "";
      console.log(`Updated ${result.type} ${result.id}${nameStr}`);
    }
  });

update
  .command("meta")
  .description("Update model metadata")
  .option("--name <name>", "New model name")
  .option("--description <desc>", "New description")
  .option("--system-type <type>", "New system type")
  .option("--input <input>", "JSON patch (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("meta", undefined, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, entity: result.entity }, null, 2));
    } else {
      const nameStr = (result.entity as any)?.name ? ` (${(result.entity as any).name})` : "";
      console.log(`Updated ${result.type}${nameStr}`);
    }
  });

update
  .command("settings")
  .description("Update model settings")
  .option("--input <input>", "JSON patch (agent mode, required)")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("settings", undefined, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, entity: result.entity }, null, 2));
    } else {
      console.log(`Updated ${result.type}`);
    }
  });
```

- [ ] **Step 3: Run full test suite to verify nothing breaks**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All tests pass (existing 216 + 15 new = 231)

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/cli.ts
git commit -m "feat(cli): register update subcommands in Commander"
```

---

### Task 4: Add barrel export and run full suite

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Add export to index.ts**

In `packages/cli/src/index.ts`, after line 12 (`export { executeValidate } from "./commands/validate";`), add:

```typescript
export { executeUpdate } from "./commands/update";
```

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel && bunx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run type check**

Run: `cd /Users/felixsanhueza/Developer/_workspaces/opmodel/packages/cli && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): add executeUpdate barrel export"
```
