# Handoff: Sesión 17 — HODOM Fixture Polish + Engine Improvements

**Fecha**: 2026-03-24
**Sesión**: 17
**Agente**: steipete (kora/steipete)

## Resumen ejecutivo

Auditoría completa del fixture hospitalización domiciliaria. 16 commits, 7 bugfixes core/web, 4 features OPL, model enrichment, 31 tests nuevos. 805→836 tests, 0 regresiones.

## Fixes

| # | Archivo(s) | Fix |
|---|-----------|-----|
| 1 | simulation.ts | Ghost positioning: maxRight+80px gap, elimina 33 overlaps |
| 2 | opl.ts | OPL event modifier: invocation links usaban heurística invertida |
| 3 | opl.ts | Structural links visibles en refinement OPDs sin internal requirement |
| 4 | simulation.ts | Exception/invocation: resolve a ancestor interno, no distribuir a todos |
| 5 | OplSentencesView.tsx | Edge label una vez al top, no por sentence |
| 6 | OpdCanvas.tsx | React keys únicos para links distribuidos |
| 7 | fixture | Domicilio/Técnico overlap en SD1 |

## Features OPL

| # | Feature | Impacto |
|---|---------|---------|
| 1 | Requirement + assertion rendering | 3 reqs normativa + 2 assertions visibles en OPL |
| 2 | Path label annotation | 8 sentences con [path: flujo-normal/emergencia] |
| 3 | Exception type rendering | "handles overtime exception from" |
| 4 | Effect probability suffix | "(probability 85%)" |

## Model Enrichment

- +5 states (obj-cuidador: 2, obj-estado-plan: 3)
- +8 appearances (SD1: Director Técnico, Kinesiólogo, Médico Regulador, Técnico Paramédico, Estado del Plan; SD: Paciente Geriátrico, Paciente Pediátrico; SD1.2: Protocolo de Emergencia)
- Capacitación effect: state-specified (no capacitado → capacitado)
- Autosave: 300s → 1s

## Estado final

| Métrica | Inicio | Fin | Δ |
|---------|--------|-----|---|
| Tests | 805 | 836 | +31 |
| Ghost overlaps | 33 | 0 | -33 |
| SD1 visual links | 71 | 60 | -11 |
| Appearances | 76 | 84 | +8 |
| States | 29 | 34 | +5 |
| OPL sentences (total) | ~240 | 262 | +22 |
| Console errors | ~120 | 0 | -120 |
| Commits | 0 | 16 | +16 |

## Fixture HODOM: 48 things, 34 states, 82 links, 84 appearances, 6 OPDs
## Tests: 836 (54 files), 0 validation errors, 0 regressions
