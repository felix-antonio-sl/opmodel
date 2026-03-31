# Core-Visual Bugs

Detectados durante revisión visual del modelo HODOM HSC (2026-03-31).
Estos bugs son del **renderer/canvas**, no del fixture. Requieren cambios en `packages/web/src/`.

---

## CV-1 — Link label collision

**Severidad:** ALTA
**Dónde:** SD1.2, SD1.4, SD1.6 — cualquier OPD con >10 links visibles

**Problema:** Cuando múltiples links pasan por la misma zona, sus labels ("agent", "instrument", "result", etc.) se dibujan superpuestos y quedan ilegibles. No hay collision avoidance.

**Esperado:** Labels deberían desplazarse para evitar solapamiento, o agruparse cuando son del mismo tipo al mismo target.

---

## CV-2 — Generalization fan routing

**Severidad:** MEDIA
**Dónde:** SD8, SD1.6

**Problema:** Las líneas de generalization de N especializaciones convergen todas en un punto central formando un nudo cruzado. El fan (triángulo) debería distribuir las líneas, pero el routing no las separa.

**Esperado:** Las líneas deberían llegar al triángulo de generalization desde posiciones distribuidas, sin cruzarse entre sí.

---

## CV-3 — Parallel link bundling

**Severidad:** ALTA
**Dónde:** SD1.6, SD2

**Problema:** Cuando múltiples procesos tienen links al mismo objeto target (ej: 5 tipos de discharge → Hospitalization Status, 5 tipos de discharge → Epicrisis), las líneas se dibujan exactamente encima unas de otras. Visualmente parece una sola línea gruesa y no se puede distinguir el origen.

**Esperado:** Links paralelos al mismo target deberían separarse con un offset visual (bundling o spacing), o converger en un fan visible.

---

## CV-4 — Structural link anchor convergence

**Severidad:** MEDIA
**Dónde:** SD4

**Problema:** Las líneas de aggregation y exhibition convergen todas en un punto sobre un objeto que no es el padre real. Parece que el renderer conecta los structural links al centro del primer objeto que encuentra en la dirección, en vez del padre correcto de la relación.

**Esperado:** Cada aggregation link debe anclar al borde del objeto padre (Medical Equipment), distribuidos a lo largo del borde.

---

## CV-5 — Shared-target exhibition routing

**Severidad:** MEDIA
**Dónde:** SD7, SD2

**Problema:** Cuando N objetos exhiben el mismo atributo (ej: 7 miembros del equipo exhiben Clinical Experience o BLS Certification), las exhibition lines cruzan en estrella porque todas van al mismo target desde distintas posiciones.

**Esperado:** El renderer debería agrupar exhibition links al mismo target, o rutear las líneas para minimizar cruces (ej: canal vertical compartido).

---

## CV-6 — State placement in unfold

**Severidad:** BAJA
**Dónde:** SD8

**Problema:** Los estados de un objeto (ej: `absent`/`present` de Exclusion Condition) se renderizan lejos de su objeto padre en diagramas de tipo unfold. En un in-zoom, los estados aparecen dentro o junto al objeto; en unfold quedan flotando.

**Esperado:** Los estados deberían mantenerse cerca de su objeto padre independientemente del tipo de refinamiento.

---

## Notas de contexto

- Archivo de referencia visual: `packages/web/src/` (renderer SVG)
- Los bugs **no bloquean** el uso del modelo, pero degradan legibilidad en OPDs densos (>15 entidades)
- Los OPDs simples (SD, SD1.2, SD1.3, SD4) se ven bien; los densos (SD1.4, SD1.6, SD2) son los más afectados
- **Prioridad sugerida:** CV-1 > CV-3 > CV-2 > CV-5 > CV-4 > CV-6
