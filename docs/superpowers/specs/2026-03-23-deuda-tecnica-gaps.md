# Deuda Tecnica OPModel — Analisis de Gaps

**Fecha**: 2026-03-23
**Baseline**: 711 tests, 40+ invariantes, sesiones 1-12 completas
**Fuentes de verdad**: ISO 19450 (`opm-iso-19450.md`), OPCloud tutorial videos (`opcloud-tutorial-videos.md`), backlog lean (58 items)

---

## Metodologia

Cruce de 3 fuentes: (1) ISO 19450 — que DEBE soportar una herramienta conformante, (2) OPCloud — que hace el competidor de referencia, (3) implementacion actual — que tenemos hoy. Clasificacion por severidad y esfuerzo.

---

## I. CRITICAL — Quiebres de conformancia ISO

### C-01: Link Distribution to Contour (ISO §10.5.2)
- **Existe**: `Link.distributed?: boolean` en `types.ts:150`, `resolveLinksForOpd` en simulation.ts
- **Falta**: No hay mecanismo para distribuir links del parent a subprocesos. El flag `distributed` nunca se lee ni escribe. No hay API `distributeLinksToSubprocesses()`. Sin canvas UI.
- **ISO**: En in-zoom, consumption→primer subprocess, result→ultimo, agent/instrument/effect→todos
- **Esfuerzo**: L (core API + canvas UI + OPL)

### C-02: Restriccion consumption/result en contour de proceso in-zoomed
- **Existe**: Nada. No hay invariante que lo prohiba.
- **Falta**: Invariante que impida crear consumption/result links al outer contour de un proceso in-zoomed (ISO lo prohibe explicitamente)
- **Esfuerzo**: S (invariante en addLink)

### C-03: Exception Link — sin diferenciacion visual overtime/undertime
- **Existe**: `exception_type` en types.ts:149, I-14 valida `duration.max`, exception links renderizan como invocation
- **Falta**: Cero UI para `exception_type`. Sin barras visuales (1 barra=overtime, 2 barras=undertime). Sin selector en PropertiesPanel.
- **Esfuerzo**: S (PropertiesPanel + canvas rendering)

### C-04: State suppression automatica en parent OPD (ISO §14.2.1)
- **Existe**: `Appearance.suppressed_states` funciona — toggle manual en PropertiesPanel, rendering en OpdCanvas lo respeta
- **Falta**: Supresion AUTOMATICA: estados visibles en child OPD deberian auto-suprimirse en parent OPD. Solo hay supresion manual.
- **Esfuerzo**: M (logica en api.ts al refinar + adjust en OPL expose)

---

## II. HIGH — Gaps de capacidad visibles vs OPCloud

### H-01: Computational Object/Process — tipos sin UI
- **Existe**: `ComputationalObject` (value, value_type, unit, alias, ranges) y `ComputationalProcess` (function_type, code) en types.ts:63-77. Campo `Thing.computational`. Serializa/deserializa.
- **Falta**: CERO matches en PropertiesPanel para computational/duration/value_type/alias. Sin rendering en canvas. Sin editor de rangos, valores, aliases, funciones.
- **Esfuerzo**: L

### H-02: Duration Properties — tipos sin UI
- **Existe**: `Duration` en types.ts:32-38 (nominal, min, max, unit, distribution). `Thing.duration`, `State.duration`. OPL renderiza sentences de duracion.
- **Falta**: Sin editor en PropertiesPanel. Sin rendering visual dentro de elipses de proceso (ISO: nominal al centro, min a la izquierda, max a la derecha). Tipo completo pero inaccesible desde web.
- **Esfuerzo**: M

### H-03: Resize de Things — comando existe, sin canvas UI
- **Existe**: `resizeThing` command en commands.ts:56
- **Falta**: CERO resize handles en OpdCanvas. El comando nunca se genera. Los things no se pueden redimensionar visualmente.
- **Esfuerzo**: M (8 handles, drag handlers, min-size)

### H-04: Multi-seleccion — no implementada
- **Existe**: `selectedThing: string | null` (singular). `moveThings` command existe (batch move).
- **Falta**: Ctrl+Click multi-select, lasso/rubber-band, operaciones batch (delete, move, align). `moveThings` nunca se dispara.
- **Esfuerzo**: L (estado Set, lasso rect, batch ops)

### H-05: Search/Find (L-M3-05)
- **Existe**: Nada mas alla de OPD tree y things panel.
- **Falta**: Busqueda por nombre, filtro por tipo, navegacion al OPD correcto. Critico para modelos > 10 things.
- **Esfuerzo**: M

### H-06: Name Duplicate Detection (L-M4-01)
- **Existe**: OPM permite cosas con mismo nombre (misma entidad, multiples apariciones). No hay constraint de unicidad.
- **Falta**: Dialog "Use Existing Thing / Rename / Close" al crear/renombrar con nombre duplicado.
- **Esfuerzo**: S

### H-07: Minimap (L-M3-04)
- **Existe**: Nada.
- **Falta**: Preview miniatura del canvas con rectangulo de viewport.
- **Esfuerzo**: M

---

## III. MEDIUM — Completitud y polish

