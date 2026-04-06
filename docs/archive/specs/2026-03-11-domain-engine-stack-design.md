# Domain Engine — Stack & Architecture Design

Fecha: 2026-03-11
Estado: Aprobado
Decisiones previas: DA-1 (CLI-first), DA-2 (Typed Category Store), DA-3 (Single-user), DA-4 (Layered)
Fuente de verdad: `specs/opm-data-model.md` Rev.3, `specs/opm-json-schema.json`

---

## 1. Stack Tecnologico

**TypeScript monorepo** — un solo lenguaje en todas las capas.

| Componente | Tecnologia |
|---|---|
| Domain Engine (`packages/core`) | TypeScript puro, zero dependencies externas |
| CLI (`packages/cli`) | TypeScript + Commander.js |
| Web UI (`packages/web`) | TypeScript + framework TBD (futuro) |
| Runtime | Bun (dev), compatible Node (produccion) |
| Tests | Vitest |
| Monorepo | Bun workspaces |

### Justificacion

- **Claude Code como co-piloto:** TypeScript es donde el agente rinde mejor en generacion, modificacion y testing de codigo.
- **Domain Engine compartido:** El mismo codigo corre en Node (CLI) y browser (Web UI) sin adaptacion — calza con DA-4 (Domain Engine shared entre interfaces).
- **Velocidad de iteracion:** Cambio -> test -> resultado en <1s con Vitest + Bun.
- **Type system suficiente:** Discriminated unions de TS modelan los 14 LinkTypes, 2 Thing kinds, y condicionales del JSON Schema.

---

## 2. Estructura del Monorepo

```
opmodel/
├── specs/                          # Fuente de verdad (ya existe)
├── packages/
│   ├── core/                       # Domain Engine — zero dependencies
│   │   ├── src/
│   │   │   ├── types/              # Tipos TS derivados del JSON Schema
│   │   │   ├── invariants/         # I-01 a I-32, validacion runtime
│   │   │   ├── store/              # In-memory graph (CRUD de entidades)
│   │   │   ├── serialization/      # Load/save .opmodel (JSON <-> graph)
│   │   │   └── index.ts            # API publica del engine
│   │   ├── tests/
│   │   └── package.json
│   ├── cli/                        # `opmod` — importa core
│   │   ├── src/
│   │   └── package.json
│   └── web/                        # Web UI (futuro) — importa core
│       └── package.json
├── tests/                          # Fixtures .opmodel compartidos
├── package.json                    # Workspace root
├── tsconfig.json
└── vitest.config.ts
```

---

## 3. Domain Engine — Arquitectura interna (`packages/core`)

### 3.1 Capas

```
┌─────────────────────────────────────────┐
│              API Publica                │
│  createModel, addThing, addLink, ...    │
│  (funciones puras, punto de entrada)    │
├─────────────────────────────────────────┤
│            Invariants                   │
│  guards: validate pre-mutation          │
│  effects: applied during mutation       │
├─────────────────────────────────────────┤
│              Store                      │
│  Model (in-memory graph)               │
│  Maps indexados por id                  │
├─────────────────────────────────────────┤
│          Serialization                  │
│  load(.opmodel -> Model)               │
│  save(Model -> .opmodel)               │
│  validate vs JSON Schema (estatica)     │
└─────────────────────────────────────────┘
```

### 3.2 Store: grafo en memoria

```typescript
interface Model {
  opmodel: string                      // Schema version, e.g., "1.1.0" (semver pattern ^\d+\.\d+\.\d+$)
  meta: Meta
  settings: Settings
  things: Map<string, Thing>           // key: entity id
  states: Map<string, State>           // key: entity id
  opds: Map<string, OPD>              // key: entity id
  links: Map<string, Link>            // key: entity id
  modifiers: Map<string, Modifier>    // key: entity id
  appearances: Map<string, Appearance> // key: `${thing}::${opd}` (PK compuesto, no tiene id)
  fans: Map<string, Fan>              // key: entity id
  scenarios: Map<string, Scenario>    // key: entity id
  assertions: Map<string, Assertion>  // key: entity id
  requirements: Map<string, Requirement> // key: entity id
  stereotypes: Map<string, Stereotype>   // key: entity id
  subModels: Map<string, SubModel>       // key: entity id
}
```

**Convencion de keys:** Todos los Maps usan el `id` de la entidad como key, excepto `appearances` que usa `${thing}::${opd}` como key compuesto (la entidad no tiene `id` — su PK es el par `(thing, opd)`, invariante I-04).

Maps (no arrays) porque lookups por ID son O(1). Los invariantes necesitan buscar por ID constantemente. Arrays del `.opmodel` se convierten a Maps al cargar, se serializan como arrays sorted al guardar.

### 3.3 Invariants: validacion pre-mutation

Cada mutacion pasa por un validador antes de aplicarse:

```typescript
function addThing(model: Model, thing: Thing): Result<Model, InvariantError> {
  const errors = validateAddThing(model, thing)
  if (errors.length > 0) return err(errors)
  return ok(applyAddThing(model, thing))
}
```

Division de invariantes:

| Grupo | Cuando | Ejemplos |
|---|---|---|
| **Estaticos** (JSON Schema) | Al cargar archivo | Tipos, enums, required, patterns, if/then |
| **Guards** (pre-mutation) | Antes de aplicar mutacion | I-01 (state.parent es object), I-05 (link endpoints existen), I-08 (id unico global), I-16 (unicidad enlace procedimental) |
| **Effects** (during mutation) | Aplicados como parte de la mutacion | I-02 (cascade delete: eliminar thing cascadea states, links, modifiers, appearances, requirements), I-19 (exhibition fuerza essence := informatical) |

