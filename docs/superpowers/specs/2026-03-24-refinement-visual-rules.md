# Reglas de Codependencia Visual Cross-Refinamiento (Rev.3)

**Fecha**: 2026-03-24
**Revision**: 3 (auditoria completa contra codigo — estados actualizados, gaps priorizados)
**Autor**: fxsl/arquitecto-categorico
**Fuentes**: ISO 19450 (§3, §4, §6, §9, §10, §11, §12, §14, §17, Annex A), OPCloud Tutorial (completo), implementacion OPModel

---

## Principio Fundamental

El Model es el diagrama de dios (DA-9: colimite de Grothendieck `∫ M`). Los OPDs son fibras computadas `π⁻¹(OPD_i)`. Las reglas siguientes gobiernan como Things, States y Links se manifiestan **entre** fibras de distinto nivel de refinamiento (padre vs hijo).

Aplican dos tipos de refinamiento:
- **In-zoom**: revela estructura temporal (procesos) o espacial (objetos) DENTRO del thing refinado
- **Unfold**: revela componentes estructurales (aggregation, exhibition, generalization, classification) FUERA del thing refinado

---

## §1. Contorno Grueso (Thick Contour)

**ISO §4, §14 line 262.**

| Regla | Descripcion |
|-------|-------------|
| **R-TC-1** | Un thing refinado (con child OPD) muestra **contorno grueso** en el OPD padre |
| **R-TC-2** | El mismo thing muestra **contorno grueso** en el OPD hijo (como container) |
| **R-TC-3** | El contorno grueso es bidireccional — existe simultaneamente en padre e hijo |
| **R-TC-4** | Aplica a in-zoom Y unfold (ambos tipos de refinamiento new-diagram) |
| **R-TC-5** | In-diagram unfolding NO muestra contorno grueso (refineable y refinees en mismo OPD) |
| **R-TC-6** | Contorno solido = systemic, punteado = environmental — persiste en TODOS los niveles de refinamiento (ISO §4 line 155) |
| **R-TC-7** | Process in-zoom **agranda la elipse** para contener subprocesos; object in-zoom **agranda el rectangulo** para contener componentes (ISO §14 lines 263-274) |
| **R-TC-8** | Initial states: borde grueso. Final states: borde doble. Default states: flecha diagonal. Persisten cross-nivel (ISO §4 lines 329-331) |

**Implementacion**: `OpdCanvas.tsx:402` — `isRefined ? Math.max(baseStroke, 2.5)`, `isContainer ? 2.5`.

**R-TC-8 estado**: Implementada — data model (`initial/final/default` flags), OPL (`state-description` sentences, opl.ts:133-148), PropertiesPanel (checkboxes I/F/D), **canvas** state pills: initial=strokeWidth 2.5, final=double rect border, default=diagonal line marker.

---

## §2. Container vs Externos (Internal/External)

**ISO §14 lines 749, 835.**

| Regla | Descripcion |
|-------|-------------|
| **R-IE-1** | En un OPD hijo, el thing refinado aparece como **container** (`internal=true`) |
| **R-IE-2** | Things conectados al refinado via links se copian como **externos** (`internal=false`) |
| **R-IE-3** | **In-zoom pullback**: se copian todos los things conectados via CUALQUIER link al thing refinado que tengan appearance en el OPD padre |
| **R-IE-4** | **Unfold pullback**: se copian solo hijos estructurales (aggregation, exhibition targets) |
| **R-IE-5** | Externos heredan position auto-calculada; no heredan la posicion del padre |
| **R-IE-6** | La eliminacion del thing refinado elimina el OPD hijo y todos sus contenidos (cascade) |
| **R-IE-7** | No se puede refinar un external (appearance con `internal=false`) — I-REFINE-EXT |
| **R-IE-8** | Inside objects (creados dentro de in-zoom) se eliminan cuando el parent process se elimina — cascade (OPCloud line 112). **Implementada**: `removeThing` cascade via `collectDescendants` (api.ts:98-118) elimina OPD hijo + contenido |
| **R-IE-9** | Outside objects (creados en SD) existen independientemente y son referenciables cross-OPD (OPCloud line 113) |
| **R-IE-10** | Enveloping: agrandar un proceso puede "tragar" un objeto externo visualmente, pero **revierte al mover** (OPCloud line 157) |

