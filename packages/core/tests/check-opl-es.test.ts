import { describe, it, expect } from "vitest";
import { loadModel } from "../src/serialization";
import { expose, render } from "../src/opl";
import { readFileSync } from "fs";
import { resolve } from "path";
const fixture = readFileSync(resolve(__dirname, "../../../tests/hospitalizacion-domiciliaria.opmodel"), "utf8");
describe("OPL-ES", () => {
  it("SD1 renders in Spanish", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const text = render(expose(r.value, "opd-sd1"));
    // Print first 20 lines
    console.log("=== SD1 OPL-ES (first 20 lines) ===");
    text.split("\n").slice(0, 20).forEach(l => console.log(l));
    
    // Verify Spanish verbs
    expect(text).toContain("es un objeto");       // D1: thing declaration
    expect(text).toContain("puede estar");         // D5: state enumeration
    expect(text).toContain("es inicial");           // D7: state designation
    expect(text).toContain("consume");              // T1: consumption
    expect(text).toContain("genera");               // T2: result
    expect(text).toContain("maneja");               // H1: agent
    expect(text).toContain("requiere");             // H2: instrument / duration
    expect(text).toContain("cambia");               // TS3: state-specified effect
    expect(text).toContain("consta de");            // RF1: aggregation
    expect(text).toContain("exhibe");               // RF2: exhibition
    expect(text).toContain("se descompone en");     // CX1: in-zoom sequence
    expect(text).toContain("en esa secuencia");     // CX1: sequence
    expect(text).toContain("inicia");               // ET: event trigger
    
    // Verify NO English verbs leak through
    expect(text).not.toContain("is an object");
    expect(text).not.toContain("can be");
    expect(text).not.toContain("consists of");
    expect(text).not.toContain("handles");
    expect(text).not.toContain("yields");
    expect(text).not.toContain("changes");
    expect(text).not.toContain("triggers");
    expect(text).not.toContain("in that sequence");
    expect(text).not.toContain("or more");
    expect(text).not.toContain("is an instance of");
    expect(text).not.toContain("are instances of");
  });

  it("SD OPL-ES edge label", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    // SD is root, no edge label
    const sd1 = render(expose(r.value, "opd-sd1"));
    expect(sd1).toContain("se refina por descomposición de");
  });

  it("SD3 multiplicity renders in Spanish", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const text = render(expose(r.value, "opd-sd3"));
    expect(text).toContain("o más");
    expect(text).not.toContain("or more");
    expect(text).not.toContain("is an instance of");
  });

  it("SD3 unfold in Spanish", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const text = render(expose(r.value, "opd-sd3"));
    expect(text).toContain("despliegue de");
    expect(text).toContain("consta de");
    console.log("=== SD3 OPL-ES ===");
    text.split("\n").forEach(l => console.log(l));
  });
});
