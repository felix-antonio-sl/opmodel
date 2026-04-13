import type {
  DiagramLLMConfig,
  DiagramLLMGenerateInput,
  DiagramLLMGenerateResult,
  DiagramLLMMessage,
  DiagramLLMProvider,
} from "./types";
import { buildDiagramRenderMessages } from "./prompt";

function extractSvg(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("<svg")) return trimmed;
  const match = trimmed.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) {
    throw new Error("LLM renderer did not return an SVG document.");
  }
  return match[0];
}

abstract class BaseChatDiagramProvider implements DiagramLLMProvider {
  constructor(protected apiKey: string, protected model?: string) {}

  protected abstract complete(messages: DiagramLLMMessage[]): Promise<string>;

  async generateSvg(input: DiagramLLMGenerateInput): Promise<DiagramLLMGenerateResult> {
    const messages = buildDiagramRenderMessages(input.spec, input.stylePack);
    const raw = await this.complete(messages);
    return {
      svg: extractSvg(raw),
      raw,
    };
  }
}

export class ClaudeDiagramProvider extends BaseChatDiagramProvider {
  constructor(apiKey: string, model = "claude-sonnet-4-20250514") {
    super(apiKey, model);
  }

  protected async complete(messages: DiagramLLMMessage[]): Promise<string> {
    const systemMessage = messages.find((message) => message.role === "system");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        temperature: 0,
        system: systemMessage?.content,
        messages: messages
          .filter((message) => message.role !== "system")
          .map((message) => ({ role: message.role, content: message.content })),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Claude API error ${response.status}: ${body}`);
    }

    const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((item) => item.type === "text")?.text;
    if (!text) throw new Error("Claude API returned no text content.");
    return text;
  }
}

export class OpenAIDiagramProvider extends BaseChatDiagramProvider {
  constructor(apiKey: string, model = "gpt-4o") {
    super(apiKey, model);
  }

  protected async complete(messages: DiagramLLMMessage[]): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0,
        max_completion_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI API error ${response.status}: ${body}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI API returned no message content.");
    return text;
  }
}

export function createDiagramLLMProvider(config: DiagramLLMConfig): DiagramLLMProvider {
  switch (config.provider) {
    case "claude":
      return new ClaudeDiagramProvider(config.apiKey, config.model);
    case "openai":
      return new OpenAIDiagramProvider(config.apiKey, config.model);
  }
}