**Implementacion**: `api.ts:472-576` (refineThing), `api.ts:496` (I-REFINE-EXT).

---

## §3. Distribucion de Links (C-01)

**ISO §14.2.2.4.1, §9 lines 749-754.**

Cuando un thing es in-zoomed y tiene subprocesos, los links procedurales del padre se **distribuyen** a los subprocesos segun su tipo:

| Regla | Tipo de link | Distribucion | Target |
|-------|-------------|-------------|--------|
| **R-LD-1** | Consumption, Input | → **primer** subproceso (min Y) | ISO §9: consume primero |
| **R-LD-2** | Result, Output | → **ultimo** subproceso (max Y) | ISO §9: produce al final |
| **R-LD-3** | Agent, Instrument | → **todos** los subprocesos | ISO §10: enabler distribuido |
| **R-LD-4** | Effect | → **todos** los subprocesos | ISO §9: afecta a todos |
| **R-LD-5** | Structural (aggregation, etc.) | **no se distribuye** — permanece en container | ISO §12: invariante temporal |

| Regla | Restriccion |
|-------|-------------|
| **R-LD-6** | Consumption/Result/Input/Output **NO deben** apuntar al contorno externo del in-zoom (I-CONTOUR-RESTRICT, ISO §10.5.2) |
| **R-LD-7** | Si no hay subprocesos aun, el link se muestra al container directamente (fallback) |
| **R-LD-8** | Links distribuidos se marcan como `aggregated: true` en ResolvedLink |
| **R-LD-9** | Links directos tienen precedencia sobre aggregated con mismo visual key |
| **R-LD-10** | Agent/Instrument aggregados se suprimen si el source es parte de un whole con link directo (VISUAL-03) |

**Solo aplica a in-zoom.** Unfold no tiene distribucion de links.

**Implementacion**: `simulation.ts:201-401` (resolveLinksForOpd).

---

## §4. Supresion de Estados (State Suppression)

**ISO §6 line 718, §9 lines 762-770.**

| Regla | Descripcion |
|-------|-------------|
| **R-SS-1** | Un estado `s` de un thing T se suprime en OPD padre cuando: ∃ OPD hijo in-zoom donde T es externo Y ∃ link entre T y el thing refinado que referencia `s` (source_state o target_state) |
| **R-SS-2** | La supresion se **computa** on-demand por `resolveOpdFiber()` (DA-9) — NO se almacena |
| **R-SS-3** | Solo aplica a **in-zoom**, no a unfold |
| **R-SS-4** | La supresion puede provenir de **multiples** OPDs hijo in-zoom (union de estados suprimidos) |
| **R-SS-5** | Estados no referenciados en links al refinado NO se suprimen (permanecen visibles) |
| **R-SS-6** | El indicador visual "..." (rountangle con label) aparece cuando un objeto tiene estados ocultos |
| **R-SS-7** | La supresion es coherente con el split de effect links: el input-state se muestra en el OPD hijo (split input), el output-state se muestra en el OPD hijo (split output) |
| **R-SS-8** | Indicador visual "..." (rountangle pequeño, esquina inferior derecha del objeto) aparece cuando hay estados ocultos (ISO §4 line 260) |
| **R-SS-9** | Un estado NO puede existir sin su objeto dueño — ownership estricta cross-nivel (ISO line 1248) |
| **R-SS-10** | State expression: estados suprimidos en SD se **revelan** en SD1 vinculados a subprocesos especificos (ISO line 890) |
| **R-SS-11** | Estado en transicion: entre input y output state, el affectee esta en estado **indeterminado** si el proceso se interrumpe prematuramente (ISO line 392) |

**Implementacion**: `simulation.ts:471-511` (computeStateSuppression). `OpdCanvas.tsx:908-918` (visibleStatesFor merge fiber+stored).

**R-SS-8 estado**: Implementada — indicador "..." (text, esquina inferior derecha del objeto) aparece cuando `hasSuppressedStates=true` (allStates.length > visibleStates.length). Core computa `suppressedStates` via fiber; OpdCanvas pasa el flag a ThingNode.

---

## §5. Restricciones de Frontera (Boundary Crossing)

**ISO §14.2.2.4.2, §9 line 755.**

