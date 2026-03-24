import { describe, it, expect } from "vitest";
import { loadModel } from "../src/serialization";
import { expose, render } from "../src/opl";
import { readFileSync } from "fs";
import { resolve } from "path";

const fixture = readFileSync(
  resolve(__dirname, "../../../tests/hospitalizacion-domiciliaria.opmodel"),
  "utf8",
);

describe("HODOM OPL Export", () => {
  it("generates complete OPL for all OPDs", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    
    const lines: string[] = [];
    for (const opd of r.value.opds.values()) {
      const doc = expose(r.value, opd.id);
      const text = render(doc);
      if (text) {
        if (lines.length > 0) lines.push("");
        lines.push(`=== ${opd.name} ===`);
        lines.push(text);
      }
    }
    
    const fullExport = lines.join("\n");
    
    // Should have all 6 OPD headers
    expect(fullExport).toContain("=== SD ===");
    expect(fullExport).toContain("=== SD1 ===");
    expect(fullExport).toContain("=== SD1.1 ===");
    expect(fullExport).toContain("=== SD1.2 ===");
    expect(fullExport).toContain("=== SD2 ===");
    expect(fullExport).toContain("=== SD3 ===");
    
    // Key content checks (OPL-ES: "es un objeto" instead of "is an object")
    expect(fullExport).toContain("Paciente es un objeto");
    expect(fullExport).toContain("Hospitalización Domiciliaria");
    // No issues
    expect(fullExport).not.toContain("unspecified state");
    
    // Word count
    const wordCount = fullExport.split(/\s+/).length;
    console.log(`Export: ${fullExport.split("\n").length} lines, ${wordCount} words`);
    expect(wordCount).toBeGreaterThan(1000);
  });
});
