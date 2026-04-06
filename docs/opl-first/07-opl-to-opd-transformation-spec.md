# Especificación normativa: transformación OPL → OPD Atlas

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Estado | Draft |
| Ámbito | Producto / Core / Visual |

## 1. Propósito

Definir reglas explícitas, implementables y testeables para transformar una entrada OPL en un sistema de OPDs consistente con ISO 19450 y con la metodología local de modelamiento.

Esta especificación asume arquitectura OPL-first con Semantic Kernel intermedio.

```text
OPL → AST → Semantic Kernel → OPD Atlas → Layout → SceneGraph
```

## 2. Principios normativos

### P1. Semántica antes que geometría
Las reglas OPL → OPD operan sobre el Semantic Kernel.
Ninguna regla semántica depende de `x,y`.

### P2. Cada OPD es una vista local
Un OPD no es un modelo separado. Es un slice del mismo kernel.

### P3. Refinamiento explícito
La relación entre `SD` y `SD1+` se expresa como `Refinement`, no como convención visual implícita.

### P4. Invocation implícita
La invocation inducida por in-zoom secuencial es semántica derivable del refinement y no debe ser la única fuente de verdad.

### P5. Layout regenerable
La transformación OPL → OPD produce primero `semanticRank`, `parallelClass` y `lane`. `x,y` se calculan después.

## 3. Pipeline normativo

### Etapa 1. Parse
Entrada:
- párrafo OPL EN o ES

Salida:
- `OplDocument[]`
- spans de source
- metadata de idioma

### Etapa 2. Normalize
Entrada:
- `OplDocument[]`

Salida:
- `NormalizedOplDocument[]`

Debe resolver:
- listas
- compound names
- state-qualified phrases
- bilingüismo EN/ES
- parallel prefix
- aliases

### Etapa 3. Compile to Semantic Kernel
Entrada:
- `NormalizedOplDocument[]`

Salida:
- `SemanticKernel`

### Etapa 4. Expose Atlas
Entrada:
- `SemanticKernel`

Salida:
- `OpdSlice[]`
- `RefinementTree`
- `ViewOccurrence[]` sin coordenadas absolutas

### Etapa 5. Layout
Entrada:
- `OpdSlice[]`
- `ViewOccurrence[]`

Salida:
- coordenadas y rutas

## 4. Reglas de compilación OPL → Semantic Kernel

## R-THING-1: declaración de objeto

Entrada:
```text
Coffee is an object.
```

Salida:
- `Thing(kind="object", name="Coffee")`

## R-THING-2: declaración de proceso

Entrada:
```text
Brewing is a process.
```

Salida:
- `Thing(kind="process", name="Brewing")`

## R-STATE-1: enumeración de estados

Entrada:
```text
Coffee can be unmade or ready.
```

Salida:
- `State("unmade")`
- `State("ready")`
- asociación a `Coffee`

## R-STATE-2: estado especificado en link

Entrada:
```text
Boiling changes Water from cold to hot.
Brewing consumes Ground Coffee.
Brewing requires Call en online.
```

Regla:
- si la frase completa coincide con nombre conocido, NO se separa en estado + thing
- si no coincide, aplicar split EN/ES según gramática

## R-LINK-1: consumo

Entrada:
```text
Brewing consumes Ground Coffee.
```

Salida:
- `ConsumptionLink(process=Brewing, object=Ground Coffee)`

## R-LINK-2: resultado

Entrada:
```text
Brewing yields Coffee.
```

Salida:
- `ResultLink(process=Brewing, object=Coffee)`

## R-LINK-3: efecto

Entrada:
```text
Boiling changes Water from cold to hot.
```

Salida:
- `EffectLink(process=Boiling, object=Water, sourceState=cold, targetState=hot)`

## R-LINK-4: agente

Entrada:
```text
Barista handles Brewing.
```

Salida:
- `AgentLink(agent=Barista, process=Brewing)`

Restricción:
- agente debe ser humano según reglas metodológicas

## R-LINK-5: instrumento

