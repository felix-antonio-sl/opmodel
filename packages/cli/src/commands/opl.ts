// packages/cli/src/commands/opl.ts
import { resolveModelFile, readModel } from "../io";
import { fatal } from "../format";
import { expose, render } from "@opmodel/core";

export function executeOpl(opts: {
  file?: string;
  opd?: string;
  json?: boolean;
}): { text?: string; document?: unknown } {
  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);

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
