import type { VisualRenderSpec } from "@opmodel/core";
import type { DiagramLLMMessage } from "./types";

function fencedJson(value: unknown) {
  return `\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

export function buildDiagramRenderSystemPrompt(stylePack: string): string {
  return [
    "You are a diagram renderer, not a semantic modeler.",
    "Your task is to generate SVG only from the provided VisualRenderSpec.",
    `Use the style pack \"${stylePack}\" as the visual target.`,
    "Do not invent nodes, edges, labels, or OPM relations not present in the spec.",
    "Preserve process vs object distinction visually.",
    "Respect lane structure, visual hierarchy, and semantic guardrails.",
    "Return raw SVG only, with no markdown fences.",
  ].join(" ");
}

export function buildDiagramRenderUserPrompt(spec: VisualRenderSpec): string {
  return [
    `Render an SVG for the OPM diagram \"${spec.title}\" (${spec.diagramKind}).`,
    "Use this VisualRenderSpec as the only semantic source of truth:",
    fencedJson(spec),
    "Honor these guardrails exactly:",
    ...spec.guardrails.map((guardrail, index) => `${index + 1}. ${guardrail}`),
    "Return only the SVG document.",
  ].join("\n");
}

export function buildDiagramRenderMessages(spec: VisualRenderSpec, stylePack: string): DiagramLLMMessage[] {
  return [
    { role: "system", content: buildDiagramRenderSystemPrompt(stylePack) },
    { role: "user", content: buildDiagramRenderUserPrompt(spec) },
  ];
}