| Regla | Descripcion |
|-------|-------------|
| **R-BC-1** | Links con modifier **event** (`e`) de objetos/estados **systemicos** NO deben cruzar la frontera in-zoom (I-EVENT-INZOOM-BOUNDARY) |
| **R-BC-2** | Razon: interferiria con el orden temporal prescrito (top-to-bottom) |
| **R-BC-3** | Links con modifier event de objetos **ambientales** PUEDEN cruzar si se modela contingencia explicita |
| **R-BC-4** | Links con modifier **condition** (`c`) que causan skip de un subproceso invocan automaticamente el siguiente subproceso en orden Y |
| **R-BC-5** | Ambas restricciones aplican solo a **in-zoom** |

**Implementacion**: `api.ts:1683-1719` (I-EVENT-INZOOM-BOUNDARY en validate).

---

## §6. Invocacion Implicita (Temporal Ordering)

**ISO §14 lines 513, 738-745.**

| Regla | Descripcion |
|-------|-------------|
| **R-TI-1** | Dentro de un in-zoom de proceso, el orden de ejecucion es **top-to-bottom** (Y creciente) |
| **R-TI-2** | La terminacion de subproceso N invoca subproceso N+1 **implicitamente** — sin link explicito |
| **R-TI-3** | Subprocesos con top-point a la **misma altura Y** se ejecutan en **paralelo** |
| **R-TI-4** | En ejecucion paralela, el ultimo en completarse invoca el siguiente nivel |
| **R-TI-5** | Solo aplica a **process in-zoom** — object in-zoom tiene orden espacial, no temporal |
| **R-TI-6** | Object in-zoom: la posicion espacial tiene significado semantico (layout de componentes) pero NO invocacion |
| **R-TI-7** | Object in-zoom: posicion espacial codifica layout fisico (componentes en un room) o logico (secciones en articulo, campos en record) — **significado semantico real** (ISO line 935) |

**Implementacion**: `simulation.ts:81-170` (getExecutableProcesses, sorted by Y).

---

## §7. Visibilidad de Links en OPDs Hijo

**ISO §14, implementacion opl.ts:183-197.**

| Regla | Descripcion |
|-------|-------------|
| **R-LV-1** | Links **estructurales** al container SON visibles en el OPD hijo (definen la estructura del unfold/in-zoom) |
| **R-LV-2** | Links **procedurales** al container NO son visibles directamente — se distribuyen (C-01) o se filtran |
| **R-LV-3** | Links entre things internos del OPD hijo son visibles normalmente |
| **R-LV-4** | Links que no tocan el container NI things internos son invisibles en el OPD hijo |
| **R-LV-5** | Links distribuidos (aggregated) pueden generar multiples links visuales desde un solo link del modelo |

**Implementacion**: `simulation.ts:275-313` (RESOLVE-01 filtering), `opl.ts:183-197` (OPL link filtering).

---

## §8. Efecto Split (Input-Output Specification)

**ISO §9 lines 762-770.**

| Regla | Descripcion |
|-------|-------------|
| **R-ES-1** | Un effect link input-output-specified (`P changes O from s1 to s2`) se vuelve **underspecified** cuando P se in-zoomea en subprocesos |
| **R-ES-2** | Resolucion: **split** en dos links — split input (`s1 → primer subproceso`) y split output (`ultimo subproceso → s2`) |
| **R-ES-3** | Este es el UNICO mecanismo para resolver underspecification de effect links en in-zoom |
| **R-ES-4** | El split preserva la semantica: el subproceso temprano saca al objeto del estado s1, el tardio lo pone en s2 |

**Implementacion**: Parcial — `transformingMode()` en helpers.ts computa los 4 modos visuales. El split explicito no esta automatizado.

---

## §9. Cambio de Rol (Role Shift)

**ISO §9 line 780.**

| Regla | Descripcion |
|-------|-------------|
| **R-RS-1** | Un objeto puede ser **instrument** en OPD padre y **affectee** en OPD hijo |
| **R-RS-2** | Valido solo si el estado inicial = estado final en el nivel padre (el objeto "parece" no cambiar) |
| **R-RS-3** | En el nivel hijo, el objeto muestra estados intermedios (ej: empty → loaded → empty) |
| **R-RS-4** | Solo aplica a in-zoom |
| **R-RS-5** | Ejemplo canonico (ISO line 1289): Dishwasher es instrument en SD, affectee en SD1 (empty→loaded→empty). Valido porque empty=empty cross-nivel |

**Implementacion**: No enforced — el modelo permite el patron naturalmente porque el link type es por-link, no por-thing.

