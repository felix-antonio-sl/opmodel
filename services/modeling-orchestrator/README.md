# modeling-orchestrator

Minimal Python service for the new `opmodel` direction:

- **LLM-mediated modeling orchestration**
- **LangGraph** as stateful runtime
- **Deep Agents** as agent harness layer
- **SSOT-first** guardrails against `/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-ssot`

## Non-negotiable rule

This service does **not** own OPM semantics.

Normative precedence:

1. `opm-iso-19450.md`
2. `opm-opl-es.md`
3. `metodologia-modelamiento-opm.md`

LLMs may propose drafts, patches, refinements, and render intents.
The semantic authority remains in the SSOT corpus and in `opmodel` core validators.

## Current scope

This first slice only scaffolds:

- service contracts
- SSOT loader
- LangGraph topology
- task routing for:
  - `wizard-generate`
  - `opl-import`
  - `incremental-change`
- placeholder Deep Agent builder hooks
- FastAPI surface

It does **not** yet:

- call real model providers
- mutate `SemanticKernel`
- validate through the TypeScript core
- persist memory
- run subagents in production

## Suggested dev run

```bash
cd services/modeling-orchestrator
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn modeling_orchestrator.main:app --reload
```

## Endpoints

### Health

```bash
GET /health
```

### Run one modeling task

```bash
POST /v1/modeling-tasks/run
```

Example payload:

```json
{
  "task": {
    "kind": "opl-import",
    "oplText": "Coffee Making is a process, physical.",
    "source": "imported-opl"
  }
}
```

## Service shape

```text
input
  -> router
  -> worker node by task kind
  -> ssot guardrail node
  -> outcome
```

## Why separate service

This keeps `opmodel` lean:

- TS core stays semantic and deterministic
- web stays the primary operator surface
- orchestration, agent runtime, memory, and experiment pressure stay isolated
