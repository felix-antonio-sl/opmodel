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
- real `opl-import` bridge into `@opmodel/core`
  - `parseOplDocuments`
  - `compileToKernel`
  - `exposeSemanticKernel`
- real `wizard-generate` bridge into `@opmodel/core`
  - `validateSdDraft`
  - `buildArtifactsFromSdDraft`
  - `renderAllFromSemanticKernel`
- stable `incremental-change` bridge for `KernelPatchProposal`
  - request classification
  - current OPL context parsing through `compileToKernel`
  - structured proposal with confidence and expected SSOT checks
- placeholder Deep Agent builder hooks
- FastAPI surface

It does **not** yet:

- call real model providers
- mutate `SemanticKernel`
- apply kernel patches back into the core
- persist memory
- run subagents in production
- guarantee perfect NL understanding for arbitrary incremental requests

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

## `wizard-generate` current behavior

`wizard-generate` now crosses the boundary into the real generator slice:

```text
FastAPI -> LangGraph worker -> bun bridge -> @opmodel/core
                                 -> validateSdDraft
                                 -> buildArtifactsFromSdDraft
                                 -> SemanticKernel
                                 -> canonical OPL
```

The worker returns a structured artifact with:

- normalized `SdDraft`
- draft validation report
- SemanticKernel stats
- canonical OPL
- serialized model JSON snapshot

It still does not call a live model provider. The LLM-facing part remains proposal-time only.

## `incremental-change` current behavior

`incremental-change` now returns a stable `KernelPatchProposal` shape instead of a placeholder.

```text
FastAPI -> LangGraph worker -> bun bridge
                          -> request classification
                          -> optional current OPL parse/compile
                          -> structured patch proposal
```

Current proposal shape:

- `summary`
- `rationale`
- `operations`
- `confidence`
- `ssotChecksExpected`
- `requiresHumanReview`

Current operation kinds:

- `add-enabler`
- `add-transforming-link`
- `add-state-transition`
- `rename-thing`
- `refine-process`
- `manual-review`

This is intentionally proposal-only. Application back into the kernel remains a later step.

## `opl-import` current behavior

`opl-import` now crosses the Python/TypeScript boundary for real:

```text
FastAPI -> LangGraph worker -> bun bridge -> @opmodel/core
                                 -> parseOplDocuments
                                 -> compileToKernel
                                 -> exposeSemanticKernel
```

The worker returns a structured artifact with:

- normalized OPL
- validation result
- parsed OPD summary
- SemanticKernel stats
- canonical OPL re-render
- serialized legacy model JSON snapshot

This is still a proposal surface, not an authoritative mutation path.

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
