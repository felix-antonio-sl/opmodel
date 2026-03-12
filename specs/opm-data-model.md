# OPModeling — Modelo de Datos

Documento generado: 2026-03-10
Revisión: 3 (post-auditoría exhaustiva línea-por-línea: +discriminating attribute, +Position type, -max_duration deprecated)
Decisiones arquitecturales: DA-2 (Typed Category Store), DA-5 (Coalgebra), DA-6 (Lens)
Formato de persistencia: JSON normalizado (.opmodel)
Stack conceptual: In-memory graph + file serialization

---

## 1. Formalización Categórica

```
Categoría: C_opm

Obj(C_opm) = Thing ⊔ State ⊔ OPD

  Thing = Object ⊔ Process
  State ↪ Object                     (mono — subobjeto)
  OPD ∈ Obj(C_opd_tree)              (nodos de la fibración)

Mor(C_opm) = Link ⊔ Appearance ⊔ HasState ⊔ ChildOf

  Link       : Thing → Thing          (procedural ⊔ structural ⊔ control)
  Appearance : Thing → OPD            (morfismo de fibración π, porta propiedades visuales)
  HasState   : State ↪ Object         (mono, codificado como referencia estructural)
  ChildOf    : OPD → OPD              (árbol, codificado como referencia estructural)

2-Mor(C_opm) = Modifier

  Modifier : Link ⇒ Link             (2-celda sobre 1-celda)
  Modifier ∈ {event, condition}

Fibración:
  π: C_opm → C_opd_tree
  Fibra sobre OPD_i = {t ∈ Thing | ∃ a: t → OPD_i ∈ Appearance}

Enriquecimiento temporal (Rev.2):
  T: Obj(C_opm) ⇀ Duration           (functor parcial: asigna dimensión temporal a things y states)
  Duration = (nominal: ℝ, min: ℝ, max: ℝ, unit: TimeUnit)

Observadores de la coalgebra (Rev.2):
  Assertion: ModelState → {PASS, FAIL} (predicados sobre el espacio de estados)
  Assertion ∈ Hom(Coalg(F), 2)        (morfismos al objeto terminal del topos Bool)

Decoración de C_opm (Rev.2):
  Requirement: Obj(C_opm) ⊔ Mor(C_opm) → C_req  (functor de anotación)
  Stereotype: C_template → C_opm                   (functor de inyección de estructura)
  Scenario: selección de sub-hom-set de Mor(C_opm) (subobject del path space)

Sub-modelos (Rev.2):
  SubModel: C_main ←π_shared─ I ─ι_sub→ C_sub     (span sobre interfaz compartida)
  I = {t ∈ Thing | t ∈ Obj(C_main) ∩ Obj(C_sub)}  (shared things)

Fibra distinguida para generalización (Rev.3):
  Discriminating: ∀ Gen G con exhibition E: G→D donde E.discriminating=true,
    ∀ Spec S_i con generalization ι_i: S_i→G,
    ι_i porta sección σ_i ⊆ Sub(D) tal que:
      ⊔_i σ_i = Sub(D)              (exhaustividad: unión cubre todo el reticulado)
      σ_i ∩ σ_j = ∅ para i ≠ j      (disjuntividad: cada state discrimina unívocamente)
```

---

## 2. 0-Celdas

### 2.1 Thing

Un Thing es la unidad ontológica fundamental de OPM. Tiene dos kinds: Object (rectángulo) y Process (elipse).

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Identificador estable. Patrón: `obj-{slug}` \| `proc-{slug}` |
| `kind` | `"object"` \| `"process"` | ✓ | Discriminador de tipo |
| `name` | string | ✓ | Nombre del thing (capitalizado por convención OPM) |
| `essence` | `"physical"` \| `"informatical"` | ✓ | Sombra visual = physical |
| `affiliation` | `"systemic"` \| `"environmental"` | ✓ | Contorno discontinuo = environmental |
| `perseverance` | `"static"` \| `"dynamic"` \| `null` | - | null = no clasificado aún |
| `duration` | Duration \| `null` | - | Dimensión temporal (L-M1-11). Ver §2.5 |
| `notes` | string \| `null` | - | Notas del modelador (L-M6-05) |
| `hyperlinks` | string[] | - | URLs asociadas al thing (L-M4-08) |
| `user_input_enabled` | boolean | - | Solo kind=process. Toggle "Get input during simulation" (L-M5-08) |
| `computational` | ComputationalObject \| ComputationalProcess \| `null` | - | null = no computacional |

**Justificación categórica de `duration`:** El tiempo es un enriquecimiento de la categoría. El functor parcial T: Obj(C_opm) ⇀ Duration asigna a cada thing (y state) un vector temporal (nominal, min, max). La parcialidad refleja que no todo thing tiene duración — solo processes y states la portan opcionalmente. Este enriquecimiento convierte C_opm en una categoría enriquecida sobre la categoría monoidal (ℝ≥0, +, 0) donde la duración de composiciones se acumula.

**Justificación categórica de `notes` y `hyperlinks`:** Son decoraciones sobre objetos — functores Obj(C_opm) → Set que no alteran la estructura categórica. No participan en composición ni en invariantes OPM. Son anotaciones libres.

**ComputationalObject** (P2 — L-M5-03):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `value` | any | Valor actual |
| `value_type` | `"integer"` \| `"float"` \| `"string"` \| `"character"` \| `"boolean"` | Tipo de dato |
| `unit` | string \| `null` | Unidad de medida |
| `alias` | string \| `null` | Nombre corto para referencia en código |
| `ranges` | Range[] | Rangos de valores válidos (L-M5-06). Ver §2.6 |
| `default_value` | any \| `null` | Valor por defecto (se usa al reset y en simulación si no se especifica otro) |

