# Auditoría de Modelo de Datos vs ISO 19450

**Fecha:** 2026-03-15 (actualizado mismo día)
**Fuente:** `/Users/felixsanhueza/Developer/kora/source/opm/opm-iso.md` (ISO/PAS 19450 completo)
**Target:** `packages/core/src/types.ts`

---

## Veredicto

**El modelo de datos es notablemente completo.** De 16 gaps originales, **9 cerrados** en esta sesión.

| Severidad | Original | Actual |
|-----------|----------|--------|
| Critical  | 0        | 0      |
| Medium    | 3        | **0** (3 cerrados) |
| Low       | 11       | **5** (4 cerrados + 2 by design) |
| Very Low  | 2        | 2      |
| **Total** | **16**   | **7**  |

Cobertura fundamental: 14/14 link types, 4/4 structural relations, event/condition modifiers completos, state-specified variants completas, tagged links con direction.

---

## Gap Table

### CLOSED (9 gaps)

| # | Concepto ISO | Sección | Resolución | Commit |
|---|---|---|---|---|
| G-01 | Duration Distribution | §9.5.4.1 | `Duration.distribution?: {name, params}` añadido | `2e7ca6f` |
| G-03 | Default tag null-tagged links | §10.2.2, §10.2.4 | OPL render usa "relates to" (uni/bi), "are related" (reciprocal) | `905e4e1` |
| G-04 | Fan convergent/divergent | §12.2-12.3 | `Fan.direction?: "converging"\|"diverging"` añadido | `2e7ca6f` |
| G-05 | Fan.members semántica | §12.2 | Comentario clarificado: `// link IDs grouped by this fan` | `2e7ca6f` |
| G-06 | Probabilistic fan sum=1 | §12.7 | Invariante `I-FAN-PROB` en validate() | `905e4e1` |
| G-08 | Per-member multiplicity | §11.1 | `Fan.member_multiplicities?: Record<string, string>` | `905e4e1` |
| G-09 | Incomplete en Fan | §10.3.2 | `Fan.incomplete?: boolean` añadido | `905e4e1` |
| G-10 | Unfolding kind distinction | §14.2.1.2 | **Cerrado by design**: tipo inferible de structural link que conecta el thing refinado |
| G-16 | Split state-specified links | §14.2.2.4.3 | **Cerrado by design**: representable con `input` + `output` link types |
| G-17 | Link distribution flag | §14.2.2.4.1 | `Link.distributed?: boolean` añadido | `2e7ca6f` |

### OPEN — 7 gaps restantes

| # | Concepto ISO | Sección | Severidad | Estado | Estrategia de cierre |
|---|---|---|---|---|---|
| G-02 | Current state en Thing (no en State) | C.5, C.7 | Low | **Wrong location** | Refactor cross-cutting: migrar `State.current` → `Thing.current_state?: string`. Toca api.ts (3 funciones), 6+ tests, OpdCanvas, CLI format, serialization. Conocido como **O-01**. Requiere sesión TDD dedicada. |
| G-07 | Multiplicity parameters como entidades globales | §11.2 | Low | **Missing** | ISO dice "parameter names shall be unique for the entire system model". Requiere nueva entidad `MultiplicityParam { id, name, value }` en Model + invariante de unicidad. Sin caso de uso activo — diferir hasta que multiplicity rendering esté implementado. |
| G-11 | Appearance.is_refined (contorno grueso) | §14.2.1.3 | Low | **Missing** | Rendering hint para dibujar contorno grueso en things que tienen OPDs de refinamiento. **Derivable**: `model.opds.values().some(o => o.refines === thingId)`. Implementar como función helper en OpdCanvas, no como campo persistido. |
| G-14 | Link precedence order (fuerza semántica) | §14.2.4 | Low | **Missing** | ISO define un ordering de "fuerza" entre link types para resolver conflictos al hacer out-zoom: `effect > consumption > result > agent > instrument`. Es algorítmico (función utilitaria), no un tipo. Implementar como `linkPrecedence(type: LinkType): number` cuando se implemente out-zoom automation. |
| G-18 | Object in-zoom vs Process in-zoom | §14.2.1.3 | Low | **Partial** | `refinement_type` no distingue obj vs proc in-zoom. **Derivable**: el kind del thing referenciado por `opd.refines` determina si es object o process in-zoom. No requiere campo nuevo — implementar como función: `isObjectInZoom(model, opdId) => model.things.get(opd.refines)?.kind === "object"`. |
| G-12 | State-Specific Object (concepto derivado) | C.5-C.6 | Very Low | **Not modeled** | Concepto view/derivado: "Designed Product" = Product at state designed. No es entidad de primera clase en ningún tool OPM conocido. Es una convención de naming en OPL, no una entidad persistida. **No requiere acción**. |
| G-13 | OPD tier number | §14.2.2.6.1.3 | Very Low | **Missing** | Computable: `function opdTier(model, opdId): number` contando ancestros via `parent_opd` chain. SD = tier 0, SDn = tier n. **No requiere campo** — implementar como helper cuando se necesite para OPD labels. |

---

## Estadísticas

| Categoría | ISO | Nosotros | Cobertura |
|---|---|---|---|
| Link types base | 14 | 14 | 100% |
| Link modifiers | event, condition | event, condition + negated + condition_mode | 100% |
| Structural relations | 4 + tagged | 4 + tagged con direction | 100% |
| State designations | initial, final, default, current | Todas | 100% |
| Thing properties | perseverance, essence, affiliation | Todas | 100% |
| State-specified variants | ~12 combinaciones | via source_state/target_state | 100% |
| Fans | xor, or, and | xor, or, and + direction + incomplete + member_multiplicities | 100% |
| Duration | nominal + distribution | nominal + min/max + distribution | 100% |
| Fan invariants | probability sum=1 | I-FAN-PROB in validate() | 100% |
| Tagged link OPL | 3 direction variants + defaults | uni/bi/reciprocal + "relates to"/"are related" defaults | 100% |