### 3.4 Serialization: round-trip

```typescript
function load(json: string): Result<Model, LoadError>
  // 1. JSON.parse
  // 2. Validar vs JSON Schema (estatica)
  // 3. Convertir arrays -> Maps
  // 4. Validar invariantes runtime (I-01..I-32)
  // 5. Retornar Model

function save(model: Model): string
  // 1. Convertir Maps -> arrays sorted por id (conv. §7.2 conv. 3)
  //    Excepcion: appearances sorted por (thing, opd), no tiene id
  // 2. Omitir campos null (conv. §7.2 conv. 4)
  // 3. Sort keys alfabeticamente en cada objeto (conv. §7.2 conv. 1)
  // 4. JSON.stringify con formato 1-objeto-por-linea (conv. §7.2 conv. 2)
```

Invariante I-25 (round-trip): `load(save(model)) === model` — verificado como test.

### 3.5 API publica

```typescript
// Lifecycle
createModel(name: string, systemType?: SystemType): Model
loadModel(json: string): Result<Model, LoadError>
saveModel(model: Model): string

// Things
addThing(model: Model, thing: Thing): Result<Model, InvariantError>
removeThing(model: Model, thingId: string): Result<Model, InvariantError>  // cascade I-02

// States
addState(model: Model, state: State): Result<Model, InvariantError>
removeState(model: Model, stateId: string): Result<Model, InvariantError>

// Links
addLink(model: Model, link: Link): Result<Model, InvariantError>
removeLink(model: Model, linkId: string): Result<Model, InvariantError>

// OPDs
addOPD(model: Model, opd: OPD): Result<Model, InvariantError>
removeOPD(model: Model, opdId: string): Result<Model, InvariantError>

// Appearances
addAppearance(model: Model, appearance: Appearance): Result<Model, InvariantError>
removeAppearance(model: Model, thing: string, opd: string): Result<Model, InvariantError>

// Modifiers, Fans, Scenarios, Assertions, Requirements, Stereotypes, SubModels
// siguen el mismo patron add/remove

// Batch validation
validate(model: Model): InvariantError[]
```

**Patron:** Funciones puras. Model es immutable — cada mutacion produce copia nueva. Habilita undo/redo (stack de Models).

---

## 4. CLI (`opmod`)

Shell delgado sobre core. Parsea argumentos -> invoca core -> formatea output.

### 4.1 Comandos P0

```
opmod new "Coffee Making System" --type artificial
opmod load path/to/model.opmodel
opmod save [path/to/model.opmodel]

opmod add thing "Water" --kind object --essence physical
opmod add process "Heating" --essence physical
opmod add state "cold" --parent obj-water --initial --default
opmod add link --type effect --source proc-heating --target obj-water
opmod add opd "SD1" --parent opd-sd --refines proc-heating --refinement in-zoom

opmod remove thing obj-water
opmod remove link lnk-heating-effect-water

opmod list things [--kind object|process]
opmod list links [--type effect|agent|...]
opmod list opds [--tree]

opmod show obj-water
opmod show opd-sd --opl

opmod validate [--strict]
```

### 4.2 Comandos pulsos posteriores

```
opmod opl export [path]            # P2
opmod opl import path              # P2
opmod simulate [--iterations N]    # P5
opmod query "..."                  # P7
opmod nl "..."                     # P2
opmod diff v1.opmodel v2.opmodel   # P7
```

### 4.3 Decisiones

| Decision | Razon |
|---|---|
| Session-based (`opmod load` carga en memoria, comandos operan sobre el) | Permite encadenar sin re-parsear. State en `.opmod-session` (ver §4.4) |
| IDs explicitos en output | `opmod add thing "Water"` retorna `Created obj-water` |
| Result en stdout, errors en stderr | Standard UNIX. Exit 0=ok, 1=validation, 2=fatal |
| JSON output con `--json` | Habilita tool-use por agentes AI (DA-1) |
| Commander.js | Maduro, bien documentado, Claude Code lo conoce |

### 4.4 Archivo de sesion (`.opmod-session`)

El CLI mantiene estado de sesion en un archivo local para evitar re-parsear el `.opmodel` en cada comando.

| Aspecto | Detalle |
|---|---|
| **Nombre** | `.opmod-session` |
| **Ubicacion** | CWD del usuario (junto al `.opmodel`) |
| **Contenido** | JSON: `{ "model_path": "path/to/model.opmodel", "model": <Model serializado> }` |
| **Creacion** | `opmod load path/to/model.opmodel` o `opmod new "Name"` |
| **Actualizacion** | Cada comando mutante (add, remove) sobreescribe el archivo |
| **Destruccion** | `opmod save` persiste al `.opmodel` y elimina la sesion. `opmod close` descarta sin guardar |
| **Git** | Debe incluirse en `.gitignore` — es estado transitorio, no artefacto versionable |
| **Sin sesion** | Comandos que requieren modelo activo (add, remove, list, show, validate) retornan exit 2 con mensaje `No active session. Run 'opmod load <file>' first.` |
| **`opmod save` sin path** | Usa `model_path` del archivo de sesion como destino por defecto |

---

## 5. Decisiones descartadas

| Opcion descartada | Razon |
|---|---|
| Rust core + TS shell | Claude Code menos fluido en Rust. Boundary WASM agrega complejidad. Dos lenguajes. |
| Go core + TS UI | Domain Engine no corre en browser — viola DA-4 (shared engine). |
| Mutable Model con eventos | Mas complejo que immutable + copy. Undo/redo mas dificil. |
| Arrays en memoria | O(n) lookups. Los invariantes necesitan O(1) por ID. |
