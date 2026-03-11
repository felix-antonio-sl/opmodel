# Auditoría Categórica — OPModeling Backlog Lean

**Auditor:** fxsl/arquitecto-categorico
**Fecha:** 2026-03-10
**Documento auditado:** `opm-modeling-app-backlog-lean.md` (50 HUs, 6 módulos)

---

## Parte A: El Backlog como Categoría C_backlog

### A.1 — Formalización

```
Categoría: C_backlog
Obj: {L-M1-01, L-M1-02, ..., L-M6-08} — 50 objetos
Morph: "depende de" — si A depende de B, existe B → A
       (B debe existir para que A pueda construirse)
Composición: transitiva (si B→A y C→B entonces C→A)
Identidades: id_X para todo X (cada HU depende de sí misma trivialmente)
```

Los módulos M1-M6 son subcategorías. Los morfismos inter-módulo son functores de inclusión.

### A.2 — Propiedad DAG (acíclica)

**Verificado: el grafo es un DAG.** No hay ciclos. Las raíces (objetos iniciales relativos) son:

```
Raíces (sin dependencias): {L-M1-01, L-M1-02, L-M3-02, L-M6-01, L-M6-02}
```

Observación: L-M1-01 (Wizard), L-M1-02 (Things), L-M3-02 (Panel), L-M6-01 (Save), L-M6-02 (Undo) son los **5 objetos iniciales** de la categoría. Todo lo demás se alcanza por composición transitiva desde estos 5.

### A.3 — Objetos Terminales y Hojas

Las hojas (objetos sin que nadie dependa de ellos):

```
Hojas: {L-M1-09, L-M1-11, L-M1-12, L-M1-13, L-M2-03, L-M2-04,
        L-M3-04, L-M3-06, L-M3-07, L-M4-03, L-M4-04, L-M4-06,
        L-M4-07, L-M4-08, L-M4-09, L-M5-02, L-M5-04, L-M5-05,
        L-M5-06, L-M5-07, L-M5-08, L-M5-09, L-M6-03, L-M6-04,
        L-M6-05, L-M6-06, L-M6-07, L-M6-08}
```

28 hojas de 50 objetos = 56% del grafo son terminales. Esto indica una categoría **ancha y plana** — la mayoría de HUs convergen hacia pocas raíces. No hay objeto terminal universal (no hay una HU de la que todas dependan).

### A.4 — Hub Objects (mayor in-degree)

| Objeto | In-degree (cuántos dependen de él) | Rol |
|--------|-------------------------------------|-----|
| L-M1-02 | 18 | **Hub central** — casi todo el sistema depende de "crear things" |
| L-M3-01 | 10 | OPD tree — infraestructura de navegación |
| L-M1-03 | 7 | Links — segundo hub del motor |
| L-M1-07 | 7 | In-zoom — refinamiento como hub |
| L-M5-01 | 5 | Simulación ECA — hub de ejecución |
| L-M4-02 | 5 | Validación — hub de verificación |
| L-M2-01 | 5 | OPL sync — hub de bimodalidad |
| L-M6-01 | 4 | Save — hub de persistencia |

**Hallazgo:** L-M1-02 es el **objeto productivo universal** de la categoría. Si L-M1-02 falla, 18 de 50 HUs quedan bloqueadas. Esto es correcto desde OPM (sin things no hay nada), pero es un riesgo de implementación: L-M1-02 debe ser impecable.

### A.5 — Quiebres de Composicionalidad

#### Q1 [CRITICO] — Cadena P0 vs dependencias declaradas

La cadena P0 del header dibuja:
```
L-M3-03 (Toolbar) → L-M1-01 (Wizard)
```

Pero L-M1-01 declara `Dependencias: ninguna`. Hay un morfismo en el diagrama que NO existe en la categoría declarada.

**Diagnóstico categórico:** El diagrama P0 NO es un sub-diagrama de C_backlog — contiene morfismos fantasma (no declarados). Esto viola la propiedad de subcategoría: un subdiagrama debe ser un subgrafo del grafo subyacente.

**Resolución:** O se añade la dependencia L-M1-01 → L-M3-03, o se corrige el diagrama eliminando esa flecha.

