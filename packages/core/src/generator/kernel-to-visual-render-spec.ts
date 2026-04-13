import type { SemanticKernel } from "../semantic-kernel";
import { kernelToDiagramSpec } from "./kernel-to-diagram-spec";
import { kernelToOpl } from "./kernel-to-opl";
import type {
  VisualDiagramKind,
  VisualRenderEdge,
  VisualRendererStyle,
  VisualRenderNode,
  VisualRenderSpec,
} from "./visual-render-spec";

function inferNodeRole(node: { id: string; kind: string; label: string; lane?: string; emphasis?: "primary" | "secondary" }): VisualRenderNode["visualRole"] {
  const label = node.label.toLowerCase();

  if (node.kind === "process") {
    return node.emphasis === "primary" ? "main-process" : "subprocess";
  }

  if (node.kind === "system") return "system";
  if (node.kind === "external") {
    if (label.includes("beneficiar")) return "beneficiary";
    return "external-object";
  }
  if (label.includes("instrument") || label.includes("station") || label.includes("tool")) return "instrument";
  if (label.includes("agent") || label.includes("operator") || label.includes("user") || label.includes("driver")) return "agent";
  if (label.includes("input") || label.includes("energy") || label.includes("request")) return "input";
  if (label.includes("output") || label.includes("result") || label.includes("charged")) return "output";
  return "value-object";
}

function inferEdgeSemanticRole(linkKind: string): string {
  switch (linkKind) {
    case "agent": return "human-enabler";
    case "instrument": return "instrument-enabler";
    case "consumption": return "input";
    case "result": return "output";
    case "effect": return "state-change";
    case "exhibition": return "system-exhibition";
    case "invocation": return "invocation";
    default: return linkKind;
  }
}

export function kernelToVisualRenderSpec(
  kernel: SemanticKernel,
  options?: { style?: VisualRendererStyle; opdId?: string },
): VisualRenderSpec {
  const style = options?.style ?? "dark-terminal";
  const opdId = options?.opdId ?? "opd-sd";
  const diagram = kernelToDiagramSpec(kernel, opdId);
  const canonicalOpl = kernelToOpl(kernel);
  const diagramKind: VisualDiagramKind = opdId === "opd-sd" ? "opm-sd" : "opm-sd1";

  const nodes: VisualRenderNode[] = diagram.nodes.map((node) => {
    const thing = kernel.things.get(node.id);
    return {
      id: node.id,
      label: node.label,
      opmKind: thing?.kind === "process" ? "process" : "object",
      visualRole: inferNodeRole(node),
      affiliation: thing?.affiliation === "environmental" ? "environmental" : "systemic",
      laneId: node.lane === "left" ? "lane-context" : node.lane === "center" ? "lane-function" : "lane-system",
      importance: node.emphasis === "primary" ? 1 : thing?.kind === "process" ? 2 : 3,
    };
  });

  const edges: VisualRenderEdge[] = diagram.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    opmLinkKind: edge.kind,
    label: edge.label,
    semanticRole: inferEdgeSemanticRole(edge.kind),
    routingPriority: edge.kind === "agent" || edge.kind === "instrument" || edge.kind === "consumption" || edge.kind === "result"
      ? "primary"
      : "secondary",
  }));

  return {
    version: "v1",
    diagramKind,
    title: diagram.title,
    style,
    scene: {
      lanes: [
        { id: "lane-context", label: "Context", role: "context" },
        { id: "lane-function", label: diagramKind === "opm-sd1" ? "Refinement" : "Function", role: diagramKind === "opm-sd1" ? "refinement" : "function" },
        { id: "lane-system", label: "System", role: "system" },
      ],
      groups: [
        { id: "group-context", label: "Context", kind: "context-box" },
        { id: "group-core", label: diagramKind === "opm-sd1" ? "Refinement Core" : "Functional Core", kind: "cluster" },
        { id: "group-legend", label: "Legend", kind: "legend" },
      ],
    },
    nodes,
    edges,
    guardrails: [
      "Do not invent OPM semantics absent from the provided nodes, edges, and canonical OPL.",
      "Treat canonical OPL as the semantic source of truth and the diagram as a derived visualization.",
      "Preserve process vs object distinction visually and explicitly.",
      "Keep the primary process as the visual center of gravity.",
      "Do not collapse multiple OPM link kinds into one unlabeled generic arrow style.",
      "Respect the lane structure Context -> Function/Refinement -> System.",
    ],
    canonicalOpl,
  };
}
