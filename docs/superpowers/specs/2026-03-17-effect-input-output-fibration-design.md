# Effect / Input-Output Fibration Design Spec

**Fecha**: 2026-03-17
**Autor**: fxsl/arquitecto-categorico
**Estado**: Draft
**DA**: DA-8 (Effect Fibration)

---

## 1. Problema

El data model codifica 6 tipos de transforming links (ISO 19450 §9) bajo un solo `type: "effect"` con `source_state?` y `target_state?` opcionales. El OPL ya distingue correctamente las 4 variantes ("affects", "changes from s₁", "changes to s₂", "changes from s₁ to s₂"), pero el canvas visual trata todos los effect links con el mismo rendering bidireccional ↔, ignorando:

1. **Input-output pair** (effect + source_state + target_state): ISO muestra dos segmentos → dirigidos — uno desde s₁ al proceso, otro del proceso a s₂.
2. **Input-specified** (effect + source_state): ISO muestra un segmento → desde s₁ al proceso.
3. **Output-specified** (effect + target_state): ISO muestra un segmento → del proceso a s₂.

Además, la distinción entre estos modos está implementada ad-hoc en cada capa (`opl.ts` con `if/else`, canvas sin implementar) sin un punto único de verdad.

## 2. Fundamento categórico

Effect y input-output pair son **dos presentaciones del mismo morfismo** bajo una fibración de resolución de estados:

```
π: C_specified → C_abstract     (funtor de olvido)

       effect + (s₁, s₂)  ──π──▶  effect     (input-output)
       effect + (s₁, _)   ──π──▶  effect     (input-specified)
       effect + (_, s₂)   ──π──▶  effect     (output-specified)
       effect + (_, _)     ──π──▶  effect     (identidad)
```

El funtor `transformingMode` es la sección computada que recupera el nivel de especificación:

```
transformingMode: Link → TransformingMode | null
```

Zero schema change. Puro cómputo derivado de `source_state` y `target_state`.

## 3. Diseño

### 3.1. Tipo `TransformingMode`

```typescript
// helpers.ts
export type TransformingMode = "effect" | "input-specified" | "output-specified" | "input-output";

export function transformingMode(link: Link): TransformingMode | null {
  if (link.type !== "effect") return null;
  const hasSource = !!link.source_state;
  const hasTarget = !!link.target_state;
  if (hasSource && hasTarget) return "input-output";
  if (hasSource) return "input-specified";
  if (hasTarget) return "output-specified";
  return "effect";
}
```

Re-exportado desde `index.ts`.

### 3.2. Canvas: rendering por modo

El canvas genera entries visuales por link. Para effect links, el modo determina cuántos segmentos y qué markers usar:

| Modo | Segmentos | source | target | markers |
|------|-----------|--------|--------|---------|
| `"effect"` | 1 | Objeto (rect completo) | Proceso | ↔ `markerStart` + `markerEnd` |
| `"input-specified"` | 1 | s₁ (state pill) | Proceso | → `markerEnd` solo |
| `"output-specified"` | 1 | Proceso | s₂ (state pill) | → `markerEnd` solo |
| `"input-output"` | 2 | s₁ → Proceso + Proceso → s₂ | (dos entries) | → + → |

#### Mecánica de split para `input-output`

El pipeline `visibleLinks` en OpdCanvas ya tiene precedente con DA-7 `findConsumptionResultPairs` que genera entries sintéticas para merged consumption+result pairs. Se añade un paso análogo:

```
visibleLinks pipeline:
  1. resolveLinksForOpd(model, opdId)           // existente
  2. findConsumptionResultPairs(...)             // existente (DA-7)
  3. splitInputOutputPairs(entries)              // NUEVO — desdobla effect con 2 estados
  4. Filtrar resultIds de DA-7                   // existente
  5. Render entries                              // existente
```

Para un effect link `{id: "lnk-x", source_state: s₁, target_state: s₂}`, el paso 3 reemplaza el entry original por dos entries:

- **Input half**: `{link: {..., target_state: undefined}, visualSource: objectId, visualTarget: processId, isInputHalf: true}`
  - Routing: srcRect = pill de s₁, tgtRect = proceso
  - Markers: `markerEnd = → ` solo (sin markerStart)

- **Output half**: `{link: {..., source_state: undefined}, visualSource: processId, visualTarget: objectId, isOutputHalf: true}`
  - Routing: srcRect = proceso, tgtRect = pill de s₂
  - Markers: `markerEnd = →` solo (sin markerStart)

