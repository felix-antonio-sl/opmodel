# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

OPModel is a specification and implementation workspace for **OPModeling** — a single-user power tool for Object Process Methodology (ISO 19450) modeling. The repository contains the Domain Engine core (`packages/core/`) with full CRUD operations, 18 invariant guards, and serialization. It also holds specifications, audits, formal analysis, plans, and session logs.

All documentation follows OPM (ISO 19450) guidelines and KODA Framework architectural principles.

## Repository Structure

- **packages/core/** — Domain Engine (TypeScript, zero dependencies). Types, Result monad, createModel, serialization, CRUD API, invariant guards. 72 tests.
- **packages/cli/** — CLI `opmod` command (planned, not yet implemented).
- **packages/web/** — Web UI (future).
- **specs/** — Product specifications and requirements. Central artifacts: `opm-modeling-app-backlog-lean.md`, `opm-data-model.md` (Rev.3), `opm-json-schema.json`.
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
| DA-5 | Simulation Engine as Coalgebra Evaluator | Pending (in `plans/enriquecimiento-categorico.md`) |
| DA-6 | OPL Engine as Bidirectional Lens | Pending (in `plans/enriquecimiento-categorico.md`) |

## Key Domain Concepts

- **OPM (Object Process Methodology):** ISO 19450 standard for systems modeling using Things (objects/processes), Links, States, and OPDs (Object Process Diagrams).
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
- **Tests:** `bunx vitest run` (desde raiz del proyecto)
- **Type check:** `cd packages/core && bunx tsc --noEmit`
- **Monorepo:** Bun workspaces (root `package.json`)
- **Pattern:** Immutable Model — funciones puras retornan `Result<Model, InvariantError>`, Maps para O(1) lookups

## Session Continuity

Always read the latest `sessions/YYYY-MM-DD-*-handoff.md` to understand current state, artifacts produced, and recommended next steps. The handoff documents capture all decisions and pending work.

## Do Not Modify

- Files in external KORA repo paths (`knowledge/fxsl/opm-methodology/`, `agents/fxsl/*`) — these are read-only references.
- Original backlog files (`opcloud-backlog-refactorizado.md`) — preserved by user request.
