import { describe, it, expect } from "vitest";
import { loadModel } from "../src/serialization";
import { renderAll, modelStats } from "../src/opl";
import { exportMarkdown } from "../src/export-md";
import { readFileSync } from "fs";
import { resolve } from "path";

const fixture = readFileSync(
  resolve(__dirname, "../../../tests/hodom-hsc-v0.opmodel"),
  "utf8",
);

describe("HODOM HSC v0 export", () => {
  it("renderAll generates complete OPL for SD and SD1", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");

    const fullExport = renderAll(r.value);

    expect(fullExport).toContain("=== SD ===");
    expect(fullExport).toContain("=== SD1 ===");
    expect(fullExport).toContain("HODOM HSC");
    expect(fullExport).toContain("Hospitalización Domiciliaria HSC Proveyendo");
    expect(fullExport).toContain("Servicio HODOM HSC");
    expect(fullExport).toContain("Consentimiento Informado");
    expect(fullExport).not.toContain("unspecified state");

    const sdIdx = fullExport.indexOf("=== SD ===");
    const sd1Idx = fullExport.indexOf("=== SD1 ===");
    expect(sdIdx).toBeLessThan(sd1Idx);

    const wordCount = fullExport.split(/\s+/).length;
    console.log(`HODOM HSC renderAll: ${fullExport.split("\n").length} lines, ${wordCount} words`);
    expect(wordCount).toBeGreaterThan(300);
  });

  it("modelStats matches the baseline HSC fixture", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const stats = modelStats(r.value);

    expect(stats.things.total).toBe(36);
    expect(stats.things.objects).toBe(21);
    expect(stats.things.processes).toBe(15);
    expect(stats.states).toBe(18);
    expect(stats.links.total).toBe(53);
    expect(stats.opds.total).toBe(2);
    expect(stats.opds.maxDepth).toBe(1);
    expect(stats.requirements).toBe(13);
    expect(stats.assertions).toBe(5);

    console.log("HODOM HSC stats:", JSON.stringify(stats, null, 2));
  });

  it("exportMarkdown produces structured documentation", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const md = exportMarkdown(r.value);

    expect(md).toMatch(/^# HODOM HSC — Hospital de San Carlos/m);
    expect(md).toContain("## OPD Hierarchy");
    expect(md).toContain("### SD");
    expect(md).toContain("### SD1");
    expect(md).toContain("Hospitalización Domiciliaria HSC Proveyendo");
    expect(md).toContain("Condición clínica estable");
    expect(md).toContain("Consentimiento Informado debe estar firmado antes de primera visita domiciliaria");

    const wordCount = md.split(/\s+/).length;
    console.log(`HODOM HSC markdown: ${md.split("\n").length} lines, ${wordCount} words`);
    expect(wordCount).toBeGreaterThan(500);
  });
});
