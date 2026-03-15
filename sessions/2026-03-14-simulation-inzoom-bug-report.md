# Bug Report: Simulation Engine In-Zoom Link Distribution

**Fecha:** 2026-03-14
**Reportado por:** Sesión af338813 (NL Parser + Links ISO)
**Dirigido a:** Sesión c8326d5b (Simulation In-Zoom)
**Severidad:** CRITICAL — simulación produce resultados incorrectos
**Reproducción:** Cargar Coffee Making fixture, ejecutar simulación manual

---

## 1. Síntoma observable

Al simular el modelo Coffee Making:
- Coffee Beans se consume ✅
- Water cambia de cold a hot ✅
- **Coffee nunca pasa a "ready"** ❌ — permanece en estado "unmade"

El usuario espera que al completar Coffee Making, el café esté listo.

---

## 2. Root Causes (3 bugs independientes)

### Bug A: `runSimulation` descarta eventos dirigidos a procesos in-zoomed

**Ubicación:** `packages/core/src/simulation.ts`, `runSimulation()` ~línea 400+

**Problema:** `getExecutableProcesses()` expande `proc-coffee-making` en sus subprocesos leaf (Grinding, Boiling, Brewing). Cuando el usuario envía `{ kind: "manual", targetId: "proc-coffee-making" }`, `runSimulation` busca `proc-coffee-making` en la lista de ejecutables — no lo encuentra — y **descarta el evento silenciosamente** (0 pasos ejecutados).

**Evidencia:**
```
Executable processes: [proc-grinding, proc-boiling, proc-brewing]
runSimulation({ targetId: "proc-coffee-making" }) → 0 steps
```

**Impacto:** Ningún proceso se ejecuta. La simulación no avanza.

---

### Bug B: Links del proceso padre quedan huérfanos durante in-zoom execution

**Ubicación:** `packages/core/src/simulation.ts`, `simulationStep()` ~línea 333

**Problema:** Cuando se ejecutan subprocesos (Grinding, Boiling, Brewing), `simulationStep` solo procesa links directamente conectados a ese subproceso. Los links conectados al proceso padre (`proc-coffee-making`) **nunca se procesan**:

```
Links on proc-coffee-making (PADRE):
  lnk-barista-agent-coffee-making     [agent]       — HUÉRFANO
  lnk-coffee-making-consumption-beans [consumption]  — HUÉRFANO
  lnk-coffee-making-effect-water      [effect]       — HUÉRFANO
  lnk-coffee-making-result-coffee     [result]       — HUÉRFANO

Links on subprocesses (EJECUTADOS):
  proc-grinding:  consumption(beans), result(ground-coffee)  ← ESTOS sí se procesan
  proc-boiling:   effect(water cold→hot)                     ← ESTE sí se procesa
  proc-brewing:   consumption(ground-coffee), result(coffee) ← ESTOS sí se procesan
```

**Consecuencia:** El modelo tiene links DUPLICADOS — tanto en el padre como en los subprocesos. Los del padre son redundantes y nunca ejecutados. Pero si un link SOLO existe en el padre (sin duplicado en un subproceso), su efecto se pierde completamente.

**Relación con ISO §10.5.2:** La ISO define **distribution semantics** — un link en el contorno de un proceso in-zoomed se distribuye a cada subproceso. Las reglas son:

| Link type | Distribución ISO | Estado actual |
|-----------|-----------------|---------------|
| agent, instrument | Se distribuye a todos los subprocesos | ✅ La fixture tiene duplicados manuales |
| effect | Se distribuye a todos los subprocesos | ⚠️ Solo en Boiling, no en todos |
| consumption | **NO se distribuye** — va al primer subproceso | ⚠️ En Grinding + padre (redundante) |
| result | **NO se distribuye** — va al último subproceso | ⚠️ En Brewing + padre (redundante) |

---

### Bug C: Result link sin `target_state` — Coffee no transiciona a "ready"

**Ubicación:** `tests/coffee-making.opmodel`, link `lnk-brewing-yields-coffee`

**Problema:** El result link que produce Coffee no especifica `target_state`:

```json
{"id": "lnk-brewing-yields-coffee", "source": "proc-brewing", "target": "obj-coffee", "type": "result"}
```

El engine de simulación (`simulationStep` línea ~366):
```typescript
if (link.target_state) {
  obj.currentState = link.target_state;
}
```

Sin `target_state`, el estado NO cambia. Coffee ya existe con estado "unmade" (estado inicial), y el result link solo confirma `exists: true` sin transicionar a "ready".

**Fix directo:** Agregar `"target_state": "state-coffee-ready"` al result link.

---

## 3. Reproducción paso a paso

```typescript
// 1. Cargar modelo
const m = loadModel(readFileSync('tests/coffee-making.opmodel'));

// 2. Verificar ejecutables
getExecutableProcesses(m);
// → [proc-grinding, proc-boiling, proc-brewing] (NO proc-coffee-making)

// 3. Intentar simular Coffee Making
runSimulation(m, init, [{ kind: 'manual', targetId: 'proc-coffee-making', timestamp: 1 }]);
// → 0 pasos (evento descartado)

// 4. Simular subprocesos manualmente en secuencia
simulationStep(m, state, { kind: 'manual', targetId: 'proc-grinding', ... });
// → consume Coffee Beans, produce Ground Coffee ✅
simulationStep(m, state, { kind: 'manual', targetId: 'proc-boiling', ... });
// → Water cold→hot ✅
simulationStep(m, state, { kind: 'manual', targetId: 'proc-brewing', ... });
// → consume Ground Coffee, produce Coffee ✅ (pero sin target_state)
// → Coffee.currentState sigue siendo "unmade" ❌
```

