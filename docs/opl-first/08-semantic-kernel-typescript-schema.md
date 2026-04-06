# Semantic Kernel + Atlas + Layout — TypeScript Schema

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Estado | Draft implementable |
| Objetivo | Definir tipos concretos para llevar OPL-first a producto |

## 1. Objetivo

Este documento traduce la ADR del kernel semántico y la especificación OPL → OPD a un schema TypeScript concreto, alineado con el core actual de OPModel.

Criterios:
- reusar lo que ya existe en `packages/core/src/types.ts`
- no romper el pipeline actual de golpe
- permitir migración gradual desde `Model`
- separar semántica, atlas y layout

---

## 2. Estratos

```ts
OPL text
  -> OplDocument
  -> SemanticKernel
  -> OpdAtlas
  -> LayoutModel
  -> SceneGraph
```

### Regla
- `SemanticKernel` = SSOT
- `OpdAtlas` = proyección por contexto/refinamiento
- `LayoutModel` = geometría regenerable

---

## 3. Tipos base

```ts
export type ThingId = string;
export type StateId = string;
export type LinkId = string;
export type RefinementId = string;
export type OpdId = string;
export type ScenarioId = string;
export type AssertionId = string;
export type RequirementId = string;
export type ViewId = string;
export type ParallelClassId = string;
```

```ts
export type SemanticLinkType =
  | "consumption"
  | "result"
  | "effect"
  | "agent"
  | "instrument"
  | "invocation"
  | "exception"
  | "aggregation"
  | "exhibition"
  | "generalization"
  | "classification"
  | "tagged";
```

```ts
export type RefinementKind = "in-zoom" | "unfold";
export type ExecutionMode = "sequential" | "parallel";
export type ViewLane = "objects-left" | "processes-center" | "objects-right" | "free";
```

---

## 4. Semantic Kernel

## 4.1 SemanticKernel

```ts
export interface SemanticKernel {
  meta: KernelMeta;
  settings: KernelSettings;

  things: Map<ThingId, SemanticThing>;
  states: Map<StateId, SemanticState>;
  links: Map<LinkId, SemanticLink>;
  refinements: Map<RefinementId, SemanticRefinement>;

  opds: Map<OpdId, OpdNode>;

  scenarios: Map<ScenarioId, SemanticScenario>;
  assertions: Map<AssertionId, SemanticAssertion>;
  requirements: Map<RequirementId, SemanticRequirement>;
}
```

## 4.2 Meta + settings

```ts
export interface KernelMeta {
  name: string;
  description?: string;
  systemType?: "artificial" | "natural" | "social" | "socio-technical";
  created: string;
  modified: string;
  version?: string;
}
```

```ts
export interface KernelSettings {
  oplLanguage?: "en" | "es";
  oplEssenceVisibility?: "all" | "non_default" | "none";
  oplUnitsVisibility?: "always" | "hide" | "when_applicable";
  oplAliasVisibility?: boolean;
  primaryEssence?: "physical" | "informatical";
}
```

---

## 5. Things + states

## 5.1 SemanticThing

```ts
export interface SemanticThing {
  id: ThingId;
  kind: "object" | "process";
  name: string;

  essence: "physical" | "informatical";
  affiliation: "systemic" | "environmental";
  perseverance?: "static" | "dynamic";

  duration?: SemanticDuration;
  notes?: string;
  hyperlinks?: string[];

  stateful?: boolean;
  computational?: SemanticComputationalObject | SemanticComputationalProcess;

  source?: SemanticSource;
}
```

## 5.2 SemanticState

```ts
export interface SemanticState {
  id: StateId;
  parentThing: ThingId;
  name: string;

  initial: boolean;
  final: boolean;
  default: boolean;
  current?: boolean;

  duration?: SemanticDuration;
  hyperlinks?: string[];
  source?: SemanticSource;
}
```

## 5.3 Duration + computational

```ts
export interface SemanticDuration {
  nominal: number;
  min?: number;
  max?: number;
  unit: "ms" | "s" | "min" | "h" | "d";
  distribution?: { name: string; params: Record<string, number> };
}
```

