# OPModeling — Backlog Lean (Personal Power Tool)

Documento generado: 2026-03-10
Marco metodológico: `knowledge/fxsl/opm-methodology/` (ISO 19450)

---

## Resumen ejecutivo

### Decisiones Arquitecturales

**DA-1: CLI-First (AI-Agent Ready)**
La app expone `opmod`, una CLI con paridad 100% de la UI. Toda operación invocable desde terminal. Habilita que agentes AI (Claude Code, OpenClaw, etc.) operen el modelo vía tool-use.

**DA-2: Typed Category Store (con fibración OPD nativa)**
El graph store es una categoría tipada — no un property graph plano — donde:
- **0-celdas** = Things (Object ⊔ Process) + States + OPDs
- **1-celdas** = Links tipados (procedural, structural, control, contención `appears_in`/`child_of`/`has_state`)
- **2-celdas** = Control modifiers (event 'e', condition 'c') como transformaciones naturales SOBRE links
- **Fibración nativa:** π: C_opm → C_opd_tree se implementa como estructura de primera clase. Los OPDs son fibras (no nodes planos); `appears_in` y `child_of` son morfismos de la fibración. Cada fibra es el subgrafo de things visibles en ese OPD.
- **States como subobjetos:** State ↪ Object es mono (inyección). El reticulado Sub(O) es exclusivo. Cascade delete por composición: eliminar el mono elimina el subobjeto.
- **Composición verificable:** Si f:A→B y g:B→C existen como 1-celdas, la composición g∘f:A→C es verificable. Path equations se validan al cargar y al mutar.
- **Persistencia:** Formato text-based, git-diffable. La serialización preserva 0-celdas, 1-celdas y 2-celdas con sus tipos. La deserialización reconstruye la categoría con composición verificable.

**DA-3: Single-User Pro**
Sin auth. Arquitectura sofisticada: separación de capas, API interna, modelo de datos formal.

**DA-4: Arquitectura**

```
┌─────────────────────────────────────────────────────────────┐
│                        Interfaces                            │
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

**DA-5: Motor de Simulación como Coalgebra Evaluator**
El motor ECA no es un loop imperativo que recorre tokens por enlaces. Es un evaluador coalgebraico:

```
Coalgebra: c: ModelState → Event × (Precond → ModelState + 1)

Donde:
  ModelState = Π_{o ∈ Objects} (State(o) × Existence(o))
  Event = creación de objeto | entrada a estado específico
  Precond = preprocess object set satisfecho
  +1 = proceso no ejecuta (evento perdido, Maybe monad)
```

La simulación avanza evaluando la coalgebra paso a paso. Cada paso produce: (1) una observación (estado actual de todos los objetos), (2) una transición (cuál proceso se activa y qué cambia), (3) un log de traza (secuencia coinductiva para bisimulación posterior). Las propiedades de safety y liveness se verifican por coinducción sobre trazas, no solo por análisis estático del grafo.

**DA-6: Motor OPL como Bidirectional Lens**
La bimodalidad OPD↔OPL no son dos parsers independientes. Es un lens formal:

```
Lens_bimodal = (expose: Graph → OPL, update: Graph × OPL_edit → Graph)

Leyes:
  PutGet: update(g, edit) |> expose = apply(edit, expose(g))
  GetPut: update(g, expose(g)) = g
```

El Domain Engine expone UN lens, no dos funciones. La UI y la CLI invocan `expose` para ver OPL y `update` para editar desde OPL. Las leyes PutGet y GetPut se verifican como tests automáticos de integridad. Si hay pérdida de información por limitación del formato, se señala explícitamente como `Functor Information Loss`.

### Fundamento Categórico

Correspondencias OPM↔CT que justifican la arquitectura:

| Concepto OPM | Construcción CT | Implicación Arquitectural |
|-------------|----------------|--------------------------|
| Thing | 0-celda | Node tipado en el Typed Category Store |
| Link | 1-celda | Edge tipado con composición verificable |
| Control modifier (event, condition) | 2-celda | Transformación natural sobre edge, no propiedad del edge |
| OPD Tree | Opfibración π: C_opm → C_opd_tree | OPDs como fibras con semántica de contención, no como "carpetas" |
| States | Subobjetos (monos: State ↪ Object) | Cascade delete por composición, reticulado exclusivo Sub(O) |
| Simulación ECA | Coalgebra S → F(S) | Evaluador paso a paso con trazas coinductivas, no loop imperativo |
| Bimodalidad OPD↔OPL | Lens bidireccional (expose/update) | Round-trip by construction con leyes PutGet/GetPut |
| Aggregation | Producto (límite) | JOINs e integridad referencial por construcción universal |
| In-zoom | Retracción en la opfibración | Nueva fibra en C_opd_tree; objetos heredados = pullback del proceso sobre su fibra |
| Generalization | Functor inclusión + pullback | Herencia de features por pullback, no por copia ad-hoc |
| Classification | Free ⊣ Forget | Instancias como evaluación del patrón libre |

### Distribución por prioridad

| Prioridad | HUs | Descripción                                                   |
| --------- | --- | ------------------------------------------------------------- |
| P0        | 13  | Motor base + persistencia + CLI                               |
| P1        | 19  | OPL bidireccional, NL, navegación inteligente, simulación ECA |
| P2        | 17  | Simulación avanzada, IA, vistas, sub-modelos                  |
| P3        | 1   | Headless simulation                                           |

### Taxonomía de evidencia

| Tipo             | Significado                                                   |
| ---------------- | ------------------------------------------------------------- |
| frame-confirmada | Capacidad observada en screenshots de OPCloud                 |
| video-confirmada | Capacidad observada en videos tutoriales de OPCloud           |
| inferida         | Capacidad deducida de la documentación o el comportamiento    |
| nueva            | Capacidad diseñada para OPModeling, sin precedente en OPCloud |

### Cadena de dependencia P0

```
Raíces (sin dependencias):
  L-M1-01 (Wizard) — invocable desde CLI sin deps de UI
  L-M1-02 (Things) — hub central, in-degree 18
  L-M3-02 (Panel)  — componente UI independiente
  L-M6-01 (Save)   — persistencia independiente
  L-M6-02 (Undo)   — stack independiente

Grafo de dependencias P0 (solo morfismos declarados):
  L-M1-02 → L-M1-03 (Links) → L-M2-01 (OPL sync)
  L-M1-02 → L-M1-06 (Estados)
  L-M1-02 → L-M3-01 (OPD tree)
  L-M1-02 → L-M1-07 (In-zoom) ← también deps L-M1-03
  L-M1-02 → L-M1-10 (Eliminar) ← también deps L-M1-03
  L-M3-01 → L-M3-03 (Toolbar)

CLI (L-M6-03) ← deps base: L-M1-02, L-M1-03, L-M1-07, L-M2-01, L-M6-01
                  se extiende incrementalmente con cada Pulso
