// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { formatValidationMessage } from "../src/components/ValidationPanel";

describe("ValidationPanel message formatting", () => {
  it("renders I-GERUND with accepted Spanish process naming guidance", () => {
    const msg = formatValidationMessage({
      code: "I-GERUND",
      severity: "warning",
      message: 'Process "Evaluación de Elegibilidad" should use gerund naming (-ing/-ando/-iendo)',
      entity: "proc-1",
    });

    expect(msg).toContain("English -ing");
    expect(msg).toContain("Spanish -ando/-iendo");
    expect(msg).toContain("-ción");
  });

  it("passes through non-I-GERUND messages unchanged", () => {
    const msg = formatValidationMessage({
      code: "I-TRANSFORMEE",
      severity: "warning",
      message: 'Process "X" has no transforming link',
      entity: "proc-1",
    });

    expect(msg).toBe('Process "X" has no transforming link');
  });
});
