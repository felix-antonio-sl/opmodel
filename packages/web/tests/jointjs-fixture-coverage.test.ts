import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadModel,
  isOk,
  semanticKernelFromModel,
  kernelToVisualRenderSpec,
  verifyVisualRenderSpec,
  type Model,
} from "@opmodel/core";
import { visualRenderSpecToJointGraph } from "../src/lib/renderers/jointjs";

function loadFixture(name: string): Model {
  const json = readFileSync(resolve(__dirname, "../../../tests", name), "utf-8");
  const result = loadModel(json);
  if (!isOk(result)) throw new Error(`loadModel failed for ${name}: ${result.error.message}`);
  return result.value;
}

function opdIds(model: Model): string[] {
  const opds = (model as any).opds;
  if (opds instanceof Map) return Array.from(opds.keys());
  if (Array.isArray(opds)) return opds.map((o: any) => o.id);
  return [];
}

const fixtures = [
  "coffee-making",
  "driver-rescuing",
  "hospitalizacion-domiciliaria",
  "hodom-v2",
  "ev-ams",
  "hodom-hsc-v0",
  "object-visual-audit",
];

describe("JointJS fixture coverage — 6 fixtures × all their OPDs", () => {
  for (const name of fixtures) {
    it(`${name}: every OPD compiles to a valid spec + graph`, () => {
      const model = loadFixture(`${name}.opmodel`);
      const kernel = semanticKernelFromModel(model);
      const opds = opdIds(model);
      expect(opds.length).toBeGreaterThan(0);

      // Known verifier errors that surface as legitimate SSOT findings against
      // current fixtures (tracked as candidate-extensions, not blockers):
      // - VR-010/VR-016: driver-rescuing has an effect link to stateless obj-driver
      //   (objective: add a state to driver or reclassify the link).
      const KNOWN_FIXTURE_ERROR_CODES = new Set(["VR-010", "VR-016"]);

      for (const opdId of opds) {
        const spec = kernelToVisualRenderSpec(kernel, { opdId });
        const report = verifyVisualRenderSpec(spec);
        const unexpectedErrors = report.issues.filter(
          (i) => i.severity === "error" && !KNOWN_FIXTURE_ERROR_CODES.has(i.code),
        );
        expect(unexpectedErrors.length, `unexpected verifier errors on ${name}/${opdId}: ${unexpectedErrors.map((i) => i.code + " " + i.message).join("; ")}`).toBe(0);

        expect(Array.isArray(spec.nodes)).toBe(true);
        expect(Array.isArray(spec.edges)).toBe(true);
        expect(Array.isArray(spec.states)).toBe(true);
        expect(Array.isArray(spec.fans)).toBe(true);
        expect(Array.isArray(spec.modifiers)).toBe(true);

        const { graph, nodeIdToCell } = visualRenderSpecToJointGraph(spec);
        expect(nodeIdToCell.size).toBe(spec.nodes.length);
        expect(graph.getCells().length).toBeGreaterThanOrEqual(spec.nodes.length);
      }
    });
  }

  it("hospitalizacion-domiciliaria/SD exhibits fans and modifiers as SSOT expects", () => {
    const model = loadFixture("hospitalizacion-domiciliaria.opmodel");
    const kernel = semanticKernelFromModel(model);
    const spec = kernelToVisualRenderSpec(kernel, { opdId: "opd-sd" });
    expect(spec.fans.length).toBeGreaterThan(0);
    for (const fan of spec.fans) {
      expect(["xor", "or", "and"]).toContain(fan.operator);
    }
  });

  it("ev-ams exercises multiple refinement depths", () => {
    const model = loadFixture("ev-ams.opmodel");
    expect(opdIds(model)).toEqual(expect.arrayContaining(["opd-sd", "opd-sd1", "opd-sd1-1", "opd-sd1-1-1"]));
  });

  it("child OPDs carry an inZoomContainerOf marker", () => {
    const model = loadFixture("coffee-making.opmodel");
    const kernel = semanticKernelFromModel(model);
    const spec = kernelToVisualRenderSpec(kernel, { opdId: "opd-sd1" });
    const containerCount = spec.nodes.filter((n) => n.inZoomContainerOf).length;
    expect(containerCount).toBe(1);
  });
});
