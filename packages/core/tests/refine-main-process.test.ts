import { describe, expect, it } from "vitest";
import {
  EMPTY_SD_DRAFT,
  buildArtifactsFromSdDraft,
  kernelToVisualRenderSpec,
  refineMainProcess,
  validateRefinedModel,
  verifyVisualRenderSpec,
} from "../src";

describe("refineMainProcess", () => {
  it("creates an SD1 refinement that can flow through VisualRenderSpec", () => {
    const base = buildArtifactsFromSdDraft({
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
    });

    expect(base.ok).toBe(true);
    if (!base.ok) return;

    const refined = refineMainProcess(base.value.model, {
      subprocesses: ["Authorize Charge", "Transfer Energy", "Confirm Completion"],
      internalObjects: ["Charging Session", "Charge Status"],
    });

    expect(refined.ok).toBe(true);
    if (!refined.ok) return;

    const spec = kernelToVisualRenderSpec(refined.value.kernel, { opdId: refined.value.childOpdId });
    const report = verifyVisualRenderSpec(spec);

    const methodology = validateRefinedModel(refined.value.model);

    expect(spec.diagramKind).toBe("opm-sd1");
    expect(spec.nodes.some((node) => node.label === "Authorize Charge")).toBe(true);
    expect(spec.nodes.some((node) => node.label === "Charging Session")).toBe(true);
    expect(spec.nodes.some((node) => node.visualRole === "main-process" || node.visualRole === "subprocess")).toBe(true);
    expect(report.ok).toBe(true);
    expect(methodology.ok).toBe(true);
  });
});
