# DA-9: Vistas Derivadas (Fibra Computada)

**Fecha**: 2026-03-23
**Autor**: fxsl/arquitecto-categorico
**Status**: Aprobado (polo B colapsado por operador)

---

## Motivacion

El modelo OPM total `C_OPM_total = ∫ M` (construccion de Grothendieck, §4.5 del analisis categorico) es la fuente de verdad. Los OPDs son fibras `π⁻¹(OPD_i)` de la fibracion `π: C_OPM_total → I_OPD`. Actualmente las fibras se almacenan como `Appearances` — esto causa:

1. **State suppression stale**: `Appearance.suppressed_states` se computa una vez en `refineThing()` y no se actualiza cuando cambian links o estados
2. **Inconsistencia de visibilidad**: things con links activos pueden no tener appearance en un OPD donde deberian ser visibles
3. **No hay "Bring Connected Things"**: traer things conectados desde otros OPDs requiere crear appearances manualmente

## Decision

**Polo B**: Las vistas son queries derivados sobre el grafo total. Las Appearances pasan de ser la definicion de visibilidad a **hints de posicionamiento**. La visibilidad se computa.

## Formalizacion

### El "Diagrama de Dios"

```
Model = {
  things: Map<string, Thing>       ← objetos de C_OPM
  links: Map<string, Link>         ← morfismos de C_OPM
  states: Map<string, State>       ← subobjetos (monomorfismos)
  opds: Map<string, OPD>           ← objetos de I_OPD
  appearances: Map<string, Appearance>  ← π (fibracion) + posicionamiento
}
```

El diagrama de dios son `things + links + states`. Las `opds` son la categoria indice. Las `appearances` codifican tanto la fibracion (que thing vive en que OPD) como layout (x, y, w, h).

### Fibra Computada

```typescript
interface OpdFiber {
  // Things visibles: explicitas (con appearance) + implicitas (por coherencia de links)
  things: Map<string, {
    thing: Thing;
    appearance: Appearance;
    implicit: boolean;  // true = derivada, sin appearance almacenada
  }>;
  // Links resueltos (incluye distribucion C-01)
  links: ResolvedLink[];
  // States suprimidos por thing (derivado de estructura de refinamiento)
  suppressedStates: Map<string, Set<string>>;
}

function resolveOpdFiber(model: Model, opdId: string): OpdFiber;
```

### Reglas de derivacion

**Things visibles en OPD_i:**
1. Todo thing con `appearance(thing, OPD_i)` → explicito
2. Todo thing T' tal que existe link `l: T ↔ T'` donde T tiene appearance en OPD_i → implicito (candidato a Bring Connected)
3. Implicitos se renderizan con appearance por defecto (posicion auto-calculada) y estilo visual distinto (opacidad reducida, borde punteado)

**State suppression derivada:**
```
suppressed(state s, OPD_i) ⟺
  ∃ OPD_child con parent_opd = OPD_i ∧ refinement_type = "in-zoom":
    s.parent ∈ externalThings(OPD_child) ∧
    ∃ link l: s.parent ↔ refined_thing con l.source_state = s.id ∨ l.target_state = s.id
```

Es decir: un estado se suprime en el padre si participa en links que cruzan la frontera de refinamiento. Esto se COMPUTA, no se almacena.

**Link distribution (ya implementada como C-01):**
```
consumption/input → primer subprocess por Y
result/output → ultimo subprocess por Y
agent/instrument/effect → todos los subprocesos
```

### bringConnectedThings

```typescript
function bringConnectedThings(
  model: Model,
  thingId: string,
  opdId: string,
  filter?: "procedural" | "structural" | "all"
): Result<Model, InvariantError>
```

Semantica: para cada thing T' conectado a `thingId` via link que pasa el filtro, y que NO tiene appearance en `opdId`, crear appearance con posicion auto-calculada. Materializa las implicitas como explicitas.

## Impacto en codigo

| Componente | Cambio |
|-----------|--------|
| `simulation.ts` | `resolveOpdFiber()` reemplaza `resolveLinksForOpd()`. Retorna fiber completa. |
| `OpdCanvas.tsx` | Consume `OpdFiber` en vez de `appearances.filter(opd)`. Things implicitas con estilo visual distinto. |
| `OplPanel` | Consume fiber para sentences. |
| `PropertiesPanel` | Boton "Bring Connected" para materializar implicitas. |
| `Appearance.suppressed_states` | **Deprecado**. Se computa en fiber. Campo se mantiene para backwards compat pero se ignora si DA-9 activo. |
| `api.ts:refineThing()` | Eliminar logica C-04 de suppressed_states. La fiber lo computa. |
| `api.ts:validate()` | Agregar checks de coherencia de fiber (things con links pero sin appearance). |

## Incrementos de implementacion

| # | Incremento | Esfuerzo | Dependencia |
|---|-----------|----------|-------------|
| 1 | `resolveOpdFiber()` en core — unifica things + links + states | L | Ninguna |
| 2 | Migrar OpdCanvas a consumir `OpdFiber` | L | Inc 1 |
| 3 | State suppression derivada — eliminar stored, computar | M | Inc 1 |
| 4 | `bringConnectedThings()` API + UI | M | Inc 1 |
| 5 | Migrar OPL a consumir fiber | M | Inc 1 |
| 6 | Deprecar `Appearance.suppressed_states` | S | Inc 3 |

**Esfuerzo total**: 2-3 sesiones.

## Invariantes categoricas preservadas

- **Fibracion**: `π: C_OPM_total → I_OPD` se mantiene. Las appearances codifican π. La fiber computa la vista.
- **Retraccion**: `fold ∘ inzoom = id` preservada. No hay mutacion de grafo.
- **Colimite**: El Model sigue siendo `∫ M`. Las vistas son proyecciones.
- **Pullback preciso**: Bring Connected Things es el pullback `π*(T, OPD_i)` materializado.

## Relacion con OPCloud

| Feature OPCloud | Equivalente DA-9 |
|----------------|-------------------|
| Bring Connected Things | `bringConnectedThings()` con filtro procedural/structural |
| Visual instance | Thing con multiples appearances (ya soportado) |
| Inside/Outside objects | `Appearance.internal` flag (ya implementado) |
| System Map | Renderizar I_OPD como grafo miniatura (pendiente) |
