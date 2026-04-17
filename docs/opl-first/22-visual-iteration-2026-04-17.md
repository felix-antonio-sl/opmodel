# Iteración visual JointJS — 2026-04-17

> Sesión de revisión visual fixture × OPD contra SSOT, con Playwright
> headless como mecanismo de verificación. 8 fixes estructurales aplicados
> al adapter JointJS sin romper las 4 leyes de ADR-003. 1279 tests verdes.

## Contexto

Tras T2 cerrado (`16f1436` + `44ca5e9`) el adapter JointJS ya generaba
diagramas SSOT-conformes en estructura, pero la inspección visual sobre
`/#/joint-sandbox` reveló problemas estéticos/legibilidad recurrentes en
los 6 fixtures × 20 OPDs:

- Labels truncados por curvatura de elipse (procesos en in-zoom).
- Label band fija a 22px en objetos con states truncaba nombres largos.
- Container labels solapados con edge labels de links entrantes.
- Layout circular ingenuo colapsa con >18 satélites (ev-ams/SD: 120 cells).
- Subprocess timeline sin gap suficiente para edge labels procedurales.

## Mecanismo de verificación: Playwright loop

`/tmp/sandbox-batch.mjs` itera todos los fixtures × OPDs y captura por
combinación:

- `svg.png` — screenshot del SVG completo (deviceScaleFactor=2).
- `spec.json` — `VisualRenderSpec` extraído del `<details><pre>`.
- `verifier.json` — issues VR-* del kernel.
- `dom-digest.json` — posición/tamaño de cada cell del paper.

Total: 20 capturas en `/tmp/sandbox-runs/<fixture>__<opd>/`.

Este loop es **reusable**: cada vez que se modifique el adapter o el
layout, basta con:

```bash
node /tmp/sandbox-batch.mjs
```

para regenerar las 20 capturas y validar visualmente.

## 8 fixes estructurales

Todos en `packages/web/src/lib/renderers/jointjs/`:

### Layout (`layout/opm-layout.ts`)

1. **State-aware sizing** (`objectBoxSize`)
   - Crece width/height del objeto para acomodar state strip + label band.
   - Soporta `maxWidth` budget que wrappea states a más filas cuando el
     espacio horizontal es limitado.
   - `MIN_LABEL_BAND=32` (≥2 líneas @13px Inter) para nombres largos.

2. **In-zoom container dinámico**
   - `CANVAS_H` crece según subprocess count + env band.
   - Subprocesos en 1 columna por defecto; 2 columnas cuando `count > 8`
     (preservando V-35 top→bottom dentro de cada columna).
   - `envBand` calculado a partir del alto real de los environmental
     objects (que pueden crecer por states).

3. **Subprocess sizing label-aware**
   - Cap subido de 240 → 300 px.
   - Margen +60 (no +36) por curvatura de elipse, mismo heurístico que
     mainProc. Corrige "Evaluación de Elegibilidad" truncado.

4. **`SUB_TIMELINE_GAP=44`** (antes 24)
   - Necesario para acomodar edge labels (event/condition/multiplicity)
     en flechas verticales del timeline.

5. **`envBand=envMaxH+32`** (antes +16)
   - Resuelve overlap del label de container con label del edge entrante
     desde environmental (caso `Driver Rescuing` con 'agent').

6. **Suppress redundant structural links** (in-zoom)
   - Cuando un edge `aggregation/exhibition/generalization/classification`
     conecta in-zoom child ↔ container parent, el embed JointJS ya
     expresa la relación → suprimir el link (V-69, §10.3).
   - `childToContainer` se construye desde `layoutResult.parentId`, NO
     desde `inZoomContainerOf` (que sólo está en el container).

7. **Root grid fallback** (`rootGridLayout`)
   - Activado cuando `others.length > 18`.
   - Banner main process arriba + grid escalable abajo.
   - Convierte ev-ams/SD (120 cells) de "ilegible" a "navegable".
   - `CANVAS_W=1280`, celdas `170×80`, gaps `24×28`.

### Shapes

8. **Object label anclado top** (`object-shape.ts`)
   - `y: 6, refY: null, textVerticalAnchor: "top"` (override total del
     `calc(0.5*h)` por defecto de `standard.Rectangle`).
   - `textWrap.height = max(32, h-36)` cuando `h > 60` (objeto creció por
     states): ≥2 líneas para labels largos en vez de 22px → 1 línea
     truncada.

9. **Container process label en top** (`process-shape.ts`)
   - Cuando `isContainer=true`, label en `y: 14, refY: null` para que
     subprocess timeline no lo cubra (§10.3/§10.4).
   - `isContainer = Boolean(node.inZoomContainerOf)` en el adapter.

## Verificación

- **Tests**: `bun run test` — 1279 pass / 0 fail / 2 todo.
- **4 leyes ADR-003**: verdes (no se introdujeron dependencias
  layout→semantics ni Model round-trips).
- **20 OPDs**: capturados con Playwright. Mejoras visibles vs baseline
  en hodom-v2/SD1, hospitalizacion-domiciliaria/SD, ev-ams/SD,
  hodom-hsc-v0/SD, driver-rescuing/SD1.

## Issues residuales (no abordados)

Ortogonales al layout — requieren routing custom de links:

- **Edge label collisions** en grafos densos (driver-rescuing/SD,
  hospitalizacion-domiciliaria/SD): múltiples links convergen sobre
  un nodo y sus labels apilados se solapan.
- **Markers cruzando elipses pequeñas** (hodom-v2/SD1 caso "Aceptación"):
  el marker de flecha cae dentro del nodo en vez de en el borde.
  Requiere configurar `connectionPoint: { name: 'boundary' }` o anchor
  custom en `procedural-link`.
- **Container con pocos hijos sigue grande** (ev-ams/SD1-2-1: 2
  subprocesos en container 1080×680). Mejora opcional: shrink-to-fit.

Estos quedan como deuda para una iteración visual futura, idealmente
junto con T4 (export final) cuando se cierre el loop kernel→layout.

## Commits

- `f10d9ac` — fix(web): JointJS layout — 8 fixes estructurales sobre 6
  fixtures × 20 OPDs.

## Reusabilidad del loop

`/tmp/sandbox-batch.mjs` queda como herramienta operativa para futuras
iteraciones visuales. Cada vez que se modifique el adapter o se añada
un fixture nuevo, ejecutar el batch + revisar `/tmp/sandbox-runs/` da
una baseline visual reproducible para evaluar regresiones.