Entrada:
```text
Brewing requires Coffee Machine.
```

Salida:
- `InstrumentLink(instrument=Coffee Machine, process=Brewing)`

## R-LINK-6: invocation explícita

Entrada:
```text
Grinding invokes Brewing.
```

Salida:
- `InvocationLink(source=Grinding, target=Brewing, origin="explicit")`

## R-LINK-7: exception

Entrada:
```text
Fallback handles exception from Primary.
Fallback handles overtime exception from Primary.
```

Salida:
- `ExceptionLink(type=generic|overtime|undertime)`

## R-REF-1: in-zoom secuencial

Entrada:
```text
Coffee Making zooms into Grinding, Boiling, and Brewing, in that sequence.
```

Salida:
```ts
Refinement {
  kind: "in-zoom",
  parentThing: CoffeeMaking,
  steps: [
    { thingIds: [Grinding], execution: "sequential" },
    { thingIds: [Boiling], execution: "sequential" },
    { thingIds: [Brewing], execution: "sequential" },
  ]
}
```

## R-REF-2: in-zoom paralelo

Entrada:
```text
Coffee Making zooms into parallel Grinding and Boiling.
```

Salida:
```ts
Refinement {
  kind: "in-zoom",
  parentThing: CoffeeMaking,
  steps: [
    { thingIds: [Grinding, Boiling], execution: "parallel" }
  ]
}
```

## R-REF-3: internal objects en in-zoom

Entrada:
```text
Coffee Making zooms into Grinding, Boiling, and Brewing, as well as Ground Coffee, in that sequence.
```

Salida:
- `internalObjects = [GroundCoffee]`

Regla:
- `as well as` / `así como` no altera la secuencia de procesos
- agrega objetos internos al refinement

## R-REF-4: unfold estructural

Entrada:
- sentencias de aggregation / exhibition / generalization / classification usadas como refinamiento

Salida:
- `Refinement(kind="unfold")`
- refinees explícitos

## 5. Reglas de exposición Semantic Kernel → OPD Atlas

## R-EXPOSE-1: construcción del árbol de OPDs

Para cada refinement:
- existe un OPD hijo `childOpd`
- el OPD padre mantiene referencia al refineable
- el OPD hijo mantiene `refinementEdge`

## R-EXPOSE-2: SD raíz

El SD debe contener:
- objetos/procesos de contexto superior
- links top-level
- proceso principal refinable si existe

## R-EXPOSE-3: OPD hijo por in-zoom

Si `Refinement.kind = in-zoom`:
- el `parentThing` aparece como contexto/refineable del OPD hijo
- cada `step.thingIds` aparece como subprocess interno
- `internalObjects` aparecen como objetos visibles del contexto

## R-EXPOSE-4: semanticRank

Para cada in-zoom:
- steps secuenciales reciben `semanticRank` incremental
- elementos del mismo step paralelo reciben igual `semanticRank`

Ejemplo:
```text
[Grinding] -> rank 0
[Boiling, Brewing] -> rank 1
[Serving] -> rank 2
```

## R-EXPOSE-5: parallelClass

Todos los procesos del mismo step paralelo comparten `parallelClass` común.

## R-EXPOSE-6: lanes

Por defecto:
- procesos: `processes-center`
- objetos de entrada: `objects-left`
- objetos de salida: `objects-right`
- objetos mixed/neutral: regla de balance local

La lane es una ayuda de layout, no una semántica primaria.

## R-EXPOSE-7: duplicate things

Si el mismo `ThingId` aparece varias veces por claridad visual:
- crear múltiples `ViewOccurrence`
- no crear nuevas entidades semánticas

## R-EXPOSE-8: invocation implícita

Si un in-zoom tiene varios steps secuenciales:
- el atlas puede materializar relaciones de invocation implícita como edges derivados
- estas relations deben quedar marcadas `derivedFrom=in-zoom`
- no deben ser la única representación del orden

## 6. Reglas de layout Atlas → SceneGraph

## R-LAYOUT-1: orden top-bottom

