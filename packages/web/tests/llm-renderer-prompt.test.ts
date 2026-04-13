import { describe, expect, it } from "vitest";
import { EMPTY_SD_DRAFT, buildArtifactsFromSdDraft, kernelToVisualRenderSpec } from "@opmodel/core";
import { buildDiagramRenderMessages } from "../src/lib/renderers/llm-renderer";

describe("buildDiagramRenderMessages", () => {
  it("builds a constrained render prompt from VisualRenderSpec", () => {
    const result = buildArtifactsFromSdDraft({
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
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const spec = kernelToVisualRenderSpec(result.value.kernel);
    const messages = buildDiagramRenderMessages(spec, spec.style, "Use this exact renderer contract.");

    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("exact renderer contract");
    expect(messages[1]?.content).toContain("VisualRenderSpec");
    expect(messages[1]?.content).toContain("Battery Charging System");
  });
});
