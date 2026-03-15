# Handoff: Simulation In-Zoom + OPD Link Visibility

**Fecha:** 2026-03-15
**Sesion:** c8326d5b (continuacion)
**500 tests passing, 15+ commits**

---

## Resumen de lo implementado

### 1. In-Zoom Simulation Expansion (DA-5)
- `getExecutableProcesses()`: expande procesos in-zoomed en subprocesos leaf, ordenados por Y (ISO §14.2.1, §D.4)
- `runSimulation()` usa procesos expandidos en vez de iteracion plana
- `SimulationStep.parentProcessId` + `opdContext` para contexto jerarquico
- `SimulationPanel` muestra "Coffee Making > Grinding" en trace

### 2. Coffee Making Fixture (reconstruido desde 0)
- **SD**: Coffee Making + Barista (agent) + Coffee Beans (consumption) + Coffee (result). **Water NO aparece** (mecanismo interno)
- **SD1**: Grinding → Boiling → Brewing con dependencias causales estructurales
- `lnk-water-instrument-brewing`: Water[hot] → Brewing (dependencia causal, no Y-ordering)
- 0 links en proc-coffee-making (ISO §14.2.2.4.1)
- 0 modifiers (event modifier eliminado por contradiccion semantica)

### 3. resolveLinksForOpd (pullback pi*)
- Funcion pura en core: computa links visibles por OPD resolviendo endpoints a traves de contornos in-zoom
- Deduplicacion por (type, visualSource, visualTarget)
- Filtro de dependencias internas: enabling links con source_state producido por sibling subprocess se filtran del padre pero se muestran en el in-zoom
- OpdCanvas.tsx consume la funcion via useMemo

### 4. Bug fixes
- **SIM-BUG-01**: `completedProcesses` Set previene loop infinito de procesos sin precondiciones
- **Bug C**: target_state en result links para transicion Coffee→ready
- **Bug D**: Links padre eliminados (ISO §10.5.2)
- **ISO audit**: Effect link direction (kind-based detection), seccion reference corregida

### 5. Invariantes nuevos en backlog (L-M1-07)
- I-ENTITY-UNIQUENESS: Things y Links son entidades unicas
- I-LINK-VISIBILITY: Visibilidad por pullback pi*
- I-SD-INTERFACE: SD muestra solo interfaz externa
- I-INTERNAL-DEP-FILTER: Dependencias internas no se proyectan al padre
- I-17 exime procesos in-zoomed

## Artefactos

| Artefacto | Path |
|-----------|------|
| Spec resolveLinksForOpd | `docs/superpowers/specs/2026-03-15-resolve-links-for-opd-design.md` |
| Plan resolveLinksForOpd | `docs/superpowers/plans/2026-03-15-resolve-links-for-opd.md` |
| Backlog actualizado | `docs/superpowers/specs/2026-03-10-opm-modeling-app-backlog-lean.md` |
| Bug report (cerrado) | `sessions/2026-03-14-simulation-inzoom-bug-report.md` |

## Gaps pendientes (documentados en backlog L-M5-01)

| ID | Severidad | Descripcion |
|----|-----------|-------------|
| SIM-BUG-02 | CRITICAL | Invocation link no implementado como trigger |
| SIM-GAP-01 | Medium | Sin soporte para subprocesos paralelos (misma Y) |
| SIM-GAP-02 | Medium | Falta invariante I-EVENT-INZOOM-BOUNDARY |
| SIM-GAP-03 | Medium | Effect link encoding convention (source_state en target) |

## Next steps recomendados

1. **SIM-BUG-02**: Implementar invocation como semantica de control de flujo
2. **Visual**: Verificar SD muestra 3 links limpios (reimportar fixture en browser)
3. **Web tests**: OpdCanvas no tiene tests unitarios
4. **ISO audit follow-up**: Parallel subprocess support (SIM-GAP-01)
