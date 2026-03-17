# Effect / Input-Output Fibration Design Spec

**Fecha**: 2026-03-17
**Autor**: fxsl/arquitecto-categorico
**Estado**: Draft
**DA**: DA-8 (Effect Fibration)

---

## 1. Problema

El data model codifica 4 variantes del effect link (ISO 19450 §9.2, §9.3.3) bajo un solo `type: "effect"` con `source_state?` y `target_state?` opcionales. El OPL ya distingue correctamente las 4 variantes ("affects", "changes from s₁", "changes to s₂", "changes from s₁ to s₂"), pero el canvas visual trata todos los effect links con el mismo rendering bidireccional ↔, ignorando:

1. **Input-output pair** (effect + source_state + target_state): ISO muestra dos segmentos → dirigidos — uno desde s₁ al proceso, otro del proceso a s₂.
2. **Input-specified** (effect + source_state): ISO muestra un segmento → desde s₁ al proceso.
3. **Output-specified** (effect + target_state): ISO muestra un segmento → del proceso a s₂.

Además, la distinción entre estos modos está implementada ad-hoc en cada capa (`opl.ts` con `if/else`, canvas sin implementar) sin un punto único de verdad.

### 1.1. Convención de dirección en el data model

**Importante**: En el data model, los effect links siguen la convención `source = process, target = object`. Los campos `source_state` y `target_state` se refieren al **objeto** (no al source/target del link):

- `source_state` = FROM state del objeto (estado previo)
- `target_state` = TO state del objeto (estado posterior)

Esta convención data model ≠ dirección visual ISO. El spec usa **"object endpoint"** y **"process endpoint"** para evitar confusión con los campos source/target del link.

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

El canvas genera entries visuales por link. Para effect links, el modo determina cuántos segmentos, qué markers, y qué dirección visual usar.

**Nota**: La tabla siguiente describe la **dirección visual ISO**, no los campos source/target del data model. En el data model, effect links siempre tienen source=process, target=object.

| Modo | Segmentos | Object endpoint | Process endpoint | markers | Dirección visual |
|------|-----------|-----------------|------------------|---------|-----------------|
| `"effect"` | 1 | Objeto (rect completo) | Proceso | ↔ `markerStart` + `markerEnd` | Bidireccional |
| `"input-specified"` | 1 | s₁ (state pill) | Proceso | → `markerEnd` solo | pill s₁ → proceso |
| `"output-specified"` | 1 | s₂ (state pill) | Proceso | → `markerEnd` solo | proceso → pill s₂ |
| `"input-output"` | 2 | s₁ pill + s₂ pill | Proceso | → + → | pill s₁ → proceso → pill s₂ |

#### Dirección visual vs data model: resolución de endpoints

El canvas usa `visualSource` y `visualTarget` para determinar desde dónde hacia dónde dibuja la línea SVG. El `markerEnd` apunta al `visualTarget`. Para que la flecha ISO apunte en la dirección correcta, cada modo necesita asignar los visual endpoints así:

| Modo | `visualSource` | `visualTarget` | Resultado de `markerEnd` |
|------|----------------|----------------|--------------------------|
| `"effect"` | process (original) | object (original) | ↔ (markerStart + markerEnd, irrelevante) |
| `"input-specified"` | **objectId** (swap) | **processId** (swap) | → apunta al proceso ✓ |
| `"output-specified"` | processId (original) | objectId (original) | → apunta al pill s₂ ✓ |
| `"input-output"` input half | **objectId** (swap) | **processId** (swap) | → apunta al proceso ✓ |
| `"input-output"` output half | processId (original) | objectId (original) | → apunta al pill s₂ ✓ |

**Clave**: Para `input-specified` y para el input half de `input-output`, los visual endpoints se **intercambian** respecto al data model para que `markerEnd` (que siempre apunta al visualTarget) señale al proceso.

#### Pipeline de visual entries

El pipeline `visibleLinks` en OpdCanvas ya tiene precedente con DA-7 `findConsumptionResultPairs` que genera entries sintéticas para merged consumption+result pairs. Se añade un paso análogo que maneja **todos** los modos del effect link:

