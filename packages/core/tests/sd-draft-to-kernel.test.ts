import { describe, expect, it } from "vitest";
import {
  EMPTY_SD_DRAFT,
  buildArtifactsFromSdDraft,
  kernelToDiagramSpec,
  kernelToOpl,
  kernelToVisualExportPrompt,
  kernelToVisualRenderSpec,
  validateSdDraft,
  verifyVisualRenderSpec,
} from "../src";

describe("SdDraft generator slice", () => {
  it("validates a minimal draft and builds artifacts", () => {
    const draft = {
      ...EMPTY_SD_DRAFT,
      systemName: "Battery Charging System",
      mainProcess: "Battery Charging",
      beneficiary: "Driver Group",
      beneficiaryAttribute: "Mobility Convenience",
      beneficiaryStateIn: "limited",
      beneficiaryStateOut: "enhanced",
      valueObject: "Battery",
      valueStateIn: "depleted",
      valueStateOut: "charged",
      agents: ["Operator"],
      instruments: ["Charging Station"],
      inputs: ["Electrical Energy"],
      outputs: ["Charged Battery"],
    };

    const validation = validateSdDraft(draft);
    expect(validation.ok).toBe(true);

    const result = buildArtifactsFromSdDraft(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.model.things.size).toBeGreaterThan(0);
    expect(result.value.kernel.things.size).toBeGreaterThan(0);

    const opl = kernelToOpl(result.value.kernel);
    expect(opl).toContain("Battery Charging is a process");

    const diagram = kernelToDiagramSpec(result.value.kernel);
    expect(diagram.nodes.some((node) => node.label === "Battery Charging")).toBe(true);
    expect(diagram.edges.length).toBeGreaterThan(0);

    const visualSpec = kernelToVisualRenderSpec(result.value.kernel);
    expect(visualSpec.diagramKind).toBe("opm-sd");
    expect(visualSpec.nodes.some((node) => node.visualRole === "main-process")).toBe(true);
    expect(visualSpec.edges.length).toBeGreaterThan(0);
    expect(visualSpec.canonicalOpl).toContain("Battery Charging is a process");

    const visualReport = verifyVisualRenderSpec(visualSpec);
    expect(visualReport.ok).toBe(true);

    const visualPrompt = kernelToVisualExportPrompt(result.value.kernel);
    expect(visualPrompt.prompt).toContain("Battery Charging");
    expect(visualPrompt.opl).toContain("Battery Charging is a process");
    expect(visualPrompt.semanticsGuardrails.length).toBeGreaterThanOrEqual(5);
  });

  it("rejects drafts without main process and value object", () => {
    const draft = {
      ...EMPTY_SD_DRAFT,
      systemName: "Broken System",
    };

    const validation = validateSdDraft(draft);
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.field === "mainProcess")).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "valueObject")).toBe(true);
  });
});
