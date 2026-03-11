// packages/cli/tests/validate.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { executeValidate } from "../src/commands/validate";
import { executeAdd } from "../src/commands/add";
import { createModel, saveModel } from "@opmodel/core";

function setupModel(dir: string) {
  const model = createModel("Test", "artificial");
  const filePath = join(dir, "test.opmodel");
  writeFileSync(filePath, saveModel(model));
  return filePath;
}

describe("opmod validate", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("returns valid for clean model", () => {
    const filePath = setupModel(dir);
    const result = executeValidate({ file: filePath });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns summary counts", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    const result = executeValidate({ file: filePath });
    expect(result.summary.things).toBe(1);
    expect(result.summary.opds).toBeGreaterThanOrEqual(1);
  });

  it("validates the coffee-making fixture", () => {
    const fixturePath = join(__dirname, "../../../tests/coffee-making.opmodel");
    const result = executeValidate({ file: fixturePath });
    expect(result.valid).toBe(true);
  });
});
