---
_manifest:
  urn: "urn:fxsl:kb:metodologia-modelamiento-opm"
  provenance:
    created_by: "kora/curator"
    created_at: "2026-03-25"
    source: "synthesis:opm-iso-19450,opm-mbse-foundations,opm-applied-system-modeling,opm-sd-wizard,opm-complexity-management,opcloud-tutorial-videos"
version: "1.0.0"
status: published
tags: [opm, methodology, system-modeling, sd-construction, refinement, complexity-management, modeling-protocol, spec]
lang: es
extensions:
  kora:
    depends_on:
      - "urn:fxsl:kb:opm-iso-19450"
      - "urn:fxsl:kb:opm-mbse-foundations"
      - "urn:fxsl:kb:opm-applied-system-modeling"
      - "urn:fxsl:kb:opm-sd-wizard"
---

# Metodologia de Modelamiento OPM — Protocolo de Modelamiento Conceptual de Sistemas

## 1 Definicion

Esta especificacion define la metodologia para construir modelos conceptuales de sistemas usando Object-Process Methodology (OPM). Cubre el procedimiento completo desde la clasificacion del sistema hasta la gestion de complejidad en multiples niveles de detalle. Para la especificacion formal del lenguaje OPM (notacion, gramatica, simbolos), ver [OPM ISO 19450](urn:fxsl:kb:opm-iso-19450). Para fundamentos ontologicos, ver [OPM Foundations](urn:fxsl:kb:opm-mbse-foundations).

## 2 Definiciones

| Termino | Definicion |
|---------|-----------|
| SD (System Diagram) | OPD de nivel 0 que define proposito, alcance y funcion principal del sistema |
| SD1 | OPD descendiente de SD donde el proceso principal se refina exponiendo subprocesos |
| OPD (Object-Process Diagram) | Diagrama unico de OPM que expresa estructura y comportamiento |
| OPL (Object-Process Language) | Modalidad textual de OPM, equivalente semantica del OPD |
| Beneficiario | Stakeholder que extrae valor y beneficio del sistema |
| Atributo del beneficiario | Objeto informatical que describe como el beneficiario se beneficia |
| Transformee | Objeto transformado por el proceso principal |
| Benefit-Providing Object | Objeto principal del sistema afectado por el proceso principal |
| Agente | Enabler humano del proceso |
| Instrumento | Enabler no humano del proceso |
| Funcion | Proceso de nivel superior que provee valor, percibido por el beneficiario |
| Arquitectura | Combinacion de estructura + comportamiento que habilita la funcion |
| Emergencia | Capacidad del sistema completo que ninguna parte individual exhibe |

## 3 Fundamentos Ontologicos

### 3.1 Principio de Ontologia Minima

> Si un sistema puede especificarse al mismo nivel de precision y detalle con dos lenguajes de diferentes tamanos ontologicos, el lenguaje con ontologia menor es preferible, siempre que la comprensibilidad sea comparable.

OPM usa exactamente tres tipos de elementos: objetos con estado, procesos, y relaciones.

### 3.2 Teorema Objeto-Proceso

> Objetos con estado, procesos y relaciones entre ellos constituyen una ontologia universal minima.

Demostrado por necesidad (especificar estructura requiere objetos; especificar comportamiento requiere procesos) y suficiencia (las cosas existen o suceden; solo se asocian mediante relaciones).

### 3.3 Asercion Objeto-Proceso

> Usando objetos con estado, procesos, relaciones, y mecanismos de refinamiento (in-zooming y unfolding), se puede modelar conceptualmente cualquier sistema en cualquier dominio y nivel de complejidad.

## 4 Principios de Modelamiento

Todo modelamiento OPM DEBE respetar estos principios. Constituyen restricciones invariantes que gobiernan cada decision de modelamiento.

### 4.1 Function-as-a-Seed

> El modelamiento de un sistema DEBE comenzar definiendo, nombrando y representando la funcion del sistema, que es su proceso de nivel superior.

La funcion es la semilla de la que evoluciona el modelo. Comenzar por la forma (objetos) en vez de la funcion (proceso) es un error comun.

### 4.2 Importancia de Thing

