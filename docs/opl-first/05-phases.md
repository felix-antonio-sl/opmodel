# Implementation Phases — OPL-First Migration

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Estado | Propuesta |

## Fase 0 — Definir gramática OPL de entrada

**Objetivo**: Formalizar qué OPL se acepta como input.

**Entregables**:
- `opl-grammar.md` con gramática por tipo de sentencia
- Ambigüedades resueltas
- Constructos no expresables en OPL
- Decisión de idioma (EN, ES, ambos)
- Decisión de organización (por OPD vs global)

**Método**: Tomar output de `render()` sobre las 7 fixtures como referencia.

**Dependencia**: Decisiones abiertas (ver abajo).

## Fase 1 — Parser OPL → OplDocument

**Objetivo**: Convertir OPL textual en AST de sentencias.

**Entregables**:
- Parser que produce `OplDocument` con spans
- Diagnósticos sintácticos con línea/columna
- Recovery parcial de errores
- Golden tests con las 7 fixtures

**Golden test**:
```
fixture.opmodel → renderAll() → OPL → parse() → render() → igual
```

## Fase 2 — Compiler OplDocument → Model

**Objetivo**: Construir `Model` completo desde `OplDocument`.

**Entregables**:
- Name resolution (texto → IDs)
- Creación de things, states, links, modifiers, fans
- Creación de OPDs desde sentencias de refinement
- Auto-generation de appearances (layout engine)
- Source map: sentencia → entidad

## Fase 3 — Validación con source locations

**Objetivo**: Conectar invariantes a posiciones en OPL.

**Entregables**:
- Cada error incluye línea/sentencia OPL
- Validación en fases: V1 syntax, V2 binding, V3 semantic, V4 canonical
- `opmod validate` con posiciones

## Fase 4 — Integración visual

**Objetivo**: Visual render desde modelo compilado por OPL.

**Entregables**:
- Flujo OPL → visual completo
- Source mapping bidireccional (click OPL ↔ visual)
- Layout cache entre re-compilaciones

## Fase 5 — Editor textual OPL en web

**Objetivo**: Superficie principal centrada en OPL.

**Entregables**:
- Editor de texto como panel principal
- Validación inline
- Re-compile on save
- Visual preview derivado

---

## Decisiones abiertas

Cerrar antes de Fase 0.

### 1. Layout

| Opción | Descripción |
|--------|-------------|
| A | OPL sin layout. Auto-layout siempre. Cache separado. |
| B | OPL con hints opcionales (pragmas/comentarios). |
| C | `.opmodel` persiste layout, OPL manda sobre semántica. |

### 2. Constructos expresables en OPL

`render()` produce: things, states, links, modifiers, fans, requirements, assertions, scenarios, refinement, durations, attribute values.

No expresable hoy: appearances, settings, meta, stereotypes, subModels.

### 3. OPL por OPD o global

`renderAll()` produce secciones `=== SD ===`, `=== SD1 ===`.
¿Input igual? ¿O flat con refinement sentences?

### 4. Idioma

EN y ES soportados. ¿Parser acepta ambos? ¿Se fija por modelo?
