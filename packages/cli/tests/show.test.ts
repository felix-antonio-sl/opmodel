// packages/cli/tests/show.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { executeShow } from "../src/commands/show";
import { executeAdd } from "../src/commands/add";
import { createModel, saveModel } from "@opmodel/core";
import { CliError } from "../src/format";

function setupModel(dir: string) {
  const model = createModel("Test", "artificial");
  const filePath = join(dir, "test.opmodel");
  writeFileSync(filePath, saveModel(model));
  return filePath;
}

describe("opmod show", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("shows a thing by ID", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    const result = executeShow("obj-water", { file: filePath });
    expect(result.entityType).toBe("thing");
    expect(result.entity).toHaveProperty("name", "Water");
  });

  it("shows a state by ID", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("state", { name: "cold", parent: "obj-water", file: filePath });
    const result = executeShow("state-cold", { file: filePath });
    expect(result.entityType).toBe("state");
  });

  it("shows an OPD by ID", () => {
    const filePath = setupModel(dir);
    const result = executeShow("opd-sd", { file: filePath });
    expect(result.entityType).toBe("opd");
    expect(result.entity).toHaveProperty("name", "SD");
  });

  it("includes associated states when showing a thing", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("state", { name: "cold", parent: "obj-water", file: filePath });
    executeAdd("state", { name: "hot", parent: "obj-water", file: filePath });
    const result = executeShow("obj-water", { file: filePath });
    expect(result.related?.states).toHaveLength(2);
  });

  it("throws on non-existent ID", () => {
    const filePath = setupModel(dir);
    expect(() => executeShow("obj-missing", { file: filePath })).toThrow(CliError);
  });
});
