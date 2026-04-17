# TICKET: Remove non-ISO "input" and "output" link types

**ID**: TECH-DEBT-01
**Prioridad**: P1 (correctness)
**Tipo**: Data model inconsistency
**Fecha**: 2026-03-18

---

## Problema

ISO 19450 define exactamente **5 tipos de procedural links**:

| Categoría | Tipos ISO | Referencia |
|-----------|-----------|------------|
| Transforming | consumption, result, effect | §9.1 |
| Enabling | agent, instrument | §9.2 |
| Control | invocation, exception | §9.5.4, §8.5 |

**"input" y "output" NO son tipos de link independientes en ISO.** Son los dos segmentos de un **effect link state-specified** (§9.3.3.1):

> *"An input source link shall be the link from a specified state of an object to the transforming process, while the output destination link shall be the link from the transforming process to a specified state of an object."*

Es decir:
- `input link` = la mitad source→process de un effect link con `source_state` especificado
- `output link` = la mitad process→target de un effect link con `target_state` especificado

Nuestro `transformingMode()` functor (DA-8) ya modela esto correctamente a nivel visual:
- `effect` con `source_state` → modo `input-specified`
- `effect` con `target_state` → modo `output-specified`
- `effect` con ambos → modo `input-output`

Pero el data model (`LinkType` en `types.ts`) y el UI (`Toolbar.tsx`) exponen "input" y "output" como tipos separados, lo cual es **no-ISO**.

## Impacto actual

### Archivos afectados

| Archivo | Uso de "input"/"output" |
|---------|------------------------|
| `packages/core/src/types.ts:14` | `LinkType` union incluye `"input"` y `"output"` |
| `packages/core/src/api.ts:215,1317,1474` | Validación de procedural links los incluye |
| `packages/core/src/opl.ts:374-375` | `renderLinkSentence` tiene cases para "input"/"output" |
| `packages/web/src/components/Toolbar.tsx:10-11` | Dropdown los muestra como opciones |
| `packages/web/src/components/OpdCanvas.tsx:552-555` | Canvas los routea |
| `packages/web/src/components/PropertiesPanel.tsx:7` | Properties panel los lista |
| `packages/web/src/components/OplEditorView.tsx:57` | OPL editor los lista |

### Clasificación incorrecta en UI

El dropdown clasifica:
- `Input` como "Enabling" — **incorrecto**, un input link es mitad de un effect (transforming)
- `Output` como "Transforming" — **parcialmente correcto** en aislamiento, pero no debería existir como tipo

## Propuesta de resolución

### Opción A: Eliminación completa (recomendada)

1. **Remover** `"input"` y `"output"` de `LinkType`
2. **Remover** opciones del Toolbar dropdown
3. **Migrar** cualquier link existente con `type: "input"` → `type: "effect"` + `source_state`
4. **Migrar** cualquier link existente con `type: "output"` → `type: "effect"` + `target_state`
5. **Remover** cases de rendering en `opl.ts`, `OpdCanvas.tsx`
6. **Agregar** migration function en `serialization.ts` para fixtures existentes

**Pro**: Correct-by-construction, elimina la confusión.
**Con**: Breaking change para modelos que usen estos tipos. Requiere migration.

### Opción B: Deprecar y mapear internamente

1. **Mantener** en `LinkType` pero marcar como deprecated
2. **Remover** del Toolbar (no se pueden crear nuevos)
3. **Mapear** internamente a effect + state en `expose()` y `simulation.ts`
4. **Migrar** gradualmente en fixtures

**Pro**: Non-breaking, gradual.
**Con**: Complejidad adicional, dos representaciones del mismo concepto.

## Verificación

### Fixtures actuales con "input"/"output"

```bash
grep -r '"input"\|"output"' tests/*.opmodel
```

Si ningún fixture usa estos tipos, la Opción A es limpia y sin migración.

### Tests que referencian "input"/"output"

- `opl.ts:374-375` — renderLinkSentence cases
- `api.ts:215,1317` — listas de procedural link types para validación
- `api.ts:1474` — filtro de transforming links

## Dependencias

- DA-8 (`transformingMode` functor) ya maneja la semántica correcta
- No depende de ningún otro ticket
- Puede hacerse independientemente del resto de la deuda técnica

## Criterio de aceptación

- [ ] `LinkType` no incluye `"input"` ni `"output"`
- [ ] Toolbar dropdown no ofrece estas opciones
- [ ] Effect links con source_state/target_state cubren todos los casos que antes requerían input/output
- [ ] Todos los tests pasan (608+)
- [ ] Fixtures existentes migrados si aplica
- [ ] OPL rendering preservado (effect state-specified produce las mismas sentences)
