# Target Architecture — OPL-First Pipeline

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Estado | Propuesta |

## Pipeline

```
OPL text
    ↓ parse()
OplDocument + spans
    ↓ compile()
Model (IR — mismo tipo que hoy)
    ↓ validate()
errors + source locations
    ↓ si válido
    ├── visual render
    ├── simulation
    ├── export (.opmodel / md / SVG / PNG)
    └── render() → OPL canónico (round-trip)
```

## Ciclo de modificación

```
editar OPL → re-parse → re-compile → re-validate → re-render
```

## Módulos nuevos

| Módulo | Descripción |
|--------|-------------|
| `opl-grammar.md` | Gramática formal del OPL de entrada |
| `opl-parser` | OPL text → OplDocument con spans |
| `opl-compiler` | OplDocument → Model completo |
| `opl-source-map` | Mapping sentencia → entidad para diagnósticos |
| Editor textual | Textarea/CodeMirror con validación inline |

## Módulos que se reusan sin cambio

| Módulo | Uso |
|--------|-----|
| `types.ts` (Model) | IR target |
| `api.ts` invariantes | V3 validation |
| `render()` EN/ES | Canonical formatter + round-trip |
| `simulation.ts` | Downstream |
| `methodology.ts` | Checks |
| `OpdCanvas` + canvas/ | Visual render |
| `spatial-layout.ts` | Auto-layout |
| `auto-layout.ts` | From-scratch layout |
| `visual-lint.ts` | Auditoría visual |
| Fixtures | Golden tests |

## Módulos que se extienden

| Módulo | Extensión |
|--------|-----------|
| `opl-types.ts` | Spans en AST |
| `validate()` | Source locations |
| Tooling / automation | Entrypoints scriptables sobre core/compiler, sin paquete de comandos dedicado |
| `App.tsx` | Modo OPL-first |

## Baja de prioridad

| Módulo | Razón |
|--------|-------|
| `@opmodel/nl` | Input es OPL, no NL |
| `OplEditorView` forms | Se reemplaza por editor textual |
| `SdWizard` | Puede evolucionar a generar OPL |

## Persistencia

- **Autoría**: OPL text
- **Persistencia rica**: `.opmodel` JSON (incluye layout, settings)
- **Relación**: `.opmodel` se genera desde OPL compilado + layout cache

El OPL no incluye posiciones ni estilos visuales.

## Round-trip guarantee

```
fixture.opmodel → renderAll() → OPL → parse() → compile() → renderAll() → igual
```

Los 7 fixtures existentes sirven como golden tests.

## Dependencias entre módulos

```
                    ┌──────────────┐
                    │  OPL text    │  ← autoría
                    └──────┬───────┘
                           │ parse()
                    ┌──────▼───────┐
                    │ OplDocument  │  AST + spans
                    └──────┬───────┘
                           │ compile()
                    ┌──────▼───────┐
                    │    Model     │  IR semántica
                    └──────┬───────┘
                           │ validate()
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Visual       Simulation     Export
