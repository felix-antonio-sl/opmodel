# ISO 19450 vs OPModeling Backlog: Gap Analysis

**Fecha:** 2026-03-13
**Fuentes:** `opm-iso.md` (ISO/PAS 19450) vs `opm-modeling-app-backlog-lean.md` (52 HUs)

---

## Resumen Ejecutivo

| Categoria | Count | Descripcion |
|-----------|-------|-------------|
| CRITICAL gaps | 8 (4 cerrados) | Conceptos core OPM ausentes del backlog |
| IMPORTANT gaps | 14 | Features estandar faltantes o incompletas |
| MINOR gaps | 12 | Edge cases, terminologia |
| Underspecifications | 10 | Conceptos presentes pero insuficientemente definidos |
| Extensions compatibles | 17 | Backlog extiende mas alla de ISO (sin conflicto) |

**Cobertura estimada del backlog vs ISO:** ~78% al completar P1.

---

## 1. GAPS CRITICOS (6)

### Gap-C1: Operation Definitions & Invocation
- **ISO:** 3.46, 3.21, 10.3.3
- **Problema:** ISO define operaciones (metodos) como features exhibidas por objetos/procesos, distintas de atributos. El backlog solo modela atributos via exhibition links, no firmas de operaciones.
- **Faltante:** HU para crear definiciones de operaciones con parametros y tipos de retorno. OPL: "Object invokes operation(param1, param2)".
- **Impacto:** Modelos no pueden expresar contratos de comportamiento (API endpoints, funciones de libreria).
- **Recomendacion:** P2 — no bloquea MVP pero fundamental para simulacion computacional.

### Gap-C2: Skip vs Wait Semantics (Condition Links)
- **ISO:** 8.2.3
- **Problema:** ISO define DOS modos para condition links: skip (si falso, saltar) vs wait (si falso, bloquear). El backlog (L-M5-02) menciona condiciones pero NO distingue estos modos.
- **Faltante:** Propiedad `condition_mode: "skip" | "wait"` en links de condicion. OPL distinto: "Process is triggered by..." (event) vs "Process requires..." (condition/wait).
- **Impacto:** Semantica de simulacion ambigua — no se puede generar codigo correcto.
- **Status:** ✅ CERRADO — condition_mode implementado en Modifier

### Gap-C3: Stateful vs Stateless Objects
- **ISO:** 3.66, 3.67
- **Problema:** ISO clasifica objetos como stateful (pueden tener estados, ser afectados) o stateless (solo consumidos/producidos). El backlog no distingue esto a nivel de tipo.
- **Faltante:** Propiedad `stateful: boolean` en Thing. Invariantes: stateless no puede tener estados ni effect links.
- **Impacto:** Afecta 5+ invariantes (I-01, I-16, effect link validation).
- **Status:** ✅ CERRADO — Thing.stateful + 4 invariantes implementados

### Gap-C4: Whole-Part Ratio en Aggregation
- **ISO:** 11.1, 10.3.2
- **Problema:** ISO requiere multiplicidades ASIMETRICAS en agregacion: part-multiplicity (cuantas partes) vs whole-multiplicity (puede pertenecer a multiples wholes?). Ademas marker de completeness ("..." cuando no todas las partes estan mostradas).
- **Faltante:** UI de multiplicidad especifica para agregacion. Flag de completeness. OPL: "X consists of A, B and at least one other part" (incompleto).
- **Impacto:** Agregaciones parciales inexpresables; OPL pierde semantica.
- **Recomendacion:** P1-P2.

### Gap-C5: Discriminating Attribute Exhaustivity/Disjointness
- **ISO:** 10.3.4
- **Problema:** Cuando un General tiene atributo discriminante D, cada Specialization debe asociarse a subconjunto DISJUNTO y EXHAUSTIVO de los estados de D. I-32 lo requiere pero ningun HU especifica como la UI lo enforce.
- **Faltante:** Algoritmo de validacion UI: al marcar discriminating attribute, verificar que TODOS los estados de D esten asignados a exactamente una Specialization.
- **Impacto:** Modelos con generalizacion incompleta pasan validacion pero son unsound.
- **Recomendacion:** Pre-P1 — I-32 existe en data model pero sin enforcement.

### Gap-C6: Fact Consistency & Abstraction Ambiguity
- **ISO:** 14.2.3, 14.2.4
- **Problema:** ISO requiere verificacion de consistencia entre OPD padre e hijos en refinement. Si un refinement OPD contiene links inconsistentes con el padre, es violacion. El backlog cubre pullback pero NO fact consistency ni resolucion de ambiguedad.
- **Faltante:** HU para "fact consistency checking on in-zoom refinements" + "ambiguity resolution UI" cuando un link en padre se mapea a multiples subprocesos en hijo.
- **Impacto:** Refinements no se validan formalmente; consistencia padre-hijo no garantizada.
- **Recomendacion:** P2 — no bloquea MVP pero esencial para refinement correcto.

### Gap-C7: I-27 Exhibition Perseverance Bug
- **ISO:** 7.2.2
- **Problema:** I-27 rechazaba exhibition links cross-type. ISO §7.2.2 explícitamente exime exhibition-characterization de la regla de perseverancia.
- **Status:** ✅ CERRADO — I-27 eliminado de validate()

### Gap-C8: Procedural Link Endpoint Type Validation
- **ISO:** 6.1-6.3
- **Problema:** addLink() no validaba que procedural links conecten object↔process.
- **Status:** ✅ CERRADO — I-33 implementado en addLink() y validate()

---

## 2. GAPS IMPORTANTES (14)