**ComputationalProcess** (P2 — L-M5-04):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `function_type` | `"predefined"` \| `"user_defined"` | Origen de la función |
| `function_name` | string \| `null` | Nombre de función predefinida |
| `function_code` | string \| `null` | Código user-defined |

### 2.2 State

Un State es un subobjeto (mono) de un Object. No tiene existencia independiente.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `state-{object-slug}-{state-slug}` |
| `parent` | string | ✓ | ID del Object al que pertenece. **Mono: State ↪ Object** |
| `name` | string | ✓ | Sin capitalización (ISO 19450) |
| `initial` | boolean | ✓ | Contorno grueso |
| `final` | boolean | ✓ | Doble contorno |
| `default` | boolean | ✓ | Flecha diagonal abierta |
| `current` | boolean | - | Estado activo actual (resaltado visual, útil para simulación) (L-M1-06) |
| `duration` | Duration \| `null` | - | Dimensión temporal del state (L-M1-11) |
| `hyperlinks` | string[] | - | URLs asociadas al state (L-M4-08) |

**Justificación categórica de `current`:** En el reticulado exclusivo Sub(O), `current` marca el subobjeto activo. En el espacio de estados del coalgebra (DA-5), ModelState = Π_{o ∈ Objects} (State(o) × Existence(o)), el state marcado como `current` es el valor de State(o) para ese object. Es la **observación puntual** del coalgebra.

**Constraint mono:** `parent` DEBE referenciar un Thing con `kind: "object"`. Al eliminar el Object, TODOS sus States se eliminan por composición (cascade delete).

### 2.3 OPD

Un OPD es un nodo del árbol de diagramas. Forma la base de la fibración π.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `opd-{slug}` |
| `name` | string | ✓ | Ej: "SD", "SD1", "SD1.1" |
| `opd_type` | `"hierarchical"` \| `"view"` | ✓ | Discriminador: view diagrams NO participan en π (L-M4-04) |
| `parent_opd` | string \| `null` | ✓ | ID del OPD padre. null = raíz (SD). **Codifica `child_of`** |
| `refines` | string \| `null` | - | ID del Thing que este OPD refina (in-zoom/unfold) |
| `refinement_type` | `"in-zoom"` \| `"unfold"` \| `null` | - | Tipo de refinamiento |

**Justificación categórica de `opd_type`:** La fibración π: C_opm → C_opd_tree se define solo sobre OPDs de tipo `"hierarchical"`. Los View Diagrams (L-M4-04) son objetos de Obj(C_opm) que NO participan en la fibración — son colecciones libres de appearances sin relación padre-hijo. La distinción es un coproducto: OPD = OPD_hierarchical ⊔ OPD_view. Solo OPD_hierarchical ∈ Obj(C_opd_tree).

**Constraint árbol:** Los `parent_opd` de OPDs con `opd_type: "hierarchical"` forman un árbol sin ciclos con exactamente una raíz (SD). Los OPDs con `opd_type: "view"` tienen `parent_opd: null` y `refines: null`.

### 2.4 Tipos compuestos compartidos

