# Web visual refactor plan

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-09 |
| Estado | Proposed |
| Base | ADR-004 — Effective Visual Slice |
| Objetivo | Refactor estructural profunda de la capa visual web sin rewrite total |

## Objetivo ejecutivo

Dejar de parchear bugs visuales sobre fronteras implícitas y mover la web visual a un pipeline explícito y testeable:

```text
projection-view
  -> EffectiveVisualSlice
  -> layout pipeline
  -> routing / overlays
  -> canvas renderer
  -> interaction patches
```

## Decisión de topología

No hacer rewrite total.

Hacer 3 fases secuenciales, cada una con salida visible y cierre verificable.

## No objetivos

- reescribir el renderer SVG completo
- reemplazar React
- rehacer core semántico
- abrir todavía persistencia nativa final sobre Atlas/LayoutModel completo
- mezclar esta refactor con minimap, zoom UX grande o features nuevas no estructurales

---

# Fase 1 — Canonizar EffectiveVisualSlice

## Intención

Crear una única frontera visual efectiva por OPD que consuman canvas, report y tooling.

## Resultado esperado

Existe un artefacto explícito equivalente a `EffectiveVisualSlice` que define, para un `opdId`:

- things visibles
- links visibles
- fans/forks visibles
- states visibles
- implicit things
- roles visuales (`isContainer`, `isRefined`, `hasSuppressedStates`, `internal`)
- inputs listos para layout y report sin recomputación semántica paralela

## Archivos primarios

- `packages/web/src/lib/projection-view.ts`
- `packages/web/src/lib/visual-report.ts`
- `packages/web/src/components/OpdCanvas.tsx`
- `packages/web/src/hooks/useModelStore.ts`
- tests nuevos o migrados en:
  - `packages/web/tests/projection-view.test.ts`
  - `packages/web/tests/visual-report.test.ts`
  - `packages/web/tests/visual-systemic-regressions.test.ts`

## Cambios concretos

1. Introducir tipo explícito `EffectiveVisualSlice`
2. Consolidar en ese tipo toda la vista efectiva por OPD
3. Hacer que `visual-report` lea de esa frontera, no de derivaciones paralelas
4. Hacer que `OpdCanvas` consuma esa frontera como fuente primaria
5. Reducir fallback semántico local en canvas donde ya exista data suficiente en slice

## Criterio de cierre

- canvas y visual-report usan la misma vista efectiva
- fixtures de auditoría ya no divergen por semántica total vs vista renderizada
- tests fijan contrato del slice
- no hay cambio funcional grande perceptible fuera de correcciones de consistencia

## Blast radius

**Medio**

Toca contratos entre projection, report y canvas, pero sin romper todavía layout interno por fases.

---

# Fase 2 — Partir layout pipeline

## Intención

Separar responsabilidades hoy comprimidas en `spatial-layout.ts` y especialmente en `finalizeLayout()`.

## Resultado esperado

El pipeline de layout queda dividido en pasos explícitos:

```text
mergeLayoutPatches
-> applyLayoutPatches
-> normalizeAutoSizing
-> relaxLayout(policy)
-> diffPatchedAppearances
```

## Archivos primarios

- `packages/web/src/lib/spatial-layout.ts`
- posible split en:
  - `packages/web/src/lib/layout/merge-layout-patches.ts`
  - `packages/web/src/lib/layout/apply-layout-patches.ts`
  - `packages/web/src/lib/layout/relax-layout.ts`
  - `packages/web/src/lib/layout/diff-layout.ts`
  - `packages/web/src/lib/layout/strategies/*`
- tests:
  - `packages/web/tests/spatial-layout.test.ts`
  - `packages/web/tests/fan-overlay.test.ts`
  - `packages/web/tests/visual-systemic-regressions.test.ts`

## Cambios concretos

1. Formalizar merge determinista de patches por `thing`
2. Preservar `internal` en todo el flujo
3. Separar auto-sizing de apply/diff
4. Hacer `relaxation` política por estrategia
5. Separar estrategias:
   - balanced / general
   - structural cluster
   - process in-zoom
   - object in-zoom
   - unfold
6. Mantener clustering estructural centrado en padre, no en `type::parent`

## Criterio de cierre

- `finalizeLayout()` deja de ser chokepoint semántico opaco
- tests cubren merge de patches, preservación de `internal`, relax por estrategia
- object in-zoom y structural-cluster tienen política explícita, no accidental
- stress regressions recientes quedan cubiertas en tests de pipeline, no solo de output final