```ts
export interface SemanticComputationalObject {
  kind: "object-computation";
  value: unknown;
  valueType: "integer" | "float" | "string" | "character" | "boolean";
  unit?: string;
  alias?: string;
}
```

```ts
export interface SemanticComputationalProcess {
  kind: "process-computation";
  functionType: "predefined" | "user_defined";
  functionName?: string;
  functionCode?: string;
}
```

---

## 6. Semantic links

## 6.1 Link base

```ts
export interface SemanticLinkBase {
  id: LinkId;
  type: SemanticLinkType;

  sourceThing: ThingId;
  targetThing: ThingId;

  sourceState?: StateId;
  targetState?: StateId;

  pathLabel?: string;
  tag?: string;
  direction?: "unidirectional" | "bidirectional" | "reciprocal";
  probability?: number;

  source?: SemanticSource;
  derived?: DerivedSemantics;
}
```

## 6.2 Link union

```ts
export type SemanticLink =
  | ConsumptionLink
  | ResultLink
  | EffectLink
  | AgentLink
  | InstrumentLink
  | InvocationLink
  | ExceptionLink
  | AggregationLink
  | ExhibitionLink
  | GeneralizationLink
  | ClassificationLink
  | TaggedLink;
```

## 6.3 Procedural links

```ts
export interface ConsumptionLink extends SemanticLinkBase {
  type: "consumption";
}

export interface ResultLink extends SemanticLinkBase {
  type: "result";
}

export interface EffectLink extends SemanticLinkBase {
  type: "effect";
}

export interface AgentLink extends SemanticLinkBase {
  type: "agent";
  control?: LinkControl;
}

export interface InstrumentLink extends SemanticLinkBase {
  type: "instrument";
  control?: LinkControl;
}

export interface InvocationLink extends SemanticLinkBase {
  type: "invocation";
  invocationInterval?: SemanticDuration;
  origin: "explicit" | "derived-in-zoom";
}

export interface ExceptionLink extends SemanticLinkBase {
  type: "exception";
  exceptionType?: "overtime" | "undertime";
}
```

## 6.4 Structural links

```ts
export interface AggregationLink extends SemanticLinkBase {
  type: "aggregation";
  ordered?: boolean;
  incomplete?: boolean;
}

export interface ExhibitionLink extends SemanticLinkBase {
  type: "exhibition";
  incomplete?: boolean;
}

export interface GeneralizationLink extends SemanticLinkBase {
  type: "generalization";
  discriminating?: boolean;
  discriminatingValues?: string[];
  incomplete?: boolean;
}

export interface ClassificationLink extends SemanticLinkBase {
  type: "classification";
  incomplete?: boolean;
}

export interface TaggedLink extends SemanticLinkBase {
  type: "tagged";
  tag: string;
}
```

## 6.5 Control semantics

```ts
export interface LinkControl {
  modifier?: "event" | "condition";
  negated?: boolean;
  conditionMode?: "skip" | "wait";
}
```

## 6.6 Derived semantics marker

```ts
export interface DerivedSemantics {
  kind: "in-zoom-order" | "fan-elaboration" | "layout-elaboration";
  refinementId?: RefinementId;
  stepIndex?: number;
  note?: string;
}
```

---

## 7. Refinements

## 7.1 Refinement union

```ts
export type SemanticRefinement = InZoomRefinement | UnfoldRefinement;
```

## 7.2 In-zoom refinement

```ts
export interface InZoomRefinement {
  id: RefinementId;
  kind: "in-zoom";

  parentThing: ThingId;
  childOpd: OpdId;
  parentOpd: OpdId;

  steps: InZoomStep[];
  internalObjects: ThingId[];

  source?: SemanticSource;
}
```

```ts
export interface InZoomStep {
  id: string;
  thingIds: ThingId[];
  execution: ExecutionMode;
  source?: SemanticSource;
}
```

## 7.3 Unfold refinement

