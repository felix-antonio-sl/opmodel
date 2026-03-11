# Update Operations for @opmodel/core

**Date:** 2026-03-11
**Status:** Approved
**Author:** fxsl/arquitecto-categorico

---

## 1. Problem Statement

`@opmodel/core` has complete CRUD for **Create** and **Delete** (24 mutations: `add*` / `remove*` for 12 entity types), but **zero Update operations**. The frontend viewer (`packages/web`) is read-only. To enable editing, we need:

1. `update*` for the 12 entity types (Things, States, OPDs, Links, Modifiers, Appearances, Fans, Scenarios, Assertions, Requirements, Stereotypes, SubModels)
2. `updateMeta` and `updateSettings` for the two singleton objects
3. `touch()` — automatic `meta.modified` timestamp on every mutation
4. Optionally: a History/undo pattern for the editor

---

## 2. touch() as Natural Transformation

### Categorical Framing

`touch` is a natural transformation `η: Id_Model → Id_Model` that threads through every mutation. It is the **only** function that modifies `meta.modified`.

### Signature

```typescript
function touch(model: Model): Model {
  return {
    ...model,
    meta: { ...model.meta, modified: new Date().toISOString() },
  };
}
```

### Composition Rule

Every public mutation `f: (Model, args) → Result<Model>` composes with touch:

```typescript
// Before (existing pattern):
return ok({ ...model, things: newThings });

// After (all 24 existing + 14 new mutations):
return ok(touch({ ...model, things: newThings }));
```

**Scope:** Retroactively applied to all 24 existing `add*`/`remove*` functions plus the 14 new `update*` functions.

---

## 3. Uniform Update Signature

### Pattern

All `update*` functions follow one signature:

```typescript
function updateThing(
  model: Model,
  id: string,
  patch: Partial<Omit<Thing, "id">>,
): Result<Model, InvariantError>;
```

- **`id`**: Lookup key (immutable, not patchable)
- **`patch`**: Partial object — only fields to change. The `id` field is excluded via `Omit` to prevent identity mutation.

### Special Case: updateAppearance

Appearance has no `id` field. Its identity is the composite key `(thing, opd)` — categorically, the morphism `app: Thing → OPD` in the fibration. This composite key is the identity and therefore **not mutable**.

```typescript
function updateAppearance(
  model: Model,
  thing: string,
  opd: string,
  patch: Partial<Omit<Appearance, "thing" | "opd">>,
): Result<Model, InvariantError>;
```

The lookup key `${thing}::${opd}` acts as the Map key. To "move" an appearance to a different OPD, the user must `removeAppearance` + `addAppearance` — the same semantics as destroying and creating a new morphism.

### Special Cases: updateMeta and updateSettings

These are singletons (not Map-stored, not ID-indexed). They get their own signatures:

```typescript
function updateMeta(
  model: Model,
  patch: Partial<Omit<Meta, "created" | "modified">>,
): Result<Model, InvariantError>;

function updateSettings(
  model: Model,
  patch: Partial<Settings>,
): Result<Model, InvariantError>;
```

- `updateMeta` excludes both `created` and `modified` from the patch — `created` is immutable, and `modified` is managed exclusively by `touch()`. This prevents conflicts where a user-supplied `modified` would be immediately overwritten.
- `updateSettings` has no invariants to check — all fields are optional with valid defaults.

### cleanPatch() Helper

TypeScript's `Partial<T>` allows `undefined` values explicitly set in a patch. A spread merge `{ ...entity, ...patch }` would overwrite existing values with `undefined`, violating type safety:

```typescript
// DANGER: { name: "foo", ...{ name: undefined } } → { name: undefined }
```

Solution — a `cleanPatch()` helper strips `undefined` values before merge:

```typescript
function cleanPatch<T extends Record<string, unknown>>(patch: T): T {
  const cleaned = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return cleaned as T;
}
```

Every `update*` applies `cleanPatch()` before spreading:

```typescript
const cleaned = cleanPatch(patch);
const updated = { ...existing, ...cleaned };
```

**Trade-off:** `cleanPatch()` makes it impossible to explicitly set an optional field to `undefined` via a patch. To clear an optional field (e.g., remove `notes` from a Thing), the caller must omit it from the patch and construct a replacement entity without it — or use `remove` + `add`. This is deliberate: optional fields in OPM entities are absent-when-unset, not null. The API enforces this invariant at the boundary.

---

## 4. Fibered Re-Validation

### Categorical Framing

The invariant system is a **fibration**: each invariant `I-xx` is fibered over the fields it depends on. When a patch touches field `f`, only invariants in the fiber over `f` need re-checking. This avoids the O(n) cost of full `validate()` on every edit.

### Validation Matrix

| Entity | Field(s) in Patch | Invariants to Re-check |
|--------|-------------------|----------------------|
| **Thing** | `kind` | I-01 (states must be on objects) — **reject** if existing states would violate |
| **Thing** | `essence` | I-18 (agent source must be physical), I-19 (exhibition source must be informatical) — **reject** if existing links would violate |
| **Thing** | `duration` | I-14 (exception source needs duration.max) — **reject** if existing exception links would violate |
| **State** | `parent` | I-01 (parent must be object) |
| **Link** | `source` or `target` | I-05 (endpoints exist), I-14, I-18, I-19 (type-dependent constraints on new endpoints) |
| **Link** | `type` | I-14 (exception needs duration.max), I-18 (agent needs physical), I-19 (exhibition forces informatical) |
| **Link** | `source` or `target` or `type` | Always re-check I-14, I-18, I-19 (these depend on the combination of type + endpoint properties) |
| **Modifier** | `over` | I-06 (link must exist) |
| **Fan** | `members` | I-07 (>= 2 members, all must be links) |
| **Appearance** | `internal` | I-15 (only in refinement OPDs) |
| **Assertion** | `target` | I-09 (target must exist) |
| **Requirement** | `target` | I-10 (target must exist) |
| **Stereotype** | `thing` | I-11 (thing must exist) |
| **SubModel** | `shared_things` | I-12 (things must exist) |
| **OPD** | `parent_opd`, `opd_type` | I-03 (hierarchy rules) |
| **Scenario** | `path_labels` | I-13 (labels must exist in links) |

### Critical: updateLink Re-Validation

When `source`, `target`, or `type` changes in a Link, the invariant dependencies are **not independent**. I-14, I-18, and I-19 each depend on the combination of `type` + endpoint properties. Therefore:

> **Rule:** If any of `{ source, target, type }` appears in the patch, re-check **all three** of I-14, I-18, I-19 against the **merged** (post-patch) link.

This prevents a subtle bug: changing `source` to a non-physical thing on an existing agent link would pass if only I-05 (endpoint exists) is checked but I-18 (agent source must be physical) is skipped.

### updateLink: source_state / target_state Validation

When `source` or `target` changes, the existing `source_state` or `target_state` may reference a State belonging to the **old** endpoint Thing. The update must validate:

- If `source` changes and `source_state` is set (either in patch or existing): verify `source_state` belongs to the new `source` Thing
- If `target` changes and `target_state` is set (either in patch or existing): verify `target_state` belongs to the new `target` Thing
- If the state reference becomes dangling, **reject** the update (do not silently clear it)

### Update Semantics: Reject, Not Cascade

All `update*` functions follow a **reject** policy: if the patch would cause any invariant violation, the update returns `err()` and the model is unchanged. Updates never cascade-delete dependent entities.

This differs from `remove*` functions which cascade by necessity (removing a Thing must remove its States, Links, etc.). Updates are precise patches — the caller must explicitly resolve dependencies before applying a change that would otherwise violate invariants.