**Duration** (compartido por Thing y State):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nominal` | number | Duración nominal |
| `min` | number \| `null` | Duración mínima |
| `max` | number \| `null` | Duración máxima |
| `unit` | `"ms"` \| `"s"` \| `"min"` \| `"h"` \| `"d"` | Unidad temporal |

**Constraint DA-5:** `max` de un process es el umbral para overtime exception links (L-M1-04). Si un link type=exception tiene source=process P, entonces P.duration.max DEBE existir.

### 2.5 Range (para ComputationalObject)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `min` | number | Límite inferior |
| `max` | number | Límite superior |
| `min_inclusive` | boolean | `[` (true) vs `(` (false) |
| `max_inclusive` | boolean | `]` (true) vs `)` (false) |

**Constraint:** Múltiples ranges disjuntos son válidos (L-M5-06). El valor del object debe caer en la unión de todos los ranges definidos.

**Position** (para Link vertices):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `x` | number | Coordenada horizontal |
| `y` | number | Coordenada vertical |

**Style** (para Appearance):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `fill_color` | string \| `null` | Color de relleno (hex o named) |
| `text_color` | string \| `null` | Color de texto |
| `border_color` | string \| `null` | Color de contorno |

---

## 3. 1-Celdas

### 3.1 Link (morfismo de dominio)

Un Link es un morfismo tipado entre Things (o States).

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `lnk-{slug}` |
| `type` | LinkType | ✓ | Tipo del enlace (ver tabla) |
| `source` | string | ✓ | ID de 0-celda origen (Thing o State) |
| `target` | string | ✓ | ID de 0-celda destino (Thing o State) |
| `source_state` | string \| `null` | - | ID de State calificador en el source |
| `target_state` | string \| `null` | - | ID de State calificador en el target |
| `multiplicity_source` | string \| `null` | - | Ej: "1", "2..5", "?", "+", "0..many" |
| `multiplicity_target` | string \| `null` | - | Ídem |
| `probability` | number \| `null` | - | 0.0–1.0 (para XOR fans) |
| `rate` | Rate \| `null` | - | Tasa de consumo |
| `path_label` | string \| `null` | - | Etiqueta de ruta para scenarios |
| `tag` | string \| `null` | - | Tag para tagged structural links |
| `direction` | `"unidirectional"` \| `"bidirectional"` \| `"reciprocal"` \| `null` | - | Solo para tagged links |
| `tag_reverse` | string \| `null` | - | Tag inverso para bidirectional |
| `ordered` | boolean | - | Solo type=aggregation. OPL lista partes en orden visual (L-M1-05) |
| `invocation_interval` | Duration \| `null` | - | Solo type=invocation con source=target (auto-invocación). Intervalo entre iteraciones (L-M1-04) |
| `discriminating` | boolean | - | Solo type=exhibition. Marca este atributo como discriminador para generalizaciones del exhibitor (L-M1-04) |
| `discriminating_values` | string[] | - | Solo type=generalization. IDs de states del discriminating attribute a los que esta specialization está restringida (L-M1-04) |
| `hyperlinks` | string[] | - | URLs asociadas al link (L-M4-08) |
| `vertices` | Position[] | - | Puntos de inflexión visuales del enlace |

**Justificación categórica de `ordered`:** En un enlace aggregation (producto/límite), `ordered: true` equipa el producto con una estructura de orden total sobre sus factores. Esto convierte el producto en un **producto indexado** — los factores tienen un índice posicional derivado del orden visual en el OPD. El functor expose del lens (DA-6) usa este orden para generar OPL con las partes listadas posicionalmente en vez de alfabéticamente.

**Justificación categórica de `invocation_interval`:** La auto-invocación es un endomorfismo f: P → P en la categoría. El intervalo temporal enriquece este endomorfismo en la categoría temporal: el endomorfismo no se compone instantáneamente sino con un delay ∈ Duration. Esto es relevante para el evaluador coalgebraico (DA-5): cada iteración del bucle consume `invocation_interval` unidades temporales.

**Justificación categórica de `discriminating` y `discriminating_values`:** En una generalización G con specializations S₁...Sₙ, el discriminating attribute D es un atributo exhibido por G cuyos states forman un reticulado Sub(D). Marcar un exhibition link como `discriminating: true` equipa el functor de inclusión ι: S_i ↪ G con una **fibra distinguida** sobre Sub(D). La restricción `discriminating_values` en cada generalization link es una **sección** de esa fibra: S_i selecciona un subobject {v₁...vₖ} ⊆ Sub(D). El invariante I-31 verifica que las secciones sean disjuntas (cada valor del discriminador pertenece a exactamente una specialization) y exhaustivas (la unión cubre todo Sub(D)).

**Rate:**

| Campo | Tipo |
|-------|------|
| `value` | number |
| `unit` | string |

**LinkType — Taxonomía completa:**

| Grupo | Tipo | Source → Target | Constraint |
|-------|------|----------------|------------|
| **Procedural (transforming)** | `effect` | Process → Object | |
| | `consumption` | Process → Object | |
| | `result` | Process → Object | |
| | `input` | State → Process | State pertenece al Object afectado |
| | `output` | Process → State | State pertenece al Object afectado |
| **Procedural (enabling)** | `agent` | Object → Process | Object.essence = physical ∧ isHuman |
| | `instrument` | Object → Process | |
| **Structural** | `aggregation` | Part → Whole | Solo Object↔Object o Process↔Process |
| | `exhibition` | Attribute → Exhibitor | Attribute.essence := informatical (endofunctor) |
| | `generalization` | Specialization → General | Solo mismo kind |
| | `classification` | Instance → Class | Solo mismo kind |
| | `tagged` | Thing → Thing | Requiere `tag` |
| **Control** | `invocation` | Process → Process | Incluye auto-invocación (source = target) |
| | `exception` | Process → Process | Source.duration.max DEBE existir |

### 3.2 Appearance (morfismo de fibración)

Un Appearance es el morfismo π que conecta un Thing con el OPD donde es visible. Porta las propiedades visuales por-OPD.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `thing` | string | ✓ | ID del Thing |
| `opd` | string | ✓ | ID del OPD |
| `x` | number | ✓ | Posición horizontal |
| `y` | number | ✓ | Posición vertical |
| `w` | number | ✓ | Ancho |
| `h` | number | ✓ | Alto |
| `internal` | boolean | - | true = objeto interno de in-zoom (creado dentro del scope del proceso). false o ausente = externo (heredado del padre vía pullback). Solo relevante en OPDs de refinamiento (L-M1-09) |
| `pinned` | boolean | - | true = posición fijada para auto-layout (L-M3-03) |
| `auto_sizing` | boolean | - | true = tamaño se ajusta al texto automáticamente (L-M1-12). Default: true |
| `state_alignment` | `"left"` \| `"top"` \| `"right"` \| `"bottom"` | - | Alineación de estados dentro del object |
| `suppressed_states` | string[] | - | IDs de states suprimidos en este OPD |
| `semi_folded` | boolean | - | Vista semi-fold activa |
| `style` | Style \| `null` | - | Propiedades visuales de color/estilo (L-M3-03, L-M6-04) |

**Justificación categórica de `internal`:** En la opfibración π, cuando se ejecuta un in-zoom sobre un proceso P, la nueva fibra OPD_{P} contiene dos tipos de objetos:

1. **Externos** (pullback): objetos que estaban en fibra(OPD_{parent}) y tenían un link a P. Estos son la imagen del functor de pullback PB: fibra(OPD_{parent}) ×_{P} → fibra(OPD_{child}). Son proyecciones del padre — su existencia es independiente del proceso.

2. **Internos** (no-pullback): objetos creados directamente en fibra(OPD_{child}) cuya existencia está acotada al scope de P. No están en la imagen del pullback — son objetos propios de la fibra.

`internal: true` marca los objetos que están en fibra(OPD_{child}) \ Im(PB). `internal: false` marca los que están en Im(PB). Esta distinción es estructural y el Domain Engine la enforce (L-M1-09).

**Constraint:** El par `(thing, opd)` es único — un thing aparece a lo sumo una vez por OPD.

**Semántica de fibración:** La fibra sobre OPD_i es el conjunto `{a.thing | a ∈ appearances, a.opd = OPD_i}`. Esta es la implementación concreta de π: C_opm → C_opd_tree. Los OPDs con `opd_type: "view"` participan en appearances pero NO en la fibración jerárquica.

---

## 4. 2-Celdas

### Modifier

Un Modifier es una transformación natural sobre un Link (1-celda). NO es una propiedad del Link — es una entidad de primera clase.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `mod-{slug}` |
| `over` | string | ✓ | ID del Link sobre el que actúa |
| `type` | `"event"` \| `"condition"` | ✓ | Tipo de modifier |
| `negated` | boolean | - | NOT modifier |

**Justificación categórica:** Los modifiers son 2-celdas, no propiedades de 1-celdas, porque:
1. Un mismo link puede tener múltiples modifiers (event + condition)
2. Los modifiers componen independientemente del link subyacente
3. La semántica OPL del modifier se combina con la del link — la 2-celda actúa sobre la 1-celda

---

## 5. Estructuras Derivadas

### 5.1 Fan

Un Fan agrupa múltiples links del mismo tipo en el mismo puerto de un thing, modelando alternativas exclusivas (XOR) o inclusivas (OR).

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `fan-{slug}` |
| `type` | `"xor"` \| `"or"` | ✓ | XOR = exactamente uno, OR = al menos uno |
| `members` | string[] | ✓ | IDs de los Links agrupados (≥ 2) |

**Constraint XOR:** La suma de `probability` de los members debe ser 1.0.

### 5.2 Scenario

Un Scenario selecciona un subconjunto de path labels activos para simulación. Es un subobject del path space.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `scn-{slug}` |
| `name` | string | ✓ | Nombre del scenario |
| `path_labels` | string[] | ✓ | Path labels activos en este scenario |

**Justificación categórica:** Un Scenario es un subobject del espacio de morfismos: Scenario ↪ Hom(C_opm). Selecciona cuáles 1-celdas (links con path_label) participan en una ejecución de simulación. El evaluador coalgebraico (DA-5) restringe su evaluación a los morfismos seleccionados: c_scenario: ModelState → F(ModelState) donde F opera solo sobre links cuyo path_label ∈ scenario.path_labels. Esto convierte la coalgebra completa en una familia de sub-coalgebras indexada por scenarios.

### 5.3 Assertion

Un Assertion es un predicado sobre el espacio de estados del coalgebra. Es un observador: ModelState → {PASS, FAIL}.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `ast-{slug}` |
| `target` | string \| `null` | - | ID del Thing o Link al que se asocia visualmente |
| `predicate` | string | ✓ | Predicado en formato OPM: `"after [Process], [Object] is [state]"` |
| `category` | `"safety"` \| `"liveness"` \| `"correctness"` | ✓ | Clasificación del predicado |
| `enabled` | boolean | ✓ | Toggle de activación para simulación |

**Justificación categórica:** Las assertions son morfismos en el topos Bool sobre el coalgebra:

```
Assertion_safety:    ∀ σ ∈ Traces(c): ¬reach(σ, bad_state)     — coinductivo
Assertion_liveness:  ∀ σ ∈ Traces(c): eventually(σ, good_state) — coinductivo
Assertion_correctness: post(step(σ_i)) satisface predicado      — inductivo por paso
```

Las assertions de safety y liveness se verifican por **coinducción** sobre trazas (DA-5). Las de correctness se verifican por inducción sobre cada paso. Esta clasificación determina el método de verificación.

### 5.4 Requirement

Un Requirement es una anotación de trazabilidad sobre objetos o morfismos del modelo. Es un functor de decoración: C_opm → C_req.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `req-{slug}` |
| `target` | string | ✓ | ID del Thing, State, o Link al que se asocia |
| `name` | string | ✓ | Nombre del requirement (auto-numerado) |
| `description` | string | - | Descripción del requirement |
| `req_id` | string \| `null` | - | ID externo del requirement (trazabilidad) |
| `stereotype` | RequirementStereotype \| `null` | - | Estereotipo conectado (L-M4-08) |
| `hyperlinks` | string[] | - | URLs de referencia |

**RequirementStereotype:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `essence` | string | Esencia del requirement |
| `actual_name` | string | Nombre del estereotipo |
| `attributes` | RequirementAttribute[] | Atributos personalizados |

**RequirementAttribute:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre del atributo |
| `value` | string | Valor |
| `validation` | `"hard"` \| `"soft"` | Nivel de validación |

**Justificación categórica:** Los requirements son un functor de decoración R: C_opm → C_req que asigna a cada objeto/morfismo un conjunto (posiblemente vacío) de requirements. Este functor NO participa en la composición de C_opm ni en la fibración — es una capa de anotación externa. La propiedad clave es que R preserva identidades: el requirement está atado a la identidad del objeto, no a su posición en la categoría.

### 5.5 Stereotype (referencia)

Un Stereotype conecta un thing a un template predefinido que inyecta sub-componentes, rangos y esencia.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `stp-{slug}` |
| `thing` | string | ✓ | ID del Thing al que se aplica el estereotipo |
| `stereotype_id` | string | ✓ | ID del estereotipo predefinido |
| `global` | boolean | ✓ | true = estereotipo global (ícono "G"), false = organizacional |

**Justificación categórica:** Un estereotipo es un functor S: C_template → C_opm que mapea la categoría-template (con sus sub-componentes y rangos) a la categoría del modelo. La aplicación del estereotipo es un **pushout** a lo largo del punto de anclaje:

```
    {anchor_point} ──→ C_template
         │                  │
         ↓                  ↓ S (functor de inyección)
      C_opm ─────────→ C_opm'
