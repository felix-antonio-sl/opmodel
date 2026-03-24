# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OPModel is a specification and implementation workspace for **OPModeling** — a single-user power tool for Object Process Methodology (ISO 19450) modeling. The repository contains the Domain Engine core (`packages/core/`) with full CRUD operations, 30+ invariant guards, simulation engine, OPL bidirectional lens, and serialization. It also includes a CLI (`packages/cli/`), a web editor (`packages/web/`), specifications, audits, formal analysis, plans, and session logs.

All documentation follows OPM (ISO 19450) guidelines and KODA Framework architectural principles.

## Repository Structure

- **packages/core/** — Domain Engine (TypeScript, zero dependencies). Types, Result monad, createModel, serialization, CRUD API, 37 invariant guards, OPL lens, simulation engine (with in-zoom recursion), OPD fiber computation (DA-9). 550+ tests.
- **packages/cli/** — CLI `opmod` command (9 commands: new, add, remove, list, show, validate, update, refine, opl). 90+ tests.
- **packages/web/** — Web editor (React, full CRUD, OPL panel with 3 tabs, undo/redo, import/export).
- **docs/superpowers/specs/** — Product specifications and requirements. Central artifacts: `opm-modeling-app-backlog-lean.md`, `opm-data-model.md` (Rev.3), `opm-json-schema.json`.
- **tests/** — Shared fixture files (e.g., `coffee-making.opmodel`).
- **analysis/** — Formal foundations research. Read-only reference material.
- **audits/** — Formal verification against ISO 19450.
- **docs/superpowers/** — Design specs and implementation plans.
- **sessions/** — Session handoffs. Always check the latest handoff file for current state.

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

## Development

- **Runtime:** Bun v1.3.10 (`~/.bun/bin/bun`). Requiere: `export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"`
- **Tests:** `bunx vitest run` (all 767 tests from root). Single file: `bunx vitest run packages/core/tests/api.test.ts`
- **Type check:** `cd packages/core && bunx tsc --noEmit` (7 pre-existing TS2532 in test files — known, vitest passes)
- **Monorepo:** Bun workspaces (root `package.json`)
- **Pattern:** Immutable Model — funciones puras retornan `Result<Model, InvariantError>`, Maps para O(1) lookups
- **TDD:** Red→Green→Refactor. Tests before implementation, always.

## Session Continuity

Always read the latest `sessions/YYYY-MM-DD-*-handoff.md` to understand current state, artifacts produced, and recommended next steps. The handoff documents capture all decisions and pending work.

## Do Not Modify

- Files in external KORA repo paths (`knowledge/fxsl/opm-methodology/`, `agents/fxsl/*`) — these are read-only references.
- Original backlog files (`opcloud-backlog-refactorizado.md`) — preserved by user request.
