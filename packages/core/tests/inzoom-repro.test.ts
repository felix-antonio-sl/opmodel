import { describe, it, expect } from "vitest";
import { parseOplDocument, parseOplDocuments } from "../src/opl-parse";
import { compileOplDocument, compileOplDocuments } from "../src/opl-compile";
import { expose, render, renderAll } from "../src/opl";

const MULTIWORD_INZOOM = [
  "Water Heating is a process, physical.",
  "Water Filling is a process, physical.",
  "Water Boiling is a process, physical.",
  "Coffee Brewing is a process, physical.",
  "Water Heating zooms into Water Filling, Water Boiling, and Coffee Brewing, in that sequence.",
].join("\n");

const TWO_MULTIWORD = [
  "Data Processing is a process, physical.",
  "Data Collection is a process, physical.",
  "Report Generation is a process, physical.",
  "Data Processing zooms into Data Collection and Report Generation, in that sequence.",
].join("\n");

const MULTIWORD_ES = [
  "Preparación de Café es un proceso, físico.",
  "Llenado de Agua es un proceso, físico.",
  "Calentamiento de Agua es un proceso, físico.",
  "Preparación de Café se descompone en Llenado de Agua y Calentamiento de Agua, en esa secuencia.",
].join("\n");

describe("in-zoom multi-word roundtrip", () => {
  it("parses 3 multi-word subprocess names correctly", () => {
    const result = parseOplDocument(MULTIWORD_INZOOM);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.value;
    const inzoom = doc.sentences.find(s => s.kind === "in-zoom-sequence");
    expect(inzoom).toBeDefined();
    if (inzoom?.kind === "in-zoom-sequence") {
      expect(inzoom.parentName).toBe("Water Heating");
      const allNames = inzoom.steps.flatMap(s => s.thingNames);
      console.log("Parsed steps:", JSON.stringify(inzoom.steps, null, 2));
      expect(allNames).toContain("Water Filling");
      expect(allNames).toContain("Water Boiling");
      expect(allNames).toContain("Coffee Brewing");
    }
  });

  it("parses 2 multi-word subprocess names correctly", () => {
    const result = parseOplDocument(TWO_MULTIWORD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inzoom = result.value.sentences.find(s => s.kind === "in-zoom-sequence");
    expect(inzoom).toBeDefined();
    if (inzoom?.kind === "in-zoom-sequence") {
      console.log("Two multi-word steps:", JSON.stringify(inzoom.steps, null, 2));
      const allNames = inzoom.steps.flatMap(s => s.thingNames);
      expect(allNames).toContain("Data Collection");
      expect(allNames).toContain("Report Generation");
    }
  });

  it("parses Spanish multi-word subprocess names", () => {
    const result = parseOplDocument(MULTIWORD_ES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inzoom = result.value.sentences.find(s => s.kind === "in-zoom-sequence");
    expect(inzoom).toBeDefined();
    if (inzoom?.kind === "in-zoom-sequence") {
      console.log("ES steps:", JSON.stringify(inzoom.steps, null, 2));
      const allNames = inzoom.steps.flatMap(s => s.thingNames);
      expect(allNames).toContain("Llenado de Agua");
      expect(allNames).toContain("Calentamiento de Agua");
    }
  });

  it("compiles and re-renders preserving multi-word names", () => {
    const docResult = parseOplDocument(MULTIWORD_INZOOM);
    expect(docResult.ok).toBe(true);
    if (!docResult.ok) return;
    const result = compileOplDocument(docResult.value);
    if (!result.ok) {
      console.log("Compile errors:", result.error);
      expect(result.ok).toBe(true);
      return;
    }
    const model = result.value;
    const text = renderAll(model);
    console.log("Rendered OPL:\n" + text);
    expect(text).toContain("Water Filling");
    expect(text).toContain("Water Boiling");
    expect(text).toContain("Coffee Brewing");
    expect(text).toContain("Water Heating zooms into");

    // Re-parse the rendered text (multi-section output)
    const docs2Result = parseOplDocuments(text);
    expect(docs2Result.ok).toBe(true);
    if (!docs2Result.ok) return;
    const allSentences = docs2Result.value.flatMap(d => d.sentences);
    const inzoom2 = allSentences.find(s => s.kind === "in-zoom-sequence");
    expect(inzoom2).toBeDefined();
    if (inzoom2?.kind === "in-zoom-sequence") {
      const allNames2 = inzoom2.steps.flatMap(s => s.thingNames);
      console.log("Re-parsed names:", allNames2);
      expect(allNames2).toContain("Water Filling");
      expect(allNames2).toContain("Water Boiling");
      expect(allNames2).toContain("Coffee Brewing");
    }
  });
});
