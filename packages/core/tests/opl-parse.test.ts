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

const SIMPLE_STRUCTURAL_EN = [
  "Car is an object, physical.",
  "Engine is an object, physical.",
  "Wheels is an object, physical.",
  "Car consists of Engine and Wheels.",
  "Engine exhibits Power.",
  "Electric Engine is an Engine.",
  "Model X is an instance of Car.",
].join("\n");

const SIMPLE_STRUCTURAL_ES = [
  "Auto es un objeto, físico.",
  "Motor es un objeto, físico.",
  "Ruedas es un objeto, físico.",
  "Auto consta de Motor y Ruedas.",
  "Motor exhibe Potencia.",
  "Motor Eléctrico es un Motor.",
  "Modelo X es una instancia de Auto.",
].join("\n");

const SIMPLE_INZOOM_EN = [
  "Coffee Making is a process, physical.",
  "Grinding is a process, physical.",
  "Brewing is a process, physical.",
  "Coffee Making zooms into Grinding and Brewing, in that sequence.",
].join("\n");

const SIMPLE_INZOOM_ES = [
  "Preparar Café es un proceso, físico.",
  "Moler es un proceso, físico.",
  "Preparar es un proceso, físico.",
  "Preparar Café se descompone en Moler y Preparar, en esa secuencia.",
].join("\n");

