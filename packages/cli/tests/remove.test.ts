// packages/cli/tests/remove.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { executeRemove } from "../src/commands/remove";
import { executeAdd } from "../src/commands/add";
import { createModel, saveModel } from "@opmodel/core";
import { CliError } from "../src/format";
import { readModel } from "../src/io";

function setupModel(dir: string) {
  const model = createModel("Test", "artificial");
  const filePath = join(dir, "test.opmodel");
  writeFileSync(filePath, saveModel(model));
  return filePath;
}

describe("opmod remove", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("removes a thing", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    const result = executeRemove("thing", "obj-water", { file: filePath });
    expect(result.id).toBe("obj-water");

    const { model } = readModel(filePath);
    expect(model.things.has("obj-water")).toBe(false);
  });

  it("removes a state", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("state", { name: "cold", parent: "obj-water", file: filePath });
    executeRemove("state", "state-cold", { file: filePath });

    const { model } = readModel(filePath);
    expect(model.states.has("state-cold")).toBe(false);
  });

  it("throws on non-existent entity", () => {
    const filePath = setupModel(dir);
    expect(() => executeRemove("thing", "obj-missing", { file: filePath })).toThrow(CliError);
  });

  it("dry-run does not write to disk", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    const result = executeRemove("thing", "obj-water", { file: filePath, dryRun: true });
    expect(result.dryRun).toBe(true);

    const { model } = readModel(filePath);
    expect(model.things.has("obj-water")).toBe(true); // still there
  });

  it("reports cascade summary for removeThing", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("state", { name: "cold", parent: "obj-water", file: filePath });
    executeAdd("state", { name: "hot", parent: "obj-water", file: filePath });
    const result = executeRemove("thing", "obj-water", { file: filePath });
    expect(result.cascade.states).toBe(2);
  });

  it("throws on unknown entity type", () => {
    const filePath = setupModel(dir);
    expect(() => executeRemove("unknown" as any, "x", { file: filePath })).toThrow(CliError);
  });
});
