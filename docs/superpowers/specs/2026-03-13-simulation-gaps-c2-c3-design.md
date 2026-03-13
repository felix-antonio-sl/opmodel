# Gaps Bloqueantes para Simulación: Stateful/Stateless (C3) + Skip/Wait (C2) — Design Spec

**Fecha:** 2026-03-13
**Estado:** Aprobado
**Autor:** fxsl/arquitecto-categorico

---

## Resumen

Resolver los dos gaps ISO 19450 bloqueantes para simulación correcta:

- **C3 (§3.66, §3.67):** Clasificación de objetos como stateful vs stateless. Objetos stateless no pueden tener estados ni ser afectados por effect links.
- **C2 (§8.2.3):** Semántica skip vs wait en condition links. Si la condición es falsa: skip salta el proceso, wait lo bloquea hasta que se cumpla.

Ambos cambios son Pre-P1 en el roadmap de compliance ISO.

---

## Justificación categórica

### C3: Stateful como clasificador fibrado del 0-cell

En la bicategoría OPM:
- Things son 0-cells
- States son subobjetos: monos en el reticulado Sub(O)
- Un objeto stateless tiene Sub(O) = ∅ por definición

`Thing.stateful` es un **clasificador fibrado** sobre la categoría discreta `{stateful, stateless}`. No es un derivado de `|Sub(O)|` porque su rol es *prescriptivo* (prevenir adición de estados), no *descriptivo* (observar si existen). El clasificador permite enforcement a priori en `addState` y `addLink`.

### C2: condition_mode como enrichment del 2-cell

En la bicategoría OPM:
- Links son 1-cells (morfismos entre Things)
- Modifiers son 2-cells (transformaciones naturales sobre Links)

El coproducto de Modifier se factoriza como:
```
Modifier = Event(over, negated)
         | Condition(over, negated, mode: skip | wait)
```

`condition_mode` es propiedad intrínseca del 2-cell, no del 1-cell, porque:
1. El Link existe independientemente del Modifier
2. Un Link puede tener múltiples Modifiers — el modo pertenece al Modifier específico
3. Aplanar a `ModifierType = "event" | "condition-skip" | "condition-wait"` pierde la estructura de producto `type × mode`

### Alternativas descartadas

| Alternativa | Razón de descarte |
|---|---|
| `stateful` derivado de `|Sub(O)| > 0` | No puede prevenir adición de estados. Solo describe, no prescribe |
| `condition_mode` en Link | Viola separación 1-cell/2-cell. ¿Cuál mode si hay múltiples modifiers? |
| `ModifierType = "condition-skip" \| "condition-wait"` | Pierde factorización `type × mode`. Explota combinatoria con `negated` |

---

## Cambios en tipos

### Thing

```typescript
export interface Thing {
  // ... campos existentes ...
  stateful?: boolean; // ISO 19450 §3.66/§3.67. undefined ≡ true (backwards-compatible)
}
```

**Semántica:** `undefined` o `true` = stateful (puede tener estados, puede ser afectado). `false` = stateless (solo consumible/producible).

**Backwards-compatibility:** Todos los modelos existentes no tienen este campo → se tratan como stateful por defecto. Zero migration.

### Modifier

```typescript
export interface Modifier {
  id: string;
  over: string;
  type: ModifierType;
  negated?: boolean;
  condition_mode?: "skip" | "wait"; // Solo cuando type === "condition". Default: "wait" (ISO §8.2.3)
}
```

**Default:** `"wait"` per ISO §8.2.3. Modifiers existentes sin `condition_mode` se interpretan como wait.

### PreconditionResult (simulation.ts)

```typescript
export type PreconditionResult =
  | { satisfied: true }
  | { satisfied: false; reason: string; response: "lost" | "skip" | "wait" }
```

Donde:
- `"lost"` — Event modifier: evento descartado irrecuperablemente (semántica actual)
- `"skip"` — Condition(skip): proceso se salta, simulación continúa por paths alternativos
- `"wait"` — Condition(wait): proceso se bloquea, re-evaluar en siguiente step

---

## Invariantes nuevos

### I-STATELESS-STATES
**Guard:** `addState` + `validate`
**Regla:** Si `thing.stateful === false`, no se pueden agregar estados.
```
∀ state ∈ States: thing(state.parent).stateful ≠ false
```
**Error:** `"Stateless objects cannot have states (ISO §3.67)"`

