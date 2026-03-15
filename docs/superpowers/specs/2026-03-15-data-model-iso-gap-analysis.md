# Auditoría de Modelo de Datos vs ISO 19450

**Fecha:** 2026-03-15
**Fuente:** `/Users/felixsanhueza/Developer/kora/source/opm/opm-iso.md` (ISO/PAS 19450 completo)
**Target:** `packages/core/src/types.ts` (268 LOC, 14 interfaces, 30 type aliases)

---

## Veredicto

**El modelo de datos es notablemente completo.** 0 gaps CRITICAL. 3 MEDIUM. 11 LOW. 2 VERY LOW.

- 14/14 link types base presentes
- 4/4 structural relations presentes
- event/condition modifiers con negated + condition_mode — cobertura completa
- State-specified variants via source_state/target_state — cobertura completa
- Tagged structural links con direction (uni/bi/reciprocal) — presente

---

## Gap Table

| # | Concepto ISO | Sección | Estado | Severidad | Notas |
|---|---|---|---|---|---|
| G-01 | Duration Distribution (función probabilística) | §9.5.4.1, Annex D | **Missing** | Medium | `Duration` tiene nominal/min/max pero no distribution name/params |
| G-02 | Current state en Thing (no en State) | C.5, C.7 | **Wrong location** | Low | `State.current` existe pero ISO pone `current_state` en el object. Conocido como O-01 |
| G-03 | Default tag para null-tagged links | §10.2.2, §10.2.4 | **Missing** | Low | "relates to" / "are related" defaults no enforced |
| G-04 | Fan convergent/divergent property | §12.2-12.3 | **Missing** | Medium | Fan no tiene dirección; Tables 17-21 definen semánticas distintas |
| G-05 | Fan.members semántica | §12.2 | **Unclear** | Low | ISO fans agrupan *links*; nuestros `members` no clarifican si son link IDs |
| G-06 | Probabilistic fan sum=1 invariant | §12.7 | **Missing invariant** | Low | `Link.probability` existe pero no hay constraint de suma en Fan |
| G-07 | Multiplicity parameters como entidades globales | §11.2 | **Missing** | Low | ISO dice que params son únicos por modelo; no hay entidad |
| G-08 | Per-member multiplicity en Fan | §11.1 | **Missing** | Low | Fan members sin multiplicidad individual |
| G-09 | Incomplete marker en Fan (no Link) | §10.3.2 | **Misplaced** | Low | `Link.incomplete` existe pero incomplete es propiedad del triángulo/fan |
| G-10 | Unfolding kind distinction | §14.2.1.2 | **Partial** | Low | "unfold" colapsa 4 tipos ISO (agg/exh/gen/cls) |
| G-11 | Appearance.is_refined (contorno grueso) | §14.2.1.3 | **Missing** | Low | Rendering hint para things con refinement OPDs |
| G-12 | State-Specific Object (concepto derivado) | C.5-C.6 | **Not modeled** | Very Low | Concepto derivado/view, no entidad de primera clase |
| G-13 | OPD tier number | §14.2.2.6.1.3 | **Missing** | Very Low | Computable desde parent_opd chain |
| G-14 | Link precedence order (fuerza semántica) | §14.2.4 | **Missing** | Low | Algorítmico, no un tipo — necesario para out-zoom automation |
| G-16 | Split state-specified transforming links | §14.2.2.4.3 | **No explicit type** | Low | Representable con links separados pero sin marker "split" |
| G-17 | Link distribution flag (contorno in-zoom) | §14.2.2.4.1 | **Missing** | Medium | No hay forma de marcar link como "distribuido" a todos los subprocesos |
| G-18 | Object in-zoom vs Process in-zoom | §14.2.1.3 | **Partial** | Low | `refines` apunta a thing pero `refinement_type` no distingue obj vs proc |

---

## Los 3 Gaps Medium

### G-01: Duration Distribution
ISO §9.5.4.1 define Duration con distribución probabilística (normal, exponential, uniform, etc.) con parámetros nombrados.
```typescript
// Fix propuesto:
interface Duration {
  nominal: number;
  min?: number;
  max?: number;
  unit: TimeUnit;
  distribution?: { name: string; params: Record<string, number> }; // NEW
}
```

### G-04: Fan Convergence/Divergence
ISO Tables 17-21 definen semánticas distintas para fans convergentes vs divergentes. Un fan XOR convergente (B triggers one of P/Q/R) es distinto de un XOR divergente (P produces one of s1/s2/s3).
```typescript
// Fix propuesto:
interface Fan {
  id: string;
  type: FanType;
  direction?: "converging" | "diverging"; // NEW
  members: string[]; // should be link IDs per ISO
}
```

### G-17: Link Distribution Flag
Cuando un link se conecta al contorno de un proceso in-zoomed, ISO dice que se "distribuye" a todos los subprocesos. No hay forma de distinguir esto de un link que apunta a un subproceso específico.
```typescript
// Fix propuesto (en Link o Appearance):
distributed?: boolean; // ISO §14.2.2.4.1: link targets parent contour, applies to all subprocesses
```

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
| Fans | xor, or, and | xor, or, and | 100% (falta convergence) |
| Duration | nominal + distribution | nominal + min/max | ~80% |
