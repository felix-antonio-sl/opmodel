# Design: Invocation Link como Trigger en Simulation Engine

**Fecha:** 2026-03-15
**Bug:** SIM-BUG-02 (CRITICAL)
**ISO:** §9.5.2.5.1 (Process invocation), §9.5.2.5.2 (Self-invocation)

---

## Problema

El simulation engine ignora los invocation links. Cuando un proceso completa, no busca invocation links salientes para trigger el proceso destino. El comment en `simulation.ts:520` confirma: "re-activation requires invocation link, not yet implemented".

## Semántica ISO

> "An invocation link shall be a link from a source process to the destination process that it invokes (initiates), signifying that **when the source process completes, it immediately initiates the destination process** at the other end of the invocation link."

- **Invocation** = trigger secuencial post-completion (Process→Process)
- **Self-invocation** = loop: proceso se re-ejecuta al completar
- Invocation links son process→process (validado por I-24)
- Self-invocation es el único self-loop permitido (I-34)

## Diseño

### Mecánica core

Cuando un proceso completa en `runSimulation()`:

1. Buscar invocation links donde `source === completedProcessId`
2. Para cada target process:
   a. **Re-habilitar**: eliminar de `completedProcesses` (override SIM-BUG-01 guard)
   b. Evaluar precondiciones (Approach C — precondition-gated)
   c. Si satisfied → ejecutar inmediatamente en siguiente iteración
   d. Si not satisfied → añadir a `waitingProcesses`

### Self-invocation guard (Approach A)

- `selfInvocationCount: Map<string, number>` trackea repeticiones por proceso
- `MAX_SELF_INVOCATIONS = 10` como constante
- Cuando un self-invocation alcanza el límite, el proceso NO se re-habilita
- El contador se resetea si el proceso es invocado por otro proceso (no por sí mismo)

### Cambios en runSimulation()

El loop principal actual tiene 2 fases. Se añade fase 3:

```
Phase 1: Re-evaluar waitingProcesses (existente)
Phase 2: Evaluar procesos ejecutables en orden Y (existente)
Phase 3: NEW — Procesar invocations del proceso recién completado
  → find invocation links from last completed process
  → for each target:
    - if self-invocation: check selfInvocationCount < MAX
    - remove target from completedProcesses
    - enqueue for evaluation in next iteration
```

### SimulationStep enrichment

```typescript
interface SimulationStep {
  // ... existing fields ...
  invokedBy?: string;  // NEW: ID del proceso que invocó este via invocation link
}
```

### Edge cases

| Caso | Comportamiento |
|------|---------------|
| Chain: A→B→C | Secuencial: A completes → B executes → B completes → C executes |
| Self: A→A | Loop hasta precondition fail o MAX_SELF_INVOCATIONS=10 |
| Precondition fail | Target va a waitingProcesses |
| Circular: A→B→A | Cada uno re-habilita al otro. maxSteps global = safety net |
| A invoca B que ya está en waiting | B se re-evalúa inmediatamente |

## Archivos

| Archivo | Cambio |
|---------|--------|
| `packages/core/src/simulation.ts` | `runSimulation()`: fase 3 invocation, `SimulationStep.invokedBy`, `MAX_SELF_INVOCATIONS` |
| `packages/core/tests/simulation.test.ts` | Tests: invocation trigger, self-invocation loop, chain A→B→C, precondition-gated stop |

## No cambia

- `evaluatePrecondition()` — ya funciona correctamente para procesos invocados
- `simulationStep()` — ya ejecuta un proceso dado un event
- `getExecutableProcesses()` — invocation no afecta el ordering inicial
- `types.ts` — `Link.invocation_interval` ya existe (futuro: timed invocation)
