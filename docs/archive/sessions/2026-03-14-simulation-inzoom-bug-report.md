# Bug Report: Simulation Engine In-Zoom + Fixture Consistency

**Fecha:** 2026-03-14
**Reportado por:** Sesión af338813 (NL Parser + Links ISO)
**Dirigido a:** Sesión c8326d5b (Simulation In-Zoom)
**Severidad:** CRITICAL — simulación produce resultados incorrectos + fixture semánticamente inválido
**Reproducción:** Cargar Coffee Making fixture, ejecutar simulación manual
**Modelo afectado:** `tests/coffee-making.opmodel` + `packages/web/public/coffee-making.opmodel`

---

## 1. Síntoma observable

Al simular el modelo Coffee Making:
- Coffee Beans se consume ✅
- Water cambia de cold a hot ✅
- **Coffee nunca pasa a "ready"** ❌ — permanece en estado "unmade"

El usuario espera que al completar Coffee Making, el café esté listo.

---

## 2. Root Causes (4 bugs, ordenados por severidad)

### Bug D (CRITICAL): Fixture viola ISO §10.5.2 — links duplicados en padre e hijos

**Problema:** El fixture Coffee Making tiene links procedurales en DOS niveles simultáneamente:

```
NIVEL PADRE (proc-coffee-making):
  ├── consumption ← Coffee Beans       ← REDUNDANTE con Grinding
  ├── effect → Water (cold→hot)        ← REDUNDANTE con Boiling
  └── result → Coffee                  ← REDUNDANTE con Brewing

NIVEL HIJO (subprocesos):
  ├── proc-grinding:  consumption ← Coffee Beans,    result → Ground Coffee
  ├── proc-boiling:   effect → Water (cold→hot)
  └── proc-brewing:   consumption ← Ground Coffee,   result → Coffee
```

**ISO §10.5.2 dice explícitamente:**

> "When a process is in-zoomed, all the consumption and result links that were attached to it **shall be attached initially or by default to its first subprocess** [consumption] or last subprocess [result]."

Es decir: al crear el in-zoom, los links del padre se **mueven** a los subprocesos — NO se duplican. Tener links en ambos niveles es una violación de fact consistency.

**Semántica incorrecta del fixture actual:**

El modelo afirma simultáneamente que:
1. Coffee Making (como unidad atómica) consume Coffee Beans
2. Grinding (subproceso de Coffee Making) TAMBIÉN consume Coffee Beans

Esto es una contradicción: ¿quién consume los beans? ¿El padre o el hijo? Si ambos, ¿se consumen dos veces? El modelo es ambiguo y semánticamente inválido.

**Regla ISO para distribución:**

| Link en padre | ¿Qué ocurre al crear in-zoom? | ¿A quién se asigna? |
|---------------|-------------------------------|---------------------|
| consumption | Se MUEVE al primer subproceso | Grinding |
| result | Se MUEVE al último subproceso | Brewing |
| agent | Se DISTRIBUYE a todos | Grinding + Boiling + Brewing |
| instrument | Se DISTRIBUYE a todos | Grinding + Boiling + Brewing |
| effect | Se DISTRIBUYE a los relevantes | Boiling (en este caso) |

**Restricción ISO adicional (§10.5.2):**

> "Consumption and result links **SHALL NOT** be attached to outer contour of in-zoomed process."

Los links de consumption y result en `proc-coffee-making` violan esta restricción directamente.

---

### Bug A: `runSimulation` descarta eventos dirigidos a procesos in-zoomed

**Ubicación:** `packages/core/src/simulation.ts`, `runSimulation()`

**Problema:** `getExecutableProcesses()` expande `proc-coffee-making` en sus subprocesos leaf (Grinding, Boiling, Brewing). Cuando el usuario envía `{ kind: "manual", targetId: "proc-coffee-making" }`, `runSimulation` busca `proc-coffee-making` en la lista de ejecutables — no lo encuentra — y **descarta el evento silenciosamente** (0 pasos ejecutados).

**Evidencia:**
```
Executable processes: [proc-grinding, proc-boiling, proc-brewing]
runSimulation({ targetId: "proc-coffee-making" }) → 0 steps
```

**Impacto:** Ningún proceso se ejecuta. La simulación no avanza.

**Comportamiento esperado:** Al recibir un evento para un proceso in-zoomed, el engine debería:
1. Detectar que el proceso tiene in-zoom
2. Expandir a subprocesos en Y-order
3. Ejecutar la secuencia completa: Grinding → Boiling → Brewing
4. Reportar que fue una ejecución delegada (el step debería indicar `parentProcessId`)

---

### Bug B: Links del proceso padre quedan huérfanos durante in-zoom execution

**Ubicación:** `packages/core/src/simulation.ts`, `simulationStep()` ~línea 333

**Problema:** Cuando se ejecutan subprocesos (Grinding, Boiling, Brewing), `simulationStep` solo procesa links directamente conectados a ese subproceso. Los links conectados al proceso padre (`proc-coffee-making`) **nunca se procesan**.

