# OPL Lens Bidireccional — Design Spec

> **Sub-proyecto A** del L-M2-01 (OPL Sync). Sub-proyecto B (Functor NL → OPL via LLM) se aborda por separado.

**Fecha:** 2026-03-12
**Estado:** Aprobado

---

## Objetivo

Implementar una lens bidireccional `(expose, update)` en `packages/core/` que sincronice el grafo OPM con una representación OPL tipada (AST), cumpliendo las leyes categóricas PutGet y GetPut.

```
expose      : (Model, OpdId) → OplDocument
applyOplEdit: (Model, OplEdit) → Result<Model, InvariantError>
render      : (OplDocument) → string
```

La lens opera sobre un AST tipado (`OplDocument`), no sobre texto libre. El parsing de lenguaje natural es responsabilidad del Sub-proyecto B.

---

## Fundamento Categórico

**DA-6** define: `Lens_bimodal = (expose: Graph → OPL, applyOplEdit: Graph × OPL_edit → Graph)`

Leyes:
- **PutGet**: `expose(applyOplEdit(m, edit)) ⊇ sentenceFor(edit)` — un edit aplicado se refleja en la vista
- **GetPut**: `expose(applyOplEdit(m, editsFrom(expose(m)))) ≅ expose(m)` — re-aplicar lo expuesto no cambia la vista (igualdad estructural, no referencial)

### `editsFrom` — función auxiliar para GetPut

```typescript
function editsFrom(doc: OplDocument): OplEdit[]
```

Reconstruye la secuencia de edits que produciría un `OplDocument` dado. Usada exclusivamente en tests para verificar GetPut. Algoritmo:
1. Para cada `OplThingDeclaration` → `{ kind: "add-thing", opdId: doc.opdId, thing: { kind, name, essence, affiliation }, position: { x: 0, y: 0 } }`
2. Para cada `OplStateEnumeration` → `{ kind: "add-states", thingId, states: [...] }`
3. Para cada `OplLinkSentence` → `{ kind: "add-link", link: { type, source, target, ... } }`
4. Para cada `OplModifierSentence` → `{ kind: "add-modifier", modifier: { over: linkId, type, negated } }`

La position `{ x: 0, y: 0 }` es un default de test — GetPut compara sentences (no posiciones).

---

## Tipos OPL (AST)

### OplSentence — Unión discriminada

```typescript
interface OplThingDeclaration {
  kind: "thing-declaration";
  thingId: string;
  name: string;
  thingKind: Kind;      // "object" | "process" — named thingKind to avoid clash with discriminant `kind`
  essence: Essence;
  affiliation: Affiliation;
  alias?: string;       // computational alias, included when opl_alias_visibility=true
}

interface OplStateEnumeration {
  kind: "state-enumeration";
  thingId: string;
  thingName: string;
  stateIds: string[];
  stateNames: string[];
}

interface OplDuration {
  kind: "duration";
  thingId: string;
  thingName: string;
  nominal: number;
  unit: TimeUnit;
}

interface OplLinkSentence {
  kind: "link";
  linkId: string;
  linkType: LinkType;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  sourceStateName?: string;
  targetStateName?: string;
  tag?: string;           // populated from Link.tag for tagged links
}

interface OplModifierSentence {
  kind: "modifier";
  modifierId: string;
  linkId: string;
  linkType: LinkType;
  sourceName: string;
  targetName: string;
  modifierType: ModifierType;
  negated: boolean;
}

type OplSentence =
  | OplThingDeclaration
  | OplStateEnumeration
  | OplDuration
  | OplLinkSentence
  | OplModifierSentence;
```

### OplDocument

```typescript
interface OplDocument {
  opdId: string;
  opdName: string;
  sentences: OplSentence[];
}
```

### OplEdit — Ediciones estructuradas

```typescript
type OplEdit =
  | { kind: "add-thing"; opdId: string; thing: Omit<Thing, "id">; position: Position }
  | { kind: "remove-thing"; thingId: string }
  | { kind: "add-states"; thingId: string; states: Omit<State, "id" | "parent">[] }
  | { kind: "remove-state"; stateId: string }
  | { kind: "add-link"; link: Omit<Link, "id"> }
  | { kind: "remove-link"; linkId: string }
  | { kind: "add-modifier"; modifier: Omit<Modifier, "id"> }
  | { kind: "remove-modifier"; modifierId: string };
```

### Decisiones de diseño sobre tipos

