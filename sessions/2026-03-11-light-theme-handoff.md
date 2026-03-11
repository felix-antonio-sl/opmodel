# Handoff: Light Theme + Essence Distinction + Panel Fix

**Fecha:** 2026-03-11
**Branch:** master
**Commit:** 2169a2c

---

## Cambios Realizados

### 1. Theme Light ("Blueprint")
Reemplazo completo del theme dark "Drafting Table" por theme light:

| Variable | Dark (antes) | Light (ahora) |
|----------|-------------|---------------|
| `--bg-deep` | `#0b0d13` | `#f4f5f7` |
| `--bg-panel` | `#111420` | `#ffffff` |
| `--bg-canvas` | `#0e1018` | `#f0f1f4` |
| `--text-primary` | `#dce0ea` | `#1a1d26` |
| `--accent` | `#c8973e` (brass) | `#2b6cb0` (blue) |
| `--object-stroke` | `#5b8fd9` | `#2b6cb0` |
| `--process-stroke` | `#3fae96` | `#16794a` |

Nuevas variables para esencia:
- `--object-fill-physical` / `--process-fill-physical`: fill opaco para physical

### 2. Distincion Physical vs Informatical (ISO 19450)

| Esencia | strokeWidth | Fill |
|---------|------------|------|
| Physical | **3.5px** (bold) | `*-fill-physical` (opaco 10%) |
| Informatical | **1.2px** (thin) | `*-fill` (transparente 4%) |

Diferencia visual clara e inmediata, fiel al estandar OPM.

### 3. Fix: Panel Properties Parpadeaba

**Causa 1 — Delete/Backspace**: El handler global de keyboard (App.tsx) ejecutaba `removeThing` al presionar Delete/Backspace sin verificar si el foco estaba en un input. Escribir en el campo Name y presionar Backspace eliminaba el thing, destruyendo el panel.

**Fix**: Filtrar `target.tagName === "INPUT" | "SELECT" | "TEXTAREA"` antes de despachar removeThing.

**Causa 2 — Toggle selection**: Click en thing seleccionado toggleaba la seleccion a null, ocultando el Properties Panel. Re-click para editar propiedades deseleccionaba.

**Fix**: `selectThing(thingId)` siempre (idempotente). Deseleccionar solo al click en fondo del canvas.

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/App.css` | Theme light completo, nuevas variables `*-fill-physical` |
| `src/App.tsx` | Guard en Delete/Backspace handler (filtrar inputs) |
| `src/components/OpdCanvas.tsx` | Colores light en LINK_COLORS, SvgDefs markers, glow filters, logica de fill por esencia, fix toggle selection |

---

## Estado Completo del Proyecto

- **56 archivos**, ~7150 LOC, **232 tests**
- **3 packages**: core (Domain Engine), cli (opmod), web (editor interactivo)
- Modeling loop completo: crear/editar/conectar/eliminar things, states, links
- Theme light con distincion visual OPM fiel al estandar

## Siguiente Paso Recomendado

1. **localStorage persist** — auto-save/load, hacer el editor usable sin import/export manual
2. **Multi-OPD (in-zoom/unfolding)** — diagramas jerarquicos, fibracion OPD
