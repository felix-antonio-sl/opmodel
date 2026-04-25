import { describe, expect, it } from "vitest";
import type { VisualRenderSpec } from "@opmodel/core";
import { visualRenderSpecToJointGraph } from "../src/lib/renderers/jointjs";

function makeSpec(): VisualRenderSpec {
  return {
    version: "v1",
    diagramKind: "opm-sd",
    title: "Test Diagram",
    style: "dark-terminal",
    scene: {
      lanes: [
        { id: "lane-context", label: "Context", role: "context" },
        { id: "lane-function", label: "Function", role: "function" },
        { id: "lane-system", label: "System", role: "system" },
      ],
      groups: [],
    },
    nodes: [
      {
        id: "obj-a",
        label: "Object A",
        opmKind: "object",
        visualRole: "value-object",
        affiliation: "systemic",
        laneId: "lane-function",
        importance: 2,
      },
      {
        id: "proc-m",
        label: "Main Process",
        opmKind: "process",
        visualRole: "main-process",
        affiliation: "systemic",
        laneId: "lane-function",
        importance: 1,
      },
    ],
    edges: [
      {
        id: "e-1",
        source: "obj-a",
        target: "proc-m",
        opmLinkKind: "consumption",
        label: "consumes",
        routingPriority: "primary",
      },
    ],
    guardrails: ["a", "b", "c"],
    canonicalOpl: "",
  };
}

describe("visualRenderSpecToJointGraph", () => {
  it("creates one cell per node and one link per edge", () => {
    const spec = makeSpec();
    const { graph, nodeIdToCell, edgeIdToLink } = visualRenderSpecToJointGraph(spec);

    expect(nodeIdToCell.size).toBe(2);
    expect(edgeIdToLink.size).toBe(1);

    expect(nodeIdToCell.has("obj-a")).toBe(true);
    expect(nodeIdToCell.has("proc-m")).toBe(true);
    expect(edgeIdToLink.has("e-1")).toBe(true);

    const cells = graph.getCells();
    expect(cells.length).toBe(3);
  });

  it("maps opmKind process to Ellipse and object to Rectangle", () => {
    const spec = makeSpec();
    const { nodeIdToCell } = visualRenderSpecToJointGraph(spec);

    const objCell = nodeIdToCell.get("obj-a");
    const procCell = nodeIdToCell.get("proc-m");

    expect(objCell?.get("type")).toContain("Rectangle");
    expect(procCell?.get("type")).toContain("Ellipse");
  });

  it("skips edges referencing missing nodes", () => {
    const spec = makeSpec();
    spec.edges.push({
      id: "e-orphan",
      source: "ghost",
      target: "proc-m",
      opmLinkKind: "agent",
      routingPriority: "secondary",
    });
    const { edgeIdToLink } = visualRenderSpecToJointGraph(spec);
    expect(edgeIdToLink.has("e-orphan")).toBe(false);
    expect(edgeIdToLink.size).toBe(1);
  });

  it("uses markers instead of generic type labels for normative links", () => {
    const spec = makeSpec();
    spec.edges = [
      {
        id: "e-aggregation",
        source: "obj-a",
        target: "proc-m",
        opmLinkKind: "aggregation",
        label: "aggregation",
        routingPriority: "secondary",
      },
    ];

    const { edgeIdToLink } = visualRenderSpecToJointGraph(spec);
    expect(edgeIdToLink.get("e-aggregation")?.labels()).toEqual([]);
  });

  it("renders tagged links with the tag text, not the generic tagged label", () => {
    const spec = makeSpec();
    spec.edges = [
      {
        id: "e-tagged",
        source: "obj-a",
        target: "proc-m",
        opmLinkKind: "tagged",
        label: "tagged",
        tag: "serves",
        routingPriority: "secondary",
      },
    ];

    const { edgeIdToLink } = visualRenderSpecToJointGraph(spec);
    expect(edgeIdToLink.get("e-tagged")?.labels().map((label) => label.attrs?.text?.text)).toEqual(["serves"]);
  });

  it("lays out structural object views as top-down clusters", () => {
    const spec = makeSpec();
    spec.nodes = [
      { id: "obj-hub", label: "Hub", opmKind: "object", visualRole: "value-object", affiliation: "systemic", laneId: "lane-function", importance: 2, isRefined: true },
      { id: "obj-a", label: "Part A", opmKind: "object", visualRole: "value-object", affiliation: "systemic", laneId: "lane-function", importance: 2 },
      { id: "obj-b", label: "Part B", opmKind: "object", visualRole: "value-object", affiliation: "systemic", laneId: "lane-function", importance: 2 },
    ];
    spec.edges = [
      { id: "e-a", source: "obj-hub", target: "obj-a", opmLinkKind: "aggregation", label: "aggregation", routingPriority: "secondary" },
      { id: "e-b", source: "obj-hub", target: "obj-b", opmLinkKind: "aggregation", label: "aggregation", routingPriority: "secondary" },
    ];

    const { nodeIdToCell } = visualRenderSpecToJointGraph(spec);
    const hubY = nodeIdToCell.get("obj-hub")!.position().y;
    expect(nodeIdToCell.get("obj-a")!.position().y).toBeGreaterThan(hubY);
    expect(nodeIdToCell.get("obj-b")!.position().y).toBeGreaterThan(hubY);
  });
});
