# Gap Analysis — Baseline vs OPL-First Target

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |

## Resumen

| Capa | Reusable | Gap |
|------|----------|-----|
| Model / IR semántica | ✅ | Layout mezclado con semántica |
| 50 invariantes | ✅ | Sin source locations |
| OPL AST (13 sentence types) | ✅ parcial | Sin spans, diseñado para output |
| OPL render EN/ES | ✅ | Sirve como canonical formatter |
| **OPL parser** | ❌ no existe | **Crítico** |
| **OPL → Model compiler** | ❌ no existe | **Crítico** |
| **Gramática OPL formal** | ❌ no existe | **Crítico** |
| Visual rendering | ✅ | — |
| Layout engine | ✅ | — |
| Simulation | ✅ | — |
| Methodology checks | ✅ | — |
| Fixtures / 1,066 tests | ✅ golden tests | — |
| Editor textual OPL | ❌ no existe | Medio |
| Source mapping OPL → entidades | ❌ no existe | Alto |

## Gaps críticos

### GAP-1: No existe parser de OPL textual

No hay lexer, parser, tokenizer ni grammar en el repo.
`editsFrom(doc)` opera sobre `OplDocument` ya estructurado, no sobre texto.
`@opmodel/nl` parsea JSON de LLM, no OPL.

**Sin esto no hay OPL-first.**

### GAP-2: No existe compiler OPL → Model

Hoy: `Model → OplDocument → text`. Falta el inverso: `text → OplDocument → Model`.

`editsFrom()` es útil pero incompleto:
- no crea OPDs ni appearances
- no maneja refinement hierarchy
- no resuelve nombres desde texto
- ignora: in-zoom-sequence, attribute-value, fan, requirement, assertion, scenario

### GAP-3: No hay gramática formal del OPL como lenguaje de entrada

El OPL existe implícitamente como lo que `render()` produce.
No hay especificación de qué se acepta, qué variantes son válidas, ni cómo resolver ambigüedades.

## Gaps altos

### GAP-4: Layout mezclado con semántica

`Model` incluye tanto semántica (things, states, links) como visual (appearances con x, y, w, h).
Para OPL-first, el layout debería ser derivado o persistido aparte.

### GAP-5: Sin source mapping OPL → entidades

Si OPL es la superficie de trabajo, errores deben apuntar a líneas del OPL, no a IDs internos.

## Gaps medios

### GAP-6: `editsFrom()` incompleto como reverse compiler

Genera edits para things, states, links, modifiers. Ignora el resto. No crea OPDs ni appearances.

### GAP-7: Sin editor textual OPL

`OplEditorView` es formulario. `OplTextView` es read-only.

## No es gap (se reusa directamente)

- Model type como IR
- 50 invariantes
- `render()` bilingüe como canonical formatter
- Todo el visual rendering
- `resolveOpdFiber()`
- Simulation engine
- Methodology checks
- Serialization `.opmodel`
- CLI (se extiende)
- Fixtures como golden tests
