import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadModel, semanticKernelFromModel, kernelToVisualRenderSpec, validateRefinedModel } from "../src";

describe("generator visual pipeline on real fixtures", () => {
  it("derives stable SD and SD1 visual specs from coffee-making fixture", () => {
    const raw = readFileSync(new URL("../../../tests/coffee-making.opmodel", import.meta.url), "utf8");
    const loaded = loadModel(raw);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const kernel = semanticKernelFromModel(loaded.value);
    const sdSpec = kernelToVisualRenderSpec(kernel, { opdId: "opd-sd" });
    const sd1Spec = kernelToVisualRenderSpec(kernel, { opdId: "opd-sd1" });
    const refinementReport = validateRefinedModel(loaded.value);

    expect(sdSpec.diagramKind).toBe("opm-sd");
    expect(sdSpec.nodes.some((node) => node.label === "Coffee Making")).toBe(true);
    expect(sd1Spec.diagramKind).toBe("opm-sd1");
    expect(sd1Spec.nodes.some((node) => node.label === "Grinding")).toBe(true);
    expect(sd1Spec.nodes.some((node) => node.label === "Brewing")).toBe(true);
    expect(refinementReport.ok).toBe(true);
  });
});
