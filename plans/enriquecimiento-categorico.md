# Plan: Enriquecimiento Categórico del Backlog Lean OPModeling

## Context

El análisis categórico 360° de OPM (`opm-analisis-categorico-360.md`, 1400 líneas) reveló que OPM es una **bicategoría con fibración, coalgebra y lens** — no un property graph con features. El backlog lean actual (`opm-modeling-app-backlog-lean.md`, 50 HUs) describe correctamente QUÉ construye el usuario, pero la arquitectura interna (DAs) y los invariantes de implementación no reflejan la estructura categórica del dominio.

**Objetivo:** Enriquecer las decisiones arquitecturales y añadir invariantes de implementación a las HUs críticas, sin cambiar la superficie del producto (las 50 HUs se mantienen como interfaz de usuario).

**Archivo a modificar:** `/Users/felixsanhueza/Downloads/opm-modeling-app-backlog-lean.md`
**Fuente de insight:** `/Users/felixsanhueza/Downloads/opm-analisis-categorico-360.md`

## Qué NO cambia

- Las 50 HUs como especificación de features del usuario
- Los criterios Given/When/Then existentes
- La estructura de 6 módulos
- Los sprints/pulsos
- La priorización P0-P3

## Qué SÍ cambia

### 1. DA-2 evoluciona de "Property Graph" a "Typed Category Store"

**Antes:** "Property graph (nodes = things/estados/OPDs, edges = links + contención)"

**Después:** El graph store es una categoría tipada donde:
- **0-celdas** = Things (Object ⊔ Process) + States + OPDs
- **1-celdas** = Links tipados (procedural, structural, control, contención)
- **2-celdas** = Control modifiers (event 'e', condition 'c') como transformaciones SOBRE links
- La fibración π: C_opm → C_opd_tree se implementa nativamente (OPDs como fibras, `appears_in`/`child_of` como morphisms de la fibración)
- States como subobjetos (monos) de Objects con cascade delete por composición
- Composición de links verificable (path equations)

Esto NO cambia el formato de persistencia (sigue siendo text-based, git-diffable). Cambia el modelo en memoria y las operaciones que el Domain Engine expone.

### 2. Nueva DA-5: Motor de Simulación como Coalgebra Evaluator

**Definición:** El motor ECA no es un loop imperativo que "recorre tokens por enlaces". Es un evaluador coalgebraico:

```
Coalgebra: c: ModelState → Event × (Precond → ModelState + 1)

Donde:
  ModelState = Π_{o ∈ Objects} (State(o) × Existence(o))
  Event = creación de objeto | entrada a estado específico
  Precond = preprocess object set satisfecho
  +1 = proceso no ejecuta (evento perdido, Maybe monad)
```

La simulación avanza evaluando la coalgebra paso a paso. Cada paso produce:
- Una observación (estado actual de todos los objetos)
- Una transición (cuál proceso se activa y qué cambia)
- Un log de traza (para bisimulación y coinducción posterior)

### 3. Nueva DA-6: Motor OPL como Bidirectional Lens

**Definición:** La bimodalidad OPD↔OPL no son dos parsers independientes. Es un lens formal:

```
Lens_bimodal = (expose: Graph → OPL, update: Graph × OPL_edit → Graph)

Leyes:
  PutGet: update(g, edit) |> expose = apply(edit, expose(g))
  GetPut: update(g, expose(g)) = g
```

El Domain Engine expone UN lens, no dos funciones. La UI y la CLI invocan `expose` para ver OPL y `update` para editar desde OPL. Las leyes se verifican como tests automáticos.

### 4. DA-4 (Arquitectura) actualizada