**Examples:**
- `updateThing(model, "obj-1", { kind: "process" })` when `obj-1` has States → **rejected** (I-01). Caller must `removeState` first.
- `updateThing(model, "obj-1", { essence: "informatical" })` when `obj-1` is source of an agent link → **rejected** (I-18). Caller must remove the agent link first.
- `updateLink(model, "lnk-1", { source: "obj-2" })` when `source_state` references a state of old source → **rejected**. Caller must clear `source_state` in the same or prior patch.

### I-19 Coercion and Irreversibility

I-19 states: "Exhibition link source must be informatical." When an exhibition link is **added**, the API coerces `source.essence := "informatical"` automatically. This coercion is **irreversible** — if the exhibition link is later removed, the source's essence remains `informatical`.

**For updateLink:**
- If `type` changes **to** `exhibition`: coerce source to informatical (same as addLink)
- If `type` changes **from** `exhibition` to something else: **do not revert** the source's essence
- If `source` changes on an exhibition link: coerce the **new** source to informatical

This is documented as **intentional information loss**, consistent with OPM semantics where exhibiting an attribute reveals inherent informatical nature — a property that doesn't vanish when the exhibition is removed.

---

## 5. History as Stream Coalgebra

### Categorical Framing

History is a stream coalgebra `S → F(S)` where:
- `S = History<T>` is the state space
- `F(S) = { past: T[], present: T, future: T[] }` is the observation functor

The three transitions form a coalgebra:
- `push(snapshot)`: Appends present to past, sets new present, clears future
- `undo()`: Moves present to future, pops past to present
- `redo()`: Moves present to past, pops future to present

### Type

```typescript
interface History<T> {
  past: T[];
  present: T;
  future: T[];
}
```

### Operations

```typescript
function pushHistory<T>(h: History<T>, snapshot: T): History<T> {
  return {
    past: [...h.past, h.present],
    present: snapshot,
    future: [],
  };
}

function undo<T>(h: History<T>): History<T> | null {
  if (h.past.length === 0) return null;
  const past = [...h.past];
  const prev = past.pop()!;
  return { past, present: prev, future: [h.present, ...h.future] };
}

function redo<T>(h: History<T>): History<T> | null {
  if (h.future.length === 0) return null;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest };
}

function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] };
}
```

### Structural Sharing (Design Invariant)

The immutable Model pattern uses `{ ...model, things: newMap }` spread, which **structurally shares** all unchanged Maps. A Model with 12 Maps where only `things` changed shares 11 Maps by reference. This means `History<Model>` does NOT duplicate the entire model on every snapshot — only the changed Maps are new allocations.

**This is a design invariant, not an implementation detail.** If the Model representation ever changes to break structural sharing (e.g., deep cloning Maps), the History pattern's memory efficiency would degrade from O(delta) to O(n) per snapshot, and the design must be revisited.

### Scope

History is defined in `@opmodel/core` as a pure, generic data structure (`History<T>` with `push`/`undo`/`redo`). It has no UI dependencies and composes naturally with the immutable Model pattern. The editor layer (`packages/web`) instantiates `History<Model>` and wires it to UI actions — core provides the algebra, the consumer provides the state management.

---

## 6. Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `packages/core/src/api.ts` | **Modify** | Add `touch()` to all 24 existing mutations; add 14 `update*` functions; add `cleanPatch()` helper |
| `packages/core/src/types.ts` | **Read-only** | No changes — types already support Partial patches |
| `packages/core/src/index.ts` | **Modify** | Export new `update*` functions |
| `packages/core/tests/api.test.ts` | **Modify** | Add tests for all 14 `update*` functions + touch behavior |
| `packages/core/src/history.ts` | **Create** | History<T> type + push/undo/redo operations |
| `packages/core/tests/history.test.ts` | **Create** | Tests for History coalgebra |

### Estimated Size

- 14 `update*` functions x ~20 LOC = ~280 LOC new in api.ts
- `touch()` + `cleanPatch()` = ~15 LOC
- Retrofit touch into 24 existing functions = ~24 line changes
- `history.ts` = ~40 LOC
- Tests = ~300-400 LOC

---

## 7. Complete API Surface (Post-Implementation)

