# CLI `opmod` — Design Spec

**Fecha:** 2026-03-11
**Estado:** Approved
**Scope:** P0 — 6 comandos, 4 entidades principales

---

## 1. Decisiones de Diseno

| Decision | Eleccion | Razon |
|----------|----------|-------|
| Arquitectura | Monolito Commander.js | 6 comandos no justifican middleware/pipeline |
| Session | Sin sesion — operacion directa sobre .opmodel | Git es el session manager (branch, checkout, diff). Diverge de §4.4 del stack design doc que especifica `.opmod-session`; esta simplificacion es deliberada para P0 — cada comando lee/muta/escribe el .opmodel directamente |
| File resolution | Convencion de directorio + `--file` override | Como git/cargo: busca unico *.opmodel en cwd |
| Input mode | Hibrido: posicional+flags (humano) + `--json` (agente) | DA-1 agent-ready sin sacrificar UX humana |
| Scope P0 | Standard: new, add, remove, list, show, validate | 4 entidades: thing, state, link, opd |
| Output | `--json` global flag; human por defecto | Bifurcacion limpia en format.ts |
| Error handling | Functor centralizado en format.ts | Un solo punto de mapeo Result → exit code |
| Command dispatch | Map<EntityType, Handler> explicito | Composicionalidad; no switch/if-else |

---

## 2. Estructura del Paquete

```
packages/cli/
├── src/
│   ├── cli.ts            → Entry point: configura Commander, registra comandos
│   ├── io.ts             → resolveModelFile(), readModel(), writeModel()
│   ├── format.ts         → handleResult(), formatOutput(), fatal(), formatters
│   ├── commands/
│   │   ├── new.ts        → opmod new
│   │   ├── add.ts        → opmod add thing|state|link|opd
│   │   ├── remove.ts     → opmod remove thing|state|link|opd
│   │   ├── list.ts       → opmod list things|states|links|opds
│   │   ├── show.ts       → opmod show <id>
│   │   └── validate.ts   → opmod validate
│   └── index.ts          → Barrel export (para tests)
├── tests/
│   ├── io.test.ts
│   ├── format.test.ts
│   ├── new.test.ts
│   ├── add.test.ts
│   ├── remove.test.ts
│   ├── list.test.ts
│   ├── show.test.ts
│   ├── validate.test.ts
│   └── integration.test.ts
├── package.json
└── tsconfig.json
```

**Dependencias:**
- `@opmodel/core` (workspace dependency)
- `commander` (unica dependencia externa)

**Entry point:** `bin.opmod` en package.json apunta a `src/cli.ts`.

---

## 3. Modulo I/O (`io.ts`)

Responsabilidad: resolver archivo, leer modelo, escribir modelo.

### resolveModelFile

```typescript
resolveModelFile(fileOption?: string): string
```

- Si `fileOption` proporcionado: usa ese path directamente
- Si no: busca `*.opmodel` en cwd
  - Exactamente 1: lo usa
  - 0 encontrados: `fatal("No .opmodel file found. Run 'opmod new' or use --file.")`
  - >1 encontrados: `fatal("Multiple .opmodel files found. Use --file to specify.")`

### readModel

```typescript
readModel(filePath: string): { model: Model; filePath: string }
```

- Lee archivo con `readFileSync`
- Parsea con `loadModel()` del core
- Si falla: `fatal()` con mensaje de error de LoadError
- Retorna modelo y path para que el comando pueda escribir de vuelta

### writeModel

```typescript
writeModel(model: Model, filePath: string): void
```

- Actualiza `meta.modified` al timestamp actual (ISO 8601) antes de serializar
- Serializa con `saveModel()` del core
- Escribe con `writeFileSync`
- Si falla escritura: `fatal()`

---

## 4. Functor de Error y Formato (`format.ts`)

Responsabilidad: traducir Result y datos a salida terminal + exit codes.

### Morfismo de error centralizado

```typescript
// ok → retorna T; err → throw CliError (catch en cli.ts → exit code)
// Lanza en vez de process.exit para permitir testing unitario sin mocks de process
handleResult<T>(result: Result<T, InvariantError>, options: { json: boolean }): T

// Error fatal → stderr + process.exit(2)
fatal(message: string): never

// Errores de validacion
formatErrors(errors: InvariantError[], options: { json: boolean }): string
```

