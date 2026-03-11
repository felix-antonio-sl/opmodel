// packages/cli/tests/io.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { resolveModelFile, readModel, writeModel } from "../src/io";
import { createModel, saveModel } from "@opmodel/core";
import { CliError } from "../src/format";

describe("resolveModelFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "opmod-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  it("returns --file option directly", () => {
    expect(resolveModelFile("/some/path.opmodel", dir)).toBe("/some/path.opmodel");
  });

  it("finds single .opmodel file in directory", () => {
    writeFileSync(join(dir, "test.opmodel"), "{}");
    expect(resolveModelFile(undefined, dir)).toBe(join(dir, "test.opmodel"));
  });

  it("throws CliError when no .opmodel files", () => {
    expect(() => resolveModelFile(undefined, dir)).toThrow(CliError);
    try { resolveModelFile(undefined, dir); } catch (e) {
      expect((e as CliError).exitCode).toBe(2);
      expect((e as CliError).message).toContain("No .opmodel file found");
    }
  });

  it("throws CliError when multiple .opmodel files", () => {
    writeFileSync(join(dir, "a.opmodel"), "{}");
    writeFileSync(join(dir, "b.opmodel"), "{}");
    expect(() => resolveModelFile(undefined, dir)).toThrow(CliError);
    try { resolveModelFile(undefined, dir); } catch (e) {
      expect((e as CliError).exitCode).toBe(2);
      expect((e as CliError).message).toContain("Multiple .opmodel files");
    }
  });
});

describe("readModel", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "opmod-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  it("reads and parses a valid .opmodel file", () => {
    const model = createModel("Test");
    const json = saveModel(model);
    const filePath = join(dir, "test.opmodel");
    writeFileSync(filePath, json);

    const result = readModel(filePath);
    expect(result.model.meta.name).toBe("Test");
    expect(result.filePath).toBe(filePath);
  });

  it("throws CliError on invalid JSON", () => {
    const filePath = join(dir, "bad.opmodel");
    writeFileSync(filePath, "not json");
    expect(() => readModel(filePath)).toThrow(CliError);
  });

  it("throws CliError on missing file", () => {
    expect(() => readModel(join(dir, "missing.opmodel"))).toThrow(CliError);
  });
});

describe("writeModel", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "opmod-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  it("writes model to file", () => {
    const model = createModel("Test");
    const filePath = join(dir, "test.opmodel");
    writeModel(model, filePath);

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain('"name": "Test"');
  });

  it("updates meta.modified timestamp", () => {
    const model = createModel("Test");
    const filePath = join(dir, "test.opmodel");

    writeModel(model, filePath);

    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    expect(new Date(parsed.meta.modified).getTime()).toBeGreaterThanOrEqual(
      new Date(parsed.meta.created).getTime()
    );
  });
});