```

Los sub-componentes inyectados son de solo lectura (el functor S no admite inversa). Desvincular el estereotipo es el retract del pushout: los componentes permanecen como objetos libres.

### 5.6 SubModel (referencia)

Un SubModel registra la relación de un modelo principal con un sub-modelo externo que comparte un conjunto de things.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `id` | string | ✓ | Patrón: `sub-{slug}` |
| `name` | string | ✓ | Nombre del sub-modelo |
| `path` | string | ✓ | Ruta relativa al archivo .opmodel del sub-modelo |
| `shared_things` | string[] | ✓ | IDs de things compartidos (interfaz) |
| `sync_status` | `"synced"` \| `"pending"` \| `"unloaded"` \| `"disconnected"` | ✓ | Estado de sincronización |

**Justificación categórica:** Un sub-modelo es un span en la 2-categoría de categorías:

```
C_main ←──π_shared── I ──ι_sub──→ C_sub
```

Donde I es la subcategoría de interfaz (shared_things). Los morfismos π_shared e ι_sub son functores de inclusión. Los constraints de L-M1-13 son propiedades del span:

- **Inmutabilidad de I:** shared_things[] es fijo post-creación (no se pueden añadir/quitar)
- **Restricciones en C_sub:** things en Im(ι_sub) no pueden ser renombrados, eliminados, ni recibir estados o refinamientos desde C_sub
- **Desconexión:** `sync_status: "disconnected"` colapsa el span — I se disuelve y C_sub se convierte en categoría independiente

### 5.7 Modelo (metadata + settings)

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `name` | string | ✓ | Nombre del modelo |
| `description` | string | - | Descripción libre |
| `system_type` | `"artificial"` \| `"natural"` \| `"social"` \| `"socio-technical"` \| `null` | - | Tipo de sistema (del wizard) |
| `created` | ISO 8601 | ✓ | Fecha de creación |
| `modified` | ISO 8601 | ✓ | Última modificación |

### 5.8 Settings (configuración model-level)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `opl_language` | string | Idioma OPL (default: "en") (L-M6-04) |
| `opl_essence_visibility` | `"all"` \| `"non_default"` \| `"none"` | Visibilidad de sentencias de esencia (L-M6-04) |
| `opl_units_visibility` | `"always"` \| `"hide"` \| `"when_applicable"` | Visibilidad de unidades (L-M6-04) |
| `opl_alias_visibility` | boolean | Mostrar alias en OPL (L-M6-04) |
| `opl_highlight_opd` | boolean | Resaltar OPD al hover OPL (L-M6-04) |
| `opl_highlight_opl` | boolean | Resaltar OPL al hover OPD (L-M6-04) |
| `opl_color_sync` | boolean | Sincronizar color OPL↔OPD (L-M6-04) |
| `autoformat` | boolean | Auto-capitalización de nombres (L-M6-05) |
| `autosave_interval_s` | number | Intervalo de autoguardado en segundos (L-M6-05) |
| `decimal_precision` | number | Dígitos decimales para valores temporales (L-M6-05) |
| `notes_visible` | boolean | Visibilidad de notas por defecto (L-M6-05) |
| `opd_name_format` | `"full"` \| `"short"` | Formato de nombres de OPD (L-M6-05) |
| `opd_rearranging` | `"automatic"` \| `"manual"` \| `"inherited"` | Modo de ordenamiento del árbol OPD (L-M3-01) |
| `primary_essence` | `"physical"` \| `"informatical"` | Esencia por defecto para nuevos things (L-M6-04) |
| `range_validation_design` | `"soft"` \| `"hard"` | Validación de rangos en design time (L-M5-06) |
| `range_validation_simulation` | `"soft"` \| `"hard"` | Validación de rangos en simulación (L-M5-06) |
| `methodology_coaching` | boolean | Advertencias de guía metodológica en tiempo real (L-M4-02) |

---

## 6. Invariantes

Propiedades que el Domain Engine DEBE verificar al cargar, mutar y serializar.

### 6.1 Invariantes Estructurales

| # | Invariante | Formalización | Verificación |
|---|-----------|---------------|-------------|
| I-01 | **Mono State ↪ Object** | ∀ s ∈ State: s.parent ∈ {t ∈ Thing \| t.kind = "object"} | Al crear state |
| I-02 | **Cascade delete** | Delete(obj) ⟹ Delete(∀ s: s.parent = obj.id) ⟹ Delete(∀ lnk touching s) ⟹ Delete(∀ mod over lnk) ⟹ Delete(∀ app: app.thing = obj.id) ⟹ Delete(∀ req: req.target = obj.id) | Al eliminar thing |
| I-03 | **OPD tree** | parent_opd de OPDs hierarchical forma árbol acíclico con exactamente 1 raíz. OPDs view tienen parent_opd = null | Al crear/mover OPD |
| I-04 | **Appearance unique** | ∀ (thing, opd): \|{a \| a.thing = thing ∧ a.opd = opd}\| ≤ 1 | Al crear appearance |
| I-05 | **Link endpoints exist** | ∀ lnk: lnk.source ∈ Obj ∧ lnk.target ∈ Obj | Al crear link |
| I-06 | **Modifier target exists** | ∀ mod: mod.over ∈ {lnk.id \| lnk ∈ Links} | Al crear modifier |
| I-07 | **Fan members exist** | ∀ fan: ∀ m ∈ fan.members: m ∈ {lnk.id \| lnk ∈ Links} ∧ \|fan.members\| ≥ 2 | Al crear fan |
| I-08 | **IDs únicos globales** | ∀ x, y ∈ (Things ⊔ States ⊔ OPDs ⊔ Links ⊔ Modifiers ⊔ Fans ⊔ Scenarios ⊔ Assertions ⊔ Requirements ⊔ Stereotypes ⊔ SubModels): x ≠ y ⟹ x.id ≠ y.id | Al crear cualquier entidad |
| I-09 | **Assertion target exists** | ∀ ast: ast.target = null ∨ ast.target ∈ Obj ⊔ Mor | Al crear assertion |
| I-10 | **Requirement target exists** | ∀ req: req.target ∈ Obj ⊔ Mor | Al crear requirement |
| I-11 | **Stereotype target exists** | ∀ stp: stp.thing ∈ {t.id \| t ∈ Things} | Al crear stereotype ref |
| I-12 | **SubModel shared things exist** | ∀ sub: ∀ t ∈ sub.shared_things: t ∈ {th.id \| th ∈ Things} | Al crear sub-model |
| I-13 | **Scenario path labels exist** | ∀ scn: ∀ pl ∈ scn.path_labels: ∃ lnk: lnk.path_label = pl | Al crear scenario |
| I-14 | **Exception requires duration** | ∀ lnk(type=exception): lnk.source.duration.max ≠ null | Al crear exception link |
| I-15 | **Internal only in refinement OPDs** | ∀ app(internal=true): app.opd ∈ {opd \| opd.refines ≠ null} | Al crear appearance |

### 6.2 Invariantes de Dominio OPM (ISO 19450)

| # | Invariante | Formalización | HU |
|---|-----------|---------------|-----|
| I-16 | **Unicidad enlace transformante** | ∀ (p:Process, o:Object): \|{lnk ∈ {effect, consumption, result} \| lnk connects (p, o)}\| ≤ 1 por nivel de abstracción. Los enlaces enabling (agent, instrument) y state-specific (input, output) son ortogonales y pueden coexistir | L-M1-05 |
| I-17 | **Proceso transforma ≥1 objeto** | ∀ p:Process: ∃ o:Object, ∃ lnk ∈ {effect, consumption, result, input, output}: lnk connects (p, o) | L-M4-02 |
| I-18 | **Agent es humano físico** | ∀ lnk(type=agent): lnk.source.essence = "physical" | L-M1-03 |
| I-19 | **Exhibition → esencia informática** | ∀ lnk(type=exhibition): lnk.source.essence := "informatical" | L-M1-04 |
| I-20 | **In-zoom genera fibra** | InZoom(p) ⟹ ∃ opd: opd.refines = p.id ∧ opd.refinement_type = "in-zoom" ∧ opd.opd_type = "hierarchical" | L-M1-07 |
| I-21 | **Reticulado exclusivo Sub(O)** | ∀ obj, ∀ t ∈ simulación: obj está en exactamente 1 state ∈ States(obj) o en transición | L-M1-06 |
| I-22 | **Ranges contenidos en stereotype** | ∀ obj con stereotype S y ranges R: R ⊆ S.ranges | L-M5-06 |
| I-31 | **Discriminating attribute único** | ∀ General G: \|{lnk ∈ exhibition \| lnk.target = G ∧ lnk.discriminating = true}\| ≤ 1 | L-M1-04 |
| I-32 | **Discriminating values disjuntos y exhaustivos** | ∀ General G con discriminating attribute D: (1) ∀ S_i, S_j specializations de G: discriminating_values(S_i) ∩ discriminating_values(S_j) = ∅; (2) ⋃_i discriminating_values(S_i) = States(D) | L-M1-04 |

### 6.3 Invariantes Categóricos

| # | Invariante | Formalización | DA |
|---|-----------|---------------|-----|
| I-23 | **Composición de 1-celdas** | ∀ f:A→B, g:B→C ∈ Links: g∘f es representable y asociativo | DA-2 |
| I-24 | **Path equations al cargar** | Deserializar ⟹ verificar que paths conmutan donde esperado | DA-2 |
| I-25 | **Round-trip serialización** | D(S(model)) = model (deserializar ∘ serializar = identidad) | DA-2 |
| I-26 | **Lens PutGet** | update(g, edit) \|> expose = apply(edit, expose(g)) | DA-6 |
| I-27 | **Lens GetPut** | update(g, expose(g)) = g | DA-6 |
| I-28 | **Coalgebra paso a paso** | Cada paso de simulación evalúa c: ModelState → Event × (Precond → ModelState + 1) | DA-5 |
| I-29 | **Pullback de in-zoom** | Objetos externos en OPD_{child} = {obj ∈ fibra(OPD_{parent}) \| ∃ lnk connecting obj to refined_process}. Equivalentemente: ∀ app(opd=OPD_{child}, internal=false): app.thing ∈ Im(PB) | DA-2 |
| I-30 | **SubModel span** | shared_things inmutable post-creación. Things en Im(ι_sub) no admiten rename, delete, add-state ni refinement desde C_sub | DA-2 |

---

## 7. Schema JSON de Persistencia

### 7.1 Estructura del archivo `.opmodel`

```
{
  "opmodel": "<version>",
  "meta": { ... },
  "settings": { ... },
  "things": [ ...una línea por thing... ],
  "states": [ ...una línea por state... ],
  "opds":   [ ...una línea por opd... ],
  "links":  [ ...una línea por link... ],
  "modifiers": [ ...una línea por modifier... ],
  "appearances": [ ...una línea por appearance... ],
  "fans": [ ...una línea por fan... ],
  "scenarios": [ ...una línea por scenario... ],
  "assertions": [ ...una línea por assertion... ],
  "requirements": [ ...una línea por requirement... ],
  "stereotypes": [ ...una línea por stereotype ref... ],
  "sub_models": [ ...una línea por sub-model ref... ]
}
```

### 7.2 Convenciones de normalización

1. **Keys sorted** alfabéticamente en cada objeto (determinismo de serialización)
2. **Un objeto por línea** en cada array (máxima git-diffability)
3. **Arrays sorted por `id`** (o por `(thing, opd)` para appearances)
4. **Campos null omitidos** para reducir ruido (solo se persisten campos con valor)
5. **IDs estables** — slug semántico, nunca auto-increment ni UUID aleatorio
6. **Extensión:** `.opmodel`
7. **Secciones vacías** se persisten como arrays vacíos `[]` (no se omiten)

### 7.3 Ejemplo completo

```json
{
  "opmodel": "1.1.0",
  "meta": {
    "created": "2026-03-10T15:30:00Z",
    "description": "Sistema de preparación de café — SD con wizard artificial",
    "modified": "2026-03-10T16:45:00Z",
    "name": "Coffee Making System",
    "system_type": "artificial"
  },
  "settings": {
    "autosave_interval_s": 300,
    "methodology_coaching": true,
    "opl_language": "en",
    "primary_essence": "physical"
  },
  "things": [
    {"affiliation": "systemic", "essence": "physical", "id": "obj-barista", "kind": "object", "name": "Barista"},
    {"affiliation": "systemic", "essence": "physical", "id": "obj-coffee", "kind": "object", "name": "Coffee"},
    {"affiliation": "systemic", "essence": "physical", "id": "obj-coffee-beans", "kind": "object", "name": "Coffee Beans"},
    {"affiliation": "systemic", "essence": "physical", "id": "obj-water", "kind": "object", "name": "Water"},
    {"affiliation": "systemic", "duration": {"nominal": 120, "unit": "s"}, "essence": "physical", "id": "proc-coffee-making", "kind": "process", "name": "Coffee Making"}
  ],
  "states": [
    {"current": true, "default": true, "final": false, "id": "state-coffee-unmade", "initial": true, "name": "unmade", "parent": "obj-coffee"},
    {"default": false, "final": true, "id": "state-coffee-ready", "initial": false, "name": "ready", "parent": "obj-coffee"},
    {"current": true, "default": true, "final": false, "id": "state-water-cold", "initial": true, "name": "cold", "parent": "obj-water"},
    {"default": false, "final": true, "id": "state-water-hot", "initial": false, "name": "hot", "parent": "obj-water"}
  ],
  "opds": [
    {"id": "opd-sd", "name": "SD", "opd_type": "hierarchical", "parent_opd": null},
    {"id": "opd-sd1", "name": "SD1", "opd_type": "hierarchical", "parent_opd": "opd-sd", "refines": "proc-coffee-making", "refinement_type": "in-zoom"}
  ],
  "links": [
    {"id": "lnk-barista-agent-coffee-making", "source": "obj-barista", "target": "proc-coffee-making", "type": "agent"},
    {"id": "lnk-coffee-making-consumption-beans", "source": "proc-coffee-making", "target": "obj-coffee-beans", "type": "consumption"},
    {"id": "lnk-coffee-making-effect-water", "source": "proc-coffee-making", "source_state": "state-water-cold", "target": "obj-water", "target_state": "state-water-hot", "type": "effect"},
    {"id": "lnk-coffee-making-result-coffee", "source": "proc-coffee-making", "target": "obj-coffee", "type": "result"}
  ],
  "modifiers": [
    {"id": "mod-water-event", "over": "lnk-coffee-making-effect-water", "type": "event"}
  ],
  "appearances": [
    {"h": 50, "opd": "opd-sd", "thing": "obj-barista", "w": 120, "x": 50, "y": 50},
    {"h": 50, "opd": "opd-sd", "thing": "obj-coffee", "w": 120, "x": 500, "y": 200},
    {"h": 50, "opd": "opd-sd", "thing": "obj-coffee-beans", "w": 140, "x": 50, "y": 200},
    {"h": 50, "opd": "opd-sd", "thing": "obj-water", "w": 120, "x": 50, "y": 350},
    {"h": 80, "opd": "opd-sd", "thing": "proc-coffee-making", "w": 180, "x": 280, "y": 180},
    {"h": 50, "internal": false, "opd": "opd-sd1", "thing": "obj-water", "w": 120, "x": 50, "y": 100}
  ],
  "fans": [],
  "scenarios": [],
  "assertions": [
    {"category": "correctness", "enabled": true, "id": "ast-coffee-ready", "predicate": "after Coffee Making, Coffee is ready", "target": "proc-coffee-making"}
  ],
  "requirements": [],
  "stereotypes": [],
  "sub_models": []
}
```

### 7.4 Ejemplo de git diff

Agregar un assertion y un scenario al modelo:

```diff
   "assertions": [
-    {"category": "correctness", "enabled": true, "id": "ast-coffee-ready", "predicate": "after Coffee Making, Coffee is ready", "target": "proc-coffee-making"}
+    {"category": "correctness", "enabled": true, "id": "ast-coffee-ready", "predicate": "after Coffee Making, Coffee is ready", "target": "proc-coffee-making"},
+    {"category": "safety", "enabled": true, "id": "ast-water-never-lost", "predicate": "Water is never consumed without producing Coffee", "target": "obj-water"}
   ],
