# Handoff: Auditoría ISO 19450 + Nuevos Invariantes + Simulación ECA

**Fecha:** 2026-03-13
**Estado:** Completado y commiteado a `master`

---

## Artefactos producidos

| Artefacto | Path | Acción |
|-----------|------|--------|
| ISO gap analysis | `docs/superpowers/specs/2026-03-13-iso-gap-analysis.md` | Creado |
| Backlog actualizado | `docs/superpowers/specs/2026-03-10-opm-modeling-app-backlog-lean.md` | 8 HUs nuevos + 15+ ACs |
| Nuevos invariantes | `packages/core/src/api.ts` | I-17 a I-26 (+154 líneas) |
| OPL rendering mejorado | `packages/core/src/opl.ts` | State-specified links (+73 líneas) |
| Tipos extendidos | `packages/core/src/types.ts` | Link.incomplete, FanType.and |
| OPL types extendidos | `packages/core/src/opl-types.ts` | OplLinkSentence.incomplete |
| Motor simulación ECA | `packages/core/src/simulation.ts` | 327 líneas (DA-5) |
| Exports actualizados | `packages/core/src/index.ts` | Simulation types + functions |
| Specs reubicados | `specs/` → `docs/superpowers/specs/` | 3 archivos movidos |

**Total:** ~600 líneas nuevas, 325 tests (sin regresión).

---

## Qué se hizo

### 1. Auditoría ISO 19450 vs Backlog

Análisis exhaustivo del backlog (52 HUs) contra ISO/PAS 19450 completo:

| Categoría | Count |
|-----------|-------|
| CRITICAL gaps | 6 |
| IMPORTANT gaps | 14 |
| MINOR gaps | 12 |
| Underspecifications | 10 |
| Extensions compatibles | 17 |

**Cobertura estimada:** ~78% al completar P1.

### 2. Incorporación de brechas al backlog (52 → 60 HUs)

**8 HUs nuevos:**
- L-M1-14: Operaciones e invocación (P2) — Gap C1
- L-M1-15: Stateful vs stateless (P1) — Gap C3
- L-M1-16: Completeness de agregación (P1) — Gap C4
- L-M1-17: Supresión de estados (P1) — Gap I3
- L-M4-11: Consistencia de hechos en refinamiento (P2) — Gap C6
- L-M4-12: Anotación stakeholder (P3) — Gap I1
- L-M5-10: Escenarios (P2) — Gap I8
- L-M5-11: Diagramas de lifespan (P3) — Gap I9

**15+ ACs nuevos** en HUs existentes: L-M1-02, L-M1-04, L-M1-05, L-M1-06, L-M1-07, L-M1-08, L-M5-01, L-M5-02, L-M5-05, L-M5-07.

### 3. Nuevos invariantes en Domain Engine

| Invariante | Descripción |
|-----------|-------------|
| I-17 | Process must have >= 1 transformation link |
| I-20 | Object with states must have >= 2 states |
| I-22 | Generalization: same perseverance |
| I-23 | Classification: same perseverance |
| I-24 | Invocation links: processes only |
| I-25 | Exception links: processes only |
| I-26 | Aggregation: parts same perseverance as whole |

### 4. OPL rendering ISO-compliant

Mejoras en `renderLinkSentence()` para generar OPL conforme a ISO 19450 §9.3:
- State-specified effects: `"Boiling changes Water from liquid to gas"`
- Incomplete aggregation: `"X consists of Y and at least one other part"`
- State-qualified agent/instrument/consumption/result sentences

### 5. Motor de simulación ECA (DA-5)

Implementación coalgebraica `S → F(S)`:
- `createInitialState`, `evaluatePrecondition`, `simulationStep`, `runSimulation`
- `getPreprocessSet`, `getPostprocessSet` para cómputo de involved objects
- 6 tipos exportados: ModelState, ObjectState, SimulationEvent, SimulationStep, SimulationTrace, PreconditionResult

---

## Commits

| Hash | Mensaje |
|------|---------|
| `ddc40d6` | docs: relocate specs, add ISO gap analysis, update backlog with 8 new HUs |
| `c152466` | feat(core): add invariants I-17 to I-26, ISO-compliant OPL rendering |
| `f8e2a3c` | feat(core): add ECA simulation engine as coalgebra evaluator (DA-5) |

---

## Próximos pasos recomendados

1. **Tests para simulation.ts** — 0 tests actualmente; necesita cobertura de ECA step/trace
2. **Tests para I-17 a I-26** — Invariantes sin tests unitarios dedicados
3. **Wire OPL mejorado en web editor** — State-specified links visibles en panel OPL
4. **Sub-proyecto B (L-M2-01)** — Parser NL → OPL vía LLM
5. **Gap C2 (skip/wait)** — condition_mode en Link, bloqueante para simulación correcta
6. **Gap C3 (stateful/stateless)** — Thing.stateful property, bloqueante para compliance ISO
