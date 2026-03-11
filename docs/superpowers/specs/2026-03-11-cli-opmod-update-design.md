# CLI `opmod update` — Design Spec

**Fecha:** 2026-03-11
**Estado:** Approved
**Scope:** 6 entidades (4 P0 + meta + settings)
**Prerequisito:** CLI P0 implementado (`packages/cli/`)

---

## 1. Decisiones de Diseno

| Decision | Eleccion | Razon |
|----------|----------|-------|
| Patron | `Map<string, UpdateHandler>` dispatch | Consistente con add.ts y remove.ts |
| Input mode | Hibrido selectivo: flags escalares + `--input` JSON patch | DA-1 agent-ready; flags para 80% de cambios comunes; `--input` para campos complejos |
| Settings | Solo `--input` (sin flags) | 17 campos no justifican flags individuales |
| ID inmutabilidad | Strip `id` del patch parseado por `--input` | Identidad categorial inmutable: id es la identity del 0-cell/1-cell en C_opm |
| Scope entidades | thing, state, link, opd, meta, settings | 4 P0 + 2 singletons que ya tienen API en core |
| Booleans | `--flag / --no-flag` pattern de Commander.js | Permite tanto activar como desactivar (e.g., `--initial` / `--no-initial`) |
| Patch vacio | `fatal()` si no hay campos que actualizar | Evita escritura innecesaria al disco |
| `--input` vs flags | `--input` toma precedencia; flags se ignoran si `--input` presente | Consistente con `add` command; evita merge ambiguo |

---

## 2. Estructura

```
packages/cli/
├── src/
│   ├── commands/
│   │   └── update.ts      → opmod update thing|state|link|opd|meta|settings
│   ├── cli.ts              → Registrar subcomandos de update (modificar)
│   └── index.ts            → Barrel export (modificar)
└── tests/
    └── update.test.ts
```

**Archivo nuevo:** `commands/update.ts` (~140 lineas)
**Archivos modificados:** `cli.ts`, `index.ts`

---

## 3. Sintaxis

### Entidades con ID (posicional)

```bash
# Thing — flags escalares: --name, --kind, --essence, --affiliation
opmod update thing obj-water --name "Hot Water"
opmod update thing obj-water --essence informational --affiliation environmental
opmod update thing obj-water --input '{"name":"Hot Water","essence":"informational"}'

# State — flags: --name, --parent, --initial/--no-initial, --final/--no-final, --default/--no-default
opmod update state state-cold --name "frozen"
opmod update state state-cold --no-initial --final
opmod update state state-cold --input '{"name":"frozen","initial":false,"final":true}'

# Link — flags: --type, --source, --target, --source-state, --target-state
opmod update link lnk-effect-heating-water --source-state state-cold --target-state state-hot
opmod update link lnk-1 --input '{"type":"agent","source":"obj-barista"}'

# OPD — flags: --name, --opd-type, --parent, --refines, --refinement
opmod update opd opd-sd1 --name "System Diagram 2"
opmod update opd opd-sd1 --input '{"parent_opd":"opd-sd"}'
```

### Singletons (sin ID)

```bash
# Meta — flags: --name, --description, --system-type
opmod update meta --name "Renamed System"
opmod update meta --description "A coffee making system model"

# Settings — solo --input (17 campos)
opmod update settings --input '{"autosave_interval_s":30,"decimal_precision":3}'
```

### Flag global

```bash
opmod --json update thing obj-water --name "Hot Water"
opmod update meta --name "New" --json   # tambien valido
```

---

## 4. Modulo `commands/update.ts`

### Interfaces

```typescript
interface UpdateOptions {
  file?: string;
  input?: string;       // JSON patch (agent mode)
  // Thing
  name?: string;
  kind?: Kind;
  essence?: Essence;
  affiliation?: Affiliation;
  // State (booleans: Commander --flag/--no-flag produce true/false/undefined)
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
  id?: string;          // undefined para meta/settings
  type: string;
  entity: unknown;
}
```

### Safety: strip `id` de `--input`

```typescript
function parseInputPatch<T>(input: string, entityType: string): T {
  try {
    const parsed = JSON.parse(input);
    delete parsed.id;          // Identidad categorial inmutable
    delete parsed.thing;       // Appearance PK component
    delete parsed.opd;         // Appearance PK component
    delete parsed.created;     // Meta timestamp inmutable
    delete parsed.modified;    // Meta timestamp gestionado por writeModel
    return parsed as T;
  } catch {
    fatal(`Invalid JSON input for ${entityType}: ${input.slice(0, 80)}`);
  }
}
```

