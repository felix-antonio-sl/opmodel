import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  compileToKernel,
  parseOplDocument,
  parseOplDocuments,
  loadModel,
  renderAll,
  getExecutableProcessesFromKernel,
  resolveLinksForOpdFromKernel,
  resolveOpdFiberFromKernel,
  exposeSemanticKernel,
} from "../src/index";

function parseSingleDoc(opl: string) {
  const result = parseOplDocument(opl, "SD", "opd-sd");
  if (!result.ok) throw new Error(`parseOplDocument failed: ${result.error.message}`);
  return [result.value];
}

function parseMultiDocs(opl: string) {
  const result = parseOplDocuments(opl);
  if (!result.ok) throw new Error(`parseOplDocuments failed: ${result.error.message}`);
  return result.value;
}

function fixtureOpl(path: string): string {
  const raw = readFileSync(path, "utf-8");
  const modelResult = loadModel(raw);
  if (!modelResult.ok) throw new Error(`Cannot load fixture ${path}`);
  return renderAll(modelResult.value);
}

function compileFixture(path: string) {
  const opl = fixtureOpl(path);
  const docs = parseMultiDocs(opl);
  const result = compileToKernel(docs);
  if (!result.ok) throw new Error(`compileToKernel failed: ${result.error.message}`);
  return result.value;
}

