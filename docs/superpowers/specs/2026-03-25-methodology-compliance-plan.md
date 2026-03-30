# Plan de Cumplimiento Metodológico OPM — Especificación

**Fecha**: 2026-03-25
**Autor**: steipete
**Fuentes**: metodologia-modelamiento-opm.md, opm-canonical-example.md, ISO 19450
**Estado**: En ejecución

---

## Objetivo

Hacer que opmodel cumpla completamente con la metodología de modelamiento OPM (10 pasos SD, refinamiento, verificación) y sea capaz de representar el ejemplo canónico EV-AMS con todos sus constructos.

---

## Fase 1 — Validación Metodológica (P0)

Agregar invariantes de validación que enforcen las reglas de la metodología.

| ID | Invariante | Regla metodológica | Severidad | Enforcement |
|----|-----------|-------------------|----------|-------------|
| I-GERUND | Proceso principal usa naming procesual aceptado (inglés: -ing; español: -ando/-iendo o formas como -ción) | §6.1 | WARNING | validate() |
| I-SINGULAR | Nombres plurales deben usar Set/Group | §6.2 | WARNING | validate() |
| I-TRANSFORMEE | Todo proceso tiene ≥1 transforming link (effect/consumption/result) | §4.3 | WARNING | validate() |
| I-EXHIBITION | Sistema exhibe proceso principal via exhibition | §6.6 | INFO | validate() |
| I-ENVIRONMENT | ≥1 objeto environmental en modelo | §6.9 | INFO | validate() |
| I-AGENT-HUMAN | Agent links conectan a objetos physical (humanos) | §6.5 | WARNING | validate() |

## Fase 2 — SD Wizard (P3)

Modal paso-a-paso que guía los 10 pasos del §6 para construir el SD.

| Step | Input | Output | Auto-check |
|------|-------|--------|------------|
| 1 | Nombre proceso principal | Thing (process) | Gerundio |
| 2 | Nombre grupo beneficiario | Thing (object, physical) | Suffix Group/Set |
| 3 | Atributo beneficiario + 2 estados | Thing (object, informatical) + 2 States | Exactly 2 states |
| 4 | Transformee + atributo | Thing (object) + Thing (informatical) | — |
| 5 | Agentes (0+) | Things (object, physical) + agent links | — |
| 6 | Nombre sistema | Thing (object) + exhibition link | Auto-gen default |
| 7 | Instrumentos (0+) | Things + instrument links | — |
| 8 | Inputs/Outputs | Things + consumption/result links | — |
| 9 | Environmental objects | Mark existing as environmental | — |
| 10 | Problem occurrence | Thing (process, environmental) + links | Optional |

Output: Modelo completo con SD posicionado automáticamente.

## Fase 3 — Constructos Faltantes (P4)

| ID | Constructo | Status actual | Acción |
|----|-----------|---------------|--------|
| 3.1 | Tagged structural links | Tipo existe, UI parcial | Completar editor de tag |
| 3.2 | Compound states | No existe | Cartesian product view |
| 3.3 | State-specified enabling | source_state funciona | ✅ Done |
| 3.4 | Ordered aggregation | ordered flag en Link | UI indicator |
| 3.5 | Non-comprehensive fork | incomplete flag | Visual "..." en fork |
| 3.6 | Transient object suppression | invocation link | ✅ Done |
| 3.7 | System Map view | No existe | New view type |
| 3.8 | Split links visual | splitHalf implemented | ✅ Done |

## Fase 4 — Ejemplo Canónico EV-AMS (P1)

Crear fixture completa del ejemplo canónico:

- **SD**: 15 things, ~20 links, 10+ states
- **SD1**: 4 subprocesos + objetos asociados
- **SD1.1**: 4 especializations (gen-spec unfold)
- **SD1.1.1**: 4 subprocesos + XOR branching
- **SD1.2**: 4 subprocesos + generalization robots + classification instances + parallel
- **67 OPL sentences** verificables
- **Tests de regresión** por constructo

## Fase 5 — Verification Checklist (P2)

Panel UI que evalúa automáticamente:

| Level | Checks |
|-------|--------|
| SD | 9 checks (§6.11) |
| SD1 | 5 checks (§7.6) |
| SD2+ | 3 checks (§8.4) |
| Global | 3 checks (§10) |

---

## Métricas de Éxito

- [ ] Todos los invariantes de Fase 1 implementados y testeados
- [ ] SD Wizard genera modelo válido en <2 minutos
- [ ] EV-AMS fixture carga sin errores de validación
- [ ] 67/67 OPL sentences del ejemplo canónico generadas correctamente
- [ ] Verification checklist pasa 100% para EV-AMS
- [ ] ≥950 tests
