# Handoff: Fork Triangles (C-05) + Refinement Audit + UI

**Fecha**: 2026-03-23
**Sesión**: 12
**Agente**: steipete (dev/steipete)

## Qué se hizo

Dos ejes de trabajo: (1) fork triangles ISO §6 para structural links, (2) auditoria profunda del sistema de refinamiento que revelo un bug sistematico de direccion de links estructurales.

### Eje 1 — Fork Triangles (C-05)

| Commit | Cambio |
|--------|--------|
| `6e828ea` | Fork triangles: shared triangle + trunk + branches para 2+ structural links del mismo tipo compartiendo parent. Direction-agnostic detection. Canvas normaliza exhibition. OPL grouping direction-agnostic. |
| `1e2ff0b` | Todos los structural links renderizan con fork triangle (incluyendo singles con geometria compacta). Semi-fold y PropertiesPanel toggle direction-agnostic. |

### Eje 2 — Auditoria de Refinamiento

Auditoria dialectica entre 3 agentes (steipete, opm-specialist, arquitecto-categorico) revelo que el bug de direccion de links estructurales era **sistemico** — afectaba 10 sitios distintos del codebase.

| Commit | Cambio |
|--------|--------|
| `e15c070` | Fix unfold selector (convention detection heuristic). Fix partToWhole (bidirectional). Thick contour ISO §14.2 para things refinados. Double-click navigation a OPD hijo. Badge ⊕ de refinamiento. |
| `4454a77` | Layout mejorado para external things en child OPDs (y=250, debajo del container). Badge ↑ oculto en unfold OPDs. |
| `99a7f67` | RESOLVE-01 fix: structural links al container ahora visibles en child OPDs (antes se filtraban). Badge ↑ oculto en TODOS los refinement OPDs. |
| `198ecab` | OPL expose() tenia su PROPIA copia del RESOLVE-01 bug. Fix. exhibitorOf direction-agnostic (link count heuristic). |

## Bug sistematico: direccion de structural links

### Root cause

El codebase tiene DOS convenciones para structural links:
- **Vieja (P-01)**: source=part, target=whole (aggregation)
- **Canvas UI**: source=whole(primer click), target=part(segundo click)

Cada componente asumia una convencion distinta. Los tests usaban la vieja y pasaban, enmascarando bugs.

### Los 10 sitios parchados

| # | Archivo | Funcion | Estrategia de fix |
|---|---------|---------|-------------------|
| 1 | api.ts | findStructuralForks | Bidireccional, grupo mas grande |
| 2 | opl.ts | expose() grouping | Bidireccional, grupo mas grande |
| 3 | api.ts | getSemiFoldedParts | Busca ambas direcciones |
| 4 | PropertiesPanel.tsx | Semi-fold toggle | Busca ambas direcciones |
| 5 | OpdCanvas.tsx | Canvas link creation | Normaliza exhibition (swap) |
| 6 | api.ts | refineThing unfold selector | Convention detection heuristic (majority count) |
| 7 | simulation.ts | partToWhole map | Bidirectional indexing |
| 8 | simulation.ts | resolveLinksForOpd RESOLVE-01 | Excluye structural del filtro |
| 9 | opl.ts | expose() RESOLVE-01 | Excluye structural del filtro |
| 10 | opl.ts | exhibitorOf | Link count heuristic |

### Deuda tecnica critica

Cada fix usa una estrategia DIFERENTE. Esto no escala. Se necesita un **utility centralizado**:

```typescript
// packages/core/src/structural.ts
function getStructuralChildren(model, thingId): Array<{ childId, link, linkType }>
function getStructuralParent(model, thingId, linkType): { parentId, link } | null
function isStructuralParent(model, link, thingId): boolean
```

Un solo punto que resuelve la direccion. TODOS los consumidores lo usan. Cero heuristicas duplicadas. **Marcado como blocker para cualquier feature futuro que toque structural links.**

## Estado del proyecto

- **711 tests** (46 test files), todos green
- **0 regresiones**
- **6 commits** en esta sesion
- **Docker**: `opmodel-dev` container corriendo

### Metricas

| Metrica | Antes | Despues |
|---------|-------|---------|
| Tests | 698 | 711 (+13) |
| Test files | 42 | 43 (+1) |

## Features nuevos

| Feature | ISO | Descripcion |
|---------|-----|-------------|
| Fork triangles | §6 | Shared triangle (trunk + branches) para structural links con shared parent |
| Single structural triangles | §6 | Todos los structural links usan fork geometry |
| Thick contour | §14.2 | Things refinados muestran borde grueso (2.5px) |
| Double-click navigation | UX | Double-click en thing refinado → navega al OPD hijo |
| Refinement badge | UX | Icono ⊕ en esquina inferior-derecha de things refinados |
| Structural links en OPDs hijos | §14 | Exhibition/aggregation links visibles en refinement OPDs |

## Pendientes para proxima sesion

### Prioridad critica
- **Utility centralizado para structural links** — refactor los 10 sitios a un solo `getStructuralChildren`/`getStructuralParent`. Blocker antes de agregar features que toquen structural links.

### Prioridad alta
- **Search/Find**: navegacion en modelos grandes
- **Command palette (Ctrl+K)**: acceso rapido a acciones
- **Minimap**: orientacion en canvas grande

### Prioridad media
- **Unfold-in-place (L-M1-08)**: mostrar partes inline sin crear OPD hijo
- **Link distribution to contour**: mover links del parent a subprocesos (ISO §10.5.2)
- **Subprocess temporal ordering**: posicion vertical = orden de ejecucion

### Prioridad baja
- **Web tests**: 0 tests en packages/web (deuda reconocida)
- **Wizard nuevo modelo**: OPCloud tiene wizard de 12 pasos

## Artifacts de referencia

- Plan: `/home/felix/.claude/plans/zany-snacking-stallman.md`
- ISO reference: `/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-iso-19450.md`
- Refinement design spec: `/home/felix/projects/opmodel/docs/superpowers/specs/2026-03-11-refinement-inzoom-unfold-design.md`
- Backlog: `/home/felix/projects/opmodel/docs/superpowers/specs/2026-03-10-opm-modeling-app-backlog-lean.md`
- Memory: `feedback_structural_direction.md` — CRITICAL blocker recorded
