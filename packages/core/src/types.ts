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
  hyperlinks?: string[];
  vertices?: Position[];
}

export interface Modifier {
  id: string;
  over: string;
  type: ModifierType;
  negated?: boolean;
  condition_mode?: "skip" | "wait"; // ISO §8.2.3. Only when type === "condition". Default: "wait"
}

export interface Appearance {
  thing: string;
  opd: string;
  x: number;
  y: number;
  w: number;
  h: number;
  internal?: boolean;
  pinned?: boolean;
  auto_sizing?: boolean;
  state_alignment?: StateAlignment;
  suppressed_states?: string[];
  semi_folded?: boolean;
  style?: Style;
}

export interface Fan {
  id: string;
  type: FanType;
  members: string[];
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
