# Technical Archaeology — Corte 2

Fecha: 2026-03-29
Origen: steipete
Ámbito: `/home/felix/projects/opmodel`

## Objetivo
Reconstruir la semántica del dominio real: entidades, relaciones, mutación, invariantes y conexión entre serialización, OPL y simulación.

## Fuente principal observada
La semántica real aparece concentrada en:
- `packages/core/src/types.ts`
- `packages/core/src/api.ts`

## Entidades del modelo efectivo
El modelo observado no se limita a objetos y procesos. Incluye al menos:
- `Thing` (`object` o `process`)
- `State`
- `OPD`
- `Link`
- `Appearance`
- `Modifier`
- `Fan`
- `Scenario`
- `Assertion`
- `Requirement`
- `Stereotype`
- `SubModel`
- `Meta`
- `Settings`

## Relaciones principales
Relaciones fuertes identificadas:
- `State.parent -> Thing`
- `Link.source/target -> Thing`
- `Modifier.over -> Link`
- `Fan.members -> Link[]`
- `Requirement.target -> Thing | State | Link`
- `Assertion.target -> Thing | Link`
- `Stereotype.thing -> Thing`
- `SubModel.shared_things -> Thing[]`
- `Appearance.(thing, opd)` como puente entre semántica y representación visual
- `OPD.refines -> Thing`
- `OPD.parent_opd -> OPD | null`

## Lectura fuerte del modelo
El modelo real se comporta como un grafo tipado en memoria con `Map`s por colección. No parece un AST simple ni un JSON plano sin semántica propia.

## Representación del estado
El estado del dominio se concentra en un `Model` que contiene colecciones para:
- `meta`
- `settings`
- `things`
- `states`
- `opds`
- `links`
- `modifiers`
- `appearances`
- `fans`
- `scenarios`
- `assertions`
- `requirements`
- `stereotypes`
- `subModels`

Cada colección vive en `Map<string, Entity>`.

## Mutación del modelo
Las mutaciones viven en `packages/core/src/api.ts`.

Patrón observado:
- funciones puras `addX`, `removeX`, `updateX`
- retorno `Result<Model, InvariantError>`
- copia estructural de `Map`s
- actualización de `meta.modified` vía `touch(...)`

Mutaciones mencionadas por steipete:
- `addThing`
- `addState`
- `addLink`
- `addOPD`
- `refineThing`
- `updateThing`
- `updateLink`
- `bringConnectedThings`

## Observaciones sobre semántica de mutación
No es CRUD plano. Hay mutaciones con lógica fuerte:
- `removeThing` hace cascada sobre states, links, modifiers, appearances, requirements, fans, assertions, stereotypes y OPDs refinados
- `refineThing` crea OPD hijo, container appearance, pullback de externos y placeholders de subprocessos
- `updateLink` revalida endpoints, states, invariantes de tipo y puede forzar coherencia de `exhibition`
- `updateThing` bloquea transiciones inválidas entre process/object o reglas de statefulness

## Estado en UI
En web se separan dos planos:
- `History<Model>` para undo/redo
- `UIState` efímero para selección, modo y simulación

Lectura:
Existe separación real entre estado del dominio y estado de interacción.

## Invariantes y validaciones

### Primera línea: en la mutación
Las funciones `add/update/remove` ya rechazan inconsistencias.

Ejemplos mencionados:
- IDs globalmente únicos
- un `State` solo puede colgar de un `object`
- un objeto stateless no puede tener states
- los links deben apuntar a things existentes
- restricciones de tipos sobre links procedurales
- self-loop prohibido salvo casos específicos
- restricciones de agent, exception, exhibition, etc.

### Segunda línea: validación global
`validate(model)` en `api.ts` aplica una pasada completa sobre el modelo ya armado.

Cobertura descrita:
- referencias colgantes
- duplicados
- coherencia de OPDs
- unicidad de ciertos links
- exclusividad de current state
- restricciones metodológicas adicionales

## Tensión principal detectada
OPModel no modela solo semántica OPM “pura”. Mezcla en el núcleo:
- dominio
- representación visual
- constraints metodológicos
- artefactos de validación
- escenarios y requisitos

Esa riqueza puede ser virtud, pero también complica estabilizar el producto si las fronteras entre núcleo semántico, visualización y metodología no quedan claras.

## Conclusión del corte 2
El corazón técnico sí existe y sí es denso: OPModel tiene un núcleo semántico mucho más serio que el que sugeriría una lectura superficial de la UI o del tooling heredado. La aspiración de convertirlo en herramienta principal no parte desde humo; parte desde un core real, aunque aún con tensiones de frontera y estabilización.
