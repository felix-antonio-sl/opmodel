# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OPModel is a single-user power tool for **Object Process Methodology (ISO 19450)** modeling. The monorepo contains a Domain Engine core (`packages/core/`), a CLI (`packages/cli/`), a web editor (`packages/web/`), and a natural language layer (`packages/nl/`).

## Repository Structure

- **packages/core/** — Domain Engine (TypeScript, zero dependencies). Types, Result monad, createModel, serialization, CRUD API, 37+ invariant guards, OPL bidirectional lens, simulation engine (with in-zoom recursion), OPD fiber computation (DA-9). ~700+ tests.
- **packages/cli/** — CLI `opmod` command (9 commands: new, add, remove, list, show, validate, update, refine, opl). ~90 tests. `stats` command exists in code but not wired to CLI.
- **packages/web/** — Web editor (React/Vite, full CRUD, OPL panel with 3 tabs, undo/redo, simulation, visual lint/report, import/export SVG/PNG/OPL/Markdown, SD Wizard, bug capture). ~250 tests.
- **packages/nl/** — Natural language layer (parse, resolve, prompt builders, LLM providers, pipeline). ~50 tests.
- **tests/** — Shared fixture files (`.opmodel`): coffee-making, driver-rescuing, hospitalizacion-domiciliaria, hodom-v2, ev-ams, hodom-hsc-v0.
- **scripts/** — Build scripts for fixtures: `build-hodom-v2.ts`, `build-hodom-hsc-v0.ts`, `build-ev-ams.ts`.
- **docs/** — Specs, plans, methodology docs. Historical — may not reflect current state.
- **sessions/** — Session handoffs. Historical context, not guaranteed current.
- **analysis/** — Formal foundations research. Read-only reference.
- **audits/** — Formal verification against ISO 19450.

## Language and Conventions

- Documentation is written in **Spanish (es-CL)** with English technical terminology.
- Backlog item IDs follow the pattern `L-M{module}-{number}` (e.g., `L-M1-02` for Things in Module 1).
- File naming: lowercase Spanish with hyphens, `.md` extension. Session files prefixed with `YYYY-MM-DD-`.
- Evidence taxonomy: `frame-confirmada` | `video-confirmada` | `inferida` | `nueva`.
- Priorities: P0 (foundational) → P3 (deferred). Delivery in 8 pulses of 2 weeks each.

## Architectural Decisions (DAs)

| DA | Name | Status |
|----|------|--------|
| DA-1 | CLI-First (AI-Agent Ready) — `opmod` command with full feature parity | Defined |
| DA-2 | Graph-Native Storage with OPD fibration (property graph, not flat JSON) | Defined, pending categorical evolution |
| DA-3 | Single-User Pro (no auth, sophisticated internals) | Defined |
| DA-4 | Layered Architecture (Interfaces → Domain Engine → Graph Store) | Defined |
| DA-5 | Simulation Engine as Coalgebra Evaluator | Implemented (trivalent PreconditionResult, waitingProcesses, deadlock detection, in-zoom recursion ISO §14.2.1) |
| DA-6 | OPL Engine as Bidirectional Lens | Implemented (expose/applyOplEdit/render/editsFrom, PutGet+GetPut verified) |
| DA-7 | Link Refinement Fibration (consumption+result visual merge) | Implemented (Opción D: compute on demand, zero schema change, `findConsumptionResultPairs`) |
| DA-8 | Effect Fibration (effect ≅ 4 visual modes via transformingMode) | Implemented (`transformingMode` functor, `adjustEffectEndpoints`, per-mode markers+routing) |
| DA-9 | Vistas Derivadas — God Diagram + Computed Fibers | Implemented (`resolveOpdFiber`, `bringConnectedThings`, derived state suppression, OpdCanvas consumes fiber) |
| DA-10 | Links as Reified Morphisms (Yoneda Pattern) | Documented (links are 1-cells in C_OPM, reified as entities in implementation via Yoneda embedding; cascade deletion preserves morphism semantics) |

## Key Domain Concepts

- **OPM (Object Process Methodology):** ISO 19450 standard for systems modeling using Things (objects/processes), Links, States, and OPDs (Object Process Diagrams).
- **God Diagram (DA-9):** The Model is the Grothendieck colimit `∫ M` — a single total graph containing ALL things, links, and states. OPDs are computed fibers `π⁻¹(OPD_i)` over this graph. Appearances are positioning hints, not the source of truth for visibility. `resolveOpdFiber()` computes the derived view; `bringConnectedThings()` materializes implicit things as explicit.
- **Reified Morphisms (DA-10):** Links are 1-cells (morphisms) in C_OPM — they relate Things, not exist independently (ISO 3.36: "graphical expression of relation"). Implementation reifies them as entities with IDs via Yoneda embedding `y: C_OPM → [C_OPM^op, Set]` to support meta-constructions (Modifiers as 2-cells, Fans as cones). Cascade deletion preserves ontological dependency: no endpoints → no link.
- **OPD Tree:** Hierarchical diagram structure forming a fibration π: C_opm → C_opd_tree.
- **Bimodality:** OPM models have dual graphical (OPD) and textual (OPL) representations that must stay synchronized (lens laws: PutGet, GetPut).
- **ECA (Event-Condition-Action):** Simulation engine modeled as coalgebra S → F(S).

## Critical Dependencies in the Backlog

`L-M1-02` (Things) is the universal hub with 18 dependents. The P0 critical path:
```
L-M1-02 → L-M1-03 (Links) → L-M2-01 (OPL sync)
L-M1-02 → L-M1-06 (States)
L-M1-02 → L-M3-01 (OPD tree)
L-M1-02 → L-M1-07 (In-zoom)
```

## Current Operational Baseline (2026-03-30)

Use OPModel today as:
- a stable OPM core + web editor + export tool
- a fixture-driven modeling environment for real cases
- a validated baseline for HODOM/HODOM V2/EV-AMS/HODOM HSC

Do **not** treat it yet as:
- a fully polished large-model visual editor
- a strong ISO-complete refinement implementation in every edge case
- a clinically realistic simulation platform
- a vehicle for new feature lines like System Map / system mapping

Immediate priority is **baseline stabilization and real-case validation**, not feature expansion.

## Development

- **Runtime:** Bun (`~/.bun/bin/bun`). Setup: `export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"`
- **Tests (canonical):** `bun run test` — runs `bunx --bun vitest run` from root. All 1042 tests across 70 files (core, cli, web, nl). Single file: `bunx --bun vitest run packages/core/tests/api.test.ts`
- **Build web:** `bun run --filter @opmodel/web build` — TypeScript + Vite production build.
- **Dev web:** `bun run --filter @opmodel/web dev` — Vite dev server on port 5173. If `.vite/deps` has wrong permissions (root from Docker), fix with `sudo rm -rf packages/web/node_modules/.vite`.
- **Type check:** there is no clean canonical typecheck baseline yet. `cd packages/core && bunx tsc --noEmit` still reports pre-existing TypeScript errors in test files; do not treat it as green.
- **Monorepo:** Bun workspaces (root `package.json`). No build step for core/cli/nl — web consumes TS source directly.
- **Pattern:** Immutable Model — pure functions return `Result<Model, InvariantError>`, Maps for O(1) lookups.
- **Docker:** `docker-compose.yml` runs web dev via Traefik on `opmodel.sanixai.com`. Mounts repo as volume. Note: Docker creates `.vite` cache as root.

## Session Continuity

Sessions are useful historical context, but the **repo live state wins** over old handoffs. Verify commands, tests, fixtures, and behavior directly in the codebase before assuming a session note is still true.

## Current Real Fixtures

Baseline fixtures currently expected to load, validate, and export:
- `tests/coffee-making.opmodel`
- `tests/driver-rescuing.opmodel`
- `tests/hospitalizacion-domiciliaria.opmodel`
- `tests/hodom-v2.opmodel`
- `tests/ev-ams.opmodel`
- `tests/hodom-hsc-v0.opmodel`

## Do Not Modify

- Files in external KORA repo paths (`knowledge/fxsl/opm-methodology/`, `agents/fxsl/*`) — these are read-only references.
- Original backlog files (`opcloud-backlog-refactorizado.md`) — preserved by user request.