```

```diff
-  "scenarios": [],
+  "scenarios": [
+    {"id": "scn-happy-path", "name": "Happy Path", "path_labels": ["main", "success"]}
+  ],
```

---

## 8. Diagrama de Relaciones

```
                    ┌─────────────┐
                    │    Meta     │
                    └──────┬──────┘
                           │ 1:1
                    ┌──────┴──────┐       ┌───────────┐
                    │   Model     │───────│ Settings  │
                    └──────┬──────┘       └───────────┘
          ┌────────────────┼──────────────────┐
          │                │                  │
   ┌──────┴──────┐  ┌─────┴─────┐     ┌─────┴──────┐
   │   Things    │  │   OPDs    │     │ SubModels  │
   │ Object|Proc │  │hier|view  │     │  (span)    │
   └──┬─┬─┬──────┘  └─────┬─────┘     └────────────┘
      │ │ │               │
      │ │ │  ┌────────────┴──────┐
      │ │ │  │   Appearances     │
      │ │ │  │ thing×opd → pos   │
      │ │ │  │ +internal,pinned  │
      │ │ │  │ +style,auto_size  │
      │ │ │  └───────────────────┘
      │ │ │
      │ │ │  ┌───────────────────┐  ┌──────────────┐
      │ │ └──│     Links        │──│  Modifiers   │
      │ │    │  src → tgt typed  │  │  2-cell on   │
      │ │    │ +ordered,interval │  │  1-cell      │
      │ │    └────────┬──────────┘  └──────────────┘
      │ │             │
      │ │    ┌────────┴──────┐
      │ │    │    Fans       │
      │ │    │   XOR|OR      │
      │ │    └───────────────┘
      │ │
      │ │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
      │ ├──│ Assertions  │  │ Requirements │  │ Stereotypes  │
      │ │  │ coalg obs   │  │ decoration   │  │ pushout inj  │
      │ │  └─────────────┘  └──────────────┘  └──────────────┘
      │ │
      │ │         ┌──────────────┐
      │ │         │  Scenarios   │
      │ │         │ path subset  │
      │ │         └──────────────┘
      │ │
   ┌──┴─┴────────┐
   │   States    │
   │  ↪ Object   │
   │  (mono)     │
   │ +current    │
   │ +duration   │
   └─────────────┘
