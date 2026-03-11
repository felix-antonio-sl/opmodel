// packages/cli/tests/update.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { executeUpdate } from "../src/commands/update";
import { executeAdd } from "../src/commands/add";
import { createModel, saveModel } from "@opmodel/core";
import { CliError } from "../src/format";
import { readModel } from "../src/io";

function setupModel(dir: string, name = "Test") {
  const model = createModel(name, "artificial");
  const filePath = join(dir, "test.opmodel");
  writeFileSync(filePath, saveModel(model));
  return filePath;
}

describe("opmod update thing", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates thing name and essence via flags", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    const result = executeUpdate("thing", "obj-water", { name: "Hot Water", essence: "informational", file: filePath });
    expect(result.type).toBe("thing");
    expect(result.id).toBe("obj-water");

    const { model } = readModel(filePath);
    expect(model.things.get("obj-water")!.name).toBe("Hot Water");
    expect(model.things.get("obj-water")!.essence).toBe("informational");
  });

  it("updates thing via --input JSON", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    const result = executeUpdate("thing", "obj-water", {
      input: '{"name":"Ice Water","essence":"informational"}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    const thing = model.things.get("obj-water")!;
    expect(thing.name).toBe("Ice Water");
    expect(thing.essence).toBe("informational");
  });

  it("--input strips id field", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeUpdate("thing", "obj-water", {
      input: '{"id":"obj-hacked","name":"Safe Water"}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.things.has("obj-hacked")).toBe(false);
    expect(model.things.get("obj-water")!.name).toBe("Safe Water");
  });

  it("--input takes precedence over flags", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeUpdate("thing", "obj-water", {
      name: "Ignored",
      input: '{"name":"From Input"}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.things.get("obj-water")!.name).toBe("From Input");
  });

  it("throws on non-existent thing", () => {
    const filePath = setupModel(dir);
    expect(() =>
      executeUpdate("thing", "obj-missing", { name: "X", file: filePath })
    ).toThrow(CliError);
  });

  it("throws on empty patch", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    expect(() =>
      executeUpdate("thing", "obj-water", { file: filePath })
    ).toThrow(CliError);
  });

  it("throws on invalid JSON in --input", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    expect(() =>
      executeUpdate("thing", "obj-water", { input: "{bad json", file: filePath })
    ).toThrow(CliError);
  });
});
