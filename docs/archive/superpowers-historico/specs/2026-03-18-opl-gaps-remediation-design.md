# OPL Gaps Remediation — Design Spec

**Fecha**: 2026-03-18
**Session**: 9
**Scope**: GAP-OPL-02, 03, 04, 05, 06, 07 (nuevo)
**Enfoque**: AST Extension — nuevos sentence types en OplSentence union
**Baseline**: 586 tests, 77 commits

---

## 1. Contexto

El OPL lens (DA-6) tiene 6 gaps identificados entre sessions 5-8. Cinco fueron catalogados durante el trabajo con el fixture OnStar Driver Rescuing (GAP-OPL-02..06). Un sexto (GAP-OPL-07) se agrega en esta session tras verificar contra OPCloud la forma de exhibition feature declarations.

### Gaps

| Gap | Tema | ISO Reference | Estado actual | Forma ISO esperada |
|-----|-------|---------------|---------------|-------------------|
| OPL-06 | Instrument link form | §9.2.3 | `"X is an instrument of Y."` | `"Y requires X."` |
| OPL-02 | State markers (initial/final/default) | §A.4.4.4 | Sin markers | `"State S of O is initial."` |
| OPL-04 | Grouped structural links | §10.3.2-5 | 1 sentence por link | `"X consists of A, B, and C."` |
| OPL-07 | Exhibition "of Exhibitor" + value sentences | §10.3.3.2.2 | `"Feature is a..."` | `"Feature of Exhibitor is a..."` |
| OPL-03/05 | In-zoom sequence sentence | §14.2.1.3 | Sin sentence | `"P zooms into A, B, and C, in that sequence."` |

### Scope excluido

- **Parallel in-zoom grouping** (ISO §14.2.2.2): diferido hasta que el editor tenga UI de snap-to-grid. El AST está preparado (`steps[].parallel`).
- **Attribute range expressions** (ISO §10.3.3.2.2 ranges): requiere cambios al data model (`measurement_unit`, `range_min/max`). Spec separado.
- **INCONSISTENCY-01** (aggregation direction): P2, visual-only, OPL text es correcto.
- **Multiple initial states sentence** (ISO §A.4.4.4 plural form): YAGNI — fixtures actuales tienen máximo 1 initial state por objeto. La forma singular cubre todos los casos reales.

---

## 2. Decisiones de diseño

### DA: AST Extension (Enfoque A)

El AST (`OplSentence` union) es el modelo semántico del OPL. Si ISO dice que "X consists of A, B, C" es una proposición unitaria, el AST debe tener un nodo para eso. Poner grouping en `render()` violaría la propiedad de que `expose()` produce una representación fiel del modelo.

**OplSentence union**: de 5 a 8 variantes (+`OplStateDescription`, +`OplGroupedStructuralSentence`, +`OplInZoomSequence`, +`OplAttributeValue`).

### DA: "of Exhibitor" como campo derivado

El campo `exhibitorName` en `OplThingDeclaration` y `OplStateEnumeration` es derivado de exhibition links, no del Thing. `editsFrom` lo ignora.

### DA: In-zoom sequence sequential-only

La forma parallel requiere un threshold de Y-proximity arbitrario. Se difiere. El campo `steps[].parallel` en el AST está preparado.

---

## 3. Cambios al AST (`opl-types.ts`)

### 3.1 Nuevos tipos

```typescript
export interface OplStateDescription {
  kind: "state-description";
  thingId: string;
  thingName: string;
  stateId: string;
  stateName: string;
  initial: boolean;
  final: boolean;
  default: boolean;
  exhibitorName?: string;  // "of Exhibitor" form for exhibition features
}

export interface OplGroupedStructuralSentence {
  kind: "grouped-structural";
  linkType: "aggregation" | "exhibition" | "generalization" | "classification";
  parentId: string;
  parentName: string;
  parentKind: Kind;
  childIds: string[];
  childNames: string[];
  childKinds: Kind[];       // for exhibition: attributes vs operations ordering
  incomplete: boolean;
}

export interface OplInZoomSequence {
  kind: "in-zoom-sequence";
  parentId: string;
  parentName: string;
  steps: {
    thingIds: string[];
    thingNames: string[];
    parallel: boolean;
  }[];
}

export interface OplAttributeValue {
  kind: "attribute-value";
  thingId: string;         // the attribute (feature)
  thingName: string;
  exhibitorId: string;
  exhibitorName: string;
  valueName: string;       // default state's name
}
```