> La importancia de un thing T en un modelo OPM es directamente proporcional al OPD mas alto en la jerarquia donde T aparece.

Objetos y procesos tienen igual estatus; ninguno tiene supremacia sobre el otro.

### 4.3 Transformacion de Objeto por Proceso

> En un modelo OPM completo, cada proceso DEBE estar conectado a al menos un objeto que el proceso transforma o a un estado de ese objeto.

Un proceso sin transforming link no tiene significado. Un proceso PUEDE tener multiples transformees.

### 4.4 Unicidad de Link Procedural

> A cualquier nivel de detalle, un objeto y un proceso PUEDEN estar conectados con a lo sumo un link procedural, que determina univocamente el rol del objeto respecto al proceso.

Si un objeto es simultaneamente agent y affectee, el efecto (transforming link) tiene precedencia sobre el enabling link.

### 4.5 Representacion de Hechos del Modelo

> Todo hecho del modelo DEBE aparecer en al menos un OPD del set de OPDs del modelo.

No todo hecho necesita repetirse en cada OPD. Suficiente con que aparezca al menos una vez.

### 4.6 Jerarquia de Detalle

> Cuando un OPD se vuelve dificil de comprender por exceso de detalle, se DEBE crear un nuevo OPD descendiente.

### 4.7 Equivalencia Grafics-Texto

> Todo modelo OPM DEBE expresarse en modalidades graficas (OPD) y textuales (OPL) semanticamente equivalentes.

Cada OPD tiene un paragrafo OPL correspondiente. La redundancia aprovecha canales cognitivos duales (visual + verbal).

### 4.8 Trade-off Completitud-Claridad

> El detalle abrumador de sistemas reales DEBE balancearse distribuyendo la especificacion completa a traves del set de OPDs, manteniendo cada OPD individual claro y comprensible.

## 5 Clasificacion del Sistema

Antes de construir el SD, el modelador DEBE clasificar el sistema. La clasificacion determina que componentes del SD aplican.

| Categoria | Proposito | Agentes | Problem Occurrence | Componentes SD |
|-----------|-----------|---------|-------------------|----------------|
| Artificial (tecnologico) | Purpose: beneficio intencional | Si | Si (mirror image) | 5 (completo) |
| Natural | Outcome: efecto sobre affectees (beneficial o detrimental) | No (no hay humanos involucrados) | No aplica | 3 (funcion, enablers, environment) |
| Social | Purpose: beneficio via interaccion humana | Si (core del sistema) | Si | 5 (completo) |
| Socio-tecnico | Purpose: integra tecnologia + aspectos sociales | Si | Si | 5 (completo) |

### 5.1 Sistemas Artificiales

DEBE modelarse con los 5 componentes completos. El purpose expresa el valor que el sistema provee a sus beneficiarios. El problem occurrence es el mirror image del purpose: un proceso environmental causa el estado problematico.

### 5.2 Sistemas Naturales

NO DEBE modelarse purpose (no hubo diseno intencional). Se DEBE usar "outcome" en su lugar. El outcome PUEDE ser beneficial o detrimental. NO DEBE modelarse problem occurrence. NO hay agentes humanos — solo instrumentos. Ejemplo: sistema de tormenta — Warm Ocean Water es instrumento, Atmosphere es environmental.

### 5.3 Sistemas Sociales

DEBE modelarse con los 5 componentes completos. Los agentes son el nucleo (organizadores, participantes). Los instrumentos incluyen facilidades y equipamiento. El environment PUEDE incluir condiciones que afectan asistencia (clima). Se PUEDE usar state-specified enabling links (ej: Weather en estado "good" como instrumento condicionado).

### 5.4 Sistemas Socio-Tecnicos

DEBE modelarse con los 5 componentes completos. Frecuentemente requiere tagged structural links para relaciones que no caen en las cuatro fundamentales. Ejemplo: "Online Professional Profile **represents** User".

## 6 Construccion del SD — Nivel 0

El SD DEBE ser simple y claro, con minimos detalles tecnicos. Todos los stakeholders — managers, clientes, proveedores, expertos — DEBEN poder comprender el SD sin expertise tecnico.

### 6.1 Paso 1: Identificacion del Proceso Principal

