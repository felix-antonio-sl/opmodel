# DA-7: Link Refinement Fibration — Spec Draft

**Estado:** Draft
**Fecha:** 2026-03-16
**Autor:** fxsl/arquitecto-categorico

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

La fibración `π*` debería componer `consumption ⊕ result → effect` al proyectar al nivel padre.

## Tensión DIK

- **DATA**: Links planos sin relación entre niveles
- **INFORMATION**: "estos dos links SON el mismo enlace refinado" — perdida
- **KNOWLEDGE**: La ley de composición del refinamiento no tiene representación

## Opciones de Diseño

### Opción A — `refines` field en Link (mínima)

```typescript
interface Link {
  refines?: string; // ID del link padre que este refina
}
```

- Pro: Cambio mínimo, trazable
- Contra: No captura la pareja (consumption+result son co-dependientes)

### Opción B — `TransformationGroup` como entidad (explícita)

```typescript
interface TransformationGroup {
  id: string;
  object: string;
  from_state?: string;
  to_state?: string;
  consumption_link: string;
  result_link: string;
  parent_link?: string; // effect link en OPD padre
}
```

- Pro: Captura la composición como unidad semántica
- Contra: Nueva entidad, complejidad del schema

### Opción C — Effect como vista derivada (radical)

No almacenar effect links. El efecto se computa como `π*(consumption ⊕ result)`. El effect en SD sería una vista, no un dato.

- Pro: Elimina duplicación ontológica
- Contra: Breaking change masivo; effect IS un link type ISO 19450 (§7.2)

## Recomendación

**Opción A como paso inmediato** (Rev.4 del data model), con migración futura a Opción B si la complejidad lo justifica. Opción C es categóricamente correcta pero viola ISO 19450.

## Fix Cosmético Implementado (2026-03-16)

Mientras no se implemente DA-7 en el data model, `OpdCanvas.tsx` detecta pares consumption+result sobre el mismo (object, process) y los fusiona visualmente en un solo link tipo effect con label `"fromState → toState"` y flechas bidireccionales. Esto preserva la semántica visual sin cambiar el modelo de datos.

## Impacto

- **Data model**: Nueva propiedad `refines` en `Link` (Opción A)
- **JSON Schema**: Extensión del schema de links
- **OPL**: Sin impacto directo (render ya maneja ambos tipos)
- **Serialization**: Nueva propiedad a persistir
- **Simulation**: Sin impacto (execution engine usa links individuales)
- **resolveLinksForOpd**: Podría usar `refines` para composición automática

## Dependencias

- `2026-03-10-opm-data-model.md` Rev.3 → Rev.4
- `2026-03-10-opm-json-schema.json` — extensión
