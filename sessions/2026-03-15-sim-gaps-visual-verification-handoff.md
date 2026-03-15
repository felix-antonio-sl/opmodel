# Handoff: SIM-GAP Closure + Visual Verification

**Fecha:** 2026-03-15
**Sesión:** sim-gaps-visual-verification (session 3)
**514 tests passing, 48 commits on origin/master**

---

## Resumen de lo implementado

### 1. SIM-GAP-03: Effect Link Encoding Convention (CLOSED)

**Bug**: `evaluatePrecondition` usaba `source_state || target_state` genéricamente para todos los transforming links. Para effect links, `target_state` es el TO state (postcondición), no una precondición. Un effect link con solo `target_state` era imposible de ejecutar.

**Fix**: En `evaluatePrecondition`, para effect links se usa solo `source_state` como precondición:
```typescript
const stateRef = link.type === "effect" ? link.source_state : (link.source_state || link.target_state);
```

**Tests**: 3 nuevos (precondición con solo target_state, con source_state, simulación completa)

### 2. SIM-GAP-02: I-EVENT-INZOOM-BOUNDARY (CLOSED)

**Gap**: ISO §14.2.2.4.2 — event links no deben cruzar contorno de proceso in-zoomed desde afuera hacia subprocesos.

**Fix**: Nuevo invariante en `validate()`. Solo PROCESOS dentro del in-zoom cuentan como subprocesos; objetos son recursos compartidos (fix adicional tras falso positivo en integration test).

**Tests**: 3 nuevos (cross-boundary rechazado, within-boundary aceptado, non-event modifier aceptado)

### 3. SIM-GAP-01: Parallel Subprocesses con Barrier Sync (CLOSED)

**Gap**: ISO §14.2.2.2 — subprocesos a la misma Y ejecutan en paralelo con barrier sync.

**Fix**: Wave-based execution en `runSimulation`:
- Procesos agrupados por Y-coordinate en "waves"
- Snapshot del estado tomado al inicio de cada wave
- Precondiciones evaluadas contra el snapshot (parallel pre-image)
- `processInvocations` retorna boolean; si triggerea invocación, invalida el wave snapshot
- Procesos que fallan con "lost"/"skip" en snapshot se marcan completados (clearing barrier)

**Tests**: 3 nuevos (same-Y execution, barrier sync, snapshot semantics)

### 4. Verificación Visual ISO Markers (CONFIRMED)

Verificación en browser via Chrome extension + DOM inspection del modelo Coffee Making en SD1:

| Link Type | Count | markerEnd | markerStart | ISO |
|-----------|-------|-----------|-------------|-----|
| agent | 3 | dot-agent ● | none | ✅ §8.1.1 |
| instrument | 3 | circle-instrument ○ | none | ✅ §8.1.2 |
| consumption | 3 | arrow-proc → | none | ✅ §7.2.1 |
| result | 2 | arrow-proc → | none | ✅ §7.2.2 |
| effect | 1 | arrow-proc → | arrow-proc ← | ✅ §7.2.3 ↔ |

## Commits de esta sesión

| Commit | Descripción |
|--------|------------|
| `7298355` | fix(sim): close 3 simulation gaps with TDD (9 tests) |
| `2ac5156` | docs: mark SIM-GAP-01/02/03 as fixed in backlog |

## Artefactos

| Artefacto | Path |
|-----------|------|
| Backlog actualizado | `docs/superpowers/specs/2026-03-10-opm-modeling-app-backlog-lean.md` |
| Simulation engine | `packages/core/src/simulation.ts` |
| API invariants | `packages/core/src/api.ts` |

## Estado de Simulation Gaps

| ID | Severidad | Estado |
|----|-----------|--------|
| ~~SIM-BUG-01~~ | ~~CRITICAL~~ | **Fixeado** (previo) |
| ~~SIM-BUG-02~~ | ~~CRITICAL~~ | **Fixeado** (previo) |
| ~~SIM-GAP-01~~ | ~~Medium~~ | **Fixeado** (7298355) |
| ~~SIM-GAP-02~~ | ~~Medium~~ | **Fixeado** (7298355) |
| ~~SIM-GAP-03~~ | ~~Medium~~ | **Fixeado** (7298355) |

**0 simulation gaps pendientes.**

## Pendiente para próxima sesión

### Prioridad 1: Visual
| ID | Descripción |
|----|------------|
| C-05 | Structural fork point rendering (P1, alto esfuerzo) |

### Prioridad 2: Modelo/Calidad
| ID | Descripción |
|----|------------|
| G-02 (O-01) | `State.current` → `Thing.current_state` migration |
| Web tests | 0 unit tests en componentes web |

### Prioridad 3: Data Model (Low/Very Low)
| ID | Descripción |
|----|------------|
| G-07 | Multiplicity parameters globales |
| G-11 | Appearance.is_refined (derivable) |
| G-14 | Link precedence order (algorítmico) |
| G-18 | Object vs Process in-zoom (derivable) |

## Stats

- **514 tests** (36 test files, 4 packages)
- **48 commits** on master
- **0 CRITICAL bugs** restantes
- **0 Medium simulation gaps** restantes
- **0 Medium data model gaps** restantes
