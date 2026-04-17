# 09 — Web projection migration status

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Estado | In progress |
| Ámbito | `packages/web` |

## Objetivo

Mover el consumo visual del frontend desde lecturas directas de `model.appearances` hacia la nueva cadena:

```text
Model legacy -> SemanticKernel -> OpdAtlas -> LayoutModel -> projection view -> UI
```

sin romper canvas, layout, auditoría ni persistencia actual.

## Decisión de migración

La migración en web se hace por **adapter slices**, no por rewrite completo.

### Regla

Mientras la persistencia siga ocurriendo sobre `Appearance` legacy:
- la lectura puede pasar por proyección
- los patches deben seguir siendo `patchable-only`
- no se deben emitir cambios sobre ocurrencias proyectadas sin backing legacy

## Componentes ya migrados

### 1. Core bridge

En `packages/core/src/semantic-kernel.ts` ya existen:
- `projectLegacyModel(model)`
- `layoutModelFromLegacyModel(model, atlas?)`
- `exposeSemanticKernel(...)`
- `renderAllFromSemanticKernel(...)`

Esto da un pipeline transicional utilizable sin romper el sistema actual.

### 2. Web projection adapter

Archivo:
- `packages/web/src/lib/projection-view.ts`

Superficies:
- `buildOpdProjectionView(...)`
- `buildOpdProjectionViewFromProjection(...)`
- `buildPatchableOpdProjectionSlice(...)`
- `buildPatchableOpdProjectionSliceFromProjection(...)`

Responsabilidad:
- convertir un OPD legacy a slice proyectado
- entregar `appearances`, `links`, `fans` y `patchableThingIds`
- ocultar diferencias entre `Appearance` legacy y ocurrencias proyectadas

### 3. Canvas

Archivo:
- `packages/web/src/components/OpdCanvas.tsx`

Migrado a proyección en:
- appearances por `thingId`
- detección de things multi-OPD
- drag del contenedor basado en el slice proyectado

### 4. Layout

Archivo:
- `packages/web/src/lib/spatial-layout.ts`

`suggestLayoutForOpd()` ya no reconstruye su working set directo desde `model.appearances`.
Ahora consume el slice de proyección.

### 5. Auditoría / reporting visual

Archivos:
- `packages/web/src/lib/visual-report.ts`
- `packages/web/src/App.tsx`

Migrado a proyección en:
- visual findings por OPD
- score previo de `autoLayoutAll`
- reportes visuales por OPD

### 6. Store

Archivo:
- `packages/web/src/hooks/useModelStore.ts`

El store ahora expone:
- `projection`
- `currentProjectionSlice`

Esto consolida la capa nueva y evita recomputar la proyección dispersa por componente.

### 7. Visual graph adapter más rico

Archivos principales:
- `packages/web/src/lib/projection-view.ts`
- `packages/web/src/components/OpdCanvas.tsx`
- `packages/web/src/components/canvas/ThingNode.tsx`
- `packages/web/src/App.tsx`
- `packages/web/src/hooks/useModelStore.ts`

En este tramo, la projection slice pasó de ser solo geometría + slices crudas a cargar más view-model visual listo para render.

Ahora `visualGraph` entrega, como fuente primaria del canvas:
- `thingsById`
- `links`
- `implicitThingIds`
- `visibleStates` por thing
- flags de render por thing:
  - `hasSuppressedStates`
  - `isContainer`
  - `isRefined`

Y `OpdCanvas` / `ThingNode` ya prefieren eso para:
- things visibles
- ghosts / implicit things
- links visibles
- estados visibles por thing
- metadata básica de render del nodo

### 8. Qué quedó projection-native vs legacy-bound

Projection-native ahora:
- appearances visibles
- visible things
- visible links
- visible fans
- implicit things
- suppressed states por thing
- visible states por thing
- parte del thing view-model (`isContainer`, `isRefined`, `hasSuppressedStates`)
- state-pill anchoring / placement consumido desde `visualGraph`

Todavía local / legacy-bound:
- rect expansion
- edge routing
- fan/fork geometry
- simulation styling
- resize / drag interactions
- fallback completo basado en `fiber` cuando falta `visualGraph`

## Validaciones ya corridas

### Core
- `bun run typecheck:core`
- tests relevantes de `packages/core`

### Web
- `packages/web/tests/projection-view.test.ts`
- `packages/web/tests/spatial-layout.test.ts`
- `packages/web/tests/visual-report.test.ts`
- `@opmodel/web build`

## Restricción estructural descubierta

La frontera crítica hoy es esta:

### Se puede
- leer desde `projection`
- calcular layout desde `projection`
- auditar desde `projection`
- pintar canvas desde `projection`

### No se debe hacer todavía
- persistir patches arbitrarios sobre `ViewOccurrence` sin `Appearance` legacy real

Hasta abrir persistencia nativa sobre `OpdAtlas + LayoutModel`, la capa nueva debe seguir siendo `patchable-only`.

## Próximo paso recomendado

### Opción A — recomendada
Adelgazar más el fallback basado en `fiber` dentro de `OpdCanvas`, especialmente en state/link targeting que todavía recalcula demasiado cuando falta `visualGraph` suficiente.

### Opción B
Seguir subiendo preparación visual fina del canvas al adapter de proyección, más allá del anchoring de state pills.

### Opción C
Recién después abrir persistencia nativa de layout sobre:
- `ViewOccurrence`
- `LayoutNode`

Eso tiene más blast radius y conviene hacerlo después de A y B.

## Criterio de salida de esta fase

Esta fase se considera completa cuando:

1. canvas, layout y reporting lean del projection layer
2. el store centralice la proyección actual
3. ningún consumidor visual nuevo dependa de `model.appearances` como superficie primaria
4. la persistencia legacy siga funcionando sin regresiones
5. el canvas consuma un `visualGraph` suficientemente rico como para reducir cálculo visual local a routing / interacción / presentación fina

## Resumen corto

La web ya no está pegada totalmente a `Appearance` legacy.
Existe una capa transicional real y usable que conecta el modelo actual con la arquitectura OPL-first sin romper producto.

En particular, `OpdCanvas` ya no solo consume geometría proyectada. También empezó a consumir estructura visual preparada desde `projection-view`, acercando la tubería real a:

```text
OPL -> kernel -> atlas -> layout -> visualGraph -> canvas
```
