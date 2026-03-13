import type { LLMProvider, NlContext, NlResult, NlPipeline } from "./types";
import { parse } from "./parse";
import { resolve } from "./resolve";
import { buildSystemPrompt, buildContextMessage, buildUserMessage } from "./prompt";
import { applyOplEdit, expose, render } from "@opmodel/core";

export function createPipeline(config: { provider: LLMProvider }): NlPipeline {
  return {
    async generate(nl: string, context: NlContext): Promise<NlResult> {
      // Input validation
      const trimmed = nl.trim();
      if (!trimmed) throw new Error("Empty input");
      if (trimmed.length > 10000) throw new Error("Input too long (max 10000 characters)");

      // Build messages (context + user merged in single user message for API alternation)
      const messages = [
        { role: "system" as const, content: buildSystemPrompt() },
        { role: "user" as const, content: buildContextMessage(context.model, context.opdId)
            + "\n\n" + buildUserMessage(trimmed) },
      ];

      // Call LLM
      const raw = await config.provider.complete(messages, { temperature: 0 });

      // Parse response
      const parseResult = parse(raw);
      if (!parseResult.ok) throw new Error(`Parse error: ${parseResult.error.message}`);
      const descriptors = parseResult.value;

      // Resolve names -> IDs
      const resolveResult = resolve(descriptors, context.model, context.opdId);
      if (!resolveResult.ok) throw new Error(`Resolve error: ${resolveResult.error.message}`);
      const edits = resolveResult.value;

      // Compute preview
      let projected = context.model;
      for (const edit of edits) {
        const r = applyOplEdit(projected, edit);
        if (r.ok) projected = r.value;
      }
      const preview = render(expose(projected, context.opdId));

      return { edits, descriptors, preview };
    },
  };
}
