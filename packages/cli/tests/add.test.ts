// packages/cli/tests/add.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
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

describe("opmod add thing", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("adds a thing with flags", () => {
    const filePath = setupModel(dir);
    const result = executeAdd("thing", {
      name: "Water", kind: "object", essence: "physical",
      file: filePath,
    });
    expect(result.id).toBe("obj-water");
    expect(result.type).toBe("thing");

    const { model } = readModel(filePath);
    expect(model.things.has("obj-water")).toBe(true);
    expect(model.things.get("obj-water")!.name).toBe("Water");
  });

  it("adds a thing with --input JSON", () => {
    const filePath = setupModel(dir);
    const result = executeAdd("thing", {
      input: '{"id":"obj-custom","kind":"object","name":"Custom","essence":"physical","affiliation":"systemic"}',
      file: filePath,
    });
    expect(result.id).toBe("obj-custom");
  });

  it("defaults affiliation to systemic", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", {
      name: "Water", kind: "object", essence: "physical",
      file: filePath,
    });
    const { model } = readModel(filePath);
    expect(model.things.get("obj-water")!.affiliation).toBe("systemic");
  });

  it("generates process ID with proc- prefix", () => {
    const filePath = setupModel(dir);
    const result = executeAdd("thing", {
      name: "Heating", kind: "process", essence: "physical",
      file: filePath,
    });
    expect(result.id).toBe("proc-heating");
  });

  it("uses custom --id when provided", () => {
    const filePath = setupModel(dir);
    const result = executeAdd("thing", {
      name: "Water", kind: "object", essence: "physical",
      id: "my-custom-id", file: filePath,
    });
    expect(result.id).toBe("my-custom-id");
  });

  it("throws on duplicate ID", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    expect(() =>
      executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath })
    ).toThrow(CliError);
  });
});

describe("opmod add state", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("adds a state with defaults", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    const result = executeAdd("state", { name: "cold", parent: "obj-water", file: filePath });
    expect(result.id).toBe("state-cold");

    const { model } = readModel(filePath);
    const state = model.states.get("state-cold")!;
    expect(state.initial).toBe(false);
    expect(state.final).toBe(false);
    expect(state.default).toBe(false);
  });

  it("sets boolean flags", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("state", {
      name: "cold", parent: "obj-water", initial: true, default: true,
      file: filePath,
    });
    const { model } = readModel(filePath);
    const state = model.states.get("state-cold")!;
    expect(state.initial).toBe(true);
    expect(state.default).toBe(true);
    expect(state.final).toBe(false);
  });
});

describe("opmod add link", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("adds a link", () => {
    const filePath = setupModel(dir);
    executeAdd("thing", { name: "Barista", kind: "object", essence: "physical", file: filePath });
    executeAdd("thing", { name: "Heating", kind: "process", essence: "physical", file: filePath });
    const result = executeAdd("link", {
      type: "agent", source: "obj-barista", target: "proc-heating",
      file: filePath,
    });
    expect(result.id).toBe("lnk-agent-obj-barista-proc-heating");
  });
});

describe("opmod add opd", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("adds a hierarchical OPD", () => {
    const filePath = setupModel(dir);
    const result = executeAdd("opd", {
      name: "SD1", parent: "opd-sd",
      file: filePath,
    });
    expect(result.id).toBe("opd-sd1");

    const { model } = readModel(filePath);
    const opd = model.opds.get("opd-sd1")!;
    expect(opd.opd_type).toBe("hierarchical");
    expect(opd.parent_opd).toBe("opd-sd");
  });

  it("infers view type when no parent", () => {
    const filePath = setupModel(dir);
    const result = executeAdd("opd", {
      name: "Custom View", opdType: "view",
      file: filePath,
    });
    expect(result.id).toBe("opd-custom-view");
    const { model } = readModel(filePath);
    expect(model.opds.get("opd-custom-view")!.opd_type).toBe("view");
    expect(model.opds.get("opd-custom-view")!.parent_opd).toBeNull();
  });
});

describe("opmod add <invalid>", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "opmod-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true }); });

  it("throws on unknown entity type", () => {
    const filePath = setupModel(dir);
    expect(() => executeAdd("unknown" as any, { name: "x", file: filePath })).toThrow(CliError);
  });
});
