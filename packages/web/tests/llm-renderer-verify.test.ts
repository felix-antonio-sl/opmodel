import { describe, expect, it } from "vitest";
import { EMPTY_SD_DRAFT, buildArtifactsFromSdDraft, kernelToVisualRenderSpec } from "@opmodel/core";
import { renderVisualRenderSpec } from "../src/lib/svg/render-visual-render-spec";
import { verifyRenderedSvg } from "../src/lib/renderers/llm-renderer";

function buildSpec() {
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
    inputs: ["Electrical Energy"],
    outputs: ["Charged Battery"],
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected ok");
  return kernelToVisualRenderSpec(result.value.kernel);
}

describe("verifyRenderedSvg", () => {
  it("passes for a deterministic SVG rendered from the same spec", () => {
    const spec = buildSpec();
    const svg = renderVisualRenderSpec(spec);
    const report = verifyRenderedSvg(spec, svg);

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("fails when the primary process is missing from the SVG", () => {
    const spec = buildSpec();
    const svg = "<svg><text>Battery Charging System</text></svg>";
    const report = verifyRenderedSvg(spec, svg);

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "SVG-005" || issue.code === "SVG-003")).toBe(true);
  });
});