#### Markers para modos parciales (`input-specified`, `output-specified`)

Para effect links con un solo estado, no se genera split — se modifica el marker assignment:

```typescript
case "effect": {
  const mode = transformingMode(link);
  if (mode === "effect") {
    markerEnd = "url(#arrow-proc)";       // ↔ bidirectional
    markerStart = "url(#arrow-proc)";
  } else {
    markerEnd = "url(#arrow-proc)";       // → unidirectional
    // markerStart omitted
  }
  break;
}
```

#### Routing para modos parciales

- `input-specified`: srcRect = pill de source_state, tgtRect = proceso. Ya funciona con la lógica existente de routing a state pill (líneas 841-861 de OpdCanvas.tsx), solo necesita remover markerStart.
- `output-specified`: srcRect = proceso, tgtRect = pill de target_state. Requiere agregar routing del target endpoint a la state pill del target_state (actualmente solo se rutea source_state en la rama effect).

### 3.3. OPL

Sin cambio funcional. El módulo `opl.ts` ya implementa correctamente las 4 variantes en líneas 192-207. Opcionalmente se puede refactorizar para usar `transformingMode()` en lugar del `if/else` ad-hoc, pero no es requisito.

### 3.4. Simulación

Sin cambio. Phase 2 lee `link.target_state` directamente para actualizar `obj.currentState`. Funciona correctamente en los 4 modos.

### 3.5. I-16 guard

Sin cambio. Trata `type: "effect"` como una unidad independientemente del modo. La exclusividad mutua con consumption/result se mantiene.

### 3.6. DA-7 (`findConsumptionResultPairs`)

Sin cambio. Es ortogonal — opera sobre links de tipo consumption/result, no sobre effect.

## 4. Archivos a modificar

| Archivo | Cambio | LOC estimado |
|---------|--------|--------------|
| `packages/core/src/helpers.ts` | NUEVO: `TransformingMode` type + `transformingMode()` función | ~15 |
| `packages/core/src/index.ts` | Re-exportar `TransformingMode`, `transformingMode` | ~2 |
| `packages/core/tests/helpers.test.ts` | 5 tests para `transformingMode` (4 modos + non-effect → null) | ~30 |
| `packages/web/src/components/OpdCanvas.tsx` | Refactor markers por modo + split input-output + routing output-specified | ~60 |

## 5. NO se modifica

- `types.ts` — zero schema change
- `api.ts` — I-16, findConsumptionResultPairs intactos
- `opl.ts` — ya correcto
- `simulation.ts` — ya correcto
- `.opmodel` fixtures — ya correctos (driver-rescuing tiene 2 input-output pairs, coffee-making usa effect+consumption+result)

## 6. Verificación

### Tests automáticos

- 5 tests unitarios para `transformingMode` en `helpers.test.ts`
- `bunx vitest run` — 570+ tests, 0 regresiones

### Verificación visual (manual, browser)

Con fixture `driver-rescuing.opmodel`:

1. `lnk-callhandling-effect-danger` (endangered→safe) — dos segmentos →: pill "endangered" → Call Handling, Call Handling → pill "safe"
2. `lnk-calltrans-effect-call` (requested→online) — dos segmentos →: pill "requested" → Call Transmitting, Call Transmitting → pill "online"
3. `lnk-rescuing-effect-driver` (sin estados) — ↔ bidireccional entre Driver y Driver Rescuing

### OPL sin regresión

Los 43 tests de OPL deben pasar sin modificación.

## 7. Referencia ISO

Basado en ISO 19450 §9.2 (Effect Link) y §9.3.3 (Input-Output Link Pair). Imagen de referencia: `OPM_Procedural_Links.png`.

| Nombre ISO | `type` | `source_state` | `target_state` | `transformingMode` |
|------------|--------|----------------|-----------------|---------------------|
| Effect Link | `"effect"` | — | — | `"effect"` |
| Input-Specified Effect | `"effect"` | ✓ | — | `"input-specified"` |
| Output-Specified Effect | `"effect"` | — | ✓ | `"output-specified"` |
| Input-Output Link Pair | `"effect"` | ✓ | ✓ | `"input-output"` |
| Consumption Link | `"consumption"` | — | — | `null` |
| State-Specified Consumption | `"consumption"` | ✓ | — | `null` |
| Result Link | `"result"` | — | — | `null` |
| State-Specified Result | `"result"` | — | ✓ | `null` |