## Blast radius

**Medio-alto**

Es la fase más delicada porque toca la zona exacta de bugs sistémicos recientes.

---

# Fase 3 — Adelgazar OpdCanvas

## Intención

Convertir `OpdCanvas` en consumidor/orquestador fino, no en lugar donde se rehace semántica o composición visual ad hoc.

## Resultado esperado

`OpdCanvas.tsx` pierde peso y se redistribuye en capas claras.

## Archivos primarios

- `packages/web/src/components/OpdCanvas.tsx`
- nuevos componentes probables:
  - `packages/web/src/components/canvas/OpdRenderer.tsx`
  - `packages/web/src/components/canvas/OpdInteractionLayer.tsx`
  - `packages/web/src/components/canvas/OpdOverlayLayer.tsx`
  - `packages/web/src/components/canvas/OpdSelectionLayer.tsx`
- apoyo en:
  - `packages/web/src/components/canvas/ThingNode.tsx`
  - `packages/web/src/components/canvas/LinkLine.tsx`
  - `packages/web/src/lib/edge-router.ts`
  - `packages/web/src/lib/fan-overlay.ts`

## Cambios concretos

1. Extraer render puro de SVG
2. Extraer interacción de drag/pan/selection/context menu
3. Extraer overlays y preparación específica de fans/forks/highlights
4. Dejar en canvas solo composición de capas + wiring de eventos
5. Eliminar recomputaciones locales que ya existan en EffectiveVisualSlice o layout pipeline

## Criterio de cierre

- `OpdCanvas.tsx` baja de forma significativa
- bugs nuevos de canvas son más localizables por capa
- tests de canvas pueden concentrarse en interacción/render, no en semántica indirecta
- la lectura del archivo deja de sentirse como “mini engine entero”

## Blast radius

**Medio**

Mucho movimiento de archivo, menos riesgo semántico si F1 y F2 quedaron bien.

---

# Orden recomendado dentro de las fases

## Primer slice práctico

1. introducir `EffectiveVisualSlice`
2. migrar `visual-report` a esa frontera
3. fijar tests de consistencia slice/report/canvas
4. partir `finalizeLayout` por pasos
5. fijar `relax` por estrategia
6. separar `OpdCanvas` en renderer vs interaction

---

# Riesgos principales

## R1. Refactor infinito

Mitigación:
- cada fase debe cerrar con tests y evidencia visible
- no mezclar features nuevas durante el reshape

## R2. Hacer layout = semántica

Mitigación:
- semántica visual fuerte vive en projection/slice
- layout solo posiciona, normaliza y relaja bajo política explícita

## R3. Canvas sigue reabsorbiendo lógica

Mitigación:
- cualquier dato que canvas “tenga que reconstruir” se evalúa como bug de frontera

## R4. Romper estabilidad visual mientras se mejora forma

Mitigación:
- usar fixtures visuales y auditoría screenshot-first como bench de arquitectura
- mantener stress regressions y canonicals vivos en cada fase

---

# Bench de validación

Usar como bench persistente:

- `packages/web/tests/visual-systemic-regressions.test.ts`
- `packages/web/tests/projection-view.test.ts`
- `packages/web/tests/spatial-layout.test.ts`
- `packages/web/tests/fan-overlay.test.ts`
- `packages/web/tests/visual-report.test.ts`
- fixtures y scripts de auditoría visual en `tests/` y `scripts/`

No confiar solo en score agregado.
Evaluar también:
- hotspots locales
- congestión cerca de contornos refinados
- competencia entre tráfico estructural y operativo

---

# Qué dejar explícitamente para después

Estas líneas existen, pero no deben contaminar la refactor estructural inicial:

- escala/navegación grande (minimap, etc.)
- persistencia avanzada de layout
- polishing de UX no estructural
- source mapping más fino OPL↔canvas fuera de lo necesario para consistencia de slice

---

# Definición de éxito global

La refactor se considera buena si al final:

1. hay una frontera visual canónica y única por OPD
2. layout deja de depender de pasos opacos y merges implícitos
3. canvas consume pipeline en vez de improvisarlo
4. las regresiones recientes quedan representadas como tests de frontera, no solo fixes puntuales
5. el sistema se vuelve más fácil de mover sin girar en círculos

## Resumen corto

No estamos rehaciendo OPModel.
Estamos terminando de separar la capa visual en piezas con contratos reales, para que deje de comportarse como una sola masa reactiva.