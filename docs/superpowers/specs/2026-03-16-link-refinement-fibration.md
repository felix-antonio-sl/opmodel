# DA-7: Link Refinement Fibration — Spec Final

**Estado:** Defined
**Fecha:** 2026-03-16
**Autor:** fxsl/arquitecto-categorico
**Decisión:** Opción D — Compute on Demand (zero schema change)

## Problema

Un par `consumption(O@s₁, P) + result(P, O@s₂)` en un OPD in-zoom es la **refinación** de un `effect(P, O, s₁→s₂)` en el OPD padre. Son la misma transformación vista a dos niveles de la fibración `π: C_opm → C_opd_tree`. Pero el data model actual los trata como entidades independientes sin relación formal.

## Identidad Categórica

```
effect(P, O, s₁→s₂)  ≅  consumption(O@s₁, P) ⊕ result(P, O@s₂)
```

| Nivel | Representación | Semántica |
|-------|---------------|-----------|
| OPD padre (SD) | `effect(P, O, s₁→s₂)` | Transformación opaca |
| OPD in-zoom (SD1) | `consumption(O@s₁, P') + result(P', O@s₂)` | Mecanismo expuesto |

La fibración `π*` compone `consumption ⊕ result → effect` al proyectar al nivel padre.

## Hallazgo Empírico Crítico

La identidad cross-level **no se manifiesta en ningún fixture existente**:

- **coffee-making** (13 links): SD no tiene effect links. Los consumption+result en SD1 son mecanismos internos sin parent effect.
- **driver-rescuing** (23 links): SD tiene `lnk-rescuing-effect-driver` (effect sin estados), pero en SD1 los consumption+result operan sobre **otros objetos** (Call, Danger Status), no sobre Driver. No hay descomposición cross-level.

El merge visual opera **intra-OPD** (fusiona pares dentro del mismo OPD resuelto), no cross-level.

## Análisis DIK

- **DATA**: Links planos sin relación → **se mantienen planos** (la relación es derivable)
- **INFORMATION**: "estos dos links forman un par" → **se computa** via `(objectId, processId)` key + I-16
- **KNOWLEDGE**: La ley de composición del refinamiento → **es un teorema de la estructura**, no dato almacenado

## Decisión: Opción D — Compute on Demand

| Aspecto | Decisión |
|---------|----------|
| **Status** | Defined |
| **Elección** | Opción D: Computar on-demand, zero schema change |
| **Justificación categórica** | La relación es una PROPIEDAD del funtor fibración, no dato adicional en las fibras. El lifting cartesiano se computa desde `OPD.refines` + endpoints + I-16 uniqueness |
| **Implementación** | `findConsumptionResultPairs(model, resolvedLinks)` en `packages/core/src/api.ts` |
| **Fallback** | Opción A (`Link.refines?: string`) si emergen casos no-derivables |

### ¿Por qué NO Opción A?

1. **Información redundante**: `refines` es derivable desde `OPD.refines` + endpoints + I-16
2. **Pairing constraint complejo**: Requiere 5 invariantes nuevos para un campo que no aporta información nueva
3. **Cascading problemático**: Si se elimina un effect padre, ¿cascade a hijos? Los hijos son válidos independientemente
4. **Analogía falsa**: `OPD.refines` es constitutivo (el OPD no existiría sin él); `Link.refines` sería decorativo
5. **No hay datos reales**: Ningún fixture actual necesita esta relación almacenada

### ¿Por qué NO Opción B?

1. **Entidad nueva para 0 instancias**: Model tiene 12 Maps; agregar una 13ª para relación que no existe en datos reales
2. **~500 LOC** de boilerplate vs ~60 LOC de Opción D
3. **Redundancia total**: TransformationGroup almacena todo lo que ya es derivable de los links

### ¿Por qué NO Opción C?

Effect como vista derivada viola ISO 19450 §7.2 — effect IS un link type independiente.

## Implementación

### API Pública

```typescript
interface ConsumptionResultPair {
  consumptionLink: Link;
  resultLink: Link;
  objectId: string;
  processId: string;
  fromStateName?: string;
  toStateName?: string;
}

function findConsumptionResultPairs(
  model: Model,
  resolvedLinks: ResolvedLink[],
): ConsumptionResultPair[]
```

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `packages/core/src/api.ts` | `ConsumptionResultPair` interface + `findConsumptionResultPairs()` |
| `packages/core/src/index.ts` | Barrel export |
| `packages/web/src/components/OpdCanvas.tsx` | Reemplaza lógica inline con llamada a core |
| `packages/core/tests/refinement-pairs.test.ts` | 6 tests (fixtures + sintéticos) |

### Sin Modificaciones

- `types.ts` — zero schema change
- `serialization.ts` — nada que serializar
- `opl.ts` — render independiente por link type
- `simulation.ts` — execution engine usa links individuales
- `opm-json-schema.json` — sin cambios
- `opm-data-model.md` — se mantiene Rev.3

## Evidencia (Tests)

| Test | Fixture | Resultado |
|------|---------|-----------|
| coffee-making SD1 | 1 par: (Water, Boiling) cold→hot | El resultado de Grinding va a Ground Coffee (objeto distinto), no forma par |
| driver-rescuing SD1 | 2 pares: (Call, Call Transmitting), (Danger Status, Call Handling) | Call Making solo tiene result → no es par |
| Stateless pair | Sintético | consumption + result sin estados → par válido |
| Consumption only | Sintético | Sin result matching → 0 pares |
| Result only | Sintético | Sin consumption matching → 0 pares |
| Empty OPD | Sintético | 0 links → 0 pares |

## Criterios para Activar Opción A (Futuro)

Si alguno de estos emerge, reevaluar:
- [ ] Usuario crea refinamiento que NO es derivable (e.g., proceso refinado en múltiples OPDs con decomposiciones distintas del mismo effect)
- [ ] Performance: computar pares on-demand se vuelve costoso (improbable — O(n) con n=links)
- [ ] Necesidad de persistir metadata en la relación (e.g., "este par fue creado automáticamente por unfold")
