# Bugs Core-Visual

Detectados durante revisión visual del modelo HODOM HSC (2026-03-31).
Son bugs del **renderer/canvas**, no del fixture. Requieren cambios en `packages/web/src/`.

---

## CV-1 — Colisión de labels de links ✅ RESUELTO

**Severidad:** ALTA
**Commit:** `a8fc09b`

Cuando múltiples links pasan por la misma zona, sus labels se superponen y quedan ilegibles.
**Fix:** Labels que caen dentro de 50px horizontal / 20px vertical se redistribuyen con 14px de separación vertical.

---

## CV-2 — Ruteo de fan de generalización ✅ RESUELTO

**Severidad:** MEDIA
**Commit:** `01d116b`

Las líneas de generalización de N especializaciones convergen en un nudo cruzado.
**Fix:** Los triángulos escalan con el número de hijos (1.25x por hijo más allá de 3). Los puntos de origen se distribuyen a lo largo de la base del triángulo.

---

## CV-3 — Bundling de links paralelos ✅ RESUELTO

**Severidad:** ALTA
**Commit:** `a8fc09b`

Múltiples links al mismo target se dibujan encima, pareciendo una sola línea.
**Fix:** Links convergentes (3+ sources → mismo target) se curvan con offset proporcional. Spread adaptivo (15-30px según tamaño del grupo).

---

## CV-4 — Convergencia de ancla en links estructurales ✅ RESUELTO

**Severidad:** MEDIA
**Commit:** `01d116b`

Links de aggregation/exhibition convergen todos al mismo punto del borde del hijo.
**Fix:** Los endpoints de las ramas reciben nudge perpendicular (±4px por hijo) para distribuirse a lo largo del borde.

---

## CV-5 — Cruce de exhibition compartida ✅ RESUELTO

**Severidad:** MEDIA
**Commit:** `01d116b`

Cuando N objetos exhiben el mismo atributo, las líneas cruzan en estrella.
**Fix:** Misma solución que CV-4 — distribución de endpoints en forks estructurales.

---

## CV-6 — Posición de estados en unfold

**Severidad:** BAJA
**Estado:** DOCUMENTADO — sin fix inmediato

**Problema:** En diagramas unfold, los estados del objeto contenedor se renderizan dentro del contenedor (que es grande), quedando visualmente lejos del nombre del objeto.

**Razón:** El estado se renderiza correctamente dentro del ThingNode; el problema es que el ThingNode en unfold es grande por diseño. Cambiarlo requeriría un refactor del layout de contenedores unfold que impactaría todos los diagramas estructurales. Riesgo alto para beneficio bajo.

---

## Notas

- 5 de 6 bugs resueltos (2026-03-31)
- Los OPDs densos (SD1.4, SD1.6, SD2) deberían verse significativamente mejor
- CV-6 queda como mejora futura de baja prioridad
