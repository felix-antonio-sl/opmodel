# Handoff: Visual Audit ISO 19450 + Data Model Gaps + SIM-BUG-02

**Fecha:** 2026-03-15
**Sesión:** visual-audit-invocation
**505 tests passing, 46 commits on origin/master**

---

## Resumen de lo implementado

### 1. Auditoría Visual ISO 19450 (15 findings, 7 P0 fixed)

Comparación de OpdCanvas.tsx contra 21 láminas ISO de referencia (`~/Downloads/imagenes-opm/`).

**Fixes aplicados (P0):**
- Agent link: arrowhead → filled circle ● (ISO §8.1.1)
- Instrument link: arrowhead → hollow circle ○ (ISO §8.1.2)
- Effect link: unidireccional → bidireccional ↔ (ISO §7.2.3)
- Structural links: chevron → filled ▲ (agg/exh) / open △ (gen/cls) — geometría corregida 2 veces
- Object corners: rounded rx=3 → sharp rx=0 (ISO §5.1.1)
- Consumption link: removed spurious circle at source
- Modifier badge: [event]/[condition] → e/c (ISO §8.2)

**Thing colors (ISO convention):**
- Swapped object=blue/process=green → object=green/process=blue
- External/container things usan colores canónicos del kind (no gris)

**Pendiente visual:**
- C-05: Structural fork point (triángulo compartido para fans) — P1, esfuerzo alto
- Verificación visual de Agent ●, Instrument ○, Effect ↔ en browser (no verificados)

### 2. State-Specified Links + State Suppression UI

- **State suppression UI:** Checkbox V por estado en PropertiesPanel, toggle `Appearance.suppressed_states`
- **Link routing a state pills:** `statePillRect()` helper, endpoints siguen drag delta
- **Link editing UI completo:** Type dropdown (13 tipos), source/target selects, state selects
- **Comando `updateAppearance`** genérico añadido a commands.ts

### 3. Auditoría Modelo de Datos ISO 19450 (17 gaps → 7 restantes)

Comparación de types.ts contra ISO/PAS 19450 completo (390KB markdown).

**Cerrados (9):**
- G-01: `Duration.distribution` (normal, exponential, etc.)
- G-04: `Fan.direction` (converging/diverging)
- G-17: `Link.distributed` (in-zoom contour distribution)
- G-03: OPL default tags ("relates to"/"are related")
- G-05: Fan.members clarificado como link IDs
- G-06: I-FAN-PROB invariante (XOR probability sum=1)
- G-08: `Fan.member_multiplicities`
- G-09: `Fan.incomplete`
- G-10, G-16: cerrados by design

**Restantes (7, todos Low/Very Low):**
- G-02 (O-01): `State.current` → `Thing.current_state` (refactor cross-cutting)
- G-07: Multiplicity parameters globales
- G-11: `Appearance.is_refined` (derivable)
- G-14: Link precedence order (algorítmico)
- G-18: Object vs Process in-zoom (derivable)
- G-12, G-13: Very Low (derivable/no action)

### 4. SIM-BUG-02: Invocation Link como Trigger (CLOSED)

Implementado Phase 3 en `runSimulation()`:
- Scan invocation links post-completion → re-enable target process
- `selfInvocationCount` Map con MAX_SELF_INVOCATIONS=10 (Approach A)
- Precondition-gated re-execution (Approach C)
- `SimulationStep.invokedBy` tracking
- 5 tests: basic trigger, self-invocation guard, precondition stop, chain A→B→C, waiting deadlock

## Artefactos

| Artefacto | Path |
|-----------|------|
| Visual audit spec | `docs/superpowers/specs/2026-03-15-visual-audit-iso-19450.md` |
| Data model gap analysis | `docs/superpowers/specs/2026-03-15-data-model-iso-gap-analysis.md` |
| Invocation design spec | `docs/superpowers/specs/2026-03-15-invocation-trigger-design.md` |
| Invocation plan | `docs/superpowers/plans/2026-03-15-invocation-trigger.md` |

## Commits de esta sesión

| Commit | Descripción |
|--------|------------|
| `e3f5799` | ISO visual compliance + state-specified links + link editing |
| `2e7ca6f` | 3 Medium data model gaps cerrados |
| `905e4e1` | Fan maturity + semantic refinements |
| `87e4e68` | Gap analysis actualizado con estrategias |
| `ea510c4` | SIM-BUG-02 invocation trigger (5 tests nuevos) |

## Pendiente para próxima sesión

### Prioridad 1: Simulation gaps (Medium, low-hanging fruit)
| ID | Severidad | Descripción |
|----|-----------|-------------|
| SIM-GAP-02 | Medium | I-EVENT-INZOOM-BOUNDARY: event links no deben cruzar boundary in-zoom |
| SIM-GAP-03 | Medium | Effect link encoding convention: source_state vs target_state |
| SIM-GAP-01 | Medium | Subprocesos paralelos con misma Y (requiere diseño) |

### Prioridad 2: Visual
| ID | Descripción |
|----|------------|
| Verificación visual | Agent ●, Instrument ○, Effect ↔ — confirmar en browser |
| C-05 | Structural fork point rendering (P1, alto esfuerzo) |

### Prioridad 3: Modelo/Calidad
| ID | Descripción |
|----|------------|
| G-02 (O-01) | `State.current` → `Thing.current_state` migration |
| Web tests | 0 unit tests en componentes web |

## Stats

- **505 tests** (36 test files, 4 packages)
- **46 commits** on origin/master
- **0 CRITICAL bugs** restantes
- **0 Medium data model gaps** restantes
