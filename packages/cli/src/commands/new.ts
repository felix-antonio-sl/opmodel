// packages/cli/src/commands/new.ts
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { createModel, saveModel, type SystemType } from "@opmodel/core";
import { fatal } from "../format";
import { slug } from "../slug";

interface NewOptions {
  type?: SystemType;
  force?: boolean;
  cwd?: string;
}

interface NewResult {
  name: string;
  filePath: string;
}

export function executeNew(name: string, opts: NewOptions = {}): NewResult {
  const dir = opts.cwd ?? process.cwd();
  const fileName = `${slug(name)}.opmodel`;
  const filePath = join(dir, fileName);

  if (existsSync(filePath) && !opts.force) {
    fatal(`File already exists: ${filePath}. Use --force to overwrite.`);
  }

  const model = createModel(name, opts.type);
  const json = saveModel(model);
  try {
    writeFileSync(filePath, json);
  } catch {
    fatal(`Cannot write file: ${filePath}`);
  }

  return { name, filePath };
}