El modelador DEBE identificar el proceso principal que provee el beneficio del sistema.

El nombre del proceso DEBE usar una forma aceptada de nombramiento de proceso.

- **En ingles:** alguna palabra del nombre puede usar gerundio (`-ing`)
- **En espanol:** la **primera palabra** puede usar infinitivo (`-ar/-er/-ir`), gerundio (`-ando/-iendo`) **o** una forma nominalizada de accion en `-ción/-sión/-miento`

**Correcto:** `Battery Charging`, `Airplane Flying`, `Road Danger Warning`, `Evaluación de Elegibilidad`, `Coordinación Interequipo`

**Incorrecto:** `Charge Battery`, `Fly Airplane`, `Road Danger Warn`, `Plan de Coordinación`

En espanol, las formas en `-ción` se consideran validas solo cuando aparecen en la **primera palabra** del nombre del proceso y nombran claramente una accion/proceso. El nombre DEBERIA combinar el transformee seguido de una forma procesual clara cuando se necesite claridad. Este naming es tambien el nombre de la funcion del sistema.

### 6.2 Paso 2: Grupo Beneficiario

El modelador DEBE identificar el grupo beneficiario — los stakeholders que extraen valor del sistema.

El nombre DEBE ser singular segun el Singular Name OPM Principle:
- Para humanos: sufijo "Group" (ej: "Passenger Group")
- Para inanimados: sufijo "Set" (ej: "Airplane Set")

El grupo beneficiario DEBE representarse como objeto fisico.

### 6.3 Paso 3: Atributo del Beneficiario y Estados

El modelador DEBE definir un atributo del beneficiario — un objeto informatical que describe como el beneficiario se beneficia.

Se DEBEN definir exactamente dos estados (valores) para este atributo:
- **Estado input** (actual/problematico): antes de que el sistema opere
- **Estado output** (deseado/mejorado): despues de que el sistema entregue su beneficio

El proceso principal DEBE conectarse a estos estados via un par de links input-output.

OPL resultante: "[Main Process] changes [Beneficiary Attribute] of [Beneficiary Group] from [input state] to [output state]."

### 6.4 Paso 4: Funcion Principal (Transformee + Benefit-Providing Attribute)

El modelador DEBE identificar el transformee principal (Benefit-Providing Object) — el objeto cuya transformacion entrega el beneficio.

El modelador DEBERIA agregar un Benefit-Providing Attribute al transformee, cuyo valor cambia de problematico a satisfactorio mediante el proceso principal.

Cuando el proceso principal transforma multiples transformees, solo el Benefit-Providing Object es parte de la funcion. Otros transformees (consumidos o producidos) DEBEN modelarse pero NO definen la funcion.

### 6.5 Paso 5: Identificacion de Agentes

El modelador DEBE determinar si el beneficiario es tambien agente del sistema.

Los agentes DEBEN ser humanos o grupos humanos. Cada agente DEBE conectarse al proceso principal via agent link (circulo solido / "black lollipop").

OPL resultante: "[Agent] handles [Main Process]."

Para sistemas naturales sin participacion humana, NO DEBE haber agentes.

### 6.6 Paso 6: Naming del Sistema y Exhibition

El sistema es el instrumento principal que habilita el proceso.

El nombre default DEBERIA ser el nombre del proceso principal seguido de "System" (ej: "Battery Charging System"). El modelador PUEDE usar un nombre comunmente aceptado en su lugar (ej: "Air Traffic Control Tower").

El proceso principal DEBE modelarse como operacion (feature) del sistema via exhibition-characterization.

### 6.7 Paso 7: Identificacion de Instrumentos

El modelador DEBE identificar instrumentos — enablers no humanos requeridos durante toda la duracion del proceso.

Cada instrumento DEBE conectarse al proceso principal via instrument link (circulo abierto / "white lollipop").

OPL resultante: "[Main Process] requires [Instrument]."

### 6.8 Paso 8: Objetos Input/Output

El modelador DEBE identificar objetos consumidos por el proceso (inputs que dejan de existir).

Cada objeto consumido DEBE conectarse via consumption link.

