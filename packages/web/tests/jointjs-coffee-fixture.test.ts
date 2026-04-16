import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadModel,
  isOk,
  semanticKernelFromModel,
  kernelToVisualRenderSpec,
  verifyVisualRenderSpec,
} from "@opmodel/core";
import { visualRenderSpecToJointGraph } from "../src/lib/renderers/jointjs";

function loadFixture(name: string): string {
  const path = resolve(__dirname, "../../../tests", name);
  return readFileSync(path, "utf-8");
}

describe("coffee-making fixture via JointJS adapter", () => {
  it("compiles fixture -> kernel -> spec -> joint graph with verifier ok", () => {
    const json = loadFixture("coffee-making.opmodel");
    const result = loadModel(json);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const kernel = semanticKernelFromModel(result.value);
    const spec = kernelToVisualRenderSpec(kernel, { opdId: "opd-sd" });

    const verification = verifyVisualRenderSpec(spec);
    expect(verification.ok).toBe(true);

    expect(spec.nodes.length).toBeGreaterThan(0);
    expect(spec.edges.length).toBeGreaterThan(0);

    const { graph, nodeIdToCell, edgeIdToLink } = visualRenderSpecToJointGraph(spec);
    expect(nodeIdToCell.size).toBe(spec.nodes.length);
    expect(edgeIdToLink.size).toBeLessThanOrEqual(spec.edges.length);
    // Cells include nodes + links + embedded states + fan badges.
    expect(graph.getCells().length).toBeGreaterThanOrEqual(nodeIdToCell.size + edgeIdToLink.size);
  });

  it("preserves main process as ellipse", () => {
    const json = loadFixture("coffee-making.opmodel");
    const result = loadModel(json);
    if (!isOk(result)) throw new Error("fixture failed to load");
    const kernel = semanticKernelFromModel(result.value);
    const spec = kernelToVisualRenderSpec(kernel, { opdId: "opd-sd" });
    const mainProc = spec.nodes.find((n) => n.visualRole === "main-process");
    expect(mainProc).toBeDefined();

    const { nodeIdToCell } = visualRenderSpecToJointGraph(spec);
    const cell = nodeIdToCell.get(mainProc!.id);
    expect(cell?.get("type")).toContain("Ellipse");
  });
});