### 3.2 Extensiones a tipos existentes

```typescript
// OplThingDeclaration — add:
exhibitorName?: string;    // "Feature of Exhibitor" form

// OplStateEnumeration — add:
exhibitorName?: string;    // "Feature of Exhibitor" form
```

### 3.3 Union actualizada

```typescript
export type OplSentence =
  | OplThingDeclaration
  | OplStateEnumeration
  | OplDuration
  | OplLinkSentence
  | OplModifierSentence
  | OplStateDescription      // NEW
  | OplGroupedStructuralSentence  // NEW
  | OplInZoomSequence        // NEW
  | OplAttributeValue;       // NEW
```

---

## 4. Cambios a `expose()` (`opl.ts`)

### 4.1 In-zoom sequence (emitir primero)

```
Si opd.refines existe:
  1. Colectar internal process appearances (kind="process", app.internal=true)
  2. Ordenar por Appearance.y, desempatar por id
  3. Cada subprocess es un step con parallel=false (sequential-only)
  4. Emitir OplInZoomSequence como primera sentence
```

### 4.2 Exhibition feature lookup

```
Construir exhibitorOf: Map<thingId, { exhibitorId, exhibitorName }>
Para cada exhibition link visible:
  exhibitorOf.set(link.source, { id: link.target, name: things.get(link.target).name })
  // Convention: source=feature, target=exhibitor
```

### 4.3 Thing declarations (enriched)

```
Para cada thing:
  declaration.exhibitorName = exhibitorOf.get(thingId)?.exhibitorName
  // Renders as "Feature of Exhibitor is a..."
```

### 4.4 State enumeration (enriched)

```
state-enumeration.exhibitorName = exhibitorOf.get(thingId)?.exhibitorName
// Renders as "Feature of Exhibitor can be s1, s2, or s3."
```

### 4.5 State descriptions (new, after state-enumeration)

```
Para cada state con initial || final || default:
  Emitir OplStateDescription {
    thingId, thingName, stateId, stateName,
    initial, final, default,
    exhibitorName: exhibitorOf.get(thingId)?.exhibitorName
  }
```

### 4.6 Attribute value sentences (new, after state-descriptions)

```
Para cada thing que:
  - tiene exhibitor (exhibitorOf.has(thingId))
  - tiene un state con default=true
Emitir OplAttributeValue {
  thingId, thingName,
  exhibitorId, exhibitorName,
  valueName: defaultState.name
}
```

### 4.7 Grouped structural links (replace individual emission)

```
1. Separar sortedLinks en structural y non-structural
2. Agrupar structural por (parentId, linkType):
   - aggregation: parent=source, children=targets
   - exhibition: parent=target, children=sources
   - generalization: parent=source, children=targets
   - classification: parent=source, children=targets
3. Para cada grupo:
   Emitir OplGroupedStructuralSentence {
     linkType, parentId, parentName, parentKind,
     childIds, childNames, childKinds,
     incomplete: any link in group has incomplete=true
   }
4. Emitir non-structural links individuales (sin cambio)
```

### 4.8 Sentence ordering in output

```
1. OplInZoomSequence (if in-zoom OPD)
2. OplThingDeclaration + OplStateEnumeration + OplStateDescription + OplAttributeValue + OplDuration (per thing)
3. OplGroupedStructuralSentence (structural links, grouped)
4. OplLinkSentence (non-structural links, individual)
5. OplModifierSentence
```

---

## 5. Cambios a `renderSentence()` (`opl.ts`)

### 5.1 GAP-OPL-06 — Instrument fix

```typescript
case "instrument":
  if (s.sourceStateName) {
    return `${s.targetName} requires ${s.sourceStateName} ${s.sourceName}.`;
  }
  return `${s.targetName} requires ${s.sourceName}.`;
```

