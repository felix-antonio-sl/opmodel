import { describe, expect, it } from "vitest";
import { validateOpl } from "../src/index";

describe("validateOpl", () => {
  it("returns ok for valid OPL text", () => {
    const text = [
      "Water is an object, physical.",
      "Water can be cold or hot.",
      "State cold of Water is initial and default.",
      "State hot of Water is final.",
    ].join("\n");

    const result = validateOpl(text);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.phases).toEqual({
      syntax: "pass",
      binding: "pass",
      semantic: "pass",
      canonical: "pass",
    });
  });

  it("fails in V1 on syntax errors and skips later phases", () => {
    const result = validateOpl("This is not valid OPL at all.");

    expect(result.ok).toBe(false);
    expect(result.phases).toEqual({
      syntax: "fail",
      binding: "skip",
      semantic: "skip",
      canonical: "skip",
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      phase: "V1-syntax",
      severity: "error",
      line: 1,
      column: 1,
    });
  });

  it("fails in V2 on binding errors with source locations", () => {
    const text = [
      "Water is an object, physical.",
      "Boiling is a process, physical.",
      "Boiling requires Tea.",
    ].join("\n");

    const result = validateOpl(text);

    expect(result.ok).toBe(false);
    expect(result.phases).toEqual({
      syntax: "pass",
      binding: "fail",
      semantic: "skip",
      canonical: "skip",
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      phase: "V2-binding",
      severity: "error",
      line: 3,
      column: 1,
      sentenceKind: "link",
      opdName: "SD",
    });
  });

  it("fails in V3 on semantic invariant errors and maps them to source spans", () => {
    const text = [
      "Water is an object, physical.",
      "Water can be cold.",
      "Boiling is a process, physical.",
    ].join("\n");

    const result = validateOpl(text);
    const issue = result.issues.find((candidate) => candidate.code === "I-20");

    expect(result.ok).toBe(false);
    expect(result.phases).toEqual({
      syntax: "pass",
      binding: "pass",
      semantic: "fail",
      canonical: "pass",
    });
    expect(issue).toMatchObject({
      phase: "V3-semantic",
      severity: "error",
      line: 1,
      column: 1,
      sentenceKind: "thing-declaration",
      opdName: "SD",
      entity: expect.any(String),
      focusThingName: "Water",
    });
  });

  it("returns canonical warnings without failing overall validation", () => {
    const text = "water is an object, physical.";

    const result = validateOpl(text);

    expect(result.ok).toBe(true);
    expect(result.phases).toEqual({
      syntax: "pass",
      binding: "pass",
      semantic: "pass",
      canonical: "fail",
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      phase: "V4-canonical",
      severity: "warning",
      line: 1,
      column: 1,
      sentenceKind: "thing-declaration",
      opdName: "SD",
    });
  });

  it("uses absolute source lines for multi-OPD documents", () => {
    const text = [
      "=== SD ===",
      "Water is an object, physical.",
      "Boiling is a process, physical.",
      "",
      "=== SD1 ===",
      "Tea is an object, physical.",
      "Boiling requires Coffee.",
    ].join("\n");

    const result = validateOpl(text);

    expect(result.ok).toBe(false);
    expect(result.phases).toEqual({
      syntax: "pass",
      binding: "fail",
      semantic: "skip",
      canonical: "skip",
    });
    expect(result.issues[0]).toMatchObject({
      phase: "V2-binding",
      line: 7,
      column: 1,
      sentenceKind: "link",
      opdName: "SD1",
    });
  });
});