---

## §10. Consolidacion por Out-Zooming (Link Precedence)

**ISO §14 lines 784-796.**

Cuando se out-zoomea (fold), multiples links de subprocesos al mismo objeto deben consolidarse:

| Regla | Descripcion |
|-------|-------------|
| **R-OZ-1** | Precedencia primaria: consumption = result > effect > agent > instrument |
| **R-OZ-2** | Links state-specified tienen mayor precedencia que basic links |
| **R-OZ-3** | Precedencia secundaria: event > non-control > condition (dentro de cada tipo) |
| **R-OZ-4** | Result + consumption al mismo objeto = **invalido** (no se puede crear y destruir simultaneamente) |
| **R-OZ-5** | El link de mayor precedencia es el que se muestra en el OPD padre |

**Implementacion**: Parcial — `resolveLinksForOpd` implementa la supresion de links redundantes (VISUAL-03) pero no la matriz completa de precedencia. La distribucion C-01 es el inverso.

---

## §11. Herencia Estructural

**ISO §12 line 552.**

| Regla | Descripcion |
|-------|-------------|
| **R-IH-1** | Especializaciones heredan del general: partes, features, tagged links, y **todos los links procedurales** |
| **R-IH-2** | La herencia aplica a traves de niveles de refinamiento (unfold) |
| **R-IH-3** | Links heredados no son visibles explicitamente pero aplican semanticamente |
| **R-IH-4** | Herencia de afiliacion: atributos de objetos ambientales son **automaticamente** ambientales. Procesos de entidades ambientales son ambientales (ISO line 302) |
| **R-IH-5** | Override: un specialization puede reemplazar un participante heredado con una especializacion diferente (ISO line 554) |
| **R-IH-6** | Existencia runtime: una instancia especializada NO existe sin su instancia general (ISO line 556) |
| **R-IH-7** | Migracion de links comunes: al crear un general desde specializations, links comunes se **mueven al general** (ISO line 564) |

**Implementacion**: No implementado explicitamente — la herencia de links no se computa aun.

---

## §12. Refinamiento Ciclico Prohibido

**Implementacion api.ts:501-510.**

| Regla | Descripcion |
|-------|-------------|
| **R-RC-1** | No se puede refinar un thing desde dentro de su propio arbol de refinamiento (I-REFINE-CYCLE) |
| **R-RC-2** | El chequeo es transitivo — se verifica toda la cadena de ancestros |
| **R-RC-3** | Previene loops infinitos en la fibracion |

---

## §13. OPL para Refinamiento

**ISO §17, implementacion opl.ts:65-94.**

| Regla | Descripcion |
|-------|-------------|
| **R-OPL-1** | In-zoom genera sentence de secuencia: "`P consists of P1, P2, and P3.`" |
| **R-OPL-2** | Unfold genera sentences estructurales: "`Whole consists of Part1 and Part2.`" |
| **R-OPL-3** | OPD tree edges tienen label: "`is refined by in-zooming ProcessName in`" |
| **R-OPL-4** | Links procedurales al container se filtran del OPL del hijo (se ven como distribuidos) |
| **R-OPL-5** | Links estructurales al container SE muestran en OPL del hijo |

---

## §14. Instancias Visuales y Duplicados

**ISO §4 line 267, line 1231. OPCloud lines 133-137.**

| Regla | Descripcion |
|-------|-------------|
| **R-VI-1** | Un model element puede aparecer en **cualquier numero** de OPDs — incluir solo lo necesario para explicar el aspecto (ISO line 1231) |
| **R-VI-2** | Duplicado visual en mismo OPD: small offset shape detras del thing repetido. Indica misma entidad logica, evita links cruzados (ISO line 267, 1235). Usar con moderacion. |
| **R-VI-3** | Visual instance ≠ Logical instance — visual = misma identidad en diferente view; logical = relacion classification/inheritance (OPCloud line 137) |
| **R-VI-4** | No se puede crear visual instance entre tipos diferentes (object→process **prohibido**) (OPCloud line 135) |
| **R-VI-5** | Crear visual instance via "use existing thing" al detectar conflicto de nombre (OPCloud line 133) |

**Implementacion**: Appearances multiples por thing ya soportadas (key = `thing::opd`). Duplicate visual indicator no implementado.

---

## §15. Propiedades Invariantes Cross-Nivel

