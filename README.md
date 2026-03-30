# OPModel

OPModel is a single-user tool for **Object Process Methodology (ISO 19450)** modeling.

Current repo status: **baseline stabilized**.

## What works today

- Core OPM model engine
- Web editor
- OPL export (including Spanish OPL)
- Fixture-driven real-case modeling
- Visual audit / visual correctness checks
- Canonical real fixtures including HODOM HSC

## Canonical commands

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

Run full test suite:

```bash
bun run test
```

Build web app:

```bash
bun run --filter @opmodel/web build
```

Run web app locally:

```bash
bun run --filter @opmodel/web dev
```

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
- a fixture-driven environment for real modeling cases
- a validated baseline for HODOM / HODOM V2 / EV-AMS / HODOM HSC

Do **not** treat it yet as:

- a fully polished large-model visual editor
- a fully ISO-complete refinement implementation in every edge case
- a clinically realistic simulation platform
- a vehicle for new feature lines like System Map / system mapping

## Notes

- `CLAUDE.md` contains repo-specific guidance for coding agents.
- Historical docs under `docs/` and `sessions/` are useful, but the **live repo state wins**.