Si un objeto es tanto input como output (afectado, no consumido), DEBE conectarse via par input-output especificando la transicion de estados.

Cada objeto creado por el proceso DEBE conectarse via result link.

### 6.9 Paso 9: Objetos Environmentales

El modelador DEBE identificar objetos que afectan la operacion del sistema pero estan fuera del control del ingeniero de sistemas.

Los objetos environmentales DEBEN representarse con contorno dashed. Un mismo objeto PUEDE ser systemic en un modelo y environmental en otro.

Los objetos environmentales PUEDEN servir como instrumentos o agentes del proceso principal.

### 6.10 Paso 10: Problem Occurrence

Para sistemas artificiales y sociales, el modelador DEBE modelar el problem occurrence — mirror image del purpose y main function.

Se DEBE agregar un proceso environmental que causa el problema. Este proceso causa:
1. El beneficiary attribute en su estado negativo (input state del purpose)
2. El benefit-providing attribute en su estado problematico

OPL resultante: "[Environmental Process] yields [Beneficiary Attribute] of [Beneficiary Group] at state [negative] and [Benefit-Providing Attribute] at state [problematic]."

Para sistemas naturales, el problem occurrence NO DEBE modelarse.

### 6.11 Verificacion del SD

Tras completar los 10 pasos, el modelador DEBE verificar el SD contra este checklist:

| Check | Condicion | Severidad |
|-------|-----------|----------|
| Purpose definido | SD contiene beneficiary + beneficiary attribute + transicion de estados | CRITICA |
| Funcion definida | SD contiene main process + main transformee | CRITICA |
| Enablers presentes | Al menos un agente o instrumento conectado | ALTA |
| Environment identificado | Al menos un objeto environmental existe | MEDIA |
| Problem occurrence modelado | Proceso environmental causa estado negativo (si aplica) | MEDIA |
| OPL legible | Sentencias OPL generadas describen correctamente cada componente | ALTA |
| Nombres singulares | Todos los names usan Set/Group para plurales | ALTA |
| Gerund naming | Proceso principal usa forma gerundio | ALTA |
| Exhibition | Sistema exhibe proceso principal como operacion | ALTA |

## 7 Construccion de SD1 — Refinamiento Nivel 1

SD1 refina el SD exponiendo subprocesos del proceso principal y objetos asociados. El modelador DEBE crear SD1 cuando el SD no provee suficiente detalle sobre estructura, comportamiento o funcion del sistema.

### 7.1 Refinamiento de Proceso Sincronico (In-Zooming)

Aplica cuando los subprocesos tienen un orden fijo y predefinido de ejecucion.

**Procedimiento:**
1. Crear nuevo OPD etiquetado SD1
2. Inflar el proceso principal en el centro del OPD
3. Agregar subprocesos dentro del proceso inflado, dispuestos verticalmente segun el **Timeline OPM Principle**: el primero arriba, el ultimo abajo
4. Cada subproceso DEBE estar conectado a al menos un transformee
5. Verificar que los subprocesos son partes del proceso principal (aggregation-participation implicita por contencion grafica)

**Correcto:** Subprocesos dispuestos top-to-bottom en orden temporal dentro del proceso inflado.

**Incorrecto:** Subprocesos fuera del proceso inflado, o sin orden vertical claro.

### 7.2 Refinamiento de Proceso Asincronico (Unfolding)

Aplica cuando los subprocesos son independientes y PUEDEN ocurrir en cualquier orden.

**Procedimiento:**
1. Crear nuevo OPD etiquetado SD1
2. Agregar subprocesos fuera del proceso principal
3. Conectar via relacion estructural:
   - **Aggregation-participation** si los subprocesos son partes del proceso principal
   - **Generalization-specialization** si los subprocesos son tipos/especializaciones del proceso principal
4. Cada subproceso DEBE tener al menos un transformee

**Decision rule:** Si cada subproceso es una variante del mismo tipo de transformacion → generalization-specialization. Si los subprocesos son operaciones distintas que componen el proceso completo → aggregation-participation.

### 7.3 Refinamiento de Objetos

Los objetos se refinan en SD1 via unfolding (no in-zooming, porque los objetos son estaticos y la sincronicidad es irrelevante).

