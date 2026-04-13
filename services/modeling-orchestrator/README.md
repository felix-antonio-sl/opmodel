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
- real `refine-process` bridge into the core refinement slice
  - `refineMainProcess`
  - `validateRefinedModel`
- real `render` bridge into the core render slice
  - `semanticKernelFromModel`
  - `kernelToVisualRenderSpec`
  - `verifyVisualRenderSpec`
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

Current proposal shapes:

`incremental-change` returns:

- `summary`
- `rationale`
- `operations`
- `confidence`
- `ssotChecksExpected`
- `requiresHumanReview`

`refine-process` returns:

- `summary`
- `rationale`
- `refinementKind`
- `confidence`
- `ssotChecksExpected`
- `requiresHumanReview`
- `draft`
- `childOpdId`
- `mainProcessId`

Current `incremental-change` operation kinds:

- `add-enabler`
- `add-transforming-link`
- `add-state-transition`
- `rename-thing`
- `refine-process`
- `manual-review`

This is intentionally proposal-only. Application back into the kernel remains a later step.

When a valid `modelSnapshot` or `currentOpl` base is available, the bridge also produces a deterministic, non-persistent preview for supported operations (`add-enabler`, `add-transforming-link`, `add-state-transition`, `rename-thing`). That preview is returned as artifact `outputs.modelJson` and `outputs.canonicalOpl`, while the proposal remains the authoritative result.

The incremental preview surface is now hardened in `contracts.py` with explicit submodels for preview context and outputs (`IncrementalPreviewContext`, `IncrementalPreviewOutputs`), even though the outer artifact envelope remains uniform across task kinds.

## `refine-process` current behavior

`refine-process` now also crosses the Python/TypeScript boundary for real:

```text
FastAPI -> LangGraph worker -> bun bridge -> @opmodel/core
                                 -> loadModel or compile current OPL
                                 -> refineMainProcess
                                 -> validateRefinedModel
                                 -> renderAllFromSemanticKernel
```

The worker returns a structured artifact with:

- refinement proposal draft (`subprocesses`, `internalObjects`)
- methodology validation report
- canonical OPL for the refined kernel
- serialized legacy model JSON snapshot
- explicit review flag when the model context is weak or methodology reports issues

## `render` current behavior

`render` now crosses the Python/TypeScript boundary for real:

```text
FastAPI -> LangGraph worker -> bun bridge -> @opmodel/core
                                 -> semanticKernelFromModel
                                 -> kernelToVisualRenderSpec
                                 -> verifyVisualRenderSpec
```

The worker returns a structured artifact with:

- generated or verified `VisualRenderSpec`
- verification report
- canonical OPL carried into the render artifact
- explicit review flag when the render spec fails core verification

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

## Common artifact payload shape

All current worker artifacts now converge on the same top-level payload envelope.
This envelope is now modeled explicitly in `contracts.py` via `ArtifactProposal` and `ArtifactPayload`.

The payload shape is:

- `ok`
- `proposal`
- `context`
- `outputs`
- optional `error`
- optional `agent`
- optional `inputs`

This keeps proposal-only orchestration consistent across import, generation, refinement, incremental change, and render, while still allowing each task to expose task-specific details inside `proposal/context/outputs`.

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
