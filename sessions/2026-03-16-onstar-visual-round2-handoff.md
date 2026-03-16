# Session Handoff: OnStar Visual Audit Round 2 + Link Refinement Discovery

**Fecha:** 2026-03-16
**Tests:** 545 passing (37 files)
**Commits pendientes:** Sí — todos los cambios sin commit

## Resumen de Cambios

### 1. RESOLVE-01: Parent-level link filtering in resolveLinksForOpd
- **Archivo:** `packages/core/src/simulation.ts`
- **Fix:** En OPDs in-zoom, excluir links que tocan el container (`opd.refines`) y links donde ambos endpoints son `internal: false`
- **Precompute:** `containerThingId` + `internalThings` set antes del loop de links

### 2. VISUAL-03 Generalizado: Aggregated enabling link suppression
- **Archivo:** `packages/core/src/simulation.ts`
- **Fix original:** Suprimir aggregated instruments donde source es part de whole con link directo
- **Fix extendido (Rule 2):** Suprimir aggregated enabling links (agent/instrument) donde el source ya participa en cualquier link directo al mismo proceso
- **Fix dedup:** Preferir links directos sobre aggregated en la deduplicación por key
- **Post-filtro combinado:** Rule 1 (whole-part) + Rule 2 (direct participant)

### 3. Fixture: Effect → Consumption+Result
- **Archivo:** `tests/driver-rescuing.opmodel`
- **Cambio:** 2 effect links reemplazados por 4 consumption+result links (21→23 links)
  - `lnk-calltrans-effect-call` → `lnk-calltrans-consumption-call` + `lnk-calltrans-result-call`
  - `lnk-callhandling-effect-danger` → `lnk-callhandling-consumption-danger` + `lnk-callhandling-result-danger`
- **Tests actualizados:** Entity counts, OPL expectations, simulation step assertions, resolveLinksForOpd type checks

### 4. Fix Cosmético: Consumption+Result visual merge
- **Archivo:** `packages/web/src/components/OpdCanvas.tsx`
- **Fix:** En `visibleLinks` useMemo, detectar pares consumption+result sobre el mismo (object, process) y fusionarlos en un solo link visual tipo effect con label "fromState → toState" y flechas bidireccionales
- **labelOverride** ya existía como prop en LinkLine — solo se conectó

### 5. Spec Draft: DA-7 Link Refinement Fibration
- **Archivo:** `docs/superpowers/specs/2026-03-16-link-refinement-fibration.md`
- **Contenido:** Análisis categórico de la dualidad effect ↔ consumption+result como refinamiento de links, 3 opciones de diseño, recomendación Opción A

### 6. Cleanup: `internallyProducedStates` removido
- Ya no se usa tras la generalización del filtro de enabling links

## Archivos Modificados

| Archivo | Acción |
|---------|--------|
| `packages/core/src/simulation.ts` | RESOLVE-01, VISUAL-03 generalizado, dedup fix, cleanup |
| `packages/core/tests/driver-rescuing.test.ts` | 30 tests (entity counts, OPL, sim, resolveLinksForOpd) |
| `tests/driver-rescuing.opmodel` | Effect → consumption+result (21→23 links) |
| `packages/web/src/components/OpdCanvas.tsx` | Consumption+result visual merge |
| `docs/superpowers/specs/2026-03-16-link-refinement-fibration.md` | NUEVO — DA-7 spec draft |

## Estado Visual Verificado

- **SD**: OnStar System como único instrument, OnStar Advisor como agent, effect a Driver, 4 aggregations, tagged link. Sin instruments duplicados, sin agent resuelto de Driver.
- **SD1**: Sin links padre-nivel (container/external). Consumption+result fusionados visualmente como "requested → online" y "endangered → safe".

## Próximos Pasos

1. **Commit** estos cambios
2. **DA-7 formal**: Decidir Opción A vs B para data model Rev.4
3. **P1 Issues pendientes:**
   - VISUAL-04: Link labels → ISO graphical markers (alto esfuerzo)
   - GAP-OPL-02..06: OPL gaps menores
4. **P2 Deferred:**
   - C-05: Fork point triangle
   - INCONSISTENCY-01: Aggregation direction
