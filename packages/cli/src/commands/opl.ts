// packages/cli/src/commands/opl.ts
import { resolveModelFile, readModel } from "../io";
import { fatal } from "../format";
import { expose, render, renderAll, exportMarkdown } from "@opmodel/core";

export function executeOpl(opts: {
  file?: string;
  opd?: string;
  all?: boolean;
  markdown?: boolean;
  json?: boolean;
}): { text?: string; document?: unknown } {
  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);

  // --markdown: full documentation export
  if (opts.markdown) {
    return { text: exportMarkdown(model) };
  }

  // --all: export all OPDs in hierarchical order
  if (opts.all) {
    return { text: renderAll(model) };
  }

  const opdId = opts.opd ?? "opd-sd";

  if (!model.opds.has(opdId)) {
    fatal(`OPD not found: ${opdId}`);
  }

  const doc = expose(model, opdId);

  if (opts.json) {
    return { document: doc };
  }

  return { text: render(doc) };
}
