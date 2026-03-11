# Refinement (In-zoom / Unfold) — Design Spec

> **Para agentes:** REQUIRED: Usar superpowers:subagent-driven-development para implementar el plan derivado de este spec.

**Goal:** Implementar `refineThing` como construcción universal parametrizada en el Domain Engine, exponerla vía CLI, y cerrar gaps de invariantes relacionados con refinamiento.

**Scope:** `packages/core/` + `packages/cli/` (no `packages/web/`)

---

## 1. Análisis Categórico

### 1.1 Construcción Universal

In-zoom y unfold son instancias de la **misma construcción universal** en la opfibración π: **C**_opm → **C**_opd_tree.

Dado un Thing T visible en una fibra `fibra(OPD_parent)`, refinar T produce:

```
refine(T, OPD_parent, S) = (OPD_child, Im(PB_S))
```

donde:
- `OPD_child` es un nuevo objeto en **C**_opd_tree con morfismo `OPD_child → OPD_parent`
- `PB_S` es el pullback parametrizado por el selector S
- `Im(PB_S)` es la imagen del pullback — Things que aparecen como externos en la nueva fibra

### 1.2 Selectores

El selector S es un morfismo `S: RefinementType → (Model × ThingId × OpdId → Set<ThingId>)`:

| RefinementType | Selector S(T, model, opdId) → Set\<ThingId\> |
|---|---|
| `"in-zoom"` | Things conectados a T via cualquier link en `fibra(OPD_parent)`. Formalmente: `{t ∈ fibra(OPD_parent) \| ∃ lnk ∈ model.links: (lnk.source = T ∧ lnk.target = t) ∨ (lnk.target = T ∧ lnk.source = t)}` donde t tiene appearance en OPD_parent |
| `"unfold"` | Things conectados a T via links estructurales (aggregation o exhibition) donde T es source. Formalmente: `{t ∈ fibra(OPD_parent) \| ∃ lnk ∈ model.links: lnk.type ∈ {"aggregation", "exhibition"} ∧ lnk.source = T ∧ lnk.target = t}` donde t tiene appearance en OPD_parent. Aggregation captura parts, exhibition captura attributes (§L-M1-08: "parts/attributes"). |

### 1.3 Diferencia marginal

La infraestructura (crear OPD hijo, computar pullback, generar appearances, marcar internal/external, invariantes) es 100% compartida. La diferencia es exactamente la función selectora — ~5 líneas de código.

---

## 2. API Core: `refineThing`

### 2.1 Signature

```typescript
export function refineThing(
  model: Model,
  thingId: string,        // Thing a refinar
  parentOpdId: string,    // OPD donde T es visible (fibra base)
  refinementType: RefinementType,  // "in-zoom" | "unfold"
  childOpdId: string,     // ID para el nuevo OPD (caller genera)
  childOpdName: string,   // Nombre para el nuevo OPD (caller genera)
): Result<Model, InvariantError>
```

### 2.2 Algoritmo

```
1. Validar pre-condiciones (ver §3)
2. Computar pullback:
   a. Obtener appearances en fibra(OPD_parent): {a | a.opd === parentOpdId}
   b. Obtener things en fibra: thingsInFiber = Set de a.thing
   c. Aplicar selector S(refinementType) para obtener externalThings ⊂ thingsInFiber
3. Crear OPD hijo:
   {id: childOpdId, name: childOpdName, opd_type: "hierarchical",
    parent_opd: parentOpdId, refines: thingId, refinement_type: refinementType}
4. Generar appearances externas:
   Para cada t ∈ externalThings:
     appearance(thing=t, opd=childOpdId, x=default, y=default, w=default, h=default, internal=false)
5. Generar appearance del Thing refinado:
   appearance(thing=thingId, opd=childOpdId, x=0, y=0, w=200, h=150, internal=true)
6. Aplicar touch() y retornar ok(model')
```

### 2.3 Layout por defecto de appearances externas

Las appearances externas se posicionan con un layout simple:

```
x = 50 + (index * 150)    // distribución horizontal
y = 50                     // misma fila
w = 120                    // ancho estándar
h = 60                     // alto estándar
```

El layout es un placeholder — el web editor reposicionará al gusto del usuario.

### 2.4 Retorno

El Model actualizado contiene:
- `model.opds`: nuevo OPD hijo insertado
- `model.appearances`: N+1 appearances nuevas (N externas + 1 interna del Thing refinado)

---

## 3. Pre-condiciones y Errores

| # | Validación | Error code | Mensaje |
|---|-----------|------------|---------|
| 1 | `model.things.has(thingId)` | `NOT_FOUND` | `Thing not found: ${thingId}` |
| 2 | `model.opds.has(parentOpdId)` | `NOT_FOUND` | `OPD not found: ${parentOpdId}` |
| 3 | Parent OPD es hierarchical: `parentOpd.opd_type === "hierarchical"` | `INVALID_REFINEMENT` | `Cannot refine from view OPD: ${parentOpdId}` |
| 4 | `model.appearances.has(\`${thingId}::${parentOpdId}\`)` | `NOT_FOUND` | `Thing ${thingId} has no appearance in OPD ${parentOpdId}` |
| 5 | Si `refinementType === "unfold"`: Thing debe ser object (`thing.kind === "object"`) | `INVALID_REFINEMENT` | `Unfold only applies to objects, not processes: ${thingId}` |
| 6 | No existe OPD con `refines===thingId` y `parent_opd===parentOpdId` y `refinement_type===refinementType` | `ALREADY_REFINED` | `Thing ${thingId} already has ${refinementType} refinement from OPD ${parentOpdId}` |
| 7 | `!collectAllIds(model).has(childOpdId)` | `I-08` | `Duplicate id: ${childOpdId}` |

---

## 4. Nuevas Validaciones en `validate()`

Nota: I-20 e I-21 ya existen en el data model con otros significados (I-20: "In-zoom genera fibra", I-21: "Reticulado exclusivo Sub(O)"). Las validaciones nuevas usan códigos descriptivos para no colisionar.

### DANGLING_REFINES: Refinement target existe

```
∀ opd ∈ model.opds:
  if opd.refines !== undefined:
    model.things.has(opd.refines) === true
```

Error: `{code: "DANGLING_REFINES", message: "OPD ${opd.id} refines non-existent thing: ${opd.refines}"}`

### INCONSISTENT_REFINEMENT: Refinement fields consistentes

```
∀ opd ∈ model.opds:
  (opd.refines !== undefined) === (opd.refinement_type !== undefined)
```

Error: `{code: "INCONSISTENT_REFINEMENT", message: "OPD ${opd.id} has refines without refinement_type or vice versa"}`

---

## 5. Gap fix: `removeThing` cascade a OPDs de refinamiento

### Problema actual

`removeThing` no cascadea OPDs donde `refines === thingId`. Esto deja OPDs huérfanos con `refines` apuntando a un Thing inexistente — violación de `DANGLING_REFINES`.

### Corrección

En `removeThing`, después de los cascades actuales (states, links, appearances, modifiers, fans), agregar:

```
Para cada opd ∈ model.opds donde opd.refines === thingId:
  → aplicar removeOPD cascade (elimina OPD + descendants + appearances)
```

El orden categórico: primero colapsar fibras hijas (OPDs de refinamiento y sus descendientes), luego eliminar el Thing del grafo. La implementación existente de `removeOPD` ya recorre descendientes recursivamente.

---

## 6. CLI: `opmod refine`

### 6.1 Comando

```
opmod refine <thingId> --opd <opdId> --type <in-zoom|unfold> [--file model.opmodel]
```

### 6.2 Comportamiento

1. Leer modelo del archivo
2. Generar `childOpdId` con `generateId("opd")`
3. Computar `childOpdName` con convención de naming OPM:
   - Si parent es `"SD"` → hijos `"SD1"`, `"SD2"`, etc.
   - Si parent es `"SD1"` → hijos `"SD1.1"`, `"SD1.2"`, etc.
   - Regla: punto como separador a partir del segundo nivel
