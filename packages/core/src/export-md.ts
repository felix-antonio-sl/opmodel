// packages/core/src/export-md.ts — Markdown documentation export
import type { Model } from "./types";
import { expose, render, renderAll, modelStats } from "./opl";

/** Export full model as structured Markdown documentation. */
export function exportMarkdown(model: Model): string {
  const stats = modelStats(model);
  const lines: string[] = [];

  // Title
  lines.push(`# ${model.meta.name}`);
  if (model.meta.description) {
    lines.push("", model.meta.description);
  }
  lines.push("");

  // Summary
  lines.push("## Summary", "");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Things | ${stats.things.total} (${stats.things.objects} objects, ${stats.things.processes} processes) |`);
  lines.push(`| States | ${stats.states} |`);
  lines.push(`| Links | ${stats.links.total} |`);
  lines.push(`| OPDs | ${stats.opds.total} (max depth: ${stats.opds.maxDepth}) |`);
  lines.push(`| OPL Sentences | ${stats.oplSentences} |`);
  if (stats.fans > 0) lines.push(`| Fans | ${stats.fans} |`);
  if (stats.scenarios > 0) lines.push(`| Scenarios | ${stats.scenarios} |`);
  if (stats.assertions > 0) lines.push(`| Assertions | ${stats.assertions} |`);
  if (stats.requirements > 0) lines.push(`| Requirements | ${stats.requirements} |`);
  lines.push("");

  // Link types breakdown
  const linkTypes = Object.entries(stats.links.byType).sort(([, a], [, b]) => b - a);
  if (linkTypes.length > 0) {
    lines.push("### Link Types", "");
    lines.push("| Type | Count |");
    lines.push("|------|-------|");
    for (const [type, count] of linkTypes) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push("");
  }

  // OPDs hierarchy
  lines.push("## OPD Hierarchy", "");
  const opdEntries = [...model.opds.entries()];
  const childrenOf = new Map<string | null, string[]>();
  for (const [id, opd] of opdEntries) {
    const parent = opd.parent_opd;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(id);
  }

  function renderTree(parentId: string | null, indent: number): void {
    const children = childrenOf.get(parentId) ?? [];
    children.sort((a, b) => {
      const nameA = model.opds.get(a)?.name ?? a;
      const nameB = model.opds.get(b)?.name ?? b;
      return nameA.localeCompare(nameB);
    });
    for (const id of children) {
      const opd = model.opds.get(id)!;
      const prefix = "  ".repeat(indent);
      const refines = opd.refines ? model.things.get(opd.refines)?.name : null;
      const extra = refines ? ` (refines: ${refines})` : "";
      lines.push(`${prefix}- **${opd.name}**${extra}`);
      renderTree(id, indent + 1);
    }
  }
  renderTree(null, 0);
  lines.push("");

  // OPL per OPD
  lines.push("## OPL Specification", "");

  function walkOPDs(parentId: string | null): void {
    const children = childrenOf.get(parentId) ?? [];
    children.sort((a, b) => {
      const nameA = model.opds.get(a)?.name ?? a;
      const nameB = model.opds.get(b)?.name ?? b;
      return nameA.localeCompare(nameB);
    });
    for (const id of children) {
      const opd = model.opds.get(id)!;
      const doc = expose(model, id);
      const text = render(doc);
      if (text.trim()) {
        lines.push(`### ${opd.name}`, "");
        lines.push("```");
        lines.push(text);
        lines.push("```");
        lines.push("");
      }
      walkOPDs(id);
    }
  }
  walkOPDs(null);

  return lines.join("\n");
}
