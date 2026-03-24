# Handoff: Sesión 17 — HODOM Fixture Polish + Engine Improvements

**Fecha**: 2026-03-24
**Sesión**: 17
**Agente**: steipete (kora/steipete)
**Duración**: ~4 horas

## Resumen ejecutivo

Auditoría completa del fixture hospitalización domiciliaria + engine OPL + web canvas.
25 commits, 9 bugfixes, 7 features, 44 tests nuevos.
805→849 tests, 0 regresiones, 0 console errors, 0 validation errors.

## Bugfixes (9)

| # | Componente | Bug | Fix |
|---|-----------|-----|-----|
| 1 | simulation.ts | 33 ghost overlaps con containers | maxRight+80px gap grid |
| 2 | opl.ts | Event modifier invocation invertido | source→target para invocation |
| 3 | OplSentencesView | Edge label repetido por sentence | Strip + show once at top |
| 4 | simulation.ts | Exception/invocation distribuidos a 6 subprocesos | Resolve a internal ancestor |
| 5 | opl.ts | Structural links filtrados en refinement OPDs | Solo procedural requiere internal |
| 6 | fixture | Domicilio/Técnico overlap SD1 | y=750→770 |
| 7 | OpdCanvas.tsx | React duplicate keys (120+ errors) | Composite key con endpoints |
| 8 | OpdCanvas.tsx | Fork branch duplicate keys | Index-based key |
| 9 | simulation.ts | State corruption en runSimulation | Defensive guards |

## Features (7)

| # | Feature | Impacto |
|---|---------|---------|
| 1 | OPL requirement rendering | 6 reqs normativa en OPL |
| 2 | OPL assertion rendering | 6 assertions visibles |
| 3 | OPL path labels | [path: flujo-normal/emergencia] |
| 4 | OPL scenario rendering | [scenario: Flujo Normal] N links |
| 5 | OPL exception type | "handles overtime exception" |
| 6 | OPL effect probability | "(probability 85%)" |
| 7 | Structured OPL render | Grouped sections (things/links/meta) |

## Model Enrichment

- +5 states, +8 appearances, +2 requirements, +1 assertion
- Effect link Capacitación: state-specified
- Autosave: 300s→1s

## Estado final

| Métrica | Inicio | Fin |
|---------|--------|-----|
| Tests | 805 | 849 |
| Test files | 51 | 56 |
| Commits | 0 | 25 |
| Ghost overlaps | 33 | 0 |
| Console errors | ~120 | 0 |
| SD1 visual links | 71 | 60 |
| OPL sentences | ~240 | 272 |
| Requirements | 4 | 6 |
| Assertions | 5 | 6 |

## Fixture: 48 things, 34 states, 82 links, 84 appearances, 6 OPDs, 272 OPL sentences
## Tests: 849 (56 files), 0 validation errors, 0 regressions