### Mutations (38 total)

| Function | Type | Invariants |
|----------|------|------------|
| `addThing` | Create | I-08 |
| `updateThing` | Update | Fibered: I-01, I-14, I-18, I-19 |
| `removeThing` | Delete | I-02 cascade |
| `addState` | Create | I-01, I-08 |
| `updateState` | Update | Fibered: I-01 |
| `removeState` | Delete | — |
| `addLink` | Create | I-05, I-08, I-14, I-18, I-19 |
| `updateLink` | Update | Fibered: I-05, I-14, I-18, I-19 |
| `removeLink` | Delete | Cascade modifiers, fans |
| `addOPD` | Create | I-03, I-08 |
| `updateOPD` | Update | Fibered: I-03 |
| `removeOPD` | Delete | Cascade children, appearances |
| `addAppearance` | Create | I-04, I-15 |
| `updateAppearance` | Update | Fibered: I-15 |
| `removeAppearance` | Delete | — |
| `addModifier` | Create | I-06, I-08 |
| `updateModifier` | Update | Fibered: I-06 |
| `removeModifier` | Delete | — |
| `addFan` | Create | I-07, I-08 |
| `updateFan` | Update | Fibered: I-07 |
| `removeFan` | Delete | — |
| `addScenario` | Create | I-08, I-13 |
| `updateScenario` | Update | Fibered: I-13 |
| `removeScenario` | Delete | — |
| `addAssertion` | Create | I-08, I-09 |
| `updateAssertion` | Update | Fibered: I-09 |
| `removeAssertion` | Delete | — |
| `addRequirement` | Create | I-08, I-10 |
| `updateRequirement` | Update | Fibered: I-10 |
| `removeRequirement` | Delete | — |
| `addStereotype` | Create | I-08, I-11 |
| `updateStereotype` | Update | Fibered: I-11 |
| `removeStereotype` | Delete | — |
| `addSubModel` | Create | I-08, I-12 |
| `updateSubModel` | Update | Fibered: I-12 |
| `removeSubModel` | Delete | — |
| `updateMeta` | Update | — (created immutable) |
| `updateSettings` | Update | — (no invariants) |

### Queries (unchanged)

| Function | Description |
|----------|-------------|
| `validate` | Full invariant scan |
| `loadModel` | Deserialize .opmodel JSON |
| `saveModel` | Serialize to .opmodel JSON |

### History (new, separate module)

| Function | Description |
|----------|-------------|
| `createHistory` | Initialize with snapshot |
| `pushHistory` | Record new state |
| `undo` | Restore previous state |
| `redo` | Re-apply undone state |

---

## 8. Design Decisions

| Decision | Rationale |
|----------|-----------|
| `Partial<Omit<Entity, "id">>` patch | ID is identity — immutable by definition |
| `cleanPatch()` strips `undefined` | Prevents type safety gap in spread merge |
| Fibered re-validation, not full `validate()` | O(1) per edit vs O(n) full scan |
| `touch()` as composition, not middleware | Pure functions compose; no decorator/wrapper overhead |
| Appearance key `(thing, opd)` is immutable | Morphism identity in fibration — not a mutable attribute |
| History<T> in core, instantiated in editor | Pure generic algebra in core; UI wiring in consumer |
| Structural sharing as design invariant | Memory efficiency guarantee for History<Model> |
| I-19 coercion is irreversible | Informatical nature is revealed, not assigned — OPM semantics |
| `updateMeta` excludes `created` and `modified` | `created` is immutable; `modified` is managed by `touch()` exclusively |
| `updateLink` checks I-14/I-18/I-19 on any `{source,target,type}` change | These invariants depend on the type+endpoint combination, not individual fields |
| Updates reject, never cascade | Cascading is a delete concern; updates are precise patches |
| `cleanPatch()` cannot clear optional fields | Absent-when-unset semantics; deliberate trade-off documented |
| `source_state`/`target_state` validated on endpoint change | Prevents dangling state references after source/target mutation |