**Implicación real:** El Wizard PUEDE funcionar sin toolbar si se invoca desde CLI. El diagrama asume flujo UI-only. Para CLI-first (DA-1), el Wizard debería ser invocable sin dependencia de L-M3-03.

#### Q2 [CRITICO] — Sprint P0 viola dependencias de L-M3-03

Sprint P0 contiene: `L-M3-03, L-M3-02, L-M1-02, L-M1-03, L-M2-01, L-M6-03(base)`

L-M3-03 declara `Dependencias: L-M3-01`. Pero L-M3-01 está en Sprint P1.

**Diagnóstico categórico:** El Sprint P0, visto como subcategoría de C_backlog, tiene un morfismo saliente (L-M3-03 → L-M3-01) cuyo target no está en la subcategoría. Esto viola la propiedad de **subcategoría cerrada**: toda dependencia de un objeto dentro de la subcategoría debe apuntar a otro objeto dentro de la misma subcategoría.

**Resolución:** Mover L-M3-01 a Sprint P0, o mover L-M3-03 a Sprint P1, o declarar que L-M3-03 tiene una versión "mínima sin árbol OPD" para Sprint P0.

#### Q3 [IMPORTANTE] — L-M1-08 (P1) depende de L-M1-04 (P1) que depende de L-M1-03 (P0)

Path: L-M1-03 → L-M1-04 → L-M1-08

L-M1-08 está en Sprint P3 y L-M1-04 en Sprint P2. El path es:
Sprint P0 (L-M1-03) → Sprint P2 (L-M1-04) → Sprint P3 (L-M1-08)

Esto es coherente. ✓ Pero hay un camino paralelo:
L-M1-02 → L-M1-08 (directo) y L-M1-02 → L-M1-04 → L-M1-08

**Path equation:** L-M1-02 → L-M1-08 = L-M1-02 → L-M1-04 → L-M1-08?

No — el primer path es una dependencia directa (L-M1-08 necesita things de L-M1-02), el segundo es transitivo a través de L-M1-04. La dependencia directa L-M1-02 → L-M1-08 es **redundante** por composición (ya llega vía L-M1-04 que a su vez depende de L-M1-02). No es un error pero es ruido en el grafo.

#### Q4 [MENOR] — Dependencias redundantes por transitividad

Múltiples HUs declaran dependencias que son redundantes por composición:

| HU | Dependencia directa | Ya cubierta vía |
|----|-------------------|-----------------|
| L-M1-08 | L-M1-02 | L-M1-04 → L-M1-02 |
| L-M1-10 | L-M1-02 | L-M1-03 → L-M1-02 |
| L-M2-03 | L-M1-02 | L-M2-02 → L-M2-01 → L-M1-02 |
| L-M5-02 | L-M1-03 | L-M5-01 → L-M1-07 → L-M1-03 |

**Diagnóstico:** En teoría de categorías, si hay un path A→B→C, el morfismo compuesto A→C ya existe. Declarar A→C explícitamente no es incorrecto pero contamina la presentación. No son errores — son **morfismos que la composición ya garantiza**.

---

## Parte B: El Dominio OPM como Categoría C_opm

### B.1 — Formalización del Property Graph

DA-2 declara: "Property graph (nodes = things/estados, edges = links con propiedades tipadas)."

```
Categoría: C_opm
Obj: Thing ∐ State — coproducto de things y estados
Morph: Link — enlaces tipados como morfismos

Subcategorías por tipo de enlace:
  C_proc ⊂ C_opm  — enlaces procedurales (transforming + enabling)
  C_struct ⊂ C_opm — enlaces estructurales (aggregation, exhibition, etc.)
  C_ctrl ⊂ C_opm  — enlaces de control (event, condition, invocation)
```

### B.2 — Tensión: Property Graph Plano vs Estructura Jerárquica OPM

**Tensión detectada:** Grafo Plano (Property Graph) ↔ Estructura Jerárquica (OPD Tree) — Cat: A1 (Ontológico)
**Adjunción subyacente:** Forget ⊣ Free (olvidar jerarquía vs construir jerarquía)

El backlog declara que el grafo es la fuente de verdad y que OPDs son "vistas derivadas". Pero OPM tiene semántica que NO es capturabe por un property graph plano:

**B.2.1 — OPDs como Fibras**