### Handlers

```typescript
type UpdateHandler = (model: Model, id: string, opts: UpdateOptions) => { model: Model; result: UpdateResult };

// Para singletons, id se ignora (string vacio)
type SingletonUpdateHandler = (model: Model, opts: UpdateOptions) => { model: Model; result: UpdateResult };
```

**6 handlers:**

| Handler | Core API | Patch construction |
|---------|----------|--------------------|
| `handleUpdateThing` | `updateThing(model, id, patch)` | Flags: name, kind, essence, affiliation. `--input`: JSON patch |
| `handleUpdateState` | `updateState(model, id, patch)` | Flags: name, parent, initial, final, default. `--input`: JSON patch |
| `handleUpdateLink` | `updateLink(model, id, patch)` | Flags: type, source, target, source_state, target_state. `--input`: JSON patch |
| `handleUpdateOPD` | `updateOPD(model, id, patch)` | Flags requieren renaming: `opts.name`→`name`, `opts.opdType`→`opd_type`, `opts.parent`→`parent_opd`, `opts.refines`→`refines`, `opts.refinement`→`refinement_type`. `--input`: JSON patch (campos ya usan snake_case) |
| `handleUpdateMeta` | `updateMeta(model, patch)` | Flags requieren renaming: `opts.name`→`name`, `opts.description`→`description`, `opts.systemType`→`system_type`. `--input`: JSON patch |
| `handleUpdateSettings` | `updateSettings(model, patch)` | Solo `--input`: JSON patch |

### Patch construction logic

Para cada handler con flags:

```typescript
// Ejemplo: handleUpdateThing
function handleUpdateThing(model: Model, id: string, opts: UpdateOptions) {
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
```

Para booleans en State, Commander.js con `.option("--initial", ..., undefined)` y `.option("--no-initial", ...)` produce:
- `--initial` → `opts.initial = true`
- `--no-initial` → `opts.initial = false`
- (omitido) → `opts.initial = undefined`

Solo incluir en patch si `!== undefined`.

### Field renaming: OPD y Meta handlers

Los flags de Commander usan camelCase (`opts.opdType`) pero el core usa snake_case (`opd_type`). Los handlers deben mapear explicitamente:

```typescript
// handleUpdateOPD — field renaming
function handleUpdateOPD(model: Model, id: string, opts: UpdateOptions) {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "opd");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.opdType !== undefined) patch.opd_type = opts.opdType;
    if (opts.parent !== undefined) patch.parent_opd = opts.parent;    // parent → parent_opd
    if (opts.refines !== undefined) patch.refines = opts.refines;
    if (opts.refinement !== undefined) patch.refinement_type = opts.refinement;  // refinement → refinement_type
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateOPD(model, id, patch as any), { json: false });
  const entity = newModel.opds.get(id);
  return { model: newModel, result: { id, type: "opd", entity } };
}

// handleUpdateMeta — field renaming, singleton (no id)
function handleUpdateMeta(model: Model, opts: UpdateOptions) {
  let patch: Record<string, unknown>;
  if (opts.input) {
    patch = parseInputPatch(opts.input, "meta");
  } else {
    patch = {};
    if (opts.name !== undefined) patch.name = opts.name;
    if (opts.description !== undefined) patch.description = opts.description;
    if (opts.systemType !== undefined) patch.system_type = opts.systemType;  // systemType → system_type
  }
  if (Object.keys(patch).length === 0) fatal("No fields to update. Provide flags or --input.");
  const newModel = handleResult(updateMeta(model, patch as any), { json: false });
  return { model: newModel, result: { type: "meta", entity: newModel.meta } };
}
```

### Dispatch

```typescript
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
```

### Entry point

