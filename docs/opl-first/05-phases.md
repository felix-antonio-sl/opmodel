# Implementation Phases — OPL-First Migration

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Estado | **Fase 1 completada** |

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

## Fase 1 — Parser OPL → OplDocument ✅ COMPLETADA

**Objetivo**: Convertir OPL textual en AST de sentencias.

**Entregables**:
- ✅ Parser que produce `OplDocument` con spans
- ✅ Diagnósticos sintácticos con línea/columna
- ✅ Recovery parcial de errores (issues estructurados)
- ✅ Bilingüe EN/ES con auto-detección de locale
- ✅ 100% coverage en 6 fixtures reales

**Resultado de evaluación**:

| Fixture | Líneas | Oraciones | Headers | Edges | Sin match |
|---------|--------|-----------|---------|-------|-----------|
| coffee-making | 48 | 45 | 2 | 1 | **0** |
| driver-rescuing | 50 | 47 | 2 | 1 | **0** |
| hodom-v2 | 102 | 99 | 2 | 1 | **0** |
| hodom-hsc-v0 | 180 | 177 | 2 | 1 | **0** |
| ev-ams | 225 | 214 | 6 | 5 | **0** |
| hospitalizacion-domiciliaria | 282 | 271 | 6 | 5 | **0** |

**Constructos parseados** (24 tipos + refinement edges):
Thing declarations, state enumerations, state descriptions, durations (simple + range), agent/instrument/consumption/result/effect/invocation links, tagged links, aggregation, exhibition, classification, generalization, fan XOR/OR, event modifiers, condition modifiers, in-zoom sequences, attribute-values, requirements, assertions, scenarios, refinement edges.

**Commits**: `7fc8073`, `78c3ae7`, `6927e03`, `8ff6021`, `dea0aba`, `cf5ac08`

**Tests**: 76 files, 1085 tests, todo verde.

## Fase 2 — Compiler OplDocument → Model 🚧 EN CURSO

**Objetivo**: Construir `Model` completo desde `OplDocument`.

**Estado actual (slice 2.2)**:
- ✅ `compileOplDocument()` y `compileOplDocuments()` creados
- ✅ Name resolution base para things simples y compuestos (`Feature of Exhibitor`)
- ✅ Compilación del subset actual:
  - thing declarations
  - state enumerations
  - state descriptions
  - durations
  - attribute-values
  - grouped structural: `aggregation`, `exhibition`, `generalization`, `classification`
  - procedural links: `agent`, `instrument`, `consumption`, `result`, `effect`, `invocation`
  - modifiers: `event`, `condition` (resueltos semánticamente sobre links compilados)
  - fans: `xor`, `or`, `and` converging/diverging (crea links implícitos si no existen)
  - requirements: target resolution to thing, req_id preserved
  - assertions: category normalization, optional target
  - scenarios: path_labels validation against link path_labels
  - tagged structural links
  - self-invocation ("invokes itself")
  - in-zoom sequences: creates implicit invocation links between sequential subprocesses
  - exception links: overtime/undertime parsed and compiled as invocation with exception_type
  - path labels: "Following path" / "Por ruta" prefix parsed and preserved on links
  - unfolding sentences: thing-level "unfolds in OPD into ..." parsed, no invocation links (spatial)
  - multiplicity cardinalities: an optional (?), optional (*), at least one (+) on structural links
  - OPD skeleton + refinement edges
- ✅ Resolución de estados para links state-specified
- ✅ Exhibition links inferidos para features compuestas
- ✅ Appearances mínimas generadas por OPD
- ✅ Tests nuevos de compiler

**Pendiente en Fase 2**:
- Source map fino sentencia → entidad
- Auto-layout real / placement más inteligente
- Roundtrip validation OPL → parse → compile → render → OPL' contra fixtures reales

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
