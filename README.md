# OPModel

OPModel is a single-user tool for **Object Process Methodology (ISO 19450)** modeling.

Current repo status: **OPL-first pipeline completo (Fases 1-3), web integration parcial (Fase 4-5 en progreso).**

## What works today

- Core OPM model engine
- Web editor
- OPL export (including Spanish OPL)
- Fixture-driven real-case modeling
- Visual audit / visual correctness checks
- OPL-first pipeline: parse → compile → validate → model (Fases 1-3 completadas)
- Live OPL authoring workspace with Ctrl+S, inline validation, layout preservation
- Canonical real fixtures including HODOM HSC

## Canonical commands

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

Run full test suite (1127 tests, 80 files):

```bash
bun run test
```

Build web app:

```bash
bun run web:build
```

Run web app locally:

```bash
bun run web:dev
```

## Current technical baseline

- `bun run test` is green.
- `bun run web:build` is green.
- `bun run typecheck:core` is green.

Rebuild canonical fixtures:

```bash
bun run build:fixtures
```

Or individually:

```bash
bun run build:hodom-v2
bun run build:hodom-hsc-v0
bun run build:ev-ams
```

## Current baseline fixtures

- `tests/coffee-making.opmodel`
- `tests/driver-rescuing.opmodel`
- `tests/hospitalizacion-domiciliaria.opmodel`
- `tests/hodom-v2.opmodel`
- `tests/hodom-hsc-v0.opmodel`
- `tests/ev-ams.opmodel`

## Current positioning

Use OPModel today as:

- a stable OPM core + web editor + export tool
- a fixture-driven modeling environment for real cases
- a validated baseline for HODOM / HODOM V2 / EV-AMS / HODOM HSC
- an OPL-first tool: OPL text → parse → compile → model → validate → visual render
- an OPL-first authoring workspace with inline validation and layout preservation

Do **not** treat it yet as:

- a fully polished large-model visual editor
- a fully ISO-complete refinement implementation in every edge case
- a clinically realistic simulation platform
- a vehicle for new feature lines like System Map / system mapping (not started)

## SSOT corpus

Authoritative OPM references for this repo are exposed inside the repository at:

- [`docs/ssot/README.md`](./docs/ssot/README.md)
- [`docs/ssot/opm-ssot`](./docs/ssot/opm-ssot) → symlink to `/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-ssot`

Precedence:

1. **ISO 19450**
2. **OPL-ES**
3. **Metodología de Modelamiento OPM**

Any work on OPM semantics, OPL grammar, parsing, rendering, validation, or refinement should be checked against that corpus.

## OPL-first transition documentation

We are documenting a new architectural direction where:

> **OPL becomes the source of truth for authoring**
>
> The semantic model and the visual representation become derived artifacts.

Start here:

- [`docs/opl-first/README.md`](./docs/opl-first/README.md) — index
- [`docs/opl-first/00-decision.md`](./docs/opl-first/00-decision.md) — decision / ADR
- [`docs/opl-first/01-baseline.md`](./docs/opl-first/01-baseline.md) — current repo baseline
- [`docs/opl-first/02-gap-analysis.md`](./docs/opl-first/02-gap-analysis.md) — gaps vs OPL-first target
- [`docs/opl-first/03-target-architecture.md`](./docs/opl-first/03-target-architecture.md) — proposed target architecture
- [`docs/opl-first/04-reuse-map.md`](./docs/opl-first/04-reuse-map.md) — what can be reused
- [`docs/opl-first/05-phases.md`](./docs/opl-first/05-phases.md) — proposed implementation phases

Short version:

- **today**: OPL-first pipeline completo — `OPL text → parse → compile → Model → validate → visual render` funciona para 6 fixtures
- **target**: OPL como superficie principal de autoría, visual derivado
- **current gap**: source mapping bidireccional (click OPL ↔ visual), richer diagnostics and project persistence for day-to-day use

## Notes

- `CLAUDE.md` contains repo-specific guidance for coding agents.
- Historical docs under `docs/` and `docs/archive/sessions/` are useful, but the **live repo state wins**.