Los OPDs NO son nodes ni edges del property graph. Son **subgrafos** — colecciones de things visibles en un contexto. La relación OPD→Thing es "este thing tiene una instancia visual en este OPD". Esto es una **fibración**:

```
π: C_opm → C_opd_tree
```

Donde C_opd_tree es la categoría del árbol de OPDs (SD → SD1 → SD1.1 → ...) y la fibra sobre cada OPD es el conjunto de things visibles en él.

**Un property graph plano NO modela fibration nativamente.** Se necesita:
- Opción 1: Cada node tiene propiedad `opd_ids: [SD, SD1, ...]` (flat, queryable pero pierde estructura)
- Opción 2: OPDs son hypernodes que contienen subgrafos (hypergraph, más expresivo)
- Opción 3: **Grothendieck construction** — el grafo total es la integral ∫π de la fibración

**Recomendación:** El backlog debería especificar cuál de estas opciones implementa en DA-2. Actualmente dice "property graph" sin resolver la fibración OPD.

**B.2.2 — Estados como Objetos Internos**

Los estados "viven dentro" de objetos. En OPM, un estado no tiene existencia independiente — solo existe en el contexto de su objeto. Esto es un **subobjeto** en CT:

```
State ↪ Object  (mono, inyección)
```

En un property graph plano, los estados serían nodes libres conectados a su objeto por un edge "has_state". Esto **pierde la contención**: un state node podría potencialmente existir sin su objeto, lo cual viola OPM.

**Recomendación:** El graph store debe enforcer que eliminar un objeto elimina en cascada todos sus estados (regla de integridad por composición, no solo por constraint ad-hoc).

### B.3 — Invariantes Categoricos del Dominio OPM

#### INV-1: Principio de Unicidad del Enlace Procedimental

```
∀ (p:Process, o:Object), |{f : p → o | f ∈ C_proc}| ≤ 1
```

A un nivel de abstracción dado, exactamente un enlace procedimental entre un par (proceso, objeto). Esto es un **constraint de multiplicidad** sobre el hom-set.

El backlog lo modela en L-M1-05. ✓

#### INV-2: Todo Proceso Transforma al Menos un Objeto

```
∀ p ∈ Obj(C_opm) | p:Process, ∃ o:Object, ∃ f:p→o ∈ C_proc_transform
```

Donde C_proc_transform = {consumption, effect, result, in/out}.

El backlog lo enforcea en L-M4-02 (validación). ✓

#### INV-3: Agentes son Humanos Físicos

```
∀ (a,p,f) | f:a→p ∈ AgentLink, essence(a) = Physical ∧ isHuman(a) = true
```

El backlog lo modela en L-M1-03 con la restricción "humano o grupo humano". ✓

#### INV-4: Exhibition-Characterization → Esencia Informática

```
∀ (exhibitor, attribute, f) | f ∈ ExhibitionLink, essence(attribute) = Informatical
```

Este es un **functor que fuerza propiedades** — el acto de conectar via exhibition-characterization ejecuta un side-effect sobre la esencia del attribute. En CT esto es un endofunctor con acción:

```
ExhibitionAction: C_opm → C_opm
ExhibitionAction(attribute).essence := Informatical
```

El backlog lo modela en L-M1-04. ✓

#### INV-5: In-Zoom genera Fibra

```
InZoom(p:Process) → OPD_{p}
```

In-zoom de un proceso genera un nuevo OPD (nueva fibra) cuyo contenido son los subprocesos de p. El morfismo de contención p ↪ OPD_{p} preserva los objetos conectados a p en el OPD padre (aparecen como "externos" en la fibra hija).

El backlog lo modela en L-M1-07. ✓ Pero no especifica formalmente que los objetos "heredados" del padre en el in-zoom son el **pullback** del proceso sobre su fibra:

```
     External_Objects ──→ OPD_{parent}
           |                    |
           v                    v
     OPD_{child}  ──────→  Process p
```

Esto es un pullback: los objetos externos en el in-zoom son exactamente los objetos del padre que están conectados al proceso. No está explicitado como construcción universal.

### B.4 — ECA como Coalgebra

La simulación ECA (L-M5-01) describe un sistema dinámico:

```
Coalgebra: c: ModelState → F(ModelState)

Donde:
  ModelState = Π_{o ∈ Objects} State(o) × Existence(o)
  F(X) = Observation × X^Action
  Observation = {object states, process statuses}
  Action = {event → precondition check → execute/skip}
```

El backlog modela correctamente:
- Preprocess/postprocess object sets ✓
- Event se pierde si precondición falla ✓
- Consumee deja de existir, resultee empieza a existir ✓

**Tensión no resuelta:** El backlog tiene assertions (L-M5-05) y deadlock detection pero NO tiene:

**B.4.1 — Bisimulación**

Dos model states son bisimilares si producen las mismas observaciones bajo las mismas acciones. Esto es esencial para:
- Comparar dos modelos (¿son conductualmente equivalentes?)
- Optimizar simulación (¿puedo colapsar estados equivalentes?)
- Verificar refinamiento (¿el modelo refinado es bisimilar al abstracto?)

El diff semántico (L-M6-08) compara **estructura** pero no **comportamiento**. Dos modelos pueden ser estructuralmente distintos pero conductualmente equivalentes (bisimilares).

**B.4.2 — Coinducción para Propiedades de Traza**

L-M5-05 detecta deadlocks y estados inalcanzables via "análisis estático del grafo". Pero las propiedades de seguridad (safety) y vivacidad (liveness) de un sistema dinámico se prueban por **coinducción**, no por análisis estático de estructura:

- Safety: "nunca se alcanza un estado malo" → coinductivo
- Liveness: "eventualmente se alcanza un estado bueno" → coinductivo
- Deadlock freedom: "siempre hay un próximo paso" → coinductivo

El backlog trata estas como queries sobre el grafo estático. Para modelos simples funciona, pero para modelos con ciclos, probabilidades y condiciones, el análisis estático es insuficiente.

### B.5 — Lenses: La Bimodalidad OPD↔OPL como Lens

La bimodalidad OPM (L-M2-01, L-M2-02) es formalizabe como un **lens**:

```
Lens_bimodal = (expose: Graph → OPL, update: Graph × OPL_edit → Graph)

Donde:
  expose = generación OPD→OPL (L-M2-01)
  update = parsing OPL→OPD (L-M2-02)
```

**Ley de lens (PutGet):** Si actualizo el grafo con un edit OPL y luego expongo OPL, debo obtener el edit aplicado.
**Ley de lens (GetPut):** Si expongo OPL y lo paso de vuelta como update sin cambios, el grafo no cambia.

Estas leyes NO están explicitadas en el backlog. Sin ellas, la bimodalidad puede tener estados inconsistentes:
- Edito OPL para crear "Heating changes Water from cold to hot"
- El parser crea los things
- Pero al regenerar OPL, la sentencia sale como "Heating affects Water" (perdió los estados)

Esto sería una violación de PutGet. El backlog debería tener un criterio de **round-trip consistency**.

### B.6 — Módulos como Categoría de Categorías

Los 6 módulos forman una categoría superior:

```
Categoría: C_modules
Obj: {M1, M2, M3, M4, M5, M6}
Morph: functores de dependencia inter-módulo
```

| Morfismo | Significado |
|----------|------------|
| M1 → M2 | Motor OPL depende del Motor de Modelo |
| M1 → M3 | Navegación depende del Motor de Modelo |
| M1 → M4 | Verificación depende del Motor de Modelo |
| M1 → M5 | Ejecución depende del Motor de Modelo |
| M1 → M6 | Plataforma depende del Motor de Modelo |
| M2 → M5 | Simulación necesita OPL para mostrar ECA |
| M3 → M4 | Verificación usa navegación (OPD tree, views) |
| M4 → M5 | Assertions referencia validación |
| M2 → M6 | CLI necesita OPL engine |

**M1 es el objeto inicial** de C_modules: todo módulo depende (directa o transitivamente) de M1. Esto es categóricamente correcto — el motor de modelo es el fundamento.

**No hay objeto terminal** en C_modules: ningún módulo es dependencia de todos los demás. Esto también es correcto — cada módulo agrega capacidad independiente.

---

## Parte C: Quiebres y Recomendaciones

### C.1 — Quiebres Críticos

