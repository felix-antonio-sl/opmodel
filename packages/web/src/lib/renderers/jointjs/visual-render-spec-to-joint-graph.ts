import { dia, shapes } from "@joint/core";
import type { VisualRenderSpec } from "@opmodel/core";
import { createObjectShape } from "./joint-shapes/object-shape";
import { createProcessShape } from "./joint-shapes/process-shape";
import { createStateShape } from "./joint-shapes/state-shape";
import { createFanShape } from "./joint-shapes/fan-shape";
import { applyModifierMarker } from "./joint-shapes/modifier-marker";
import { createProceduralLink } from "./joint-links/procedural-link";
import { isoStyle } from "./style-packs/iso-19450";
import { computeOpmLayout } from "./layout/opm-layout";
import { DEFAULT_LAYOUT, type JointGraphBuildResult, type NodeLayoutOptions } from "./types";

export function visualRenderSpecToJointGraph(
  spec: VisualRenderSpec,
  options: { layout?: Partial<NodeLayoutOptions> } = {},
): JointGraphBuildResult {
  void options;
  const graph = new dia.Graph();

  const nodeIdToCell = new Map<string, dia.Element>();
  const edgeIdToLink = new Map<string, dia.Link>();

  const layoutResult = computeOpmLayout(spec);

  spec.nodes.forEach((node) => {
    const box = layoutResult.nodes.get(node.id);
    if (!box) return;
    // V-122: alias shown in parentheses next to full name
    const displayLabel = node.alias ? `${node.label} (${node.alias})` : node.label;
    const common = {
      id: node.id,
      label: displayLabel,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      affiliation: node.affiliation,
      essence: node.essence,
      isRefined: node.isRefined,
    };
    const cell = node.opmKind === "process"
      ? createProcessShape({ ...common, isMainProcess: node.visualRole === "main-process", duration: node.duration })
      : createObjectShape(common);
    graph.addCell(cell);
    nodeIdToCell.set(node.id, cell as dia.Element);
  });

  // Apply embedding for in-zoom: container embeds internal children.
  for (const box of layoutResult.nodes.values()) {
    if (!box.parentId) continue;
    const parent = nodeIdToCell.get(box.parentId);
    const child = nodeIdToCell.get(box.id);
    if (parent && child) parent.embed(child);
  }

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
      exceptionKind: edge.exceptionKind,
      multiplicitySource: edge.multiplicitySource,
      multiplicityTarget: edge.multiplicityTarget,
      pathLabel: edge.pathLabel,
      bidirectional: edge.bidirectional,
      isSplit: edge.isSplit,
      splitRole: edge.splitRole,
    });
    graph.addCell(link);
    edgeIdToLink.set(edge.id, link);
  });

  // States: embed as rountangles into the bottom strip of the owner object.
  // Wrap into multiple rows if they would overflow the owner width.
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
    const stateW = isoStyle.dimensions.state.width;
    const stateH = isoStyle.dimensions.state.height;
    const gap = 4;
    const availW = parentSize.width - 8;
    const perRow = Math.max(1, Math.floor((availW + gap) / (stateW + gap)));
    states.forEach((st, i) => {
      const shape = createStateShape({
        id: st.id,
        label: st.label,
        initial: st.initial,
        final: st.final,
        default: st.default,
        current: st.current,
      });
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const itemsInRow = Math.min(perRow, states.length - row * perRow);
      const rowWidth = itemsInRow * stateW + (itemsInRow - 1) * gap;
      const x = parentPos.x + (parentSize.width - rowWidth) / 2 + col * (stateW + gap);
      const y = parentPos.y + parentSize.height - (Math.ceil(states.length / perRow) - row) * (stateH + 2) - 2;
      shape.position(x, y);
      graph.addCell(shape);
      parent.embed(shape);
    });
  }

  // Fan badges: placed at the shared endpoint (convergent end).
  for (const fan of specFans) {
    if (fan.operator === "and") continue;
    const memberEdges = fan.members
      .map((id) => spec.edges.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => !!e);
    if (memberEdges.length === 0) continue;
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
    const cy = cp.y - 14;
    try {
      const badge = createFanShape({ id: `fan-badge-${fan.id}`, operator: fan.operator, x: cx, y: cy, isProbabilistic: fan.isProbabilistic, hiddenRefinersCount: fan.hiddenRefinersCount });
      graph.addCell(badge);
    } catch {
      // AND already skipped; others ignored
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

  // §1.8: indicador de partes incompletas (barra bajo el nodo)
  for (const node of spec.nodes) {
    if (!node.hasIncompleteParts) continue;
    const cell = nodeIdToCell.get(node.id);
    if (!cell) continue;
    const pos = cell.position();
    const size = cell.size();
    const marker = new shapes.standard.Rectangle({
      id: `incomplete-${node.id}`,
      position: { x: pos.x + size.width / 2 - 12, y: pos.y + size.height + 2 },
      size: { width: 24, height: 12 },
      attrs: {
        body: { fill: "transparent", stroke: "transparent" },
        label: {
          text: isoStyle.markers.incompletePartsBar,
          fill: "#475569",
          fontSize: isoStyle.typography.markerFontSize,
          fontFamily: isoStyle.typography.family,
        },
      },
    });
    graph.addCell(marker);
  }

  // §10.12: icono de semi-plegado en esquina superior derecha
  for (const node of spec.nodes) {
    if (!node.isSemiFolded) continue;
    const cell = nodeIdToCell.get(node.id);
    if (!cell) continue;
    const pos = cell.position();
    const size = cell.size();
    const foldIcon = new shapes.standard.Rectangle({
      id: `semifold-${node.id}`,
      position: { x: pos.x + size.width - 16, y: pos.y + 2 },
      size: { width: 14, height: 14 },
      attrs: {
        body: { fill: "transparent", stroke: "transparent" },
        label: {
          text: isoStyle.markers.semiFoldIcon,
          fill: "#64748b",
          fontSize: isoStyle.typography.markerFontSize - 1,
          fontFamily: isoStyle.typography.family,
        },
      },
    });
    graph.addCell(foldIcon);
    cell.embed(foldIcon);
  }

  return { graph, nodeIdToCell: nodeIdToCell as Map<string, dia.Cell>, edgeIdToLink };
}
