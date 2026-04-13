import type { DiagramLLMConfig } from "./types";

const STORAGE_KEY = "opmodel:nl-config";

export function loadStoredDiagramLLMConfig(): DiagramLLMConfig | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DiagramLLMConfig>;
    if (!parsed.provider || !parsed.apiKey) return null;
    if (parsed.provider !== "claude" && parsed.provider !== "openai") return null;
    return {
      provider: parsed.provider,
      apiKey: parsed.apiKey,
      ...(parsed.model ? { model: parsed.model } : {}),
    };
  } catch {
    return null;
  }
}
