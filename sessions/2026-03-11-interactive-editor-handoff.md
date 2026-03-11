# Handoff: Interactive OPM Editor (Frontend Coupling)

**Fecha:** 2026-03-11
**Branch:** master
**Commit:** 2f9d4f1

---

## Artefactos Producidos

### Codigo Nuevo/Modificado (`packages/web/`)

| Archivo | Accion | Responsabilidad |
|---------|--------|-----------------|
| `src/lib/commands.ts` | Creado | Command Algebra (sum type) + interpret η: Command → Effect |
| `src/hooks/useModelStore.ts` | Creado | Store Comonad: History<Model> × UIState, dispatch, undo/redo |
| `src/App.tsx` | Reescrito | Split App/Editor, undo/redo buttons+shortcuts, dispatch wiring |
| `src/components/OpdCanvas.tsx` | Reescrito | Drag things, inline rename, link re-routing, selection |
| `src/App.css` | Modificado | +82 lineas: header actions, inline-rename, drag, status bar |
| `src/lib/opl.ts` | Fix | Removido case `instantiation` (no existe en LinkType) |

### Fixes durante implementacion

| Fix | Causa |
|-----|-------|
| `model.meta.schema_version` → `model.opmodel` | Meta no tiene schema_version, la version esta en opmodel |
| Removido `instantiation` de LINK_COLORS y OPL switch | LinkType solo tiene 14 tipos, instantiation no es uno |

---

## Arquitectura Categorica Implementada

### Store Comonad: `AppState = History<Model> × UIState`

```
History<Model>  ←  domain mutations (undoable, structural sharing)
UIState         ←  ephemeral (selection, OPD, never in undo stack)
```

### Command Algebra (Coproducto Discriminado)

| Command | Tipo | Fiber |
|---------|------|-------|
| `moveThing` | ModelMutation | Geometric (appearance) |
| `resizeThing` | ModelMutation | Geometric (appearance) |
| `renameThing` | ModelMutation | Edit (thing.name) |
| `updateThingProps` | ModelMutation | Edit (thing patch) |
| `addThing` | ModelMutation | Structural (thing + appearance) |
| `removeThing` | ModelMutation | Structural |
| `addLink` | ModelMutation | Structural (link) |
| `removeLink` | ModelMutation | Structural |
| `selectThing` | UITransition | Navigation |
| `selectOpd` | UITransition | Navigation |

### Natural Transformation η: `interpret: Command → Effect`

```typescript
Effect = ModelMutation { apply: Model → Result<Model, InvariantError> }
       | UITransition  { field: "selectedThing" | "currentOpd", value }
```

### Dispatch (Single Coupling Function)

```
Command → interpret → Effect → {
  ModelMutation: apply(present) → pushHistory → re-render
  UITransition: setUi(field, value) → re-render
}
```

### Rendering Functor (Fiber-Preserving)

El canvas renderiza una fibra del OPD fibration a la vez:
- `appearances.filter(opd === currentOpd)` → fiber π⁻¹(opdId)
- Links visibles = ambos endpoints en la fibra

---

## Features Interactivas Implementadas

| Feature | Mecanismo | Detalles |
|---------|-----------|----------|
| **Drag things** | Visual delta durante drag, `moveThing` en drop | Links se re-enrutan en real-time via `getEffectiveRect` |
| **Inline rename** | Double-click → foreignObject input | Commit en Enter/blur, cancel en Escape |
| **Undo/Redo** | Cmd+Z / Cmd+Shift+Z + header buttons | History coalgebra push/undo/redo |
| **Selection** | Click thing → amber glow filter | Click canvas → deselect |
| **Pan** | Drag canvas background | State: panStart + pan offset |
| **Zoom** | Scroll wheel | 0.3x — 3x range |
| **Link re-routing** | `getEffectiveRect` usa drag delta | Links apuntan a posicion visual durante drag |
| **OPL sync** | Inmutable Model re-render | Rename propaga a OPL panel automaticamente |
| **Tree sync** | Inmutable Model re-render | Rename propaga a Things in View automaticamente |

### Patron de Drag (Clave de Diseno)

```
mousedown → setDragTarget(id), setDragOrigin(clientXY)
mousemove → setDragDelta((clientXY - origin) / zoom)  [visual only]
mouseup   → dispatch(moveThing, app.x + delta.x, app.y + delta.y)  [single mutation]
```

- Durante el drag, el modelo NO se muta
- Solo un `updateAppearance` al soltar (satisface GetPut/PutGet del appearance lens)
- Links se recalculan visualmente via `getEffectiveRect` que suma el delta

---

## Verificacion

- **TypeScript**: 0 errores (`bunx tsc --noEmit`)
- **Tests core**: 216/216 pasando (`bunx vitest run`)
- **Browser**: Verificado drag, rename, undo, selection, pan, zoom en Chrome
- **GIF**: `opmodeling-interactive-editor.gif` descargado con secuencia completa

---

## Estado del Web Package

| Componente | Estado |
|------------|--------|
| Model loading (fetch + loadModel) | Completo |
| OPD Tree panel | Completo (navigation + thing list) |
| OPD Canvas | Interactivo (drag, rename, select, pan, zoom) |
| OPL Panel | Read-only (auto-sync via Model) |
| Command Algebra | 10 commands definidos |
| History integration | Completo (undo/redo) |
| Status bar | Completo (valid/errors, counts, hints) |

---

## Siguiente Paso Recomendado

1. **Mas commands**: addThing desde canvas (click derecho / toolbar), removeLink, addLink (drag entre things)
2. **Properties panel**: Editar kind, essence, affiliation del thing seleccionado
3. **State editing**: Add/remove/rename states inline
4. **OPD navigation**: Click en SD1 en tree para cambiar fibra renderizada
5. **Persist**: Export model editado como JSON (.opmodel download)

---

## Runtime

- Bun v1.3.10 en `~/.bun/bin/bun`
- Dev server: `cd packages/web && bun run dev` (Vite, localhost:5173)
- Tests: `bunx vitest run` (desde raiz del proyecto)
- Type check: `cd packages/web && bunx tsc --noEmit`
- 216 tests, 23 archivos, 6 archivos web modificados