### I-STATELESS-EFFECT
**Guard:** `addLink` + `validate`
**Regla:** Si el target de un effect link es un objeto stateless, rechazar. También rechazar links con `source_state` o `target_state` cuando el objeto referido es stateless (un objeto stateless no puede tener estados, por lo tanto state-specified links son contradictorios).
```
∀ link ∈ Links: link.type = "effect" ⟹ thing(link.target).stateful ≠ false
∀ link ∈ Links: link.source_state ≠ undefined ⟹ thing(stateParent(link.source_state)).stateful ≠ false
∀ link ∈ Links: link.target_state ≠ undefined ⟹ thing(stateParent(link.target_state)).stateful ≠ false
```
**Error:** `"Stateless objects cannot be affected — use consumption or result links"` (effect) o `"State-specified links cannot reference stateless objects"` (source_state/target_state)

**Nota:** Los links `input` con `source_state` hacia un stateless object son atrapados por la regla de state-specification, no necesitan guard adicional por tipo.

### I-CONDITION-MODE
**Guard:** `addModifier` + `validate`
**Regla:** `condition_mode` solo es válido cuando `type === "condition"`.
```
∀ mod ∈ Modifiers: mod.condition_mode ≠ undefined ⟹ mod.type = "condition"
```
**Error:** `"condition_mode is only valid on condition modifiers"`

### I-STATELESS-DOWNGRADE
**Guard:** `updateThing` (eager guard, no pasivo via validate)
**Regla:** No se puede marcar como stateless un objeto que tiene estados existentes.
```
∀ thing ∈ Things: thing.stateful = false ⟹ |{s ∈ States : s.parent = thing.id}| = 0
```
**Error:** `"Remove all states before marking as stateless"`

**Implementación:** Guard explícito en `updateThing`, keyed en `cleaned.stateful === false`, consistente con el patrón reject-not-cascade del codebase:
```typescript
if (cleaned.stateful === false) {
  const hasStates = [...model.states.values()].some(s => s.parent === id);
  if (hasStates) {
    return err({ code: "I-STATELESS-DOWNGRADE", message: "Remove all states before marking as stateless", entity: id });
  }
}
```

---

## Cambios en simulación (DA-5)

### evaluatePrecondition

Actualmente retorna binario. Nuevo comportamiento:

1. El filtro de links ya obtiene ambas direcciones: `l.target === processId || l.source === processId`
2. Para transforming links (consumption/effect), `link.source === processId` matchea y `link.target` es el objeto (convención: source=process, target=object). Para enabling links (agent/instrument), `link.target === processId` matchea y `link.source` es el objeto. Esta lógica direccional ya está correcta en el código actual.
3. Para cada link con precondición fallida, buscar modifier via `model.modifiers` donde `mod.over === link.id`:
   - Si el link tiene modifier `type: "event"` → `response: "lost"`
   - Si el link tiene modifier `type: "condition"`, `condition_mode: "skip"` → `response: "skip"`
   - Si el link tiene modifier `type: "condition"`, `condition_mode: "wait"` o undefined → `response: "wait"`
   - Si el link no tiene modifier → `response: "lost"` (default: no retry)

### simulationStep

Nuevo handling basado en `response`:
- `"lost"`: evento descartado, `skipped: true` (comportamiento actual)
- `"skip"`: proceso saltado, `skipped: true`, la simulación continúa evaluando otros procesos
- `"wait"`: proceso bloqueado, NO se descarta, se agrega a cola de espera para re-evaluación

### ModelState extension

```typescript
export interface ModelState {
  objects: Map<string, ObjectState>;
  step: number;
  timestamp: number;
  waitingProcesses: Set<string>; // Procesos bloqueados por condition(wait)
}
```

**Inmutabilidad:** `simulationStep` debe hacer deep-copy del Set en cada paso para mantener el design invariant de structural sharing:
```typescript
newState: {
  ...state,
  objects: new Map(state.objects),
  waitingProcesses: new Set(state.waitingProcesses),
  step: state.step + 1,
}
```

### runSimulation

El loop de simulación ahora:
1. Evalúa procesos en cola de espera primero (re-check precondiciones)
2. Si un waiting process ahora satisface precondición → ejecutar y remover de waitingProcesses
3. Luego evalúa procesos normales
4. Termina cuando:
   - No hay más procesos ejecutables NI esperando (completed: true), o
   - Se alcanza maxSteps (completed: false), o
   - **Deadlock**: `waitingProcesses.size > 0` pero ningún proceso ejecutó en el step actual Y ningún estado cambió — la simulación está bloqueada (completed: false, deadlocked: true)

### SimulationTrace extension

