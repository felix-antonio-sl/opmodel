// packages/cli/tests/list.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { executeList } from "../src/commands/list";
import { executeAdd } from "../src/commands/add";
import { createModel, saveModel } from "@opmodel/core";

function setupModelWithThings(dir: string) {
  const model = createModel("Test", "artificial");
  const filePath = join(dir, "test.opmodel");
  writeFileSync(filePath, saveModel(model));
  executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
  executeAdd("thing", { name: "Heating", kind: "process", essence: "physical", file: filePath });
  executeAdd("state", { name: "cold", parent: "obj-water", file: filePath });
  executeAdd("state", { name: "hot", parent: "obj-water", file: filePath });
  return filePath;
}

describe("opmod list things", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("lists all things", () => {
    const filePath = setupModelWithThings(dir);
    const result = executeList("things", { file: filePath });
    expect(result.entities).toHaveLength(2);
  });

  it("filters by kind", () => {
    const filePath = setupModelWithThings(dir);
    const result = executeList("things", { kind: "object", file: filePath });
    expect(result.entities).toHaveLength(1);
    expect((result.entities[0] as any).kind).toBe("object");
  });
});

describe("opmod list states", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("lists all states", () => {
    const filePath = setupModelWithThings(dir);
    const result = executeList("states", { file: filePath });
    expect(result.entities).toHaveLength(2);
  });

  it("filters by parent", () => {
    const filePath = setupModelWithThings(dir);
    const result = executeList("states", { parent: "obj-water", file: filePath });
    expect(result.entities).toHaveLength(2);
    const result2 = executeList("states", { parent: "proc-heating", file: filePath });
    expect(result2.entities).toHaveLength(0);
  });
});

describe("opmod list links", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("lists all links (empty model)", () => {
    const filePath = setupModelWithThings(dir);
    const result = executeList("links", { file: filePath });
    expect(result.entities).toHaveLength(0);
  });
});

describe("opmod list opds", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("lists OPDs including root SD", () => {
    const filePath = setupModelWithThings(dir);
    const result = executeList("opds", { file: filePath });
    expect(result.entities.length).toBeGreaterThanOrEqual(1); // at least opd-sd
  });
});