### Bifurcacion human/JSON

```typescript
// Punto unico de decision de formato
formatOutput(data: unknown, options: { json: boolean }): string

// Formateadores individuales (show)
formatThing(thing: Thing, options: { json: boolean }): string
formatState(state: State, options: { json: boolean }): string
formatLink(link: Link, options: { json: boolean }): string
formatOPD(opd: OPD, options: { json: boolean }): string

// Formateadores de lista (list)
formatThingList(things: Thing[], options: { json: boolean }): string
formatStateList(states: State[], options: { json: boolean }): string
formatLinkList(links: Link[], options: { json: boolean }): string
formatOPDTree(opds: OPD[], options: { json: boolean }): string
```

### CliError

```typescript
// Error tipado que cli.ts captura para determinar exit code
class CliError extends Error {
  constructor(message: string, public exitCode: 1 | 2) { super(message); }
}
```

`handleResult` y `fatal` lanzan `CliError`. El entry point `cli.ts` tiene un try/catch global que captura `CliError`, imprime a stderr, y llama `process.exit(error.exitCode)`.

### Exit codes

| Codigo | Significado | Fuente |
|--------|-------------|--------|
| 0 | Exito | Comando completado |
| 1 | Error de validacion/invariante | `InvariantError` del core |
| 2 | Error fatal | I/O, archivo no encontrado, parse |

---

## 5. Comandos

### 5.1 `new` — Crear modelo

```bash
opmod new "Coffee Making System" [--type artificial|natural|social|socio-technical]
```

- Crea archivo en cwd: slugifica nombre → `coffee-making-system.opmodel`
- Llama `createModel(name, type)` + `saveModel()` + escribe
- Error si archivo ya existe; `--force` sobreescribe
- Stdout: path del archivo creado

### 5.2 `add` — Agregar entidad

Dispatch explicito via `Map<string, AddHandler>`:

```bash
# Thing: nombre posicional, resto flags
opmod add thing "Water" --kind object --essence physical [--affiliation systemic]  # affiliation default: "systemic"
opmod add thing --json '{"id":"obj-water","kind":"object","name":"Water","essence":"physical","affiliation":"systemic"}'

# State: nombre posicional, parent obligatorio
# Flags booleanos default a false cuando se omiten
opmod add state "cold" --parent obj-water [--initial] [--final] [--default]

# Link: todo flags (no hay nombre natural)
# Campos opcionales del tipo Link (multiplicity, probability, etc.) se omiten; no se incluyen en el objeto
opmod add link --type effect --source proc-heating --target obj-water [--source-state state-cold] [--target-state state-hot]

# OPD: nombre posicional
# --opd-type default "hierarchical"; inferido como "view" si --parent no se proporciona y no hay parent
opmod add opd "SD1" --parent opd-sd [--opd-type hierarchical|view] [--refines proc-heating --refinement in-zoom]
```

**ID generation:** Si no se pasa `--id`:
- Thing: `{kind}-{slug(name)}` → `obj-water`, `proc-heating`
- State: `state-{slug(name)}` → `state-cold`
- Link: `lnk-{type}-{slug(source)}-{slug(target)}` → `lnk-effect-heating-water`
- OPD: `opd-{slug(name)}` → `opd-sd1`

Con `--json` el id es obligatorio (no se autogenera).

**Slugificacion:** `slug(name)` convierte a lowercase, reemplaza espacios y caracteres no-alfanumericos por `-`, colapsa guiones multiples, trim de guiones en extremos. Ej: `"Coffee Beans"` → `coffee-beans`, `"SD1"` → `sd1`.

### 5.3 `remove` — Eliminar entidad

```bash
opmod remove thing obj-water    # cascada I-02
opmod remove state state-cold
opmod remove link lnk-1
opmod remove opd opd-sd1        # cascada recursiva
```

- Posicional: tipo + ID
- Sin confirmacion interactiva (agentes no pueden confirmar)
- `--dry-run`: ejecuta la operacion sobre el modelo en memoria, diferea el modelo antes/despues para reportar que se eliminaria, pero NO escribe a disco
- Stdout: confirmacion con resumen de cascada (entidades eliminadas por tipo y conteo)

### 5.4 `list` — Listar entidades

