import { describe, expect, it } from "vitest";
import { EMPTY_SD_DRAFT, buildArtifactsFromSdDraft, kernelToVisualRenderSpec } from "@opmodel/core";
import { renderVisualRenderSpec } from "../src/lib/svg/render-visual-render-spec";

describe("renderVisualRenderSpec", () => {
  it("renders an SVG from VisualRenderSpec", () => {
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

    const result = buildArtifactsFromSdDraft(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const spec = kernelToVisualRenderSpec(result.value.kernel);
    const svg = renderVisualRenderSpec(spec);

    expect(svg).toContain("<svg");
    expect(svg).toContain("Battery Charging System");
    expect(svg).toContain("Battery Charging");
    expect(svg).toContain("Legend");
  });
});