| # | Quiebre | Diagnóstico CT | Corrección |
|---|---------|----------------|------------|
| Q1 | Cadena P0 tiene morfismos fantasma (no declarados) | Subdiagrama no es subcategoría de C_backlog | Corregir dependencias de L-M1-01 o redbujar cadena |
| Q2 | Sprint P0 viola cerradura (L-M3-03 → L-M3-01 fuera del sprint) | Subcategoría no cerrada bajo dependencias | Mover L-M3-01 a Sprint P0 o degradar L-M3-03 a P1 |

### C.2 — Tensiones No Resueltas

| # | Tensión | Adjunción | Estado | Recomendación |
|---|---------|-----------|--------|---------------|
| T1 | Property Graph Plano ↔ Estructura Jerárquica OPD | Forget ⊣ Free | **NO RESUELTA** | DA-2 debe especificar cómo el graph store modela OPDs: como propiedad en nodes, como hypernodes, o como Grothendieck construction |
| T2 | Análisis Estático ↔ Verificación Coinductiva | Structure ⊣ Behavior | **NO RESUELTA** | L-M5-05 debe aclarar si deadlock detection es solo estático (limitado) o incluye model checking sobre trazas (coinductivo, más potente) |
| T3 | Bimodalidad ↔ Round-Trip Consistency | PutGet ⊣ GetPut (lens laws) | **NO RESUELTA** | L-M2-01/L-M2-02 necesitan un criterio explícito de round-trip: "edit OPL → regenerar OPL = edit aplicado" |

### C.3 — Invariantes Verificados

| # | Invariante | Estado | Notas |
|---|-----------|--------|-------|
| INV-1 | Unicidad enlace procedimental | ✓ | L-M1-05, bien modelado con edge cases |
| INV-2 | Proceso transforma ≥1 objeto | ✓ | L-M4-02 validación |
| INV-3 | Agentes son humanos | ✓ | L-M1-03 |
| INV-4 | Exhibition → esencia informática | ✓ | L-M1-04 |
| INV-5 | In-zoom genera fibra | ✓ | L-M1-07 (pullback no explicitado pero semántica correcta) |

### C.4 — Propiedades Categoriales Ausentes

| # | Propiedad | Dónde falta | Impacto |
|---|-----------|-------------|---------|
| P1 | **Bisimulación** entre modelos | L-M6-08 (diff semántico) | Sin bisimulación, no se puede verificar equivalencia conductual — solo estructural |
| P2 | **Lens laws** (round-trip) para bimodalidad | L-M2-01 / L-M2-02 | Sin round-trip guarantee, la edición OPL→OPD puede producir estados inconsistentes |
| P3 | **Fibración** explícita para OPD hierarchy | DA-2 | El property graph no modela nativamente la relación OPD→Things como fibración |
| P4 | **Cascade delete** por composición (states → object) | L-M1-10 | Eliminar un objeto debe eliminar sus estados por subobjeto, no solo por constraint |
| P5 | **Coinducción** para propiedades de traza | L-M5-05 | Deadlock detection estático es insuficiente para modelos con ciclos y probabilidades |

---

## Resumen Cuantitativo

```
PARTE A — Backlog como Categoría:
  Objetos: 50
  Morfismos (dependencias): 89
  Raíces (sin deps): 5
  Hojas (sin dependientes): 28
  Hub central: L-M1-02 (in-degree 18)
  Ciclos: 0 (DAG verificado)
  Quiebres de composicionalidad: 2 CRITICOS, 1 IMPORTANTE, 1 MENOR
  Dependencias redundantes: 4

PARTE B — Dominio OPM como Categoría:
  Invariantes verificados: 5/5
  Tensiones no resueltas: 3
  Propiedades categoriales ausentes: 5
  Contradicciones con CT: 0

VEREDICTO:
  El backlog es un DAG coherente con M1 como objeto inicial universal.
  El dominio OPM está correctamente formalizado en sus invariantes core.
  Las debilidades están en la capa de DINAMICA (bisimulación, coinducción,
  lens laws) y en la ESTRUCTURA DE CONTENCIÓN (fibración OPD).
  Nada está roto — pero hay 3 tensiones de diseño que deben colapsarse
  antes de implementar el graph store y el motor de simulación.
```