```typescript
export function executeUpdate(
  entityType: string,
  id: string | undefined,
  opts: UpdateOptions,
): UpdateResult {
  // Singletons (meta, settings): no requieren ID
  const singletonHandler = singletonHandlers.get(entityType);
  if (singletonHandler) {
    const filePath = resolveModelFile(opts.file);
    const { model } = readModel(filePath);
    const { model: newModel, result } = singletonHandler(model, opts);
    writeModel(newModel, filePath);
    return result;
  }

  // Entidades con ID
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

---

## 5. Registro en `cli.ts`

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
  .action((id, opts) => { /* executeUpdate("thing", id, opts) + formatOutput */ });

update
  .command("state")
  .description("Update a state")
  .argument("<id>", "State ID")
  .option("--name <name>", "New name")
  .option("--parent <parent>", "New parent object ID")
  .option("--initial", "Set as initial state")
  .option("--no-initial", "Unset initial state")
  .option("--final", "Set as final state")
  .option("--no-final", "Unset final state")
  .option("--default", "Set as default state")
  .option("--no-default", "Unset default state")
  .option("--input <input>", "JSON patch (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((id, opts) => { /* executeUpdate("state", id, opts) + formatOutput */ });

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
  .action((id, opts) => { /* executeUpdate("link", id, opts) + formatOutput */ });

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
  .action((id, opts) => { /* executeUpdate("opd", id, opts) + formatOutput */ });

update
  .command("meta")
  .description("Update model metadata")
  .option("--name <name>", "New model name")
  .option("--description <desc>", "New description")
  .option("--system-type <type>", "New system type")
  .option("--input <input>", "JSON patch (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts) => { /* executeUpdate("meta", undefined, opts) + formatOutput */ });

update
  .command("settings")
  .description("Update model settings")
  .option("--input <input>", "JSON patch (agent mode, required)")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts) => { /* executeUpdate("settings", undefined, opts) + formatOutput */ });
```

---

## 6. Salida

### Formato en `cli.ts` action handlers

El action handler de cada subcommand `update` genera la salida directamente (como `remove` hace para cascade), sin depender de `formatOutput`, ya que los singletons no tienen `id` y `formatOutput` requiere `obj.id` para la linea human-friendly.

```typescript
// En cada action handler de update:
if (jsonFlag) {
  console.log(JSON.stringify({ action: "updated", type: result.type, ...(result.id && { id: result.id }), entity: result.entity }, null, 2));
} else {
  const nameStr = (result.entity as any)?.name ? ` (${(result.entity as any).name})` : "";
  const idStr = result.id ? ` ${result.id}` : "";
  console.log(`Updated ${result.type}${idStr}${nameStr}`);
}
```

### Human (stdout)

```
Updated thing obj-water (Hot Water)
Updated state state-cold (frozen)
Updated link lnk-effect-heating-water
Updated opd opd-sd1 (System Diagram 2)
Updated meta (Renamed System)
Updated settings
```

### JSON (stdout)

```json
{"action":"updated","type":"thing","id":"obj-water","entity":{"id":"obj-water","kind":"object","name":"Hot Water","essence":"informational","affiliation":"systemic"}}
{"action":"updated","type":"meta","entity":{"name":"Renamed System","description":"...","system_type":"artificial","created":"2026-03-11T00:00:00Z","modified":"2026-03-11T12:00:00Z"}}
{"action":"updated","type":"settings","entity":{"opl_language":"en","autosave_interval_s":30,"decimal_precision":3,"...":"..."}}
```

Tanto para entidades con ID como singletons, `entity` contiene el objeto completo post-update (no solo el patch).

---

## 7. Testing

### `update.test.ts` (~12 tests)

| Test | Cobertura |
|------|-----------|
| Update thing via flags (name, essence) | Handler + core integration |
| Update thing via `--input` | parseInputPatch + handler |
| Update state boolean toggle (`--no-initial --final`) | Commander boolean pattern |
| Update link via flags (source-state, target-state) | Handler + field mapping |
| Update OPD via flags (name, opd-type) | Handler + field mapping |
| Update meta via flags (name, description) | Singleton handler |
| Update settings via `--input` | Singleton handler, solo --input |
| Error: entity not found | Core InvariantError → CliError(1) |
| Error: empty patch (no flags, no --input) | fatal() → CliError(2) |
| Error: invalid JSON in --input | parseInputPatch → fatal() |
| `--input` strips `id` field | parseInputPatch safety |
| `--input` strips `created`/`modified` from meta | parseInputPatch safety |
| `--input` takes precedence over flags | Flags ignored when `--input` present |

---

## 8. Notas Categoriales

| Aspecto | Tratamiento |
|---------|-------------|
| Identidad inmutable | `parseInputPatch` stripea `id`, `thing`, `opd`, `created`, `modified` |
| Type-changing updates (kind, link type) | Delegado a guards del core (I-01, I-05, I-14, I-18, I-19) |
| Fibración π coherence (parent_opd) | Delegado a I-03 del core |
| Subobjeto State ↪ Object (reparenting) | Delegado a I-01 del core |
| Meta/Settings extra-categoriales | Sin invariantes categoriales; solo inmutabilidad de timestamps |
