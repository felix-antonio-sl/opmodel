# ADR-002: Semantic Kernel + Fibrated OPD Atlas

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Estado | Proposed |
| Autor | Felix (Ominono) + steipete |

## Contexto

La decisión OPL-first ya fija que la autoría entra por texto OPL y que el modelo y la vista visual son derivados.

El problema remanente es más fino:

1. El modelo actual mezcla semántica y geometría en el mismo artefacto `.opmodel`.
2. Ciertas propiedades visuales, como la altura relativa de subprocesses, terminan afectando semántica reconstruida.
3. El sistema de OPDs todavía no está formalizado como una familia de vistas coherentes del mismo sistema, sino como una colección de diagramas derivados ad hoc.
4. Para producto real, necesitamos una capa intermedia estable que soporte:
   - roundtrip OPL ↔ semántica
   - proyección a múltiples OPDs
   - edición visual segura
   - layout regenerable
   - re-render bilingüe EN/ES

## Decisión

Introducir una arquitectura en tres estratos:

```text
OPL text
  ↓ parse + normalize
Semantic Kernel (SSOT)
  ↓ expose
Fibrated OPD Atlas
  ↓ layout
Scene Graph / Canvas
```

### Regla central

- **El Semantic Kernel es la fuente de verdad.**
- **El atlas OPD es una proyección indexada del kernel.**
- **El layout es decorativo y regenerable.**

## Tesis categórica

No exigimos isomorfía directa entre texto crudo y píxeles.

La equivalencia correcta es:

```text
N_opl(OPL) ≅ S ≅ N_opd(Atlas(OPD))
```

Donde:
- `S` = Semantic Kernel canónico
- `N_opl` = normalización textual
- `N_opd` = normalización visual/estructural

## Modelo conceptual

### 1. Categoría de presentaciones `𝒫`

Objetos:
- documentos OPL
- bundles multi-OPD

Morfismos:
- renombrado
- expansión conservativa
- normalización sintáctica
- traducción EN/ES

### 2. Categoría semántica `𝒮`

Objetos:
- sistemas OPM canónicos con things, states, links, refinements, scenarios, assertions

Morfismos:
- embeddings
- refinamientos
- fusiones conservativas
- proyecciones locales

`𝒮` es el SSOT.

### 3. Categoría de refinamiento `ℛ`

Objetos:
- `SD`, `SD1`, `SD1.1`, ...

Morfismos:
- `in-zoom`
- `unfold`

### 4. Atlas `𝒜 = [ℛ, 𝒱]`

Cada OPD es una vista indexada por refinamiento.

El atlas completo es un diagrama de vistas locales coherentes del mismo objeto semántico.

### 5. Categoría de layout `𝓛`

Objetos:
- coordenadas, routing, tamaño, bandas, duplicados

Morfismos:
- re-layout
- packing
- snapping
- routing update

`𝓛` no es fuente de verdad semántica.

## Componentes de producto

### A. Semantic Kernel

Debe contener solo semántica estable:
- things
- states
- links tipados
- refinements
- in-zoom steps
- internal objects
- path labels
- scenarios
- assertions

No debe depender de `x,y`.

### B. Fibrated OPD Atlas

Debe contener:
- árbol de refinamiento
- slices por OPD
- ocurrencias visuales de things
- metadata de visibilidad por contexto

### C. Layout Model

Debe contener:
- posiciones
- tamaños
- rutas
- duplicate placements
- hints de interacción

El layout es cache regenerable.

## Reglas duras

1. `x,y` nunca definen paralelismo o secuencia.
2. Paralelismo y orden viven en `InZoomStep[]` dentro del kernel.
3. Invocation implícita derivada de un in-zoom secuencial no es generador primario del modelo.
4. La edición visual debe producir patches semánticos o patches de layout, nunca mutaciones ambiguas.
5. Toda re-renderización EN/ES sale del mismo kernel.
6. Cada OPD es una fibra local del mismo sistema, no un submodelo autónomo.

## Estructura propuesta

### SemanticKernel

