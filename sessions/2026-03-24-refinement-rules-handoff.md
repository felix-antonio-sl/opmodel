# Handoff: Sesion 15 — Refinement Visual Rules (9 Gaps + 5 Bugfixes)

**Fecha**: 2026-03-24
**Sesion**: 15
**Agente**: steipete (dev/steipete)

## Resumen ejecutivo

Auditoria completa de `docs/superpowers/specs/2026-03-24-refinement-visual-rules.md` (Rev.2, 85+ reglas, 20 secciones) contra el codigo actual. Identificados 9 gaps prioritarios (P0+P1). Todos implementados con TDD. Spec bumped a Rev.3 con tabla de 42 filas auditada. Luego ronda de testing manual con 5 bugfixes adicionales. 786 tests green (+19 total), 0 regresiones.

## Gaps resueltos

### P0 — OPL Core

| Gap | Archivos | Descripcion |
|-----|----------|-------------|
| **R-OC-2** | opl.ts, opl-types.ts | In-zoom sentence incluye objetos internos: "as well as Call and Vehicle Location" |
| **R-OC-7** | opl.ts | Subprocesos a misma Y agrupados como paralelos: "parallel P1 and P2" |
| **R-SF-5** | opl.ts, opl-types.ts | Semi-fold OPL usa "lists...as parts" en vez de "consists of" |
| **R-OPL-3** | opl.ts, opl-types.ts | OPD tree edge label: "SD is refined by in-zooming X in SD1" |

### P0 — Visual Web

| Gap | Archivos | Descripcion |
|-----|----------|-------------|
| **R-SS-8** | OpdCanvas.tsx | Indicador "..." en objects con estados suprimidos |
| **R-TC-8** | OpdCanvas.tsx | State pill markers: initial (borde grueso), final (doble borde), default (diagonal) |

### P1 — Core API + Web

| Gap | Archivos | Descripcion |
|-----|----------|-------------|
| **R-OC-1** | api.ts | refineThing auto-crea 3 subprocesos placeholder en process in-zoom |
| **R-NT-3** | api.ts | Invariante NON_LEAF_OPD: solo leaf OPDs eliminables |
| **R-NT-5** | App.tsx | Keyboard nav: Ctrl+Up (parent OPD), Ctrl+Down (child OPD) |

## Commits

### Cambios core (packages/core/)

**opl-types.ts**:
- `OplInZoomSequence.internalObjects` — lista de objetos internos para "as well as"
- `OplGroupedStructuralSentence.semiFolded` — flag para "lists...as parts"
- `OplDocument.refinementEdge` — metadata de edge label cross-OPD

**opl.ts**:
- Collector: agrupa subprocesos por Y para parallelismo, recolecta objetos internos
- Collector: detecta `semi_folded` en appearance y propaga a grouped-structural sentence
- Rendering: "as well as [objects]", "parallel P1 and P2", "lists...as parts", edge labels
- `expose()`: construye `refinementEdge` desde OPD metadata
- `render()`: prepend edge label al output

**api.ts**:
- `refineThing()`: auto-crea 3 subprocesos placeholder (process in-zoom only)
- `removeOPD()`: invariante NON_LEAF_OPD (reject if has children)

### Cambios web (packages/web/)

**OpdCanvas.tsx**:
- `ThingNode`: prop `hasSuppressedStates` + indicador "..." text
- State pills: `strokeWidth` 2.5 para initial, double rect para final, diagonal line para default

**App.tsx**:
- Ctrl+Up/Down keyboard handler para navegacion OPD tree

### Cambios tests

- opl.test.ts: +14 tests (R-OC-2: 3, R-OC-7: 3, R-SF-5: 3, R-OPL-3: 3, imports: updateAppearance)
- api-refinement.test.ts: +5 tests (R-OC-1), 2 tests actualizados (count + validate)
- api-opds.test.ts: +1 test (R-NT-3), 1 test reescrito (cascade → leaf-only)
- api-distribution.test.ts: 1 test actualizado (cleanup placeholders)

### Cambios docs

- `2026-03-24-refinement-visual-rules.md`: Rev.2 → Rev.3, tabla 42 filas, 9 gaps cerrados, §21 priorizacion
- `CLAUDE.md`: test count 767 → 785

