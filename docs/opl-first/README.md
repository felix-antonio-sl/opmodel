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

## SSOT reference

The OPL-first work in this directory is grounded on the authoritative OPM corpus exposed at:

- [`../ssot/README.md`](../ssot/README.md)
- [`../ssot/opm-ssot`](../ssot/opm-ssot)

Precedence:

1. ISO 19450
2. OPL-ES
3. Metodología de Modelamiento OPM

## Estado actual

- **Parser + compiler + validation**: operativos
- **Roundtrip categórico**: estabilizado en caso canónico
- **Semantic kernel / atlas / layout**: introducidos como capa nueva
- **Migración web**: en progreso con projection layer ya conectado a canvas/layout/reporting/store
- **Siguiente paso**: canvas nativo desde `projection` y luego persistencia de layout más allá de `Appearance` legacy

## En una frase

- **Hoy**: convivimos entre `Model` legacy y pipeline nuevo `SemanticKernel → OpdAtlas → LayoutModel`
- **Target**: `OPL text → parse → SemanticKernel → OpdAtlas → Layout → visual`
- **Gap central remanente**: hacer al canvas consumir la proyección como input nativo y no solo vía bridge