### 5.2 Thing declaration con "of Exhibitor"

```typescript
case "thing-declaration":
  const displayName = s.exhibitorName ? `${s.name} of ${s.exhibitorName}` : s.name;
  // Use displayName in place of s.name
```

### 5.3 State enumeration con "of Exhibitor"

```typescript
case "state-enumeration":
  const displayName = s.exhibitorName
    ? `${s.thingName} of ${s.exhibitorName}`
    : s.thingName;
  // "Feature of Exhibitor can be s1, s2, or s3."
```

### 5.4 State description

```typescript
case "state-description":
  const qualifiers: string[] = [];
  if (s.initial) qualifiers.push("initial");
  if (s.final) qualifiers.push("final");
  if (s.default) qualifiers.push("default");
  const thingDisplay = s.exhibitorName
    ? `${s.thingName} of ${s.exhibitorName}`
    : s.thingName;
  return `State ${s.stateName} of ${thingDisplay} is ${qualifiers.join(" and ")}.`;
```

### 5.5 Grouped structural

```typescript
case "grouped-structural":
  return renderGroupedStructural(s);

const INCOMPLETE_PHRASES: Record<string, string> = {
  aggregation: "at least one other part",
  exhibition: "at least one other feature",
  generalization: "at least one other specialization",
  classification: "at least one other instance",
};

function renderGroupedStructural(s: OplGroupedStructuralSentence): string {
  const list = formatList(s.childNames, s.incomplete, INCOMPLETE_PHRASES[s.linkType]);
  switch (s.linkType) {
    case "aggregation":
      return `${s.parentName} consists of ${list}.`;
    case "exhibition":
      // ISO: object exhibitor → attributes first, then operations
      // ISO: process exhibitor → operations first, then attributes
      return renderExhibitionGrouped(s);
    case "generalization":
      // "A, B, and C are a/an General." (objects) / "are General." (processes)
      return renderGeneralizationGrouped(s);
    case "classification":
      return `${list} are instances of ${s.parentName}.`;
  }
}
```

#### Exhibition rendering (ISO §10.3.3):

```
Object exhibitor: "Exhibitor exhibits Attr1, Attr2, as well as Op1 and Op2."
Process exhibitor: "Exhibitor exhibits Op1, Op2, as well as Attr1 and Attr2."
```

Partition `childKinds` en attributes (kind="object") y operations (kind="process"). Si solo hay un grupo (all attrs o all ops), omitir `"as well as"`.

#### Generalization rendering (ISO §10.3.4):

```
Objects: "Spec1, Spec2, and Spec3 are a/an General." (article via aOrAn)
Processes: "Spec1, Spec2, and Spec3 are General." (no article)
Incomplete: "Spec1, Spec2, and at least one other specialization are General."
```

### 5.6 In-zoom sequence

```typescript
case "in-zoom-sequence":
  const subNames = s.steps.flatMap(step =>
    step.parallel
      ? [`parallel ${formatList(step.thingNames)}`]
      : step.thingNames
  );
  const list = formatList(subNames);
  if (s.steps.length === 1 && s.steps[0].thingNames.length === 1) {
    return `${s.parentName} zooms into ${list}.`;
  }
  return `${s.parentName} zooms into ${list}, in that sequence.`;
```

### 5.7 Attribute value

```typescript
case "attribute-value":
  return `${s.thingName} of ${s.exhibitorName} is ${s.valueName}.`;
```

### 5.8 Helper: formatList

```typescript
function formatList(names: string[], incomplete?: boolean, phrase?: string): string {
  if (names.length === 0) return "";
  if (names.length === 1) {
    return incomplete ? `${names[0]} and ${phrase}` : names[0];
  }
  const last = names[names.length - 1];
  const rest = names.slice(0, -1);
  if (incomplete) {
    return `${rest.join(", ")}, ${last}, and ${phrase}`;
  }
  return `${rest.join(", ")}, and ${last}`;
}
```

---

## 6. Cambios a `editsFrom()` (`opl.ts`)