```typescript
export interface SimulationTrace {
  steps: SimulationStep[];
  finalState: ModelState;
  completed: boolean;
  deadlocked: boolean; // true si terminó por deadlock de condition(wait)
}
```

---

## Cambios en OPL (DA-6)

### Modifier rendering

| Modifier | mode | state-specified | OPL output |
|----------|------|-----------------|------------|
| condition | wait (default) | no | `"Process requires Object"` |
| condition | wait | yes | `"Process requires State Object"` |
| condition | skip | no | `"Process occurs if Object exists, otherwise Process is skipped"` |
| condition | skip | yes | `"Process occurs if Object is State, otherwise Process is skipped"` |
| condition+negated | wait | yes | `"Process requires Object not to be State"` |
| condition+negated | skip | yes | `"Process occurs if Object is not State, otherwise Process is skipped"` |
| event | — | no | `"Object triggers Process"` |
| event | — | yes | `"State Object triggers Process"` |
| event+negated | — | yes | `"non-State Object triggers Process"` |

### expose (opl.ts) — propagación de conditionMode y state names

La función `expose` debe poblar los campos nuevos de `OplModifierSentence` al construir el documento OPL:

```typescript
// En el bloque que construye OplModifierSentence dentro de expose:
const link = model.links.get(mod.over);
const sourceState = link?.source_state ? model.states.get(link.source_state) : undefined;
const targetState = link?.target_state ? model.states.get(link.target_state) : undefined;

{
  kind: "modifier",
  modifierId: mod.id,
  linkId: mod.over,
  // ... campos existentes ...
  conditionMode: mod.type === "condition" ? (mod.condition_mode ?? "wait") : undefined,
  sourceStateName: sourceState?.name,
  targetStateName: targetState?.name,
}
```

Sin esto, `renderModifierSentence` no puede generar las formas state-specified de la tabla, y `editsFrom` no puede reconstruir `condition_mode` para el round-trip GetPut.

### OplModifierSentence extension

```typescript
export interface OplModifierSentence {
  kind: "modifier";
  modifierId: string;
  linkId: string;
  linkType: LinkType;
  sourceName: string;
  targetName: string;
  modifierType: ModifierType;
  negated: boolean;
  conditionMode?: "skip" | "wait";       // Nuevo: modo de la condición
  sourceStateName?: string;              // Nuevo: nombre del estado fuente (para rendering state-specified)
  targetStateName?: string;              // Nuevo: nombre del estado target (para rendering state-specified)
}
```

---

## Cambios en API

### addState
Agregar guard antes de insertar:
```typescript
if (thing.stateful === false) {
  return err({ code: "I-STATELESS-STATES", message: "..." });
}
```

### addLink
Agregar guards para las 3 reglas de I-STATELESS-EFFECT:
```typescript
// Regla 1: effect links no pueden apuntar a stateless objects
if (link.type === "effect") {
  const target = model.things.get(link.target);
  if (target?.stateful === false) {
    return err({ code: "I-STATELESS-EFFECT", message: "Stateless objects cannot be affected — use consumption or result links" });
  }
}
// Reglas 2 y 3: state-specified links no pueden referenciar stateless objects
if (link.source_state) {
  const sourceState = model.states.get(link.source_state);
  if (sourceState) {
    const parent = model.things.get(sourceState.parent);
    if (parent?.stateful === false) {
      return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects" });
    }
  }
}
if (link.target_state) {
  const targetState = model.states.get(link.target_state);
  if (targetState) {
    const parent = model.things.get(targetState.parent);
    if (parent?.stateful === false) {
      return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects" });
    }
  }
}
```

### addModifier
Agregar guard para condition_mode:
```typescript
if (modifier.condition_mode && modifier.type !== "condition") {
  return err({ code: "I-CONDITION-MODE", message: "..." });
}
```

### updateThing
Guard eager (no pasivo): si el patch cambia `stateful` a `false`, verificar que no existan estados antes de aplicar el cambio (ver I-STATELESS-DOWNGRADE arriba para implementación).

### updateModifier
Guard eager para I-CONDITION-MODE: si el patch merged resulta en `type !== "condition"` con `condition_mode` definido, rechazar. Esto previene que un `updateModifier({ type: "event" })` sobre un modifier existente con `condition_mode: "skip"` cree estado inválido:
```typescript
const merged = { ...existing, ...cleanPatch(patch) };
if (merged.condition_mode && merged.type !== "condition") {
  return err({ code: "I-CONDITION-MODE", message: "condition_mode is only valid on condition modifiers", entity: id });
}
```

### validate
Agregar los 4 invariantes a la función global de validación.

