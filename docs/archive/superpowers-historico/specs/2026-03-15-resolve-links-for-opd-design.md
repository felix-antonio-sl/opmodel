# Design Spec: resolveLinksForOpd — Link Visibility via Fibration Pullback

**Fecha:** 2026-03-15
**Autor:** Sesión c8326d5b (Simulation In-Zoom)
**Estado:** Draft
**Invariantes:** I-ENTITY-UNIQUENESS, I-LINK-VISIBILITY (L-M1-07)

---

## 1. Problema

Cuando un proceso in-zoomed (ej: Coffee Making) se muestra colapsado en un OPD padre (ej: SD), sus links no son visibles. Los links reales conectan subprocesos (Grinding, Boiling, Brewing) que solo tienen appearances en el OPD in-zoom (SD1), no en el SD.

El `visibleLinks` actual en `OpdCanvas.tsx` filtra links donde ambos endpoints tienen appearance directa en el OPD actual. Esto excluye correctamente links cuyos endpoints no son visibles, pero incorrectamente excluye links cuyos endpoints son resolvibles a través del contorno de un proceso in-zoomed.

---

## 2. Principios

### I-ENTITY-UNIQUENESS
Cada Thing y cada Link es una entidad unica con ID irrepetible. Un Link existe UNA vez en el modelo. No se crean links virtuales ni agregados.

### I-LINK-VISIBILITY (pullback pi*)
Un link es visible en un OPD si ambos endpoints son *resolvibles*:
1. El thing tiene appearance directa en el OPD, O
2. El thing es subproceso de un proceso in-zoomed que SI tiene appearance en el OPD (resolucion por contorno)

### ISO SS14.2.2.4.1
Los links procedurales del padre se distribuyen a subprocesos. El padre tiene 0 links procedurales. La visibilidad en el OPD padre se computa por resolucion de endpoints, no por duplicacion de links.

---

## 3. Solucion

### 3.1 Tipo `ResolvedLink`

```typescript
export interface ResolvedLink {
  link: Link;              // La entidad real, sin modificar
  visualSource: string;    // Thing ID a usar como source visual en este OPD
  visualTarget: string;    // Thing ID a usar como target visual en este OPD
  aggregated: boolean;     // true si algun endpoint fue resuelto via contorno in-zoom
}
```

### 3.2 Funcion `resolveLinksForOpd`

```typescript
export function resolveLinksForOpd(model: Model, opdId: string): ResolvedLink[]
```

**Ubicacion:** `packages/core/src/simulation.ts` (junto a `getExecutableProcesses` — mismo dominio de expansion in-zoom).

**Algoritmo:**

1. Construir `appearances`: set de thing IDs con appearance en `opdId`.
2. Construir `subprocessToParent`: mapa de subprocess ID -> ancestor process ID visible en `opdId`. Para cada OPD que refines un proceso visible en `opdId`, recolectar los procesos con appearance en ese OPD (excluyendo el container). Si un subprocess tiene su propio in-zoom OPD, resolver recursivamente sus sub-subprocesos al mismo ancestor visible. Solo things de kind=process participan en esta resolucion — los objetos internos al in-zoom deben tener appearance directa para ser resolvibles.
3. Para cada link en el modelo:
   a. Resolver `visualSource`: si `link.source` esta en `appearances`, usar directamente. Si no, buscar en `subprocessToParent`. Si no resolvible, skip.
   b. Resolver `visualTarget`: idem.
   c. Si ambos resueltos, emitir `ResolvedLink`.
   d. `aggregated = true` si alguno de los endpoints fue resuelto via contorno.
4. Deduplicar: si multiples links del mismo `type` resuelven al mismo par `(visualSource, visualTarget)`, emitir solo el primero. Esto evita que 3 agent links (Barista -> Grinding/Boiling/Brewing) produzcan 3 lineas visuales identicas en el SD.

**Complejidad:** O(L * S) donde L = links, S = subprocesses. Ambos son pequenos en modelos tipicos.

### 3.3 Integracion en OpdCanvas

Reemplazar el `useMemo` de `visibleLinks` (linea 468) para usar `resolveLinksForOpd`:

```typescript
const visibleLinks = useMemo(() => {
  const resolved = resolveLinksForOpd(model, opdId);
  return resolved.map(rl => ({
    link: rl.link,
    modifier: [...model.modifiers.values()].find(m => m.over === rl.link.id),
    visualSource: rl.visualSource,
    visualTarget: rl.visualTarget,
    aggregated: rl.aggregated,
  }));
}, [model, opdId]);
```

El rendering de cada link usa `visualSource`/`visualTarget` para buscar appearances y rects, en vez de `link.source`/`link.target`.

No se agrega badge visual para links agregados — el link se dibuja identico a un link directo (I-ENTITY-UNIQUENESS: es el mismo link).

**Notas de integracion:**
- La resolucion aplica a los 14 tipos de link (procedurales, habilitadores, estructurales, control). No hay exclusion por tipo.
- El shift de `link.source`/`link.target` a `visualSource`/`visualTarget` afecta todo el codigo de rendering en OpdCanvas: calculo de rects, edge points, y simulation overlays. El plan de implementacion debe enumerar cada call site.
- La deduplicacion usa la clave `(type, visualSource, visualTarget)`. El link que sobrevive es el primero en orden de iteracion del Map (determinista por insercion, arbitrario para el usuario).

