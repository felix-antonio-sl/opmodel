# 18. Minimal extraction plan for the new direction

| Estado | **Superseded parcial** por ADR-008 (19-jointjs-renderer-adr) — 2026-04-16 |
|--------|--------|

> **SUPERSEDED PARCIAL 2026-04-16**
>
> Este plan proponia extraer un servicio Python externo con LangGraph + Deep Agents para orquestar modelado (seccion "Add" y "First interfaces to define"). ADR-008 descarta esa linea.
>
> **Lo que se conserva integro**:
> - Seccion "Keep — Core semantic layer": todos los archivos listados siguen siendo centrales
> - Seccion "Keep — Web primary surface": idem, con adicion de `packages/web/src/lib/renderers/jointjs/**`
> - Seccion "Stop treating as strategic center": aplica, y ademas `OpdCanvas` se deprecia formalmente post Fase 4 del plan JointJS
>
> **Lo que se descarta**:
> - Seccion "Add — New service": NO se crea `services/modeling-orchestrator/`
> - Python como stack adicional
> - LangGraph como runtime de orquestacion
> - Deep Agents como harness
> - `ModelingTask` como tipo de entrada al orquestador externo
> - `KernelPatchProposal` con `confidence`, `ssotChecksExpected`, `requiresHumanReview` como estructura generada por LLM
>
> **Lo que se reformula**:
> - `KernelPatchOperation` (sin "Proposal" ni "confidence") se implementa en core como operacion deterministica emitida por la UI JointJS, validada contra SSOT, aplicada o rechazada. Ver Fase 3 de `20-jointjs-execution-plan.md`.
>
> **Secuencia a implementar**: reemplazada por `20-jointjs-execution-plan.md` (4 fases, 4-6 semanas).
>
> El texto original se conserva abajo como referencia de la direccion que se exploro y se descarto.

---

## Texto original (2026-04-13)

## Goal

Quedarse solo con lo necesario de `opmodel` para la nueva direccion:

```text
SSOT-driven OPM modeling
+ LLM-mediated orchestration
+ premium visual compilation
```

## Keep

### Core semantic layer
- `packages/core/src/semantic-kernel.ts`
- `packages/core/src/opl-*`
- `packages/core/src/methodology.ts`
- `packages/core/src/generator/visual-render-spec.ts`
- `packages/core/src/generator/kernel-to-visual-render-spec.ts`
- `packages/core/src/generator/kernel-to-opl.ts`
- `packages/core/src/generator/refine-main-process.ts`
- `packages/core/src/generator/refinement-validation.ts`
- `packages/core/src/generator/visual-render-verifier.ts`

### Web primary surface
- `packages/web/src/features/generator/**`
- `packages/web/src/lib/renderers/llm-renderer/**`
- `packages/web/src/lib/svg/render-visual-render-spec.ts`
- `packages/web/src/components/OplImportPanel.tsx`
- `packages/web/src/components/NlSettingsModal.tsx`

## Stop treating as strategic center

### Legacy visual center
- `OpdCanvas`
- broad freeform canvas interactions
- large local geometry/layout complexity not needed by the generator path
- any UX effort whose main purpose is keeping canvas-first editing competitive

These may remain temporarily, but should no longer drive architecture.

## Add

### New service
Suggested path:

```text
services/modeling-orchestrator/
```

Tech:
- Python
- LangGraph
- Deep Agents

Responsibilities:
- task routing
- stateful orchestration
- specialized workers
- patch proposal generation
- memory and HITL hooks

## First interfaces to define

### `ModelingTask`
```ts
type ModelingTask =
  | { kind: "wizard-generate"; input: unknown }
  | { kind: "opl-import"; oplText: string }
  | { kind: "incremental-change"; request: string; modelSnapshot: unknown }
  | { kind: "refine-process"; processId: string; request?: string; modelSnapshot: unknown }
  | { kind: "render"; modelSnapshot: unknown };
```

### `KernelPatchProposal`
```ts
interface KernelPatchProposal {
  summary: string;
  rationale: string;
  operations: Array<Record<string, unknown>>;
  confidence: number;
  ssotChecksExpected: string[];
  requiresHumanReview: boolean;
}
```

## Sequence to implement

1. Define orchestrator contract in docs and types
2. Build Python service with one happy path per task kind
3. Connect generator workspace to orchestrator
4. Add patch review and validation feedback in UI
5. Expand workers only after real usage pressure

## What not to do

- do not rebuild all of `opmodel` around agents
- do not migrate the whole repo before product pressure proves it
- do not let prompts become hidden business logic
- do not let render quality pressure rewrite OPM semantics
- do not treat old canvas modules as sacred

## Short version

Keep the semantic core, the generator workspace, and the premium visual compiler.
Add one orchestration service.
Everything else is optional until proven necessary.