```ts
export interface UnfoldRefinement {
  id: RefinementId;
  kind: "unfold";

  parentThing: ThingId;
  childOpd: OpdId;
  parentOpd: OpdId;

  relation: "aggregation" | "exhibition" | "generalization" | "classification";
  refineeThings: ThingId[];

  source?: SemanticSource;
}
```

---

## 8. OPD tree / atlas index

## 8.1 OpdNode

```ts
export interface OpdNode {
  id: OpdId;
  name: string;
  parentOpd: OpdId | null;

  refinesThing?: ThingId;
  refinementType?: RefinementKind;

  opdType: "hierarchical" | "view";
}
```

## 8.2 OpdAtlas

```ts
export interface OpdAtlas {
  rootOpd: OpdId;
  nodes: Map<OpdId, OpdSlice>;
  occurrences: Map<ViewId, ViewOccurrence>;
  edges: Map<string, ViewEdge>;
}
```

## 8.3 OpdSlice

```ts
export interface OpdSlice {
  opdId: OpdId;
  name: string;

  contextThing?: ThingId;
  parentOpd?: OpdId | null;
  refinementId?: RefinementId;

  visibleThings: ThingId[];
  visibleLinks: LinkId[];
  visibleStates?: StateId[];

  rules: SliceRules;
}
```

## 8.4 Slice rules

```ts
export interface SliceRules {
  hideDerivedInvocationLinks?: boolean;
  forbidOuterContourTransformingLinks?: boolean;
  allowDuplicateThings?: boolean;
}
```

---

## 9. Visual occurrences

## 9.1 ViewOccurrence

```ts
export interface ViewOccurrence {
  id: ViewId;
  thingId: ThingId;
  opdId: OpdId;

  role: "context" | "internal" | "duplicate" | "refinee" | "refiner";
  scope?: "inner" | "outer";

  semanticRank?: number;
  parallelClass?: ParallelClassId;
  lane?: ViewLane;

  preferredAnchor?: "top" | "bottom" | "left" | "right" | "center";
}
```

## 9.2 ViewEdge

```ts
export interface ViewEdge {
  id: string;
  opdId: OpdId;
  linkId: LinkId;

  sourceView: ViewId;
  targetView: ViewId;

  derived?: boolean;
}
```

---

## 10. Layout model

## 10.1 LayoutModel

```ts
export interface LayoutModel {
  opdLayouts: Map<OpdId, OpdLayout>;
}
```

## 10.2 OpdLayout

```ts
export interface OpdLayout {
  opdId: OpdId;
  nodes: Map<ViewId, LayoutNode>;
  edges: Map<string, LayoutEdge>;
  meta?: {
    algorithm?: string;
    version?: string;
  };
}
```

## 10.3 Layout nodes/edges

```ts
export interface LayoutNode {
  viewId: ViewId;
  x: number;
  y: number;
  w: number;
  h: number;

  pinned?: boolean;
  autoSizing?: boolean;
  internal?: boolean;
  stateAlignment?: "left" | "top" | "right" | "bottom";
}
```

```ts
export interface LayoutEdge {
  edgeId: string;
  vertices?: { x: number; y: number }[];
}
```

---

## 11. Source mapping

```ts
export interface SemanticSource {
  documentId?: string;
  opdName?: string;
  span?: {
    line: number;
    column: number;
    offset: number;
    endLine: number;
    endColumn: number;
    endOffset: number;
  };
  sentenceKind?: string;
}
```

Esto debe existir en:
- thing
- state
- link
- refinement
- in-zoom step

---

## 12. Conversión con el modelo actual

## 12.1 Adapter corto plazo

```ts
export interface LegacyModelAdapter {
  toSemanticKernel(model: Model): SemanticKernel;
  toLegacyModel(kernel: SemanticKernel, atlas?: OpdAtlas, layout?: LayoutModel): Model;
}
```

## 12.2 Reglas de compatibilidad

### `Thing` actual -> `SemanticThing`
- casi 1:1

### `State` actual -> `SemanticState`
- casi 1:1

