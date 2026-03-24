import { describe, it, expect } from "vitest";
import { loadModel } from "../src/serialization";
import { expose, render } from "../src/opl";
import { readFileSync } from "fs";
import { resolve } from "path";

const fixture = readFileSync(
  resolve(__dirname, "../../../tests/hospitalizacion-domiciliaria.opmodel"),
  "utf8",
);

describe("HODOM OPL audit", () => {
  const result = loadModel(fixture);
  if (!result.ok) throw new Error("load failed");
  const m = result.value;

  for (const [opdId, opd] of m.opds) {
    it(`${opd.name}: OPL renders without 'unspecified state'`, () => {
      const doc = expose(m, opdId);
      const text = render(doc);
      expect(text).not.toContain("unspecified state");
      expect(text).not.toContain("undefined");
    });

    it(`${opd.name}: OPL renders without duplicate sentences`, () => {
      const doc = expose(m, opdId);
      const text = render(doc);
      const lines = text.split("\n").filter(l => l.trim());
      const seen = new Set<string>();
      const dupes: string[] = [];
      for (const line of lines) {
        if (seen.has(line)) dupes.push(line);
        seen.add(line);
      }
      expect(dupes, `Duplicate sentences in ${opd.name}`).toEqual([]);
    });

    it(`${opd.name}: no empty sentences`, () => {
      const doc = expose(m, opdId);
      const text = render(doc);
      const lines = text.split("\n");
      const empty = lines.filter(l => l.trim() === "" || l.trim() === ".");
      expect(empty.length, `Empty sentences in ${opd.name}`).toBe(0);
    });
  }

  it("SD3 aggregation lists all 6 parts", () => {
    const doc = expose(m, "opd-sd3");
    const text = render(doc);
    // OPL-ES: "consta de" instead of "consists of"
    expect(text).toContain("consta de");
    expect(text).toContain("Equipamiento Médico");
    expect(text).toContain("Equipo Clínico");
    expect(text).toContain("Medicamentos");
    expect(text).toContain("Residuos Clínicos");
    expect(text).toContain("Teléfono");
    expect(text).toContain("Vehículo de Transporte");
  });

  it("SD1.2 event trigger is correct direction", () => {
    const doc = expose(m, "opd-sd1-2");
    const text = render(doc);
    // OPL-ES: "inicia" instead of "triggers"
    expect(text).toContain("Regulación Médica inicia Respuesta a Emergencia");
    expect(text).not.toContain("Respuesta a Emergencia inicia Regulación Médica");
  });

  it("SD1 capacitación effect is state-specified", () => {
    const doc = expose(m, "opd-sd1");
    const text = render(doc);
    // OPL-ES: "cambia ... de ... a" instead of "changes ... from ... to"
    expect(text).toContain("Capacitación del Cuidador cambia Cuidador de no capacitado a capacitado");
  });

  it("SD1 renders requirements from normativa", () => {
    const doc = expose(m, "opd-sd1");
    const text = render(doc);
    expect(text).toContain("[R-03]");
    expect(text).toContain("DS 1/2022");
    expect(text).toContain("Consentimiento Informado Obligatorio");
  });

  it("SD1 renders assertions", () => {
    const doc = expose(m, "opd-sd1");
    const text = render(doc);
    expect(text).toContain("[seguridad]"); // OPL-ES: safety → seguridad
    expect(text).toContain("Consentimiento firmado");
  });

  it("SD1 renders path labels for scenarios", () => {
    const doc = expose(m, "opd-sd1");
    const text = render(doc);
    // OPL-ES: "ruta" instead of "path"
    expect(text).toContain("[ruta: flujo-normal]");
  });

  it("SD1.2 renders emergency path labels", () => {
    const doc = expose(m, "opd-sd1-2");
    const text = render(doc);
    expect(text).toContain("[ruta: emergencia]");
    // OPL-ES: "inicia" instead of "triggers"
    expect(text).toContain("Regulación Médica inicia Respuesta a Emergencia");
  });
});
