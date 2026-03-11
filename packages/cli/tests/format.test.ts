// packages/cli/tests/format.test.ts
import { describe, it, expect } from "vitest";
import { CliError, handleResult, fatal, formatErrors, formatOutput } from "../src/format";
import { ok, err, type Result } from "@opmodel/core";
import type { InvariantError } from "@opmodel/core";

describe("CliError", () => {
  it("has message and exitCode", () => {
    const e = new CliError("test error", 1);
    expect(e.message).toBe("test error");
    expect(e.exitCode).toBe(1);
    expect(e).toBeInstanceOf(Error);
  });
});

describe("handleResult", () => {
  it("returns value on ok", () => {
    const result = ok("hello");
    expect(handleResult(result, { json: false })).toBe("hello");
  });

  it("throws CliError with exit 1 on err", () => {
    const result = err({ code: "I-08", message: "Duplicate id", entity: "obj-1" });
    expect(() => handleResult(result, { json: false })).toThrow(CliError);
    try {
      handleResult(result, { json: false });
    } catch (e) {
      expect((e as CliError).exitCode).toBe(1);
      expect((e as CliError).message).toContain("I-08");
    }
  });

  it("throws CliError with JSON message when json=true", () => {
    const result = err({ code: "I-08", message: "Duplicate id", entity: "obj-1" });
    try {
      handleResult(result, { json: true });
    } catch (e) {
      const parsed = JSON.parse((e as CliError).message);
      expect(parsed.code).toBe("I-08");
    }
  });
});

describe("fatal", () => {
  it("throws CliError with exit 2", () => {
    expect(() => fatal("file not found")).toThrow(CliError);
    try {
      fatal("file not found");
    } catch (e) {
      expect((e as CliError).exitCode).toBe(2);
      expect((e as CliError).message).toBe("file not found");
    }
  });
});

describe("formatErrors", () => {
  const errors: InvariantError[] = [
    { code: "I-05", message: "Link source not found", entity: "lnk-1" },
    { code: "I-07", message: "Fan must have >= 2 members", entity: "fan-1" },
  ];

  it("formats as human-readable text", () => {
    const output = formatErrors(errors, { json: false });
    expect(output).toContain("I-05");
    expect(output).toContain("I-07");
    expect(output).toContain("2 errors found");
  });

  it("formats as JSON array", () => {
    const output = formatErrors(errors, { json: true });
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].code).toBe("I-05");
  });
});

describe("formatOutput", () => {
  it("returns JSON string when json=true", () => {
    const data = { action: "added", type: "thing", id: "obj-water" };
    const output = formatOutput(data, { json: true });
    expect(JSON.parse(output)).toEqual(data);
  });

  it("returns human-readable when json=false", () => {
    const data = { action: "added", type: "thing", id: "obj-water" };
    const output = formatOutput(data, { json: false });
    expect(output).toContain("obj-water");
  });
});
