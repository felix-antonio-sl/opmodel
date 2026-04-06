import { describe, expect, it } from "vitest";
import { parseOplDocument, parseOplDocuments, render } from "../src/index";

const SIMPLE_SD = [
  "Water is an object, physical.",
  "Water can be cold or hot.",
  "State cold of Water is initial and default.",
  "State hot of Water is final.",
  "Boiling is a process, physical.",
  "Boiling requires 5min.",
  "Barista is an object, physical.",
  "Coffee Machine is an object, physical.",
  "Barista handles Boiling.",
  "Boiling requires Coffee Machine.",
  "Boiling changes Water from cold to hot.",
].join("\n");

describe("parseOplDocument", () => {
  it("parses the initial canonical subset", () => {
    const result = parseOplDocument(SIMPLE_SD, "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.value;

    expect(doc.opdName).toBe("SD");
    expect(doc.sentences.some((s) => s.kind === "thing-declaration")).toBe(true);
    expect(doc.sentences.some((s) => s.kind === "state-enumeration")).toBe(true);
    expect(doc.sentences.some((s) => s.kind === "state-description")).toBe(true);
    expect(doc.sentences.some((s) => s.kind === "duration")).toBe(true);
    expect(doc.sentences.filter((s) => s.kind === "link")).toHaveLength(3);
    expect(doc.sentences.every((s) => s.sourceSpan != null)).toBe(true);
  });

  it("round-trips the supported subset through render()", () => {
    const result = parseOplDocument(SIMPLE_SD, "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(render(result.value)).toBe(SIMPLE_SD);
  });

  it("returns structured issues for unsupported lines", () => {
    const result = parseOplDocument("Cup consists of Water.", "SD", "opd-sd");
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]!.message).toContain("Unsupported");
  });
});

describe("parseOplDocuments", () => {
  it("parses renderAll()-style section headers", () => {
    const text = [
      "=== SD ===",
      SIMPLE_SD,
      "",
      "=== SD2 ===",
      "Coffee is an object, physical.",
    ].join("\n");

    const result = parseOplDocuments(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
    expect(result.value[0]!.opdName).toBe("SD");
    expect(result.value[1]!.opdName).toBe("SD2");
  });

  it("fails if content appears before a section header", () => {
    const result = parseOplDocuments("Water is an object, physical.");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Expected section header");
  });
});