| Decisión | Razón |
|----------|-------|
| Sentences llevan IDs de entidad | Necesario para round-trip de la lens sin resolución ambigua por nombre |
| `OplStateEnumeration` agrupa todos los estados de una thing | Consistente con ISO 19450: "Water can be liquid, solid or gas" |
| `OplEdit` usa `Omit<T, "id">` | IDs son auto-generados por `applyOplEdit` (via `oplSlug()`) |
| `add-thing` requiere `opdId` + `position` | Declarar una thing en OPL implica visibility en ese OPD |
| No hay `modify-*` edits | Aunque `updateThing` existe en la API, los edits modify-* añaden complejidad al v1 sin beneficio claro. Se agregan incrementalmente. |
| `thingKind` en vez de `type` para Kind | Evita colisión con el campo discriminante `kind` de la unión |
| `OplLinkSentence.linkType` / `OplModifierSentence.modifierType` | Nombres OPL-específicos que mapean a `Link.type` y `Modifier.type` respectivamente. El mapping explícito en `expose` es: `sentence.linkType = link.type`, `sentence.linkId = modifier.over` |
| `OplDuration` solo expone `nominal` + `unit` | OPL muestra el valor nominal; min/max son metadata de validación, no parte de la sentence ISO 19450 |
| `OplThingDeclaration.alias` es opcional | Solo se popula cuando `settings.opl_alias_visibility === true` y la thing tiene `computational.alias` |
| `OplLinkSentence.tag` es opcional | Populado desde `Link.tag` solo para links de tipo `tagged`. `render` usa fallback `"relates to"` si ausente |
| `OplModifierSentence.negated` es required (boolean) | `expose` coalece `Modifier.negated` (optional) a `false` cuando es `undefined` |
| `add-states` defaults para booleans | Los estados creados via `editsFrom` usan `initial: false, final: false, default: false` como defaults |

---

## `expose` — Graph → OPL

```typescript
function expose(model: Model, opdId: string): OplDocument
```

### Algoritmo

1. Recolectar things visibles: appearances donde `app.opd === opdId`
2. Para cada thing visible:
   - Emitir `OplThingDeclaration` (filtrada por settings de visibilidad)
   - Si tiene estados → `OplStateEnumeration`
   - Si tiene duration → `OplDuration`
3. Para cada link donde source AND target son visibles en el OPD:
   - Emitir `OplLinkSentence`
4. Para cada modifier sobre un link visible:
   - Emitir `OplModifierSentence`

### Settings que parametrizan `expose`

| Setting | Efecto en `expose` |
|---------|-------------------|
| `opl_essence_visibility` | `"all"`: siempre incluye essence. `"non_default"`: omite si coincide con `primary_essence`. `"none"`: omite siempre |
| `opl_units_visibility` | `"always"`: incluye unidades en duration. `"hide"`: omite. `"when_applicable"`: solo si tiene unit |
| `opl_alias_visibility` | Si `true`, incluye alias computacional en thing declaration |
| `primary_essence` | La essence "default" para el filtro `non_default` |

### Orden de sentences

Determinista y estable: things primero (objetos, luego procesos; dentro de cada grupo por ID léxico), agrupadas: declaration → states → duration. Luego links (por ID léxico). Luego modifiers (por ID léxico).

---

## `applyOplEdit` — Model × OplEdit → Result<Model, InvariantError>

```typescript
function applyOplEdit(model: Model, edit: OplEdit): Result<Model, InvariantError>
```

### Mapping edit → operaciones del grafo

| Edit | Operaciones |
|------|-------------|
| `add-thing` | `addThing` (id auto-generado) + `addAppearance` (en opdId, con position, defaults: `w: 120, h: 60, internal: false`) |
| `remove-thing` | `removeThing` (cascadea states, links, appearances, OPDs hijos) |
| `add-states` | `addState` por cada estado, construyendo `{ id: "state-${oplSlug(name)}", parent: edit.thingId, ...stateData }` |
| `remove-state` | `removeState` |
| `add-link` | `addLink` |
| `remove-link` | `removeLink` |
| `add-modifier` | `addModifier` |
| `remove-modifier` | `removeModifier` |

### `oplSlug` — generación de IDs

```typescript
function oplSlug(name: string): string
```

Convierte un nombre a un slug kebab-case: `toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")`. Definida en `opl.ts` (no reutiliza la de CLI porque core es zero-dep respecto a CLI).

**Patrones de ID:**
- Things: `obj-${oplSlug(name)}` o `proc-${oplSlug(name)}` según kind
- States: `state-${oplSlug(name)}`
- Links: `lnk-${oplSlug(sourceId)}-${linkType}-${oplSlug(targetId)}`
- Modifiers: `mod-${oplSlug(linkId)}-${modifierType}`

**Colisiones de ID:** Si el ID generado ya existe en el modelo, se añade un sufijo numérico incremental: `obj-water` → `obj-water-2` → `obj-water-3`. La función prueba el ID base primero, luego itera con sufijo hasta encontrar uno libre. El invariante I-08 (unicidad de IDs) se satisface por construcción.

### Errores

Delegados a la API existente. `applyOplEdit` no valida semántica OPM — los invariantes en `api.ts` (I-01 a I-19) se encargan. `applyOplEdit` retorna el `Result<Model, InvariantError>` que devuelve la API.

### Lo que `applyOplEdit` NO hace