```ts
type SemanticKernel = {
  things: Map<ThingId, Thing>
  states: Map<StateId, State>
  links: Map<LinkId, SemanticLink>
  refinements: Map<RefinementId, Refinement>
  opds: Map<OpdId, OpdSpec>
  scenarios: Map<ScenarioId, Scenario>
  assertions: Map<AssertionId, Assertion>
}
```

### Refinement

```ts
type Refinement =
  | {
      kind: "in-zoom"
      parentThing: ThingId
      childOpd: OpdId
      steps: InZoomStep[]
      internalObjects: ThingId[]
    }
  | {
      kind: "unfold"
      parentThing: ThingId
      childOpd: OpdId
      relation: "aggregation" | "exhibition" | "generalization" | "classification"
      refinees: ThingId[]
    }
```

```ts
type InZoomStep = {
  thingIds: ThingId[]
  execution: "sequential" | "parallel"
}
```

### OpdSlice

```ts
type OpdSlice = {
  opdId: OpdId
  contextThing?: ThingId
  visibleThings: ThingId[]
  visibleLinks: LinkId[]
  refinementEdge?: RefinementId
}
```

### ViewOccurrence

```ts
type ViewOccurrence = {
  thingId: ThingId
  opdId: OpdId
  semanticRank?: number
  parallelClass?: string
  lane?: "objects-left" | "processes-center" | "objects-right"
  x?: number
  y?: number
}
```

## Funtores operacionales

### `Parse : 𝒫 → 𝒮`

- parsea OPL
- normaliza
- compila al kernel

### `Render : 𝒮 → 𝒫`

- genera OPL canónico EN/ES

### `Expose : 𝒮 → 𝒜`

- construye el atlas OPD desde el kernel

### `Collect : 𝒜 → 𝒮`

- recompone cambios visuales como patch semántico

### `Layout : 𝒜 → 𝒜 × 𝓛`

- agrega geometría determinista sin cambiar semántica

## Leyes que debe satisfacer

### Ley textual

```text
Render(Parse(opl)) = N_opl(opl)
```

### Ley visual

```text
Collect(Expose(S)) ≅ S
```

### Ley de atlas

```text
colim(Expose(S)) ≅ S
```

### Ley de edición segura

Mover una caja sin cambiar relaciones semánticas no debe alterar `S`.

## Consecuencias de implementación

### Beneficios

- separa semántica de geometría
- elimina bugs donde el layout inventa semántica
- permite regenerar atlas y canvas de forma estable
- habilita edición visual segura
- permite source mapping robusto OPL ↔ OPD

### Costos

- hay que introducir un nuevo estrato intermedio
- el compile actual hacia `Model` debe desacoplarse del layout
- hay que formalizar `Refinement` y `OpdSlice`
- hay que revisar qué links son primarios y cuáles derivados

## Implicancias para OPModel

### Corto plazo

1. Introducir `InZoomStep[]` como semántica primaria.
2. Dejar de depender de `y` para reconstruir secuencia/paralelismo.
3. Añadir `derivedFrom` a invocation derivada.
4. Extraer `OpdSlice` como superficie explícita de `expose()`.

### Mediano plazo

1. Separar `SemanticKernel` de `LayoutModel`.
2. Rehacer `expose()` como proyector fibrado explícito.
3. Implementar `collect()` desde edición visual.
4. Añadir tests de colímite sobre atlas completo.

## Criterio de aceptación

La ADR estará cumplida cuando:

1. `opl -> parse -> compile -> expose -> render visual` sea el flujo principal.
2. `semanticRank` y `parallelClass` estén en el kernel/atlas, no implícitos en `y`.
3. el atlas pueda regenerarse sin perder semántica.
4. editar layout no cambie la semántica.
5. las pruebas de roundtrip distingan entre igualdad fuerte y igualdad módulo derivados.

## Frase de producto

> OPModel no renderiza diagramas desde coordenadas.
> Proyecta un sistema semántico canónico a un atlas de OPDs y luego lo dispone visualmente.
