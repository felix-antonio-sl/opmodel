# Handoff: ISO 19450 Gaps C2 (skip/wait) + C3 (stateful/stateless)

**Fecha:** 2026-03-13
**Estado:** Completado, pendiente push a `origin/master`

---

## Artefactos producidos

| Artefacto | Path | Acción |
|-----------|------|--------|
| Design spec | `docs/superpowers/specs/2026-03-13-simulation-gaps-c2-c3-design.md` | Creado (4 rondas review) |
| Implementation plan | `docs/superpowers/plans/2026-03-13-simulation-gaps-c2-c3.md` | Creado (2 rondas review) |
| Type fields | `packages/core/src/types.ts` | +Thing.stateful, +Modifier.condition_mode |
| Invariant guards | `packages/core/src/api.ts` | +5 guards + 3 validate blocks |
| Invariant tests | `packages/core/tests/stateless-condition.test.ts` | Creado, 19 tests |
| Simulation engine | `packages/core/src/simulation.ts` | Trivalent + waitingProcesses + deadlock |
| Simulation tests | `packages/core/tests/simulation.test.ts` | +8 tests (22→30) |
| OPL types | `packages/core/src/opl-types.ts` | +conditionMode, sourceStateName, targetStateName |
| OPL lens | `packages/core/src/opl.ts` | +renderModifierSentence, expose enrichment, editsFrom propagation |
| OPL tests | `packages/core/tests/opl.test.ts` | +6 tests (37→43) |
| JSON Schema | `docs/superpowers/specs/2026-03-10-opm-json-schema.json` | +Thing.stateful, +Modifier.condition_mode + if/then/else |

**Total:** +33 tests (373 → 406), 22 commits, 32 test files.

---

## Qué se hizo

### 1. Spec + Plan (5 commits)

- Design spec revieweado en 4 rondas (CRITICAL→MINOR convergencia)
- Implementation plan revieweado en 2 rondas (catch sutil: waitingProcesses immutability bug)
- 18 tareas en 4 chunks, ejecutadas con subagent-driven-development

### 2. Chunk 1 — Invariant Guards (8 commits)

**4 nuevos invariantes con TDD + code review:**

| Invariante | Guard en | Protege |
|------------|----------|---------|
| I-STATELESS-STATES | addState, validate | Objetos stateless no pueden tener estados |
| I-STATELESS-EFFECT | addLink, updateLink, updateThing, validate | Effect links no pueden apuntar a stateless; state-specified links no pueden referenciar stateless |
| I-STATELESS-DOWNGRADE | updateThing | No se puede marcar stateless si tiene estados |
| I-CONDITION-MODE | addModifier, updateModifier, validate | condition_mode solo válido en modifiers tipo condition |

**Code review fix:** Agregado guard en updateThing para effect links existentes (co-guard categórico).

### 3. Chunk 2 — Simulation Engine (2 commits)

- `PreconditionResult.response: "lost" | "skip" | "wait"` — trivalente reemplaza booleano
- `ModelState.waitingProcesses: Set<string>` — procesos bloqueados esperando condiciones
- `SimulationTrace.deadlocked: boolean` — detección de deadlock
- `getResponse(model, linkId)` — helper que inspecciona modifiers en el link fallido
- `runSimulation` reescrito: re-evalúa waiting processes cada iteración, unblocking, deadlock detection
- **Code review fix:** Simplificado deadlock detection (removido `everExecuted`, usando `waitingProcesses.size > 0`)

### 4. Chunk 3 — OPL Lens (4 commits)

- `OplModifierSentence` extendido con `conditionMode`, `sourceStateName`, `targetStateName`
- `renderModifierSentence()` direction-aware: 6 variantes ISO OPL
- `expose()` enriquece modifier sentences con condition mode y state names
- `editsFrom()` propaga `condition_mode` — cierra GetPut lens law
- **Code review fix:** Agregadas 2 branches faltantes (condition+state sin negación)

### 5. Chunk 4 — JSON Schema (1 commit)

- `Thing.stateful: boolean` (opcional)
- `Modifier.condition_mode: enum ["skip", "wait"]` con if/then/else conditional

---

## Commits

| Hash | Mensaje |
|------|---------|
| `1987b62` | feat(core): add Thing.stateful and Modifier.condition_mode type fields (C2+C3) |
| `8c72db2` | feat(core): add I-STATELESS-STATES guard in addState |
| `c9106d1` | feat(core): add I-STATELESS-EFFECT guard in addLink |
| `9d99b5e` | feat(core): add I-STATELESS-DOWNGRADE guard in updateThing |
| `4d6b940` | feat(core): add I-CONDITION-MODE guard in addModifier + updateModifier |
| `44a38f8` | feat(core): add I-STATELESS-EFFECT guard in updateLink |
| `9fdd119` | feat(core): add 4 new invariants to validate |
| `0b99ad0` | fix(core): address code review — rename misleading test, add effect-link guard in updateThing |
| `11dea1f` | feat(core): implement trivalent PreconditionResult, waitingProcesses, deadlock detection (C2) |
| `85fd0ae` | fix(core): simplify deadlock detection — remove everExecuted |
| `014a7c3` | feat(core): extend OplModifierSentence with conditionMode and state names |
| `52177bb` | feat(core): implement condition-mode aware OPL modifier rendering |
| `e65f770` | feat(core): propagate condition_mode in editsFrom for GetPut lens law |
| `e53a03f` | fix(core): add missing state-specified rendering branches |
| `461409e` | feat(schema): add Thing.stateful and Modifier.condition_mode to JSON Schema |

(+ 7 commits de spec/plan documentation)

---

## Próximos pasos recomendados

1. **`git push origin master`** — 22 commits pendientes
2. **Sub-proyecto B (L-M2-01)** — Parser NL → OPL vía LLM (usa `applyOplEdit` como backend)
3. **Web editor** — Wiring OPL panel al core, refine button, OPD tree nav
4. **Tests web** — OplEditorView y OplPanel sin tests unitarios
5. **Simulation UI** — Visualizar simulación en web editor (trivalent states, deadlock indicator)
