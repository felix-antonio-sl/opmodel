// packages/core/src/types.ts

// === Enums (string literal unions) ===
export type Essence = "physical" | "informatical";
export type Kind = "object" | "process";
export type Affiliation = "systemic" | "environmental";
export type Perseverance = "static" | "dynamic";
export type ValueType = "integer" | "float" | "string" | "character" | "boolean";
export type FunctionType = "predefined" | "user_defined";
export type TimeUnit = "ms" | "s" | "min" | "h" | "d";
export type OpdType = "hierarchical" | "view";
export type RefinementType = "in-zoom" | "unfold";
export type LinkType =
  | "effect" | "consumption" | "result" | "input" | "output"
  | "agent" | "instrument"
  | "aggregation" | "exhibition" | "generalization" | "classification" | "tagged"
  | "invocation" | "exception";
export type ModifierType = "event" | "condition";
export type FanType = "xor" | "or" | "and";
export type AssertionCategory = "safety" | "liveness" | "correctness";
export type ValidationLevel = "hard" | "soft";
export type SyncStatus = "synced" | "pending" | "unloaded" | "disconnected";
export type SystemType = "artificial" | "natural" | "social" | "socio-technical";
export type Direction = "unidirectional" | "bidirectional" | "reciprocal";
export type StateAlignment = "left" | "top" | "right" | "bottom";
export type OplEssenceVisibility = "all" | "non_default" | "none";
export type OplUnitsVisibility = "always" | "hide" | "when_applicable";
export type OpdNameFormat = "full" | "short";
export type OpdRearranging = "automatic" | "manual" | "inherited";

// === Primitives ===
export interface Duration {
  nominal: number;
  min?: number;
  max?: number;
  unit: TimeUnit;
  distribution?: { name: string; params: Record<string, number> }; // ISO §9.5.4.1: e.g. {name:"normal", params:{mean:45.6, sd:7.3}}
}

export interface Range {
  min: number;
  max: number;
  min_inclusive: boolean;
  max_inclusive: boolean;
}

export interface Position {
  x: number;
  y: number;
}

export interface Style {
  fill_color?: string;
  text_color?: string;
  border_color?: string;
}

export interface Rate {
  value: number;
  unit: string;
}

// === Computational ===
export interface ComputationalObject {
  value: unknown;
  value_type: ValueType;
  unit?: string;
  alias?: string;
  ranges?: Range[];
  default_value?: unknown;
}

export interface ComputationalProcess {
  function_type: FunctionType;
  function_name?: string;
  function_code?: string;
}

// === Requirement sub-types ===
export interface RequirementAttribute {
  name: string;
  value: string;
  validation: ValidationLevel;
}

export interface RequirementStereotype {
  essence: string;
  actual_name: string;
  attributes: RequirementAttribute[];
}

// === Entities ===
export interface Thing {
  id: string;
  kind: Kind;
  name: string;
  essence: Essence;
  affiliation: Affiliation;
  perseverance?: Perseverance;
  duration?: Duration;
  notes?: string;
  hyperlinks?: string[];
  user_input_enabled?: boolean;
  computational?: ComputationalObject | ComputationalProcess;
  stateful?: boolean; // ISO 19450 §3.66/§3.67. undefined ≡ true (backwards-compatible)
}

export interface State {
  id: string;
  parent: string;
  name: string;
  initial: boolean;
  final: boolean;
  default: boolean;
  current?: boolean;
  duration?: Duration;
  hyperlinks?: string[];
}

export interface OPD {
  id: string;
  name: string;
  opd_type: OpdType;
  parent_opd: string | null;
  refines?: string;
  refinement_type?: RefinementType;
}

/**
 * Reified morphism in C_OPM (DA-10). Links are 1-cells relating Things,
 * reified as entities with IDs via Yoneda embedding y: C_OPM → [C_OPM^op, Set].
 * Links do NOT compose (no f:A→B ∘ g:B→C = h:A→C). This is correct for OPM:
 * links are typed relations between objects and processes, not arrows in a free category.
 * Cascade deletion preserves ontological dependency: no endpoints → no link (I-05).
 */
export interface Link {
  id: string;
  type: LinkType;
  source: string;
  target: string;
  source_state?: string;
  target_state?: string;
  multiplicity_source?: string;
  multiplicity_target?: string;
  probability?: number;
  rate?: Rate;
  path_label?: string;
  tag?: string;
  direction?: Direction;
  tag_reverse?: string;
  ordered?: boolean;
  invocation_interval?: Duration;
  discriminating?: boolean;
  discriminating_values?: string[];
  incomplete?: boolean; // ISO 19450: partial/incomplete structures
  exception_type?: "overtime" | "undertime"; // ISO §9.5.4. Only when type === "exception"
  distributed?: boolean; // ISO §14.2.2.4.1: link targets parent contour, applies to all subprocesses
  hyperlinks?: string[];
  vertices?: Position[];
}

/**
 * Modifier decorates a link with event/condition semantics (ISO §8.2).
 * Not categorical 2-cells: no vertical or horizontal composition.
 * Modifiers annotate links (1-cells) but do not form a higher morphism algebra.
 */