---

## 4. Ejemplo concreto: Coffee Making en SD

**Links en el modelo (todos en subprocesos):**

| Link ID | type | source | target |
|---------|------|--------|--------|
| lnk-barista-agent-grinding | agent | obj-barista | proc-grinding |
| lnk-barista-agent-boiling | agent | obj-barista | proc-boiling |
| lnk-barista-agent-brewing | agent | obj-barista | proc-brewing |
| lnk-grinding-consumes-beans | consumption | obj-coffee-beans | proc-grinding |
| lnk-grinding-yields-ground | result | proc-grinding | obj-ground-coffee |
| lnk-boiling-effects-water | effect | proc-boiling | obj-water |
| lnk-water-instrument-brewing | instrument | obj-water | proc-brewing |
| lnk-brewing-consumes-ground | consumption | obj-ground-coffee | proc-brewing |
| lnk-brewing-yields-coffee | result | proc-brewing | obj-coffee |

**Appearances en SD:** obj-barista, obj-coffee, obj-coffee-beans, obj-water, proc-coffee-making.
**NO en SD:** proc-grinding, proc-boiling, proc-brewing, obj-ground-coffee.

**Resolucion:**

| Link | source resolucion | target resolucion | Resultado |
|------|-------------------|-------------------|-----------|
| lnk-barista-agent-grinding | obj-barista (directo) | proc-grinding -> proc-coffee-making | Visible |
| lnk-barista-agent-boiling | obj-barista (directo) | proc-boiling -> proc-coffee-making | **Dedup** (mismo type+endpoints) |
| lnk-barista-agent-brewing | obj-barista (directo) | proc-brewing -> proc-coffee-making | **Dedup** |
| lnk-grinding-consumes-beans | obj-coffee-beans (directo) | proc-grinding -> proc-coffee-making | Visible |
| lnk-grinding-yields-ground | proc-grinding -> proc-coffee-making | obj-ground-coffee (NO resolvible) | **Skip** |
| lnk-boiling-effects-water | proc-boiling -> proc-coffee-making | obj-water (directo) | Visible |
| lnk-water-instrument-brewing | obj-water (directo) | proc-brewing -> proc-coffee-making | Visible |
| lnk-brewing-consumes-ground | obj-ground-coffee (NO resolvible) | proc-brewing -> proc-coffee-making | **Skip** |
| lnk-brewing-yields-coffee | proc-brewing -> proc-coffee-making | obj-coffee (directo) | Visible |

**Resultado en SD: 5 links visibles** — agent, consumption, effect, instrument, result. Los 2 links internos (Ground Coffee) se omiten porque Ground Coffee no tiene appearance en SD.

---

## 5. Casos borde

### 5.1 OPD sin procesos in-zoomed
`resolveLinksForOpd` retorna exactamente lo mismo que el filtro actual (appearances directas).

### 5.2 In-zoom anidado (A -> B -> C)
La resolucion es transitiva: si proc-sub tiene in-zoom propio, sus sub-subprocesos resuelven al ancestor mas cercano con appearance en el OPD target. El algoritmo camina recursivamente la cadena de in-zoom OPDs hasta encontrar un ancestor visible. Ejemplo: A (visible en SD) in-zooms B, B in-zooms C. Un link en C resuelve a A (no a B, que tampoco tiene appearance en SD).

### 5.3 Link entre dos subprocesos del mismo padre
Ambos endpoints resuelven al mismo proceso padre -> self-loop visual. Estos links se omiten (no son informativos en el OPD colapsado).

### 5.4 OPD in-zoom (SD1)
Dentro de SD1, los subprocesos tienen appearance directa. `resolveLinksForOpd` retorna los links directos sin resolucion. `aggregated = false` para todos.

---

## 6. Archivos afectados

| Archivo | Accion | LOC estimado |
|---------|--------|-------------|
| `packages/core/src/simulation.ts` | Agregar `ResolvedLink` + `resolveLinksForOpd()` | ~50 |
| `packages/core/src/index.ts` | Exportar tipo y funcion | ~3 |
| `packages/core/tests/simulation.test.ts` | ~6 tests unitarios | ~80 |
| `packages/web/src/components/OpdCanvas.tsx` | Reemplazar visibleLinks, pasar visualSource/Target | ~15 |

**No se modifica:** `LinkLine`, `SimulationPanel`, `simulationStep`, tipos existentes, fixture.

---

## 7. Tests

1. **Flat model (sin in-zoom):** retorna mismos links que filtro directo
2. **In-zoom model:** subprocesos resuelven al padre, links visibles correctos
3. **Deduplicacion:** 3 agent links al mismo objeto resuelven a 1
4. **Link interno (Ground Coffee):** omitido por endpoint no resolvible
5. **Self-loop:** link entre 2 subprocesos del mismo padre omitido
6. **OPD in-zoom (SD1):** links directos, aggregated=false
