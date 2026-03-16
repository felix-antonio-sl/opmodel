# Handoff: SIM-GAP Closure + Visual Verification + Simulation UI Fixes

**Fecha:** 2026-03-15
**Sesión:** sim-gaps-visual-verification (session 3)
**515 tests passing, 53 commits on master**

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
- Snapshot del estado tomado al inicio de cada wave (parallel pre-image)
- Precondiciones evaluadas contra el snapshot
- `processInvocations` retorna boolean; si triggerea invocación, invalida el wave snapshot
- Procesos que fallan con "lost"/"skip" en snapshot se marcan completados (clearing barrier)

**Tests**: 3 nuevos (same-Y execution, barrier sync, snapshot semantics)

### 4. Verificación Visual ISO Markers (CONFIRMED)

Verificación en browser via Chrome extension + DOM inspection del modelo Coffee Making en SD1:

| Link Type | Count | markerEnd | markerStart | ISO |
|-----------|-------|-----------|-------------|-----|
| agent | 3 | dot-agent ● | none | ✅ §8.1.1 |
| instrument | 3 | circle-instrument ○ | none | ✅ §8.1.2 |
| consumption | 4 | arrow-proc → | none | ✅ §7.2.1 |
| result | 3 | arrow-proc → | none | ✅ §7.2.2 |

### 5. Effect Link State-Pill Routing Fix

**Bug**: Para effect links, el código de rendering ruteaba `target_state` al thing target (correcto para otros links) pero para effect links ambos estados pertenecen al OBJETO endpoint. Esto causaba que el link terminara en el pill "hot" en vez del pill "cold" (FROM state).

**Fix**: Para effect links, se rutea el extremo del objeto al `source_state` (FROM state); `target_state` no se rutea visualmente.

### 6. Simulation ObjectState Deep-Copy Fix

**Bug**: `simulationStep` creaba `new Map(state.objects)` que compartía los objetos `ObjectState`. Mutaciones (`obj.exists`, `obj.currentState`) leakeaban a todos los pasos, causando que la UI de simulación mostrara el estado FINAL en cada paso.

**Fix**: Spread-copy de cada `ObjectState` al crear `newState.objects`. Verificado visualmente: Step 2 (Boiling) ahora muestra Water: exists, hot correctamente (antes mostraba consumed).

**Tests**: 1 nuevo (intermediate step state independence)

### 7. Container Drag Coupling en In-Zoom OPDs

**Bug**: Al arrastrar el proceso container (Coffee Making) en SD1, los subprocesos internos no se movían con él.

**Fix**:
- Nuevo comando batch `moveThings` en `commands.ts` (single undo step)
- `draggedThings` Set: si el target es el container (`opd.refines`), incluye todas las appearances del OPD
- Delta visual aplicado a todos los `draggedThings` durante drag
- Links y state pills reposicionados via `draggedThings.has()` checks

### 8. Coffee Making Fixture: Effect → Consumption + Result

**Refactor ISO**: El effect link (Boiling ↔ Water cold→hot) fue reemplazado por el patrón ISO correcto de transformación de estado:
- `consumption`: Water(cold) → Boiling (consume agua fría)
- `result`: Boiling → Water(hot) (produce agua caliente)

**Cascade**: `simulationStep` refactorizado a ejecución por fases (consumption → effect → result) para garantizar que consumption+result sobre el mismo objeto funcione independiente del orden de inserción de links. Fixture pasa de 12 a 13 links.

### 9. TypeScript en Web Package

Instalado `typescript@5.9.3` como devDependency en `packages/web` para soporte de `npx tsc --noEmit`.

## Commits de esta sesión (7)

| Commit | Descripción |
|--------|------------|
| `7298355` | fix(sim): close 3 simulation gaps with TDD (9 tests) |
| `2ac5156` | docs: mark SIM-GAP-01/02/03 as fixed in backlog |
| `fc16d16` | docs: session handoff (primera versión) |
| `e8631f8` | fix(web): effect link state-pill routing uses object endpoint |
| `9896bdb` | fix(sim): deep-copy ObjectState to preserve intermediate step states |
| `713671c` | feat(web): container drag coupling in in-zoom OPDs |
| `cdb61e3` | refactor(model): replace effect link with consumption+result on Water |

## Artefactos modificados

| Artefacto | Path |
|-----------|------|
| Simulation engine | `packages/core/src/simulation.ts` |
| API invariants | `packages/core/src/api.ts` |
| OPD Canvas | `packages/web/src/components/OpdCanvas.tsx` |
| Command algebra | `packages/web/src/lib/commands.ts` |
| Coffee Making fixture | `tests/coffee-making.opmodel` |
| Backlog | `docs/superpowers/specs/2026-03-10-opm-modeling-app-backlog-lean.md` |

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

- **515 tests** (36 test files, 4 packages)
- **53 commits** on master
- **0 CRITICAL bugs** restantes
- **0 Medium simulation gaps** restantes
- **0 Medium data model gaps** restantes