| # | Gap | ISO Clause | Descripcion | Recomendacion |
|---|-----|-----------|-------------|---------------|
| I1 | Beneficiary/Stakeholder annotation | 3.6, 3.65 | Sin anotacion de stakeholder viewpoint en elementos | P3+ |
| I2 | Object/Process Class patterns | 3.40, 3.59 | Estereotipos cubren parcialmente; class patterns mas generales | P2 |
| I3 | State suppression UI | 14.2.1, 3.71 | `suppressed_states` en data model pero sin HU para UI | P1 |
| I4 | Inheritance pullback semantics | 10.3.4 | HU no especifica algoritmo de herencia (sharing vs copy vs on-demand) | P1 |
| I5 | Under-time exception links | 9.5.4 | Solo overtime cubierto; under-time faltante | P3+ |
| I6 | Control-modified link fans | 12.5 | Modifiers en fans sin OPL rendering ni validacion | P3+ |
| I7 | Self-invocation waiting process | 9.5.2.5.2 | `invocation_interval` vago; subprocess "Waiting" no especificado | P2 |
| I8 | Scenario selection/execution UI | 13 | Path labels en data model; sin UI para crear/ejecutar scenarios | P2 |
| I9 | Lifespan diagrams | D.6 | Sin visualizacion temporal de objetos post-simulacion | P3+ |
| I10 | Duration constraint enforcement | D.7 | Duration decorativa; simulacion no valida min/max | P2 |
| I11 | Primary essence auto-default | 3.55 | `primary_essence` en settings pero nuevos things no heredan default | P1 |
| I12 | Variable multiplicity expressions | 11.2 | "3*n con n<=4" mencionado pero no implementado | P3+ |
| I13 | Link uniqueness I-16 enforcement | 8.1.2 | Constraint declarado pero sin validacion runtime clara | P1 |
| I14 | Event vs Condition differentiation | 9.5.1-3 | Modifiers sin clarificacion de diferencia semantica en UI | P1 |

---

## 3. GAPS MENORES (12)

| # | Gap | ISO Clause | Descripcion |
|---|-----|-----------|-------------|
| M1 | Affectee/consumee/resultee roles | 3.2 | Terminologia ISO no usada |
| M2 | Attribute vs Feature vs Property | 3.4, 3.21, 3.60 | Backlog conflates terminos |
| M3 | Characteristic synonym | 7.3.3 | Inconsistencia terminologica |
| M4 | Semi-fold completeness visual | 3.22, 14.2.1 | "..." marker ISO no referenciado |
| M5 | Link taxonomy organization | 8.1, 9 | Transforming/Enabling/Control no formalizado en UI |
| M6 | Null-tagged structural link | 10.2.2 | Parcialmente implementado; sin test especifico |
| M7 | Reciprocal tagged link OPL | 10.2.4 | Sin validacion de OPL output |
| M8 | Coinductive trace verification | D.1-D.7 | Trazas sin verificacion formal |
| M9 | Out-zooming action | 3.48, 3.49 | Implicito via delete; sin HU explicito |
| M10 | Conformance level declaration | 5 | Sin declaracion de nivel (Partial/Full/Toolmaker) |
| M11 | Clarity/completeness coaching | 6.1.6 | Sin guia metodologica en UI |
| M12 | Bimodal terminology | 6.2.1 | Implementado (DA-6); terminologia ISO faltante |

---

## 4. UNDERSPECIFICATIONS (10)

| # | Concepto | Problema |
|---|---------|----------|
| U1 | Link uniqueness (I-16) | No especifica como addLink rechaza duplicados transforming |
| U2 | Event vs Condition | No clarifica diferencia en UI/OPL |
| U3 | XOR vs OR probability | XOR sum=1 especificado; OR sin aclarar |
| U4 | Assertion categories | safety/liveness/correctness sin metodo de verificacion |
| U5 | Requirement validation modes | hard/soft sin definicion de comportamiento |
| U6 | In-zoom vs Unfold distinction | Diferencia temporal vs espacial no enfatizada |
| U7 | State refinement OPL | Sub-estados dentro de estado sin soporte |
| M1 | Involved object set computation | No calcula preprocess/postprocess set para display |
| M2 | Toolmaker conformance | Sin alignment con spec de conformance ISO |
| M3 | Optional vs mandatory multiplicity | "?" vs "1" sin OPL rendering consistente |

---

## 5. EXTENSIONS COMPATIBLES (17)

El backlog extiende ISO en 17 areas, TODAS compatibles:

- Computational Objects/Processes (L-M5-03/04)
- Ranges & Default Values (L-M5-06)
- Requirements & Traceability (L-M4-08)
- Scenarios & Path Labels (L-M5-02)
- View Diagrams (L-M4-04)
- Sub-Models (L-M1-13)
- Stereotypes (L-M5-07)
- Settings/Configuration (L-M6-04/05)
- Internal/External Objects (L-M1-09)
- Discriminating Attribute Specification (L-M1-04)
- Ordered Aggregation (Link.ordered)
- Invocation Interval (Link.invocation_interval)
- Hyperlinks, Notes, User Input Toggle, Current State, Pinned/Auto-sizing

---

## 6. ROADMAP DE COMPLIANCE

| Fase | Gaps a resolver | Compliance estimado |
|------|----------------|---------------------|
| Pre-P1 | C2 (skip/wait), C3 (stateful), C5 (discriminating) | ~65% |
| P1 | C1 (operations), C4 (aggregation ratios), I3, I4, I11, I13, I14 | ~78% |
| P2 | C6 (fact consistency), I7, I8, I10, U1-U7 | ~88% |
| P3+ | I1, I2, I5, I6, I9, I12, M1-M12 | ~95% |
