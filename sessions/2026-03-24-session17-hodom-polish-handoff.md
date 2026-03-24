# Handoff: Sesión 17 — HODOM Fixture Polish + Engine Fixes

**Fecha**: 2026-03-24
**Sesión**: 17
**Agente**: steipete (kora/steipete)

## Resumen ejecutivo

Auditoría visual y semántica del fixture hospitalización domiciliaria. 8 commits, 5 bugfixes core, 1 model enrichment, 1 web fix, 24 tests nuevos. 805→832 tests, 0 regresiones.

## Fixes aplicados

### Core — Ghost Positioning (simulation.ts)
- **Antes**: Grid fijo `x=600, y=50` — 33 overlaps con containers de in-zoom
- **Después**: `maxRight + 80px` gap desde bounding box de explicits, grid 3×N
- **Test**: ghost-overlap.test.ts (3 tests: no overlap explicit, right of explicits, no overlap ghosts)

### Core — OPL Event Modifier para Invocation (opl.ts)
- **Antes**: "Respuesta a Emergencia triggers Regulación Médica" (dirección invertida)
- **Después**: "Regulación Médica triggers Respuesta a Emergencia"
- **Root cause**: Invocation links (process→process) usaban heurística de transforming links (source=process, target=object)

### Core — Structural Links en Refinement OPDs (opl.ts)
- **Antes**: Aggregation/exhibition/generalization entre things visibles non-internal se filtraban
- **Después**: Solo procedural links requieren internal thing; structural links pasan si ambos endpoints son visibles
- **Impacto**: Equipo Clínico aggregation ahora renderiza en SD1 OPL

### Core — Exception/Invocation C-01 Distribution (simulation.ts)
- **Antes**: 1 exception link → 6 visual links (distribuido a todos los subprocesos)
- **Después**: 1 exception link → 1 visual link (resuelto al ancestor interno más cercano)
- **Impacto**: SD1 links 71→60, mucho menos clutter visual

### Web — OPL Edge Label (OplSentencesView.tsx)
- **Antes**: Refinement edge label prepended a CADA sentence individual
- **Después**: Edge label mostrado una vez al top en itálica, stripped de per-sentence renders

## Model Enrichment

- Estados obj-cuidador: no capacitado → capacitado (2 states)
- Estados obj-estado-plan: vigente, vencido, cerrado (3 states)
- Effect link Capacitación: state-specified (no capacitado → capacitado)
- Appearances explícitas: obj-estado-plan (SD1), obj-protocolo-emergencia (SD1.2), obj-paciente-geriatrico/pediatrico (SD), Director Técnico/Kinesiólogo/Médico Regulador/Técnico Paramédico (SD1)
- 76→84 appearances, 29→34 states

## Tests nuevos

| Test file | Tests | Cobertura |
|-----------|-------|-----------|
| ghost-overlap.test.ts | 3 | Ghost non-overlap invariant |
| opl-audit.test.ts | 21 | No unspecified state, no dupes, no empty, correct aggregation/event/effect |
| link-coverage.test.ts | 3 | All links in at least one OPL (except cross-OPD exception) |
| **Total nuevos** | **27** | |

## Commits

| Hash | Descripción |
|------|-------------|
| `50433c0` | fix: ghost positioning + OPL invocation event + model states |
| `dba8f4c` | chore: sync hodom fixture to web public |
| `ef0af7d` | fix(web): OPL edge label shown once, not per sentence |
| `414a69b` | refactor: simplify ghost grid positioning |
| `d324870` | test: ghost non-overlap + OPL audit tests |
| `6c32d84` | feat: HODOM model enrichment + link coverage tests |
| `c4858dc` | fix: Equipo Clínico aggregation OPL + structural links |
| `1a1bca1` | fix: exception/invocation distribution |

## Estado del proyecto

- **832 tests** (54 test files), todos green
- **0 regresiones**
- **Fixture HODOM**: 48 things, 34 states, 82 links, 84 appearances, 6 OPDs

### Metricas

| Métrica | Inicio | Fin |
|---------|--------|-----|
| Tests | 805 | 832 (+27) |
| Ghost overlaps | 33 | 0 |
| SD1 visual links | 71 | 60 (-11) |
| Appearances | 76 | 84 (+8) |
| States | 29 | 34 (+5) |
| Commits | 0 | 8 |

## Pendientes

- SD1 aún tiene 60 links renderizados — feature de link filtering por relevancia sería bienvenido
- Cross-OPD exception link sin OPL coverage (by design, requeriría cross-OPD OPL support)
- Equipo Clínico semi_folded en SD3 pero aggregation parts son ghosts allí
- Input/output label count en web parece alto (10+10) vs 6 links en fiber — investigar R-ES split rendering