### `Link` actual -> `SemanticLink`
- 1:1 con refinamiento de tipos
- agregar `origin` en invocation
- agregar `derived` cuando corresponda

### `OPD` actual -> `OpdNode`
- conservar `id`, `name`, `parent_opd`, `refines`, `refinement_type`

### `Appearance` actual -> `LayoutNode + ViewOccurrence`
- `thing/opd` se parte en:
  - `ViewOccurrence(thingId, opdId, semanticRank...)`
  - `LayoutNode(x,y,w,h...)`

Este split es una decisión clave.

---

## 13. Interfaces operacionales

## 13.1 Compile

```ts
export interface CompileOplToKernel {
  (docs: OplDocument[]): Result<SemanticKernel, KernelCompileError>;
}
```

## 13.2 Expose atlas

```ts
export interface ExposeKernelToAtlas {
  (kernel: SemanticKernel): Result<OpdAtlas, AtlasBuildError>;
}
```

## 13.3 Layout atlas

```ts
export interface LayoutAtlas {
  (atlas: OpdAtlas, previous?: LayoutModel): Result<LayoutModel, LayoutError>;
}
```

## 13.4 Collect visual edits

```ts
export interface CollectVisualPatch {
  (atlas: OpdAtlas, layout: LayoutModel, edit: VisualEdit): Result<SemanticPatch | LayoutPatch, CollectError>;
}
```

---

## 14. Patches

## 14.1 SemanticPatch

```ts
export type SemanticPatch =
  | { kind: "reorder-inzoom-step"; refinementId: RefinementId; stepIds: string[] }
  | { kind: "parallelize-step"; refinementId: RefinementId; stepIds: string[] }
  | { kind: "split-parallel-step"; refinementId: RefinementId; stepId: string; thingIds: ThingId[] }
  | { kind: "add-link"; link: SemanticLink }
  | { kind: "remove-link"; linkId: LinkId }
  | { kind: "create-refinement"; refinement: SemanticRefinement }
  | { kind: "move-thing-between-scopes"; thingId: ThingId; opdId: OpdId; scope: "inner" | "outer" };
```

## 14.2 LayoutPatch

```ts
export type LayoutPatch =
  | { kind: "move-node"; viewId: ViewId; x: number; y: number }
  | { kind: "resize-node"; viewId: ViewId; w: number; h: number }
  | { kind: "reroute-edge"; edgeId: string; vertices: { x: number; y: number }[] };
```

---

## 15. Igualdad e invariantes

## 15.1 Igualdad fuerte del kernel

Dos kernels son equivalentes si coinciden en:
- things
- states
- links primarios
- refinements
- OPD tree
- scenarios/assertions/requirements

## 15.2 Igualdad módulo derivados

Se toleran diferencias en:
- invocation derivada
- duplicate thing placement
- layout absoluto
- routing

## 15.3 Invariantes clave

```ts
export interface KernelInvariantReport {
  noOuterContourTransformingLinksInInZoom: boolean;
  parentNotDuplicatedAsOwnSubprocess: boolean;
  sequentialOrderNotEncodedByY: boolean;
  parallelismNotEncodedByY: boolean;
  opdsFormATree: boolean;
}
```

---

## 16. Recomendación de rollout

### Paso 1
Introducir estos tipos en un archivo nuevo, por ejemplo:

```text
packages/core/src/semantic-kernel.ts
```

### Paso 2
Agregar adapters desde/hacia `Model` actual.

### Paso 3
Hacer que `compileOplDocuments()` pueda devolver:
- `Model` legacy hoy
- `SemanticKernel` en modo nuevo

### Paso 4
Mover `expose()` a operar sobre `SemanticKernel`.

### Paso 5
Separar `Appearance` en:
- `ViewOccurrence`
- `LayoutNode`

---

## 17. Resultado esperado

Cuando esto esté implementado:
- OPL será fuente real de autoría
- OPD será una proyección canónica del kernel
- layout no inventará semántica
- roundtrip OPL ↔ OPD será formalizable de forma mucho más limpia
