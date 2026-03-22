// packages/core/src/opl-types.ts
import type {
  Kind, Essence, Affiliation, TimeUnit, LinkType, ModifierType, FanType,
  OplEssenceVisibility, OplUnitsVisibility,
  Thing, State, Link, Modifier, Position,
} from "./types";

// === OPL Sentence AST ===

export interface OplThingDeclaration {
  kind: "thing-declaration";
  thingId: string;
  name: string;
  thingKind: Kind;
  essence: Essence;
  affiliation: Affiliation;
  alias?: string;
  exhibitorName?: string;
}

export interface OplStateEnumeration {
  kind: "state-enumeration";
  thingId: string;
  thingName: string;
  stateIds: string[];
  stateNames: string[];
  exhibitorName?: string;
}

export interface OplDuration {
  kind: "duration";
  thingId: string;
  thingName: string;
  nominal: number;
  unit: TimeUnit;
}

export interface OplStateDescription {
  kind: "state-description";
  thingId: string;
  thingName: string;
  stateId: string;
  stateName: string;
  initial: boolean;
  final: boolean;
  default: boolean;
  exhibitorName?: string;
}

export interface OplLinkSentence {
  kind: "link";
  linkId: string;
  linkType: LinkType;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  sourceStateName?: string;
  targetStateName?: string;
  tag?: string;
  direction?: "unidirectional" | "bidirectional" | "reciprocal";
  incomplete?: boolean;
  sourceKind?: Kind;
  targetKind?: Kind;
  multiplicitySource?: string;
  multiplicityTarget?: string;
}

export interface OplModifierSentence {
  kind: "modifier";
  modifierId: string;
  linkId: string;
  linkType: LinkType;
  sourceName: string;
  targetName: string;
  modifierType: ModifierType;
  negated: boolean;
  conditionMode?: "skip" | "wait";
  sourceStateName?: string;
  targetStateName?: string;
}

export interface OplGroupedStructuralSentence {
  kind: "grouped-structural";
  linkType: "aggregation" | "exhibition" | "generalization" | "classification";
  parentId: string;
  parentName: string;
  parentKind: Kind;
  childIds: string[];
  childNames: string[];
  childKinds: Kind[];
  childMultiplicities?: (string | undefined)[];
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
  thingId: string;
  thingName: string;
  exhibitorId: string;
  exhibitorName: string;
  valueName: string;
}

export interface OplFanSentence {
  kind: "fan";
  fanId: string;
  fanType: FanType;
  direction: "converging" | "diverging";
  linkType: LinkType;
  sharedEndpointName: string;
  memberNames: string[];
  memberSourceStateNames?: (string | undefined)[];
  memberTargetStateNames?: (string | undefined)[];
}

export type OplSentence =
  | OplThingDeclaration
  | OplStateEnumeration
  | OplDuration
  | OplLinkSentence
  | OplModifierSentence
  | OplStateDescription
  | OplGroupedStructuralSentence
  | OplInZoomSequence
  | OplAttributeValue
  | OplFanSentence;

export interface OplRenderSettings {
  essenceVisibility: OplEssenceVisibility;
  unitsVisibility: OplUnitsVisibility;
  aliasVisibility: boolean;
  primaryEssence: Essence;
}

export interface OplDocument {
  opdId: string;
  opdName: string;
  sentences: OplSentence[];
  renderSettings: OplRenderSettings;
}

// === OPL Edits ===

export type OplEdit =
  | { kind: "add-thing"; opdId: string; thing: Omit<Thing, "id">; position: Position }
  | { kind: "remove-thing"; thingId: string }
  | { kind: "add-states"; thingId: string; states: Omit<State, "id" | "parent">[] }
  | { kind: "remove-state"; stateId: string }
  | { kind: "add-link"; link: Omit<Link, "id"> }
  | { kind: "remove-link"; linkId: string }
  | { kind: "add-modifier"; modifier: Omit<Modifier, "id"> }
  | { kind: "remove-modifier"; modifierId: string };
