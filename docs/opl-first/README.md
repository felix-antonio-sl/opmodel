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
| 6 | [opl-grammar.md](./opl-grammar.md) | Gramática canónica inicial del input OPL |

## SSOT reference

The OPL-first work in this directory is grounded on the authoritative OPM corpus exposed at:

- [`../ssot/README.md`](../ssot/README.md)
- [`../ssot/opm-ssot`](../ssot/opm-ssot)

Precedence:

1. ISO 19450
2. OPL-ES
3. Metodología de Modelamiento OPM

## Estado actual

- **Fase 1 completada**: parser `OPL → OplDocument` listo
- **Coverage real**: 6 fixtures, 0 líneas sin match
- **Siguiente paso**: compiler `OplDocument → Model`

## En una frase

- **Hoy**: `.opmodel` es la fuente de verdad, OPL es derivado
- **Target**: `OPL text → parse → compile → Model → validate → visual`
- **Gap central remanente**: no existe aún el camino `OplDocument → Model`
