# OPL Panel Enhancement — Design Spec

**Fecha:** 2026-03-13
**Estado:** Aprobado
**Autor:** fxsl/arquitecto-categorico

---

## Resumen

Evolucionar el OPL Panel del web editor desde una vista de sentencias read-only a un componente con tres tabs: **Sentencias** (vista semántica interactiva), **Texto** (OPL completo copiable), y **Editor** (formulario estructurado para los 8 OplEdit del core). La edición usa `applyOplEdit` de DA-6 como backend.

## Justificación categórica

Los tres tabs tienen **varianza distinta**:

```
Sentencias : Model × OpdId → View                       (covariante — get)
Texto      : Model × OpdId → View                       (covariante — get)
Editor     : Model × OpdId × UserInput → Result<Model>  (contravariante — put)
```

Esta asimetría justifica la factorización en componentes separados (Enfoque 2). El coproducto `Tab = Sentencias ⊔ Texto ⊔ Editor` preserva la composicionalidad: cada inyección tiene su propio perfil de dependencias y es verificable en aislamiento.

El `OplPanel` actúa como objeto terminal del coproducto: selecciona la inyección activa y delega.

## Decisiones de diseño

| Decisión | Alternativas descartadas | Justificación |
|----------|--------------------------|---------------|
| Tabs (3 pestañas) | Toggle 2 vistas, colapsable | Acomoda get + put en UX clara |
| Componentes separados por tab | Monolito, hook extraído | Respeta coproducto tipado y separación por varianza |
| Formulario selector + campos dinámicos | Botones rápidos inline | Soporta los 8 edits uniformemente |
| Los 8 OplEdit completos | Solo adds | Paridad total con core, panel autosuficiente |
| Formulario estructurado + placeholder textarea | Textarea libre ahora | Textarea requiere parser NL→OplEdit (Sub-proyecto B) |

---

## Arquitectura de componentes

### Estructura de archivos

```
packages/web/src/components/
  OplPanel.tsx          ← Orquestador de tabs (refactored)
  OplSentencesView.tsx  ← NEW — vista semántica interactiva
  OplTextView.tsx       ← NEW — texto plano copiable
  OplEditorView.tsx     ← NEW — formulario de edits
```

### Diagrama de dependencias

```
App.tsx
  └─ OplPanel(model, opdId, selectedThing, dispatch)
       ├─ OplSentencesView(model, opdId, selectedThing)     ← get direction
       ├─ OplTextView(model, opdId)                          ← get direction
       └─ OplEditorView(model, opdId, dispatch)              ← put direction
```

### Cambios en interfaces existentes

**OplPanel props** — recibe `dispatch` (nuevo):

```ts
interface OplPanelProps {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  dispatch: (cmd: Command) => boolean;
}
```

**App.tsx** — pasa `dispatch` al `OplPanel`:

```tsx
<OplPanel model={model} opdId={ui.currentOpd}
          selectedThing={ui.selectedThing} dispatch={store.dispatch} />
```

### Estado del tab

`activeTab` es estado local de `OplPanel` — efímero, no entra en `History<Model>`.

```ts
type OplTab = "sentences" | "text" | "editor";
const [activeTab, setActiveTab] = useState<OplTab>("sentences");
```

---

## Componente 1: OplSentencesView

**Tipo:** Covariante (get direction)
**Props:** `{ model, opdId, selectedThing }`

Extracción directa del código actual de `OplPanel.tsx`. Sin cambios funcionales.

Funciones privadas que se mueven con el componente:
- `getEntityIds(sentence)` — extrae IDs de entidades de una sentencia
- `sentenceCategory(sentence)` — clasifica como "thing" | "link" | "modifier"
- `renderSentence(sentence, doc)` — renderiza sentencia individual
- `sentenceClass(sentence, selectedThing)` — genera clases CSS con highlight

Sentencias agrupadas en things vs links con divider. Highlight por selección.

**Estimación:** ~80 líneas (refactor puro del código existente).

---