**Procedimiento:**
1. Identificar partes del objeto (aggregation-participation)
2. Identificar atributos del objeto (exhibition-characterization)
3. Representar en nuevo OPD como "object tree": refineable + refinees

### 7.4 Distribucion y Migracion de Links

Al hacer in-zooming, los links del proceso padre se distribuyen a los subprocesos. Reglas criticas:

| Tipo de link | Distribucion al outer contour | Migracion default |
|-------------|------------------------------|-------------------|
| Agent link | PERMITIDO (distribuye a todos los subprocesos) | — |
| Instrument link | PERMITIDO (distribuye a todos los subprocesos) | — |
| Consumption link | PROHIBIDO (el objeto se consume una sola vez) | Migra al primer subproceso; reasignar manualmente |
| Result link | PROHIBIDO (el objeto se crea una sola vez) | Migra al primer subproceso; reasignar manualmente |
| Event link systemic | PROHIBIDO (interfiere con orden temporal) | — |

**Split state-specified transforming links:** Cuando un effect link con estados (`P changes A from s1 to s2`) se hace in-zoom con multiples subprocesos, el modelo queda **underspecified**. Resolucion en 3 pasos:
1. Original: `P changes A from s1 to s2` (univoco)
2. In-zoom sin resolver: P zoom a P1, P2 → ambiguo cual subproceso toma A fuera de s1 y cual la pone en s2
3. Resuelto con split links: `P1 changes A from s1` (split input) + `P2 changes A to s2` (split output)

### 7.5 Expresion y Supresion de Estados

Los estados DEBERIAN suprimirse en el SD cuando no estan conectados a ningun proceso en ese OPD.

Los estados DEBERIAN expresarse en SD1 donde estan conectados a subprocesos via pares input-output.

Cuando todos los estados de un objeto se suprimen, aparece un pseudo-estado (rectangulo pequeno con "...") en la esquina inferior derecha del objeto.

### 7.6 Verificacion de SD1

| Check | Condicion | Severidad |
|-------|-----------|----------|
| Todo subproceso transformee | Cada subproceso conectado a al menos un transformee | CRITICA |
| Tipo de refinamiento correcto | Sincronico → in-zooming; asincronico → unfolding | ALTA |
| Sin redundancia | Model facts de SD no repetidos innecesariamente en SD1 | MEDIA |
| Links distribuidos correctamente | Consumption/result links no en outer contour | CRITICA |
| Estados expresados | Estados relevantes visibles y conectados a subprocesos | ALTA |

## 8 Gestion de Complejidad — Niveles 2+

### 8.1 Cuatro Mecanismos de Refinamiento-Abstraccion

| Mecanismo | Refinamiento | Abstraccion | Uso principal |
|-----------|-------------|-------------|---------------|
| In-zooming / Out-zooming | Expone contenido interno de un thing | Oculta contenido interno | Procesos sincronicos; objetos con partes espaciales |
| Unfolding / Folding | Expone refinees via relacion estructural | Oculta refinees | Procesos asincronicos; taxonomias; features |
| State Expression / Suppression | Muestra estados de un objeto | Oculta estados irrelevantes al OPD | Simplificacion contextual |
| View Creating / Deleting | Ensambla hechos de varios OPDs en un View | Elimina un View | Vistas transversales (process tree, object tree, allocation) |

Reglas de aplicacion:
- In-zooming DEBERIA preferirse sobre unfolding para procesos sincronicos (requiere menos simbolos, genera OPL mas corto)
- Unfolding DEBE usarse para procesos asincronicos
- Views NO DEBEN editarse para agregar, eliminar o cambiar hechos del modelo; la edicion ocurre en OPDs no-view
- El set completo de estados de un objeto es la union de todos los estados mostrados en todos los OPDs del set

### 8.2 Organizacion del OPD Tree y Forest

El **OPD Tree** es un grafo dirigido tipo arbol cuyos nodos son OPDs obtenidos por refinamiento recursivo de procesos. Raiz: SD. Convention de etiquetado: SD, SD1, SD1.1, SD1.2, SD2, etc.

El **OPD Object Tree** es un arbol de jerarquia de objetos (partes + atributos).

