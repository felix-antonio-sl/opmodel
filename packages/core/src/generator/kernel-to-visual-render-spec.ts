import { exposeSemanticKernel } from "../semantic-kernel";
import type { SemanticKernel } from "../semantic-kernel";
import { kernelToDiagramSpec } from "./kernel-to-diagram-spec";
import { kernelToOpl } from "./kernel-to-opl";
import type {
  VisualDiagramKind,
  VisualRenderEdge,
  VisualRendererStyle,
  VisualRenderFan,
  VisualRenderModifier,
  VisualRenderNode,
  VisualRenderSpec,
  VisualRenderState,
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

  const atlas = exposeSemanticKernel(kernel);
  const slice = atlas.nodes.get(opdId);

  // Refinement index: thing -> refinement owned by it; opd -> refinement that produces it.
  const refinementsByParent = new Map<string, { kind: "in-zoom" | "unfold"; childOpd: string }>();
  const refinementByChildOpd = new Map<string, { parentThing: string; kind: "in-zoom" | "unfold" }>();
  for (const ref of kernel.refinements.values()) {
    refinementsByParent.set(ref.parentThing, { kind: ref.kind, childOpd: ref.childOpd });
    refinementByChildOpd.set(ref.childOpd, { parentThing: ref.parentThing, kind: ref.kind });
  }
  const containerRef = refinementByChildOpd.get(opdId);

  const visibleThingIds = new Set(slice?.visibleThings ?? []);

  const nodes: VisualRenderNode[] = diagram.nodes.map((node) => {
    const thing = kernel.things.get(node.id);
    const isRefined = refinementsByParent.has(node.id);
    const isContainer = containerRef?.parentThing === node.id;
    return {
      id: node.id,
      label: node.label,
      opmKind: thing?.kind === "process" ? "process" : "object",
      visualRole: inferNodeRole(node),
      affiliation: thing?.affiliation === "environmental" ? "environmental" : "systemic",
      essence: thing?.essence === "informatical" ? "informational" : "physical",
      laneId: node.lane === "left" ? "lane-context" : node.lane === "center" ? "lane-function" : "lane-system",
      importance: node.emphasis === "primary" ? 1 : thing?.kind === "process" ? 2 : 3,
      ...(isRefined ? { isRefined: true } : {}),
      ...(isContainer && containerRef ? { inZoomContainerOf: containerRef.parentThing } : {}),
    };
  });

  const edges: VisualRenderEdge[] = diagram.edges.map((edge) => {
    const link = kernel.links.get(edge.id);
    const multiSource = link?.multiplicity_source;
    const multiTarget = link?.multiplicity_target;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      opmLinkKind: edge.kind,
      label: edge.label,
      semanticRole: inferEdgeSemanticRole(edge.kind),
      routingPriority: edge.kind === "agent" || edge.kind === "instrument" || edge.kind === "consumption" || edge.kind === "result"
        ? "primary"
        : "secondary",
      ...(link?.type === "exception" && link.exception_type ? { exceptionKind: link.exception_type } : {}),
      ...(multiSource ? { multiplicitySource: multiSource } : {}),
      ...(multiTarget ? { multiplicityTarget: multiTarget } : {}),
      ...(link?.path_label ? { pathLabel: link.path_label } : {}),
      ...(typeof link?.probability === "number" ? { probability: link.probability } : {}),
      ...(link?.tag ? { tag: link.tag } : {}),
      ...(link?.tag_reverse ? { tagReverse: link.tag_reverse } : {}),
    };
  });

  const edgeIds = new Set(edges.map((e) => e.id));
  const nodeIds = new Set(nodes.map((n) => n.id));

  const visibleStateIds = new Set(slice?.visibleStates ?? []);
  const states: VisualRenderState[] = [];
  for (const state of kernel.states.values()) {
    const owner = state.parentThing ?? state.parent;
    if (!owner || !nodeIds.has(owner)) continue;
    // If slice declares visibleStates, respect it; otherwise fall back to "owner visible".
    if (slice?.visibleStates && !visibleStateIds.has(state.id)) continue;
    states.push({
      id: state.id,
      ownerThingId: owner,
      label: state.name,
      initial: Boolean(state.initial),
      final: Boolean(state.final),
      default: Boolean(state.default),
      ...(state.current ? { current: true } : {}),
    });
  }

  const fans: VisualRenderFan[] = [];
  for (const fan of kernel.fans.values()) {
    const visibleMembers = fan.members.filter((m) => edgeIds.has(m));
    if (visibleMembers.length === 0) continue;
    fans.push({
      id: fan.id,
      operator: fan.type,
      ...(fan.direction ? { direction: fan.direction } : {}),
      members: visibleMembers,
      ...(fan.incomplete ? { incomplete: true } : {}),
      ...(fan.member_multiplicities ? { memberMultiplicities: fan.member_multiplicities } : {}),
    });
  }

  const modifiers: VisualRenderModifier[] = [];
  for (const mod of kernel.modifiers.values()) {
    if (!edgeIds.has(mod.over)) continue;
    modifiers.push({
      id: mod.id,
      edgeId: mod.over,
      kind: mod.type,
      ...(mod.negated ? { negated: true } : {}),
      ...(mod.condition_mode ? { conditionMode: mod.condition_mode } : {}),
    });
  }

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
    states,
    fans,
    modifiers,
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