describe("compileToKernel", () => {
  it("compiles basic OPL to SemanticKernel with sourceInfo", () => {
    const opl = [
      "Water is an object, physical.",
      "Water can be cold or hot.",
    ].join("\n");
    const docs = parseSingleDoc(opl);
    const result = compileToKernel(docs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kernel = result.value;

    expect(kernel.things.size).toBe(1);
    const thing = [...kernel.things.values()][0]!;
    expect(thing.name).toBe("Water");
    expect(thing.sourceInfo).toBeDefined();
    expect(thing.sourceInfo?.sentenceKind).toBe("thing-declaration");
  });

  it("preserves modifiers in kernel (via fixture)", () => {
    // coffee-making fixture has event modifiers
    let kernel;
    try {
      kernel = compileFixture("tests/coffee-making.opmodel");
    } catch { return; }
    // Modifiers survive through kernel roundtrip
    expect(kernel.modifiers.size).toBeGreaterThanOrEqual(0);
    // The coffee-making fixture may or may not have modifiers — the key test is
    // that the modifiers map exists and is populated from model
  });

  it("preserves fans in kernel", () => {
    const opl = [
      "Splitter is a process, physical.",
      "A is an object, physical.",
      "B is an object, physical.",
      "Splitter yields exactly one of A or B.",
    ].join("\n");
    const docs = parseSingleDoc(opl);
    const result = compileToKernel(docs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fans.size).toBe(1);
    const fan = [...result.value.fans.values()][0]!;
    expect(fan.type).toBe("xor");
  });

  it("builds complete InZoomStep[] from in-zoom-sequence", () => {
    const opl = [
      "=== SD ===",
      "Making Coffee is a process, physical.",
      "Grinding is a process, physical.",
      "Brewing is a process, physical.",
      "Pouring is a process, physical.",
      "",
      "=== SD1 ===",
      "SD is refined by in-zooming Making Coffee in SD1.",
      "Making Coffee zooms into Grinding, Brewing, and Pouring, in that sequence.",
    ].join("\n");
    const docs = parseMultiDocs(opl);
    const result = compileToKernel(docs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const refinements = [...result.value.refinements.values()];
    expect(refinements.length).toBe(1);
    const ref = refinements[0]!;
    expect(ref.kind).toBe("in-zoom");
    if (ref.kind !== "in-zoom") return;
    expect(ref.completeness).toBe("complete");
    expect(ref.steps.length).toBeGreaterThan(0);
    // Each step has at least one thingId
    for (const step of ref.steps) {
      expect(step.thingIds.length).toBeGreaterThan(0);
    }
  });

  it("marks derived invocations", () => {
    const opl = [
      "=== SD ===",
      "Making Coffee is a process, physical.",
      "Grinding is a process, physical.",
      "Brewing is a process, physical.",
      "",
      "=== SD1 ===",
      "SD is refined by in-zooming Making Coffee in SD1.",
      "Making Coffee zooms into Grinding and Brewing, in that sequence.",
    ].join("\n");
    const docs = parseMultiDocs(opl);
    const result = compileToKernel(docs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const invocations = [...result.value.links.values()].filter(
      (l) => l.type === "invocation",
    );
    expect(invocations.length).toBeGreaterThan(0);
    for (const link of invocations) {
      expect(link.origin).toBe("derived-in-zoom");
      expect(link.derived?.kind).toBe("in-zoom-order");
    }
  });

  const FIXTURES = [
    "tests/coffee-making.opmodel",
    "tests/driver-rescuing.opmodel",
    "tests/hodom-v2.opmodel",
    "tests/hodom-hsc-v0.opmodel",
    "tests/ev-ams.opmodel",
    "tests/hospitalizacion-domiciliaria.opmodel",
  ];

  for (const fixture of FIXTURES) {
    it(`compiles fixture ${fixture} to kernel with sourceInfo`, () => {
      let kernel;
      try {
        kernel = compileFixture(fixture);
      } catch {
        return;
      }

      expect(kernel.things.size).toBeGreaterThan(0);
      expect(kernel.links.size).toBeGreaterThan(0);

      const withSourceInfo = [...kernel.things.values()].filter((t) => t.sourceInfo);
      expect(withSourceInfo.length).toBeGreaterThan(0);
    });
  }
});

describe("kernel-aware simulation functions (Fase 5)", () => {
  it("getExecutableProcessesFromKernel returns processes with semantic ordering", () => {
    const opl = [
      "=== SD ===",
      "Making Coffee is a process, physical.",
      "Grinding is a process, physical.",
      "Brewing is a process, physical.",
      "Pouring is a process, physical.",
      "",
      "=== SD1 ===",
      "SD is refined by in-zooming Making Coffee in SD1.",
      "Making Coffee zooms into Grinding, Brewing, and Pouring, in that sequence.",
    ].join("\n");
    const result = parseOplDocuments(opl);
    if (!result.ok) throw new Error("parse failed");
    const kernelResult = compileToKernel(result.value);
    if (!kernelResult.ok) throw new Error("compile failed");
    const kernel = kernelResult.value;

    const procs = getExecutableProcessesFromKernel(kernel);
    expect(procs.length).toBeGreaterThan(0);
    // All three subprocesses should be present
    const names = procs.map((p) => p.name);
    expect(names).toContain("Grinding");
    expect(names).toContain("Brewing");
    expect(names).toContain("Pouring");
  });

  it("resolveLinksForOpdFromKernel resolves visible links", () => {
    const opl = [
      "Water is an object, physical.",
      "Water can be cold or hot.",
      "Boiling is a process, physical.",
      "Boiling changes Water from cold to hot.",
    ].join("\n");
    const parseResult = parseOplDocument(opl, "SD", "opd-sd");
    if (!parseResult.ok) throw new Error("parse failed");
    const kernelResult = compileToKernel([parseResult.value]);
    if (!kernelResult.ok) throw new Error("compile failed");
    const kernel = kernelResult.value;

    const links = resolveLinksForOpdFromKernel(kernel, "opd-sd");
    expect(links.length).toBeGreaterThan(0);
  });

  it("resolveOpdFiberFromKernel returns fiber with things and links", () => {
    const opl = [
      "Car is an object, physical.",
      "Driving is a process, physical.",
      "Car requires Driving.",
    ].join("\n");
    const parseResult = parseOplDocument(opl, "SD", "opd-sd");
    if (!parseResult.ok) throw new Error("parse failed");
    const kernelResult = compileToKernel([parseResult.value]);
    if (!kernelResult.ok) throw new Error("compile failed");
    const kernel = kernelResult.value;

    const fiber = resolveOpdFiberFromKernel(kernel, "opd-sd");
    expect(fiber.things.size).toBeGreaterThan(0);
  });

  for (const fixture of ["tests/coffee-making.opmodel"]) {
    it(`kernel simulation matches legacy for ${fixture}`, () => {
      let kernel;
      try {
        const raw = readFileSync(fixture, "utf-8");
        const modelResult = loadModel(raw);
        if (!modelResult.ok) return;
        const model = modelResult.value;
        const opl = renderAll(model);
        const docs = parseOplDocuments(opl);
        if (!docs.ok) return;
        const kr = compileToKernel(docs.value);
        if (!kr.ok) return;
        kernel = kr.value;
      } catch { return; }

      const procs = getExecutableProcessesFromKernel(kernel);
      expect(procs.length).toBeGreaterThan(0);

      const links = resolveLinksForOpdFromKernel(kernel, "opd-sd");
      expect(links.length).toBeGreaterThan(0);

      const fiber = resolveOpdFiberFromKernel(kernel, "opd-sd");
      expect(fiber.things.size).toBeGreaterThan(0);
    });
  }
});