### 6.1 State description → enriquecer add-states

```
Acumular Map<thingId::stateName, {initial, final, default}>
Al procesar state-enumeration, usar el map para poblar los campos
(actualmente hardcodeados a false)
```

### 6.2 Grouped structural → desfold a N add-link

```
Para cada OplGroupedStructuralSentence:
  Para cada (childId, index) en childIds:
    Emitir add-link con (parentId, childId, linkType)
    Respetar convención de dirección:
      aggregation: source=parent, target=child
      exhibition: source=child, target=parent
      generalization: source=parent, target=child
      classification: source=parent, target=child
    Propagar incomplete: cada add-link hereda s.incomplete
    (Nota: incomplete es propiedad del fan/grupo, no de links individuales.
     Durante expose() se reconstruye vía OR. PutGet round-trip es sound.)
```

### 6.3 Sentences derivadas → ignorar

`in-zoom-sequence` y `attribute-value` no generan edits (son computados de appearances y states).

---

## 7. Tests esperados

### 7.1 GAP-OPL-06 — Instrument form (2 tests)
- Non-state-specified instrument renders `"P requires I."`
- Update driver-rescuing.test.ts assertion

### 7.2 GAP-OPL-02 — State descriptions (4 tests)
- State with initial=true renders `"State S of O is initial."`
- State with final=true renders `"State S of O is final."`
- State with initial+final renders `"State S of O is initial and final."`
- State with default=true renders `"State S of O is default."`

### 7.3 GAP-OPL-04 — Grouped structural (6 tests)
- Aggregation: 3 parts → `"W consists of A, B, and C."`
- Aggregation incomplete: `"W consists of A and at least one other part."`
- Exhibition object exhibitor: attrs + ops with `"as well as"`
- Exhibition single group: no `"as well as"`
- Generalization objects: `"A, B, and C are a General."`
- Classification: `"A, B and C are instances of Class."`

### 7.4 GAP-OPL-07 — Exhibition feature form (4 tests)
- Thing declaration: `"Feature of Exhibitor is a..."`
- State enumeration: `"Feature of Exhibitor can be s1 or s2."`
- State description: `"State s1 of Feature of Exhibitor is initial."`
- Attribute value: `"Feature of Exhibitor is value."`

### 7.5 GAP-OPL-03/05 — In-zoom sequence (3 tests)
- Sequential: `"P zooms into A, B, and C, in that sequence."`
- Single subprocess: `"P zooms into A."`
- editsFrom ignores in-zoom-sequence (no edits emitted)

### 7.6 Lens law verification (2 tests)
- PutGet: expose → editsFrom → apply round-trips for grouped structural
- State description qualifiers survive round-trip via editsFrom enrichment

### 7.7 Driver Rescuing integration (1 test update)
- Update existing assertions for new OPL output format

**Total estimado: ~22 tests nuevos + 1 test update**

---

## 8. Archivos impactados

| Archivo | Cambios |
|---------|---------|
| `packages/core/src/opl-types.ts` | 4 nuevos interfaces, 2 campos en existentes, union actualizada |
| `packages/core/src/opl.ts` | expose(): exhibition lookup, state descriptions, grouped structural, in-zoom sequence, attribute value. renderSentence(): 6 nuevos cases. editsFrom(): state enrichment, grouped desfold. formatList helper. |
| `packages/core/tests/opl.test.ts` | ~22 tests nuevos |
| `packages/core/tests/driver-rescuing.test.ts` | Update assertions (instrument form, grouped aggregation) |

---

## 9. Orden de implementación (TDD)

1. **GAP-OPL-06**: Instrument fix (1 línea, warmup)
2. **GAP-OPL-02**: State descriptions (nuevo tipo + expose + render + editsFrom)
3. **GAP-OPL-07**: Exhibition "of Exhibitor" + value sentences (lookup + enrichment)
4. **GAP-OPL-04**: Grouped structural (grouping phase + render + desfold)
5. **GAP-OPL-03/05**: In-zoom sequence (Y-ordering + render)
6. **Integration**: Driver Rescuing test updates + lens law verification