```
visibleLinks pipeline:
  1. resolveLinksForOpd(model, opdId)           // existente
  2. findConsumptionResultPairs(...)             // existente (DA-7)
  3. adjustEffectEndpoints(entries, model)       // NUEVO — ajusta endpoints de todos los effect modes
  4. Filtrar resultIds de DA-7                   // existente
  5. Render entries                              // existente
```

##### Función `adjustEffectEndpoints`

Vive en `OpdCanvas.tsx` como función local (opera sobre entries visuales del canvas, no sobre el modelo puro — a diferencia de `findConsumptionResultPairs` que opera sobre ResolvedLinks en core).

Maneja los 4 modos del effect link en una sola función:

```typescript
// OpdCanvas.tsx — inline helper
interface VisualLinkEntry {
  link: Link;
  modifier: Modifier | undefined;
  visualSource: string;
  visualTarget: string;
  labelOverride: string | undefined;
  isMergedPair: boolean;
  isInputHalf?: boolean;   // input half of input-output split
  isOutputHalf?: boolean;  // output half of input-output split OR output-specified
}

function adjustEffectEndpoints(
  entries: VisualLinkEntry[],
  model: Model,
): VisualLinkEntry[] {
  return entries.flatMap(entry => {
    const mode = transformingMode(entry.link);
    if (!mode || mode === "effect") return [entry]; // non-effect or basic effect: passthrough

    // Resolve object/process endpoints (invariant I-33 guarantees object↔process pairing)
    const srcThing = model.things.get(entry.visualSource);
    const objectId = srcThing?.kind === "object" ? entry.visualSource : entry.visualTarget;
    const processId = srcThing?.kind === "process" ? entry.visualSource : entry.visualTarget;

    switch (mode) {
      case "input-specified":
        // Swap visual endpoints: pill s₁ is source, process is target → markerEnd at process ✓
        return [{
          ...entry,
          visualSource: objectId,
          visualTarget: processId,
          isInputHalf: true,
        }];

      case "output-specified":
        // Keep visual endpoints: process is source, pill s₂ is target → markerEnd at pill ✓
        return [{
          ...entry,
          visualSource: processId,
          visualTarget: objectId,
          isOutputHalf: true,
        }];

      case "input-output":
        // Split into two directed entries
        return [
          {
            ...entry,
            link: { ...entry.link, target_state: undefined },
            visualSource: objectId,     // SWAP — pill s₁ side is source
            visualTarget: processId,    // SWAP — process is target (markerEnd points here)
            isInputHalf: true,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            visualSource: processId,    // process is source
            visualTarget: objectId,     // pill s₂ side is target (markerEnd points here)
            isOutputHalf: true,
          },
        ];

      default:
        return [entry];
    }
  });
}
```

**Nota sobre DA-7 orthogonalidad**: DA-7 merged pairs tienen `link.type = "consumption"` (no `"effect"`), por lo que `transformingMode` retorna `null` y pasan intactos por `adjustEffectEndpoints`. Las flags `isMergedPair` e `isInputHalf`/`isOutputHalf` son mutuamente excluyentes en la práctica.

##### Routing por entry

Después de `adjustEffectEndpoints`, cada entry pasa por el routing existente. Las flags `isInputHalf` y `isOutputHalf` guían el routing a state pills:

- **`isInputHalf`**: `link.source_state` está presente, `visualSource = objectId`. El routing identifica el object endpoint como `visualSource` y rutea `srcRect` al pill de `source_state`. El `tgtRect` permanece como el proceso. `markerEnd` → proceso. ✓

- **`isOutputHalf`**: Dos escenarios distintos que comparten la misma lógica de routing:
  - (a) Output half de un split `input-output`: `link.target_state` está presente, `link.source_state` fue cleared.
  - (b) Standalone `output-specified`: `link.target_state` está presente, `link.source_state` nunca existió.
  En ambos casos: `visualSource = processId`, `visualTarget = objectId`. Se necesita **nueva lógica de routing** en la rama effect: identificar que el object endpoint es `visualTarget` y rutear `tgtRect` al pill de `target_state`. `markerEnd` → pill s₂. ✓

La condición de routing para target_state en el branch effect es:

