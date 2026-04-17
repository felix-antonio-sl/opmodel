# opl-first histórico

Esta carpeta contiene documentos de la línea `docs/opl-first/` que fueron
superseded por ADRs posteriores o cuyas decisiones ya viven en el código
y en los ADRs vigentes. Preservados para trazabilidad, no normativos.

Ver [`../../opl-first/README.md`](../../opl-first/README.md) para el conjunto vigente.

## Contenido

### Narrativa del giro OPL-first (abril 2026)

Documentos consolidados en **ADR-003** (`docs/opl-first/10-isomorphism-architecture.md`):

| Archivo | Qué capturaba |
|---------|---------------|
| `00-decision.md` | ADR-001 — decisión inicial OPL-first |
| `01-baseline.md` | Snapshot del repo en commit `c827959`, Apr-06 |
| `02-gap-analysis.md` | Gaps iniciales (parser, compiler, grammar) — todos resueltos |
| `03-target-architecture.md` | Pipeline target, consolidado en ADR-003 |
| `04-reuse-map.md` | Mapa inicial de reuso de código |
| `05-phases.md` | Fases 1-6 de la migración OPL-first — ejecutadas o absorbidas por plan 20 |
| `06-semantic-kernel-atlas-adr.md` | ADR-002 Proposed — refinado por ADR-003 |
| `07-opl-to-opd-transformation-spec.md` | Draft de reglas normativas — implementadas en código |
| `08-semantic-kernel-typescript-schema.md` | Draft de schema TS — código en `semantic-kernel.ts` es la fuente |
| `09-web-projection-migration.md` | Estrategia de migración web — ejecutada |

### Planes y ADRs SUPERSEDED por ADR-008

| Archivo | Estado |
|---------|--------|
| `12-web-visual-refactor-plan.md` | SUPERSEDED parcial (fases 2-3 reemplazadas por ADR-008) |
| `15-opm-graph-generator-mvp-plan.md` | Plan ejecutado |
| `16-llm-mediated-renderer-adr.md` | ADR-006 SUPERSEDED — la idea LLM-render se descartó |
| `17-llm-mediated-modeling-orchestrator-adr.md` | ADR-007 SUPERSEDED — se descartó servicio Python/LangGraph |
| `18-minimal-extraction-plan.md` | SUPERSEDED parcial |

### Handoff reemplazado

| Archivo | Reemplazado por |
|---------|-----------------|
| `HANDOFF-2026-04-07.md` | `docs/opl-first/HANDOFF-2026-04-16.md` |

## Decisiones que viven aquí

Si necesitás consultar la **narrativa histórica** del giro OPL-first, empezá
por `00-decision.md` → `03-target-architecture.md`. Para la formulación
categorial del isomorfismo (la versión viva), leé directamente
`docs/opl-first/10-isomorphism-architecture.md` (ADR-003).

Para la decisión vigente sobre renderer y sobre por qué LLM-mediated
rendering fue descartado, leé `docs/opl-first/19-jointjs-renderer-adr.md`
(ADR-008).