### editsFrom (opl.ts)
La reconstrucción de modifiers en `editsFrom` debe propagar `condition_mode` al edit `add-modifier` para mantener la ley GetPut del lens:
```typescript
case "modifier":
  modifierEdits.push({
    kind: "add-modifier",
    modifier: {
      over: s.linkId,
      type: s.modifierType,
      negated: s.negated,
      ...(s.conditionMode ? { condition_mode: s.conditionMode } : {}),
    },
  });
```
Sin esto, un round-trip `expose → editsFrom → applyOplEdit` perdería `condition_mode`, rompiendo GetPut.

---

## Cambios en serialización

### JSON Schema (opm-json-schema.json)

1. `Thing.$defs`: agregar `"stateful": { "type": "boolean" }` en properties opcionales
2. `Modifier.$defs`: agregar `"condition_mode": { "enum": ["skip", "wait"] }` en properties opcionales
3. Agregar `if/then` en Modifier: `condition_mode` solo cuando `type === "condition"`

### serialize/deserialize (serialization.ts)

Sin cambios — ambos campos son opcionales y el serializer ya maneja campos opcionales por omisión de nulls (§7.2 conv. 4).

---

## Archivos involucrados

| Archivo | Acción | Cambios |
|---------|--------|---------|
| `packages/core/src/types.ts` | Modificar | `Thing.stateful?`, `Modifier.condition_mode?` |
| `packages/core/src/api.ts` | Modificar | Guards en addState, addLink, addModifier, updateThing, updateModifier + validate |
| `packages/core/src/simulation.ts` | Modificar | PreconditionResult.response, waitingProcesses, evaluatePrecondition, simulationStep, runSimulation |
| `packages/core/src/opl.ts` | Modificar | renderModifierSentence con condition_mode |
| `packages/core/src/opl-types.ts` | Modificar | OplModifierSentence.conditionMode? |
| `packages/core/src/index.ts` | Sin cambio | Exports ya cubren los tipos |
| `packages/core/tests/` | Crear/Modificar | Tests para invariantes + simulación + OPL |
| `docs/superpowers/specs/2026-03-10-opm-json-schema.json` | Modificar | Thing.stateful, Modifier.condition_mode |

---

## Tests requeridos

### Invariantes (api-invariants-new.test.ts o nuevo archivo)
1. I-STATELESS-STATES: addState a stateless object → error
2. I-STATELESS-STATES: addState a stateful object → ok
3. I-STATELESS-STATES: addState a objeto sin campo stateful (undefined) → ok
4. I-STATELESS-EFFECT: addLink(effect) a stateless object → error
5. I-STATELESS-EFFECT: addLink(consumption) a stateless object → ok
6. I-STATELESS-EFFECT: addLink(result) a stateless object → ok
7. I-STATELESS-EFFECT: addLink(input, source_state referencia stateless object) → error
8. I-STATELESS-EFFECT: addLink(effect, target_state referencia stateless object) → error
9. I-STATELESS-DOWNGRADE: updateThing(stateful=false) con estados → error
10. I-STATELESS-DOWNGRADE: updateThing(stateful=false) sin estados → ok
11. I-CONDITION-MODE: addModifier(condition_mode="skip", type="event") → error
12. I-CONDITION-MODE: addModifier(condition_mode="skip", type="condition") → ok
13. validate detecta stateless object con estados pre-existentes
14. validate detecta condition_mode en event modifier

### Simulación (simulation.test.ts)
15. evaluatePrecondition con condition(wait) fallida → response: "wait"
16. evaluatePrecondition con condition(skip) fallida → response: "skip"
17. evaluatePrecondition con event fallida → response: "lost"
18. evaluatePrecondition sin modifier → response: "lost"
19. simulationStep con response "wait" → proceso en waitingProcesses
20. simulationStep con response "skip" → proceso skipped
21. runSimulation re-evalúa waiting processes cuando estado cambia

### Simulación — deadlock (simulation.test.ts)
22. runSimulation con condition(wait) nunca satisfecha → deadlocked: true
23. runSimulation con condition(wait) satisfecha tras state change → proceso ejecuta

### OPL (opl.test.ts)
24. render condition(wait) → "Process requires Object"
25. render condition(skip) → "Process occurs if Object exists, otherwise Process is skipped"
26. render condition(wait)+negated
27. render condition(skip)+negated
28. render event+state-specified → "State Object triggers Process"

### OPL lens law (opl.test.ts)
29. GetPut round-trip con condition(skip) modifier preserva condition_mode