const SIMPLE_SD_ES = [
  "Agua es un objeto, físico.",
  "Agua puede estar fría o caliente.",
  "Estado fría de Agua es inicial y por defecto.",
  "Estado caliente de Agua es final.",
  "Hervir es un proceso, físico.",
  "Hervir requiere 5min.",
  "Barista es un objeto, físico.",
  "Máquina de Café es un objeto, físico.",
  "Barista maneja Hervir.",
  "Hervir requiere Máquina de Café.",
  "Hervir cambia Agua de fría a caliente.",
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

  it("round-trips the supported Spanish subset through render()", () => {
    const result = parseOplDocument(SIMPLE_SD_ES, "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.renderSettings.locale).toBe("es");
    expect(render(result.value)).toBe(SIMPLE_SD_ES);
  });

  it("parses English structural sentences", () => {
    const result = parseOplDocument(SIMPLE_STRUCTURAL_EN, "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.value;
    const structs = doc.sentences.filter(s => s.kind === "grouped-structural");
    expect(structs.length).toBeGreaterThanOrEqual(3); // aggregation + exhibition + classification
  });

  it("parses Spanish structural sentences", () => {
    const result = parseOplDocument(SIMPLE_STRUCTURAL_ES, "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.value;
    expect(doc.renderSettings.locale).toBe("es");
    const structs = doc.sentences.filter(s => s.kind === "grouped-structural");
    expect(structs.length).toBeGreaterThanOrEqual(3);
  });

  it("parses English in-zoom sequence", () => {
    const result = parseOplDocument(SIMPLE_INZOOM_EN, "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.value;
    const inzoom = doc.sentences.find(s => s.kind === "in-zoom-sequence");
    expect(inzoom).toBeDefined();
  });

  it("parses Spanish in-zoom sequence", () => {
    const result = parseOplDocument(SIMPLE_INZOOM_ES, "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.value;
    expect(doc.renderSettings.locale).toBe("es");
    const inzoom = doc.sentences.find(s => s.kind === "in-zoom-sequence");
    expect(inzoom).toBeDefined();
  });

  it("returns structured issues for unsupported lines", () => {
    const result = parseOplDocument("This is not valid OPL at all.", "SD", "opd-sd");
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

describe("fan sentences", () => {
  it("parses English XOR agent fan (diverging)", () => {
    const result = parseOplDocument([
      "B is an object, physical.",
      "P1 is a process, physical.",
      "P2 is a process, physical.",
      "B handles exactly one of P1 or P2.",
    ].join("\n"), "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fan = result.value.sentences.find(s => s.kind === "fan");
    expect(fan).toBeDefined();
    if (fan?.kind !== "fan") return;
    expect(fan.fanType).toBe("xor");
    expect(fan.linkType).toBe("agent");
    expect(fan.direction).toBe("diverging");
  });

  it("parses Spanish OR consumption fan (converging)", () => {
    const result = parseOplDocument([
      "Proceso es un proceso, físico.",
      "A es un objeto, físico.",
      "B es un objeto, físico.",
      "Proceso consume al menos uno de A o B.",
    ].join("\n"), "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fan = result.value.sentences.find(s => s.kind === "fan");
    expect(fan).toBeDefined();
    if (fan?.kind !== "fan") return;
    expect(fan.fanType).toBe("or");
    expect(fan.linkType).toBe("consumption");
  });
});

describe("requirement / assertion / scenario", () => {
  it("parses English requirement", () => {
    const result = parseOplDocument([
      "X is an object, physical.",
      "[R-01] Minimum Staff: at least one clinician on duty (applies to X).",
    ].join("\n"), "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const req = result.value.sentences.find(s => s.kind === "requirement");
    expect(req).toBeDefined();
    if (req?.kind !== "requirement") return;
    expect(req.reqCode).toBe("R-01");
    expect(req.targetName).toBe("X");
  });

  it("parses English assertion", () => {
    const result = parseOplDocument([
      "X is an object, physical.",
      "[correctness] X requires Y.",
    ].join("\n"), "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ast = result.value.sentences.find(s => s.kind === "assertion");
    expect(ast).toBeDefined();
    if (ast?.kind !== "assertion") return;
    expect(ast.category).toBe("correctness");
  });

  it("parses English scenario", () => {
    const result = parseOplDocument([
      "X is an object, physical.",
      '[scenario: Emergency] 5 links on path "emergency"',
    ].join("\n"), "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sc = result.value.sentences.find(s => s.kind === "scenario");
    expect(sc).toBeDefined();
    if (sc?.kind !== "scenario") return;
    expect(sc.name).toBe("Emergency");
    expect(sc.linkCount).toBe(5);
  });
});

describe("invocation and tagged links", () => {
  it("parses English invocation", () => {
    const result = parseOplDocument([
      "P is a process, physical.",
      "Q is a process, physical.",
      "P invokes Q.",
    ].join("\n"), "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const link = result.value.sentences.find(s => s.kind === "link" && s.linkType === "invocation");
    expect(link).toBeDefined();
  });

  it("parses Spanish invocation", () => {
    const result = parseOplDocument([
      "P es un proceso, físico.",
      "Q es un proceso, físico.",
      "P invoca Q.",
    ].join("\n"), "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const link = result.value.sentences.find(s => s.kind === "link" && s.linkType === "invocation");
    expect(link).toBeDefined();
  });
});

describe("attribute-value", () => {
  it("parses English attribute value", () => {
    const result = parseOplDocument([
      "Temperature is an object, informatical.",
      "Water is an object, physical.",
      "Temperature of Water is normal.",
    ].join("\n"), "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const av = result.value.sentences.find(s => s.kind === "attribute-value");
    expect(av).toBeDefined();
    if (av?.kind !== "attribute-value") return;
    expect(av.thingName).toBe("Temperature");
    expect(av.exhibitorName).toBe("Water");
    expect(av.valueName).toBe("normal");
  });

  it("parses Spanish attribute value", () => {
    const result = parseOplDocument([
      "Temperatura es un objeto, informático.",
      "Agua es un objeto, físico.",
      "Temperatura de Agua es normal.",
    ].join("\n"), "SD", "opd-sd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const av = result.value.sentences.find(s => s.kind === "attribute-value");
    expect(av).toBeDefined();
    if (av?.kind !== "attribute-value") return;
    expect(av.thingName).toBe("Temperatura");
    expect(av.valueName).toBe("normal");
  });
});
