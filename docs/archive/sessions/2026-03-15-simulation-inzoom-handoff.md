# Handoff: Simulation In-Zoom + OPD Link Visibility + Canonical Coffee Making

**Fecha:** 2026-03-15
**Sesion:** c8326d5b (final)
**500 tests passing, 40 commits ahead of origin/master**

---

## Resumen de lo implementado

### 1. In-Zoom Simulation Expansion (DA-5)
- `getExecutableProcesses()`: expande procesos in-zoomed en subprocesos leaf, Y-ordering (ISO §14.2.1, §D.4)
- `runSimulation()` usa procesos expandidos, `completedProcesses` Set previene loop infinito (SIM-BUG-01)
- `SimulationStep.parentProcessId` + `opdContext` para contexto jerarquico
- `SimulationPanel` muestra "Coffee Making > Grinding" en trace

### 2. resolveLinksForOpd (pullback pi*)
- Funcion pura en core: computa links visibles por OPD resolviendo endpoints a traves de contornos in-zoom
- Deduplicacion por (type, visualSource, visualTarget)
- Filtro de dependencias internas:
  - Enabling links con source_state producido por sibling subprocess
  - Effect/result links sobre objetos consumidos por sibling subprocess
- Solo aplica a links agregados (no filtra links directos en el in-zoom OPD)
- OpdCanvas.tsx consume la funcion, usa visualSource/visualTarget para rendering
- State suppression: `suppressed_states` en Appearance respetado por ThingNode

### 3. Coffee Making Fixture (canonica, reconstruida 3 veces)

**SD (interfaz externa):**
- Barista handles Coffee Making (agent)
- Coffee Making consumes Coffee Beans (consumption)
- Coffee Making consumes Water (consumption — states suppressed)
- Coffee Making requires Coffee Machine (instrument)
- Coffee Making yields Coffee (result)

**SD1 (mecanismo interno):**
- Grinding: consumes Coffee Beans, yields Ground Coffee
- Boiling: effects Water cold->hot (Water persiste, cambia estado)
- Brewing: consumes Ground Coffee + consumes Water[hot] + yields Coffee[ready]
- Coffee Machine: instrument para los 3 subprocesos
- Barista: agent para los 3 subprocesos
- Water: estados expresados (cold, hot) — visible la mecanica

**Decisiones semanticas clave:**
- Water en SD SIN estados (state suppression ISO §14.2.1.1)
- Water en SD es consumida (no affected) — al nivel abstracto, water entra y no sale
- Boiling TRANSFORMA Water (effect, persiste) — no la consume
- Brewing CONSUME Water[hot] — deja de existir, se incorpora al cafe
- Effect link Boiling->Water filtrado del SD (Water consumida por sibling Brewing)
- I-16 permite consumption+result al mismo (process, object) — ciclo de transformacion

### 4. Invariantes nuevos en backlog (L-M1-07)
- I-ENTITY-UNIQUENESS: Things y Links son entidades unicas con ID
- I-LINK-VISIBILITY: Visibilidad por pullback pi*
- I-SD-INTERFACE: SD muestra solo interfaz externa (ISO §14.2.2.6.1.3)
- I-INTERNAL-DEP-FILTER: Dependencias internas no se proyectan al padre
- I-STATE-EXPRESSION-SUPPRESSION: Un fact a dos niveles de detalle (ISO §14.2.1.1 + §14.2.3)
- I-17 exime procesos in-zoomed (ISO §14.2.2.4.1)

### 5. ISO Audit (18 findings)
- 11 COMPLIANT, 5 DEVIATION, 1 NON-COMPLIANT (fixeado), 1 nuance
- Effect link direction: fixeado (kind-based detection)
- ISO section reference: corregido (§14.2.2.4.1)
- Gaps documentados en L-M5-01: SIM-BUG-01 (fixeado), SIM-BUG-02, SIM-GAP-01..03

### 6. Bug fixes
- SIM-BUG-01: completedProcesses previene loop infinito
- Bug C: target_state en result links
- Bug D: Links padre eliminados (ISO §14.2.2.4.1)

## Artefactos

| Artefacto | Path |
|-----------|------|
| Spec resolveLinksForOpd | `docs/superpowers/specs/2026-03-15-resolve-links-for-opd-design.md` |
| Plan resolveLinksForOpd | `docs/superpowers/plans/2026-03-15-resolve-links-for-opd.md` |
| Backlog actualizado | `docs/superpowers/specs/2026-03-10-opm-modeling-app-backlog-lean.md` |
| Bug report original | `sessions/2026-03-14-simulation-inzoom-bug-report.md` |

## Pendiente para proxima sesion

### PRIORITARIO: Auditoria visual OPM completa
El usuario proporciono ~20 laminas ISO de referencia visual (symbols, links, things, structural links, procedural links, event/condition fans, etc). Se requiere auditar nuestra app contra cada lamina:
- Rendering de arrows/markers (consumption dot, effect bidirectional, enabling filled/hollow)
- Colores por tipo de link
- Simbolos de things (rectángulo/elipse, stroke, fill, dash)
- Structural links (triangulos de aggregation/exhibition/generalization/classification)
- Control-modified links (event 'e', condition 'c')
- Link fans (XOR, OR, AND)
- Multiplicidad y cardinalidad
- State expression/suppression visual
Las laminas estan en `/Users/felixsanhueza/Downloads/` (OPM_*.png, OPM_*.jpg)

### Gaps pendientes (L-M5-01)
| ID | Severidad | Descripcion |
|----|-----------|-------------|
| SIM-BUG-02 | CRITICAL | Invocation link no implementado como trigger |
| SIM-GAP-01 | Medium | Sin soporte para subprocesos paralelos (misma Y) |
| SIM-GAP-02 | Medium | Falta invariante I-EVENT-INZOOM-BOUNDARY |
| SIM-GAP-03 | Medium | Effect link encoding convention |

### Brainstorming en pausa
- resolveLinksForOpd: implementado y funcionando
- Tasks pendientes del brainstorm (spec review, etc) completados implicitamente
