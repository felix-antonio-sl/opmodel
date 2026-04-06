# Handoff: Import, Link Type Selection, State Editing (B+C+D)

**Fecha:** 2026-03-11
**Branch:** master
**Commit:** b7277ca

---

## Resumen

Tres mejoras rapidas al editor web que completan el "flat diagram" antes de atacar Multi-OPD:

1. **Import .opmodel** — cargar modelos desde archivo
2. **Seleccion manual de link type** — los 14 tipos OPM disponibles
3. **Edicion de states** — rename, initial/final/default toggles

---

## Feature B: Import .opmodel

**Mecanismo:** Boton ⇧ en header → file picker (`.opmodel`, `.json`) → `loadModel()` → si valida, remonta Editor con nuevo modelo.

**Archivos:**
- `App.tsx`: `onImport` callback, `<label>` con `<input type="file">` hidden
- App remonta Editor via `editorKey` incrementado

**Flujo:** File → `file.text()` → `loadModel(json)` → `isOk` → `onImport(model)` → Editor remount

---

## Feature C: Seleccion Manual de Link Type

**Mecanismo:** Dropdown en Toolbar visible cuando `mode === "addLink"`. Opciones: Auto + 14 tipos agrupados por categoria.

**Nuevo estado UI:** `linkType: LinkTypeChoice` en UIState (`"auto" | LinkType`)
**Nuevo command:** `setLinkType` → UITransition

**Auto-detect (cuando linkType === "auto"):**
- process → object = effect
- object → process = agent
- object → object = aggregation

**Manual:** Usa el tipo seleccionado directamente, sin inferencia.

**Archivos:**
- `lib/commands.ts`: +`LinkTypeChoice` type, +`setLinkType` command, +`updateState` command
- `hooks/useModelStore.ts`: +`linkType` en UIState
- `components/Toolbar.tsx`: dropdown con 14 tipos + Auto
- `components/OpdCanvas.tsx`: usa `linkType` prop en vez de hardcoded auto-detect
- `App.tsx`: pasa `linkType` a Toolbar y OpdCanvas

---

## Feature D: Edicion de States

**Mecanismo:** Cada state row en PropertiesPanel ahora tiene:
- Input editable para rename (inline, transparent border)
- Checkboxes I/F/D (initial, final, default)
- Boton × para remove

**Nuevo command:** `updateState` → ModelMutation via `updateState(m, stateId, patch)`

**Archivos:**
- `lib/commands.ts`: +`updateState` command + interpret case
- `components/PropertiesPanel.tsx`: nuevo `StateRow` component con inputs editables
- `App.css`: +`.props-panel__state-input`, +`.props-panel__state-flag` styles

---

## Command Algebra Final (16 commands)

| # | Command | Tipo | Nuevo |
|---|---------|------|-------|
| 1 | moveThing | ModelMutation | |
| 2 | resizeThing | ModelMutation | |
| 3 | renameThing | ModelMutation | |
| 4 | updateThingProps | ModelMutation | |
| 5 | addThing | ModelMutation | |
| 6 | removeThing | ModelMutation | |
| 7 | addLink | ModelMutation | |
| 8 | removeLink | ModelMutation | |
| 9 | addState | ModelMutation | |
| 10 | removeState | ModelMutation | |
| 11 | updateLink | ModelMutation | |
| 12 | **updateState** | ModelMutation | **C+D** |
| 13 | selectThing | UITransition | |
| 14 | selectOpd | UITransition | |
| 15 | setMode | UITransition | |
| 16 | **setLinkType** | UITransition | **C** |

---

## Otros cambios en esta sesion

### localStorage Persist (pre-B+C+D)
- Auto-save debounced (300ms) a `opmodel:current` en localStorage
- Load desde localStorage al iniciar, fallback a fetch coffee-making.opmodel
- Boton "+" (New Model), boton "☰" (Load Example)
- Commit: previo a b7277ca

### Light Theme + Essence Fix (pre-localStorage)
- Theme light "Blueprint" reemplaza dark "Drafting Table"
- Physical: 3.5px bold stroke + opaque fill
- Informatical: 1.2px thin stroke + transparent fill
- Fix: Delete/Backspace no borra things cuando foco esta en input
- Fix: Re-click thing no togglea seleccion (panel estable)

---

## Verificacion

- **TypeScript**: 0 errores
- **Tests**: 256/256 pasando (26 archivos)
- **Browser**: Todo verificado en localhost:5173

---

## Siguiente Paso Recomendado

**Multi-OPD (in-zoom/unfolding)** — La otra sesion ya agrego `refineThing` y `unfold` al core. El web editor necesita:
1. Click derecho / boton "Refine" en thing seleccionado
2. Navegacion OPD tree (click en SD1/SD2 cambia fibra)
3. Breadcrumb o back button para navegar la jerarquia