El **OPD Forest** es el conjunto de todos los OPD trees del modelo (process trees + object trees).

El **System Map** es el OPD que muestra la vista completa del sistema incluyendo todos los things del modelo sin links, sirviendo como indice navegable.

### 8.3 Creacion de Vistas

Tipos de vistas:
- **Process tree**: jerarquia completa o parcial de procesos (vista procedural)
- **Object tree**: jerarquia completa o parcial de objetos (vista estructural)
- **Allocation view**: objetos asignados a realizar procesos especificos
- **Simulation-motivated view**: objetos y procesos de OPDs dispersos para inspeccion concurrente

### 8.4 Precedencia de Links durante Out-Zooming

Al hacer out-zooming, links de subprocesos migran al proceso padre. La **semantic strength** determina cual prevalece:

| B↔P1 \ B↔P2 | Effect | Result | Consumption |
|-------------|--------|--------|-------------|
| **Effect** | Effect | Result | Consumption |
| **Result** | Result | Invalido | Effect |
| **Consumption** | Consumption | Effect | Invalido |

Result + consumption al mismo objeto = invalido (no se puede crear y destruir simultaneamente).

Orden de precedencia primario: consumption = result > effect > agent > instrument.

### 8.5 Practica Middle-Out

OPM soporta refinamiento bidireccional: top-down (refinamiento) y bottom-up (abstraccion). La practica de-facto es **middle-out**: el modelador comienza por el nivel que mejor entiende y refina/abstrae en ambas direcciones segun se revela informacion.

## 9 Invariantes

| Invariante | Enforcement |
|-----------|-------------|
| Nombre del proceso principal termina en gerundio | lint |
| Todos los nombres de things son singulares | lint |
| Grupo beneficiario es objeto fisico | lint |
| Atributo del beneficiario es objeto informatical | lint |
| Exactamente un proceso principal por SD | schema |
| Agent links solo conectan a humanos | manual |
| Instrument links solo conectan a no humanos | manual |
| Todo enabler persiste sin cambio tras el proceso | manual |
| Objetos environmentales tienen contorno dashed | lint |
| Sistema exhibe proceso principal via exhibition-characterization | manual |
| Consumption/result links NO en outer contour de proceso in-zoomed | lint |
| Todo subproceso conectado a al menos un transformee | lint |
| Modelo bimodal: todo OPD tiene paragrafo OPL equivalente | schema |
| Un hecho del modelo aparece en al menos un OPD | schema |

## 10 Checklist de Validacion

| Nivel | Check | Condicion | Severidad |
|-------|-------|-----------|----------|
| SD | Sistema clasificado | Tipo determinado (artificial/natural/social/socio-tecnico) | CRITICA |
| SD | Purpose/outcome definido | Beneficiary + attribute + transicion estados | CRITICA |
| SD | Funcion definida | Main process + main transformee | CRITICA |
| SD | Enablers presentes | ≥1 agente o instrumento | ALTA |
| SD | Environment identificado | ≥1 objeto environmental | MEDIA |
| SD | Problem occurrence (si aplica) | Proceso environmental causa estado negativo | MEDIA |
| SD | Naming compliant | Gerundio + singular + Set/Group | ALTA |
| SD | Exhibition | Sistema exhibe proceso como operacion | ALTA |
| SD1 | Refinamiento correcto | Sync → in-zooming; async → unfolding | ALTA |
| SD1 | Links distribuidos | Consumption/result NO en outer contour | CRITICA |
| SD1 | Subprocesos transforman | Cada subproceso ≥1 transformee | CRITICA |
| SD1 | Estados expresados | Estados relevantes visibles y conectados | ALTA |
| SD1 | Sin redundancia | Sin duplicacion innecesaria de hechos del SD | MEDIA |
| SD2+ | Precedencia links | Out-zooming aplica matriz de precedencia | ALTA |
| SD2+ | OPD tree valido | Etiquetado secuencial correcto | MEDIA |
| Global | Bimodal | Todo OPD tiene OPL equivalente | ALTA |
| Global | Completitud | Todo hecho en ≥1 OPD | ALTA |
| Global | Claridad | Ningun OPD excesivamente complejo | MEDIA |