4. Llamar `refineThing(model, thingId, opdId, type, childOpdId, childOpdName)`
5. Persistir modelo
6. Imprimir resultado (OPD creado + appearances generadas)

### 6.3 Auto-naming

```typescript
function computeChildOpdName(parentName: string, existingChildCount: number): string {
  const index = existingChildCount + 1;
  // SD → SD1, SD2 (sin punto para primer nivel)
  // SD1 → SD1.1, SD1.2 (con punto para niveles posteriores)
  return parentName.length <= 2
    ? `${parentName}${index}`
    : `${parentName}.${index}`;
}
```

### 6.4 Output

```json
{
  "type": "refinement",
  "opd": {"id": "opd-sd1", "name": "SD1", "refines": "proc-coffee-making", "refinement_type": "in-zoom"},
  "appearances_created": 3
}
```

---

## 7. Archivos Involucrados

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `packages/core/src/api.ts` | Modificar | Agregar `refineThing`, fix `removeThing` cascade, agregar `DANGLING_REFINES` / `INCONSISTENT_REFINEMENT` a `validate()` |
| `packages/core/src/index.ts` | Modificar | Exportar `refineThing` |
| `packages/core/tests/api-refinement.test.ts` | Crear | Tests para `refineThing`, cascade, invariantes |
| `packages/cli/src/commands/refine.ts` | Crear | Handler del comando `opmod refine` |
| `packages/cli/src/cli.ts` | Modificar | Registrar comando `refine` |
| `packages/cli/src/index.ts` | Modificar | Exportar `executeRefine` |
| `packages/cli/tests/refine.test.ts` | Crear | Tests del comando CLI |

---

## 8. Qué NO está en scope

- **Web UI**: navegación entre OPDs, rendering de boundaries, drag de sub-procesos
- **Out-zoom**: es navegación (L-M3-01), no operación de dominio
- **Unfold-in-place**: L-M1-08 describe un unfold "en el OPD actual" que no crea OPD hijo — es una operación visual (agregar appearances de partes al OPD actual). Este spec cubre unfold-as-refinement (nueva fibra en la opfibración). El unfold-in-place se implementará como operación de UI en `packages/web/`
- **Semi-fold visual**: es rendering web (L-M1-08 visual), la estructura ya queda con `suppressed_states` y `semi_folded` en Appearance
- **Reordenamiento automático de OPD tree**: es feature de L-M3-01
- **Distribución de links al boundary**: es feature visual de L-M1-07 que requiere web
- **Point-of-mutation guards en `addOPD`/`updateOPD`**: actualmente no validan `refines` ni `refinement_type`. `refineThing` valida internamente antes de crear el OPD, pero callers directos de `addOPD` pueden crear OPDs con `refines` inválido. Gap conocido — se detecta en `validate()` via `DANGLING_REFINES` / `INCONSISTENT_REFINEMENT`, y se puede agregar guards a `addOPD`/`updateOPD` en un ciclo posterior

---

## 9. Decisiones de Diseño

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Unfold selector incluye `aggregation` + `exhibition` | Solo `aggregation` | L-M1-08 dice "parts/attributes": parts=aggregation, attributes=exhibition |
| Unfold solo para objects (`kind === "object"`) | Permitir en processes | OPM: unfold descompone estructura (objects), in-zoom descompone comportamiento (processes+objects) |
| Códigos `DANGLING_REFINES` / `INCONSISTENT_REFINEMENT` | Usar I-20/I-21 | I-20 e I-21 ya existen en data model §6.3 con otros significados |
| Parent OPD debe ser hierarchical | Permitir desde view | Views no participan en la opfibración π — no pueden generar fibras hijas |
| `refineThing` como función única parametrizada | Funciones separadas `inZoomThing`/`unfoldThing` | Misma construcción universal, selector como único parámetro diferenciador |
| Core no genera IDs ni nombres | Core auto-genera | Separación de responsabilidades: core es puro, CLI genera IDs/nombres |