```bash
opmod list things [--kind object|process]
opmod list states [--parent obj-water]
opmod list links [--type effect|agent|...]
opmod list opds [--tree]
```

- Human: tabla con columnas relevantes por entidad
- JSON: array de entidades completas

### 5.5 `show` — Detalle de entidad

```bash
opmod show <id>
```

- Busca el ID en las 4 colecciones P0 (things, states, links, opds). Si el ID coincide con una entidad de coleccion P1+ (modifiers, fans, etc.), la muestra en formato JSON crudo sin formatter especializado
- Muestra todos los campos de la entidad
- Para Things: incluye states asociados
- Para OPDs: incluye lista de appearances en ese OPD
- Error si ID no existe en ninguna coleccion

### 5.6 `validate` — Validar modelo

```bash
opmod validate
opmod validate --json
```

- Llama `validate()` del core
- Exit 0 si modelo valido + resumen de conteos
- Exit 1 si hay errores + lista de InvariantError

---

## 6. Flag Global `--json`

Registrado a nivel programa en Commander, heredado por todos los comandos:

```bash
opmod --json add thing "Water" --kind object --essence physical
opmod add thing "Water" --kind object --json   # tambien valido
```

### Convencion de salida human (stdout)

```
# add/remove
Added thing obj-water (Water)
Removed thing obj-water (cascade: 2 states, 1 link)

# list
ID                  Kind      Name           Essence
obj-water           object    Water          physical
proc-heating        process   Heating        physical

# show
Thing: obj-water
  name:        Water
  kind:        object
  essence:     physical
  affiliation: systemic
  states:      state-cold, state-hot

# validate (ok)
Model valid. 5 things, 4 states, 5 links, 2 OPDs.

# validate (errores)
2 errors found:
  I-05  Link lnk-1 source not found: obj-missing
  I-07  Fan fan-1 must have >= 2 members
```

### Convencion de salida JSON (stdout)

```json
// add/remove
{ "action": "added", "type": "thing", "id": "obj-water", "entity": {...} }

// list
[{ "id": "obj-water", ... }, { "id": "proc-heating", ... }]

// show
{ "id": "obj-water", "kind": "object", ... }

// validate
{ "valid": true, "errors": [], "summary": { "things": 5, "states": 4, "links": 5, "opds": 2 } }
{ "valid": false, "errors": [{ "code": "I-05", "message": "...", "entity": "lnk-1" }] }
```

**Stderr** siempre es texto plano (nunca JSON), incluso con `--json`.

---

## 7. Testing

### Tests unitarios

| Test file | Cobertura |
|-----------|-----------|
| `io.test.ts` | resolveModelFile (0, 1, >1 archivos); readModel/writeModel con fs temporal |
| `format.test.ts` | handleResult ok/err; formatOutput human/JSON; exit codes |
| `new.test.ts` | Crea archivo; slugifica nombre; error si existe; --force |
| `add.test.ts` | Dispatch table; cada handler genera ID; --json path; flags mapping |
| `remove.test.ts` | Elimina por ID; --dry-run no escribe; error si no existe |
| `list.test.ts` | Filtra por flags; formato tabla; formato JSON |
| `show.test.ts` | Busca en todas las colecciones; error si no existe |
| `validate.test.ts` | Exit 0 limpio; exit 1 errores; formato human/JSON |

### Test de integracion end-to-end

```
integration.test.ts:
  1. new "Coffee Making System" --type artificial
  2. add thing x5 (barista, coffee, beans, water, process)
  3. add state x4
  4. add opd SD1
  5. add link x5
  6. validate → expect 0 errors
  7. Leer .opmodel resultante → comparar estructura con fixture
```

Los tests invocan funciones de comando directamente (no spawn de procesos).

### Estrategia TDD

Cada comando: red (test falla) → green (minimo para pasar) → refactor.

---

## 8. Entidades Fuera de Scope (P1+)

Las siguientes entidades se agregarán al CLI despues del P0:
- Appearances (mas relevante para UI que CLI)
- Modifiers
- Fans
- Scenarios, Assertions, Requirements, Stereotypes, SubModels

Tambien fuera de scope P0:
- `opmod update` (modificar entidades existentes)
- `opmod opl` (exportar/importar OPL)
- `opmod simulate`
- `opmod diff`
- Autocompletado shell
- Colorized output