## Archivos clave

| Archivo | Funcion |
|---------|---------|
| `packages/core/src/opl.ts` | OPL expose + render (R-OC-2, R-OC-7, R-SF-5, R-OPL-3) |
| `packages/core/src/opl-types.ts` | OPL AST types (internalObjects, semiFolded, refinementEdge) |
| `packages/core/src/api.ts` | refineThing auto-placeholders (R-OC-1), removeOPD leaf-only (R-NT-3) |
| `packages/web/src/components/OpdCanvas.tsx` | State pill markers (R-TC-8), suppression indicator (R-SS-8) |
| `packages/web/src/App.tsx` | Keyboard nav Ctrl+Up/Down (R-NT-5) |
| `docs/superpowers/specs/2026-03-24-refinement-visual-rules.md` | Spec Rev.3 auditada |

## Bugfixes post-testing manual (5 commits adicionales)

| Commit | Fix |
|--------|-----|
| `54644f8` | I-17: eximir subprocesos internos de in-zoom de validacion "no transformation link" |
| `95da52c` | R-OC-1 layout: container 300x350 para 3 placeholders. I-17: skip procesos con 0 links (WIP). Default marker mas visible |
| `aae2fab` | Skip effect split (input/output) en links distribuidos (aggregated). 1 link ya no genera 6 flechas |
| `f0d4a26` | Limpiar selectedThing al navegar entre OPDs (evita panel con datos de thing invisible) |
| `a26e45b` | **Inside objects (R-IE-8) excluidos de fiber implicit en parent OPD**. Things con `internal=true` en child OPD no aparecen como ghost en padre |

### Bug critico resuelto: Ghost de inside objects

Inside objects creados dentro de un in-zoom (ej: o1 creado en SD1) aparecian como fantasmas (implicit, dashed, opacity 0.4) en el OPD padre (SD). Root cause: `resolveOpdFiber` los detectaba como implicit porque tenian links al container (p1), que es explicit en SD. Fix: agregar exclusion set `internalToChildOpd` en la fiber para things con `internal=true` en child OPDs.

## Estado del proyecto

- **786 tests** (50 test files), todos green
- **0 regresiones**
- **9 DAs** (DA-1 a DA-9, todas implemented o defined)
- **Spec Rev.3**: 85+ reglas, 42 filas en tabla de implementacion

### Metricas

| Metrica | Inicio sesion | Fin sesion |
|---------|---------------|------------|
| Tests | 767 | 786 (+19) |
| Gaps resueltos (spec) | 0/9 P0+P1 | 9/9 P0+P1 |
| Bugfixes post-testing | 0 | 5 |
| Commits totales | 0 | 6 |

## Pendientes para sesion 16

### P2 — Blast radius alto (futuro)

| Gap | Archivos | Descripcion |
|-----|----------|-------------|
| R-IH | core nuevo | Herencia estructural completa (links heredados por specializations) |
| R-ES | api.ts, simulation.ts | Effect split automatico (input-output underspecification) |
| R-OZ-1..3,5 | simulation.ts | Matriz completa de precedencia out-zoom |
| R-SF-6,9 | OpdCanvas.tsx, simulation.ts | Links apuntando a parts dentro de semi-fold |
| R-VI-2 | OpdCanvas.tsx | Duplicate visual indicator (offset shape) |
| R-NT-4 | OpdTree.tsx, types.ts | View OPDs (colecciones ad-hoc) |
| R-NT-2 | OpdTree.tsx | Object tree paralelo al process tree |
| R-BC-3 | api.ts | Distinguir environmental exception en boundary crossing |
| R-BC-4 | simulation.ts | Condition skip auto-invocacion del siguiente subproceso |
| R-IE-10 | OpdCanvas.tsx | Enveloping reversion on move |

## Invariantes categoricas preservadas

- **Fibracion**: `pi: C_OPM_total -> I_OPD` se mantiene. Appearances codifican pi.
- **Retraccion**: `fold o inzoom = id` preservada.
- **Colimite**: El Model sigue siendo int M. Las vistas son proyecciones.
- **Lens OPL**: `expose()` opera sobre el model directamente.
- **Yoneda (DA-10)**: Links son morfismos reificados. Cascade deletion preserva dependencia.
