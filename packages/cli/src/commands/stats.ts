// packages/cli/src/commands/stats.ts
import { resolveModelFile, readModel } from "../io";
import { modelStats, type ModelStats } from "@opmodel/core";

export function executeStats(opts: {
  file?: string;
  json?: boolean;
}): { text?: string; stats?: ModelStats } {
  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);

  const stats = modelStats(model);

  if (opts.json) {
    return { stats };
  }

  const lines: string[] = [
    `Model: ${model.meta.name}`,
    "",
    `Things:       ${stats.things.total} (${stats.things.objects} objects, ${stats.things.processes} processes)`,
    `States:       ${stats.states}`,
    `Links:        ${stats.links.total}`,
  ];

  // Link breakdown
  const linkTypes = Object.entries(stats.links.byType).sort(([, a], [, b]) => b - a);
  for (const [type, count] of linkTypes) {
    lines.push(`  ${type}: ${count}`);
  }

  lines.push(
    `OPDs:         ${stats.opds.total} (max depth: ${stats.opds.maxDepth})`,
    `Appearances:  ${stats.appearances}`,
    `Modifiers:    ${stats.modifiers}`,
    `Fans:         ${stats.fans}`,
    `Scenarios:    ${stats.scenarios}`,
    `Assertions:   ${stats.assertions}`,
    `Requirements: ${stats.requirements}`,
    `OPL Sentences: ${stats.oplSentences}`,
  );

  return { text: lines.join("\n") };
}
