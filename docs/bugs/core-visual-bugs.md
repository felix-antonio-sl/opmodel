# Core-Visual Bugs

Detectados durante revisión visual del modelo HODOM HSC (2026-03-31).
Estos bugs son del **renderer/canvas**, no del fixture. Requieren cambios en `packages/web/src/`.

---

## CV-1 — Link label collision ✅ FIXED

**Severidad:** ALTA
**Commit:** `a8fc09b`

Labels que caen dentro de 50px horizontal / 20px vertical se redistribuyen con 14px de separación vertical.

---

## CV-2 — Generalization fan routing ✅ FIXED

**Severidad:** MEDIA
**Commit:** `01d116b`

Triángulos de generalization/aggregation/exhibition ahora escalan con número de hijos (1.25x por hijo más allá de 3). Los branch origin points se distribuyen a lo largo de la base del triángulo.

---

## CV-3 — Parallel link bundling ✅ FIXED

**Severidad:** ALTA
**Commit:** `a8fc09b`

Links convergentes (3+ sources → mismo target) se curvan con offset proporcional. Spread adaptivo (15-30px según grupo).

---

## CV-4 — Structural link anchor convergence ✅ FIXED

**Severidad:** MEDIA
**Commit:** `01d116b`

Branch endpoints reciben nudge perpendicular (±4px por hijo) para que no converjan al mismo punto del borde.

---

## CV-5 — Shared-target exhibition routing ✅ FIXED

**Severidad:** MEDIA
**Commit:** `01d116b`

Misma solución que CV-4 — distribución de endpoints en forks estructurales.

---

## CV-6 — State placement in unfold

**Severidad:** BAJA
**Estado:** DOCUMENTED — no fix inmediato

**Problema:** En diagramas unfold, los estados del objeto contenedor se renderizan dentro del contenedor (que es grande), quedando visualmente lejos del nombre del objeto. En in-zoom esto no es un problema porque los contenedores son más compactos.

**Razón de no-fix:** El estado se renderiza correctamente dentro del ThingNode; el problema es que el ThingNode unfold es grande por diseño. Cambiar esto requeriría un refactor del layout de unfold containers que impactaría todos los diagramas estructurales. Riesgo alto para beneficio bajo.

---

## Notas de contexto

- 5 de 6 bugs resueltos (2026-03-31)
- Los OPDs densos (SD1.4, SD1.6, SD2) deberían verse significativamente mejor
- CV-6 queda como mejora futura de baja prioridad
