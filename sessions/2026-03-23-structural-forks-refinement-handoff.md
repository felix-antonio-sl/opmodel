# Handoff: Sesion 12 — Structural Links, Refinement, Invariante source=parent

**Fecha**: 2026-03-23
**Sesion**: 12
**Agente**: steipete (dev/steipete)

## Resumen ejecutivo

Sesion enfocada en 3 ejes: (1) fork triangles ISO §6, (2) auditoria profunda del sistema de refinamiento, (3) invariante estructural `source=parent`. Se descubrio y resolvio un bug sistematico de direccion de links estructurales que afectaba 10+ sitios del codebase. Se establecio un invariante y utility centralizado como solucion arquitectural.

## Commits (14 en esta sesion)

| Commit | Tipo | Descripcion |
|--------|------|-------------|
| `6e828ea` | feat | C-05 fork triangles: shared triangle + trunk + branches |
| `1e2ff0b` | fix | Todos los structural links con fork geometry + semi-fold bidireccional |
| `e15c070` | fix | Unfold direction-agnostic + thick contour + double-click nav + badge ⊕ |
| `4454a77` | fix | Layout mejorado en child OPDs + ocultar badge ↑ en unfold |
| `99a7f67` | fix | RESOLVE-01: structural links visibles en child OPDs |
| `198ecab` | fix | OPL: structural links en child OPDs + exhibitorOf direction fix |
| `a2d583e` | docs | Handoff intermedio |
| `5038bef` | refactor | Utility centralizado `structural.ts` (structuralParentEnd, getStructuralChildren) |
| `83fd0f9` | refactor | **Invariante source=parent** para TODOS los structural links. 13 archivos migrados. |
| `043906f` | fix | Triangulos ISO §6 canonicos: exhibition=nested, classification=circle |
| `d436050` | fix | OPL exhibition cross-kind: "exhibits , as well as" → "exhibits p4." |
| `13c51e5` | fix | Triangulos mas grandes y mas cerca del parent |
| `5970cb9` | fix | Exhibition inner triangle concentrico (mismo centroide, escala 0.55) |

## Invariante establecido

```
PARA TODO structural link:
  source = parent (primer click)     target = child (segundo click)
  ─────────────────────────────────────────────────────────────────
  Aggregation:    source = whole       target = part
  Exhibition:     source = exhibitor   target = feature
  Generalization: source = general     target = specialization
  Classification: source = class      target = instance
```

**Enforcement:**
- Canvas: `source = linkSource` (primer click), `target = thingId` (segundo click). Sin swap.
- `structuralParentEnd()` en `structural.ts`: default `"source"`. Hub detection para legacy.
- I-19: coerce `target` (feature) a informatical
- I-31: discriminating checks `source` (exhibitor)
- I-32: discriminatorId = target, generalId = source
- Todos los tests migrados (13 archivos)

## Utility centralizado

**Archivo**: `packages/core/src/structural.ts`

```typescript
STRUCTURAL_TYPES                                    // Set<string>
structuralParentEnd(links, linkType) → "source"|"target"  // Hub detection
getStructuralChildren(model, thingId, filterTypes?) → [{childId, link}]
getStructuralParent(model, thingId, linkType) → {parentId, link} | null
```

**Consumidores refactorizados** (7 call sites en 3 archivos):
- `api.ts`: getSemiFoldedParts, refineThing unfold, findStructuralForks
- `opl.ts`: exhibitorOf, structural grouping
- `simulation.ts`: partToWhole (bidireccional, complementario)

## Features implementados

| Feature | ISO | Descripcion |
|---------|-----|-------------|
| Fork triangles | §6 | Shared triangle (trunk + branches) para structural links con shared parent |
| Todos los structural con fork geometry | §6 | Singles usan geometria compacta |
| Triangulos ISO canonicos | §6 | Aggregation=filled, Exhibition=nested, Generalization=open, Classification=circle |
| Thick contour | §14.2 | Things refinados muestran borde grueso (2.5px) |
| Double-click navigation | UX | Double-click en thing refinado → navega al OPD hijo |
| Refinement badge ⊕ | UX | Icono en esquina inferior-derecha |
| Structural links en child OPDs | §14 | RESOLVE-01 fix: exhibition/aggregation visibles en refinement OPDs |
| OPL en child OPDs | §14 | Structural sentences ahora se generan en OPDs hijos |

## Bugs corregidos

| Bug | Impacto | Root cause |
|-----|---------|------------|
| 10 sitios con logica de direccion distinta | Sistemico | No habia convencion unica. Resuelto con invariante + utility. |
| RESOLVE-01 filtraba structural links al container | Child OPDs vacios | Filtro no distinguia procedural vs structural |
| OPL expose() tenia su propio RESOLVE-01 | OPL sin structural sentences en child OPDs | Codigo duplicado |
| exhibitorOf asumia source=feature | "cosa10 of cosa13" (invertido) | Convencion hardcodeada |
| Exhibition OPL "exhibits , as well as p4." | Coma fantasma | Split attrs/ops no manejaba first list vacia |
| I-19 coercia source en vez de target | Validacion fallaba con invariante | Checks de core asumian vieja convencion |

## Estado del proyecto

- **711 tests** (43 test files), todos green
- **0 regresiones**
- **14 commits** en esta sesion
- **Docker**: `opmodel-dev` corriendo

### Metricas

| Metrica | Inicio sesion | Fin sesion |
|---------|---------------|------------|
| Tests | 698 | 711 (+13) |
| Test files | 42 | 43 (+1) |
| Core src files | — | +1 (structural.ts) |

## Pendientes para proxima sesion

### Prioridad alta — UX
- **Search/Find**: navegacion en modelos grandes
- **Command palette (Ctrl+K)**: acceso rapido a acciones
- **Minimap**: orientacion en canvas grande

### Prioridad media — Refinement avanzado
- **Unfold-in-place (L-M1-08)**: mostrar partes inline sin crear OPD hijo
- **Link distribution to contour**: mover links del parent a subprocesos (ISO §10.5.2)
- **Subprocess temporal ordering**: posicion vertical = orden de ejecucion
- **Containment auto-sizing**: contorno que se agranda para contener subprocesos

### Prioridad baja
- **Web tests**: 0 tests en packages/web (deuda reconocida)
- **Wizard nuevo modelo**: OPCloud tiene wizard de 12 pasos

## Artifacts de referencia

- Utility centralizado: `packages/core/src/structural.ts`
- Refinement design spec: `docs/superpowers/specs/2026-03-11-refinement-inzoom-unfold-design.md`
- Plan de sesion: `/home/felix/.claude/plans/zany-snacking-stallman.md`
- Backlog: `docs/superpowers/specs/2026-03-10-opm-modeling-app-backlog-lean.md`
- Memory: `feedback_structural_direction.md` (critical blocker — resolved this session)
