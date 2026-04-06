import { describe, expect, it } from "vitest";

import { createModel } from "../src/model";
import {
  createSemanticKernel,
  exposeSemanticKernel,
  legacyModelFromSemanticKernel,
  projectLegacyModel,
  semanticKernelFromModel,
} from "../src/semantic-kernel";
import { exposeFromSemanticKernel, renderAllFromSemanticKernel } from "../src/opl";

describe("semantic-kernel adapters", () => {
  it("maps legacy Model into SemanticKernel and back preserving core semantic sets", () => {
    const model = createModel("Adapter Test");

    model.things.set("obj-coffee", {
      id: "obj-coffee",
      kind: "object",
      name: "Coffee",
      essence: "physical",
      affiliation: "systemic",
    });
    model.things.set("proc-brewing", {
      id: "proc-brewing",
      kind: "process",
      name: "Brewing",
      essence: "physical",
      affiliation: "systemic",
    });
    model.states.set("state-coffee-ready", {
      id: "state-coffee-ready",
      parent: "obj-coffee",
      name: "ready",
      initial: false,
      final: true,
      default: false,
    });
    model.links.set("lnk-result", {
      id: "lnk-result",
      type: "result",
      source: "proc-brewing",
      target: "obj-coffee",
      target_state: "state-coffee-ready",
    });

    const kernel = semanticKernelFromModel(model);

    expect(kernel.meta.name).toBe("Adapter Test");
    expect(kernel.things.size).toBe(2);
    expect(kernel.states.size).toBe(1);
    expect(kernel.links.size).toBe(1);

    const roundtripped = legacyModelFromSemanticKernel(kernel);

    expect(roundtripped.meta.name).toBe("Adapter Test");
    expect(roundtripped.things.size).toBe(2);
    expect(roundtripped.states.size).toBe(1);
    expect(roundtripped.links.size).toBe(1);
    expect(roundtripped.appearances.size).toBe(0);

    expect(roundtripped.links.get("lnk-result")?.type).toBe("result");
    expect(roundtripped.states.get("state-coffee-ready")?.parent).toBe("obj-coffee");
  });

  it("reconstructs partial refinement shells from legacy OPDs", () => {
    const model = createModel("Refinement Adapter Test");
    model.opds.set("opd-sd1", {
      id: "opd-sd1",
      name: "SD1",
      opd_type: "hierarchical",
      parent_opd: "opd-sd",
      refines: "proc-brewing",
      refinement_type: "in-zoom",
    });

    const kernel = semanticKernelFromModel(model);
    const refinement = [...kernel.refinements.values()][0];

    expect(refinement).toBeDefined();
    expect(refinement?.kind).toBe("in-zoom");
    expect(refinement?.completeness).toBe("partial");
  });

  it("exposes an atlas from kernel refinements with semantic ranks and parallel classes", () => {
    const kernel = createSemanticKernel("Atlas Test");

    kernel.things.set("proc-parent", {
      id: "proc-parent",
      kind: "process",
      name: "Coffee Making",
      essence: "physical",
      affiliation: "systemic",
    });
    kernel.things.set("proc-grinding", {
      id: "proc-grinding",
      kind: "process",
      name: "Grinding",
      essence: "physical",
      affiliation: "systemic",
    });
    kernel.things.set("proc-boiling", {
      id: "proc-boiling",
      kind: "process",
      name: "Boiling",
      essence: "physical",
      affiliation: "systemic",
    });
    kernel.things.set("proc-brewing", {
      id: "proc-brewing",
      kind: "process",
      name: "Brewing",
      essence: "physical",
      affiliation: "systemic",
    });
    kernel.things.set("obj-water", {
      id: "obj-water",
      kind: "object",
      name: "Water",
      essence: "physical",
      affiliation: "systemic",
    });

    kernel.opds.set("opd-sd1", {
      id: "opd-sd1",
      name: "SD1",
      opd_type: "hierarchical",
      parent_opd: "opd-sd",
      refines: "proc-parent",
      refinement_type: "in-zoom",
    });

    kernel.refinements.set("ref-sd1", {
      id: "ref-sd1",
      kind: "in-zoom",
      parentThing: "proc-parent",
      parentOpd: "opd-sd",
      childOpd: "opd-sd1",
      steps: [
        { id: "step-1", thingIds: ["proc-grinding"], execution: "sequential" },
        { id: "step-2", thingIds: ["proc-boiling", "proc-brewing"], execution: "parallel" },
      ],
      internalObjects: ["obj-water"],
      completeness: "complete",
    });

    kernel.links.set("lnk-water-boiling", {
      id: "lnk-water-boiling",
      type: "consumption",
      source: "obj-water",
      target: "proc-boiling",
    });
    kernel.links.set("lnk-derived-invoke", {
      id: "lnk-derived-invoke",
      type: "invocation",
      source: "proc-grinding",
      target: "proc-boiling",
      origin: "derived-in-zoom",
    });

    const atlas = exposeSemanticKernel(kernel);
    const sd1 = atlas.nodes.get("opd-sd1");

    expect(atlas.rootOpd).toBe("opd-sd");
    expect(sd1).toBeDefined();
    expect(sd1?.contextThing).toBe("proc-parent");
    expect(sd1?.visibleThings).toEqual(expect.arrayContaining(["proc-parent", "proc-grinding", "proc-boiling", "proc-brewing", "obj-water"]));
    expect(sd1?.visibleLinks).toEqual(["lnk-water-boiling"]);

    const grinding = atlas.occurrences.get("view:opd-sd1:proc-grinding");
    const boiling = atlas.occurrences.get("view:opd-sd1:proc-boiling");
    const brewing = atlas.occurrences.get("view:opd-sd1:proc-brewing");
    const parent = atlas.occurrences.get("view:opd-sd1:proc-parent");

    expect(parent?.role).toBe("context");
    expect(grinding?.semanticRank).toBe(0);
    expect(boiling?.semanticRank).toBe(1);
    expect(brewing?.semanticRank).toBe(1);
    expect(boiling?.parallelClass).toBeDefined();
    expect(boiling?.parallelClass).toBe(brewing?.parallelClass);
    expect(grinding?.parallelClass).toBeUndefined();
  });

  it("projects legacy model into kernel + atlas + layout using appearances as layout cache", () => {
    const model = createModel("Legacy Projection Test");

    model.things.set("obj-water", {
      id: "obj-water",
      kind: "object",
      name: "Water",
      essence: "physical",
      affiliation: "systemic",
    });
    model.things.set("proc-boiling", {
      id: "proc-boiling",
      kind: "process",
      name: "Boiling",
      essence: "physical",
      affiliation: "systemic",
    });
    model.appearances.set("obj-water::opd-sd", {
      thing: "obj-water",
      opd: "opd-sd",
      x: 10,
      y: 20,
      w: 100,
      h: 50,
      internal: true,
    });
    model.appearances.set("proc-boiling::opd-sd", {
      thing: "proc-boiling",
      opd: "opd-sd",
      x: 200,
      y: 300,
      w: 120,
      h: 60,
    });

    const projection = projectLegacyModel(model);

    expect(projection.kernel.things.size).toBe(2);
    expect(projection.atlas.nodes.has("opd-sd")).toBe(true);
    expect(projection.layout.opdLayouts.has("opd-sd")).toBe(true);

    const layout = projection.layout.opdLayouts.get("opd-sd");
    expect(layout?.nodes.get("view:opd-sd:obj-water")?.x).toBe(10);
    expect(layout?.nodes.get("view:opd-sd:obj-water")?.internal).toBe(true);
    expect(layout?.nodes.get("view:opd-sd:proc-boiling")?.y).toBe(300);
  });

  it("renders OPL from semantic kernel through the transitional public API", () => {
    const kernel = createSemanticKernel("Kernel OPL API Test");
    kernel.things.set("obj-coffee", {
      id: "obj-coffee",
      kind: "object",
      name: "Coffee",
      essence: "physical",
      affiliation: "systemic",
    });
    kernel.things.set("proc-brewing", {
      id: "proc-brewing",
      kind: "process",
      name: "Brewing",
      essence: "physical",
      affiliation: "systemic",
    });

    const atlas = exposeSemanticKernel(kernel);
    const layout = {
      opdLayouts: new Map([
        ["opd-sd", {
          opdId: "opd-sd",
          nodes: new Map([
            ["view:opd-sd:obj-coffee", { viewId: "view:opd-sd:obj-coffee", x: 10, y: 10, w: 100, h: 50 }],
            ["view:opd-sd:proc-brewing", { viewId: "view:opd-sd:proc-brewing", x: 200, y: 10, w: 120, h: 60 }],
          ]),
          edges: new Map(),
        }],
      ]),
    };

    const doc = exposeFromSemanticKernel(kernel, "opd-sd", atlas, layout);
    const text = renderAllFromSemanticKernel(kernel, atlas, layout);

    expect(doc.opdId).toBe("opd-sd");
    expect(doc.sentences.length).toBeGreaterThan(0);
    expect(text).toContain("Coffee");
    expect(text).toContain("Brewing");
  });
});