```typescript
// Nuevo bloque en el branch effect/isMergedPair del routing
if (entry.isOutputHalf && link.target_state) {
  // Route object endpoint (visualTarget) to target_state pill
  const pill = statePillRect(objApp, visObjStates, link.target_state);
  if (pill) { tgtRect = pill; tgtKindOverride = "object"; }
}
```

**Nota**: `isOutputHalf` es la única flag que se consulta para routing. No se usa `transformingMode` en el routing porque la función `adjustEffectEndpoints` ya resolvió la semántica y las flags capturan el resultado.

#### Markers por modo

```typescript
case "effect": {
  const mode = transformingMode(link);
  if (mode === "effect") {
    markerEnd = "url(#arrow-proc)";       // ↔ bidirectional
    markerStart = "url(#arrow-proc)";
  } else {
    // input-specified, output-specified, input-output halves: → unidirectional
    markerEnd = "url(#arrow-proc)";
    // markerStart omitted — no arrow at the line origin
  }
  break;
}
```

### 3.3. OPL

Sin cambio funcional. El módulo `opl.ts` ya implementa correctamente las 4 variantes en el branch `case "effect"` del render function. Opcionalmente se puede refactorizar para usar `transformingMode()` en lugar del `if/else` ad-hoc, pero no es requisito.

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
| `packages/core/tests/helpers.test.ts` | 7 tests para `transformingMode` | ~40 |
| `packages/web/src/components/OpdCanvas.tsx` | `adjustEffectEndpoints`, refactor markers por modo, routing output-specified | ~80 |

## 5. NO se modifica

- `types.ts` — zero schema change
- `api.ts` — I-16, findConsumptionResultPairs intactos
- `opl.ts` — ya correcto
- `simulation.ts` — ya correcto
- `.opmodel` fixtures — ya correctos (driver-rescuing tiene 2 input-output pairs, coffee-making tiene 1 input-output pair en boiling-effect-water)

## 6. Verificación

### Tests automáticos

7 tests unitarios para `transformingMode` en `helpers.test.ts`:

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | effect puro | `{type: "effect"}` sin estados | `"effect"` |
| 2 | input-specified | `{type: "effect", source_state: "s1"}` | `"input-specified"` |
| 3 | output-specified | `{type: "effect", target_state: "s2"}` | `"output-specified"` |
| 4 | input-output | `{type: "effect", source_state: "s1", target_state: "s2"}` | `"input-output"` |
| 5 | non-effect → null | `{type: "consumption"}` | `null` |
| 6 | non-effect con estados → null | `{type: "consumption", source_state: "s1"}` | `null` |
| 7 | empty string state → falsy | `{type: "effect", source_state: ""}` | `"effect"` |

**Nota sobre test 7**: Los state IDs válidos siguen el patrón `state-*` (invariantes I-06/I-28 lo garantizan en modelos válidos). El test con empty string es defensivo — verifica que `!!""` se trata como ausencia de estado.

Suite completo: `bunx vitest run` — 570+ tests, 0 regresiones.

### Labels en halves

Después del split, cada half renderiza el `link.type` como label (comportamiento existente del canvas). Ambos halves muestran **"effect"** como label. Esto es correcto — el tipo semántico es effect en ambos casos. No se agrega label customizado (como "input"/"output") porque ISO no lo requiere y la dirección de la flecha ya comunica la semántica.

### Verificación visual (manual, browser)

Con fixture `driver-rescuing.opmodel`:

1. **En OPD SD1** (in-zoom): `lnk-callhandling-effect-danger` (endangered→safe) — dos segmentos →: pill "endangered" → Call Handling, Call Handling → pill "safe"
2. **En OPD SD1** (in-zoom): `lnk-calltrans-effect-call` (requested→online) — dos segmentos →: pill "requested" → Call Transmitting, Call Transmitting → pill "online"
3. **En OPD SD**: `lnk-rescuing-effect-driver` (sin estados) — ↔ bidireccional entre Driver y Driver Rescuing

Con fixture `coffee-making.opmodel`:

4. **En OPD SD1** (in-zoom): `lnk-boiling-effect-water` (cold→hot) — dos segmentos →: pill "cold" → Boiling, Boiling → pill "hot"

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
