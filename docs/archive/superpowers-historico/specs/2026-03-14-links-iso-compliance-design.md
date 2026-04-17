# Links ISO 19450 Compliance — Design Spec

**Fecha:** 2026-03-14
**Prerequisito:** ISO Gap Analysis (`2026-03-13-iso-gap-analysis.md`), C2+C3 ya implementados
**Scope:** Cerrar gaps de links identificados en auditoría ISO 19450 vs implementación actual

---

## 1. Contexto

La auditoría de links contra ISO 19450 (`opm-iso.md`) reveló 13 gaps. Este spec cubre los 7 que son accionables en este ciclo (2 críticos + 5 importantes). Los 6 restantes (menores) se difieren a P2+.

### Gaps cubiertos

| ID | Nombre | Severidad | ISO Clause |
|----|--------|-----------|------------|
| **C7** | I-27 Exhibition perseverance — BUG | CRITICAL | §7.2.2 |
| **C8** | Procedural link endpoint type validation | CRITICAL | §6.1-§6.3 |
| **I15** | Enabling link uniqueness per (object, process) | IMPORTANT | §8.1.2 |
| **I16** | Structural invariants (I-22..I-27) enforcement in addLink | IMPORTANT | §7.2 |
| **I17** | State-specified link validation (I-28) in addLink | IMPORTANT | §9.3 |
| **I18** | Self-loop prevention (except invocation) | IMPORTANT | §8.5, §6.1 |
| **I5-ext** | Exception link subtype (overtime/undertime) | IMPORTANT | §9.5.4 |

### Gaps diferidos

| ID | Razón de diferimiento |
|----|----------------------|
| M-01 (tagged validation) | Ya cubierto parcialmente por M6/M7; requiere UI work |
| M-02 (multiplicity format) | Ya cubierto por I12 existente |
| M-03 (probability sum) | Ya cubierto por U3; requiere fan-level validation |
| M-04 (input/output pairing) | Design decision deliberada; no es bug |
| M-05 (OPL structural grouping) | OPL enhancement, no invariant |
| I-05 (distribution) | Ya cubierto por C6 existente; requiere refinement engine |

---

## 2. Gap C7: I-27 Exhibition Perseverance — BUG FIX

### 2.1 Problema

**ISO §7.2.2** establece que exhibition-characterization es la **excepción explícita** a la regla de perseverancia:

> "The refinee destination things shall all have the same Perseverance value as the refineable source thing [...] **except for exhibition-characterization**, where an object may exhibit process features (operations) and a process may exhibit object features (attributes)."

**Implementación actual** (`api.ts:1316-1324`):
```typescript
// I-27: Exhibition - features must have same perseverance as exhibitor
if (exhibitor && feature && exhibitor.kind !== feature.kind) {
  errors.push({ code: "I-27", ... });
}
```

Esto **rechaza modelos válidos** donde un objeto exhibe operations (procesos) o un proceso exhibe attributes (objetos).

### 2.2 Justificación categórica

Exhibition-characterization es un **profunctor** `Hom(-, =)` sobre la categoría bipartita OPM, no un endofunctor sobre una subcategoría homogénea. A diferencia de aggregation/generalization/classification (que son endofunctores en Obj o Proc), exhibition cruza el boundary Obj↔Proc. Eliminar I-27 restaura la estructura profunctorial correcta.

### 2.3 Solución

**Eliminar I-27 de `validate()`.** No reemplazar con nada — exhibition no tiene restricción de perseverancia.

**Nota:** El data model spec (`opm-data-model.md`) también tiene I-27 documentado incorrectamente. Debe actualizarse.

---

## 3. Gap C8: Procedural Link Endpoint Type Validation

### 3.1 Problema

**ISO §6.1-§6.3** define reglas estrictas de dirección para links procedurales:

| Link Type | Source kind | Target kind |
|-----------|-----------|-------------|
| consumption | object | process |
| result | process | object |
| effect | any (one must be object, one process) |
| input | any (state-specified effect component) |
| output | any (state-specified effect component) |
| agent | object | process |
| instrument | object | process |

**Implementación actual:** Solo valida I-05 (endpoints existen) y I-18 (agent source physical). No valida que los endpoints sean de kinds diferentes para links procedurales.

**Convención de dirección del codebase:** El codebase usa `source=process, target=object` para transforming links (consumption, result, effect). Esto difiere de la convención ISO donde el objeto consumido es el source. La convención es deliberada y consistente en tests, simulation engine, OPL renderer, y fixture Coffee Making. I-33 valida object↔process **sin imponer dirección específica**.

