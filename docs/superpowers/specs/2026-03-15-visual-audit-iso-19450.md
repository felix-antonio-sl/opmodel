# Auditoría Visual ISO 19450 — OpdCanvas.tsx vs Láminas de Referencia

**Fecha:** 2026-03-15
**Auditor:** opm-specialist × arquitecto-categorico
**Fuentes:** 21 láminas en `imagenes-opm/`, ISO 19450 standard pages, OpdCanvas.tsx + App.css
**Componente auditado:** `packages/web/src/components/OpdCanvas.tsx` (849 LOC)

---

## Resumen Ejecutivo

| Severidad | Cant. | Estado |
|-----------|-------|--------|
| CRITICAL  | 5     | Todos requieren fix |
| HIGH      | 2     | Requieren fix |
| MEDIUM    | 3     | Deseables |
| LOW       | 5     | Opcionales / design latitude |
| **Total** | **15** | |

**Veredicto:** El canvas renderiza Things correctamente en forma general (ellipse/rect, physical/environmental), pero tiene **desviaciones críticas en TODOS los markers de links** — los 4 tipos de link (enabling, transforming, structural, control) tienen markers incorrectos o faltantes. Ningún tipo de link es visualmente conforme a ISO 19450 tal como está.

---

## Hallazgos Detallados

### CRITICAL — Markers ISO completamente incorrectos

#### C-01: Agent link usa arrowhead en vez de filled circle (●)

**ISO §8.1.1:** El agent link se marca con un **círculo negro relleno (●)** en el extremo del proceso (destino). El círculo distingue al agent del instrument.

**Nuestra implementación (L:82-87, L:388-389):**
```tsx
// marker usado: arrow-enabling — es una FLECHA, no un círculo
<marker id="arrow-enabling" viewBox="0 0 10 8" ...>
  <path d="M0,0 L10,4 L0,8Z" fill="#2b6cb0" />  // ← triángulo cerrado
</marker>
```

**ISO requiere:**
```
Object ───────● Process    (● = filled circle at process end)
```

**Fix propuesto:** Crear marker `dot-agent` con `<circle cx="4" cy="4" r="3.5" fill="currentColor"/>`, aplicarlo como `markerEnd` para agent links.

---

#### C-02: Instrument link usa arrowhead en vez de hollow circle (○)

**ISO §8.1.2:** El instrument link se marca con un **círculo hueco/vacío (○)** en el extremo del proceso.

**Nuestra implementación:** Usa el mismo `arrow-enabling` que agent — **son visualmente indistinguibles**.

**ISO requiere:**
```
Object ───────○ Process    (○ = hollow circle at process end)
```

**Fix propuesto:** Crear marker `circle-instrument` con `<circle cx="4" cy="4" r="3.5" fill="white" stroke="currentColor" stroke-width="1.5"/>`.

---

#### C-03: Effect link unidireccional — ISO requiere bidireccional (↔)

**ISO §7.2.3, Transforming Links image:** El effect link tiene **arrowheads en AMBOS extremos** (bidireccional). Es la marca visual que lo distingue de consumption (unidireccional).