```

### Módulos

| Módulo                     | HUs | Scope                                                                                                                                   |
| -------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| M1 Motor de Modelo         | 13  | Things, links (todos), estados, in-zoom, unfold, semi-fold, enforcement, sub-modelos                                                    |
| M2 Motor OPL + NL          | 4   | OPL sync, OPL→OPD bidireccional, NL→OPL→OPD, export OPL                                                                                 |
| M3 Navegación Inteligente  | 7   | OPD tree, panel things, toolbar+layout, minimap, búsqueda, nav semántica, cobertura                                                     |
| M4 Verificación y Consulta | 9   | Duplicación de nombres, validación, vistas aspecto, view diagrams, consulta semántica, anti-patrones, impacto, requirements, system map |
| M5 Ejecución Formal        | 9   | Simulación ECA, condiciones/bucles, computacional, assertions, deadlocks, rangos, estereotipos, user input, headless                    |
| M6 Plataforma              | 8   | Save/load graph, undo/redo, CLI `opmod`, config, templates, command palette, diff semántico                                             |

### Pulsos

| Pulso | HUs                                                                    | Entregable                                   |
| ----- | ---------------------------------------------------------------------- | -------------------------------------------- |
| P0    | L-M1-02, L-M1-03, L-M3-01, L-M3-02, L-M3-03, L-M2-01, L-M6-03(base)    | Canvas + CLI base → SD básico con OPL        |
| P1    | L-M1-06, L-M1-07, L-M1-10, L-M1-01, L-M6-01, L-M6-02                   | **MVP: modelo OPM completo, guardable**      |
| P2    | L-M1-04, L-M1-05, L-M2-02, L-M2-03, L-M2-04                            | OPL bidireccional + NL→OPL→OPD               |
| P3    | L-M1-08, L-M1-09, L-M1-11, L-M1-12, L-M3-04, L-M3-05, L-M3-06, L-M6-07 | Navegación inteligente + command palette     |
| P4    | L-M4-01, L-M4-02, L-M3-07, L-M6-04, L-M6-05                            | Validación continua + coverage               |
| P5    | L-M5-01, L-M5-02, L-M5-03, L-M5-04, L-M5-05                            | Simulación ECA + assertions + deadlocks      |
| P6    | L-M5-06, L-M5-07, L-M5-08, L-M1-13                                     | Simulación avanzada + sub-modelos            |
| P7    | L-M4-03 a L-M4-09, L-M6-06, L-M6-08, L-M5-09                           | IA + vistas + requirements + diff + headless |

---

## M1 — Motor de Modelo

### L-M1-01 — Crear modelo con SD Wizard (9 pasos + plantillas por tipo)

**Prioridad:** P0
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero crear un nuevo modelo OPM guiado por un wizard paso a paso que cubra los 9 pasos del procedimiento de modelado y me permita seleccionar el tipo de sistema, para arrancar con un SD metodológicamente correcto sin necesidad de conocer el procedimiento de memoria.

**Criterios de aceptación:**

- Given el menú principal, when hago clic en "New Model", then se cierra el modelo actual (con confirmación si hay cambios sin guardar) y se abre un canvas vacío con un tab sin nombre.
- Given pestañas de modelos abiertas, when hago clic en el botón "+", then se abre instantáneamente una nueva pestaña con un modelo vacío sin guardar.
- Given un modelo abierto ya guardado, when cambio a otra pestaña, then el modelo que dejé se autoguarda automáticamente.
- Given que el modelador inicia un nuevo modelo, when selecciona "New Model with Wizard", then se abre un asistente que implementa los 9 pasos del procedimiento de modelado OPM (ISO 19450): (1) función principal — proceso en gerundio, (2) beneficiario — singular, Group para humanos o Set para inanimados, (3) atributo del beneficiario — estado problemático y satisfactorio, (4) agente — humano habilitador, (5) nombre del sistema — default: `[Proceso] System`, (6) instrumentos adicionales, (7) inputs consumidos, (8) outputs creados, (9) entorno — things ambientales con contorno discontinuo. La navegación muestra siempre el paso OPM actual (1/9) junto con el componente SD que se está completando.
- Given que el modelador completa el wizard, when hace clic en "Finish", then OPModeling genera automáticamente el SD con todos los things nombrados, los enlaces correctos (agent, instrument, effect/input-output según corresponda) y las afiliaciones sistémico/ambiental aplicadas.
- Given que el modelador llega a la etapa de nombre del sistema, when no escribe nada, then OPModeling pre-rellena el campo con `[Proceso Principal] System` como sugerencia editable.
- Given que el modelador completa el wizard, when el SD se genera, then el OPL muestra las sentencias canónicas de propósito y función principal correctamente.
- Given que el modelador está en cualquier etapa del wizard, when hace clic en "Back", then puede retroceder y modificar datos de etapas anteriores sin perder los datos de las etapas posteriores.
- Given un wizard para sistema artificial, when el modelador llega al paso final, then el wizard presenta la pantalla adicional para la Ocurrencia del Problema (componente 5 del SD artificial). Esta pantalla no aparece para sistemas naturales.
- Given wizard abierto, when el modelador selecciona tipo "Artificial", then muestra los 5 componentes del SD artificial: (1) propósito del sistema, (2) función principal, (3) habilitadores, (4) entorno, (5) ocurrencia del problema.
- Given wizard abierto, when el modelador selecciona tipo "Natural", then muestra 3 componentes: (1) resultado, (2) función principal, (3) habilitadores; no muestra "ocurrencia del problema".
- Given wizard abierto, when el modelador selecciona tipo "Social", then muestra 5 componentes con la distinción de que los agentes pueden ser simultáneamente beneficiarios, y el componente de propósito refleja beneficio/perjuicio.
- Given wizard abierto, when el modelador selecciona tipo "Socio-Técnico", then muestra 5 componentes con soporte para agentes humanos y componentes técnicos como co-habilitadores del proceso principal.

**Dependencias:** ninguna

---

### L-M1-02 — Crear things con propiedades completas (esencia, afiliación, perseverancia)

**Prioridad:** P0
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero crear objetos y procesos en el canvas y configurar inmediatamente sus propiedades de esencia (físico/informático), afiliación (sistémico/ambiental) y perseverancia (static/dynamic), para construir los elementos fundamentales del modelo OPM con todas sus dimensiones ontológicas desde el inicio.

**Criterios de aceptación:**

- Given el canvas activo, when el modelador arrastra el ícono de proceso desde la barra de herramientas y lo suelta en el canvas, then aparece una elipse azul y se abre automáticamente un campo de texto editable para nombrar el proceso.
- Given el canvas activo, when el modelador arrastra el ícono de objeto desde la barra de herramientas y lo suelta en el canvas, then aparece un rectángulo y se abre automáticamente un campo de texto editable para nombrar el objeto.
- Given un campo de nombre abierto, when el modelador escribe el nombre y presiona Enter o hace clic en "Update", then el nombre se actualiza simultáneamente en el OPD y en el OPL.
- Given que el auto-formato está activado, when el modelador escribe el nombre de un thing, then el sistema capitaliza automáticamente la primera letra de cada palabra.
- Given que el auto-formato está activado, when el modelador lo desactiva mediante la casilla correspondiente, then el texto se conserva exactamente como fue escrito.
- Given un thing ya existente en el canvas, when el modelador hace doble clic en su nombre, then se abre el campo de edición in-place para modificar el nombre.
- Given un proceso in-zoomed activo, when el modelador arrastra un objeto desde la barra de herramientas y lo suelta dentro del contorno del proceso, then el objeto se crea como objeto interno restringido al scope de ese proceso.
- Given un objeto interno creado dentro de un proceso in-zoomed, when el modelador intenta arrastrarlo fuera del contorno, then el sistema expande el contorno del proceso en lugar de permitir que el objeto abandone su scope.
- Given un objeto seleccionado, when el modelador hace clic en "Change Affiliation" en la barra de herramientas secundaria, then el contorno del objeto cambia a línea discontinua (dashed) indicando afiliación ambiental, y el OPL refleja el cambio.
- Given un objeto seleccionado, when el modelador hace clic en "Change Essence" en la barra de herramientas secundaria, then el rectángulo pierde la sombra (esencia informática), y el OPL refleja la nueva esencia.
- Given el panel de Draggable OPM Things, when el modelador lo visualiza, then cada thing muestra indicadores de esencia, afiliación, y la relación "of [Exhibidor]" para objetos atributo. (El auto-cambio de esencia a informática al crear exhibition-characterization link se define en L-M1-04.)
- Given un thing seleccionado, when el modelador accede a sus propiedades y cambia "Perseverance" de Static a Dynamic (o viceversa), then el OPL refleja la clasificación y la representación visual se actualiza.
- Given un thing creado sin clasificación explícita de perseverancia, when el sistema determina el default, then usa el contexto predominante del sistema.
- Given un objeto que es resultado (resultee) de un proceso, when el modelador no ha configurado su perseverancia, then el sistema sugiere "Dynamic" porque su existencia depende de la ejecución del proceso que lo crea.
- Given el panel de Draggable OPM Things visible, when el modelador lo visualiza, then cada thing muestra indicadores de las tres dimensiones: esencia (físico/informático), afiliación (sistémico/ambiental) y perseverancia (static/dynamic).
- Given un proceso seleccionado, when el modelador hace clic en "Change Essence", then la elipse del proceso pierde o gana sombra (informático/físico) siguiendo la misma convención que los objetos, y el OPL refleja la esencia del proceso.
- Given que el auto-formato está activado y el modelador crea o renombra un ESTADO (no un thing), when el sistema procesa el nombre, then NO aplica capitalización automática al estado porque ISO 19450 establece que los estados se representan sin capitalización ("bold face without capitalization"); el auto-formato solo aplica a objetos y procesos.
- Given un modelo donde la mayoría de things son informaticos, when el sistema determina la Primary Essence, then la esencia por defecto de nuevos things se establece como informática; si la mayoría son físicos, se establece como física; esta regla de mayoría se recalcula al cambiar la proporción de esencias en el modelo y puede ser overridden manualmente en Settings.
- Given que el modelador crea un thing y le asigna un nombre que parece ser un verbo (ej. "Heat", "Run"), when confirma el nombre en un OBJETO, then el sistema muestra una sugerencia: "This looks like a verb — should this be a Process instead?" y ofrece convertir; análogamente, si un proceso recibe un nombre que parece sustantivo, sugiere convertir a objeto.

**Dependencias:** ninguna

---

### L-M1-03 — Crear enlaces procedurales (effect, agent, instrument, consume, result, in/out)

**Prioridad:** P0
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero crear enlaces entre things mediante arrastre con tabla filtrada y preview OPL, y crear el conjunto completo de enlaces procedurales OPM, para expresar qué transforma el proceso, quién lo ejecuta, qué consume y qué produce.

**Criterios de aceptación:**

- Given dos things en el canvas, when el modelador hace clic izquierdo en el área no-texto de un thing origen y arrastra hasta un thing destino, then el cursor cambia a crosshair durante el arrastre y al soltar se abre la tabla de tipos de enlace disponibles.
- Given la tabla de enlaces abierta, when el sistema la muestra, then solo contiene los tipos de enlace válidos según las propiedades de los things involucrados (ej. agent link aparece únicamente si el objeto es físico).
- Given la tabla de enlaces abierta, when el modelador pasa el cursor por cada opción, then se muestra la sentencia OPL que se generará.
- Given la tabla de enlaces abierta, when el modelador selecciona un tipo de enlace, then el enlace se crea y el OPL se actualiza inmediatamente.
- Given un thing en el canvas, when el modelador inicia el arrastre de enlace apuntando a un puerto específico del thing destino, then el enlace queda anclado a ese puerto.
- Given un thing en el canvas, when el modelador suelta el enlace sobre el área general, then el sistema alinea el enlace al centro del thing.
- Given varios things seleccionados con Ctrl+clic o Shift+arrastre (lasso), when el modelador inicia un enlace desde la selección múltiple hacia un destino, then todos los things seleccionados quedan conectados al destino con el tipo elegido y el sistema crea el fork visual automáticamente.
- Given un enlace seleccionado en el canvas, when el modelador hace clic izquierdo sobre el trayecto del enlace, then aparece un vértice (punto de inflexión) arrastrable para redirigir visualmente el enlace.
- Given un vértice existente en un enlace, when el modelador hace doble clic en el vértice, then el vértice se elimina y el segmento vuelve a ser recto.
- Given un objeto y un proceso en el canvas, when el modelador conecta ambos y selecciona "Effect" en la tabla de enlaces, then se crea un enlace de efecto y el OPL indica que el proceso cambia el objeto.
- Given un enlace de efecto existente, when el modelador hace clic en el ícono de intercambio junto al enlace, then el enlace de efecto se convierte automáticamente en un par in/out con los estados correspondientes, y el OPL se actualiza a "Processing changes Object from input-state to output-state".
- Given un objeto físico y un proceso, when el modelador conecta ambos y selecciona "Agent", then se crea el enlace de agente y el OPL refleja "Agent handles Processing"; la tabla de enlaces solo ofrece agent link si el objeto es físico Y es humano o grupo humano (ISO 19450: "a human or a group of humans capable of intelligent decision-making"); para habilitadores no humanos, el sistema ofrece instrument link.
- Given un objeto y un proceso, when el modelador conecta ambos y selecciona "Instrument", then se crea el enlace de instrumento y el OPL indica que el proceso requiere el objeto.
- Given un objeto y un proceso, when el modelador selecciona "Consumption", then se crea el enlace de consumo y el OPL indica que el proceso consume el objeto.
- Given un proceso y un objeto, when el modelador arrastra desde el proceso hacia el objeto y selecciona un enlace de resultado (result/output), then el OPL refleja que el proceso produce el objeto.
- Given un estado específico de un objeto, when el modelador arrastra desde ese estado hacia un proceso, then la tabla muestra opciones de input link, consumption link, in/out link pair, condition, event, state-specified agent link y state-specified instrument link referenciadas al estado de origen; para agent/instrument el OPL refleja "Qualifying-state Agent handles Processing" o "Processing requires qualifying-state Instrument".
- Given un proceso y un estado específico de un objeto, when el modelador arrastra desde el proceso hacia ese estado, then se crea un enlace de salida que especifica el estado resultante y el OPL lo refleja.
- Given un enlace procedural existente, when el modelador hace clic derecho sobre él, then se abre un panel con campos editables de multiplicidad fuente, multiplicidad destino, tag y probabilidad de ruta.
- Given un objeto stateful y un proceso, when el modelador arrastra desde un estado específico del objeto hacia el proceso y luego arrastra desde el proceso de vuelta al objeto (sin apuntar a un estado específico), then se crea un input-specified effect link y el OPL refleja "Processing changes Object from input-state" (sin especificar estado de salida).
- Given un objeto stateful y un proceso, when el modelador arrastra desde el objeto (sin apuntar a un estado) hacia el proceso y luego arrastra desde el proceso hacia un estado específico del objeto, then se crea un output-specified effect link y el OPL refleja "Processing changes Object to output-state" (sin especificar estado de entrada, el objeto puede estar en cualquier estado).

**Invariantes categóricos de implementación:**

- Given el Domain Engine con enlaces procedurales creados, when se verifica la composición de 1-celdas, then si existen f:A→B y g:B→C como links procedurales, la composición g∘f:A→C es representable y verificable en el Typed Category Store; la composición es asociativa: h∘(g∘f) = (h∘g)∘f.
- Given el Domain Engine con un enlace procedimental creado como 1-celda, when se le aplica un control modifier (event 'e' o condition 'c'), then el modifier se almacena como 2-celda (transformación natural sobre la 1-celda), no como propiedad del edge; la distinción preserva la estructura bicategórica del dominio OPM.

**Dependencias:** L-M1-02

---

### L-M1-04 — Crear enlaces estructurales y avanzados (aggregation, exhibition, gen/spec, condition, tagged, exception, invocation)

**Prioridad:** P1
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero crear enlaces estructurales OPM (composición, caracterización, generalización, instanciación) y enlaces avanzados (condicionales, etiquetados, de excepción e invocación), para modelar la arquitectura estática del sistema y la lógica de control de flujo.

**Criterios de aceptación:**

- Given un objeto parte y un objeto todo en el canvas, when el modelador los conecta y selecciona el enlace de agregación-participación, then se crea el enlace con el triángulo sólido negro apuntando al todo y el OPL refleja "Whole consists of Part1, Part2, and Part3".
- Given múltiples partes conectadas al mismo todo, when el sistema renderiza los enlaces, then los arcos de agregación se bifurcan automáticamente (fork) desde un punto común.
- Given un objeto exhibidor y un objeto atributo, when el modelador los conecta y selecciona el enlace de exhibición-caracterización, then se crea el enlace y el atributo cambia automáticamente a esencia informática.
- Given múltiples things en el canvas, when el modelador los conecta a un thing general mediante enlace de generalización-especialización, then los enlaces se crean con el triángulo de generalización y el OPL refleja "Specialization is a General".
- Given múltiples things en el canvas, when el modelador los conecta a un thing clase mediante enlace de clasificación-instanciación, then los enlaces se crean con el ícono de instanciación y el OPL refleja "Instance is an instance of Class".
- Given un enlace de generalización existente, when el modelador cambia el tipo a clasificación-instanciación (o viceversa), then el ícono visual y el OPL se actualizan sin necesidad de eliminar y recrear el enlace.
- Given un objeto exhibidor y un PROCESO, when el modelador los conecta y selecciona el enlace de exhibición-caracterización, then se crea el enlace y el OPL refleja "Exhibitor exhibits Operation"; este es el ÚNICO enlace estructural que puede conectar un objeto con un proceso.
- Given un modelador que intenta conectar un objeto con un proceso usando un enlace de agregación-participación o generalización-especialización, when la tabla de enlaces se muestra, then esos tipos NO aparecen como opciones.
- Given un objeto o estado y un proceso, when el modelador selecciona "Condition" (modificador 'c') en la tabla de enlaces, then el enlace muestra la letra 'c' y el OPL indica "Process occurs if Object exists/is state, otherwise Process is skipped".
- Given un objeto o estado y un proceso, when el modelador selecciona "Event" (modificador 'e') en la tabla de enlaces, then el enlace muestra la letra 'e' y el OPL indica "Object triggers Process".
- Given un enlace de condición o evento, when el modelador activa el modificador "NOT", then el OPL refleja la negación.
- Given un enlace unidireccional entre dos things, when el modelador selecciona el tipo de enlace etiquetado y edita el campo "tag", then la etiqueta personalizada aparece sobre el enlace en el OPD y el OPL la incorpora en la sentencia.
- Given dos things en el canvas, when el modelador selecciona un enlace etiquetado sin escribir tag (null-tagged), then el sistema usa "relates to" como tag default y el OPL refleja "Source-thing relates to Destination-thing".
- Given un enlace etiquetado unidireccional existente, when el modelador activa la opción "Bidirectional", then aparecen dos campos de tag (uno por dirección) y el OPL genera dos sentencias.
- Given un enlace etiquetado existente, when el modelador activa la opción "Reciprocal", then se muestra un solo campo de tag compartido para ambas direcciones; si no hay tag, el default es "are related".
- Given un enlace estructural etiquetado (unidireccional, bidireccional o recíproco), when el modelador hace clic en el endpoint del enlace y selecciona "Connect to State", then el enlace se ancla a un estado específico del thing (source state-specified, destination state-specified, o ambos), y el OPL refleja la asociación al estado calificador; esto habilita las 7 variantes de state-specified tagged structural links definidas en ISO 19450.
- Given dos procesos en el canvas, when el modelador los conecta y selecciona el enlace de invocación, then se crea una flecha de invocación del proceso origen al proceso destino y el OPL refleja la invocación.
- Given un proceso en el canvas, when el modelador conecta el proceso consigo mismo mediante enlace de invocación (auto-invocación), then el enlace aparece como un arco que sale y vuelve al mismo proceso.
- Given un enlace de auto-invocación, when el modelador edita la duración de tiempo entre iteraciones (por defecto 1 segundo), then aparece un ícono de reloj junto al enlace con el intervalo configurado.
- Given un enlace de auto-invocación, when el modelador activa la opción "Add Waiting Process", then aparece un subproceso "Waiting" explícito en el in-zoom del proceso.
- Given dos enlaces del mismo tipo en el mismo puerto de un thing, when el modelador superpone un nuevo enlace sobre uno existente, then el sistema crea automáticamente un arco XOR entre ellos y el OPL indica "exactly one of".
- Given un arco XOR existente, when el modelador hace clic en el ícono del arco, then alterna entre XOR (exactamente uno) y OR (al menos uno), actualizando el OPL.
- Given un link fan XOR/OR cuyos enlaces originan desde estados específicos de un objeto, when el sistema evalúa el fan durante modelado o simulación, then la selección se basa en el estado actual del objeto: el enlace cuyo estado calificador coincide con el estado actual es el que se activa; el OPL refleja los estados calificadores de cada rama del fan.
- Given un proceso con duración máxima configurada y otro proceso en el modelo, when el modelador conecta ambos y selecciona "Overtime Exception" en la tabla de enlaces, then se crea un enlace de excepción y el OPL indica "if [Process] exceeds [max-duration], then [Exception-Process] is activated".
- Given un proceso sin duración máxima configurada, when el modelador intenta crear un enlace de overtime exception desde ese proceso, then el sistema rechaza la operación con mensaje: "Overtime exception requires max duration — configure Time Duration first".
- Given un enlace de generalización-especialización existente entre un General y sus Specializations, when el modelador marca un atributo del General como "Discriminating Attribute", then cada Specialization debe tener asignado un subconjunto restringido de los valores posibles de ese atributo; el OPL refleja la restricción y el sistema valida que los valores de cada Specialization sean un subconjunto del General.
- Given un General con un Discriminating Attribute y una Specialization conectada, when el modelador asigna un valor al discriminating attribute en la Specialization, then ese valor restringe la Specialization a solo ese subconjunto de estados/valores; la herencia de los demás features y states del General se aplica automáticamente a la Specialization.
- Given un enlace de generalización-especialización existente, when el sistema procesa la herencia, then los features (atributos y operaciones), states, y enlaces del General se propagan automáticamente a cada Specialization; los elementos heredados se muestran con indicador visual de "heredado" y son de solo lectura en la Specialization (el modelador puede override creando un feature local con el mismo nombre).
- Given un Specialized Object que exhibe un valor específico para un Discriminating Attribute del General, when el modelador crea el enlace exhibition-characterization desde el Specialized Object al valor, then se crea un state-specified characterization link y el OPL refleja "Specialized-object exhibits value-name Attribute-Name" según ISO 19450.
- Given un enlace de clasificación-instanciación entre un Class y sus Instances, when el modelador crea una Instance, then los features definidos por el pattern del Class requieren valores explícitos en la Instance; el sistema muestra campos editables para cada feature heredado y el OPL refleja "Instance-thing is an instance of Class-thing" con los valores asignados.
- Given cualquier enlace procedimental existente (transforming: consumption, effect, result, input/output pair, input-specified, output-specified; enabling: agent, instrument) con o sin state-specification, when el modelador aplica un modifier 'e' (event) o 'c' (condition), then el sistema genera la sentencia OPL compuesta según la gramática ISO 19450 correspondiente, combinando la sentencia base del enlace con la semántica del modifier; ejemplos: "Object triggers Process, which consumes Object" (consumption + event), "Agent handles Process if Agent is qualifying-state, else Process is skipped" (condition + state-specified agent), "Input-state Object triggers Process, which changes Object from input-state to output-state" (input-output-specified effect + event), "Process occurs if Object is input-state, in which case Process changes Object from input-state to output-state, otherwise Process is skipped" (condition + input-output-specified effect).
- Given un link fan (XOR o OR) cuyos enlaces tienen modifiers de control ('e' o 'c'), when el sistema renderiza el fan, then los modifiers se preservan en cada rama del fan y la OPL de cada rama refleja su combinación específica de tipo de enlace + modifier + state-specification; esto habilita control-modified link fans como tipo diferenciado.

**Invariantes categóricos de implementación:**

- Given el Domain Engine con enlaces estructurales, when se verifica la semántica de cada tipo, then: Aggregation = producto (límite) con integridad referencial por construcción universal; Exhibition = fibración (el atributo exhibido vive en la fibra del exhibidor); Generalization = functor de inclusión con pullback de herencia (features del General se propagan por pullback, no por copia ad-hoc); Classification = Free ⊣ Forget (instancias como evaluación del patrón libre del Class).
- Given un enlace exhibition-characterization creado entre un exhibidor y un atributo, when el Domain Engine procesa la creación, then ejecuta el endofunctor ExhibitionAction: C_opm → C_opm que fuerza essence(attribute) := Informatical; este side-effect es por construcción functorial, no por constraint ad-hoc.

**Dependencias:** L-M1-02, L-M1-03

---

### L-M1-05 — Propiedades de enlaces y enforcement OPM (multiplicidad, probabilidad, unicidad)

**Prioridad:** P1
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero configurar multiplicidad, probabilidad, tasa de consumo y ruta de ejecución en los enlaces, y que el sistema impida crear más de un enlace procedimental entre el mismo par proceso-objeto en un mismo nivel de abstracción, para expresar cuantificación y garantizar la invariante de unicidad del enlace procedimental definida en ISO 19450.

**Criterios de aceptación:**

- Given las propiedades de un enlace abiertas, when el modelador edita el campo "Source Multiplicity" o "Target Multiplicity" con un número entero, then el número aparece junto al enlace en el OPD y el OPL pluraliza automáticamente el nombre del thing cuando la multiplicidad es mayor a 1.
- Given el campo de multiplicidad, when el modelador ingresa un rango con notación de dos puntos (ej. "1..5"), then el OPL refleja el rango como "1 to 5 Objects".
- Given el campo de multiplicidad, when el modelador ingresa "?", then el OPL muestra "optional Object" (equivalente a 0..1).
- Given el campo de multiplicidad, when el modelador ingresa "+", then el OPL muestra "one or more Objects" (equivalente a 1..n).
- Given el campo de multiplicidad, when el modelador ingresa "0..many", then el OPL muestra "zero or more Objects".
- Given el campo de multiplicidad, when el modelador ingresa una expresión con variable y restricción (ej. "2 or 3*n" con "n <= 4"), then el OPL refleja la expresión completa incluyendo la restricción.
- Given un enlace que forma parte de un XOR link fan, when el modelador edita el campo "Probability" con un valor entre 0 y 1, then la probabilidad se muestra junto al enlace y el OPL indica "at probability of [valor]".
- Given múltiples enlaces procedurales desde un mismo proceso formando un link fan con probabilidades asignadas, when el modelador modifica la probabilidad de cualquier enlace, then el sistema muestra la suma actual de probabilidades; si la suma difiere de 1.0, se muestra una advertencia visual en todos los enlaces del fan indicando "Probability sum = [valor] (must be 1.0)".
- Given un enlace de consumo, when el modelador edita el campo "Rate" con valor numérico y unidad de medida, then el OPL refleja "at a rate of [valor] [unidad]" y el indicador aparece junto al enlace en el OPD.
- Given el campo "Rate", when el modelador selecciona la unidad desde el selector (ej. second, minute, meter per second), then la unidad seleccionada se refleja correctamente en el OPL y en el OPD.
- Given las propiedades de un enlace, when el modelador edita el campo "Path" con una etiqueta de ruta, then la etiqueta aparece junto al enlace y el OPL incluye "following path [etiqueta]".
- Given múltiples enlaces con path labels asignados, when el modelador agrupa una o más etiquetas de ruta en un "Scenario" desde el menú de paths, then el Scenario define un conjunto específico de enlaces a seguir durante simulación; al seleccionar un Scenario activo, solo los enlaces con etiquetas pertenecientes a ese Scenario participan en la ejecución.
- Given un enlace estructural (agregación-participación), when el modelador activa la opción "Ordered", then el OPL lista las partes en el orden visual del diagrama (arriba-abajo o izquierda-derecha).
- Given un enlace estructural sin la opción "Ordered", when el sistema genera el OPL, then las partes aparecen en orden alfabético ascendente.
- Given un enlace ordenado, when el modelador reposiciona una parte en el OPD, then el OPL actualiza automáticamente el orden de la secuencia.
- Given las propiedades de un enlace, when el modelador hace hover sobre el ícono "?" junto a cualquier campo, then se muestra un tooltip con la descripción del campo y los formatos/valores aceptados.
- Given un enlace de agregación-participación, when el modelador edita el campo de multiplicidad de la parte, then la multiplicidad se refleja en el OPL; las mismas notaciones de rango, opcionalidad y expresiones aplican a enlaces estructurales.
- Given un enlace procedimental existente entre proceso P y objeto O, when el modelador intenta crear segundo enlace procedimental entre P y O, then el sistema rechaza con mensaje explicativo citando la regla ISO 19450.
- Given un enlace procedimental en SD, when el modelador crea un enlace diferente en SD1 (otro nivel), then el sistema permite.
- Given un enlace procedimental entre proceso P y objeto O, when el modelador intenta crear un enlace procedimental entre P y un ESTADO de O (en el mismo nivel de abstracción), then el sistema lo permite porque la unicidad aplica al par (proceso, objeto-o-estado).
- Given un enlace procedimental entre P y O en SD, when el mismo par P-O aparece en SD1 por herencia de in-zoom, then el sistema NO lo cuenta como violación porque la herencia es una propagación visual, no un segundo enlace lógico.
- Given un enlace procedimental existente entre P y O, when el modelador quiere cambiar el tipo, then el sistema ofrece "Convert" como opción primaria, eliminando el enlace existente y creando el nuevo en una sola operación atómica.
- Given un modelo con sub-modelos, when un thing compartido tiene un enlace procedimental en el modelo principal, then el sub-modelo puede tener un enlace procedimental diferente al mismo thing compartido porque los sub-modelos operan en un nivel de abstracción independiente.
- Given un objeto que es transformee de un proceso (connected via effect, consume o result link), when el modelador añade un modifier 'e' (event) o 'c' (condition) al mismo enlace, then el sistema lo permite porque OPM permite que un transformee sea simultáneamente trigger de evento o condición; la unicidad aplica al par (objeto, proceso) no al número de modifiers en ese enlace.

**Dependencias:** L-M1-03, L-M1-04

---

### L-M1-06 — Estados de objetos (crear, initial/final/default, suprimir)

**Prioridad:** P0
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero agregar estados a los objetos, nombrarlos, marcarlos como inicial/final/default/current y suprimirlos, para modelar el ciclo de vida completo de los objetos en el sistema OPM.

**Criterios de aceptación:**

- Given un objeto en el canvas, when el modelador hace clic en "Add States" desde el halo o la barra secundaria, then aparecen dos rectángulos de esquinas redondeadas dentro del objeto con nombres genéricos ("state 1", "state 2") y el objeto se convierte en stateful.
- Given un objeto ya stateful, when el modelador hace clic en "Add States" nuevamente, then se agrega exactamente un estado adicional por cada clic.
- Given estados recién creados, when el modelador confirma el nombre del primer estado con Enter o "Update", then el cursor salta automáticamente al siguiente estado sin nombre para nombrarlo secuencialmente.
- Given un estado seleccionado, when el modelador hace clic en "Initial State" desde el halo o la barra secundaria, then el contorno del estado se vuelve grueso (bold) indicando estado inicial y el OPL lo refleja.
- Given un estado seleccionado, when el modelador hace clic en "Final State", then el estado muestra doble contorno indicando estado final.
- Given un estado seleccionado, when el modelador hace clic en "Default", then una flecha diagonal abierta apunta al estado marcado como default.
- Given un estado seleccionado, when el modelador hace clic en "Current State", then el estado se resalta visualmente como estado activo (útil para simulación).
- Given un objeto stateful seleccionado, when el modelador hace clic en "Suppress States", then los estados no conectados a enlaces desaparecen y se muestra un pseudoestado con tres puntos (...) y el número de estados suprimidos; al hacer hover sobre el pseudoestado se muestran los nombres de los estados ocultos.
- Given un pseudoestado (elipsis con tres puntos), when el modelador hace doble clic en él, then todos los estados ocultos vuelven a ser visibles.
- Given un estado específico seleccionado, when el modelador hace clic en "Suppress" en su halo, then solo ese estado se oculta; los demás permanecen visibles y la operación se impide si el estado está conectado a un enlace.
- Given un objeto stateful, when el modelador usa las opciones de alineación (izquierda, arriba, derecha, abajo), then los estados se reposicionan dentro del objeto según la alineación seleccionada.
- Given un estado seleccionado, when el modelador hace clic en "Delete" en su halo, then el estado se elimina y si está conectado a enlaces se solicita confirmación previa.
- Given que un mismo estado está marcado como Initial, when el modelador también lo marca como Final, then el sistema permite la coexistencia de ambas marcas y el OPL refleja ambas propiedades.
- Given un objeto stateful con un estado marcado como Default, when un proceso con enlace de efecto (sin estado de entrada especificado) afecta a este objeto, then el sistema asume que el objeto está en su estado Default como estado de entrada implícito; si no hay Default configurado, el sistema lo señala como advertencia.
- Given un objeto stateful sin estado Default configurado, when el modelador ejecuta la validación metodológica, then el validador emite una advertencia: "Object [name] has states but no default state — simulation may produce ambiguous results".

**Invariantes categóricos de implementación:**

- Given el Domain Engine con estados creados para un objeto, when se verifica la estructura de subobjetos, then cada State es un mono (inyección) State ↪ Object en el Typed Category Store; el reticulado Sub(O) es exclusivo (un objeto está en exactamente un estado o en transición entre estados); eliminar el object-node cascadea la eliminación de todos sus state-nodes por composición del mono, no por constraint ad-hoc.

**Dependencias:** L-M1-02

---

### L-M1-07 — In-zoom de procesos y objetos

**Prioridad:** P0
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero hacer in-zoom a un proceso para crear un OPD descendiente que revele sus subprocesos con orden temporal, y distribuir o reagrupar los enlaces entre el contorno y los subprocesos individuales, para modelar el comportamiento interno a cualquier nivel de detalle.

**Criterios de aceptación:**

- Given un proceso en el canvas, when el modelador hace clic en "In-zoom" desde el halo o la barra secundaria, then se crea un nuevo OPD en el árbol OPD (ej. "SD1"), el canvas navega automáticamente a ese OPD, y se muestra el contorno del proceso in-zoomed vacío con un prompt "Add sub-processes"; el sistema requiere al menos 2 subprocesos antes de permitir guardar. Si el modelador prefiere arranque rápido, un botón "Quick Start" genera 3 subprocesos genéricos como heurística UX.
- Given un proceso con in-zoom ya existente, when el modelador hace clic en "In-zoom" desde el halo, then el canvas navega directamente al OPD descendiente existente sin crear un duplicado.
- Given un proceso in-zoomed, when el sistema crea el OPD descendiente, then los objetos conectados al proceso en el OPD padre aparecen automáticamente fuera del contorno del proceso in-zoomed con sus enlaces originales conectados al contorno exterior.
- Given un subproceso genérico dentro de un in-zoom, when el modelador hace doble clic en su nombre, then se abre el campo de edición para reemplazarlo con el nombre real del subproceso.
- Given subprocesos en distintas posiciones verticales dentro del in-zoom, when el modelador los reordena arrastrándolos, then posicionar subprocesos al mismo nivel horizontal hace que el OPL los refleje como ejecución en paralelo; posiciones en distintos niveles verticales los refleja como ejecución secuencial.
- Given un enlace conectado al contorno exterior de un proceso in-zoomed, when el modelador hace clic en el ícono "distribuir enlaces", then los enlaces se transfieren del contorno externo a cada subproceso individual.
- Given enlaces distribuidos a subprocesos individuales, when el modelador hace clic en el ícono de redistribuir, then los enlaces vuelven al contorno exterior.
- Given un enlace conectado al contorno exterior del proceso in-zoomed, when el sistema genera el OPL, then ese enlace equivale semánticamente a una conexión con todos los subprocesos.
- Given un proceso in-zoomed con múltiples subprocesos en distintos niveles verticales, when el sistema genera el OPL, then el OPL refleja la invocación implícita como secuencia ordenada de subprocesos; esta invocación implícita NO genera un enlace gráfico visible — el orden vertical ES la invocación.
- Given un OBJETO (no proceso) en el canvas, when el modelador hace clic en "In-zoom", then se crea un OPD descendiente que revela los objetos constituyentes con orden espacial o lógico; a diferencia del in-zoom de procesos (donde el orden vertical es temporal), en el in-zoom de objetos la posición espacial de los objetos internos tiene significado (ej. secciones de un documento: título → resumen → cuerpo) y el OPL refleja el orden unidimensional de las partes.
- Given el modelador está en un OPD descendiente creado por in-zoom (de proceso u objeto), when hace clic en "Out-zoom" desde el halo del thing refinado o desde la barra secundaria, then el canvas navega al OPD padre y resalta el thing que fue in-zoomed; Out-zoom es la operación inversa de In-zoom y equivale a "Go to Parent" pero con el contexto semántico de colapsar el refinamiento.

**Invariantes categóricos de implementación:**

- Given el Domain Engine con un in-zoom ejecutado sobre un proceso p, when se crea el OPD descendiente, then la operación implementa una retracción en la opfibración π: C_opm → C_opd_tree generando una nueva fibra OPD_{p} en C_opd_tree. Los objetos "heredados" del OPD padre son el pullback del proceso sobre su fibra: exactamente los objetos del padre conectados a p aparecen como externos en OPD_{p}. El diagrama conmuta: External_Objects → OPD_{parent} ↓ OPD_{child} → Process p.

**Dependencias:** L-M1-02, L-M1-03

---

### L-M1-08 — Unfold y semi-fold

**Prioridad:** P1
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero desplegar los componentes de un objeto mediante unfold en el OPD actual, y activar la vista semi-fold para ver una representación compacta de sus partes con control sobre qué componentes se muestran internamente y cuáles se extraen al OPD, para revelar la estructura interna de objetos complejos sin crear un nuevo OPD.

**Criterios de aceptación:**

- Given un objeto con partes o atributos definidos, when el modelador hace clic en "Unfold" desde el halo, then los componentes del objeto se despliegan en el OPD actual con enlaces de agregación-participación visibles.
- Given un objeto que ha sido desplegado mediante unfold, when el modelador arrastra los objetos desplegados para reordenarlos visualmente, then los objetos se reposicionan pero el OPL refleja el mismo contenido semántico sin alterar el orden lógico.
- Given un objeto que ha sido previamente unfolded en otro OPD, when el modelador lo observa en el OPD actual sin activar semi-fold, then el objeto aparece como un rectángulo con contorno grueso (bold) indicando que tiene refinamiento, sin mostrar partes internas.
- Given un objeto con contorno bold en el OPD, when el modelador lo selecciona y hace clic en el botón "Semi-Fold" de la barra secundaria, then el objeto muestra internamente una lista compacta de los nombres de sus partes/atributos.
- Given un objeto en vista semi-fold, when el modelador hace clic en un componente listado dentro del semi-fold, then ese componente se oculta de la lista; al hacer clic nuevamente, reaparece; los enlaces correspondientes se ajustan en ambos casos.
- Given un objeto en vista semi-fold, when el modelador hace doble clic en el nombre de una parte dentro del semi-fold, then la parte aparece fuera del contorno del objeto como thing independiente con sus enlaces; el contador de partes ocultas en el enlace semi-fold decrece en 1.
- Given un objeto en vista semi-fold con una parte extraída externamente, when el modelador pasa el cursor sobre el enlace estructural de esa parte y hace clic en el ícono que aparece, then la parte vuelve a la lista interna del semi-fold y su instancia visual externa desaparece del OPD.
- Given un objeto en vista semi-fold con partes que no están expresadas externamente en el OPD, when el enlace estructural es visible, then aparece un número junto al enlace indicando cuántas partes no están expresadas externamente.
- Given un objeto en vista semi-fold con partes suprimidas, when el OPL está visible, then el OPL muestra una sentencia indicando las partes no expresadas (ej. "Object consists of Object3 and 2 more parts").
- Given un objeto en vista semi-fold donde alguna parte ya está expresada externamente en el OPD, when el modelador consulta la lista interna del semi-fold, then esa parte no aparece duplicada en la lista interna.
- Given un objeto en vista semi-fold con un sub-objeto visible en la lista interna, when el modelador arrastra un enlace desde el triángulo de ese sub-objeto hacia otro thing en el OPD, then el enlace se crea directamente desde la parte interna del semi-fold al thing externo.
- Given un objeto en vista semi-fold con una parte extraída que tiene enlaces creados hacia ella, when el modelador la reinserta de vuelta al semi-fold, then los enlaces que apuntaban a la parte extraída se redirigen visualmente al contorno del objeto semi-fold.

**Dependencias:** L-M1-02, L-M1-04, L-M1-07

---

### L-M1-09 — Objetos internos vs externos en in-zoom

**Prioridad:** P1
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero que OPModeling distinga y haga cumplir la diferencia entre objetos internos y externos en un proceso in-zoomed, para mantener la coherencia del scope semántico OPM sin cambios accidentales de clasificación.

**Criterios de aceptación:**

- Given un proceso in-zoomed visible en el OPD, when el modelador arrastra un nuevo objeto desde la barra de herramientas directamente dentro del contorno del proceso in-zoomed, then el objeto se crea como objeto interno cuya existencia está limitada al scope de ese proceso.
- Given un objeto creado fuera del contorno de un proceso in-zoomed, when el modelador lo arrastra visualmente sobre el contorno del in-zoom y lo suelta cerca del borde, then el objeto mantiene su condición de externo aunque visualmente esté superpuesto al contorno del in-zoom.
- Given un objeto externo siendo arrastrado, when el modelador lo suelta demasiado dentro del contorno de un proceso in-zoomed, then el sistema expulsa automáticamente el objeto fuera del contorno y muestra un mensaje de advertencia indicando que el objeto es externo y no puede residir dentro del in-zoom.
- Given un proceso in-zoomed que ha sido agrandado hasta envolver un objeto externo preexistente, when el modelador intenta mover ese objeto, then el objeto salta fuera del contorno del in-zoom y se muestra un mensaje de advertencia.
- Given el mensaje de advertencia por auto-eyección, when aparece, then indica que el objeto es externo, que no puede residir dentro del in-zoom, y sugiere crearlo directamente dentro o usar draggable OPM things para insertarlo como interno.
- Given el panel de Draggable OPM Things visible, when el modelador arrastra un thing desde ese panel directamente dentro del contorno del in-zoom, then el thing se inserta como objeto interno del proceso in-zoomed.
- Given un proceso in-zoomed con un thing ya clasificado como interno, when el modelador intenta crear otra instancia del mismo thing como externo en el mismo OPD, then el sistema advierte que un thing no puede ser simultáneamente interno y externo.
- Given un objeto interno en un proceso in-zoomed, when el modelador lo arrastra fuera del contorno y luego elimina la instancia interna, then el objeto queda clasificado como externo al proceso in-zoomed.

**Dependencias:** L-M1-07

---

### L-M1-10 — Eliminar things y links

**Prioridad:** P0
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero eliminar things y enlaces con control explícito sobre si se elimina solo la aparición visual o el elemento completo del modelo, para mantener la integridad estructural del modelo durante la edición.

**Criterios de aceptación:**

- Given un thing con una sola instancia visual en el modelo, when el modelador lo elimina (desde el halo, la barra secundaria o la tecla Delete), then el thing y todos sus enlaces asociados se eliminan directamente del modelo completo.
- Given un thing con múltiples instancias visuales en distintos OPDs, when el modelador intenta eliminarlo, then se abre un diálogo que muestra todas las instancias con opciones para eliminar una aparición específica o todas las instancias globalmente.
- Given un enlace seleccionado, when el modelador hace clic en el botón de eliminar, then aparece un diálogo con opciones: "Remove appearance" (eliminar solo la aparición visual en este OPD) o "Remove from entire model" (eliminación permanente del modelo).
- Given múltiples enlaces seleccionados, when el modelador hace clic en eliminar, then el diálogo muestra la lista de todos los enlaces seleccionados con opciones individuales de eliminación para cada uno.
- Given un enlace seleccionado, when el modelador hace clic en "Remove Relation" en el panel de propiedades del enlace (clic derecho), then el enlace se elimina del modelo sin pasar por el diálogo de eliminación visual.

**Dependencias:** L-M1-02, L-M1-03

---

### L-M1-11 — Halo contextual por tipo (+ duración temporal)

**Prioridad:** P1
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero que al seleccionar cualquier thing aparezca un halo con acciones contextuales rápidas adaptadas al tipo de elemento, y poder especificar la duración nominal, mínima y máxima de los procesos, para ejecutar las operaciones más comunes sin interrumpir el flujo de construcción y modelar la dimensión temporal del sistema.

**Criterios de aceptación:**

- Given un thing seleccionado en el canvas, when el modelador lo selecciona con clic, then aparece el halo adyacente al thing con íconos de acciones rápidas pertinentes al tipo (objeto o proceso).
- Given el halo de un thing, when el modelador hace clic en los tres puntos (...), then el halo se expande mostrando opciones adicionales: unfold, in-zoom, cambiar a proceso computacional, eliminar, duración temporal, estilo y "bring connected elements".
- Given el halo de un proceso, when el modelador hace clic en "In-zoom", then se ejecuta la acción de in-zoom.
- Given el halo de un thing, when el modelador hace clic en "Unfold", then se despliegan los componentes del thing con enlaces de agregación-participación en el OPD actual.
- Given el halo de un proceso, when el modelador hace clic en "Computational Process", then el proceso cambia su representación visual para indicar que es computacional.
- Given el halo de un thing, when el modelador hace clic en "Delete", then se abre el diálogo de eliminación mostrando todas las instancias visuales del thing en el modelo.
- Given el halo de un proceso, when el modelador hace clic en "Time Duration", then se abre un campo para ingresar duración nominal, mínima y máxima; los valores aparecen dentro del proceso (nominal al centro, mínima a la izquierda, máxima a la derecha).
- Given que el modelador ingresa únicamente la duración nominal, when confirma la entrada, then el valor de duración aparece dentro de la elipse del proceso debajo del nombre con la unidad de tiempo especificada.
- Given un estado de objeto seleccionado, when el modelador hace clic en "Time Duration" en su halo, then se abre un diálogo con campos de unidad de tiempo, duración mínima, nominal y máxima; al confirmar, la duración aparece visualmente junto al estado y el OPL lo refleja.
- Given un estado de objeto con duración temporal configurada, when el modelador desactiva la visualización, then la duración desaparece del OPD pero permanece almacenada y puede reactivarse.
- Given el halo de un thing, when el modelador hace clic en "Bring Connected Things", then se traen al OPD actual los things con enlace directo al thing seleccionado según la configuración de defaults (ver L-M3-06 para detalle de filtros y alcance); things conectados transitivamente vía jerarquía padre-hijo no se incluyen.
- Given el halo de un thing, when el modelador accede a las opciones de estilo, then se abre el panel de estilo accesible desde la barra secundaria.

**Dependencias:** L-M1-02, L-M1-06, L-M1-07, L-M1-08

---

### L-M1-12 — Redimensionamiento de things

**Prioridad:** P1
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero controlar el tamaño de los things mediante modos automático y manual, para ajustar la densidad visual del diagrama sin perder legibilidad del texto durante la construcción.

**Criterios de aceptación:**

- Given cualquier thing en el OPD, when el modelador intenta reducir su tamaño por debajo del mínimo establecido por OPModeling, then el redimensionamiento se detiene en el tamaño mínimo; el thing se puede agrandar libremente sin restricción.
- Given un thing seleccionado, when el modelador hace clic en "Fit to Text" (Shrink to Text Size) en el grupo Entities Extension, then OPModeling reduce automáticamente el thing al tamaño exacto de su texto; si el modelador lo redimensiona manualmente después, el auto-sizing permanece activo y el tamaño vuelve al auto-calculado.
- Given un thing en modo automático, when el modelador hace clic en "Toggle Auto Sizing" en el grupo Entities Extension, then el thing entra en modo manual: aparece un ícono GIF indicando modo manual, el modelador puede redimensionar libremente y el texto nunca se recorta (se reacomoda si el espacio es reducido).
- Given un thing en modo manual (con ícono GIF visible), when el modelador hace clic nuevamente en "Toggle Auto Sizing", then el ícono GIF desaparece y el thing vuelve al modo automático.
- Given un thing en modo automático, when el texto crece por renombrado, then OPModeling aplica word-wrapping automático hasta respetar el tamaño mínimo.
- Given un thing en modo manual, when el modelador reduce el tamaño del contorno, then el texto siempre permanece visible completo (sin recorte ni truncamiento).

**Dependencias:** L-M1-02

---

### L-M1-13 — Sub-modelos (crear, abrir, sincronizar, restricciones)

**Prioridad:** P2
**Módulo:** Motor de Modelo
**Evidencia:** frame-confirmada

Como modelador, quiero crear sub-modelos desde el modelo principal, abrirlos en pestañas separadas y mantener la sincronización automática de cambios con aplicación de restricciones de integridad sobre things compartidos, para habilitar trabajo paralelo sobre subsistemas con una interfaz compartida controlada.

**Criterios de aceptación:**

- Given un modelo principal abierto, when el modelador selecciona un conjunto válido de things (mínimo: un objeto + un proceso conectados por exhibition-characterization link + instrument link, sin refinamiento previo) y hace clic en "Connect Sub-model", then OPModeling crea un sub-modelo con esos things como interfaz compartida; si la selección no cumple los requisitos mínimos, el sistema la rechaza con un mensaje descriptivo.
- Given la creación de un sub-modelo, when el modelador asigna un nombre al sub-modelo, then el archivo del sub-modelo se denomina "[Modelo Principal] [Nombre Subsistema]"; el nombre solo puede modificarse desde el modelo principal.
- Given un sub-modelo creado, when el modelo principal está abierto y el sub-modelo no ha sido cargado, then el nodo del sub-modelo en el árbol OPD no muestra ícono de estado; al cargarlo mediante "Fetch/Load", el ícono cambia a verde si está sincronizado.
- Given un sub-modelo cargado y sincronizado, when el sub-modelo tiene cambios no sincronizados, then el ícono del nodo en el árbol OPD cambia de verde a amarillo.
- Given un nodo de sub-modelo en el árbol OPD, when el modelador hace clic derecho y selecciona "Open in New Tab", then el sub-modelo se abre en una nueva pestaña del navegador.
- Given un sub-modelo abierto, when los things compartidos son visibles en el canvas, then se muestran con apariencia transparente tanto en el modelo principal como en el sub-modelo.
- Given un modelo principal con múltiples sub-modelos, when el modelador abre el modelo principal, then los sub-modelos NO se cargan automáticamente; cada uno debe cargarse individualmente.
- Given sub-modelos cargados, when el modelador hace clic en "Unload", then todos los sub-modelos cargados se descargan.
- Given un sub-modelo con sus propios OPDs, when se visualiza dentro del modelo principal, then los OPDs del sub-modelo se integran en la jerarquía del modelo principal con numeración relativa (ej. SD 1.1.1).
- Given un sub-modelo existente, when el modelador intenta añadir más things al conjunto compartido después de la creación, then el sistema no permite modificar el conjunto compartido.
- Given un sub-modelo cargado, when han transcurrido hasta 30 segundos desde el último chequeo, then el sistema verifica automáticamente si hay cambios en el sub-modelo.
- Given un thing compartido visible en el modelo principal, when el modelador intenta agregar un enlace de refinamiento (in-zoom o unfolding) saliente desde ese thing, then el sistema rechaza la operación.
- Given un thing compartido visible en el sub-modelo, when el modelador intenta cambiar su nombre, then el sistema rechaza la operación; se permite modificar el alias del thing.
- Given un thing compartido visible en el sub-modelo, when el modelador intenta agregar estados al thing, then el sistema rechaza la operación.
- Given un thing compartido visible en el sub-modelo, when el modelador intenta eliminar el thing, then el sistema rechaza la operación.
- Given un thing compartido en el sub-modelo, when el modelador cambia valores computacionales o el tipo de proceso, then la operación se permite.
- Given un sub-modelo conectado al modelo principal, when el modelador hace clic derecho en el nodo del sub-modelo en el árbol OPD, selecciona "Disconnect Sub-model" y confirma, then el sub-modelo queda desconectado del modelo principal; la operación es irreversible; los things compartidos vuelven a apariencia normal; el sub-modelo se convierte en un modelo independiente.
- Given que la desconexión debe ejecutarse desde ambos lados, when el modelador la ejecuta solo desde un lado, then el sistema indica que la desconexión debe confirmarse también desde el otro modelo para completarse.
- Given un sub-modelo desconectado, when el modelador intenta reconectarlo al modelo principal, then el sistema no ofrece opción de reconexión.

**Dependencias:** L-M1-07, L-M3-01

---

## M2 — Motor OPL + NL

### L-M2-01 — Panel OPL sincronizado (OPD→OPL)

**Prioridad:** P0
**Módulo:** Motor OPL + NL
**Evidencia:** frame-confirmada

Como modelador, quiero un panel OPL que se actualice automáticamente al modificar el OPD, con resaltado cruzado al hacer hover y opciones de visualización, para verificar continuamente la representación textual del modelo mientras construyo en el diagrama.

**Criterios de aceptación:**

- Given el modelador tiene un OPD abierto, when visualiza el panel OPL en la parte inferior de la pantalla, then el panel muestra todas las sentencias OPL del OPD actual con colores semánticos (procesos en azul, objetos en verde, estados en marrón dorado).
- Given el panel OPL está visible y el resaltado cruzado está activo (por defecto lo está; configurable en L-M6-04), when el modelador pasa el cursor sobre un thing en el OPD, then las sentencias OPL donde aparece ese thing se resaltan visualmente en el panel OPL.
- Given el panel OPL está visible y el resaltado cruzado está activo, when el modelador pasa el cursor sobre una sentencia en el panel OPL, then el thing referenciado en esa sentencia se resalta en el canvas OPD.
- Given el panel OPL está visible, when el modelador hace clic en el botón de numeración, then los números de línea de las sentencias OPL se muestran o se ocultan según la preferencia.
- Given el panel OPL está visible, when el modelador hace clic en el botón para mover el panel al panel izquierdo, then el panel OPL se reubica en el panel izquierdo y el canvas gana espacio vertical.
- Given el panel OPL está visible, when el modelador lo minimiza, then el panel se colapsa a su mínimo, se detiene el renderizado de OPL y un botón permite restaurarlo.
- Given el modelador selecciona la opción de ver todo el OPL, when el panel carga el contenido completo, then se muestra el OPL de todo el modelo (no solo el OPD actual) con posibilidad de scroll y redimensionamiento manual.
- Given el panel OPL está visible, when el modelador hace clic en el nombre de un thing dentro del OPL, then el thing correspondiente se resalta y centra en el canvas OPD, facilitando la navegación desde texto a diagrama. (La edición desde OPL se cubre en L-M2-02.)

**Invariantes categóricos de implementación (Lens — compartido con L-M2-02):**

- Given el Domain Engine con el motor OPL activo, when se invoca `expose: Graph → OPL`, then la función es el componente "get" del lens bidireccional (DA-6). La generación OPL es determinista y completa: todo elemento del grafo con representación OPL definida por ISO 19450 produce exactamente una sentencia.
- Given el Domain Engine con el motor OPL activo, when se verifica la ley GetPut del lens, then `update(g, expose(g)) = g` — re-importar el OPL generado sin modificaciones no altera el grafo. Esta propiedad se verifica automáticamente como test de integridad.

**Dependencias:** L-M1-02, L-M1-03

---

### L-M2-02 — OPL bidireccional (OPL→OPD: editar, crear, eliminar)

**Prioridad:** P1
**Módulo:** Motor OPL + NL
**Evidencia:** nueva

Como modelador, quiero editar nombres y propiedades de things directamente en el panel OPL, escribir nuevas sentencias OPL que generen elementos en el OPD, eliminar sentencias OPL con gestión correcta del modelo, y acceder a la referencia de gramática OPL soportada, para construir y mantener el modelo completamente desde la representación textual cuando me resulte más eficiente.

**Criterios de aceptación:**

- Given el panel OPL visible con una sentencia existente, when el modelador edita el nombre de un thing en la sentencia OPL y presiona Enter, then el nombre se actualiza simultáneamente en el OPD y en todas las sentencias OPL que lo referencian.
- Given el panel OPL visible, when el modelador edita el nombre de un estado dentro de una sentencia (ej. cambia "hot" por "cold" en "Processing changes Object from hot to cold"), then el nombre del estado se actualiza en el OPD y en todas las sentencias que lo referencian.
- Given el panel OPL visible, when el modelador modifica el tag de un enlace etiquetado en la sentencia OPL, then el tag se actualiza en el OPD.
- Given el panel OPL visible, when el modelador cambia el verbo semántico de una sentencia (ej. de "affects" a "changes...from...to"), then el tipo de enlace en el OPD se convierte automáticamente y se crean los estados necesarios si no existen.
- Given el panel OPL visible, when el modelador escribe una sentencia de transformación válida (ej. "Heating changes Water from cold to hot"), then el sistema crea el proceso "Heating" (si no existe), el objeto "Water" (si no existe), los estados "cold" y "hot" (si no existen), y un input/output link pair conectándolos.
- Given el panel OPL visible, when el modelador escribe una sentencia de agente válida (ej. "Operator handles Heating"), then el sistema crea el objeto físico "Operator" (si no existe) y un agent link al proceso "Heating".
- Given el panel OPL visible, when el modelador escribe una sentencia de agregación válida (ej. "Car consists of Engine, Chassis and Body"), then el sistema crea el objeto "Car" y los objetos "Engine", "Chassis", "Body" (si no existen) con enlaces de agregación-participación.
- Given el panel OPL visible, when el modelador escribe una sentencia de exhibición válida (ej. "Car exhibits Color"), then el sistema crea el objeto informático "Color" (si no existe) con enlace exhibition-characterization al objeto "Car", y cambia automáticamente la esencia de "Color" a informática.
- Given el panel OPL visible, when el modelador escribe una sentencia que referencia un thing existente en otro OPD, then el sistema crea una instancia visual del thing en el OPD activo sin duplicar el thing lógico.
- Given el panel OPL visible, when el modelador escribe una sentencia con sintaxis inválida o gramática OPL no reconocida, then el sistema resalta la sentencia en rojo y muestra un tooltip con el error específico de gramática sin modificar el OPD.
- Given el panel OPL visible, when el modelador elimina una sentencia OPL completa, then el sistema solicita confirmación mostrando los things y enlaces que serían eliminados del OPD; al confirmar, elimina los elementos que no están referenciados por otras sentencias.
- Given el panel OPL visible, when el modelador hace clic en "OPL Grammar Reference", then se muestra una guía con todos los patrones OPL soportados organizados por categoría: transformación (affects, changes, consumes, yields), habilitación (handles, requires), estructurales (consists of, exhibits, is a, is an instance of), etiquetados (tag, relates to, are related), control (triggers, occurs if...otherwise skipped), y multiplicidad/probabilidad.
- Given el modelador intenta escribir una sentencia que violaría la unicidad del enlace procedimental, when confirma la sentencia, then el sistema rechaza la creación con el mismo mensaje de enforcement que en la edición gráfica.
- Given el modelador edita una sentencia OPL y el sistema actualiza el OPD, when el sistema regenera el OPL desde el OPD modificado, then la sentencia resultante es semánticamente idéntica a la que el modelador editó (ley PutGet del lens bimodal: edit → regenerate = edit aplicado); si hay pérdida de información por limitación del formato, el sistema la señala como "Functor Information Loss".
- Given el modelador abre el panel OPL sin hacer cambios, when ese OPL se re-importa al grafo sin modificaciones, then el grafo no cambia (ley GetPut del lens bimodal: expose → re-import sin cambios = sin cambio en el grafo); esta propiedad se verifica automáticamente como test de integridad.

**Invariantes categóricos de implementación (Lens — compartido con L-M2-01):**

- Given el Domain Engine con el motor OPL en modo bidireccional, when se invoca `update: Graph × OPL_edit → Graph`, then la función es el componente "put" del lens bidireccional (DA-6). La ley PutGet garantiza round-trip: `update(g, edit) |> expose = apply(edit, expose(g))`. Si esta ley se viola para algún edit, el sistema emite `Functor Information Loss` explicitando qué información se perdió en el round-trip.
- Given el Domain Engine con el lens bimodal operando, when se ejecutan las operaciones expose y update, then estas son las DOS ÚNICAS operaciones del lens — no existen parsers independientes OPD→OPL y OPL→OPD. La implementación es un lens, no dos funciones ad-hoc.

**Dependencias:** L-M2-01, L-M1-05

---

### L-M2-03 — Modelado desde lenguaje natural (NL→OPL→OPD con LLM)

**Prioridad:** P1
**Módulo:** Motor OPL + NL
**Evidencia:** nueva

Como modelador, quiero describir un sistema en lenguaje natural y que un LLM traduzca mi descripción a sentencias OPL válidas que se apliquen al OPD, para iniciar o enriquecer un modelo sin necesidad de conocer la sintaxis OPL de memoria.

**Criterios de aceptación:**

- Given un campo de input "Describe your system" visible en el panel lateral, when el modelador escribe "A coffee machine makes coffee from water and beans. The barista operates it. It needs electricity." y presiona Enter, then el LLM genera sentencias OPL candidatas en un panel de preview: `Coffee Making changes Coffee from unmade to ready`, `Barista handles Coffee Making`, `Coffee Making requires Coffee Machine`, `Coffee Making consumes Water`, `Coffee Making consumes Coffee Beans`, `Coffee Making requires Electricity`.
- Given el panel de preview con sentencias OPL candidatas, when el modelador revisa cada sentencia, then puede aceptar, rechazar o editar cada una individualmente antes de confirmar la creación, con un checkbox por sentencia y un campo de edición inline.
- Given sentencias OPL aceptadas en el preview, when el modelador hace clic en "Apply to Model", then el parser OPL crea los things, estados y enlaces correspondientes en el OPD activo.
- Given una descripción ambigua (ej. "the system processes data"), when el LLM genera OPL, then presenta opciones alternativas de interpretación con explicación (ej: ¿es "Data" un consumee o un affectee?) y el modelador selecciona la interpretación correcta.
- Given el modelador escribe una descripción que implica refinamiento (ej. "the manufacturing process involves cutting, assembling, and painting"), when el LLM genera OPL, then sugiere tanto la sentencia SD como la estructura de in-zoom con 3 subprocesos como opción expandible.
- Given el modelador escribe en español u otro idioma distinto al inglés, when el LLM procesa la descripción, then genera OPL en inglés estándar (ISO 19450) pero mantiene un mapping visible entre los términos originales del usuario y los nombres OPL generados.
- Given el historial de sentencias generadas en la sesión, when el modelador escribe una nueva descripción que referencia things ya existentes en el modelo, then el LLM reutiliza los things existentes en lugar de crear duplicados, y resalta en el preview los things reutilizados vs. los nuevos.

**Dependencias:** L-M2-02, L-M1-02

---

### L-M2-04 — Exportar OPL como texto

**Prioridad:** P1
**Módulo:** Motor OPL + NL
**Evidencia:** video-confirmada

Como modelador, quiero exportar la representación textual OPL del modelo como archivo de texto, para documentar y comunicar la semántica formal del modelo a stakeholders que no usan OPModeling.

**Criterios de aceptación:**

- Given un modelo abierto con al menos un OPD, when el modelador selecciona "Export" > "OPL as HTML" desde el menú principal, then se descarga un archivo HTML con las sentencias OPL del modelo completo y colores semánticos preservados.
- Given el diálogo de exportación OPL, when el modelador edita el nombre del archivo antes de exportar, then el archivo descargado usa el nombre personalizado en lugar del nombre generado automáticamente desde el nombre del modelo.
- Given el diálogo de exportación OPL, when el modelador activa la opción de numeración de sentencias, then cada sentencia OPL en el archivo exportado aparece precedida de su número; si la opción está desactivada, las sentencias se listan sin numeración.
- Given el diálogo de exportación OPL con numeración desactivada, when el modelador confirma la exportación, then el archivo HTML contiene dos secciones: (1) OPL por OPD individual y (2) un bloque consolidado final con todas las sentencias sin duplicados.

**Dependencias:** L-M2-01

---

## M3 — Navegación Inteligente

### L-M3-01 — Árbol OPD (navegación, expand/collapse)

**Prioridad:** P0
**Módulo:** Navegación Inteligente
**Evidencia:** frame-confirmada

Como modelador, quiero ver y navegar el árbol OPD en el panel izquierdo con soporte de expand/collapse, pestañas de OPDs abiertos, gestión mediante menú contextual y pantalla dedicada, con ordenamiento automático sincronizado con el orden de subprocesos, y con paginación para modelos grandes, para moverme eficientemente entre los niveles de refinamiento del modelo.

**Criterios de aceptación:**

- Given un modelo con múltiples OPDs cargado, when el modelador visualiza el panel izquierdo, then el árbol OPD muestra la estructura jerárquica de todos los OPDs (SD, SD1, etc.) con indentación y anidamiento visual que refleja la relación padre-hijo.
- Given el árbol OPD está visible, when el modelador hace clic en un nodo del árbol, then el canvas se actualiza mostrando el OPD seleccionado con todos sus things y enlaces.
- Given el modelador ha abierto múltiples OPDs, when los visualiza en la parte superior del canvas, then cada OPD abierto se muestra como una pestaña; hacer clic en una pestaña cambia al OPD correspondiente; las pestañas con cambios sin guardar muestran un indicador visual.
- Given el árbol OPD está visible, when el modelador arrastra el borde lateral del panel, then el ancho del panel del árbol OPD cambia en tiempo real y el canvas se redimensiona correspondientemente.
- Given el árbol OPD está expandido, when el modelador hace clic en el control de colapsar el panel, then el panel desaparece y el canvas gana el espacio liberado; al expandir, reaparece con su contenido intacto.
- Given el modelador hace clic derecho en el árbol OPD, when el menú contextual aparece, then se muestran las opciones: Remove OPD, Expand All, Collapse All, Hide Names / Show Names.
- Given el modelador selecciona "Remove OPD" sobre un OPD hoja (sin descendientes), when confirma la operación, then el OPD se elimina del árbol y del modelo exitosamente.
- Given el modelador intenta eliminar un OPD intermedio (con descendientes), when ejecuta la acción, then el sistema muestra el mensaje "You are not allowed to remove inner nodes" y la operación no se ejecuta.
- Given el modelador selecciona "Expand All" en el menú contextual, when la acción se ejecuta, then todos los nodos del árbol se expanden mostrando la estructura jerárquica completa.
- Given el modelador selecciona "Collapse All" en el menú contextual, when la acción se ejecuta, then todos los nodos se colapsan dejando visible solo el nodo raíz (SD).
- Given el modelador selecciona "Hide Names" en el menú contextual, when la acción se ejecuta, then los nombres completos de los OPDs desaparecen mostrando solo los identificadores numéricos (ej. "SD", "SD1", "SD1.1"); la opción cambia a "Show Names".
- Given el modelador usa Undo después de eliminar un OPD, when la operación se revierte, then el OPD eliminado reaparece en el árbol con todos sus descendientes y contenido intactos.
- Given el modelador abre OPD Management (Ctrl+D o menú), when visualiza la pantalla, then se muestra el árbol OPD completo con campo de búsqueda por nombre y número, y opciones de gestión.
- Given la pantalla de OPD Management está abierta, when el modelador escribe un nombre en el campo de búsqueda, then la lista se filtra mostrando solo OPDs cuyo nombre contiene el texto buscado.
- Given la pantalla de OPD Management está abierta, when el modelador corta un OPD y lo pega en otra ubicación del árbol, then el OPD se mueve a la nueva posición con todos sus descendientes.
- Given la pantalla de OPD Management está abierta, when el modelador arrastra un OPD y lo suelta en otra posición del árbol, then el OPD se reubica en la posición donde fue soltado.
- Given la pantalla de OPD Management está abierta, when el modelador renombra un OPD, then el nombre se actualiza en el árbol y en todas las referencias del modelo.
- Given la pantalla de OPD Management está abierta, when el modelador hace doble clic en un OPD o lo selecciona y hace clic en "Open", then el canvas se actualiza al OPD seleccionado y la pantalla de OPD Management se cierra.
- Given el modelo está en modo de ordenamiento automático y el modelador mueve un subproceso arriba o abajo de otro en un in-zoom, when el orden de subprocesos cambia, then el nodo correspondiente en el árbol OPD se reposiciona automáticamente para reflejar el nuevo orden.
- Given el modelador va a Settings > User Management > OPL Settings y cambia "OPD Tree Processes Arrangement", when selecciona "Automatic" o "Manual", then en modo "Automatic" el árbol se reordena al cambiar subprocesos; en modo "Manual", el árbol mantiene el orden definido por el usuario.
- Given el modelador va a Model Options > OPD Rearranging, when guarda la configuración del modelo, then "Inherited" usa la preferencia general del usuario; "Automatic" o "Manual" aplica solo a ese modelo.
- Given existen configuraciones en los tres niveles (modelo, usuario, organización), when el sistema determina el modo de ordenamiento, then la configuración del modelo tiene prioridad sobre la del usuario, y la del usuario sobre la de la organización.
- Given el modelo tiene más de 20 OPDs, when el modelador navega por el árbol, then solo el nivel del OPD activo se expande; los demás niveles permanecen colapsados; navegar a otro OPD expande su nivel y colapsa el anterior.
- Given el modelador visualiza los íconos de navegación direccional en el árbol OPD, when hace clic en el ícono Abajo, then se selecciona el siguiente OPD al mismo nivel jerárquico.
- Given el modelador visualiza los íconos de navegación direccional en el árbol OPD, when hace clic en el ícono Arriba, then se selecciona el OPD anterior al mismo nivel jerárquico.
- Given el modelador visualiza los íconos de navegación direccional en el árbol OPD, when hace clic en el ícono Izquierda, then sube un nivel navegando al OPD padre.
- Given el modelador visualiza los íconos de navegación direccional en el árbol OPD, when hace clic en el ícono Derecha, then baja un nivel navegando al primer hijo del OPD actual.
- Given el modelador ha visitado al menos dos OPDs, when hace clic en el ícono Atrás o presiona Ctrl+Backspace, then vuelve al último OPD visitado (toggle entre los dos más recientes).
- Given el modelador usa el teclado, when presiona Ctrl+Arriba o Ctrl+Abajo, then navega al OPD anterior o siguiente al mismo nivel jerárquico; cuando presiona Ctrl+Izquierda o Ctrl+Derecha, navega en profundidad (padre o primer hijo).

**Dependencias:** L-M1-02

---

### L-M3-02 — Panel de things arrastrables

**Prioridad:** P0
**Módulo:** Navegación Inteligente
**Evidencia:** frame-confirmada

Como modelador, quiero acceder a un panel de things arrastrables en el panel izquierdo que liste todos los objetos y procesos del modelo, con búsqueda y filtro por tipo, para poblar el OPD activo con instancias de things existentes sin perder el contexto del modelo completo.

**Criterios de aceptación:**

- Given el modelador abre OPModeling con un modelo cargado, when accede al panel de Draggable OPM Things en el panel izquierdo, then el panel muestra todos los objetos y procesos del modelo con indicadores visuales de esencia, afiliación y relaciones de atributo.
- Given el panel de things arrastrables está visible, when el modelador escribe texto en el campo de búsqueda, then la lista se filtra en tiempo real mostrando solo los things cuyo nombre contiene el texto ingresado (coincidencia parcial).
- Given el panel de things arrastrables está visible, when el modelador hace clic en el botón de filtro ("i") y selecciona "solo procesos" o "solo objetos", then la lista se filtra mostrando únicamente el tipo seleccionado.
- Given el modelador identifica un thing en el panel, when lo arrastra y suelta en el canvas del OPD actual, then el thing aparece en el OPD como una instancia visual adicional; si no está directamente conectado en el OPD padre, se muestra con contexto relacional (ej. "Danger Status of Driver").

- Given el panel de Draggable OPM Things tiene más elementos de los que caben en una página, when el modelador visualiza el panel, then aparecen botones de paginación: siguiente página, página anterior, primera página, última página; la búsqueda opera sobre la lista completa, no solo la página actual.

**Dependencias:** ninguna

---

### L-M3-03 — Barra de herramientas principal y secundaria

**Prioridad:** P0
**Módulo:** Navegación Inteligente
**Evidencia:** frame-confirmada

Como modelador, quiero una barra de herramientas principal (ribbon azul) permanente con funciones primarias, una barra secundaria contextual que adapta sus opciones según el elemento seleccionado, y capacidades de organización del canvas (drag, align, zoom, fullscreen, auto-layout semántico), para acceder a todas las funciones del sistema desde la interfaz sin interrumpir el flujo de modelado.

**Criterios de aceptación:**

- Given el modelador abre OPModeling, when visualiza la parte superior de la pantalla, then la barra de herramientas principal (ribbon azul) está siempre visible y contiene todos los botones de funciones primarias: crear objetos, crear procesos, undo, redo, save, load, share, execute, sign in/out y settings.
- Given el modelador selecciona un thing, when visualiza la barra de herramientas secundaria, then las opciones cambian dinámicamente según el tipo y estado del thing seleccionado (Change Affiliation, Change Essence, Add States, In-Zoom, Unfold, Style, etc.); las opciones irrelevantes se ocultan o deshabilitan.
- Given el modelador selecciona un objeto stateful, when visualiza la barra secundaria, then aparecen opciones adicionales específicas de gestión de estados: "Add States", "Suppress States", "Disable Stating", alineación de estados y otras opciones de estado.
- Given el modelador hace clic en el ícono del menú principal (hamburguesa), when el menú se despliega, then muestra todas las opciones del sistema organizadas jerárquicamente: New, Load, Examples, Save/Save As, System Map, Copy Link, Model Validation, Compare Model, Mark Things, Import, Export, Settings, About, Help.
- Given el modelador tiene un thing en el canvas, when lo arrastra a una nueva posición, then el thing se mueve a la nueva posición y los enlaces conectados se ajustan automáticamente.
- Given el modelador selecciona múltiples things y hace clic en "Align Left", when la operación se ejecuta, then todos los things seleccionados se alinean horizontalmente al borde izquierdo del thing más a la izquierda del grupo.
- Given el modelador selecciona un thing, when arrastra los bordes o esquinas del thing, then el thing se redimensiona; los estados internos y enlaces se ajustan al nuevo tamaño.
- Given el modelador usa la rueda del ratón o los controles de zoom en el canvas, when modifica el nivel de zoom, then el nivel de zoom cambia suavemente y el navegador minimap se actualiza correspondientemente.
- Given el panel izquierdo está visible, when el modelador hace clic en el botón de cerrar/abrir del panel, then el panel izquierdo se colapsa o expande; el canvas se redimensiona para ocupar el espacio disponible.
- Given el panel izquierdo tiene múltiples secciones (OPD tree, draggable things, navigator), when el modelador arrastra el borde entre secciones, then las secciones se redimensionan y el contenido se ajusta al espacio disponible.
- Given el modelador hace clic en el botón "Full Screen", when la aplicación entra en modo pantalla completa, then se elimina la barra del navegador y otros elementos externos; se puede salir con el mismo botón.
- Given un OPD con things y enlaces posicionados arbitrariamente, when el modelador hace clic en "Auto Layout" desde el menú View o presiona Ctrl+L, then los things se reposicionan según convenciones semánticas OPM: proceso principal al centro, agentes arriba, instrumentos a izquierda/derecha, objetos transformados debajo, things ambientales en el perímetro del canvas.
- Given un OPD de in-zoom, when el modelador ejecuta auto-layout (Ctrl+L), then los subprocesos se ordenan verticalmente de arriba a abajo reflejando el timeline de ejecución, con los objetos de entrada posicionados a la izquierda y los de salida a la derecha.
- Given un thing que el modelador ha movido manualmente después de un auto-layout previo, when el modelador ejecuta auto-layout nuevamente, then el thing con posición manual queda fijo (pinned) y el resto se reorganiza alrededor de él; los things pinned muestran un ícono de pin.
- Given un thing pinned, when el modelador hace clic derecho y selecciona "Unpin", then el thing vuelve a participar libremente en el auto-layout.
- Given el modelador activa "Live Auto-Layout" en Settings → Canvas, when agrega nuevos things o enlaces al OPD, then el layout se recalcula automáticamente tras cada cambio preservando la posición de things existentes no pinned.

**Dependencias:** L-M3-01

---

### L-M3-04 — Navegador del canvas (minimap)

**Prioridad:** P1
**Módulo:** Navegación Inteligente
**Evidencia:** frame-confirmada

Como modelador, quiero un navegador minimap del OPD en el panel izquierdo que me permita ver la vista reducida del canvas completo, navegar arrastrando el recuadro y hacer zoom, para orientarme y desplazarme eficientemente en diagramas grandes durante el refinamiento.

**Criterios de aceptación:**

- Given el modelador tiene un OPD abierto, when visualiza el OPD Navigator en el panel izquierdo, then el navegador muestra una vista reducida del OPD completo con un recuadro que representa el área actualmente visible en el canvas.
- Given el OPD Navigator está visible, when el modelador arrastra el recuadro dentro del navegador, then el canvas se desplaza sincronizadamente con el movimiento del recuadro.
- Given el OPD Navigator está visible, when el modelador redimensiona el recuadro del navegador (amplía o reduce), then el nivel de zoom del canvas cambia correspondientemente.
- Given el OPD Navigator está visible, when el modelador hace clic en el ícono del navegador en la barra secundaria, then el navegador se oculta liberando su espacio en el panel izquierdo; el ícono cambia de estado (lleno/vacío); al hacer clic nuevamente, reaparece en su posición original.
- Given el OPD Navigator está visible, when el modelador hace clic en el botón de desacoplar (detach), then el navegador se separa del panel izquierdo y se convierte en un panel flotante redimensionable que puede posicionarse libremente sobre el canvas; al hacer clic en acoplar, vuelve al panel izquierdo.

**Dependencias:** L-M3-01

---

### L-M3-05 — Búsqueda de things en el modelo

**Prioridad:** P1
**Módulo:** Navegación Inteligente
**Evidencia:** frame-confirmada

Como modelador, quiero un panel de búsqueda de things que filtre por nombre parcial y tipo, muestre todas las ubicaciones (OPDs) de cada thing encontrado y permita navegar directamente a cada instancia, para localizar rápidamente elementos distribuidos en múltiples niveles de refinamiento.

**Criterios de aceptación:**

- Given el modelador hace clic en el botón "Thing Searching" de la barra secundaria, when el panel de búsqueda se abre, then se muestra un campo de texto, filtros por tipo (All Elements, Processes, Objects) y un área de resultados.
- Given el panel de búsqueda está abierto, when el modelador selecciona un filtro de tipo (All Elements, Processes, Objects), then los resultados muestran solo el tipo seleccionado.
- Given el panel de búsqueda está abierto, when el modelador escribe parte del nombre de un thing en el campo de búsqueda, then la lista de resultados se actualiza incrementalmente a medida que se escribe, mostrando coincidencias parciales.
- Given la búsqueda retorna resultados, when el modelador visualiza cada thing encontrado, then debajo de cada resultado se listan todos los OPDs donde ese thing tiene una instancia visual (ej. "SD", "SD1 Turbo Engine Operation", etc.).
- Given el modelador visualiza los resultados de búsqueda, when hace clic en una ubicación específica de un thing, then el canvas cambia al OPD indicado y el thing se resalta o enfoca visualmente para ser fácilmente identificable.
- Given el modelador hace clic derecho en un thing del panel de Draggable OPM Things, when selecciona la búsqueda contextual, then el panel de búsqueda se abre con el nombre del thing pre-cargado y sus ubicaciones listadas; hacer clic en una ubicación navega al OPD correspondiente.

**Dependencias:** L-M3-02, L-M3-01

---

### L-M3-06 — Navegación semántica (go-to-definition, trace transformations, zoom abstracción, trazabilidad cross-nivel, bring connected)

**Prioridad:** P1
**Módulo:** Navegación Inteligente
**Evidencia:** nueva

Como modelador, quiero navegar entre OPDs por relación semántica (definición, aparición, paternidad, transformación), mostrar el modelo a un nivel de profundidad específico, trazar un thing a través de todos los niveles de refinamiento, y traer al OPD actual los things y enlaces conectados a un thing seleccionado, para entender cómo un thing atraviesa el modelo completo sin explorar manualmente cada OPD.

**Criterios de aceptación:**

- Given un thing seleccionado en el canvas, when el modelador hace clic derecho y selecciona "Go to Definition", then el canvas navega al OPD donde ese thing fue creado originalmente (su primera instancia en el modelo), y el thing queda resaltado.
- Given un thing seleccionado, when el modelador hace clic derecho y selecciona "Show All Appearances", then se despliega una lista de todos los OPDs donde ese thing tiene instancias visuales, indicando el tipo de relación en cada uno (definido, heredado por in-zoom, traído por bring connected) y permitiendo navegar a cualquiera con un clic.
- Given un subproceso dentro de un in-zoom, when el modelador hace clic derecho y selecciona "Go to Parent Process", then el canvas navega al OPD padre y resalta el proceso que contiene este subproceso como in-zoom.
- Given un objeto con estados que participa en múltiples procesos, when el modelador selecciona "Trace Transformations" desde el menú contextual, then se abre un panel que muestra todas las transformaciones de ese objeto a través del modelo: qué procesos lo consumen, lo crean o le cambian estado, con los OPDs donde ocurren.
- Given un proceso en el SD, when el modelador selecciona "Show Refinement Tree" desde el menú contextual, then se muestra un sub-árbol visual de todos los descendientes de ese proceso (in-zooms anidados) hasta las hojas, con indicadores de cuáles ramas están completamente refinadas y cuáles tienen trabajo pendiente.
- Given la vista "Trace Transformations" de un objeto abierta en el panel, when el modelador hace clic en cualquier transformación listada, then el canvas navega al OPD correspondiente y resalta el enlace de transformación específico.
- Given el modelador está en un OPD profundo (ej. SD1.2.3), when presiona Ctrl+Home, then navega directamente al SD (nivel 0); Ctrl+Up navega al OPD padre inmediato.
- Given un modelo con múltiples niveles de refinamiento, when el modelador selecciona "Abstraction Level: 0" desde el control de nivel en la barra de herramientas, then solo el SD es visible y navegable en el árbol OPD; los procesos que tienen in-zoom muestran un indicador de "tiene refinamiento".
- Given el control de nivel en "1", when el modelador lo cambia a "2", then los OPDs de nivel 2 (SD1.Xs) se hacen visibles y navegables en el árbol.
- Given un nivel de abstracción activo, when el modelador hace doble clic en un proceso que tiene refinamiento por debajo del nivel visible, then el sistema muestra un diálogo "This process has deeper refinement. Show next level?" y al aceptar incrementa el nivel de abstracción en 1.
- Given el control de nivel con cualquier valor activo, when el modelador selecciona "All Levels" desde el control, then se desactiva el filtro por nivel y el árbol OPD completo vuelve a ser navegable.
- Given un thing seleccionado en el canvas, when el modelador hace clic en "Trace Through Levels" desde el menú contextual, then se abre un panel lateral que muestra una timeline vertical del thing a través de los niveles de refinamiento: Level 0 (SD) → Level 1 (SD1) → Level 2 (SD1.1).
- Given el panel de trazabilidad abierto, when el modelador hace clic en cualquier entrada de nivel en la timeline, then el canvas navega al OPD de ese nivel con el thing resaltado y centrado en pantalla.
- Given el panel de trazabilidad mostrando la evolución de un thing, when ese thing cambia de propiedades entre niveles (ej. gana estados, cambia afiliación), then el panel marca visualmente los cambios con indicadores de diferencia tipo diff (verde para adiciones, amarillo para modificaciones).
- Given el panel de trazabilidad, when un thing aparece en un nivel pero NO en el nivel anterior, then el panel muestra "First appears at this level".
- Given múltiples things seleccionados, when el modelador selecciona "Compare Traces", then se muestran las trazas en paralelo para identificar dónde convergen o divergen en el modelo.
- Given que el modelador selecciona un thing y usa "Bring Connected Things" desde la barra secundaria, when se abre el panel de selección, then muestra cuatro filtros de tipo de enlace (dos procedurales y dos fundamentales/estructurales) con los tipos procedurales pre-seleccionados por defecto.
- Given que el modelador usa "Bring Connected Things" desde el halo del thing, when la acción se ejecuta, then los things se traen inmediatamente según la configuración de defaults sin mostrar el panel de selección.
- Given que el modelador va a Settings > User Management > OPModeling Settings y modifica los checkmarks de tipos de enlace para "Bring Connected Things", when guarda la configuración, then el halo y la pre-selección del panel reflejan los nuevos defaults en sesiones futuras.
- Given que el modelador ejecuta "Bring Connected Things", when la operación se completa, then solo se traen things con enlace directo al thing seleccionado; things conectados transitivamente vía jerarquía padre-hijo no se incluyen.
- Given que el modelador selecciona múltiples things con Ctrl+clic y hace clic en "Bring Links Between Selected Entities", when la operación se ejecuta, then solo se traen los enlaces que conectan directamente los things seleccionados entre sí, incluyendo tanto enlaces fundamentales como procedurales.

**Dependencias:** L-M3-01, L-M3-03, L-M3-05

---

### L-M3-07 — Cobertura de refinamiento (dashboard)

**Prioridad:** P1
**Módulo:** Navegación Inteligente
**Evidencia:** nueva

Como modelador, quiero un dashboard siempre visible que muestre métricas de cobertura del modelo y sugiera próximos refinamientos con asistencia de IA, para saber qué tan completo está el refinamiento y navegar directamente a los things que requieren trabajo.

**Criterios de aceptación:**

- Given un modelo con múltiples OPDs, when el modelador abre el dashboard de cobertura (panel lateral o menú View → Coverage), then se muestran métricas agrupadas por categoría: Refinamiento (X/Y procesos in-zoomed, X/Y objetos unfolded), Estados (X objetos stateful, Y stateless), Transformación (X procesos con enlace de transformación, Y sin enlace), SD (X/5 componentes presentes según ISO 19450).
- Given el dashboard visible con métricas, when el modelador hace clic en una métrica deficiente (ej. "3 procesos sin transformación"), then se despliega una lista con los things afectados; hacer clic en cualquier thing de la lista navega al OPD donde está definido y lo resalta en el canvas.
- Given el dashboard visible, when el modelador completa un in-zoom o añade estados a un objeto, then las métricas se actualizan en tiempo real sin necesidad de recargar o refrescar el panel manualmente.
- Given un modelo nuevo con solo SD, when el dashboard se muestra por primera vez, then la barra de progreso de refinamiento indica "Nivel 0 — solo SD, 0% refinado" y el panel muestra una lista de próximos pasos sugeridos de refinamiento ordenados por impacto.
- Given un modelo con múltiples niveles de refinamiento, when el dashboard muestra la cobertura, then agrupa las métricas por nivel: Nivel 0 (SD), Nivel 1 (SD1s), Nivel 2 (SD1.Xs), etc., con porcentaje de completitud independiente por nivel.
- Given un proceso no in-zoomed seleccionado, when el modelador hace clic en "Suggest Refinement" desde el halo o menú contextual (o el botón "Suggest" junto al proceso en la lista del dashboard), then el LLM analiza el nombre del proceso, los objetos conectados, y el contexto del SD, y genera una propuesta de in-zoom con N subprocesos nombrados en gerundio, su orden temporal sugerido, y los objetos internos/externos que participarían.
- Given la propuesta de refinamiento generada, when el modelador la revisa en un panel de preview, then puede aceptar, rechazar o editar cada subproceso individualmente; al aceptar, el in-zoom se crea con los subprocesos aprobados.
- Given la propuesta de refinamiento, when el LLM genera subprocesos, then cada subproceso incluye el OPL tentativo y la justificación de por qué sugiere ese desglose.
- Given un proceso ya in-zoomed con subprocesos genéricos ("Sub-Process 1", "Sub-Process 2"), when el modelador selecciona "Suggest Names", then el LLM propone nombres en gerundio basados en el contexto del proceso padre y los objetos conectados.
- Given un modelo con varios procesos sin refinar visibles en el dashboard de cobertura, when el modelador visualiza la lista, then cada proceso no refinado tiene un botón "Suggest" que invoca directamente la sugerencia de refinamiento con IA.

**Dependencias:** L-M1-07, L-M1-08, L-M3-01

---

## M4 — Verificación y Consulta

### L-M4-01 — Prevención de duplicación de nombres

**Prioridad:** P1
**Módulo:** Verificación y Consulta
**Evidencia:** frame-confirmada

Como modelador, quiero que OPModeling detecte cuando intento crear o renombrar un thing con un nombre ya existente en el modelo y me ofrezca opciones claras, para decidir conscientemente entre reutilizar el thing lógico existente o asignar un nombre diferente.

**Criterios de aceptación:**

- Given un modelo con al menos un thing nombrado, when el modelador crea o renombra un thing usando un nombre que ya existe en el modelo, then OPModeling muestra un diálogo que indica la ubicación del thing existente y ofrece tres opciones: "Use Existing Thing", "Rename" y "Close".
- Given el diálogo de duplicación visible, when el modelador hace clic en "Use Existing Thing", then el nuevo elemento se convierte en una instancia visual del thing lógico ya existente; ambas instancias representan la misma entidad y los cambios en una se reflejan en la otra.
- Given el diálogo de duplicación visible, when el modelador hace clic en "Rename", then puede elegir otro nombre para el nuevo thing sin crear instancia del existente.
- Given el diálogo de duplicación visible, when el modelador hace clic en "Close", then el thing conserva el nombre auto-generado por el sistema sin ningún cambio adicional.
- Given dos things con el mismo nombre pero de tipos incompatibles (ej. uno In-Zoomed y el otro Unfolded), when el diálogo de duplicación se muestra, then la opción "Use Existing Thing" no está disponible; solo se ofrecen "Rename" y "Close".

**Dependencias:** L-M1-02

---

### L-M4-02 — Validación OPM continua (batch + real-time)

**Prioridad:** P1
**Módulo:** Verificación y Consulta
**Evidencia:** frame-confirmada

Como modelador, quiero ejecutar una validación metodológica completa del modelo contra las convenciones ISO 19450 y recibir señales en tiempo real cuando mi modelo viola esas convenciones mientras construyo, para asegurar la corrección del modelo tanto de forma manual como de forma continua sin interrumpir el flujo de trabajo.

**Criterios de aceptación:**

- Given que el modelador ejecuta la validación, when el sistema escanea el modelo, then se muestra un panel de resultados con una lista de errores y advertencias, cada uno con descripción del problema, nombre del thing afectado y botón de navegación directa.
- Given que el validador encuentra un proceso cuyo nombre no termina en gerundio ("-ing" en inglés), when muestra el error, then el item indica "Process name must end in -ing" y al hacer clic en el error el canvas navega al OPD correspondiente y resalta el proceso.
- Given que el validador encuentra un objeto cuyo nombre está en plural, when muestra el error, then sugiere la forma singular o la convención OPM ("Set" para inanimados, "Group" para humanos).
- Given que el validador encuentra un proceso in-zoomed con un solo subproceso, when muestra el error, then indica "In-zoomed process must have at least two sub-processes".
- Given que el validador encuentra un proceso unfolded con una sola sub-parte, when muestra el error, then indica "Unfolded thing must have at least two parts/attributes".
- Given que el validador encuentra un proceso sin enlace de transformación a ningún objeto, when muestra el error, then indica "Process has no transformation link to any object".
- Given que el modelador corrige un error y vuelve a ejecutar la validación, when el item antes marcado en rojo ya no tiene el problema, then el item cambia a verde o desaparece del panel.
- Given el modelador crea un proceso y le asigna un nombre que no termina en gerundio, when el nombre se confirma, then aparece un indicador de advertencia sutil (icono amarillo) junto al proceso con tooltip explicando la convención OPM.
- Given el modelador tiene un proceso sin ningún enlace de transformación a un objeto, when el modelador ejecuta la siguiente acción en el modelo (crear otro thing, crear otro enlace, guardar, o navegar a otro OPD), then aparece un hint discreto sugiriendo conectar el proceso a al menos un objeto mediante enlace procedimental; el hint no aparece si el modelador está en medio de crear un enlace.
- Given el SD del modelo no contiene los 5 componentes mínimos, when el modelador navega al SD, then un indicador de completitud muestra qué componentes faltan (ej. "SD: 3/5 componentes — falta: entorno, ocurrencia del problema").
- Given el modelador crea un objeto con nombre en plural, when el nombre se confirma, then aparece una sugerencia de usar la convención OPM (sufijo "Set" para inanimados, "Group" para humanos).
- Given las advertencias de guía metodológica están visibles, when el modelador hace clic en "Dismiss" o en el icono de cerrar de una advertencia, then esa advertencia específica no vuelve a aparecer para ese elemento hasta que el modelador lo modifique nuevamente.
- Given el modelador accede a Settings > Methodology Coaching, when desactiva el coaching, then todas las advertencias en tiempo real dejan de aparecer; la validación manual sigue disponible.
- Given el árbol OPD del modelo, when el sistema lo visualiza, then distingue visualmente entre OPD Object Trees (descendientes de in-zoom/unfold de objetos) y OPD Process Trees (descendientes de in-zoom de procesos) mediante íconos o colores diferenciados en los nodos del árbol, para que el modelador identifique rápidamente qué ramas elaboran estructura y cuáles elaboran comportamiento.

**Dependencias:** L-M1-01, L-M1-07, L-M1-08

---

### L-M4-03 — Vistas por aspecto (Estructura / Comportamiento / Función)

**Prioridad:** P2
**Módulo:** Verificación y Consulta
**Evidencia:** nueva

Como modelador, quiero filtrar el modelo por los tres aspectos fundamentales de OPM (Estructura, Comportamiento, Función) para obtener vistas focalizadas que muestren solo los elementos relevantes a cada aspecto, y así comprender y comunicar cada dimensión del sistema de forma independiente.

**Criterios de aceptación:**

- Given un modelo con múltiples things y enlaces, when el modelador selecciona la vista "Estructura" desde el menú de vistas, then el OPD muestra únicamente objetos con sus enlaces estructurales (agregación, exhibición, generalización, clasificación) ocultando procesos y enlaces procedurales.
- Given un modelo con múltiples things y enlaces, when el modelador selecciona la vista "Comportamiento", then el OPD muestra procesos con sus enlaces procedurales (effect, instrument, agent, consume, result, condition, event, invocation) y los objetos directamente conectados a ellos, ocultando enlaces estructurales puros.
- Given un modelo con múltiples things y enlaces, when el modelador selecciona la vista "Función", then el OPD muestra el par proceso-principal + objeto-principal con sus enlaces de transformación, junto con todos los habilitadores conectados al proceso principal y los enlaces estructurales que definen la composición del objeto principal; el resto de elementos se atenúa visualmente.
- Given una vista de aspecto activa, when el modelador hace clic en "Vista completa" o presiona Escape, then el OPD vuelve a mostrar todos los elementos sin filtro.
- Given una vista de aspecto activa, when el modelador intenta editar un elemento atenuado/oculto, then el sistema desactiva automáticamente la vista de aspecto y muestra el OPD completo para permitir la edición.
- Given una vista de aspecto activa, when el panel OPL está visible, then el OPL se filtra correspondientemente mostrando solo las sentencias relevantes al aspecto seleccionado.

**Dependencias:** L-M1-02, L-M1-03, L-M1-04

---

### L-M4-04 — View Diagrams (vistas curadas)

**Prioridad:** P2
**Módulo:** Verificación y Consulta
**Evidencia:** nueva

Como modelador, quiero crear View Diagrams que presenten colecciones seleccionadas de things y enlaces de distintos OPDs del modelo, para explicar fenómenos específicos del sistema o enfatizar puntos concretos sin alterar el árbol OPD jerárquico.

**Criterios de aceptación:**

- Given un modelo con múltiples OPDs, when el modelador selecciona "Create View Diagram" desde el menú principal, then se crea un OPD especial marcado como "View" que NO forma parte del árbol jerárquico OPD (no es descendiente de ningún OPD ni tiene descendientes propios).
- Given un View Diagram abierto, when el modelador arrastra things desde el panel de Draggable OPM Things o usa "Bring Connected Things", then los things aparecen en el View Diagram con sus enlaces preservados; los cambios a los things en el View Diagram se reflejan en todo el modelo.
- Given un View Diagram existente, when el modelador lo visualiza en el árbol OPD, then aparece en una sección separada "Views" debajo del árbol jerárquico, con un ícono diferenciador que indica que no es parte de la jerarquía de refinamiento.
- Given un View Diagram, when el modelador exporta el modelo como PDF, then los View Diagrams aparecen en una sección separada del documento, no intercalados con el árbol OPD jerárquico.

**Dependencias:** L-M3-01, L-M3-06

---

### L-M4-05 — Consulta semántica del modelo (NL sobre grafo)

**Prioridad:** P2
**Módulo:** Verificación y Consulta
**Evidencia:** nueva

Como modelador, quiero hacer preguntas sobre el modelo en lenguaje natural o con sintaxis estructurada desde un panel de consulta, para explorar la estructura del grafo OPM y navegar a los resultados directamente sobre el OPD.

**Criterios de aceptación:**

- Given el panel de consulta abierto, when el modelador escribe "qué procesos no tienen enlace de transformación", then el sistema devuelve la lista de procesos sin enlace de efecto, consumo ni resultado, con navegación directa a cada uno.
- Given el panel de consulta, when el modelador escribe "muéstrame el camino de Raw Material a Final Product", then el sistema calcula la cadena de transformaciones desde el objeto origen al destino y la muestra como una ruta resaltada sobre los OPDs involucrados.
- Given el panel de consulta, when el modelador escribe "qué objetos físicos son instrumentos de más de 2 procesos", then el sistema consulta el grafo y devuelve la lista filtrada con los conteos.
- Given el panel de consulta, when el modelador escribe "hay deadlocks en el modelo", then el LLM analiza el grafo buscando procesos que esperan eventos de objetos que nunca se producen, o ciclos de dependencia sin condición de salida.
- Given los resultados de una consulta, when el modelador hace clic en "Highlight on OPD", then los things resultado se resaltan visualmente en el OPD activo; si están en otros OPDs, se ofrece navegación.
- Given una consulta frecuente, when el modelador la guarda como "saved query", then puede re-ejecutarla con un clic desde un panel de consultas guardadas; los resultados se actualizan contra el estado actual del modelo.

**Dependencias:** L-M2-01, L-M1-02

---

### L-M4-06 — Detección de anti-patrones OPM con IA

**Prioridad:** P2
**Módulo:** Verificación y Consulta
**Evidencia:** nueva

Como modelador, quiero que el LLM analice la estructura del modelo y detecte anti-patrones OPM comunes, para recibir recomendaciones accionables sobre modelado subóptimo que no son errores de validación estricta.

**Criterios de aceptación:**

- Given un modelo con al menos 10 things, when el modelador selecciona "Analyze Model Patterns" desde el menú, then el LLM analiza la estructura y produce un reporte con anti-patrones encontrados, cada uno con: descripción del problema, things afectados, severidad (info/warning), y acción sugerida.
- Given el análisis activo, when el sistema detecta anti-patrones específicos, then cada uno dispara su criterio correspondiente: proceso con más de 5 instrumentos reporta "Consider in-zooming this process"; objeto con más de 4 estados reporta "Consider if some states are attributes of sub-objects"; proceso sin nombre en gerundio reporta "Naming convention not followed"; múltiples objetos informáticos sin estados en transformaciones reporta "These may be attributes rather than independent objects"; proceso con solo enlace de efecto cuando el objeto tiene estados definidos reporta "Consider using input/output pair instead of effect link".
- Given un anti-patrón con acción sugerida "Consider in-zooming this process", when el modelador hace clic en "Apply Suggestion", then se invoca la sugerencia de refinamiento con IA para ese proceso específico.
- Given el reporte de anti-patrones, when el modelador marca un anti-patrón como "Intentional / Dismiss", then ese anti-patrón no vuelve a aparecer para esos things hasta que el modelador los modifique.
- Given Settings > Analysis, when el modelador activa "Continuous Pattern Analysis", then los anti-patrones se detectan en background y aparecen como indicadores sutiles en los things afectados, análogo al comportamiento de la guía continua.

**Dependencias:** L-M4-02, L-M4-05

---

### L-M4-07 — Análisis de impacto con IA

**Prioridad:** P2
**Módulo:** Verificación y Consulta
**Evidencia:** nueva

Como modelador, quiero que el LLM analice las dependencias transitivas de un thing antes de modificarlo, para recibir un reporte de impacto que me permita tomar decisiones informadas antes de ejecutar el cambio.

**Criterios de aceptación:**

- Given un thing seleccionado, when el modelador hace clic en "Impact Analysis" desde el menú contextual, then el LLM analiza todas las dependencias del thing (enlaces directos, herencia por in-zoom, references en otros OPDs, participación en simulación) y muestra un reporte con: things directamente afectados, things transitivamente afectados, OPDs impactados, assertions que podrían romperse.
- Given el reporte de impacto de un cambio planeado (ej. "añadir estado 'broken' a Machine"), when el modelador revisa el reporte, then cada elemento impactado muestra la naturaleza del impacto (ej. "Process Heating has instrument link to Machine — may need condition link for 'broken' state").
- Given el reporte de impacto, when el modelador hace clic en "Proceed with Change", then el cambio se ejecuta y el sistema ofrece aplicar automáticamente las adaptaciones sugeridas (ej. crear condition links para el nuevo estado).
- Given el reporte de impacto, when el modelador hace clic en "Cancel", then ningún cambio se aplica al modelo.

**Dependencias:** L-M1-02, L-M4-02

---

### L-M4-08 — Requisitos en el modelo (satisfaction, views)

**Prioridad:** P2
**Módulo:** Verificación y Consulta
**Evidencia:** frame-confirmada

Como modelador, quiero asociar requisitos satisfechos (Satisfied Requirements) a things y enlaces del modelo OPM, y generar vistas de requisitos consolidadas, para trazar los requisitos del sistema directamente sobre la estructura OPM sin salir de OPModeling.

**Criterios de aceptación:**

- Given que el modelador selecciona un objeto o proceso y hace clic en "Add Requirements", when se agrega el requisito, then aparece un campo "Satisfied Requirement Set" con nombre auto-numerado (Requirement 1, 2, 3...) reposicionable dentro del OPD.
- Given que el modelador agrega múltiples requisitos al mismo thing, when cada nuevo requisito se crea, then recibe un número secuencial automático; al eliminar uno, los números restantes se renumeran automáticamente.
- Given que el modelador hace clic derecho en un enlace y agrega requisitos en el campo correspondiente, when guarda, then los requisitos se muestran en el enlace separados por punto y coma, y un checkbox permite controlar su visibilidad.
- Given que el modelador hace clic en "Toggle Satisfied Requirement Set" de un thing, when la acción se ejecuta, then el campo de requisitos de ese thing individual se oculta o muestra sin afectar a otros things del OPD.
- Given que el modelador hace clic en "Toggle All Model Requirements", when la acción se ejecuta, then todos los campos de requisitos del OPD actual se ocultan o muestran simultáneamente.
- Given que el modelador selecciona un Satisfied Requirement Set y hace clic en "Connect Requirement Stereotype", when el estereotipo se conecta, then aparecen campos estructurados editables: essence, actual name, ID, description, actor set, y soporte para atributos personalizados con indicadores de validación hard/soft.
- Given que el modelador hace clic en "Create Requirement View", when el sistema escanea el modelo, then genera un OPD de solo lectura bajo "Requirement Views" en el árbol OPD que muestra todos los things y enlaces con ese requisito, y se puede actualizar con "Update Requirement View" para reflejar cambios posteriores.
- Given que el modelador selecciona un thing, enlace, estado o estereotipo y hace clic en "Add Hyperlink URL", when ingresa la URL, then puede previsualizarla antes de guardar y el hyperlink queda accesible desde el modelo.

**Dependencias:** L-M4-02

---

### L-M4-09 — System Map

**Prioridad:** P2
**Módulo:** Verificación y Consulta
**Evidencia:** frame-confirmada

Como modelador, quiero generar un System Map que muestre visualmente la jerarquía completa de OPDs del modelo como un mapa de nodos conectados con elementos miniaturizados, con la posibilidad de navegar a cualquier OPD haciendo doble clic en su nodo, para obtener una visión global de la estructura del modelo y verificar la integridad de su arquitectura de diagramas.

**Criterios de aceptación:**

- Given el modelador va a Main Menu > Model Options > System Map, when el System Map se genera, then se crea un nuevo OPD llamado "System Map OPD" en el árbol OPD; el mapa muestra cada OPD como un nodo con iconos miniaturizados de sus elementos, conectados según relaciones de in-zoom y unfolding.
- Given el modelador visualiza el System Map y hace doble clic en un nodo, when el sistema procesa la navegación, then el canvas cambia al OPD representado por ese nodo y la vista del System Map se cierra automáticamente.
- Given el modelador visualiza el System Map, when observa los nodos del mapa, then cada nodo muestra los things del OPD de forma compacta como iconos miniaturizados; las conexiones entre nodos indican el tipo de relación (in-zoom vs unfolding).

**Dependencias:** L-M3-01, L-M3-03

---

## M5 — Ejecución Formal

### L-M5-01 — Simulación ECA (toolbar + conceptual + motor pre/post-process)

**Prioridad:** P1
**Módulo:** Ejecución Formal
**Evidencia:** video-confirmada

Como modelador, quiero ejecutar una simulación conceptual del modelo basada en el paradigma Event-Condition-Action (ECA) de ISO 19450, controlada desde una barra de herramientas, con el motor semántico que gestiona correctamente los pre/post-process object sets, para verificar la corrección lógica del flujo del modelo y observar la ejecución de procesos y transiciones de estado.

**Criterios de aceptación:**

- Given un modelo abierto en OPModeling, when el modelador hace clic en el botón "Execution" de la barra de herramientas principal, then la barra secundaria muestra los controles de simulación: botón sync simulation, botón stop, botón sync execution, y slider de velocidad de animación.
- Given la barra de simulación visible, when el modelador hace clic en "Sync Simulation", then el sistema inicia la simulación del modelo mostrando visualmente tokens recorriendo los enlaces en el orden de ejecución definido; los estados de los objetos cambian visualmente según las transiciones del modelo.
- Given la barra de simulación visible, when el modelador hace clic en el botón "Stop" durante una simulación activa, then OPModeling finaliza el ciclo de cálculo actual y detiene la simulación; el modelador puede volver al modo de modelado.
- Given la barra de simulación visible, when el modelador mueve el slider de velocidad de animación, then el cambio se aplica en tiempo real permitiendo acelerar o ralentizar la visualización; el valor por defecto corresponde a 1 segundo por operación.
- Given una simulación conceptual en curso, when los procesos se ejecutan, then lo hacen en el orden de arriba a abajo tal como están ordenados en el in-zoom, y el panel OPL muestra los subprocesos en el mismo orden de ejecución.
- Given una simulación conceptual en curso, when un proceso tiene un event link desde un objeto, then el proceso solo se activa cuando el objeto existe o entra en el estado especificado por el event link.
- Given una simulación conceptual en curso, when un proceso tiene condition links, then el proceso se salta (bypass) si la condición no se cumple, y la ejecución continúa con el siguiente proceso en el timeline.
- Given una simulación conceptual en curso, when un evento dispara la evaluación de una precondición y la precondición NO se cumple, then el evento se pierde irrecuperablemente; el proceso NO se encola para reintento; para que el proceso se active debe llegar un nuevo evento que satisfaga la precondición.
- Given una simulación conceptual en curso, when el modelador activa la vista "ECA Debug" en el panel de simulación, then cada proceso muestra su estado ECA actual: "waiting-event", "event-received-checking-precondition", "precondition-failed-event-lost", "executing", o "completed".
- Given una simulación en curso con el motor ECA activo y un proceso que consume un objeto, when el subproceso de menor nivel que consume ese objeto inicia, then el objeto desaparece visualmente del canvas indicando que dejó de existir.
- Given una simulación en curso con un proceso que afecta un objeto (input/output), when el subproceso de menor nivel que afecta ese objeto inicia, then el objeto sale visualmente de su estado de entrada; cuando el subproceso finaliza, el objeto entra visualmente a su estado de salida.
- Given una simulación en curso con un proceso que produce un objeto (result), when el subproceso de menor nivel que crea ese objeto finaliza, then el objeto aparece visualmente en el canvas indicando que empezó a existir.
- Given el panel OPL visible durante simulación con motor ECA activo, when un proceso se ejecuta, then el OPL resalta dinámicamente la sentencia correspondiente indicando qué objetos son parte del preprocess set y cuáles del postprocess set.
- Given un proceso en el modelo, when el modelador selecciona "Show Involved Object Set" desde el menú contextual del proceso, then el sistema muestra la unión del preprocess object set (consumees + affectees antes de ejecución) y el postprocess object set (resultees + affectees después de ejecución) como lista consolidada, identificando el rol de cada objeto; esta es la Involved Object Set definida en ISO 19450.
- Given una simulación en curso o pausada, when el modelador selecciona "Capture System State" o el sistema lo registra automáticamente en cada paso, then se genera un snapshot del estado actual del modelo: qué objetos existen, en qué estado está cada objeto stateful, qué procesos están activos/completados/esperando; este System State es consultable y comparable con otros snapshots para trazar la evolución del sistema durante la simulación.

**Invariantes categóricos de implementación:**

- Given el Domain Engine con el motor de simulación activo, when evalúa un paso de simulación, then ejecuta la coalgebra c: ModelState → Event × (Precond → ModelState + 1) definida en DA-5. Cada paso produce un par (observación, transición) — no es un loop imperativo que recorre tokens por enlaces. El `+1` (Maybe monad) modela eventos perdidos cuando la precondición falla.
- Given el motor de simulación con múltiples pasos ejecutados, when acumula la traza de ejecución, then la traza es una secuencia coinductiva (no una lista finita predeterminada). Las propiedades de safety ("nunca se alcanza un estado malo") y liveness ("eventualmente se alcanza un estado bueno") se verifican por coinducción sobre la traza, complementando el análisis estático del grafo. Dos model states son bisimilares si producen las mismas observaciones bajo las mismas acciones.

**Dependencias:** L-M1-06, L-M1-07, L-M2-01

---

### L-M5-02 — Condiciones, ramas y bucles

**Prioridad:** P2
**Módulo:** Ejecución Formal
**Evidencia:** video-confirmada

Como modelador, quiero modelar ramas condicionales usando condition links basados en estados de objetos de decisión, y modelar bucles mediante invocation links con control de terminación, para que la simulación ejecute o salte procesos según el estado actual del objeto y represente flujos repetitivos con condición de salida.

**Criterios de aceptación:**

- Given un objeto con múltiples estados (ej. "Yes", "No") en el modelo, when el modelador conecta cada estado a un proceso diferente con instrument condition links, then durante la simulación: si el objeto está en estado "Yes", el proceso correspondiente se ejecuta; si está en "No", se ejecuta el proceso alternativo.
- Given un proceso que produce un objeto con múltiples estados y sin asignación específica de resultado, when la simulación alcanza ese proceso, then OPModeling selecciona un estado aleatoriamente con probabilidad igual (ej. 50/50 con dos estados); la selección varía en cada ejecución.
- Given un objeto de decisión con estados y porcentajes de probabilidad asignados (ej. 20% "Yes", 80% "No"), when la simulación ejecuta el proceso que produce ese objeto, then selecciona estados según las probabilidades configuradas; la suma de porcentajes debe ser 100%.
- Given un proceso con un result link apuntando directamente a un estado específico del objeto, when la simulación ejecuta ese proceso, then el objeto siempre produce el estado fijado sin aleatoriedad.
- Given un proceso en el modelo, when el modelador conecta ese proceso a sí mismo o a un proceso anterior con un invocation link, then durante la simulación el proceso se reinvoca al terminar su ejecución, creando un bucle; la condición de salida se modela con los estados del objeto de decisión.
- Given un proceso computacional con función definida por usuario, when la función retorna el nombre de un estado específico, then el proceso produce exactamente ese estado en cada ejecución, permitiendo controlar programáticamente la salida de una condición de bucle.
- Given una configuración de condición más invocación que puede crear un bucle infinito, when la simulación está en curso, then el botón "Stop" está siempre disponible; al hacer clic, OPModeling finaliza el ciclo actual y detiene la ejecución.

**Dependencias:** L-M5-01, L-M1-03

---

### L-M5-03 — Objetos computacionales (value, units, alias)

**Prioridad:** P2
**Módulo:** Ejecución Formal
**Evidencia:** video-confirmada

Como modelador, quiero convertir objetos en computacionales y configurar su valor, unidades y alias, para que puedan participar en cálculos y simulaciones dentro del modelo.

**Criterios de aceptación:**

- Given un objeto regular seleccionado en el canvas, when el modelador hace clic en "Computation" en la barra secundaria, then el objeto cambia visualmente a estado computacional y permite asignar valor, unidades (ej. Meter) y alias.
- Given un objeto computacional existente, when el modelador hace clic en el botón "Alias" y asigna un nombre corto (ej. "p1" para "Point One"), then el alias queda disponible en el IDE para referenciar el objeto en funciones, especialmente cuando el nombre contiene espacios.
- Given un objeto computacional con alias asignado, when el modelador referencia el alias con notación de punto (ej. p1.x, p1.y) en el IDE, then accede a las sub-partes del objeto (componentes de estereotipo o de refinamiento).
- Given un objeto computacional en el modelo, when el modelador accede a su configuración de rango via Entities Extension y selecciona el tipo de valor (Integer, Float, String, Character, Boolean), then el tipo se establece permanentemente y OPModeling crea automáticamente un atributo "Type" con cinco estados correspondientes marcando el seleccionado como "current".

**Dependencias:** L-M1-02

---

### L-M5-04 — Procesos computacionales (funciones, IDE, dot notation)

**Prioridad:** P2
**Módulo:** Ejecución Formal
**Evidencia:** video-confirmada

Como modelador, quiero convertir procesos en computacionales y definir su lógica mediante funciones predefinidas o código personalizado en un IDE integrado, y escribir funciones que referencien sub-partes de objetos mediante notación de punto, para ejecutar cálculos automatizados y complejos durante la simulación.

**Criterios de aceptación:**

- Given un proceso computacional seleccionado, when el modelador elige una función predefinida (ej. "Adding", "Average") de la lista disponible, then el proceso muestra llaves en su ícono y el tooltip refleja la función seleccionada; los objetos conectados como instrumentos son los inputs y el result link define el output.
- Given un proceso computacional, when el modelador hace clic en el proceso y abre el IDE integrado, then el IDE se abre mostrando el código actual de la función con opción de seleccionar temas de visualización; las funciones auto-generadas de OPModeling están disponibles como API.
- Given el IDE abierto con la función de un proceso, when el modelador edita el código y hace clic en "Update", then el proceso muestra el ícono computacional actualizado y el tooltip refleja la nueva función.
- Given un proceso computacional con función definida, when el modelador usa "Update computation directly", then puede modificar rápidamente la función sin abrir el editor completo y el cambio se aplica inmediatamente.
- Given un proceso computacional con "User Defined" seleccionado como tipo de función, when el modelador abre el IDE integrado, then se muestra un template de función por defecto; las funciones auto-generadas y la API de OPModeling están disponibles.
- Given el IDE abierto, when el modelador escribe código TypeScript/JavaScript usando alias con notación de punto (ej. p1.x, p1.y para sub-partes de un objeto), then el alias del padre más el nombre o alias de la sub-parte permite acceso directo a los componentes cross-diagrama mientras la consistencia OPM se mantenga.
- Given un proceso computacional con función definida y objetos de entrada configurados, when el modelador hace clic en Execute con sync execution, then el objeto resultado muestra el valor calculado por la función; al cambiar los valores de entrada y re-ejecutar, el resultado se actualiza.

**Dependencias:** L-M5-03

---

### L-M5-05 — Assertions y detección de deadlocks

**Prioridad:** P2
**Módulo:** Ejecución Formal
**Evidencia:** nueva

Como modelador, quiero definir assertions sobre el comportamiento del modelo y verificarlas durante la simulación, y ejecutar análisis estático del grafo para detectar deadlocks, estados inalcanzables y objetos consumidos antes de ser creados, para detectar violaciones de correctness, safety y liveness antes y durante la ejecución.

**Criterios de aceptación:**

- Given un thing o enlace seleccionado, when el modelador hace clic en "Add Assertion", then se abre un editor donde puede escribir predicados en formato OPM: "after [Process], [Object] is [state]", "before [Process], [Object] exists", "[Object] is never in [state] and [other-state] simultaneously".
- Given un modelo con assertions definidas, when el modelador ejecuta la simulación, then al finalizar se muestra un panel de resultados con cada assertion marcada como PASS (verde) o FAIL (rojo), con el paso de simulación donde falló y el estado del modelo en ese momento.
- Given una assertion que falla, when el modelador hace clic en "Show Failure Point", then la simulación hace playback hasta el paso exacto donde la assertion se violó, resaltando los things y estados involucrados.
- Given el editor de assertions, when el modelador escribe un predicado en lenguaje natural (ej. "el agua siempre debe terminar caliente"), then el LLM traduce el predicado a formato OPM assertion y lo presenta para confirmación antes de guardarlo.
- Given múltiples assertions definidas, when el modelador las visualiza en el panel de assertions, then puede activar/desactivar cada una individualmente y agruparlas por categoría (safety, liveness, correctness).
- Given un modelo con procesos y enlaces, when el modelador selecciona "Analyze Reachability" desde el menú de verificación, then el sistema ejecuta análisis estático del grafo y reporta: procesos inalcanzables, estados inalcanzables, objetos consumidos sin proceso que los cree.
- Given el análisis detecta un ciclo de invocación sin condición de salida modelada, when muestra el resultado, then indica los procesos del ciclo, dibuja el ciclo sobre el OPD, y sugiere "Add a decision object with condition link to break this cycle".
- Given el análisis detecta un proceso que espera un event link de un objeto que es consumido por otro proceso anterior en el timeline, when muestra el resultado, then indica "Process [X] waits for event from [Object], but [Object] is consumed by [Y] before [X] can execute — potential deadlock".
- Given el análisis detecta un estado de un objeto que ningún proceso produce, when muestra el resultado, then indica "State [state] of [Object] is defined but no process changes [Object] to [state] — unreachable state".
- Given los resultados de análisis de reachability, when el modelador hace clic en cualquier problema detectado, then el canvas navega al OPD correspondiente y resalta los things involucrados con indicadores de color (rojo = deadlock, amarillo = warning).
- Given un modelo con ciclos de invocación y/o condiciones probabilísticas, when el análisis estático de grafo no puede determinar si un deadlock es real (porque depende de valores de runtime), then el sistema complementa con **análisis de trazas por simulación**: ejecuta N iteraciones de la simulación ECA y verifica coinductivamente si las propiedades de safety ("nunca se alcanza estado X") y liveness ("eventualmente se alcanza estado Y") se cumplen en todas las trazas; reporta como "deadlock potencial (detectado en K de N trazas)" en vez de "deadlock confirmado".
- Given dos versiones de un modelo o dos modelos distintos, when el modelador selecciona "Compare Behavior" (complemento a diff estructural de L-M6-08), then el sistema ejecuta ambas simulaciones con los mismos inputs y compara las trazas de ejecución para determinar si los modelos son **conductualmente equivalentes** (bisimilares): producen las mismas secuencias de observaciones bajo las mismas acciones; si no son bisimilares, muestra las divergencias con el paso de simulación donde el comportamiento difiere.

**Dependencias:** L-M5-01, L-M4-02

---

### L-M5-06 — Validación de rangos

**Prioridad:** P2
**Módulo:** Ejecución Formal
**Evidencia:** video-confirmada

Como modelador, quiero definir tipos de valor y rangos válidos para objetos computacionales, para que OPModeling valide automáticamente los valores en tiempo de diseño y simulación y alerte visualmente sobre violaciones.

**Criterios de aceptación:**

- Given un objeto computacional, when el modelador define uno o más rangos de valores válidos usando notación de corchetes OPM (ej. [1,10] y [20,30]), then se pueden definir múltiples rangos disjuntos y los valores se validan contra todos; se admite notación inclusiva [] y exclusiva ().
- Given un objeto computacional con rango definido, when el modelador establece un valor por defecto dentro del rango, then al resetear el objeto el valor vuelve al default; en simulación, el default se usa si no se especifica otro valor.
- Given un objeto computacional con rango configurado, when el modelador o la simulación asigna un valor, then OPModeling muestra: azul si el rango está definido sin valor asignado, verde si el valor está dentro del rango, rojo si el valor está fuera de rango; el tooltip muestra la definición del rango al hacer hover.
- Given la configuración de Model Options > Model Validations Options, when el modelador selecciona modo "Soft" para un contexto (Design time, Execution time, Simulation o Both), then OPModeling acepta valores fuera de rango pero muestra indicador rojo; con modo "Hard", rechaza los valores fuera de rango completamente.
- Given un objeto computacional con atributo "Type" auto-generado visible, when el modelador usa "Toggle Value Object Type" en Entities Extension, then el atributo Type se muestra u oculta sin afectar la funcionalidad del objeto.
- Given un objeto con un estereotipo que define un rango (ej. Reliability [0,100]), when el modelador define un sub-rango (ej. 25-95), then el sub-rango debe estar contenido en el rango del estereotipo; si excede ese rango, se muestra un error; al resetear, el valor vuelve al sub-rango.

**Dependencias:** L-M5-03

---

### L-M5-07 — Estereotipos OPM

**Prioridad:** P2
**Módulo:** Ejecución Formal
**Evidencia:** video-confirmada

Como modelador, quiero aplicar estereotipos predefinidos a things del modelo, para agregar estructura, rangos y esencia de forma estandarizada y reutilizable sin definir cada componente desde cero.

**Criterios de aceptación:**

- Given un thing seleccionado en el OPD, when el modelador va a "Group Extension" > "Set Stereotype" y selecciona un estereotipo de la lista, then un nodo "stereotypes" aparece en el OPD y el estereotipo muestra sus sub-componentes con rangos predefinidos en modo solo lectura; los estereotipos globales se distinguen con ícono "G".
- Given la lista de estereotipos disponibles, when el modelador la revisa, then los estereotipos globales tienen ícono "G" visible y los estereotipos organizacionales no tienen ese ícono.
- Given un estereotipo anclado a un thing, when el modelador usa "Bring Connected Things" o semi-fold/in-zoom para explorarlo, then los sub-componentes se muestran como solo lectura y los rangos predefinidos son visibles pero no editables.
- Given un estereotipo anclado que define una esencia específica (ej. Sensor = físico), when el modelador lo ancla a un thing que tenía una esencia diferente (ej. informático), then la esencia del thing se actualiza automáticamente a la del estereotipo.
- Given un estereotipo anclado, when el modelador selecciona "Unlink Stereotype", then la asociación se elimina pero los sub-componentes ya traídos al diagrama permanecen como things regulares.
- Given un estereotipo anclado, when el modelador selecciona "Unlink and Remove All Components", then el estereotipo y todos sus sub-componentes se eliminan del OPD.
- Given un estereotipo que contiene otro estereotipo anidado (ej. Sensor contiene Property Set), when el modelador explora el estereotipo padre, then los estereotipos anidados se muestran también en modo solo lectura.

**Dependencias:** L-M1-02

---

### L-M5-08 — Input de usuario en simulación

**Prioridad:** P2
**Módulo:** Ejecución Formal
**Evidencia:** video-confirmada

Como modelador, quiero modelar la captura de input del usuario durante la simulación mediante un agente conectado a un proceso, para simular interacciones humanas dentro del flujo de ejecución del modelo.

**Criterios de aceptación:**

- Given un objeto físico "User" conectado como agente a un proceso mediante un agent link, when el modelador configura ese vínculo, then aparece un botón toggle "Get input during simulation" en el proceso para activar o desactivar la captura de input.
- Given el toggle "Get input during simulation" activado en un proceso, when la simulación alcanza ese proceso, then aparece un pop-up solicitando un valor al usuario; con el toggle desactivado, la simulación continúa sin solicitar input.
- Given el pop-up de input visible durante la simulación, when el modelador ingresa un valor (texto, número, etc.) y hace clic en "Apply", then el valor se almacena en el objeto computacional de resultado conectado al proceso y la simulación continúa con ese valor.
- Given un proceso con agente de input configurado, when el modelador abre el IDE integrado para ese proceso, then la variable "user input" está automáticamente disponible en las funciones auto-generadas y puede usarse en el código para retornar el valor del usuario.

**Dependencias:** L-M5-01

---

### L-M5-09 — Simulación headless (async)

**Prioridad:** P3
**Módulo:** Ejecución Formal
**Evidencia:** video-confirmada

Como modelador, quiero ejecutar la simulación en modo asíncrono sin animación visual, para procesar múltiples iteraciones rápidamente en segundo plano y obtener resultados estadísticos sin esperar la visualización paso a paso.

**Criterios de aceptación:**

- Given un modelo con parámetros de simulación configurados, when el modelador selecciona el modo asíncrono (async) e inicia la simulación, then todas las iteraciones se ejecutan en background sin mostrar tokens ni animación visual paso a paso.
- Given una simulación asíncrona en ejecución, when el procesamiento finaliza, then los resultados están disponibles para descarga o revisión sin haber interrumpido el trabajo del modelador con animaciones.

**Dependencias:** L-M5-01

---

## M6 — Plataforma

### L-M6-01 — Guardar y cargar modelos (graph-native, git-diffable)

**Prioridad:** P0
**Módulo:** Plataforma
**Evidencia:** frame-confirmada

Como modelador, quiero guardar y cargar modelos desde el sistema de archivos local en formato graph-native (property graph), para persistir mi trabajo en un formato text-based, git-diffable que preserva la estructura de nodos y aristas con sus propiedades tipadas y es versionable directamente con git.

**Criterios de aceptación:**

- Given un modelo nuevo sin guardar, when hago clic en "Save", then se abre el diálogo "Save As" con campos de nombre, descripción y selector de ruta local; al confirmar, el modelo se persiste en formato graph-native (property graph: nodos y aristas con propiedades tipadas) y el título del tab se actualiza.
- Given un modelo ya guardado previamente, when hago clic en "Save" o en el botón de guardado rápido, then el modelo se guarda silenciosamente en el mismo archivo y aparece confirmación "Successfully saved".
- Given cualquier modelo abierto, when selecciono "Save As" desde el menú principal, then se abre el diálogo completo de guardado permitiendo cambiar nombre, descripción y ruta destino.
- Given el diálogo de guardado o carga abierto, when escribo en el campo de búsqueda, then la lista de modelos se filtra en tiempo real por nombre.
- Given el explorador de modelos, when alterno entre vista de lista y vista de íconos, then la vista cambia mostrando en lista: nombre, fecha y tamaño; en íconos: miniaturas de los modelos.
- Given un modelo en el explorador, when selecciono "Rename" y confirmo el nuevo nombre, then el nombre se actualiza en el sistema de archivos y en el título del tab.
- Given el explorador de modelos abierto desde "Load", when selecciono un modelo y hago clic en "Load" o hago doble clic, then el modelo se carga y se muestra en el canvas.
- Given la vista de lista del explorador, when hago hover sobre un modelo, then se muestra un tooltip con nombre, fecha, autor y descripción del modelo.
- Given que el modelo persiste en formato graph-native text-based, when el usuario ejecuta `git diff` entre dos versiones del archivo, then el diff es legible e identifica qué nodos y aristas se añadieron, eliminaron o modificaron, sin bloques binarios.
- Given una sección "Recent Models" en el explorador, when la abro, then se muestran los 5 modelos más recientemente abiertos, ordenados del más reciente al más antiguo.
- Given el modelo persiste como property graph, when el sistema serializa, then cada node tiene tipo (object, process, state, opd), cada edge tiene tipo (procedural, structural, control, appears_in, child_of, has_state), y cada OPD es un node conectado a sus things vía edges `appears_in` y a su OPD padre vía edge `child_of`; esta estructura implementa la fibración π: C_opm → C_opd_tree.
- Given un modelo cargado, when el sistema valida integridad del grafo, then verifica que todo state-node está conectado a exactamente un object-node vía `has_state`, y que eliminar un object-node cascadea la eliminación de todos sus state-nodes (invariante de subobjeto: State ↪ Object es mono).

**Invariantes categóricos de implementación:**

- Given el Domain Engine serializando un modelo, when persiste al formato graph-native, then el archivo serializa explícitamente las tres capas de celdas: 0-celdas (Things + States + OPDs con sus tipos), 1-celdas (Links con tipo procedimental/estructural/control/contención), y 2-celdas (control modifiers event/condition como transformaciones sobre 1-celdas). La estructura de celdas es reconstructible sin ambigüedad.
- Given el Domain Engine cargando un modelo desde archivo, when deserializa y reconstruye la categoría en memoria, then verifica las path equations de composición: para toda cadena f:A→B, g:B→C existente, la composición g∘f es calculable y consistente. Si alguna path equation falla, el sistema emite un error de integridad categórica indicando los morfismos involucrados.

**Dependencias:** ninguna

---

### L-M6-02 — Undo/Redo

**Prioridad:** P0
**Módulo:** Plataforma
**Evidencia:** frame-confirmada

Como modelador, quiero deshacer y rehacer acciones en el modelo OPM de forma granular, para recuperarme de errores de edición sin perder trabajo.

**Criterios de aceptación:**

- Given que el modelador hace clic en "Undo" de la barra de herramientas principal o usa el atajo de teclado correspondiente, when la acción se ejecuta, then la última acción realizada se revierte (creación, eliminación, movimiento, edición de nombre, cambio de enlace) y tanto el OPD como el OPL se actualizan para reflejar el estado anterior.
- Given que el modelador hace clic en "Redo" de la barra de herramientas principal, when la acción se ejecuta, then la acción previamente revertida por Undo se re-aplica al modelo.

**Dependencias:** ninguna

---

### L-M6-03 — CLI completa (`opmod`) con paridad de features

**Prioridad:** P0
**Módulo:** Plataforma
**Evidencia:** nueva

Como agente AI o usuario experto en terminal, quiero operar el modelo OPM completamente desde la CLI `opmod` con paridad de features respecto a la UI web, para que cualquier operación posible en la interfaz gráfica sea invocable desde terminal y permita automatización y uso programático por agentes.

**Criterios de aceptación:**

- Given la CLI `opmod` instalada, when el usuario ejecuta `opmod create process "Heating"` o `opmod create object "Water"`, then el thing se crea en el modelo activo con el tipo y nombre indicados, y la confirmación muestra el ID del nodo creado en el grafo; la misma operación también es invocable para estados, OPDs y sub-modelos.
- Given things existentes en el modelo, when el usuario ejecuta `opmod connect Water Heating --as effect`, then se crea el enlace procedimental del tipo especificado entre los things indicados; tipos válidos incluyen `effect`, `agent`, `instrument`, `consume`, `result`, `input`, `output`, `condition`, `aggregation`, `exhibition`, `generalization`; si hay ambigüedad de nombres, se lista los candidatos y se solicita confirmación.
- Given un proceso en el modelo, when el usuario ejecuta `opmod inzoom ProcessName`, then se crea el OPD hijo del in-zoom con el proceso padre correspondiente, equivalente a la operación de in-zoom desde el halo en la UI; el resultado indica el ID del nuevo OPD.
- Given un objeto en el modelo, when el usuario ejecuta `opmod unfold ObjectName`, then se ejecuta el unfold del objeto creando el OPD de unfold correspondiente, equivalente a la operación desde el halo en la UI.
- Given un modelo con procesos y objetos conectados, when el usuario ejecuta `opmod simulate` o `opmod simulate --assertions --iterations 100`, then se ejecuta la simulación ECA (con o sin assertions, con el número de iteraciones indicado) y se imprime el resultado: estados finales de objetos, assertions PASS/FAIL, y cualquier deadlock o estado inalcanzable detectado.
- Given un modelo abierto, when el usuario ejecuta `opmod validate` o `opmod validate --strict`, then se ejecuta la validación metodológica OPM (equivalente a J4-003) y se imprime la lista de errores y advertencias con el nombre del thing afectado; el modo `--strict` trata advertencias como errores y retorna exit code 1 si hay alguna.
- Given un modelo con datos, when el usuario ejecuta `opmod query "qué procesos no tienen enlace de transformación"`, then el sistema ejecuta la consulta semántica sobre el grafo (equivalente a L-M4-05) y devuelve los resultados como lista en stdout; consultas con resultados vacíos retornan lista vacía con exit code 0.
- Given un modelo abierto, when el usuario ejecuta `opmod opl export` o `opmod opl import path/to/file.opl`, then se exporta el OPL completo del modelo como texto a stdout (o a archivo si se especifica ruta), o se importa OPL desde archivo actualizando el grafo correspondientemente.
- Given una descripción en lenguaje natural, when el usuario ejecuta `opmod nl "A coffee machine makes coffee from water and beans"`, then el LLM adapter parsea la descripción, genera los things y enlaces OPM correspondientes, y los crea en el modelo activo mostrando un resumen de los elementos creados.
- Given un modelo en memoria, when el usuario ejecuta `opmod save` o `opmod save path/to/model.opg`, then el modelo se persiste en formato graph-native en la ruta indicada (o en la ruta por defecto del modelo actual si no se especifica); `opmod load path/to/model.opg` carga el modelo desde la ruta indicada y lo establece como modelo activo.
- Given dos versiones de un archivo de modelo, when el usuario ejecuta `opmod diff version1.opg version2.opg`, then se imprime el diff semántico entre ambas versiones en formato legible: things añadidos/eliminados/modificados y enlaces añadidos/eliminados/modificados, equivalente al resumen textual de L-M6-08.

**Origen:** NUEVA (Decisión Arquitectural DA-1: CLI-First)
**Dependencias base (P0):** L-M1-02, L-M1-03, L-M1-07, L-M2-01, L-M6-01
**Dependencias de paridad (se extiende incrementalmente):** L-M5-01 (Pulso P5), L-M4-02 (Pulso P4), L-M4-05 (Pulso P7), L-M2-03 (Pulso P2), L-M6-08 (Pulso P7)
**Nota:** La CLI base se entrega en P0 con `opmod create`, `opmod connect`, `opmod opl`, `opmod save/load`. Los comandos `opmod simulate`, `opmod validate`, `opmod query`, `opmod nl`, `opmod diff` se habilitan cuando sus módulos correspondientes se completan en Pulsos posteriores.

---

### L-M6-04 — Configuración OPL (idioma, verbosidad, resaltado)

**Prioridad:** P1
**Módulo:** Plataforma
**Evidencia:** inferida

Como modelador, quiero personalizar cómo se genera y presenta el OPL (idioma, visibilidad de sentencias de esencia, unidades, alias, autoformat y resaltado cruzado), para adaptar la verbosidad y el idioma del OPL a mi contexto sin alterar la semántica del modelo.

**Criterios de aceptación:**

- Given que el modelador va a "OPL Settings" y selecciona un idioma diferente (chino, francés, alemán, coreano, entre otros), when guarda, then todas las sentencias OPL del modelo abierto se regeneran en el idioma seleccionado de forma inmediata.
- Given que el modelador cambia la esencia por defecto (Physical/Informatical) en la configuración OPL, when crea nuevos things, then estos se crean con la esencia configurada como default.
- Given que el modelador configura visibilidad de sentencias de esencia como "Non-Default Things", when el OPL se muestra, then solo los things cuya esencia difiere del default del sistema incluyen su sentencia OPL de esencia; los demás la omiten para reducir verbosidad.
- Given que el modelador configura visibilidad de unidades de objetos computacionales (Always / Hide / When Applicable), when el OPL se muestra, then las unidades se muestran u ocultan según la opción seleccionada.
- Given que el modelador configura visibilidad de alias (activado/desactivado), when el OPL se muestra, then los alias de things aparecen o se omiten en las sentencias OPL.
- Given que el modelador configura autoformat por defecto como desactivado, when crea nuevos things, then el texto se mantiene exactamente como lo escribe el modelador sin capitalización automática.
- Given que el modelador activa "Show Highlight of OPL when hovering OPD", when pasa el cursor sobre un thing en el OPD, then la sentencia OPL correspondiente se resalta en el panel OPL.
- Given que el modelador activa "Show Highlight OPD when hovering OPL", when pasa el cursor sobre una sentencia en el OPL, then el thing correspondiente se resalta en el OPD.
- Given que el modelador activa sincronización de color OPL/OPD, when cambia el color de texto de un thing en el OPD, then el color de la sentencia correspondiente en el OPL se actualiza al mismo color.

**Dependencias:** L-M2-01

---

### L-M6-05 — Configuración general (autoguardado, spell check)

**Prioridad:** P1
**Módulo:** Plataforma
**Evidencia:** inferida

Como modelador, quiero controlar las opciones generales del sistema (autoguardado, precisión decimal, spell checking, visibilidad de notas, formato de nombres de OPD), para que OPModeling se comporte de acuerdo a mis preferencias de flujo de trabajo.

**Criterios de aceptación:**

- Given que el modelador cambia el intervalo de autoguardado en Settings, when el intervalo configurado transcurre, then el sistema guarda automáticamente el modelo abierto; el intervalo configurable tiene valores mínimo y máximo definidos (default 5 minutos).
- Given que el modelador selecciona la precisión decimal para valores de tiempo (ej. 2 decimales), when los valores temporales se muestran en el modelo, then todos usan la cantidad de dígitos decimales configurada.
- Given que el modelador elige entre el corrector ortográfico integrado de OPModeling o el del navegador, when escribe nombres de things, then las sugerencias de ortografía provienen de la fuente seleccionada.
- Given que el modelador configura visibilidad de notas por defecto como "oculto", when abre un modelo, then las notas no se muestran al abrir; esta configuración se sincroniza con el toggle "Toggle Notes" de la barra secundaria.
- Given que el modelador elige entre mostrar nombres completos de OPDs o nombres cortos, when el árbol OPD y otras interfaces muestran nombres de OPD, then usan el formato configurado.

**Dependencias:** L-M6-01

---

### L-M6-06 — Templates y ejemplos (pool privado local)

**Prioridad:** P2
**Módulo:** Plataforma
**Evidencia:** video-confirmada

Como modelador, quiero guardar modelos como templates reutilizables en un pool privado local, insertar templates en modelos activos, y acceder a ejemplos OPM predefinidos globales, para acelerar la creación de modelos con estructuras recurrentes y orientar nuevos proyectos con patrones probados.

**Criterios de aceptación:**

- Given la barra de herramientas secundaria, when hago clic en "Insert Template", then se abre un pop-up con acceso al pool Private (templates personales locales) y ejemplos globales bundled.
- Given la lista de templates, when hago hover sobre un template, then se muestra una miniatura del System Diagram del template como overlay.
- Given un template seleccionado, when hago clic en "Load" o doble clic, then todos los things, enlaces, estados y OPDs del template se insertan en el modelo actual como descendientes del OPD activo; si el template tiene múltiples OPDs se crean como hijos del OPD activo y la jerarquía del árbol OPD se actualiza.
- Given que inserto un template que ya fue insertado previamente, when se completa la inserción, then los things del segundo template reciben un sufijo (ej. "_2") en sus nombres para evitar conflictos; los atributos conectados via exhibition link mantienen su nombre original sin sufijo.
- Given elementos de un template ya insertado, when los edito (nombres, enlaces, propiedades), then se comportan como elementos nativos del modelo sin restricciones.
- Given un template insertado, when modifico el template fuente posteriormente, then los elementos ya insertados en el modelo no se ven afectados; el desacoplamiento es completo en ambas direcciones.
- Given el menú principal, when navego a Templates > "Save Template", then se abre un diálogo con campo de nombre y campo de descripción para guardar en el pool privado local; al guardar, el template se crea con todos los OPDs del modelo.
- Given el menú principal, when navego a Templates > "Edit Template" y selecciono un template, then el template se carga con un indicador visual de que es un template; se puede editar como cualquier modelo y al guardar el template se actualiza sin afectar modelos que lo insertaron previamente.
- Given el menú principal, when hago clic en "Load Examples", then se muestra una lista de modelos de ejemplo OPM predefinidos (bundled con la aplicación) disponibles para cargar y explorar.

**Dependencias:** L-M6-01

---

### L-M6-07 — Command palette (Ctrl+K)

**Prioridad:** P1
**Módulo:** Plataforma
**Evidencia:** nueva

Como modelador, quiero abrir un command palette con Ctrl+K que permita crear things, conectar enlaces, navegar y ejecutar acciones con autocompletado semántico, para operar el modelo sin depender del mouse.

**Criterios de aceptación:**

- Given el modelador presiona Ctrl+K, when el command palette se abre, then se muestra un campo de texto con autocompletado y una lista de comandos disponibles filtrados dinámicamente por lo que el modelador escribe.
- Given el command palette abierto, when el modelador escribe "create process Heating", then se crea un proceso "Heating" en el centro del canvas activo; el autocompletado sugiere "create process" y "create object" como primeras opciones al escribir "create".
- Given el command palette abierto, when el modelador escribe "connect Water to Heating as effect", then se crea un effect link entre el objeto Water y el proceso Heating (ambos deben existir); si hay ambigüedad de nombres, se muestra un selector.
- Given el command palette abierto, when el modelador escribe "in-zoom Manufacturing", then se ejecuta el in-zoom del proceso Manufacturing, equivalente a hacer clic en "In-zoom" desde el halo.
- Given el command palette abierto, when el modelador escribe "goto SD1.2", then el canvas navega al OPD con ese identificador.
- Given el command palette abierto, when el modelador escribe "find objects without states", then se invoca la consulta semántica con esa pregunta y se muestran los resultados.

**Dependencias:** L-M1-02, L-M3-01

---

### L-M6-08 — Diff semántico entre versiones

**Prioridad:** P2
**Módulo:** Plataforma
**Evidencia:** nueva

Como modelador, quiero comparar dos versiones del modelo con un diff semántico visual side-by-side sobre el OPD, y comparar modelos distintos entre sí, para identificar qué things y enlaces fueron añadidos, eliminados o modificados entre versiones o entre modelos.

**Criterios de aceptación:**

- Given dos versiones de un modelo disponibles (versionado git o snapshots locales), when el modelador selecciona "Semantic Diff" y elige las dos versiones, then se abre una vista split-screen con el OPD de cada versión side-by-side, sincronizados en zoom y scroll.
- Given la vista de diff abierta, when el modelador observa los OPDs, then los things añadidos en la versión nueva se muestran en verde, los eliminados en rojo, y los modificados (nombre, propiedades, estados) en amarillo; los enlaces siguen la misma convención de colores.
- Given la vista de diff, when el modelador hace clic en un thing modificado (amarillo), then se muestra un tooltip con el detalle del cambio: "Name: 'Heating' → 'Warming'", "States added: lukewarm", "Affiliation: systemic → environmental".
- Given la vista de diff, when el modelador selecciona la pestaña "Summary", then se muestra una lista textual de todos los cambios agrupados por tipo: Things added (N), Things removed (N), Things modified (N), Links added (N), Links removed (N), Links modified (N).
- Given la vista de diff con cambios visibles, when el modelador selecciona un cambio y hace clic en "Cherry-pick to current model", then ese cambio específico se aplica al modelo actual sin necesidad de restaurar la versión completa.
- Given que el modelador selecciona "Compare Model" desde el menú principal y elige un segundo modelo (archivo distinto), when la comparación se ejecuta, then el sistema genera una vista de diff semántico equivalente mostrando las diferencias entre los dos modelos: things agregados, eliminados, modificados, y cambios en enlaces.

**Dependencias:** L-M6-01