**ISO §4, §14.**

| Regla | Descripcion |
|-------|-------------|
| **R-PI-1** | **Essence** (physical/informatical) NO cambia across refinement — propiedad estatica (ISO line 299) |
| **R-PI-2** | **Perseverance** (static/dynamic) NO cambia — determinada por kind (ISO line 298) |
| **R-PI-3** | **Nombres** no cambian across refinement (implicito — capitalization convention consistente, ISO line 1246) |
| **R-PI-4** | **Model fact consistency**: un hecho en un OPD no puede contradecir un hecho en otro OPD. Refinement/abstraction de hechos NO es contradiccion (ISO line 839) |
| **R-PI-5** | **Importancia proporcional**: la importancia relativa de un thing es proporcional al OPD mas alto del hierarchy donde aparece (ISO line 1256) |

**Implementacion**: Essence y kind son inmutables en el modelo. Consistency check parcial en validate().

---

## §16. Semi-Fold (Compresion de Contexto)

**OPCloud lines 177-178.**

| Regla | Descripcion |
|-------|-------------|
| **R-SF-1** | Semi-fold muestra **nombres** de partes dentro del container sin expandir completamente |
| **R-SF-2** | Indicador "N more" en el link cuando hay partes ocultas |
| **R-SF-3** | Extract Part: doble-click en una parte semi-folded la trae al diagrama principal |
| **R-SF-4** | Full unfold muestra detalles completos; semi-fold es intermedio entre fold y unfold |

**Implementacion**: `api.ts:getSemiFoldedParts()`, `OpdCanvas.tsx` ThingNode con `semiFoldEntries`.

---

## §17. OPD Tree y Navegacion

**ISO §14 lines 730-732. OPCloud lines 54, 95.**

| Regla | Descripcion |
|-------|-------------|
| **R-NT-1** | OPD process tree: root = SD, labels SD, SD1, SD1.1, etc. Navegacion primaria (ISO line 730) |
| **R-NT-2** | OPD object tree: paralelo al process tree, para elaboracion de objetos (ISO line 732) |
| **R-NT-3** | Solo **leaf nodes** son eliminables — inner nodes protegidos para integridad del arbol (OPCloud line 95) |
| **R-NT-4** | **View OPDs** son colecciones ad-hoc de multiples OPDs, **distintos** del tree jerarquico. No participan en refinamiento (ISO line 726) |
| **R-NT-5** | Navegacion: Ctrl+Up = padre, Ctrl+Down = hijo, doble-click = enter refinement (OPCloud lines 57, 335) |

**Implementacion**: OPD tree en `OpdTree.tsx`. View OPDs definidos en tipo pero no implementados en UI.

---

## §18. Bring Connected Things

**OPCloud lines 394-396. DA-9 `bringConnectedThings()`.**

| Regla | Descripcion |
|-------|-------------|
| **R-BCT-1** | Solo trae things **directamente** conectados via link — no parent-child structural relations (OPCloud line 396) |
| **R-BCT-2** | Filtro por tipo: Procedural (instrument, consumption, effect) o Fundamental (exhibition, characterisation) (OPCloud line 394) |
| **R-BCT-3** | Filtered Bring: seleccionar things primero, luego traer links **solo entre seleccionados** (OPCloud line 395) |
| **R-BCT-4** | No cascadea — solo 1-hop. Consistente con DA-9 fiber implicit things |

**Implementacion**: `api.ts:bringConnectedThings()` con filtro procedural/structural/all. Boton en PropertiesPanel.

---

## §19. Observaciones OPCloud Visual (Secuencia In-Zoom OnStar)

**Fuente**: 32 screenshots secuenciales de OPCloud, modelo OnStar Example (Driver Rescuing). Flujo: SD → in-zoom → rename → Bring Connected → links manuales → objetos internos → paralelismo.

### Comportamientos confirmados

