# Baseline — Estado del repo al momento de la decisión OPL-first

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Commit | c827959 |
| Tests | 1,066 (75 archivos, 14,510 líneas) |
| Código | 35,878 líneas TS/TSX |
| Build | ✅ test · ✅ web:build · ✅ typecheck:core |

## Packages

| Package | Líneas | Responsabilidad |
|---------|--------|-----------------|
| `@opmodel/core` | 6,612 | Motor semántico, OPL, simulación, validación |
| `@opmodel/web` | 10,126 | Editor visual React + SVG |
| _(tooling retirado)_ | — | El paquete histórico de comando fue retirado del repo vivo y queda solo como legado archivado. |
| `@opmodel/nl` | 637 | Pipeline NL→JSON→OplEdit vía LLM |

## Core: archivos principales

| Archivo | Líneas | Qué hace |
|---------|--------|----------|
| `types.ts` | 273 | Modelo completo (Thing, State, Link, OPD, Appearance, Modifier, Fan, Scenario, Assertion, Requirement, Stereotype, SubModel) |
| `api.ts` | 2,091 | CRUD con 50 invariantes, 121 puntos de error |
| `opl.ts` | 1,461 | expose/render/renderAll/applyOplEdit/editsFrom, bilingüe EN/ES |
| `opl-types.ts` | 212 | AST: 13 tipos de sentencia + 8 tipos de OplEdit |
| `simulation.ts` | 1,640 | resolveOpdFiber (DA-9), simulación, Monte Carlo |
| `methodology.ts` | 232 | 20 checks SD/SD1/global |
| `serialization.ts` | 201 | loadModel/saveModel (.opmodel JSON) |
| `structural.ts` | 134 | Structural link utilities |

## Web: archivos principales

| Archivo | Líneas | Qué hace |
|---------|--------|----------|
| `OpdCanvas.tsx` | 1,503 | SVG canvas, consume resolveOpdFiber() |
| `canvas/*` | 888 | ThingNode, LinkLine, SvgDefs (14 link types ISO) |
| `spatial-layout.ts` | 786 | 6 estrategias de layout |
| `auto-layout.ts` | 434 | Layout from scratch |
| `commands.ts` | 465 | Command pattern para mutaciones |
| `PropertiesPanel.tsx` | 1,198 | Panel de propiedades |
| `App.tsx` | 929 | Shell principal |
| `OplEditorView.tsx` | 536 | Editor por formularios + NL |

## Flujo actual del dato

```
.opmodel JSON → loadModel() → Model → expose(model, opdId) → OplDocument → render() → OPL text
```

Para mutaciones:

```
UI/tooling → Command → api.addThing/addLink/... → Model mutado
OplEditorView → OplEdit → applyOplEdit() → Model mutado
```

La fuente de verdad es el Model (grafo `.opmodel`). El OPL es derivado.

## Invariantes implementados

50 códigos distintos en api.ts. Los principales:

- `I-01` a `I-34` — ISO core
- `I-STATELESS-*` — Stateless constraints
- `I-CONTOUR-RESTRICT` — Consumption/result en outer contour
- `I-GERUND`, `I-SINGULAR`, `I-TRANSFORMEE` — Methodology
- `DANGLING_*`, `INCONSISTENT_*` — Referential integrity

## AST de sentencias OPL

13 tipos en `opl-types.ts`:

```
thing-declaration    state-enumeration    state-description
duration             attribute-value      link
grouped-structural   modifier             fan
in-zoom-sequence     requirement          assertion
scenario
```

8 tipos de OplEdit:

```
add-thing    remove-thing    add-states    remove-state
add-link     remove-link     add-modifier  remove-modifier
```

## Fixtures

| Fixture | Things | Links | OPDs |
|---------|--------|-------|------|
| Coffee Making | 10 | 12 | 2 |
| Driver Rescuing | 14 | 12 | 2 |
| HODOM | 48 | 82 | 6 |
| HODOM V2 | ~30 | ~40 | 2 |
| HODOM HSC v0 | 36 | 53 | 2 |
| EV-AMS | 49 | 54 | 6 |
| Hospitalización Domiciliaria | ~50 | ~80 | ~16 |

Todos con visual grade A.
