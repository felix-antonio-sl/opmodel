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

describe("opmod update state", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("toggles boolean flags (--no-initial --final)", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("state", { name: "cold", parent: "obj-water", initial: true, file: filePath });

    executeUpdate("state", "state-cold", { initial: false, final: true, file: filePath });

    const { model } = readModel(filePath);
    const state = model.states.get("state-cold")!;
    expect(state.initial).toBe(false);
    expect(state.final).toBe(true);
  });
});

describe("opmod update link", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates link target-state via flag", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("thing", { name: "Heating", kind: "process", essence: "physical", file: filePath });
    executeAdd("state", { name: "cold", parent: "obj-water", file: filePath });
    executeAdd("state", { name: "hot", parent: "obj-water", file: filePath });
    executeAdd("link", {
      type: "effect", source: "proc-heating", target: "obj-water",
      file: filePath,
    });

    const linkId = "lnk-effect-proc-heating-obj-water";
    executeUpdate("link", linkId, {
      targetState: "state-hot",
      file: filePath,
    });

    const { model } = readModel(filePath);
    const link = model.links.get(linkId)!;
    expect(link.target_state).toBe("state-hot");
  });
});

describe("opmod update opd", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates OPD name via flag", () => {
    const filePath = setupModel(dir);
    executeAdd("opd", { name: "Custom View", opdType: "view", file: filePath });

    executeUpdate("opd", "opd-custom-view", { name: "Main View", file: filePath });

    const { model } = readModel(filePath);
    expect(model.opds.get("opd-custom-view")!.name).toBe("Main View");
  });

  it("maps opdType flag to opd_type and parent to parent_opd via --input", () => {
    const filePath = setupModel(dir);
    executeAdd("opd", { name: "SD1", parent: "opd-sd", file: filePath });

    executeUpdate("opd", "opd-sd1", {
      input: '{"opd_type":"view","parent_opd":null}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.opds.get("opd-sd1")!.opd_type).toBe("view");
    expect(model.opds.get("opd-sd1")!.parent_opd).toBeNull();
  });
});

describe("opmod update meta", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates meta name and description via flags", () => {
    const filePath = setupModel(dir);

    executeUpdate("meta", undefined, { name: "Renamed", description: "A new description", file: filePath });

    const { model } = readModel(filePath);
    expect(model.meta.name).toBe("Renamed");
    expect(model.meta.description).toBe("A new description");
  });

  it("--input strips created and modified", () => {
    const filePath = setupModel(dir);

    executeUpdate("meta", undefined, {
      input: '{"name":"Hacked","created":"1970-01-01","modified":"1970-01-01"}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.meta.name).toBe("Hacked");
    expect(model.meta.created).not.toBe("1970-01-01");
  });
});

describe("opmod update settings", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("updates settings via --input", () => {
    const filePath = setupModel(dir);

    executeUpdate("settings", undefined, {
      input: '{"autosave_interval_s":30,"decimal_precision":5}',
      file: filePath,
    });

    const { model } = readModel(filePath);
    expect(model.settings.autosave_interval_s).toBe(30);
    expect(model.settings.decimal_precision).toBe(5);
  });

  it("throws without --input", () => {
    const filePath = setupModel(dir);
    expect(() =>
      executeUpdate("settings", undefined, { file: filePath })
    ).toThrow(CliError);
  });
});

describe("opmod update <invalid>", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("throws on unknown entity type", () => {
    const filePath = setupModel(dir);
    expect(() => executeUpdate("unknown" as any, "x", { file: filePath })).toThrow(CliError);
  });
});
