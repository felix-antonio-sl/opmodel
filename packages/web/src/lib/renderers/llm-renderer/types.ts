import type { VisualRenderSpec } from "@opmodel/core";

export type DiagramLLMProviderKind = "claude" | "openai";

export interface DiagramLLMConfig {
  provider: DiagramLLMProviderKind;
  apiKey: string;
  model?: string;
}

export interface DiagramLLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DiagramLLMGenerateInput {
  spec: VisualRenderSpec;
  stylePack: string;
  systemPrompt: string;
}

export interface DiagramLLMGenerateResult {
  svg: string;
  rationale?: string;
  warnings?: string[];
  raw?: string;
}

export interface DiagramLLMProvider {
  generateSvg(input: DiagramLLMGenerateInput): Promise<DiagramLLMGenerateResult>;
}