## Componente 2: OplTextView

**Tipo:** Covariante (get direction)
**Props:** `{ model, opdId }`

### Comportamiento

1. `expose(model, opdId)` → `render(doc)` → texto OPL completo
2. Muestra texto en `<pre>` con font monospace
3. Botón "Copy" con `navigator.clipboard.writeText(text)`
4. Feedback visual: "Copied!" → timeout 2s → "Copy"

### Layout

```
┌────────────────────────────────┐
│                        [Copy]  │
│ ┌────────────────────────────┐ │
│ │ Water is physical,         │ │
│ │ systemic.                  │ │
│ │ Boiling is a process.      │ │
│ │ Water can be cold or hot.  │ │
│ │                            │ │
│ │ Boiling changes Water from │ │
│ │ cold to hot.               │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

**Estimación:** ~40 líneas.

---

## Componente 3: OplEditorView

**Tipo:** Contravariante (put direction)
**Props:** `{ model, opdId, dispatch }`

### Flujo de datos

```
Usuario selecciona acción (dropdown)
    ↓
Campos dinámicos se adaptan al tipo de OplEdit
    ↓
Usuario llena campos
    ↓
Preview: render({...doc, sentences: [sentenceFromEdit]})
    ↓
"Apply Edit" → construye OplEdit → dispatch({ tag: "applyOplEdit", edit })
```

### Los 8 edits y sus campos

| OplEdit | Campos del formulario |
|---|---|
| `add-thing` | name, kind (object/process), essence (dropdown, default: `"informatical"`), affiliation (dropdown, default: `"systemic"`). `opdId` tomado del prop del componente. `position` default: `{ x: 100, y: 100 }` (esquina superior izquierda del OPD). |
| `remove-thing` | selector de thing existente (dropdown) |
| `add-states` | selector de thing (dropdown, filtrado a objects), state names (comma-separated). Parsing: split por `,`, trim whitespace, filtrar segmentos vacíos, deduplicar por nombre. Cada state se crea con `{ initial: false, final: false, default: false }`. |
| `remove-state` | selector de thing → selector de state (cascading dropdowns) |
| `add-link` | source (dropdown), target (dropdown), linkType (dropdown de los 14 tipos). Opcionalmente: source_state (dropdown, estados del source) y target_state (dropdown, estados del target) — visibles solo si source/target tienen estados definidos. |
| `remove-link` | selector de link existente (dropdown, muestra `sourceName → targetName (type)`) |
| `add-modifier` | selector de link (dropdown), modifierType (event/condition), negated (checkbox, default: `false`) |
| `remove-modifier` | selector de modifier existente (dropdown, muestra `type on linkName`) |

### Integración con Command algebra

Nuevo summand en el coproducto `Command`:

```ts
// commands.ts
| { tag: "applyOplEdit"; edit: OplEdit }

// interpret:
case "applyOplEdit":
  return {
    type: "modelMutation",
    apply: (m) => applyOplEdit(m, cmd.edit),
  };
