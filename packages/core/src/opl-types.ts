// packages/core/src/opl-types.ts
import type {
  Kind, Essence, Affiliation, TimeUnit, LinkType, ModifierType,
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
}

export interface OplStateEnumeration {
  kind: "state-enumeration";
  thingId: string;
  thingName: string;
  stateIds: string[];
  stateNames: string[];
}

export interface OplDuration {
  kind: "duration";
  thingId: string;
  thingName: string;
  nominal: number;
  unit: TimeUnit;
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
  incomplete?: boolean;
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
}

export type OplSentence =
  | OplThingDeclaration
  | OplStateEnumeration
  | OplDuration
  | OplLinkSentence
  | OplModifierSentence;

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
