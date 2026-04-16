import { dia } from "@joint/core";
import type { VisualRenderSpec } from "@opmodel/core";
import { createObjectShape } from "./joint-shapes/object-shape";
import { createProcessShape } from "./joint-shapes/process-shape";
import { createStateShape } from "./joint-shapes/state-shape";
import { createFanShape } from "./joint-shapes/fan-shape";
import { applyModifierMarker } from "./joint-shapes/modifier-marker";
import { createProceduralLink } from "./joint-links/procedural-link";
import { isoStyle } from "./style-packs/iso-19450";
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

  const nodeIdToCell = new Map<string, dia.Element>();
  const edgeIdToLink = new Map<string, dia.Link>();

  spec.nodes.forEach((node, index) => {
    const pos = gridPosition(index, layout);
    const common = {
      id: node.id,
      label: node.label,
      x: pos.x,
      y: pos.y,
      width: layout.nodeWidth,
      height: layout.nodeHeight,
      affiliation: node.affiliation,
      essence: node.essence,
      isRefined: node.isRefined,
    };
    const cell = node.opmKind === "process"
      ? createProcessShape({ ...common, isMainProcess: node.visualRole === "main-process" })
      : createObjectShape(common);
    graph.addCell(cell);
    nodeIdToCell.set(node.id, cell as dia.Element);
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

  // States: embed as rountangles into the bottom strip of the owner object.
  const specStates = spec.states ?? [];
  const specFans = spec.fans ?? [];
  const specModifiers = spec.modifiers ?? [];
  const statesByOwner = new Map<string, typeof specStates>();
  for (const st of specStates) {
    if (!statesByOwner.has(st.ownerThingId)) statesByOwner.set(st.ownerThingId, []);
    statesByOwner.get(st.ownerThingId)!.push(st);
  }

  for (const [ownerId, states] of statesByOwner) {
    const parent = nodeIdToCell.get(ownerId);
    if (!parent) continue;
    const parentPos = parent.position();
    const parentSize = parent.size();
    const stateWidth = isoStyle.dimensions.state.width;
    const stateHeight = isoStyle.dimensions.state.height;
    const totalWidth = states.length * stateWidth + (states.length - 1) * 4;
    let startX = parentPos.x + (parentSize.width - totalWidth) / 2;
    const y = parentPos.y + parentSize.height - stateHeight - 6;

    for (const st of states) {
      const shape = createStateShape({
        id: st.id,
        label: st.label,
        initial: st.initial,
        final: st.final,
        default: st.default,
        current: st.current,
      });
      shape.position(startX, y);
      graph.addCell(shape);
      parent.embed(shape);
      startX += stateWidth + 4;
    }
  }

  // Fan badges: placed at the shared endpoint (convergent end) of the fan members.
  for (const fan of specFans) {
    if (fan.operator === "and") continue;
    const memberLinks = fan.members
      .map((id) => edgeIdToLink.get(id))
      .filter((l): l is dia.Link => !!l);
    if (memberLinks.length === 0) continue;

    // Compute convergent endpoint: the ID shared by all members on the same side.
    const memberEdges = fan.members
      .map((id) => spec.edges.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => !!e);
    const sharedSources = new Set(memberEdges.map((e) => e.source));
    const sharedTargets = new Set(memberEdges.map((e) => e.target));
    const commonNodeId = sharedTargets.size === 1
      ? [...sharedTargets][0]
      : sharedSources.size === 1
        ? [...sharedSources][0]
        : null;

    if (!commonNodeId) continue;
    const commonCell = nodeIdToCell.get(commonNodeId);
    if (!commonCell) continue;
    const cp = commonCell.position();
    const cs = commonCell.size();
    const cx = cp.x + cs.width / 2;
    const cy = cp.y - 14; // above the node

    try {
      const badge = createFanShape({ id: `fan-badge-${fan.id}`, operator: fan.operator, x: cx, y: cy });
      graph.addCell(badge);
    } catch {
      // AND case already filtered; any other throw is ignored.
    }
  }

  // Modifiers: decorate existing links with E/C markers.
  for (const mod of specModifiers) {
    const link = edgeIdToLink.get(mod.edgeId);
    if (!link) continue;
    applyModifierMarker({
      link,
      kind: mod.kind,
      negated: mod.negated,
      conditionMode: mod.conditionMode,
    });
  }

  return { graph, nodeIdToCell: nodeIdToCell as Map<string, dia.Cell>, edgeIdToLink };
}