| ID | Observacion | Regla confirmada |
|----|------------|-----------------|
| **R-OC-3** | Bring Connected en OnStar System trae GPS, Cellular Network, OnStar Console, VCIM como **externos** con aggregation triangle visible | R-IE-2 + R-LV-1 |
| **R-OC-4** | Links entre externos traidos y subprocesos se crean **manualmente** (dialog de tipo) | Diseño correcto |
| **R-OC-5** | Objetos creados dentro del container son internos (sin appearance en padre) | R-IE-8 |
| **R-OC-H3** | Driver (environmental) mantiene contorno **dashed** en SD y SD1 | R-TC-6 |
| **R-OC-H4** | Agent link (OnStar Advisor) apunta al **contorno** del container, no a subproceso especifico | R-LD-3 |
| **R-OC-H5** | Instrument link (OnStar System) apunta al **contorno** del container | R-LD-3 |
| **R-OC-H6** | Effect link (Driver) apunta al **contorno** con flecha bidireccional | R-LD-4 |
| **R-OC-H13** | Subprocesos a misma Y se muestran como paralelos en OPL y ejecucion | R-TI-3 |

### Reglas nuevas descubiertas

| ID | Regla | Impacto |
|----|-------|---------|
| **R-OC-1** | In-zoom auto-crea N subprocesos **placeholder** con nombres genericos (B Processing, C Processing, D Processing) | UX: considerar auto-crear subprocesos en `refineThing()` |
| **R-OC-2** | OPL in-zoom sentence incluye objetos internos: "**as well as** Call and Vehicle Location" despues de la secuencia de subprocesos | **Gap en opl.ts**: agregar objetos internos a in-zoom sentence |
| **R-OC-6** | Link type dialog filtra opciones segun kind de source/target (process→object solo ofrece Exhibition, Result, Effect) | UX improvement para link creation dialog |
| **R-OC-7** | Subprocesos a misma Y → OPL dice "**parallel** Call Transmitting and Vehicle Location Calculating" | ✓ Implementada: collector agrupa por Y (opl.ts:84-95), rendering emite "parallel" (opl.ts:808-810) |

**Gaps resueltos (sesion 15)**: R-OC-2 (objetos internos "as well as") y R-OC-7 (parallel por Y) implementados.

---

## §20. Observaciones OPCloud Visual (Secuencia Semi-Folding)

**Fuente**: 15 screenshots secuenciales de OPCloud. Flujo: Object 1 → unfold → fold → semi-fold → extract part → links a parts → OnStar complete model.

### Reglas confirmadas

| ID | Observacion | Regla confirmada |
|----|------------|-----------------|
| **R-SF-C1** | Semi-fold muestra triangulo aggregation (▲) + nombre de cada part dentro del rectangulo del parent | R-SF-1 |
| **R-SF-C2** | Extract part saca un part del semi-fold → aparece afuera con aggregation link + indicador "N" (hidden count) | R-SF-2, R-SF-3 |
| **R-SF-C3** | Thick contour persiste en parent al volver de unfold child OPD | R-TC-1 |

### Reglas nuevas descubiertas

| ID | Regla | Impacto |
|----|-------|---------|
| **R-SF-5** | OPL semi-fold usa "**lists** [parts] **as parts**" (no "consists of") para parts semi-folded. "consists of" se reserva para parts extraidos + "N more parts" | **Gap en opl.ts**: dos sentences distintas para semi-folded vs extracted |
| **R-SF-6** | Links procedurales pueden apuntar **directamente a un part semi-folded** dentro del rectangulo parent — el link endpoint es el part, no el parent. Visualmente la flecha entra al rectangulo y apunta al nombre del part. | **Gap visual**: links a parts semi-folded no implementados |
| **R-SF-7** | El indicador numerico ("2", "3") en el triangulo aggregation muestra **cuantos parts quedan ocultos** en el semi-fold, NO cuantos hay en total | Confirma nuestra implementacion `semiFoldHidden` |
| **R-SF-8** | Semi-fold es **per-OPD** — puede estar activo en SD (parent) mientras SD1 (child) muestra full unfold. Son independientes. | Confirma `Appearance.semi_folded` per-appearance |
| **R-SF-9** | Result link (⇒) puede apuntar a un part **dentro** del semi-fold directamente — la flecha entra al borde del parent y llega al part name | Mismo que R-SF-6 pero para result links |
| **R-SF-10** | Semi-fold en SD muestra aggregation triangle con count label **fuera** del parent (ej: triangulo + "3" a la derecha del parent, abajo) cuando hay parts extraidos | Nuestra impl: triangle dentro del parent. OPCloud: fuera |

---

## Tabla Resumen: Aplicabilidad

