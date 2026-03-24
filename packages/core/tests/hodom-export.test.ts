import { describe, it, expect } from "vitest";
import { loadModel } from "../src/serialization";
import { renderAll, modelStats } from "../src/opl";
import { readFileSync } from "fs";
import { resolve } from "path";

const fixture = readFileSync(
  resolve(__dirname, "../../../tests/hospitalizacion-domiciliaria.opmodel"),
  "utf8",
);

describe("HODOM OPL Export", () => {
  it("renderAll generates complete OPL for all OPDs", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    
    const fullExport = renderAll(r.value);
    
    // Should have all 6 OPD headers in hierarchical order
    expect(fullExport).toContain("=== SD ===");
    expect(fullExport).toContain("=== SD1 ===");
    expect(fullExport).toContain("=== SD1.1 ===");
    expect(fullExport).toContain("=== SD1.2 ===");
    expect(fullExport).toContain("=== SD2 ===");
    expect(fullExport).toContain("=== SD3 ===");

    // Hierarchical order: SD before SD1 before SD1.1
    const sdIdx = fullExport.indexOf("=== SD ===");
    const sd1Idx = fullExport.indexOf("=== SD1 ===");
    const sd11Idx = fullExport.indexOf("=== SD1.1 ===");
    expect(sdIdx).toBeLessThan(sd1Idx);
    expect(sd1Idx).toBeLessThan(sd11Idx);
    
    // Key content checks (OPL-ES default: "es un objeto")
    expect(fullExport).toContain("Paciente es un objeto");
    expect(fullExport).toContain("Hospitalización Domiciliaria");
    expect(fullExport).not.toContain("unspecified state");
    
    // Word count
    const wordCount = fullExport.split(/\s+/).length;
    console.log(`renderAll: ${fullExport.split("\n").length} lines, ${wordCount} words`);
    expect(wordCount).toBeGreaterThan(1000);
  });

  it("modelStats returns accurate HODOM metrics", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const stats = modelStats(r.value);

    // Known HODOM fixture stats
    expect(stats.things.total).toBe(48);
    expect(stats.things.objects).toBeGreaterThan(30);
    expect(stats.things.processes).toBeGreaterThan(5);
    expect(stats.states).toBe(34);
    expect(stats.links.total).toBe(82);
    expect(stats.opds.total).toBe(6);
    expect(stats.opds.maxDepth).toBe(2); // SD -> SD1 -> SD1.1
    expect(stats.appearances).toBe(84);
    expect(stats.oplSentences).toBeGreaterThan(200);

    console.log("HODOM stats:", JSON.stringify(stats, null, 2));
  });
});