En process in-zooming, el timeline se representa de arriba hacia abajo.

## R-LAYOUT-2: paralelismo

Subprocesses con misma `parallelClass` se alinean con el mismo `rankY`.

## R-LAYOUT-3: independencia de coordenadas

`semanticRank` decide precedencia temporal.
`y` solo la realiza geométricamente.

## R-LAYOUT-4: parent refineable

El proceso padre refinado se dibuja como contexto de OPD hijo.
No debe entrar como subprocess adicional del propio in-zoom.

## R-LAYOUT-5: links outer contour

En un proceso in-zoomed:
- enabling links pueden permanecer en outer contour o redistribuirse según política
- consumption/result links NO deben quedar en outer contour

## 7. Reglas de migración de links al hacer in-zoom

## R-MIG-1: enabling migration

Los enabling links del proceso padre pueden transferirse al primer subproceso o distribuirse explícitamente.

## R-MIG-2: control transfer

El control de entrada se transfiere al subproceso topmost del in-zoom.

## R-MIG-3: completion transfer

El control de salida retorna desde el último subproceso al proceso padre.

## R-MIG-4: transforming links

Consumption y result links deben migrarse a subprocesses específicos.
No se permite conservarlos en outer contour.

## R-MIG-5: split effect resolution

Cuando un effect del padre queda underspecified tras in-zoom multi-subprocess:
- debe resolverse explícitamente a subprocesses concretos
- no se permite dejar el efecto partido sin asignación

## 8. Reglas de edición visual → patch semántico

## R-COLLECT-1: drag libre

Si solo cambia `x,y`:
- patch de layout
- no patch semántico

## R-COLLECT-2: cambio de orden vertical

Si cambia el orden vertical entre subprocesses de un mismo in-zoom:
- producir patch sobre `steps`

## R-COLLECT-3: alineación en misma altura

Si dos subprocesses se alinean deliberadamente en misma altura:
- proponer fusión a step `parallel`

## R-COLLECT-4: link nuevo

Dibujar un link nuevo debe compilar a `SemanticLink` y validarse.

## R-COLLECT-5: crear OPD hijo

Crear un OPD hijo visual debe producir `Refinement` explícito.

## 9. Igualdad e isomorfía

## Igualdad fuerte

Se exige para:
- things
- states
- links primarios
- refinements
- internal objects
- path labels

## Igualdad módulo derivados

Se permite para:
- invocation implícita derivada del in-zoom
- layout absoluto (`x,y`)
- routing
- duplicate placement

## 10. Tests normativos mínimos

## T-1 PutGet textual

```text
render(parse(opl)) = opl canónico
```

## T-2 PutGet por fibra SD

```text
render(expose(compile(parse(sd-opl)))) ≅ sd-opl
```

## T-3 Roundtrip multi-OPD

```text
renderAll(model) -> parseOplDocuments -> compile -> renderAll
```

## T-4 Colímite del atlas

```text
collect(expose(S)) ≅ S
```

## T-5 Paralelismo estable

Un in-zoom secuencial no puede volverse paralelo por efecto del layout.

## T-6 Parent exclusion
El refineable padre no debe aparecer como subprocess de sí mismo en el OPD hijo.

## 11. Criterio de aceptación de producto

La transformación OPL → OPD se considera lista para producto cuando:

1. un OPL de ingreso genera atlas OPD utilizable sin edición manual obligatoria
2. el layout no inventa secuencia ni paralelismo
3. las leyes de roundtrip pasan al menos en fixtures canónicos
4. el árbol de refinamiento se preserva completo
5. las reglas EN/ES producen la misma semántica
6. los errores de compilación refieren spans de OPL, no solo IDs internos

## 12. Decisiones abiertas

1. cuánto de invocation derivada se materializa visualmente por defecto
2. política exacta de migración automática de enabling links
3. heurística de lane para objetos mixed-role
4. representación formal de inner vs outer objects en el kernel
5. si `Model` actual evoluciona hacia `SemanticKernel + LayoutModel` o si se reemplaza por completo