```
┌─────────────────────────────────────────────────────────────┐
│                      Interfaces                               │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐              │
│  │  Web UI   │  │   CLI    │  │ LLM Adapter   │              │
│  │ (browser) │  │ (opmod)  │  │ (NL→OPL→OPD)  │              │
│  └─────┬─────┘  └────┬─────┘  └──────┬────────┘              │
│        └──────────────┴───────────────┘                       │
│                        │                                       │
│  ┌─────────────────────┴──────────────────────────────────┐  │
│  │              Domain Engine (shared)                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ Modeling  │ │   OPL    │ │ Simulate │ │ Validate │  │  │
│  │  │  Core    │ │  Lens    │ │ Coalgebra│ │   OPM    │  │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │  │
│  │       └─────────────┴────────────┴────────────┘         │  │
│  └─────────────────────┬──────────────────────────────────┘  │
│                        │                                       │
│  ┌─────────────────────┴──────────────────────────────────┐  │
│  │            Typed Category Store                          │  │
│  │  0-cells: Things + States + OPDs                        │  │
│  │  1-cells: Links (procedural, structural, control)       │  │
│  │  2-cells: Control modifiers (event, condition)          │  │
│  │  Fibration: π: C_opm → C_opd_tree                      │  │
│  │  Persistence: file-based, git-diffable                  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 5. Invariantes de implementación añadidos a HUs críticas

NO son nuevas HUs. Son criterios adicionales de tipo "el sistema DEBE preservar X" añadidos a HUs existentes.

| HU | Invariante categórico a añadir |
|----|-------------------------------|
| L-M6-01 (Save/Load) | El formato de persistencia serializa 0-celdas, 1-celdas y 2-celdas con sus tipos. La deserialización reconstruye la categoría con composición verificable. Path equations se verifican al cargar. |
| L-M1-03 (Links procedurales) | La composición de links es asociativa: si f:A→B y g:B→C, entonces g∘f:A→C existe y es verificable. El sistema mantiene un registro de composiciones válidas. |
| L-M1-04 (Links estructurales) | Aggregation = producto (límite). Exhibition = fibración. Generalization = functor de inclusión con pullback de herencia. Classification = Free ⊣ Forget. Estos no son labels — son construcciones universales que el motor DEBE respetar. |
| L-M5-01 (Simulación ECA) | El motor evalúa la coalgebra S → F(S) paso a paso. Cada paso produce un par (observación, transición). La traza es una secuencia coinductiva. El motor NO es un loop imperativo sobre tokens — es un evaluador de la coalgebra final. |
| L-M2-01 + L-M2-02 (OPL) | El motor OPL implementa un lens formal con leyes PutGet y GetPut verificadas automáticamente como test de integridad. expose y update son las dos operaciones del lens, no dos parsers independientes. |
| L-M1-07 (In-zoom) | In-zoom implementa una retracción en la opfibración: genera una nueva fibra en C_opd_tree. Los objetos "heredados" del padre son el pullback del proceso sobre su fibra. |
| L-M1-06 (Estados) | States son subobjetos (monos) de Objects. El reticulado Sub(O) es exclusivo (un object está en exactamente un state o en transición). Cascade delete es por composición: eliminar el mono elimina el subobjeto. |

### 6. Sección nueva en el header: "Fundamento Categórico"

Después de DA-6, añadir una sección breve que documente las correspondencias OPM↔CT principales para que cualquier desarrollador entienda POR QUÉ la arquitectura es así:

| Concepto OPM | Construcción CT | Implicación |
|-------------|----------------|-------------|
| Thing | 0-celda | Node en el store |
| Link | 1-celda | Edge tipado en el store |
| Control modifier | 2-celda | Transformación sobre edge |
| OPD Tree | Opfibración | OPDs como fibras, no como "carpetas" |
| States | Subobjetos (monos) | Cascade delete, reticulado exclusivo |
| ECA simulation | Coalgebra | Evaluador paso a paso, no loop |
| OPD↔OPL | Lens bidireccional | Round-trip by construction |
| Aggregation | Producto (límite) | JOINs, integridad referencial |
| In-zoom | Retracción en fibración | Nueva fibra en el árbol |
| Generalization | Functor inclusión + pullback | Herencia por pullback |

## Ediciones concretas al archivo

1. **Reescribir DA-2** (líneas 15-16) con la nueva definición de Typed Category Store
2. **Añadir DA-5** (Motor Coalgebraico) después de DA-4
3. **Añadir DA-6** (Motor OPL Lens) después de DA-5
4. **Actualizar diagrama DA-4** con los nombres correctos (OPL Lens, Simulate Coalgebra, Typed Category Store)
5. **Añadir sección "Fundamento Categórico"** después de DA-6
6. **Añadir 1-2 criterios de invariante** a cada una de las 7 HUs listadas arriba (criterios que empiezan con "Given el Domain Engine..." y especifican propiedades categóricas que DEBEN preservarse)

## Verificación

1. Las 50 HUs siguen existiendo sin cambios en su surface
2. Los criterios Given/When/Then originales no se modifican
3. Las nuevas DAs son coherentes con el análisis categórico (`opm-analisis-categorico-360.md`)
4. Los invariantes de implementación no contradicen ningún criterio existente
5. El diagrama de arquitectura refleja los 3 motores (Modeling Core, OPL Lens, Simulate Coalgebra) sobre el Typed Category Store
6. La tabla de correspondencias OPM↔CT es consistente con el apéndice A del análisis categórico