- No valida semántica OPM (eso son los invariantes)
- No resuelve nombres a IDs (los edits ya contienen datos suficientes)
- No gestiona undo/redo (eso es `History<T>`, capa superior)
- No parsea texto libre (eso es Sub-proyecto B)

---

## `render` — OplDocument → string

```typescript
function render(doc: OplDocument): string
```

Serializa un `OplDocument` a texto OPL legible, siguiendo patrones ISO 19450.

### Patrones por tipo de sentence

| Sentence | Patrón |
|----------|--------|
| `thing-declaration` | `"{name} is a/an {kind}, {essence}, {affiliation}."` |
| `state-enumeration` | `"{name} can be {s1}, {s2} or {sN}."` |
| `duration` | `"{name} requires {nominal}{unit}."` |
| `link:agent` | `"{source} handles {target}."` |
| `link:instrument` | `"{source} is an instrument of {target}."` |
| `link:consumption` | `"{source} consumes {target}."` |
| `link:effect` | `"{source} affects {target}[, from {s1} to {s2}]."` |
| `link:result` | `"{source} yields {target}."` |
| `link:input` | `"{source} requires {target}."` |
| `link:output` | `"{source} outputs {target}."` |
| `link:aggregation` | `"{source} consists of {target}."` |
| `link:exhibition` | `"{source} exhibits {target}."` |
| `link:generalization` | `"{target} is a {source}."` |
| `link:classification` | `"{target} is classified by {source}."` |
| `link:invocation` | `"{source} invokes {target}."` |
| `link:exception` | `"{source} handles exception from {target}."` |
| `link:tagged` | `"{source} {tag} {target}."` (si `tag` ausente, usa `"relates to"` como fallback) |
| `modifier` | `"{linkType} link from {source} to {target} has {modType} modifier."` |

---

## Lens Laws — Estrategia de testing

### Tests (~25 estimados)

| Categoría | Tests | Qué verifica |
|-----------|-------|-------------|
| expose básico | 5 | Thing declarations, state enumerations, durations, links, modifiers para things visibles en OPD |
| expose settings | 3 | `opl_essence_visibility` (all/non_default/none), `opl_units_visibility`, `opl_alias_visibility` |
| expose filtro | 2 | Omite links con endpoint fuera del OPD, omite things sin appearance |
| render | 4 | Texto correcto para cada tipo de sentence, effect con states, a/an grammar |
| PutGet | 5 | add-thing → expose contiene declaration, add-link → expose contiene link sentence, add-states → expose contiene enumeration, remove-thing → expose ya no contiene, remove-link → expose ya no contiene |
| GetPut | 2 | Round-trip: expose → editsFrom → update → expose = original (modelo vacío, modelo con things+links) |
| update errors | 3 | add-thing en OPD inexistente falla, add-link con endpoint inexistente falla, remove-thing inexistente falla |
| render edge cases | 1 | Documento vacío → string vacío |

### Nota sobre GetPut

Igualdad estructural (`≅`): se comparan los `OplDocument` resultantes (sentences sin considerar IDs auto-generados), no el `Model` byte a byte.

---

## Estructura de archivos

### `packages/core/` (crear + modificar)

| Archivo | Acción | Contenido |
|---------|--------|-----------|
| `src/opl-types.ts` | Crear | `OplSentence`, `OplDocument`, `OplEdit` + subtipos |
| `src/opl.ts` | Crear | `expose`, `applyOplEdit`, `render`, `oplSlug`, `editsFrom` |
| `src/index.ts` | Modificar | Re-exportar `expose`, `applyOplEdit`, `render` + tipos OPL |
| `tests/opl.test.ts` | Crear | ~25 tests |

### `packages/cli/` (crear + modificar)

| Archivo | Acción | Contenido |
|---------|--------|-----------|
| `src/commands/opl.ts` | Crear | `executeOpl(file, opts)` |
| `src/cli.ts` | Modificar | Registrar comando `opl` |
| `src/index.ts` | Modificar | Re-exportar `executeOpl` |
| `tests/opl.test.ts` | Crear | ~5 tests del comando |

### `packages/web/` (modificar, opcional)

| Archivo | Acción | Contenido |
|---------|--------|-----------|
| `src/lib/opl.ts` | Modificar | Reemplazar implementación local por `import { expose, render } from "@opmodel/core"` |

### CLI: `opmod opl`

```
opmod opl <file>                    # OPL del SD (OPD raíz)
opmod opl <file> --opd <opdId>      # OPL de un OPD específico
opmod opl <file> --json             # Output como OplDocument JSON
```

---

## Fuera de alcance

- Parser de texto libre (Sub-proyecto B)
- Lenguaje natural → OPL (Sub-proyecto B)
- `modify-*` edits (la API ya tiene `updateThing` et al., pero añadir modify-edits en v1 agrega complejidad sin beneficio inmediato — extensión incremental)
- Dependencias externas (zero-dep se mantiene)
- OPL en idiomas distintos a inglés