| Regla | In-Zoom Proceso | In-Zoom Objeto | Unfold Objeto | Unfold Proceso |
|-------|:-:|:-:|:-:|:-:|
| Thick contour (R-TC) | ✓ | ✓ | ✓ | ✓ |
| Container + Externos (R-IE) | ✓ | ✓ | ✓ | ✓ |
| Link distribution C-01 (R-LD) | ✓ | — | — | — |
| State suppression (R-SS) | ✓ | ✓ | — | — |
| Event boundary (R-BC) | ✓ | — | — | — |
| Implicit invocation (R-TI) | ✓ | — | — | — |
| Effect split (R-ES) | ✓ | — | — | — |
| Role shift (R-RS) | ✓ | — | — | — |
| Link precedence (R-OZ) | ✓ | — | — | — |
| Structural inheritance (R-IH) | — | — | ✓ | ✓ |
| Visual instances (R-VI) | ✓ | ✓ | ✓ | ✓ |
| Invariant properties (R-PI) | ✓ | ✓ | ✓ | ✓ |
| Semi-fold (R-SF) | ✓ | ✓ | ✓ | ✓ |
| OPD tree (R-NT) | ✓ | ✓ | ✓ | ✓ |
| Bring Connected (R-BCT) | ✓ | ✓ | ✓ | ✓ |

---

## Estado de Implementacion (Auditado 2026-03-24)

| Regla | Estado | Archivo | Detalle |
|-------|:---:|---------|---------|
| R-TC-1..7 (thick contour) | ✓ | OpdCanvas.tsx:400-403 | strokeWidth logic, environmental dashing |
| R-TC-8 (initial/final/default) | ✓ | OpdCanvas.tsx:527-570 | Initial=borde grueso, final=borde doble, default=diagonal marker |
| R-IE-1..7,9 (internal/external) | ✓ | api.ts:472-576 | refineThing, pullback, I-REFINE-EXT |
| R-IE-8 (inside cascade) | ✓ | api.ts:98-118 | cascade via removeThing + collectDescendants |
| R-IE-10 (enveloping revert) | — | — | Feature UI, no enforced en data model |
| R-LD-1..10 (link distribution) | ✓ | simulation.ts:201-401 | C-01 completo, 10/10 reglas |
| R-SS-1..6,9 (state suppression) | ✓ | simulation.ts:471-511 | computeStateSuppression on-demand |
| R-SS-8 ("..." indicator) | ✓ | OpdCanvas.tsx:560-565 | "..." text en objects con estados suprimidos |
| R-SS-10 (state expression) | Implicita | simulation.ts | Fiber computation cumple el intent |
| R-SS-11 (indeterminate state) | — | — | Specification reference, no enforced |
| R-BC-1,2,5 (boundary crossing) | ✓ | api.ts:1683-1719 | I-EVENT-INZOOM-BOUNDARY |
| R-BC-3 (environmental exception) | — | — | No distinguido explicitamente |
| R-BC-4 (condition skip auto-invoke) | — | — | No implementado |
| R-TI-1..6 (temporal ordering) | ✓ | simulation.ts:81-170 | getExecutableProcesses, wave-based |
| R-TI-7 (object spatial meaning) | Implicita | — | UI responsibility |
| R-LV-1..5 (link visibility) | ✓ | simulation.ts:275-313, opl.ts:183-197 | Filtering completo |
| R-ES (effect split) | ✓ | simulation.ts:313-317, helpers.ts:transformingMode | Split automatico en C-01: state-specified→input(first)+output(last) |
| R-RS (role shift) | Implicita | — | Permitido naturalmente por link-type per-link |
| R-OZ-1..3,5 (out-zoom precedence) | Parcial | simulation.ts:376-401 | Solo VISUAL-03; **matriz completa no** |
| R-OZ-4 (result+consumption invalid) | ✓ | api.ts:316-320 | I-16 en addLink |
| R-IH (structural inheritance) | — | — | **No implementado** |
| R-RC-1..3 (cycle prohibition) | ✓ | api.ts:501-510 | Transitive ancestor check |
| R-OPL-1,2,4,5 (OPL sentences) | ✓ | opl.ts:65-94, 183-197 | In-zoom + unfold + link filtering |
| R-OPL-3 (OPD tree edge labels) | ✓ | opl.ts:392-402, opl-types.ts:152-159 | `refinementEdge` en OplDocument + rendering |
| R-VI-1 (multi-appearance) | ✓ | — | Appearances multiples soportadas |
| R-VI-2 (duplicate indicator) | — | OpdCanvas.tsx | **No renderizado** |
| R-PI-1..5 (invariant properties) | ✓ | types.ts | Essence/kind immutables |
| R-SF-1,2,4,7,8 (semi-fold core) | ✓ | api.ts:1157-1176, OpdCanvas.tsx:494-511 | getSemiFoldedParts, per-OPD state |
| R-SF-3 (extract part) | — | — | Feature UI no implementada |
| R-SF-5 (OPL semi-fold) | ✓ | opl.ts:618-620 | `semiFolded` flag → "lists...as parts" |
| R-SF-6,9 (links a parts) | — | — | **No implementado** (links no target semi-fold entries) |
| R-SF-10 (triangle position) | Diferente | OpdCanvas.tsx:494-511 | Dentro del parent (OPCloud: fuera) |
| R-NT-1 (OPD tree) | ✓ | OpdTree.tsx:16-34 | buildTree hierarchical |
| R-NT-2 (object tree) | — | — | Solo process tree |
| R-NT-3 (leaf-only deletion) | ✓ | api.ts:446-449 | NON_LEAF_OPD invariante en removeOPD |
| R-NT-4 (View OPDs) | — | — | **No implementado** |
| R-NT-5 (keyboard nav) | ✓ | App.tsx:224-236 | Ctrl+Up=parent, Ctrl+Down=child |
| R-BCT-1,2,4 (bring connected) | ✓ | api.ts:1852-1916, PropertiesPanel.tsx | 1-hop, filter by type |
| R-BCT-3 (filtered bring) | — | — | UX enhancement, no gap funcional |
| R-OC-1 (auto subprocesos) | ✓ | api.ts:575-590 | 3 placeholders auto-creados en process in-zoom |
| R-OC-2 (OPL "as well as") | ✓ | opl.ts:69-94, 817-819 | `internalObjects` en OplInZoomSequence, "as well as [objects]" |
| R-OC-7 (OPL "parallel") | ✓ | opl.ts:84-95, 808-810 | Agrupacion por Y, `parallel: true` para same-Y |