| ID | Gap | Existe | Falta | Esfuerzo |
|----|-----|--------|-------|----------|
| M-01 | View OPDs | Tipo `"view"` en OPD, I-03 enforcement | Sin UI para crear View OPDs | M |
| M-02 | Scenarios | Tipo + I-13 + API CRUD | Sin UI, sin path label editor | M |
| M-03 | Assertions | Tipo + I-09 + API CRUD | Sin UI, sin eval en simulacion | M |
| M-04 | Requirements | Tipo + I-10 + API CRUD | Sin UI, sin requirement views | M |
| M-05 | Stereotypes | Tipo + I-11 + API CRUD | Sin UI, sin biblioteca | S |
| M-06 | SubModels | Tipo + I-12 + API CRUD | Sin UI (P2, XL) | XL |
| M-07 | Link rate/direction rendering | Tipos existen. Direction solo en tagged links | Rate sin rendering. Direction parcial | S |
| M-08 | OPL inline text editing (L-M2-02) | Lens completo, form-based editor funciona | Sin edicion inline directa de texto OPL | XL |
| M-09 | Validation panel web (L-M4-02) | `validateModel()` en API, CLI `opmod validate` | Sin panel continuo en web, sin error markers | M |
| M-10 | Web test coverage | 4 test files basicos (commands, geometry, ids, store) | Sin component tests, sin E2E, sin visual regression | L ongoing |

---

## IV. LOW — Nice-to-have

| ID | Gap | Esfuerzo |
|----|-----|----------|
| L-01 | Model Wizard 12-stage (L-M6-08) | XL |
| L-02 | Grid snap-to | S |
| L-03 | Alignment tools (align, distribute) | M |
| L-04 | CSV import attributes | M |
| L-05 | PDF export | M |
| L-06 | OPL multi-language | L |
| L-07 | Model templates | M |
| L-08 | System Map (L-M4-09) | L |
| L-09 | Enveloping (ISO) | L |
| L-10 | OPD naming convention (SD, SD1, SD1.1) | S |
| L-11 | Link table full properties | M |
| L-12 | 7 TS2532 en test files | S |

---

## V. Work Packages propuestos

### WP-1: "Properties Panel Completeness" → H-01, H-02, C-03, M-07
Todos los tipos existen. Gap puramente UI. Agrega secciones en PropertiesPanel + rendering en canvas:
- Duration editor (nominal/min/max/unit) + rendering en elipses
- Computational Object/Process (value, type, unit, ranges, alias)
- Exception type selector + barras visuales
- Rate display en links

**Archivos target**: `PropertiesPanel.tsx`, `OpdCanvas.tsx`, `App.css`
**Esfuerzo estimado**: 1 sesion

### WP-2: "Editor Fundamentals" → H-03, H-04, H-05, H-06, H-07
Capacidades basicas de editor de diagramas:
- Resize handles en things
- Multi-select (Ctrl+Click, lasso)
- Search/Find panel (Ctrl+F)
- Name duplicate detection dialog
- Minimap (si da tiempo)

**Archivos target**: `OpdCanvas.tsx`, `useModelStore.ts`, `commands.ts`, nuevo `SearchPanel.tsx`
**Esfuerzo estimado**: 1-2 sesiones

### WP-3: "Refinement Engine ISO" → C-01, C-02, C-04
Los 3 gaps CRITICAL de ISO viven en el sistema de refinamiento:
- `distributeLinks` / `consolidateLinks` API + canvas button
- Invariante: consumption/result no pueden ir al contour de proceso in-zoomed
- State suppression automatica en parent OPDs

**Archivos target**: `api.ts`, `simulation.ts`, `OpdCanvas.tsx`, tests
**Esfuerzo estimado**: 1 sesion (arquitecturalmente complejo)

### WP-4: "Validation + Quality" → M-09, M-10, H-06
- Panel de validacion continua en web
- Web component tests iniciales
- Baseline de calidad

**Archivos target**: nuevo `ValidationPanel.tsx`, tests/
**Esfuerzo estimado**: 1 sesion

### WP-5: "Secondary Entities UI" → M-01 a M-05
CRUD UI para entidades con API completa pero sin superficie web:
- View OPDs, Scenarios, Assertions (los mas utiles)
- Requirements, Stereotypes (menor prioridad)

**Esfuerzo estimado**: 1-2 sesiones (selectivo)

---

## VI. Orden recomendado proximas sesiones

| Sesion | WP | Justificacion |
|--------|-----|---------------|
| 13 | WP-1: Properties Panel | Mayor ROI. Todo existe en tipos. UI pura. Desbloquea duracion para simulacion y exceptions ISO. |
| 14 | WP-2: Editor Fundamentals | Resize + multi-select son los gaps mas notorios. Search critico para modelos grandes. |
| 15 | WP-3: Refinement ISO | Los 3 CRITICAL de ISO. Mas complejo arquitecturalmente, mejor con editor solido. |
| 16 | WP-4: Validation + Quality | Con properties y refinement completos, validacion continua agrega valor real. |
| 17 | WP-5: Secondary Entities | View OPDs + Scenarios primero. Rest selectivo. |

---

## Resumen cuantitativo

| Severidad | Count | Parcial | Sin implementar |
|-----------|-------|---------|-----------------|
| Critical | 4 | 1 (C-04 suppress manual) | 3 |
| High | 7 | 0 | 7 |
| Medium | 10 | 3 (M-07, M-08, M-10) | 7 |
| Low | 12 | 0 | 12 |
| **Total** | **33** | **4** | **29** |

**Conclusion**: El core engine esta solido (40 invariantes, 711 tests, 8 DAs implementados). La deuda esta concentrada en: (1) UI que no expone tipos ya definidos, (2) refinamiento ISO incompleto, (3) capacidades basicas de editor. No hay deuda arquitectural — la deuda es de superficie.
