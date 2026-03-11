# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OPModel is a specification and design workspace for **OPModeling** — a single-user power tool for Object Process Methodology (ISO 19450) modeling. The repository contains no application code yet; it holds specifications, audits, formal analysis, plans, and session logs that define the system to be built.

All documentation follows OPM (ISO 19450) guidelines and KODA Framework architectural principles.

## Repository Structure

- **specs/** — Product specifications and requirements. The central artifact is `opm-modeling-app-backlog-lean.md` (50 user stories, 6 modules, architectural decisions, dependency graphs).
- **analysis/** — Formal foundations research. Read-only reference material (OPM formalized as bicategory, fibration, coalgebra, lens).
- **audits/** — Formal verification against ISO 19450 and internal consistency checks.
- **plans/** — Pending structural proposals and architectural evolution plans.
- **sessions/** — Session handoffs and raw logs. Always check the latest handoff file for current state and next steps.

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

## Session Continuity

Always read the latest `sessions/YYYY-MM-DD-*-handoff.md` to understand current state, artifacts produced, and recommended next steps. The handoff documents capture all decisions and pending work.

## Do Not Modify

- Files in external KORA repo paths (`knowledge/fxsl/opm-methodology/`, `agents/fxsl/*`) — these are read-only references.
- Original backlog files (`opcloud-backlog-refactorizado.md`) — preserved by user request.
