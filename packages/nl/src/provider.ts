import type { LLMProvider, LLMMessage, LLMOptions, NlConfig } from "./types";

export class ClaudeProvider implements LLMProvider {
  constructor(private apiKey: string, private model = "claude-sonnet-4-6") {}

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const systemMsg = messages.find(m => m.role === "system");
    const nonSystem = messages.filter(m => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        system: systemMsg?.content,
        messages: nonSystem.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Claude API error ${response.status}: ${body}`);
    }
    const data = await response.json() as { content: { text: string }[] };
    const first = data.content[0];
    if (!first) throw new Error("Claude API returned empty content");
    return first.text;
  }
}

export class OpenAIProvider implements LLMProvider {
  constructor(private apiKey: string, private model = "gpt-4o") {}

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_completion_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI API error ${response.status}: ${body}`);
    }
    const data = await response.json() as { choices: { message: { content: string } }[] };
    const first = data.choices[0];
    if (!first) throw new Error("OpenAI API returned empty choices");
    return first.message.content;
  }
}

export function createProvider(config: NlConfig): LLMProvider {
  switch (config.provider) {
    case "claude": return new ClaudeProvider(config.apiKey, config.model);
    case "openai": return new OpenAIProvider(config.apiKey, config.model);
  }
}
