# docs — documentación de OPModel

Tres carpetas. Cada una con un rol específico. Todo lo demás está en `archive/`.

## Estructura

```
docs/
  ssot/              ← regla de subordinación a kora SSOT
  opl-first/         ← ADRs vinculantes + plan vigente
  archive/           ← histórico (no normativo)
```

## Fuente normativa

La **verdadera fuente de verdad de OPM** es externa al repo:

```
kora/KNOWLEDGE/fxsl/opm/opm-ssot-es/
```

4 capas con URN canónicas:

- `urn:fxsl:kb:opm-es` — núcleo conceptual (ISO 19450 adaptado)
- `urn:fxsl:kb:opl-es` — gramática OPL-ES + EBNF
- `urn:fxsl:kb:opd-es` — gramática visual OPD (123 reglas V-*)
- `urn:fxsl:kb:manual-metodologico-opm-es` — procedimientos

Ante cualquier conflicto entre código/docs del repo y la SSOT, **gana la SSOT**. Este repositorio es implementación subordinada.

Ver [`ssot/README.md`](./ssot/README.md) para la regla completa.

## Línea activa de trabajo

Rescate JointJS (tramos T0-T4) sobre branch `feat/jointjs-integration`. Estado vigente en [`opl-first/HANDOFF-2026-04-16.md`](./opl-first/HANDOFF-2026-04-16.md).

ADRs vinculantes viven en [`opl-first/`](./opl-first/README.md):

- **ADR-003** — Arquitectura categorial del isomorfismo (`OPL/~ ≅ SemanticKernel ≅ Atlas/~`)
- **ADR-008** — JointJS como renderer adapter determinista

## Enriquecimiento reverso

Aprendizajes del repo que ameritan volver a la SSOT se registran en [`ssot/candidate-extensions.md`](./ssot/candidate-extensions.md). Son candidatos para PR contra kora.

## Archivo

[`archive/`](./archive/) contiene:

- `opl-first-historico/` — 16 docs superseded de la línea opl-first (narrativa del giro OPL-first, ADRs consolidados, planes ejecutados)
- `superpowers-historico/` — 24 design-docs de features ya implementadas (feb-mar 2026)
- `sessions/` — 30 session-handoffs previos
- `analysis/`, `audits/`, `plans/`, `specs/` — trabajo de investigación histórico
- `triad/` — contratos triádicos y arqueología técnica del rescate inicial
- `bugs/` — bugs visuales del renderer deprecado
- `misc/` — spec bug-capture, mirrors de metodología que ya viven en kora

Todo el archive es **consultable pero no normativo**. Para decisiones vigentes, mirar solo `opl-first/` + `ssot/`.

## Fuentes de fixtures

Material OPM textual del que derivan los fixtures `.opmodel` del repo vive en [`../tests/fixtures-source/`](../tests/fixtures-source/).