**Nota:** Este bug se vuelve irrelevante si Bug D se resuelve correctamente (eliminando los links del padre). Pero si el modelo retiene links en el padre por razones de visualización en el OPD top-level, el engine necesita saber que esos links son "resumenes" y no deben ejecutarse directamente.

---

### Bug C: Result link sin `target_state` — Coffee no transiciona a "ready"

**Ubicación:** `tests/coffee-making.opmodel`, link `lnk-brewing-yields-coffee`

**Problema:** El result link que produce Coffee no especifica `target_state`:

```json
{"id": "lnk-brewing-yields-coffee", "source": "proc-brewing", "target": "obj-coffee", "type": "result"}
```

El engine de simulación:
```typescript
if (link.target_state) {
  obj.currentState = link.target_state;
}
```

Sin `target_state`, Coffee se marca como `exists: true` pero permanece en estado "unmade" (el estado inicial). El usuario espera que Coffee pase a "ready".

**Fix:** Agregar `"target_state": "state-coffee-ready"` al result link.

---

## 3. Reproducción paso a paso

```typescript
// 1. Cargar modelo
const m = loadModel(readFileSync('tests/coffee-making.opmodel'));

// 2. Verificar ejecutables — Coffee Making NO aparece
getExecutableProcesses(m);
// → [proc-grinding, proc-boiling, proc-brewing] (proc-coffee-making EXCLUIDO)

// 3. Intentar simular Coffee Making directamente
runSimulation(m, init, [{ kind: 'manual', targetId: 'proc-coffee-making', timestamp: 1 }]);
// → 0 pasos ❌ (evento descartado silenciosamente)

// 4. Simular subprocesos manualmente en secuencia
simulationStep(m, state, { targetId: 'proc-grinding' });
// → consume Coffee Beans ✅, produce Ground Coffee ✅

simulationStep(m, state, { targetId: 'proc-boiling' });
// → Water cold→hot ✅

simulationStep(m, state, { targetId: 'proc-brewing' });
// → consume Ground Coffee ✅, produce Coffee ✅
// → PERO Coffee.currentState = "unmade" ❌ (falta target_state en link)

// 5. Links del padre proc-coffee-making: NUNCA ejecutados
// → consumption(beans), effect(water), result(coffee) — todos huérfanos
```

---

## 4. Estado del fixture actual vs fixture correcto

### Fixture ACTUAL (incorrecto)

```
Links:
  ┌─ proc-coffee-making ──────────────────────────────┐
  │  agent ← Barista           ← REDUNDANTE           │
  │  consumption ← Coffee Beans ← PROHIBIDO por ISO   │
  │  effect → Water             ← PROHIBIDO por ISO   │
  │  result → Coffee            ← PROHIBIDO por ISO   │
  └────────────────────────────────────────────────────┘
      ↓ in-zoom (opd-sd1)
  ┌─ proc-grinding ────────────────────────────────────┐
  │  agent ← Barista                                    │
  │  consumption ← Coffee Beans                         │
  │  result → Ground Coffee                             │
  ├─ proc-boiling ─────────────────────────────────────┤
  │  agent ← Barista                                    │
  │  effect → Water (cold→hot)                          │
  ├─ proc-brewing ─────────────────────────────────────┤
  │  agent ← Barista                                    │
  │  consumption ← Ground Coffee                        │
  │  result → Coffee                                    │
  └────────────────────────────────────────────────────┘
```

### Fixture CORRECTO (ISO §10.5.2)

```
Links:
  ┌─ proc-coffee-making ──────────────────────────────┐
  │  (SIN links procedurales — distribuidos a hijos)   │
  └────────────────────────────────────────────────────┘
      ↓ in-zoom (opd-sd1)
  ┌─ proc-grinding (primer subproceso) ────────────────┐
  │  agent ← Barista          (distribuido de padre)    │
  │  consumption ← Coffee Beans (movido de padre)       │
  │  result → Ground Coffee   (propio del subproceso)   │
  ├─ proc-boiling ─────────────────────────────────────┤
  │  agent ← Barista          (distribuido de padre)    │
  │  effect → Water cold→hot  (movido de padre)         │
  ├─ proc-brewing (último subproceso) ─────────────────┤
  │  agent ← Barista          (distribuido de padre)    │
  │  consumption ← Ground Coffee (propio)               │
  │  result → Coffee [ready]  (movido de padre + state) │
  └────────────────────────────────────────────────────┘
```

**Diferencias clave:**
1. proc-coffee-making tiene **cero links procedurales** (todos distribuidos)
2. Los result links tienen `target_state` especificado
3. No hay duplicación — cada link existe en exactamente un nivel

### ¿Qué se muestra en el OPD top-level?

Cuando Coffee Making se muestra como caja negra en el OPD top-level (sin in-zoom visible), los links de sus subprocesos se **agregan visualmente** en el contorno del padre. Es decir:

- El OPD muestra Coffee Beans → Coffee Making (consumption) como un link visual
- Pero el link REAL está en proc-grinding, no en proc-coffee-making
- Es una **proyección visual**, no un link real en el modelo

