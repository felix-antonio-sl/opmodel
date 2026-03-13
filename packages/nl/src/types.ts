import type {
  Model, OplEdit, Essence, Affiliation, LinkType, ModifierType,
} from "@opmodel/core";

// --- NlEditDescriptor: OplEdit in name-space ---

export type NlEditDescriptor =
  | { kind: "add-thing"; name: string; thingKind: "object" | "process";
      essence?: Essence; affiliation?: Affiliation }
  | { kind: "remove-thing"; name: string }
  | { kind: "add-states"; thingName: string; stateNames: string[] }
  | { kind: "remove-state"; thingName: string; stateName: string }
  | { kind: "add-link"; sourceName: string; targetName: string;
      linkType: LinkType; sourceState?: string; targetState?: string }
  | { kind: "remove-link"; sourceName: string; targetName: string;
      linkType: LinkType }
  | { kind: "add-modifier"; sourceName: string; targetName: string;
      linkType: LinkType; modifierType: ModifierType; negated?: boolean }
  | { kind: "remove-modifier"; sourceName: string; targetName: string;
      linkType: LinkType; modifierType: ModifierType };

// --- LLM Provider ---

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
}

// --- Pipeline ---

export interface NlContext {
  model: Model;
  opdId: string;
}

export interface NlResult {
  edits: OplEdit[];
  descriptors: NlEditDescriptor[];
  preview: string;
}

export interface NlPipeline {
  generate(nl: string, context: NlContext): Promise<NlResult>;
}

export interface NlConfig {
  provider: "claude" | "openai";
  apiKey: string;
  model?: string;
}

// --- Errors ---

export interface ParseError {
  raw: string;
  message: string;
  index?: number;
}

export interface ResolveError {
  descriptor: NlEditDescriptor;
  message: string;
  index: number;
}
