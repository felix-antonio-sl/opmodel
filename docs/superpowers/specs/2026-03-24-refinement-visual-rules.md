# Reglas de Codependencia Visual Cross-Refinamiento

**Fecha**: 2026-03-24
**Autor**: fxsl/arquitecto-categorico
**Fuentes**: ISO 19450 (§4, §6, §9, §10, §12, §14), OPCloud Tutorial, implementacion OPModel

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

**Implementacion**: `OpdCanvas.tsx:402` — `isRefined ? Math.max(baseStroke, 2.5)`, `isContainer ? 2.5`.

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

**Implementacion**: `simulation.ts:471-511` (computeStateSuppression). `OpdCanvas.tsx:904-912` (visibleStatesFor merge fiber+stored).

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

---

## Estado de Implementacion

| Regla | Implementada | Archivo |
|-------|:---:|---------|
| R-TC (thick contour) | ✓ | OpdCanvas.tsx:402 |
| R-IE (internal/external) | ✓ | api.ts:472-576 |
| R-LD (link distribution) | ✓ | simulation.ts:201-401 |
| R-SS (state suppression) | ✓ | simulation.ts:471-511 |
| R-BC (boundary crossing) | ✓ | api.ts:1683-1719 |
| R-TI (implicit invocation) | ✓ | simulation.ts:81-170 |
| R-LV (link visibility) | ✓ | simulation.ts:275-313, opl.ts:183 |
| R-ES (effect split) | Parcial | helpers.ts:transformingMode |
| R-RS (role shift) | Implicita | — |
| R-OZ (out-zoom precedence) | Parcial | simulation.ts:376-401 |
| R-IH (structural inheritance) | — | No implementado |
| R-RC (cycle prohibition) | ✓ | api.ts:501-510 |
| R-OPL (OPL sentences) | ✓ | opl.ts:65-94 |
