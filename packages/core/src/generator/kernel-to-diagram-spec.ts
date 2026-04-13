import { exposeSemanticKernel } from "../semantic-kernel";
import type { SemanticKernel } from "../semantic-kernel";
import type { DiagramSpec, DiagramSpecEdge, DiagramSpecNode } from "./diagram-spec-types";

export function kernelToDiagramSpec(kernel: SemanticKernel, opdId = "opd-sd"): DiagramSpec {
  const atlas = exposeSemanticKernel(kernel);
  const slice = atlas.nodes.get(opdId);
  const occurrenceByThing = new Map<string, string>();
  const nodes: DiagramSpecNode[] = [];

  if (!slice) {
    return {
      diagramId: opdId,
      title: kernel.meta.name,
      nodes: [],
      edges: [],
      groups: [],
    };
  }

  for (const occurrence of atlas.occurrences.values()) {
    if (occurrence.opdId !== opdId) continue;
    const thing = kernel.things.get(occurrence.thingId);
    if (!thing) continue;
    if (occurrenceByThing.has(thing.id)) continue;
    occurrenceByThing.set(thing.id, occurrence.id);

    const kind = thing.affiliation === "environmental"
      ? "external"
      : thing.kind === "process"
        ? "process"
        : thing.name === kernel.meta.name
          ? "system"
          : "object";

    const lane = kind === "process" ? "center" : kind === "external" ? "left" : "right";
    const emphasis = occurrence.role === "primary"
      || (slice.refinementId && thing.kind === "process" && occurrence.role === "internal")
      ? "primary"
      : "secondary";

    nodes.push({
      id: thing.id,
      label: thing.name,
      kind,
      lane,
      emphasis,
    });
  }

  const edges: DiagramSpecEdge[] = [];
  for (const linkId of slice.visibleLinks) {
    const link = kernel.links.get(linkId);
    if (!link) continue;
    if (!occurrenceByThing.has(link.source) || !occurrenceByThing.has(link.target)) continue;
    edges.push({
      id: link.id,
      source: link.source,
      target: link.target,
      kind: link.type,
      label: link.type,
    });
  }

  return {
    diagramId: opdId,
    title: slice.name || kernel.meta.name,
    nodes,
    edges,
    groups: [
      { id: "grp-left", label: "Context" },
      { id: "grp-center", label: "Function" },
      { id: "grp-right", label: "System" },
    ],
    layoutHints: {
      laneOrder: ["left", "center", "right"],
    },
  };
}
