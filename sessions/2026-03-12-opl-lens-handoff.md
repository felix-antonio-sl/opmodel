# Handoff: OPL Lens Bidireccional (Sub-proyecto A, L-M2-01)

**Fecha:** 2026-03-12
**Estado:** Completado y mergeado a `master`

---

## Artefactos producidos

| Artefacto | Path |
|-----------|------|
| Design spec | `docs/superpowers/specs/2026-03-12-opl-lens-bidireccional-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-03-12-opl-lens-bidireccional.md` |
| OPL types | `packages/core/src/opl-types.ts` (91 líneas) |
| OPL lens module | `packages/core/src/opl.ts` (383 líneas) |
| Core tests | `packages/core/tests/opl.test.ts` (508 líneas, 37 tests) |
| CLI command | `packages/cli/src/commands/opl.ts` (27 líneas) |
| CLI tests | `packages/cli/tests/opl.test.ts` (80 líneas, 5 tests) |

**Total:** +1113 líneas, 42 tests nuevos, 325 tests totales.

---

## Qué se implementó

### DA-6: OPL Engine como Lens Bidireccional

```
expose      : (Model, OpdId) → OplDocument       # get
applyOplEdit: (Model, OplEdit) → Result<Model>   # put
render      : (OplDocument) → string              # serialize
editsFrom   : (OplDocument) → OplEdit[]           # reconstruct (test helper)
oplSlug     : (string) → string                   # ID generation
```

### Tipos exportados

- `OplDocument` — AST tipado con `renderSettings` embebidos
- `OplSentence` — Unión discriminada: `thing-declaration | state-enumeration | duration | link | modifier`
- `OplEdit` — 8 edits estructurados: `add-thing | remove-thing | add-states | remove-state | add-link | remove-link | add-modifier | remove-modifier`
- `OplRenderSettings` — Controles de visibilidad (essence, units, alias)

### Leyes categóricas verificadas

- **PutGet** (5 tests): `expose(applyOplEdit(m, edit)) ⊇ sentenceFor(edit)`
- **GetPut** (2 tests): `expose(applyOplEdit(m, editsFrom(expose(m)))) ≅ expose(m)` (igualdad estructural)

### CLI: `opmod opl`

```
opmod opl <file>                # OPL del SD (OPD raíz)
opmod opl <file> --opd <opdId>  # OPL de un OPD específico
opmod opl <file> --json         # Output como OplDocument JSON
```

---

## Decisiones de implementación

| Decisión | Justificación |
|----------|---------------|
| `renderSettings` embebido en `OplDocument` | Desviación documentada del spec: permite `render(doc)` sin parámetro extra de settings |
| Link IDs usan `oplSlug(name)` no `oplSlug(id)` | IDs más limpios (`lnk-water-agent-boiling` vs `lnk-obj-water-agent-proc-boiling`); `uniqueId` garantiza unicidad |
| `editsFrom` dos pasadas | Primera pasada: thing-declarations en Map; segunda: enriquece con duration. Orden de emisión: things → states → links → modifiers |
| `opl` CLI usa `<file>` posicional | Spec lo define así (comando read-only, diferente de CRUD commands que usan `--file`) |

---

## Mejoras futuras identificadas (no bloqueantes)

- `collectAllIds` en loop `add-states` es O(N×M) — optimizable con Set incremental
- No hay tests para los 14 tipos de link en `render` — solo 3 cubiertos (consumption, effect, aggregation)
- `when_applicable` en `opl_units_visibility` se trata igual que `always`
- `as ComputationalObject` cast necesario por limitación de narrowing de TypeScript con `in`

---

## Próximos pasos recomendados

1. **Integrar en web editor**: Reemplazar `packages/web/src/lib/opl.ts` por `import { expose, render } from "@opmodel/core"`
2. **Sub-proyecto B (L-M2-01)**: Parser NL → OPL vía LLM (usa `applyOplEdit` como backend)
3. **Extender edits**: `modify-thing`, `modify-link` cuando se necesiten (extensión incremental)
