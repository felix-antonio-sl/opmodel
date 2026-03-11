// packages/cli/src/io.ts
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { loadModel, saveModel, isOk, type Model } from "@opmodel/core";
import { fatal } from "./format";

export function resolveModelFile(fileOption?: string, cwd?: string): string {
  if (fileOption) return fileOption;

  const dir = cwd ?? process.cwd();
  const files = readdirSync(dir).filter(f => f.endsWith(".opmodel"));

  if (files.length === 0) {
    fatal("No .opmodel file found. Run 'opmod new' or use --file.");
  }
  if (files.length > 1) {
    fatal("Multiple .opmodel files found. Use --file to specify.");
  }
  return join(dir, files[0]!);
}

export function readModel(filePath: string): { model: Model; filePath: string } {
  let json: string;
  try {
    json = readFileSync(filePath, "utf-8");
  } catch {
    fatal(`Cannot read file: ${filePath}`);
  }

  const result = loadModel(json);
  if (!isOk(result)) {
    fatal(`Invalid model file: ${result.error.message}`);
  }
  return { model: result.value, filePath };
}

export function writeModel(model: Model, filePath: string): void {
  const updated: Model = {
    ...model,
    meta: { ...model.meta, modified: new Date().toISOString() },
  };
  const json = saveModel(updated);
  try {
    writeFileSync(filePath, json);
  } catch {
    fatal(`Cannot write file: ${filePath}`);
  }
}