**Nuestra implementación (L:401-402):**
```tsx
markerEnd={`url(#${arrowId})`}
// markerStart: solo se aplica para consumption (dot), NO para effect
```

Solo tiene flecha en un extremo.

**ISO requiere:**
```
Process ◄────────► Object    (arrowheads on both ends)
```

**Fix propuesto:** En `LinkLine`, cuando `link.type === "effect"`, añadir `markerStart={`url(#${arrowId})`}` además de `markerEnd`.

---

#### C-04: Structural links — todos usan mismo chevron abierto

**ISO §6 (Structural Links image):**

| Link | Marker ISO | Nuestro marker |
|------|-----------|----------------|
| Aggregation | ▲ Triángulo negro relleno | `>` Chevron abierto |
| Exhibition | ▲ Triángulo negro relleno | `>` Chevron abierto |
| Generalization | △ Triángulo hueco | `>` Chevron abierto |
| Classification | △ Triángulo hueco | `>` Chevron abierto |

**Nuestra implementación (L:88-90):**
```tsx
<marker id="arrow-struct" ...>
  <path d="M0,0 L10,4 L0,8" fill="none" stroke="#6b5fad" />  // ← chevron, NO triángulo
</marker>
```

Problemas:
1. La forma no es un triángulo cerrado sino un chevron abierto (`>`).
2. Los 4 tipos de structural link son **visualmente idénticos** — no se distingue aggregation de generalization.
3. La dirección del marker (qué extremo del link) necesita apuntar al **padre/whole/general/classifier**.

**Fix propuesto:**
- Crear `triangle-filled` (para aggregation + exhibition): `<path d="M0,8 L5,0 L10,8Z" fill="currentColor"/>`
- Crear `triangle-open` (para generalization + classification): `<path d="M0,8 L5,0 L10,8Z" fill="white" stroke="currentColor"/>`
- Posicionar en el extremo del padre/whole/general (source side en nuestro modelo).

---

#### C-05: Structural link triangle debe estar en el CENTRO del link (fork point), no en el extremo

**ISO §6, OPD_Metamodel.jpg, OPM_Model.jpg:** En structural links con múltiples participantes, el triángulo se ubica en un **fork point** central, con líneas irradiando desde la base del triángulo hacia cada participante y una sola línea desde el ápice hacia el padre.

**Nuestra implementación:** Renderiza structural links como líneas simples point-to-point con un chevron en el extremo. No hay fork point, no hay triángulo compartido.

**Fix propuesto:** Para structural links con >1 participante del mismo tipo, renderizar un triángulo SVG centralizado con líneas desde la base a cada participante. Este es un cambio de rendering significativo que requiere agrupar links por (parent, type).

---

### HIGH — Forma geométrica incorrecta

#### H-01: Object rectangles tienen esquinas redondeadas (rx=3)

**ISO §5.1.1 (OPM_Things.png, OPMEntities.png):** Los objetos son **rectángulos con esquinas agudas** (sharp corners). Las esquinas redondeadas están reservadas para los **estados** (state pills).

**Nuestra implementación (L:293-294):**
```tsx
<rect ... rx={3} ry={3} ... />  // ← esquinas redondeadas
```

**ISO requiere:** `rx={0} ry={0}` (o simplemente omitir rx/ry).

**Fix propuesto:** Eliminar `rx={3} ry={3}` del rect de objects. Mantener rx/ry solo en state pills.

---

#### H-02: Consumption link tiene filled circle espurio en el origen

**ISO §7.2.1 (Transforming Links, Procedural Links):** El consumption link es una **flecha simple** desde el objeto consumido hacia el proceso que lo consume. NO tiene círculo en ningún extremo.

**Nuestra implementación (L:95-97, L:402):**
```tsx
<marker id="dot-consumption" ...>
  <circle cx="4" cy="4" r="3" fill="#16794a" />  // ← círculo relleno
</marker>
// Se aplica como markerStart en consumption links
markerStart={link.type === "consumption" ? "url(#dot-consumption)" : undefined}
```

El resultado visual es: `● Object ──────► Process` — el ● NO está en ISO.

**Fix propuesto:** Eliminar `dot-consumption` marker y el `markerStart` condicional. Consumption = arrow simple.

---

### MEDIUM — Convenciones visuales divergentes

#### M-01: Modifier badge muestra `[event]`/`[condition]` en vez de `e`/`c`

**ISO §8.2 (Event links, Control-modified fans):** Los modifiers event/condition se marcan con una **sola letra** — `e` para event, `c` para condition — posicionada cerca del extremo destino del link.

**Nuestra implementación (L:407-410):**
```tsx
<text className="modifier-badge" x={mid.x} y={mid.y + 8}>
  [{modifier.type}]  // ← muestra "[event]", "[condition]"
</text>
```

**Fix propuesto:** Cambiar a `modifier.type === "event" ? "e" : "c"` y posicionar near target end.

---

#### M-02: No hay rendering de link fans (XOR/OR/AND)

**ISO §8.3 (Control-modified link fans):** Los fans agrupan links con un **arco punteado** que conecta las alternativas (XOR), opciones (OR), o conjunciones (AND).

**Nuestra implementación:** Links individuales sin agrupación visual. El `FanType` existe en el modelo (`xor | or | and`) pero no tiene representación visual en el canvas.

**Fix propuesto:** Implementar rendering de arco punteado SVG entre links del mismo fan, con label 'e'/'c' en el fan point.

---

#### M-03: No hay rendering de cardinality/participation constraints

**ISO §10 (Link cardinalities):** Markers de cardinalidad (`?`, `*`, `+`, numéricos) se posicionan cerca del target end de structural links.

**Fix propuesto:** Renderizar participation constraints del modelo como texto SVG near target end.

---

### LOW — Design latitude (mejoras estéticas)

#### L-01: Esquema de colores polychrome vs monochrome ISO

**ISO:** Todos los elementos en color neutro (negro/gris oscuro).
**Nuestra app:** Objects=azul, Processes=verde, Structural=púrpura, Control=naranja.

**Veredicto:** La norma no PROHIBE colores, y el color aids usability. OPCloud también usa color. **Aceptable como design latitude**, pero ofrecer opción "ISO strict monochrome" sería valioso.

---

#### L-02: State pill border no coincide con parent outline

**ISO:** States visualmente consistentes con el estilo del objeto padre.
**Nuestra app:** States usan gris (`--state-border`) independiente del color del padre.

**Veredicto:** Minor visual inconsistency. Considerar heredar stroke color del padre.

---

#### L-03: Modifier badge en midpoint vs near destination

**ISO:** La letra 'e'/'c' se posiciona **cerca del proceso** (destination end).
**Nuestra app:** Badge en el midpoint del link.

**Veredicto:** Funcionalmente correcto, posición ligeramente diferente.

---

#### L-04: Link type labels redundantes para procedural links

**ISO:** Los procedural links se identifican por su **marker** (flecha, círculo, bidireccional), no por texto.
**Nuestra app:** Muestra el tipo como texto ("consumption", "agent", etc.) en cada link.

**Veredicto:** Útil para principiantes, pero redundante con markers correctos. Considerar toggle.

---

#### L-05: Tamaño y proporción de markers

**ISO:** Los markers (círculos, triángulos) tienen proporciones específicas relativas al grosor del link.
**Nuestra app:** Markers dimensionados con viewBox fijo.

**Veredicto:** Requiere fine-tuning visual una vez corregidas las formas.

---

## Matriz de Prioridad de Fix

| Fix | Esfuerzo | Impacto | Prioridad |
|-----|----------|---------|-----------|
| C-01 Agent → filled circle | Bajo (nuevo marker SVG) | CRITICAL | P0 |
| C-02 Instrument → hollow circle | Bajo (nuevo marker SVG) | CRITICAL | P0 |
| C-03 Effect → bidireccional | Bajo (añadir markerStart) | CRITICAL | P0 |
| C-04 Structural triangles | Medio (2 nuevos markers + logic) | CRITICAL | P0 |
| C-05 Structural fork point | Alto (nuevo rendering path) | CRITICAL | P1 |
| H-01 Object rx=0 | Trivial (eliminar rx/ry) | HIGH | P0 |
| H-02 Remove consumption dot | Trivial (eliminar marker) | HIGH | P0 |
| M-01 Modifier 'e'/'c' | Bajo (string change) | MEDIUM | P1 |
| M-02 Link fans | Alto (nuevo componente) | MEDIUM | P2 |
| M-03 Cardinality | Medio (text rendering) | MEDIUM | P2 |

**Estimación P0:** 7 fixes, todos en `OpdCanvas.tsx` (SvgDefs + LinkLine), ~200 LOC de cambio.

---

## Apéndice: Referencia Visual ISO Canónica

### Things
```
Informatical Systemic:     ┌──────┐    (────────)
                           │Object│    ( Process )
                           └──────┘    (────────)

Physical Systemic:         ┏━━━━━━┓    (━━━━━━━━)   ← stroke grueso
                           ┃Object┃    ( Process )
                           ┗━━━━━━┛    (━━━━━━━━)

Environmental:             ┌╌╌╌╌╌╌┐    (╌╌╌╌╌╌╌╌)   ← dashed
                           ╎Object╎    ( Process )
                           └╌╌╌╌╌╌┘    (╌╌╌╌╌╌╌╌)
```

### Link Markers ISO
```
Agent:         Object ──────● Process     (● filled circle at process)
Instrument:    Object ──────○ Process     (○ hollow circle at process)
Consumption:   Object ──────► Process     (► arrow at process, NO circle at object)
Result:        Process ─────► Object      (► arrow at object)
Effect:        Process ◄────► Object      (◄► arrows on BOTH ends)
Aggregation:   Part ─────▲── Whole        (▲ filled triangle at whole)
Exhibition:    Feature ──▲── Exhibitor    (▲ filled triangle at exhibitor)
Generalization:Specific ─△── General     (△ open triangle at general)
Classification:Instance ─△── Classifier  (△ open triangle at classifier)
```

### States
```
┌──────────────┐
│   Object     │    ← sharp corners (NO rounded!)
│  ╭────╮╭────╮│
│  │ s1 ││ s2 ││    ← rounded pills for states only
│  ╰────╯╰────╯│
└──────────────┘
```