export interface Modifier {
  id: string;
  over: string;
  type: ModifierType;
  negated?: boolean;
  condition_mode?: "skip" | "wait"; // ISO §8.2.3. Only when type === "condition". Default: "wait"
}

/**
 * Appearance: fibration π + layout data combined (legacy type).
 * Semantic fields: thing, opd (define fibration π: which thing in which OPD),
 *   internal (in-zoom containment role), semi_folded (aggregation display mode).
 * Layout fields: x, y, w, h, pinned, auto_sizing, state_alignment, style.
 * In SemanticKernel architecture, these concerns are separated:
 *   semantic → OpdAtlas (occurrences, slices)
 *   layout  → LayoutModel (nodes, edges)
 */
export interface Appearance {
  thing: string;         // SEMANTIC: defines fibration π
  opd: string;           // SEMANTIC: defines fibration π
  x: number;             // LAYOUT
  y: number;             // LAYOUT
  w: number;             // LAYOUT
  h: number;             // LAYOUT
  internal?: boolean;    // SEMANTIC: in-zoom containment role
  pinned?: boolean;      // LAYOUT hint
  auto_sizing?: boolean; // LAYOUT hint
  state_alignment?: StateAlignment; // LAYOUT hint
  suppressed_states?: string[];     // DEPRECATED: computed by resolveOpdFiber
  semi_folded?: boolean;            // SEMANTIC: aggregation display mode
  style?: Style;                    // LAYOUT
}

/**
 * Fan: grouped links sharing a common endpoint with XOR/OR/AND constraint semantics.
 * Not categorical cones/cocones — fans are shared-endpoint structures with
 * combinatorial semantics (ISO §12.2-12.3), not universal morphisms.
 */
export interface Fan {
  id: string;
  type: FanType;
  direction?: "converging" | "diverging"; // ISO §12.2-12.3: Tables 17-21 define distinct semantics per direction
  members: string[]; // link IDs grouped by this fan
  incomplete?: boolean; // ISO §10.3.2: partial structure marker (on triangle, not individual links)
  member_multiplicities?: Record<string, string>; // link ID → multiplicity expression (ISO §11.1)
}

export interface Scenario {
  id: string;
  name: string;
  path_labels: string[];
}

export interface Assertion {
  id: string;
  target?: string;
  predicate: string;
  category: AssertionCategory;
  enabled: boolean;
}

export interface Requirement {
  id: string;
  target: string;
  name: string;
  description?: string;
  req_id?: string;
  stereotype?: RequirementStereotype;
  hyperlinks?: string[];
}

export interface Stereotype {
  id: string;
  thing: string;
  stereotype_id: string;
  global: boolean;
  hyperlinks?: string[];
}

export interface SubModel {
  id: string;
  name: string;
  path: string;
  shared_things: string[];
  sync_status: SyncStatus;
}

export interface Meta {
  name: string;
  description?: string;
  system_type?: SystemType;
  created: string;
  modified: string;
}

export interface Settings {
  opl_language?: string;
  opl_essence_visibility?: OplEssenceVisibility;
  opl_units_visibility?: OplUnitsVisibility;
  opl_alias_visibility?: boolean;
  opl_highlight_opd?: boolean;
  opl_highlight_opl?: boolean;
  opl_color_sync?: boolean;
  autoformat?: boolean;
  autosave_interval_s?: number;
  decimal_precision?: number;
  notes_visible?: boolean;
  opd_name_format?: OpdNameFormat;
  opd_rearranging?: OpdRearranging;
  primary_essence?: Essence;
  range_validation_design?: ValidationLevel;
  range_validation_simulation?: ValidationLevel;
  methodology_coaching?: boolean;
}

/**
 * Readonly view over OPM semantic data. Both Model and SemanticKernel
 * satisfy this structurally (SemanticThing extends Thing, etc.).
 * Use for functions that read domain data without needing appearances/layout.
 */
export type OpmDataView = {
  readonly things: ReadonlyMap<string, Thing>;
  readonly states: ReadonlyMap<string, State>;
  readonly links: ReadonlyMap<string, Link>;
  readonly opds: ReadonlyMap<string, OPD>;
  readonly modifiers: ReadonlyMap<string, Modifier>;
  readonly fans: ReadonlyMap<string, Fan>;
  readonly scenarios: ReadonlyMap<string, Scenario>;
  readonly assertions: ReadonlyMap<string, Assertion>;
  readonly requirements: ReadonlyMap<string, Requirement>;
};

// === Model (in-memory graph) ===
export interface Model {
  opmodel: string;
  meta: Meta;
  settings: Settings;
  things: Map<string, Thing>;
  states: Map<string, State>;
  opds: Map<string, OPD>;
  links: Map<string, Link>;
  modifiers: Map<string, Modifier>;
  appearances: Map<string, Appearance>; // key: `${thing}::${opd}`
  fans: Map<string, Fan>;
  scenarios: Map<string, Scenario>;
  assertions: Map<string, Assertion>;
  requirements: Map<string, Requirement>;
  stereotypes: Map<string, Stereotype>;
  subModels: Map<string, SubModel>;
}