Esto requiere que el renderer del OPD sepa agregar links de subprocesos cuando muestra el padre colapsado.

---

## 5. Análisis categórico

### El in-zoom como functor de refinement

El in-zoom define un functor ρ: Proc → Chain(Proc) que descompone un proceso en una cadena ordenada de subprocesos. Los links del padre son 1-cells en la categoría OPM que deben ser transportados vía ρ:

```
ρ_*(link_parent) = link_distributed
```

Este pushforward ρ_* tiene reglas estructurales:

```
ρ_*(consumption) = ι_first(consumption)    // inyección en primer subproceso
ρ_*(result)      = ι_last(result)          // inyección en último subproceso
ρ_*(agent)       = Δ(agent)               // diagonal: copia a todos
ρ_*(instrument)  = Δ(instrument)          // diagonal: copia a todos
ρ_*(effect)      = Δ(effect)              // diagonal: copia a todos
```

Donde:
- ι_first, ι_last: inyecciones en endpoints de la cadena
- Δ: functor diagonal (duplica a todos los objetos de la cadena)

### Pullback y OPD rendering

El OPD top-level muestra el padre colapsado. Los links visibles en ese OPD son el **pullback** de los links distribuidos:

```
π*(links_subprocesos) = links_visibles_en_padre
```

Este pullback es la operación INVERSA de la distribución. Categóricamente:

```
ρ_* ⊣ π*    (distribución es left adjoint de pullback)
```

La adjunción garantiza que distribuir y luego re-agregar produce los mismos links — es la ley de fact consistency.

---

## 6. Propuesta de solución

### Fase 1: Fix inmediato (datos)

1. **Eliminar los 4 links del padre** en Coffee Making (consumption, effect, result, agent del padre)
2. **Agregar `target_state: "state-coffee-ready"`** al result link de Brewing
3. **Sync** `packages/web/public/coffee-making.opmodel`

### Fase 2: Event delegation en simulation engine

Implementar en `runSimulation`:
```typescript
// Cuando evento apunta a proceso in-zoomed:
if (isInZoomed(processId, model)) {
  const subs = getExecutableProcesses(model)
    .filter(p => p.parentProcessId === processId)
    .sort((a, b) => a.order - b.order);

  for (const sub of subs) {
    // Ejecutar subproceso con sus propios links
    const step = simulationStep(model, currentState, { kind: 'manual', targetId: sub.id, timestamp: t });
    if (step.preconditionMet) currentState = step.newState;
    steps.push(step);
  }
}
```

### Fase 3: Link distribution engine (ISO §10.5.2)

Implementar `distributeLinks()` que computa links virtuales para subprocesos basándose en los links del padre. Esto permitiría que el usuario modele SOLO a nivel del padre y el engine distribuya automáticamente al crear el in-zoom.

### Fase 4: OPD aggregation rendering

Implementar `aggregateLinks()` (el pullback π*) que computa los links a mostrar visualmente en el OPD padre cuando Coffee Making está colapsado. Esto elimina la necesidad de links duplicados en el modelo.

### Priorización

| Fase | Complejidad | Impacto | Recomendación |
|------|------------|---------|---------------|
| 1 (fixture fix) | Trivial | Alto — elimina bugs observados | **Ahora** |
| 2 (event delegation) | Baja | Alto — simulación funciona end-to-end | **Próximo sprint** |
| 3 (distribution) | Media | Medio — modelos limpios, sin duplicación manual | P2 |
| 4 (OPD aggregation) | Alta | Medio — visualización correcta de padre colapsado | P2 |

---

## 7. Archivos afectados

| Archivo | Fase | Cambio necesario |
|---------|------|-----------------|
| `tests/coffee-making.opmodel` | 1 | Eliminar links del padre, agregar target_state |
| `packages/web/public/coffee-making.opmodel` | 1 | Sync con fixture |
| `packages/core/src/simulation.ts` | 2 | Event delegation para procesos in-zoomed |
| `packages/core/tests/simulation.test.ts` | 2 | Tests de delegación |
| `packages/core/src/simulation.ts` | 3 | `distributeLinks()` function |
| `packages/web/src/components/OpdCanvas.tsx` | 4 | Agregar links de subprocesos en vista padre |

---

## 8. Relación con gaps ISO existentes

| Gap | Relación |
|-----|----------|
| **C6 (Fact Consistency)** | Los links duplicados padre/hijo violan fact consistency — este bug es una manifestación directa de C6 |
| **ISO §10.5.2** | Distribution constraints no implementadas — el fixture las viola manualmente |
| **DA-5 (Coalgebra)** | El functor de refinement ρ no está integrado en la evaluación coalgebraica |
| **I-17 (Process transforms ≥1 object)** | Si eliminamos links del padre, validate() podría reportar I-17 en proc-coffee-making — necesita exclusión para procesos in-zoomed |

---

*Generado por sesión af338813. Disponible para la sesión c8326d5b como contexto de continuación.*