---

## 4. Análisis categórico

El in-zoom es un **functor de refinement** ρ: C_parent → C_child que descompone un 1-cell (proceso) en una cadena de 1-cells (subprocesos). Los links del proceso padre son **2-cells** que deben ser pushforward via ρ:

```
ρ_*(link_parent) = distribución sobre C_child
```

Actualmente, el pushforward ρ_* no está implementado. Los links del padre existen en C_parent pero no se mapean a C_child. El simulation engine opera SOLO en C_child (ejecuta subprocesos), pero los links son fibrados sobre C_parent — hay un **fiber mismatch**.

La ISO resuelve esto con reglas de distribución explícitas (§10.5.2):
- Agent/instrument/effect: distribución universal (∀ subproceso)
- Consumption/result: distribución restringida (primer/último subproceso)

---

## 5. Propuesta de solución (intuición)

### Opción A: Event delegation (fix rápido)

Cuando `runSimulation` recibe un evento dirigido a un proceso in-zoomed:
1. Detectar que `proc-coffee-making` tiene in-zoom OPD
2. Expandir a subprocesos vía `getExecutableProcesses()`
3. Ejecutar subprocesos en secuencia (por Y-order)
4. Después del último subproceso, procesar links del proceso padre que NO tienen duplicados en subprocesos

```typescript
// En runSimulation:
if (isInZoomed(processId)) {
  const subs = getExecutableProcesses(model).filter(p => p.parentProcessId === processId);
  for (const sub of subs) {
    // ejecutar sub
  }
  // procesar links huérfanos del padre (result, etc.)
}
```

**Pros:** Mínimo cambio, resuelve Bug A y parcialmente Bug B.
**Contras:** No implementa distribución ISO formal; los links duplicados siguen siendo manuales.

### Opción B: Link distribution engine (fix correcto)

Implementar ρ_* como un paso de preprocessing:

```typescript
function distributeLinks(model: Model, parentId: string, childOpd: OPD): DistributedLink[] {
  const parentLinks = getLinksForProcess(model, parentId);
  const subprocesses = getSubprocesses(model, childOpd); // sorted by Y

  return parentLinks.flatMap(link => {
    switch (link.type) {
      case "agent": case "instrument":
        // Distribute to ALL subprocesses
        return subprocesses.map(sp => ({ ...link, processId: sp.id }));
      case "effect":
        // Distribute to ALL (object persists)
        return subprocesses.map(sp => ({ ...link, processId: sp.id }));
      case "consumption":
        // First subprocess ONLY (ISO §10.5.2)
        return [{ ...link, processId: subprocesses[0].id }];
      case "result":
        // Last subprocess ONLY (ISO §10.5.2)
        return [{ ...link, processId: subprocesses[subprocesses.length - 1].id }];
    }
  });
}
```

Luego, `simulationStep` usaría los distributed links en vez de los links directos del modelo.

**Pros:** ISO-correct, elimina necesidad de duplicar links manualmente en la fixture.
**Contras:** Más complejo, requiere decidir si las distributed links son virtuales (computadas) o persistidas.

### Opción C: Hybrid — parent completion step

Después de ejecutar todos los subprocesos de un in-zoom, agregar un **completion step** que procesa los links del proceso padre:

```typescript
// Cuando el último subproceso completa:
if (isLastSubprocess(processId, parentProcessId)) {
  processParentLinks(model, state, parentProcessId);
}
```

**Pros:** Simple, no requiere distribution engine.
**Contras:** Los links del padre se ejecutan "al final" en vez de distribuidos por subproceso.

### Recomendación

**Corto plazo:** Opción C (parent completion step) + fix Bug C (agregar `target_state` al fixture).
**Mediano plazo:** Opción B (link distribution engine) para compliance ISO §10.5.2 completo.

---

## 6. Fix inmediato para la fixture (Bug C)

Independiente de la solución del engine, el fixture tiene un bug de datos:

```diff
- {"id": "lnk-brewing-yields-coffee", "source": "proc-brewing", "target": "obj-coffee", "type": "result"}
+ {"id": "lnk-brewing-yields-coffee", "source": "proc-brewing", "target": "obj-coffee", "target_state": "state-coffee-ready", "type": "result"}

- {"id": "lnk-coffee-making-result-coffee", "source": "proc-coffee-making", "target": "obj-coffee", "type": "result"}
+ {"id": "lnk-coffee-making-result-coffee", "source": "proc-coffee-making", "target": "obj-coffee", "target_state": "state-coffee-ready", "type": "result"}
```

---

## 7. Archivos afectados

| Archivo | Bug | Cambio necesario |
|---------|-----|-----------------|
| `packages/core/src/simulation.ts` | A, B | Event delegation o distribution engine |
| `tests/coffee-making.opmodel` | C | Agregar target_state a result links |
| `packages/web/public/coffee-making.opmodel` | C | Sync con fixture principal |
| `packages/core/tests/simulation.test.ts` | A, B | Tests para in-zoom event delegation |

---

## 8. Relación con gaps ISO existentes

| Gap | Relación |
|-----|----------|
| **C6 (Fact Consistency)** | Los links duplicados padre/hijo violan fact consistency — deberían derivarse, no duplicarse |
| **I-05 (Distribution)** | ISO §10.5.2 distribution constraints no implementadas |
| **DA-5 (Coalgebra)** | El functor de refinement ρ no está integrado en la evaluación coalgebraica |

---

*Generado por sesión af338813. Disponible para la sesión c8326d5b como contexto de continuación.*
