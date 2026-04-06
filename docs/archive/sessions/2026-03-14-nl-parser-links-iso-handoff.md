# Handoff: NL→OPL Parser + Links ISO Compliance

**Fecha:** 2026-03-14
**Sesion:** af338813-ba40-43c6-88b2-f01e21799dd0
**Branch:** master (15 commits ahead of origin/master)

---

## Resumen Ejecutivo

Dos sub-proyectos completados en esta sesion:

1. **Sub-proyecto B (L-M2-03): NL→OPL Parser** — Nuevo paquete `@opmodel/nl` con pipeline completo NL→OPL via LLM, integrado al web editor
2. **Auditoria Links ISO 19450** — 7 gaps cerrados (2 criticos + 5 importantes), 6 invariantes nuevos/corregidos

---

## 1. Sub-proyecto B: @opmodel/nl

### Artefactos producidos

| Artefacto | Ubicacion |
|-----------|-----------|
| Design spec | `docs/superpowers/specs/2026-03-13-nl-to-opl-parser-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-03-13-nl-to-opl-parser.md` |
| Package source | `packages/nl/src/` (7 files) |
| Package tests | `packages/nl/tests/` (4 files, 52 tests) |
| Web integration | `packages/web/src/components/OplEditorView.tsx`, `NlSettingsModal.tsx`, `App.tsx` |

### Arquitectura del pipeline

```
NL (texto) →[LLM]→ raw string →[parse]→ NlEditDescriptor[] →[resolve]→ OplEdit[] →[applyOplEdit*]→ Model
```

- **parse.ts**: Extraccion JSON (markdown fences/bare array/raw) + validacion de 8 NlEditDescriptor kinds
- **resolve.ts**: Counit ε de Free ⊣ Forget — mapea names→IDs con modelo acumulado (fold secuencial)
- **prompt.ts**: 3 builders (system, context con OPD fiber filter, user)
- **provider.ts**: ClaudeProvider + OpenAIProvider (fetch-based, noUncheckedIndexedAccess-safe)
- **pipeline.ts**: Composicion completa con input validation + preview via render(expose())
- **index.ts**: Re-exports tipos + modulos

### Web integration

- NL textarea sobre el form estructurado en OplEditorView (condicional: solo si nlPipeline prop presente)
- NlSettingsModal: provider selector, API key (password input con prefix validation), modelo opcional
- Pipeline wired en Editor via useMemo, config persistida en localStorage
- Boton ⚙ en header para settings

### Commits (8 + 1 fix)

```
ffabf65 feat(nl): scaffold @opmodel/nl package with types
25770d9 feat(nl): add parse module with JSON extraction and validation (TDD)
b44c07a feat(nl): add resolve module for name-to-ID resolution (TDD)
ad35263 feat(nl): add prompt module with system/context/user message builders (TDD)
d377d17 feat(nl): add provider and pipeline modules with mocked LLM tests (TDD)
78d2303 feat(web): extend OplEditorView with NL textarea, preview, and apply-all
6ef7f86 feat(web): add NlSettingsModal and wire NL pipeline in App.tsx
65a0a32 fix(nl): correct OPD and State type signatures in test files
```

---

## 2. Auditoria Links ISO 19450

### Gaps cerrados

| ID | Nombre | Tipo | Invariante |
|----|--------|------|------------|
| C7 | I-27 Exhibition perseverance bug | CRITICAL | I-27 eliminado |
| C8 | Procedural endpoint type validation | CRITICAL | I-33 agregado |
| I15 | Enabling link uniqueness | IMPORTANT | I-16-EXT |
| I16 | Structural guards in addLink | IMPORTANT | I-22..I-26 en addLink |
| I17 | State-specified validation in addLink | IMPORTANT | I-28 en addLink + fix validate |
| I18 | Self-loop prevention | IMPORTANT | I-34 agregado |
| I5-ext | Exception overtime/undertime | IMPORTANT | Link.exception_type field |

### Decisiones de diseno

- **I-33 bidireccional**: Valida object↔process sin imponer direccion (codebase usa source=process para transforming links, diferente de ISO). Migracion a direccion estricta ISO es plan separado.
- **I-28 fix**: validate() tenia logica inconsistente con addLink() para source_state parent. Corregido a "object endpoint" en ambos.
- **I-27 eliminado**: ISO §7.2.2 exime exhibition de la regla de perseverancia.

### Commits (7 + 1 docs)

```
8f6bd38 feat(core): add Link.exception_type for overtime/undertime (ISO §9.5.4)
aeacaa9 fix(core): remove I-27 exhibition perseverance check
3fcd28d feat(core): add I-33 procedural link endpoint type validation
9309755 feat(core): add I-34 self-loop prevention except invocation
97857ff feat(core): add I-16-EXT enabling uniqueness and I-22..I-26 guards
eace64f feat(core): add I-28 state-specified validation + fix validate()
e958a84 docs: update ISO gap analysis with C7, C8, C2, C3 status
e6dc79d docs: add links ISO compliance design spec and plan
```

---

## 3. Estado final

| Metrica | Valor |
|---------|-------|
| Tests totales | **492** (36 test files) |
| Paquetes | 4 (core, cli, nl, web) |
| Commits ahead of origin | 15 |
| Invariantes totales | ~43 (37 existentes + I-33, I-34, I-16-EXT, I-28-addLink, -I-27, +exception_type) |
| ISO compliance estimado | ~75% |

### Gaps criticos restantes (4)

| ID | Nombre | Prioridad |
|----|--------|-----------|
| C1 | Operation Definitions & Invocation | P2 |
| C4 | Aggregation Whole-Part Ratio | P1-P2 |
| C5 | Discriminating Attribute Exhaustivity | P1 |
| C6 | Fact Consistency in Refinement | P2 |

---

## 4. Proximos pasos recomendados

1. `git push` — 15 commits pendientes
2. Tests web — componentes OplEditorView, NlSettingsModal sin unit tests
3. Gap C5 — I-32 existe pero sin enforcement UI
4. Simulacion UI — trace display ya existe; falta interactividad
5. Direccion estricta ISO para links — migracion opcional (separate plan)