```

---

## 9. Correspondencia con el Fundamento Categórico

| Construcción CT (DA-2) | Implementación en el modelo de datos |
|------------------------|--------------------------------------|
| 0-celda | Entrada en `things[]`, `states[]`, o `opds[]` |
| 1-celda | Entrada en `links[]` o `appearances[]` |
| 2-celda | Entrada en `modifiers[]` |
| Mono State ↪ Object | `states[].parent` → referencia con cascade (I-01, I-02) |
| Fibración π | `appearances[]` mapea things a OPDs hierarchical; fibra = filter por `opd` |
| Árbol C_opd_tree | `opds[].parent_opd` forma el árbol (solo `opd_type: "hierarchical"`) |
| OPD View (fuera de π) | `opds[]` con `opd_type: "view"` — no participan en fibración |
| Composición g∘f | Calculable en runtime sobre `links[]` por transitividad source→target |
| Retracción in-zoom | `opds[].refines` + pullback en appearances (`internal: false` = Im(PB)) |
| Objetos internos | `appearances[].internal: true` = fibra(OPD_{child}) \ Im(PB) |
| Endofunctor Exhibition | I-19: al crear link `exhibition`, forzar `source.essence := "informatical"` |
| Fan XOR/OR | `fans[]` agrupa `links[].id` con semántica de coproducto/producto |
| Producto indexado (ordered) | `links[].ordered: true` equipa el producto con orden total |
| Enriquecimiento temporal | `things[].duration`, `states[].duration`, `links[].invocation_interval` |
| Observadores coalgebraicos | `assertions[]` como morfismos ModelState → {PASS, FAIL} |
| Sub-coalgebras por scenario | `scenarios[]` seleccionan subconjunto de morfismos activos |
| Functor de decoración | `requirements[]` como R: C_opm → C_req |
| Pushout de estereotipo | `stereotypes[]` como S: C_template → C_opm |
| Span de sub-modelo | `sub_models[]` como C_main ← I → C_sub |
| Fibra distinguida (discriminating) | `links[].discriminating: true` marca fibra sobre Sub(D); `links[].discriminating_values` son secciones |

---

## 10. Registro de Gaps Corregidos (Auditoría Rev.2)

| Gap | Tipo | Corrección aplicada | Sección |
|-----|------|-------------------|---------|
| G-01 | Duration temporal | Campo `duration` en Thing y State + tipo Duration | §2.1, §2.2, §2.4 |
| G-02 | Assertions | Nueva entidad Assertion | §5.3 |
| G-03 | Requirements | Nueva entidad Requirement + RequirementStereotype | §5.4 |
| G-04 | Stereotypes | Nueva entidad Stereotype (ref) | §5.5 |
| G-05 | Sub-modelos | Nueva entidad SubModel (ref) | §5.6 |
| G-06 | Scenarios | Nueva entidad Scenario | §5.2 |
| G-07 | Settings del modelo | Nueva sección Settings | §5.8 |
| G-08 | Current state | Campo `current` en State | §2.2 |
| G-09 | OPD type | Campo `opd_type` en OPD | §2.3 |
| G-10 | Internal/external | Campo `internal` en Appearance | §3.2 |
| G-11 | Pinned | Campo `pinned` en Appearance | §3.2 |
| G-12 | Auto-sizing | Campo `auto_sizing` en Appearance | §3.2 |
| G-13 | Invocation interval | Campo `invocation_interval` en Link | §3.1 |
| G-14 | Ordered | Campo `ordered` en Link | §3.1 |
| G-15 | Ranges | Campo `ranges` + `default_value` en ComputationalObject | §2.1 |
| G-16 | Notes | Campo `notes` en Thing | §2.1 |
| G-17 | Hyperlinks | Campo `hyperlinks` en Thing, State, Link | §2.1, §2.2, §3.1 |
| G-18 | User input toggle | Campo `user_input_enabled` en Thing | §2.1 |
| G-19 | Style/color | Tipo Style + campo `style` en Appearance | §2.4, §3.2 |
| G-20 | Discriminating attribute | Campos `discriminating` y `discriminating_values` en Link + invariantes I-31, I-32 | §3.1, §6.2 |
| G-21 | Position type | Nuevo tipo Position en §2.4 | §2.4 |
| G-22 | Campo deprecated eliminado | `max_duration` eliminado de Link (nunca publicado, sustituido por `thing.duration.max`) | §3.1 |
