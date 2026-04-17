# Triad Summary — Phase 1

Fecha: 2026-03-29
Proyecto: `/home/felix/projects/opmodel`
Participantes:
- Allan Kelly
- steipete
- Clawforge

## Objetivo de esta fase
Ejecutar una primera prueba real de trabajo en triada sobre OPModel, distinguiendo:
- valor e intención
- evidencia técnica del repo vivo
- lectura operacional y siguiente movimiento correcto

---

## 1. Allan Kelly — contrato de intención
Allan fijó el contrato de valor para la siguiente fase:
- convertir OPModel de workbench OPM sofisticado en superficie operativa estable
- orientar el producto a 3 flujos reales:
  - **as-is**
  - **to-be**
  - **proyecto nuevo**
- cerrar baseline técnica antes de expandir capacidades
- exigir una eval mínima basada en 3 casos reales y handoff utilizable

Punto central de Allan:
> El riesgo principal no es falta de sofisticación, sino seguir sofisticando un laboratorio que todavía no está cerrado como herramienta principal confiable.

---

## 2. steipete — evidencia técnica del repo vivo

### Corte 1 — topología real
Hallazgos principales:
- monorepo con cuatro paquetes vivos: `core`, `cli`, `nl`, `web`
- `core` es la fuente de verdad semántica
- `web`, `cli` y `nl` operan como superficies/adaptadores sobre `core`
- la raíz del repo agrupa el workspace, pero no aparece como superficie operativa integrada fuerte

### Corte 2 — semántica del dominio real
Hallazgos principales:
- el núcleo del sistema es más rico de lo que sugiere una lectura superficial
- el modelo efectivo es un grafo tipado en memoria con `Map`s
- el core mezcla:
  - semántica del dominio
  - representación visual
  - restricciones metodológicas
  - validación
  - escenarios y requisitos
- las mutaciones y validaciones no son CRUD trivial; contienen reglas duras e invariantes reales

### Corte 3 — estado operativo actual real
Hallazgos principales:
- existe runner de tests a nivel raíz, pero no runner operativo unificado del monorepo
- `bun run test` falla antes de ejecutar la suite por choque ESM/CJS entre Vitest y Vite
- el build web falla por errores TypeScript en `core` y `web`
- el dev local falla por permisos en cache `.vite`
- hay evidencia de deuda y drift entre narrativa de estabilidad y estado ejecutable observable

Conclusión técnica de steipete:
> OPModel tiene un núcleo serio y valioso, pero su baseline operativa actual no está cerrada.

---

## 3. Clawforge — arbitraje operacional

## Veredicto operacional
OPModel hoy no está en condición de herramienta principal estable.

Sí puede describirse como:
- workbench potente
- núcleo semántico serio
- arquitectura con valor real

Pero aún presenta bloqueos operativos de primer orden:
- runner canónico de tests no confiable
- build web roto
- entorno dev contaminado por permisos
- falta de superficie operativa integrada del monorepo
- desalineación probable entre docs y estado real

## Blast radius actual
Intentar seguir expandiendo features sobre esta base arriesga:
- aumentar deuda de tooling
- agrandar drift entre documentación y ejecución
- reforzar complejidad visual/metodológica sin mejorar usabilidad real
- retrasar validación con casos del operador

## Ruta recomendada de fase siguiente
### Fase 1A — baseline stabilization
Orden mínimo sugerido:
1. reparar runner canónico de tests
2. dejar build web en verde
3. limpiar permisos/caches del entorno local
4. reducir drift entre relato/documentación y estado real

### Fase 1B — validación por uso real
Solo después de estabilizar baseline:
1. correr un caso **as-is**
2. correr un caso **to-be**
3. correr un caso **proyecto nuevo**
4. exigir artefacto de salida utilizable para handoff técnico y revisión operacional

---

## Criterio de cierre de esta primera prueba de triada
La prueba se considera lograda porque se cumplió la secuencia correcta:
1. **Allan Kelly** definió el contrato de intención y la eval mínima
2. **steipete** produjo arqueología técnica real sobre el repo vivo
3. **Clawforge** integró la evidencia y fijó el siguiente movimiento operacional correcto

---

## Estado final de la fase
Estado: **completada la primera prueba de trabajo en triada**

Resultado neto:
- existe contrato de valor
- existe evidencia técnica real
- existe veredicto operacional
- existe siguiente fase clara

Siguiente paso recomendado:
> abrir una fase explícita de **baseline stabilization** dentro de `opmodel`, sin expansión de superficie, y usar esta carpeta `docs/triad/` como memoria de coordinación del proyecto.