### 3.2 Justificación categórica

Los links procedurales son **1-cells en una categoría bipartita** con dos tipos de 0-cells (objects, processes). La restricción fundamental es que estos morfismos deben cruzar la partición: `source.kind !== target.kind`. Sin esta validación, la categoría acepta morfismos intra-partición (process→process, object→object) que no tienen semántica OPM.

### 3.3 Solución

Nuevo invariante **I-33** en `addLink()` y `validate()`:

```typescript
// I-33: Procedural links must connect object↔process (either direction)
const PROCEDURAL_TYPES = new Set([
  "consumption", "result", "effect", "input", "output", "agent", "instrument",
]);
if (PROCEDURAL_TYPES.has(link.type) && source.kind === target.kind) {
  return err({ code: "I-33", message: "... must connect object↔process" });
}
```

Validación simplificada: `source.kind === target.kind` es el único check necesario. No se impone dirección específica.

---

## 4. Gap I15: Enabling Link Uniqueness

### 4.1 Problema

**ISO §8.1.2:** "An object or state shall have exactly one role with respect to a process it links to."

I-16 cubre transforming links. Pero un objeto puede ser simultáneamente `agent` E `instrument` del mismo proceso — la ISO lo prohíbe.

### 4.2 Solución

Extender I-16 a **I-16-EXT** que también cubra enabling links:

```
∀ (object O, process P):
  |{lnk ∈ {agent, instrument} | lnk connects (O, P)}| ≤ 1
```

Implementar en `validate()` junto a I-16 existente.

---

## 5. Gap I16: Structural Invariants in addLink()

### 5.1 Problema

I-22, I-23, I-24, I-25, I-26 solo se verifican en `validate()`, no en `addLink()`. Esto permite crear links inválidos que solo se detectan en validación explícita.

### 5.2 Solución

Mover las verificaciones de I-22..I-26 (y el nuevo I-33) a `addLink()` como guards eagerly-evaluated. Mantener también en `validate()` para verificación de modelos deserializados.

---

## 6. Gap I17: I-28 State-Specified Validation in addLink()

### 6.1 Problema

`addLink()` no valida que `source_state` pertenezca al parent correcto según el tipo de link. Solo `updateLink()` tiene validación DANGLING_STATE.

### 6.2 Solución

Agregar validación I-28 en `addLink()`:

```typescript
// Para enabling links (agent, instrument): source_state debe pertenecer a link.source
// Para transforming links: source_state pertenece a la cosa que es el object (no el process)
// target_state siempre pertenece al object endpoint
```

---

## 7. Gap I18: Self-Loop Prevention

### 7.1 Problema

ISO §8.5 permite self-invocation (process → itself). Pero para otros tipos de links, `source === target` no tiene sentido semántico (un objeto no puede consumirse a sí mismo, un proceso no puede ser agente de sí mismo).

### 7.2 Solución

Nuevo invariante **I-34** en `addLink()`:

```
∀ lnk: lnk.type ≠ "invocation" ⟹ lnk.source ≠ lnk.target
```

---

## 8. Gap I5-ext: Exception Link Subtype

### 8.1 Problema

ISO §9.5.4 distingue overtime y undertime exception links con semánticas y visuales distintas.

### 8.2 Solución

Agregar campo opcional `exception_type` al Link:

```typescript
// En Link interface:
exception_type?: "overtime" | "undertime";
```

Validar que solo exista cuando `type === "exception"`. Agregar al JSON Schema con conditional rule.

---

## 9. Resumen de cambios

| Archivo | Cambios |
|---------|---------|
| `packages/core/src/types.ts` | `exception_type` en Link |
| `packages/core/src/api.ts` | Guards en addLink (I-33, I-22..I-26, I-28, I-34), fix I-27, I-16-EXT en validate |
| `packages/core/tests/api-links.test.ts` | Tests para I-33, I-34, I-16-EXT, I-27 fix |
| `packages/core/tests/api-invariants-new.test.ts` | Tests para I-22..I-26 en addLink |
| `docs/superpowers/specs/2026-03-10-opm-data-model.md` | Corregir I-27, agregar I-33, I-34 |
| `docs/superpowers/specs/2026-03-10-opm-json-schema.json` | `exception_type` conditional |
| `docs/superpowers/specs/2026-03-13-iso-gap-analysis.md` | Marcar C7, C8 como cerrados |
