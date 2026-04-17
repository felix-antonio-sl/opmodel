# Reuse Map — Qué se reusa, qué cambia, qué se crea

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |

## Se reusa sin cambio

| Componente | Líneas | Razón |
|-----------|--------|-------|
| `core/src/types.ts` | 273 | IR target del compiler |
| `core/src/model.ts` | 36 | Factory de modelo vacío |
| `core/src/result.ts` | 24 | ok/err pattern |
| `core/src/helpers.ts` | 48 | Utilities |
| `core/src/structural.ts` | 134 | Structural link utils |
| `core/src/history.ts` | 30 | Undo/redo |
| `core/src/compound-states.ts` | 52 | Cartesian state space |
| `core/src/export-md.ts` | 100 | Markdown export |
| `core/src/simulation.ts` | 1,640 | Fiber, simulación, Monte Carlo |
| `core/src/methodology.ts` | 232 | 20 checks SD/SD1/global |
| `core/src/serialization.ts` | 201 | .opmodel load/save |
| `core/src/opl.ts` render portion | ~550 | Canonical formatter |
| `core/src/opl.ts` vocabulary | ~100 | EN/ES bilingual |
| `web/src/components/OpdCanvas.tsx` | 1,503 | SVG rendering |
| `web/src/components/canvas/*` | 888 | Shapes, links, markers |
| `web/src/lib/spatial-layout.ts` | 786 | 6 layout strategies |
| `web/src/lib/auto-layout.ts` | 434 | From-scratch positioning |
| `web/src/lib/edge-router.ts` | 250 | Bézier curves |
| `web/src/lib/visual-lint.ts` | 280 | Quality scoring |
| `web/src/lib/visual-report.ts` | 157 | Model-level report |
| `web/src/lib/visual-rules.ts` | 105 | ISO constants |
| `web/src/lib/geometry.ts` | 69 | Math utils |
| `tests/*.opmodel` (7 fixtures) | — | Golden tests |
| All existing 1,066 tests | 14,510 | Regression safety |

**Total reusable: ~22,000+ líneas**

## Se extiende

| Componente | Cambio |
|-----------|--------|
| `core/src/opl-types.ts` | Agregar spans (line, col, offset) |
| `core/src/api.ts` validate() | Source locations en errors |
| `cli/src/cli.ts` | Comandos: parse, compile, fmt |
| `web/src/App.tsx` | Modo OPL-first |
| `core/src/opl.ts` expose() | Ajustes para round-trip si necesario |

## Se crea nuevo

| Componente | Estimación | Descripción |
|-----------|-----------|-------------|
| `opl-grammar.md` | doc | Gramática formal |
| `opl-parser.ts` | ~800-1200 líneas | Lexer + parser → OplDocument con spans |
| `opl-compiler.ts` | ~600-1000 líneas | OplDocument → Model completo |
| `opl-source-map.ts` | ~200-400 líneas | Sentencia → entidad, para diagnósticos |
| Editor textual OPL | ~500-800 líneas | Textarea con validación inline |

## Baja de prioridad

| Componente | Razón |
|-----------|-------|
| `nl/src/*` | Input es OPL, no NL |
| `OplEditorView.tsx` | Se reemplaza por editor textual |
| `SdWizard.tsx` | Puede evolucionar a generar OPL |
| `NlSettingsModal.tsx` | Dependía del NL pipeline |
