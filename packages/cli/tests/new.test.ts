// packages/cli/tests/new.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { executeNew } from "../src/commands/new";
import { CliError } from "../src/format";

describe("opmod new", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "opmod-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  it("creates a new .opmodel file with slugified name", () => {
    const result = executeNew("Coffee Making System", { cwd: dir });
    expect(result.filePath).toBe(join(dir, "coffee-making-system.opmodel"));
    expect(existsSync(result.filePath)).toBe(true);
  });

  it("sets model name correctly", () => {
    const result = executeNew("Coffee Making System", { cwd: dir });
    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain('"name": "Coffee Making System"');
  });

  it("sets system_type when --type provided", () => {
    const result = executeNew("Test", { type: "artificial", cwd: dir });
    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain('"system_type": "artificial"');
  });

  it("throws CliError if file already exists", () => {
    writeFileSync(join(dir, "test.opmodel"), "{}");
    expect(() => executeNew("Test", { cwd: dir })).toThrow(CliError);
  });

  it("overwrites with --force", () => {
    writeFileSync(join(dir, "test.opmodel"), "old content");
    const result = executeNew("Test", { force: true, cwd: dir });
    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain('"name": "Test"');
  });

  it("returns model name and file path", () => {
    const result = executeNew("My Model", { cwd: dir });
    expect(result.name).toBe("My Model");
    expect(result.filePath).toContain("my-model.opmodel");
  });
});