```

Extensión conservativa del álgebra de comandos.

### Estado interno del formulario

```ts
// Flat bag — todos los campos en una interfaz plana.
// Trade-off consciente: un discriminated union por acción sería más tipado,
// pero para un formulario con 8 variantes y estado efímero, la flat bag
// es pragmática y evita boilerplate. Solo los campos relevantes a la
// acción activa se leen al construir el OplEdit.
interface EditorFormState {
  action: OplEdit["kind"];
  // add-thing
  name: string;
  thingKind: "object" | "process";
  essence: Essence;                    // default: "informatical"
  affiliation: Affiliation;            // default: "systemic"
  // selectors
  selectedThing: string;
  selectedLink: string;
  selectedState: string;
  selectedModifier: string;
  // add-states
  stateNames: string;                  // comma-separated, parsed on apply
  // add-link
  linkSource: string;
  linkTarget: string;
  linkType: LinkType;
  linkSourceState: string;             // optional, "" = sin especificar
  linkTargetState: string;             // optional, "" = sin especificar
  // add-modifier
  modifierType: ModifierType;
  negated: boolean;                    // default: false
}
```

Estado local, efímero. Se resetea al cambiar de acción. Los defaults iniciales son:

```ts
const INITIAL_FORM: EditorFormState = {
  action: "add-thing",
  name: "", thingKind: "object", essence: "informatical", affiliation: "systemic",
  selectedThing: "", selectedLink: "", selectedState: "", selectedModifier: "",
  stateNames: "",
  linkSource: "", linkTarget: "", linkType: "agent",
  linkSourceState: "", linkTargetState: "",
  modifierType: "event", negated: false,
};
```

### Validación pre-apply

- Campos requeridos no vacíos
- `add-thing`: name duplicado → warning visual (no bloqueante, el core permite nombres duplicados con IDs distintos)
- `add-link`: source ≠ target
- Botón "Apply" disabled si validación falla

### Preview

Bloque debajo del formulario que muestra la sentencia OPL resultante.

**Para adds:** Construir un `OplDocument` minimal con una sola sentencia sintética derivada del form state. Mapeo por acción:

- `add-thing` → `OplThingDeclaration` con `{ thingId: "preview", name, thingKind, essence, affiliation }`
- `add-states` → `OplStateEnumeration` con `{ thingId: selectedThing, thingName: model.things.get(selectedThing)?.name, stateNames: parseStateNames(stateNames) }`
- `add-link` → `OplLinkSentence` con `{ linkType, sourceName, targetName, sourceStateName?, targetStateName? }`
- `add-modifier` → `OplModifierSentence` con `{ modifierType, linkId: selectedLink, negated, linkType, sourceName, targetName }` (los 3 últimos se obtienen del link seleccionado vía `model.links.get(selectedLink)`)

Luego `render(previewDoc)` para obtener el texto. Si algún campo requerido está vacío, el preview muestra placeholder gris.

**Para removes:** Buscar la sentencia correspondiente en `expose(model, opdId).sentences` filtrando por el ID seleccionado, y renderizarla con `render()`. Si no se encuentra (entity no visible en este OPD), mostrar el ID de la entidad como fallback.

### Error feedback

Errores de `applyOplEdit` se muestran inline en el formulario (no en el status bar).

**Estimación:** ~180 líneas.

---

## Estilos CSS

Nuevas clases en `App.css`:

```css
/* Tab bar */
.opl-tabs { }
.opl-tab { }
.opl-tab--active { }

/* Text view */
.opl-text { }
.opl-text__copy { }
.opl-text__copy--copied { }
.opl-text__pre { }

/* Editor view */
.opl-editor { }
.opl-editor__field { }
.opl-editor__label { }
.opl-editor__preview { }
.opl-editor__apply { }
.opl-editor__error { }
```

Estilo consistente con el light theme existente. Tabs con borde inferior activo (accent color).

---

## Resumen de cambios

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `OplPanel.tsx` | Refactor | Orquestador de tabs, pasa a delegar |
| `OplSentencesView.tsx` | Nuevo | Extracción del código actual |
| `OplTextView.tsx` | Nuevo | Vista texto + clipboard |
| `OplEditorView.tsx` | Nuevo | Formulario 8 edits + preview |
| `commands.ts` | Extend | Nuevo summand `applyOplEdit` |
| `App.tsx` | Minor | Pasar `dispatch` a OplPanel |
| `App.css` | Extend | Clases para tabs, texto, editor |

**Total estimado:** ~400 líneas nuevas, ~80 líneas movidas.

**Imports nuevos en `commands.ts`:** `applyOplEdit`, `type OplEdit` desde `@opmodel/core`.

---

## Mejoras futuras (fuera de scope)

- **Sub-proyecto B:** Textarea libre con parser NL → OplEdit vía LLM (reemplaza formulario estructurado)
- Click en sentencia del tab Sentencias → pre-populate formulario del editor con la acción correspondiente
- Keyboard shortcut para cambio de tabs
