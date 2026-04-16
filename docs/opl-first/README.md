# OPL-First Transition

> **OPL como fuente de verdad de autoría.**
> El modelo semántico y la representación visual son derivados.

## Documentos

| # | Documento | Contenido |
|---|-----------|-----------|
| 0 | [00-decision.md](./00-decision.md) | ADR — decisión arquitectónica |
| 1 | [01-baseline.md](./01-baseline.md) | Baseline real del repo (código, tests, métricas) |
| 2 | [02-gap-analysis.md](./02-gap-analysis.md) | Gaps contra el objetivo OPL-first |
| 3 | [03-target-architecture.md](./03-target-architecture.md) | Pipeline y módulos target |
| 4 | [04-reuse-map.md](./04-reuse-map.md) | Qué se reusa, qué cambia, qué se crea |
| 5 | [05-phases.md](./05-phases.md) | Fases de implementación + decisiones abiertas |
| 6 | [06-semantic-kernel-atlas-adr.md](./06-semantic-kernel-atlas-adr.md) | ADR — kernel semántico + atlas OPD fibrado |
| 7 | [07-opl-to-opd-transformation-spec.md](./07-opl-to-opd-transformation-spec.md) | Especificación normativa de transformación OPL → OPD |
| 8 | [08-semantic-kernel-typescript-schema.md](./08-semantic-kernel-typescript-schema.md) | Schema TypeScript concreto para kernel, atlas y layout |
| 9 | [09-web-projection-migration.md](./09-web-projection-migration.md) | Estado y estrategia de migración web a projection layer |
| 10 | [opl-grammar.md](./opl-grammar.md) | Gramática canónica inicial del input OPL |
| **11** | [**10-isomorphism-architecture.md**](./10-isomorphism-architecture.md) | **ADR-003 — Arquitectura categorial para isomorfismo OPL ↔ OPD (VINCULANTE)** |
| **12** | [**11-effective-visual-slice-adr.md**](./11-effective-visual-slice-adr.md) | **ADR-004 — Frontera canónica de vista efectiva para la capa visual web** |
| **13** | [**12-web-visual-refactor-plan.md**](./12-web-visual-refactor-plan.md) | **Plan por fases para la refactor estructural profunda de la capa visual web** |
| 14 | [14-opm-graph-generator-adr.md](./14-opm-graph-generator-adr.md) | ADR-005, nuevo slice principal: OPM Graph Generator |
| 15 | [15-opm-graph-generator-mvp-plan.md](./15-opm-graph-generator-mvp-plan.md) | MVP plan, contratos y archivos concretos del vertical slice |
| 16 | [16-llm-mediated-renderer-adr.md](./16-llm-mediated-renderer-adr.md) | ADR-006, renderer visual derivado mediado por LLM bajo contrato explícito — **SUPERSEDED por ADR-008** |
| 17 | [17-llm-mediated-modeling-orchestrator-adr.md](./17-llm-mediated-modeling-orchestrator-adr.md) | ADR-007, orquestación de modelado mediada por LLM bajo SSOT usando LangGraph / Deep Agents — **SUPERSEDED por ADR-008** |
| 18 | [18-minimal-extraction-plan.md](./18-minimal-extraction-plan.md) | Plan mínimo: qué conservar de opmodel, qué depriorizar y qué extraer a un servicio nuevo — **SUPERSEDED parcial por ADR-008** |
| **19** | [**19-jointjs-renderer-adr.md**](./19-jointjs-renderer-adr.md) | **ADR-008 — JointJS as deterministic renderer adapter (VINCULANTE)** |
| 20 | [20-jointjs-execution-plan.md](./20-jointjs-execution-plan.md) | Plan de ejecución 4 fases para integrar JointJS como renderer |

## SSOT reference

The OPL-first work in this directory is grounded on the authoritative OPM corpus exposed at:

- [`../ssot/README.md`](../ssot/README.md)
- [`../ssot/opm-ssot`](../ssot/opm-ssot)

Precedence:

1. ISO 19450
2. OPL-ES
3. Metodología de Modelamiento OPM

## Estado actual (2026-04-16)

- **Parser + compiler + validation**: operativos
- **Roundtrip categórico**: 4 leyes verificadas sobre 6 fixtures; convergencia doble pendiente en 5 de 6 (no bloqueante)
- **Semantic kernel / atlas / layout**: estables
- **VisualRenderSpec**: existe en `packages/core/src/generator/` junto con `kernelToVisualRenderSpec` y `visual-render-verifier`
- **Decisión vigente (ADR-008)**: JointJS (clientio/joint) es el renderer determinista de producción. Sin LLM en el pipeline de render ni de modelado. El kernel sigue siendo SSOT.
- **Plan activo**: `20-jointjs-execution-plan.md`, 4 fases (bootstrap → shapes completos → eventos/layout → integración Generator)
- **Superseded**: ADR-006 (LLM renderer), ADR-007 (LLM orchestrator con LangGraph/Deep Agents), fases 2-3 del 12-web-visual-refactor-plan, sección "Add service" del 18-minimal-extraction-plan

## Decisión vinculante (ADR-003)

El isomorfismo OPL ↔ OPD vive en `SemanticKernel`, no entre texto y píxeles:

```
OPL/~ ≅ SemanticKernel ≅ Atlas/~
```

Ver [10-isomorphism-architecture.md](./10-isomorphism-architecture.md) para las 4 leyes verificables y los 3 slices de implementación.

Para la frontera visual web, ver [11-effective-visual-slice-adr.md](./11-effective-visual-slice-adr.md).

## En una frase

- **Hoy**: motor semántico maduro + `VisualRenderSpec` listos; renderer SVG manual + `OpdCanvas` son la deuda
- **Target**: `OPL text ⇄ SemanticKernel → VisualRenderSpec → joint.dia.Graph → SVG/PNG`
- **Gap central remanente**: construir el adapter `visualRenderSpecToJointGraph()` + shapes OPM + handlers de eventos (4 fases del plan 20)
