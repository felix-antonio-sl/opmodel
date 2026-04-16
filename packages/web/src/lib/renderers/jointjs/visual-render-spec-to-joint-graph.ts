import { dia } from "@joint/core";
import type { VisualRenderSpec } from "@opmodel/core";
import { createObjectShape } from "./joint-shapes/object-shape";
import { createProcessShape } from "./joint-shapes/process-shape";
import { createProceduralLink } from "./joint-links/procedural-link";
import { DEFAULT_LAYOUT, type JointGraphBuildResult, type NodeLayoutOptions } from "./types";

function gridPosition(index: number, layout: NodeLayoutOptions): { x: number; y: number } {
  const col = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  return {
    x: layout.marginX + col * (layout.nodeWidth + layout.gapX),
    y: layout.marginY + row * (layout.nodeHeight + layout.gapY),
  };
}

export function visualRenderSpecToJointGraph(
  spec: VisualRenderSpec,
  options: { layout?: Partial<NodeLayoutOptions> } = {},
): JointGraphBuildResult {
  const layout: NodeLayoutOptions = { ...DEFAULT_LAYOUT, ...(options.layout ?? {}) };
  const graph = new dia.Graph();

  const nodeIdToCell = new Map<string, dia.Cell>();
  const edgeIdToLink = new Map<string, dia.Link>();

  spec.nodes.forEach((node, index) => {
    const pos = gridPosition(index, layout);
    const cell = node.opmKind === "process"
      ? createProcessShape({
          id: node.id,
          label: node.label,
          x: pos.x,
          y: pos.y,
          width: layout.nodeWidth,
          height: layout.nodeHeight,
          affiliation: node.affiliation,
          isMainProcess: node.visualRole === "main-process",
        })
      : createObjectShape({
          id: node.id,
          label: node.label,
          x: pos.x,
          y: pos.y,
          width: layout.nodeWidth,
          height: layout.nodeHeight,
          affiliation: node.affiliation,
        });
    graph.addCell(cell);
    nodeIdToCell.set(node.id, cell);
  });

  const knownIds = new Set(nodeIdToCell.keys());
  spec.edges.forEach((edge) => {
    if (!knownIds.has(edge.source) || !knownIds.has(edge.target)) return;
    const link = createProceduralLink({
      id: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      opmLinkKind: edge.opmLinkKind,
      label: edge.label,
      routingPriority: edge.routingPriority,
    });
    graph.addCell(link);
    edgeIdToLink.set(edge.id, link);
  });

  return { graph, nodeIdToCell, edgeIdToLink };
}