---

## §21. Priorizacion de Gaps para Implementacion

### P0 — Resueltos (sesion 15)

| Gap | Archivos | Estado |
|-----|----------|:---:|
| R-OC-2 | opl.ts, opl-types.ts | ✓ `internalObjects` + "as well as" rendering |
| R-OC-7 | opl.ts | ✓ Agrupacion por Y, `parallel: true` |
| R-SS-8 | OpdCanvas.tsx | ✓ Indicador "..." en ThingNode |
| R-TC-8 | OpdCanvas.tsx | ✓ Initial (borde grueso), final (doble), default (diagonal) |

### P1 — Resueltos (sesion 15)

| Gap | Archivos | Estado |
|-----|----------|:---:|
| R-SF-5 | opl.ts, opl-types.ts | ✓ `semiFolded` flag + "lists...as parts" rendering |
| R-OC-1 | api.ts | ✓ 3 placeholders auto-creados en process in-zoom |
| R-NT-5 | App.tsx | ✓ Ctrl+Up=parent, Ctrl+Down=child |
| R-NT-3 | api.ts | ✓ NON_LEAF_OPD invariante en removeOPD |
| R-OPL-3 | opl.ts, opl-types.ts | ✓ `refinementEdge` en OplDocument + rendering |

### P2 — Blast radius alto (futuro)

| Gap | Archivos | Descripcion |
|-----|----------|-------------|
| R-IH | core nuevo | Herencia estructural completa (links heredados por specializations) |
| R-OZ-1..3,5 | simulation.ts | Matriz completa de precedencia out-zoom |
| R-SF-6,9 | OpdCanvas.tsx, simulation.ts | Links apuntando a parts dentro de semi-fold |
| R-VI-2 | OpdCanvas.tsx | Duplicate visual indicator (offset shape) |
| R-NT-4 | OpdTree.tsx, types.ts | View OPDs (colecciones ad-hoc) |
| R-NT-2 | OpdTree.tsx | Object tree paralelo al process tree |
| R-BC-3 | api.ts | Distinguir environmental exception en boundary crossing |
| R-BC-4 | simulation.ts | Condition skip auto-invocacion del siguiente subproceso |
| R-IE-10 | OpdCanvas.tsx | Enveloping reversion on move |
