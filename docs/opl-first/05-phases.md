# Implementation Phases — OPL-First Migration

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Estado | **Fases 1-3 completadas, Fase 4-5 parcial** |

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
Thing declarations, state enumerations, state descriptions, durations (simple + range), agent/instrument/consumption/result/effect/invocation links, tagged links, exception links (overtime/undertime), aggregation, exhibition, classification, generalization, fan XOR/OR/AND, event modifiers, condition modifiers, in-zoom sequences, unfolding sentences, attribute-values, requirements, assertions, scenarios, path labels, refinement edges, multiplicity cardinalities.

**Commits**: `7fc8073`, `78c3ae7`, `6927e03`, `8ff6021`, `dea0aba`, `cf5ac08`

## Fase 2 — Compiler OplDocument → Model ✅ COMPLETADA

**Objetivo**: Construir `Model` completo desde `OplDocument`.

**Resultado**:
- ✅ `compileOplDocument()` y `compileOplDocuments()` creados
- ✅ Name resolution base para things simples y compuestos (`Feature of Exhibitor`)
- ✅ Compilación completa:
  - thing declarations
  - state enumerations
  - state descriptions
  - durations
  - attribute-values
  - grouped structural: `aggregation`, `exhibition`, `generalization`, `classification`
  - procedural links: `agent`, `instrument`, `consumption`, `result`, `effect`, `invocation`
  - tagged structural links
  - self-invocation ("invokes itself")
  - modifiers: `event`, `condition` (resueltos semánticamente sobre links compilados)
  - fans: `xor`, `or`, `and` converging/diverging (crea links implícitos si no existen)
  - requirements: target resolution to thing, req_id preserved
  - assertions: category normalization, optional target
  - scenarios: path_labels validation against link path_labels
  - in-zoom sequences: creates implicit invocation links between sequential subprocesses
  - exception links: overtime/undertime parsed and compiled
  - path labels: "Following path" / "Por ruta" prefix parsed and preserved on links
  - unfolding sentences: thing-level "unfolds in OPD into ..." parsed, no invocation links (spatial)
  - multiplicity cardinalities: an optional (?), optional (*), at least one (+) on structural links
  - OPD skeleton + refinement edges
- ✅ Resolución de estados para links state-specified
- ✅ Exhibition links inferidos para features compuestas
- ✅ Appearances mínimas generadas por OPD
- ✅ Roundtrip validation: OPL → parse → compile → expose → render → OPL' contra 6 fixtures reales

**Commits**: `9cd87d1`, `3826a3d`, `3911d89`, `27e10d6`, `e712bef`, `a98de03`, `99ce315`, `4f94f64`, `0dd9243`, `105689d`

## Fase 3 — Validación con source locations ✅ COMPLETADA

**Objetivo**: Conectar invariantes a posiciones en OPL.

**Entregables**:
- ✅ Pipeline unificado `validateOpl(text)` en `packages/core/src/opl-validate.ts`
- ✅ 4 fases de validación: V1-syntax, V2-binding, V3-semantic, V4-canonical
- ✅ Reverse source mapping: entity IDs del modelo → posiciones OPL
- ✅ Cada error incluye línea/columna del OPL original
- ✅ Warnings de canonical style (capitalización, gerundios)
- ✅ Tests: valid input, syntax fail, binding fail, semantic fail, canonical warnings, multi-OPD

**API**: `validateOpl(text) → ValidationResult { ok, issues[], phases }`

**Commit**: `f0d3178`

## Fase 4 — Integración visual ⏳ Parcial

**Objetivo**: Visual render desde modelo compilado por OPL.

**Entregables**:
- ✅ Flujo OPL → visual completo (parse → compile → model → render funciona)
- ✅ Layout preservation al recompilar OPL (`preserveLayoutPositions`)
- ✅ Bidirectional link highlighting (OPL panel ↔ canvas)
- ⬜ Source mapping bidireccional click-to-navigate (click línea OPL → cosa visual, click cosa → línea OPL)
- ⬜ Layout cache explícito entre re-compilaciones

## Fase 5 — Editor textual OPL en web ⏳ Parcial

**Objetivo**: Superficie principal centrada en OPL.

**Entregables**:
- ✅ Live OPL editor tab con Ctrl+S apply + inline validation (`OplEditorView`)
- ✅ OPL text import panel con live validation (`OplImportPanel`)
- ✅ Bidirectional OPL panel con entity highlighting + export (`OplPanel`)
- ⬜ Editor OPL como superficie principal (no solo tab secundario)
- ⬜ Visual preview derivado que se actualiza en tiempo real

---

## Decisiones abiertas

Cerrar antes de Fase 4.

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

---

## Estadísticas del proyecto (2026-04-06)

| Métrica | Valor |
|---------|-------|
| Archivos de test | 80 |
| Tests totales | 1127 |
| Tests pasando | 1127 |
| Tests fallando | 0 |
| Constructos OPM parseados | 24 tipos + refinement edges |
| Constructos OPM compilados | Todos |
| Fixtures roundtrip | 6/6 |
| Fases completadas | 1, 2, 3 |
| Fases en progreso | 4 (parcial), 5 (parcial) |
