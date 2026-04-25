import type { VisualRenderEdge, VisualRenderSpec, VisualRenderNode } from "@opmodel/core";
import { isoStyle } from "../style-packs/iso-19450";

export interface NodeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isContainer?: boolean;
  isEmbedded?: boolean;
  parentId?: string;
}

export interface LayoutResult {
  nodes: Map<string, NodeBox>;
  canvasWidth: number;
  canvasHeight: number;
}

// SSOT V-4/V-5/§2.2: states arranged horizontally in the bottom strip of
// their owner. The owner box must be wide enough to fit them in row(s) and
// tall enough to leave a label band above the state strip.
const STATE_GAP = 4;
const STATE_OUTER_PAD = 8;        // 4px on each side of the strip
const STATE_BOTTOM_PAD = 4;       // bottom margin under the last state row
const MAX_STATES_PER_ROW = 4;     // cap so wide objects don't get out of hand
const MIN_LABEL_BAND = 32;        // px reserved above states for the label (≥2 lines @13px)

function countStatesByOwner(spec: VisualRenderSpec): Map<string, number> {
  const out = new Map<string, number>();
  for (const st of spec.states ?? []) {
    out.set(st.ownerThingId, (out.get(st.ownerThingId) ?? 0) + 1);
  }
  return out;
}

// Rough text width estimate at the default font size (Inter 13px).
// Avoids depending on canvas measurement at layout time.
function labelBoxWidth(label: string, duration?: { unit?: string; expected?: number; min?: number; max?: number; distribution?: string }): number {
  const main = label.length * 7.6;
  const dur = duration ? 8 * 7.6 : 0;  // ~8 chars for "[~120s]" etc.
  return Math.max(main, dur);
}

function objectBoxSize(
  defaultW: number,
  defaultH: number,
  nStates: number,
  maxWidth?: number,
): { width: number; height: number; stateRows: number; statesPerRow: number } {
  if (nStates <= 0) return { width: defaultW, height: defaultH, stateRows: 0, statesPerRow: 0 };
  const sw = isoStyle.dimensions.state.width;
  const sh = isoStyle.dimensions.state.height;
  // Honor an upper-width budget by wrapping states into more rows.
  const widthBudget = maxWidth ?? Infinity;
  const maxFitsInBudget = Math.max(1, Math.floor((widthBudget - STATE_OUTER_PAD + STATE_GAP) / (sw + STATE_GAP)));
  const perRow = Math.min(MAX_STATES_PER_ROW, maxFitsInBudget, nStates);
  const rows = Math.ceil(nStates / perRow);
  const requiredInner = perRow * sw + (perRow - 1) * STATE_GAP;
  const width = Math.max(defaultW, requiredInner + STATE_OUTER_PAD);
  const stateStripH = rows * sh + (rows - 1) * 2 + STATE_BOTTOM_PAD;
  const height = Math.max(defaultH, MIN_LABEL_BAND + stateStripH);
  return { width, height, stateRows: rows, statesPerRow: perRow };
}

/**
 * Layout for OPM diagrams respecting SSOT:
 * - §10.3/§10.4: in-zoom container is an enlarged ellipse/rect with
 *   internal things embedded inside. Time flows top→bottom (V-35).
 * - Root OPDs: main process centered, participants around (agents left,
 *   instruments right, inputs top, outputs bottom, structural above/below).
 */
export function computeOpmLayout(spec: VisualRenderSpec): LayoutResult {
  const container = spec.nodes.find((n) => n.inZoomContainerOf);
  if (container) return inZoomLayout(spec, container);
  return rootLayout(spec);
}

function inZoomLayout(spec: VisualRenderSpec, container: VisualRenderNode): LayoutResult {
  const isObjectContainer = container.opmKind === "object";
  const BASE_CANVAS_W = 1080;
  const MARGIN = 30;
  // V-35 timeline gap: needs room for edge labels (event/condition/multiplicity)
  // on the procedural links connecting consecutive subprocesses.
  const SUB_TIMELINE_GAP = 44;
  const SUB_PROC_H = 60;

  // Grow canvas vertically so the timeline of subprocesses always fits.
  // For long timelines (>8 subprocesses) split the column in two so the
  // diagram stays compact (still respects V-35 top→bottom).
  const subprocessCount = spec.nodes.filter(
    (n) => n.id !== container.id && n.opmKind === "process" && n.affiliation === "systemic",
  ).length;
  const subColumns = subprocessCount > 8 ? 2 : 1;
  const perColumn = Math.ceil(subprocessCount / subColumns);
  const subColumnH = Math.max(1, perColumn) * (SUB_PROC_H + SUB_TIMELINE_GAP) + SUB_TIMELINE_GAP;

  // Environmentals sit above the container; their height (which can grow
  // when an object has multiple states) determines where the container starts.
  const envCountByOwner = countStatesByOwner(spec);
  const environmentalNodes = spec.nodes.filter((n) => n.id !== container.id && n.affiliation === "environmental");
  const envMaxH = environmentalNodes.reduce((m, n) => {
    if (n.opmKind !== "object") return Math.max(m, 60);
    const sz = objectBoxSize(150, 60, envCountByOwner.get(n.id) ?? 0);
    return Math.max(m, sz.height);
  }, environmentalNodes.length ? 60 : 0);
  const envSideBand = isObjectContainer && environmentalNodes.length > 0 ? 260 : 0;
  const CANVAS_W = BASE_CANVAS_W + envSideBand;
  // Reserve more vertical space for edge labels of links coming from
  // environmentals into the container (e.g. "agent" caption falling near the
  // container's own label band). 32px gap keeps both legible.
  const envBand = !isObjectContainer && environmentalNodes.length ? envMaxH + 32 : 24;

  const CANVAS_H = Math.max(680, envBand + 2 * MARGIN + subColumnH + 60);

  const containerBox: NodeBox = {
    id: container.id,
    x: MARGIN,
    y: MARGIN + envBand,
    width: CANVAS_W - 2 * MARGIN - envSideBand,
    height: CANVAS_H - 2 * MARGIN - envBand,
    isContainer: true,
  };

  const nodes = new Map<string, NodeBox>();
  nodes.set(container.id, containerBox);

  const insideWidth = containerBox.width - 40;
  const insideHeight = containerBox.height - 60;
  const insideOriginX = containerBox.x + 20;
  const insideOriginY = containerBox.y + 40;

  // Classify: subprocesses (internal processes) timeline top→bottom;
  // internal objects placed near them; external participants in side slots.
  const others = spec.nodes.filter((n) => n.id !== container.id);
  const subprocesses = others.filter((n) => n.opmKind === "process" && n.affiliation === "systemic");
  const internalObjects = others.filter((n) => n.opmKind === "object" && n.affiliation === "systemic");
  const environmentals = others.filter((n) => n.affiliation === "environmental");

  // Subprocesses arranged in 1 or 2 columns (timeline V-35).
  // Width grows for long names (e.g. "Vehicle Location Calculating").
  const subProcDefW = 150;
  const subProcH = 60;
  // Process shape is an ellipse: curvature steals horizontal text capacity at
  // top/bottom of the box, so allocate +60 over the raw label width (mirrors
  // mainProc heuristic) instead of the previous +36.
  const subprocSizes = subprocesses.map((n) => {
    const labelW = labelBoxWidth(n.label, n.duration);
    return Math.max(subProcDefW, Math.min(300, labelW + 60));
  });
  const widestSub = subprocSizes.reduce((m, w) => Math.max(m, w), subProcDefW);
  // Spacing between subprocess columns: keep them tight enough that internal
  // object side-bands (objMaxW + small gutter) still fit inside the container.
  const colSpacing = subColumns === 2 ? 60 : 0;
  const colsTotalW = subColumns * widestSub + (subColumns - 1) * colSpacing;
  const colBaseX = insideOriginX + (insideWidth - colsTotalW) / 2;
  const itemsPerCol = perColumn;
  const subGap = SUB_TIMELINE_GAP;
  subprocesses.forEach((n, i) => {
    const col = Math.floor(i / itemsPerCol);
    const row = i % itemsPerCol;
    const colX = colBaseX + col * (widestSub + colSpacing);
    nodes.set(n.id, {
      id: n.id,
      x: colX + (widestSub - subprocSizes[i]!) / 2,
      y: insideOriginY + subGap + row * (subProcH + subGap),
      width: subprocSizes[i]!,
      height: subProcH,
      isEmbedded: true,
      parentId: container.id,
    });
  });

  // Internal objects split between left and right inner columns.
  // Each object is sized to fit its states (V-4/V-5) and its label width.
  const statesByOwner = countStatesByOwner(spec);
  const defObjW = 150;
  const defObjH = 60;
  // When the subprocess timeline uses 2 columns, the central x-space is
  // crowded — keep internal objects narrow so they stay on the side margins
  // and don't overlap subprocesses.
  const objMaxW = subColumns === 2 ? 150 : 220;
  const internalSizes = internalObjects.map((n) => {
    const sz = n.opmKind === "object"
      ? objectBoxSize(defObjW, defObjH, statesByOwner.get(n.id) ?? 0, objMaxW)
      : { width: defObjW, height: defObjH, stateRows: 0, statesPerRow: 0 };
    const labelW = labelBoxWidth(n.label);
    return { ...sz, width: Math.max(sz.width, Math.min(objMaxW, labelW + 30)) };
  });
  const widestObj = internalSizes.reduce((m, b) => Math.max(m, b.width), defObjW);
  const tallestObj = internalSizes.reduce((m, b) => Math.max(m, b.height), defObjH);
  const leftColX = insideOriginX + 10;
  const rightColX = insideOriginX + insideWidth - widestObj - 10;
  const objRows = Math.max(1, Math.ceil(internalObjects.length / 2));
  const objGap = Math.max(16, (insideHeight - objRows * tallestObj) / (objRows + 1));
  internalObjects.forEach((n, i) => {
    const sz = internalSizes[i]!;
    const left = i % 2 === 0;
    const row = Math.floor(i / 2);
    nodes.set(n.id, {
      id: n.id,
      x: left ? leftColX : rightColX,
      y: insideOriginY + objGap + row * (tallestObj + objGap),
      width: sz.width,
      height: sz.height,
      isEmbedded: true,
      parentId: container.id,
    });
  });

  // Environmentals positioned OUTSIDE the container, sized for states + label.
  // Process in-zoom keeps the historical top band. Object in-zoom/unfold puts
  // environmentals on the right so structural/tagged links do not cross the
  // internal object/process arrangement.
  const defEnvW = 150;
  const defEnvH = 60;
  const envSizes = environmentals.map((n) => {
    const sz = n.opmKind === "object"
      ? objectBoxSize(defEnvW, defEnvH, statesByOwner.get(n.id) ?? 0)
      : { width: defEnvW, height: defEnvH, stateRows: 0, statesPerRow: 0 };
    const labelW = labelBoxWidth(n.label);
    return { ...sz, width: Math.max(sz.width, Math.min(220, labelW + 30)) };
  });
  if (isObjectContainer) {
    const envGap = 24;
    const envTotalH = envSizes.reduce((acc, sz, i) => acc + sz.height + (i > 0 ? envGap : 0), 0);
    let envY = containerBox.y + Math.max(40, (containerBox.height - envTotalH) / 2);
    environmentals.forEach((n, i) => {
      const sz = envSizes[i]!;
      nodes.set(n.id, {
        id: n.id,
        x: containerBox.x + containerBox.width + 34,
        y: envY,
        width: sz.width,
        height: sz.height,
        isEmbedded: false,
      });
      envY += sz.height + envGap;
    });
  } else {
    const envGap = 18;
    const envRowWidth = envSizes.reduce((acc, sz, i) => acc + sz.width + (i > 0 ? envGap : 0), 0);
    let envX = (CANVAS_W - envRowWidth) / 2;
    environmentals.forEach((n, i) => {
      const sz = envSizes[i]!;
      nodes.set(n.id, {
        id: n.id,
        x: envX,
        y: 4,
        width: sz.width,
        height: sz.height,
        isEmbedded: false,
      });
      envX += sz.width + envGap;
    });
  }

  return { nodes, canvasWidth: CANVAS_W, canvasHeight: CANVAS_H };
}

function rootLayout(spec: VisualRenderSpec): LayoutResult {
  const CANVAS_W = 1080;
  const nodes = new Map<string, NodeBox>();
  const nodeW = 150;
  const nodeH = 60;
  const statesByOwner = countStatesByOwner(spec);

  const mainProc = spec.nodes.find((n) => n.visualRole === "main-process");
  const others = spec.nodes.filter((n) => n !== mainProc);

  // Structural/view OPDs may intentionally have no process as center of
  // gravity (§15). In those cases a circular process-centric layout produces
  // crossings and false visual hierarchy. Use graph-aware object clusters.
  if (!mainProc && spec.edges.some((e) => STRUCTURAL_ROOT_LINKS.has(e.opmLinkKind))) {
    return structuralRootLayout(spec, statesByOwner);
  }

  // Grid fallback for crowded SD diagrams (>18 satellites): the concentric
  // ring layout collapses into illegible overlap, so switch to a top-banner
  // (mainProc) + grid (others) arrangement that scales linearly.
  if (others.length > 18) return rootGridLayout(spec, mainProc, others, statesByOwner);

  const CANVAS_H = 680;
  const CENTER_X = CANVAS_W / 2;
  const CENTER_Y = CANVAS_H / 2;

  if (mainProc) {
    // Grow main process ellipse so long labels (e.g., "Hospitalización
    // Domiciliaria Proveyendo") don't clip against the ellipse boundary.
    // Ellipse curvature consumes horizontal text capacity at the top/bottom
    // of the box, so allow extra width beyond the raw label measurement.
    const labelW = labelBoxWidth(mainProc.label, mainProc.duration);
    const w = Math.max(nodeW + 30, Math.min(380, labelW + 90));
    const h = mainProc.duration ? nodeH + 30 : nodeH + 14;
    nodes.set(mainProc.id, {
      id: mainProc.id,
      x: CENTER_X - w / 2,
      y: CENTER_Y - h / 2,
      width: w,
      height: h,
    });
  }

  // Arrange others in concentric grid around main process; objects with states
  // get a wider/taller box so the bottom strip fits horizontally (V-4/V-5),
  // and any node with a long label gets a wider box.
  const radius = 260;
  const count = others.length || 1;
  others.forEach((n, i) => {
    const stateSz = n.opmKind === "object"
      ? objectBoxSize(nodeW, nodeH, statesByOwner.get(n.id) ?? 0)
      : { width: nodeW, height: nodeH };
    const labelW = labelBoxWidth(n.label, n.opmKind === "process" ? n.duration : undefined);
    const w = Math.max(stateSz.width, Math.min(240, labelW + 40));
    const sz = { width: w, height: stateSz.height };
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const ring = Math.floor(i / 10); // break out to outer ring after 10
    const r = radius + ring * 180;
    const x = CENTER_X + Math.cos(angle) * r - sz.width / 2;
    const y = CENTER_Y + Math.sin(angle) * r - sz.height / 2;
    nodes.set(n.id, {
      id: n.id,
      x: Math.max(10, Math.min(CANVAS_W - sz.width - 10, x)),
      y: Math.max(10, Math.min(CANVAS_H - sz.height - 10, y)),
      width: sz.width,
      height: sz.height,
    });
  });

  return { nodes, canvasWidth: CANVAS_W, canvasHeight: CANVAS_H };
}

const STRUCTURAL_ROOT_LINKS = new Set(["aggregation", "exhibition", "generalization", "classification", "tagged"]);

function rootNodeSize(node: VisualRenderNode, statesByOwner: Map<string, number>, maxWidth = 240): { width: number; height: number } {
  const baseW = node.opmKind === "object" ? 170 : 180;
  const baseH = node.opmKind === "object" ? 68 : 74;
  const stateSz = node.opmKind === "object"
    ? objectBoxSize(baseW, baseH, statesByOwner.get(node.id) ?? 0, maxWidth)
    : { width: baseW, height: baseH };
  const labelW = labelBoxWidth(node.label, node.opmKind === "process" ? node.duration : undefined);
  return {
    width: Math.max(stateSz.width, Math.min(maxWidth, labelW + 48)),
    height: stateSz.height,
  };
}

function preferredStructuralRoot(component: VisualRenderNode[], edges: VisualRenderEdge[]): VisualRenderNode {
  const score = new Map(component.map((node) => [node.id, node.isRefined ? 4 : 0]));
  for (const edge of edges) {
    if (edge.opmLinkKind === "generalization" || edge.opmLinkKind === "classification") {
      score.set(edge.target, (score.get(edge.target) ?? 0) + 3);
      score.set(edge.source, (score.get(edge.source) ?? 0) + 1);
    } else {
      score.set(edge.source, (score.get(edge.source) ?? 0) + 3);
      score.set(edge.target, (score.get(edge.target) ?? 0) + 1);
    }
  }
  return [...component].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) || a.label.localeCompare(b.label))[0]!;
}

function structuralRootLayout(spec: VisualRenderSpec, statesByOwner: Map<string, number>): LayoutResult {
  const CANVAS_W = 1280;
  const MARGIN = 36;
  const CLUSTER_GAP_X = 44;
  const CLUSTER_GAP_Y = 56;
  const NODE_GAP_X = 36;
  const NODE_GAP_Y = 42;

  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  const structuralEdges = spec.edges.filter((edge) =>
    STRUCTURAL_ROOT_LINKS.has(edge.opmLinkKind) && nodeById.has(edge.source) && nodeById.has(edge.target),
  );

  const adjacency = new Map(spec.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of structuralEdges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const seen = new Set<string>();
  const components: VisualRenderNode[][] = [];
  for (const node of spec.nodes) {
    if (seen.has(node.id)) continue;
    const stack = [node.id];
    const ids: string[] = [];
    seen.add(node.id);
    while (stack.length > 0) {
      const id = stack.pop()!;
      ids.push(id);
      for (const next of adjacency.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    components.push(ids.map((id) => nodeById.get(id)!).sort((a, b) => a.label.localeCompare(b.label)));
  }

  components.sort((a, b) => b.length - a.length || a[0]!.label.localeCompare(b[0]!.label));

  const nodes = new Map<string, NodeBox>();
  let cursorX = MARGIN;
  let cursorY = MARGIN;
  let rowH = 0;

  for (const component of components) {
    const componentEdges = structuralEdges.filter((edge) =>
      component.some((node) => node.id === edge.source) && component.some((node) => node.id === edge.target),
    );
    const root = preferredStructuralRoot(component, componentEdges);
    const children = component.filter((node) => node.id !== root.id);
    const rootSize = rootNodeSize(root, statesByOwner, 300);
    const childSizes = children.map((node) => rootNodeSize(node, statesByOwner, 240));
    const cols = Math.max(1, Math.min(3, children.length || 1));
    const childRows = Math.ceil(children.length / cols);
    const colWidths = Array.from({ length: cols }, (_, col) => {
      const colChildren = childSizes.filter((_, i) => i % cols === col);
      return Math.max(190, ...colChildren.map((size) => size.width));
    });
    const childGridW = colWidths.reduce((sum, w) => sum + w, 0) + NODE_GAP_X * Math.max(0, cols - 1);
    const clusterW = Math.max(rootSize.width, childGridW);
    const childRowHeights = Array.from({ length: childRows }, (_, row) => {
      const rowChildren = childSizes.filter((_, i) => Math.floor(i / cols) === row);
      return Math.max(0, ...rowChildren.map((size) => size.height));
    });
    const childrenH = childRowHeights.reduce((sum, h) => sum + h, 0) + NODE_GAP_Y * Math.max(0, childRows - 1);
    const clusterH = rootSize.height + (children.length > 0 ? NODE_GAP_Y + childrenH : 0);

    if (cursorX + clusterW > CANVAS_W - MARGIN && cursorX > MARGIN) {
      cursorX = MARGIN;
      cursorY += rowH + CLUSTER_GAP_Y;
      rowH = 0;
    }

    nodes.set(root.id, {
      id: root.id,
      x: cursorX + (clusterW - rootSize.width) / 2,
      y: cursorY,
      width: rootSize.width,
      height: rootSize.height,
    });

    const gridX = cursorX + (clusterW - childGridW) / 2;
    const gridY = cursorY + rootSize.height + NODE_GAP_Y;
    children.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const size = childSizes[i]!;
      const x = gridX + colWidths.slice(0, col).reduce((sum, w) => sum + w + NODE_GAP_X, 0) + (colWidths[col]! - size.width) / 2;
      const y = gridY + childRowHeights.slice(0, row).reduce((sum, h) => sum + h + NODE_GAP_Y, 0);
      nodes.set(node.id, { id: node.id, x, y, width: size.width, height: size.height });
    });

    cursorX += clusterW + CLUSTER_GAP_X;
    rowH = Math.max(rowH, clusterH);
  }

  return { nodes, canvasWidth: CANVAS_W, canvasHeight: Math.max(680, cursorY + rowH + MARGIN) };
}

// Grid fallback for very crowded root OPDs (e.g. ev-ams SD with ~30 things):
// a top banner with the main process + a regular grid below for everyone else.
// Scales without overlap and gives the user a navigable starting point until
// they manually re-arrange or zoom into a sub-OPD.
function rootGridLayout(
  spec: VisualRenderSpec,
  mainProc: VisualRenderNode | undefined,
  others: VisualRenderNode[],
  statesByOwner: Map<string, number>,
): LayoutResult {
  void spec;
  const CANVAS_W = 1280;
  const MARGIN = 30;
  const CELL_W = 170;
  const CELL_H = 80;
  const GAP_X = 24;
  const GAP_Y = 28;
  const cols = Math.max(1, Math.floor((CANVAS_W - 2 * MARGIN + GAP_X) / (CELL_W + GAP_X)));
  const rows = Math.ceil(others.length / cols);
  const nodes = new Map<string, NodeBox>();
  const mainH = mainProc?.duration ? 90 : 74;
  const mainY = MARGIN;
  if (mainProc) {
    const labelW = labelBoxWidth(mainProc.label, mainProc.duration);
    const w = Math.max(220, Math.min(440, labelW + 90));
    nodes.set(mainProc.id, {
      id: mainProc.id,
      x: (CANVAS_W - w) / 2,
      y: mainY,
      width: w,
      height: mainH,
    });
  }
  const gridTop = mainY + mainH + 36;
  others.forEach((n, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const stateSz = n.opmKind === "object"
      ? objectBoxSize(CELL_W, CELL_H, statesByOwner.get(n.id) ?? 0, CELL_W)
      : { width: CELL_W, height: CELL_H, stateRows: 0, statesPerRow: 0 };
    nodes.set(n.id, {
      id: n.id,
      x: MARGIN + col * (CELL_W + GAP_X),
      y: gridTop + row * (CELL_H + GAP_Y),
      width: stateSz.width,
      height: Math.max(CELL_H, stateSz.height),
    });
  });
  const canvasH = gridTop + rows * (CELL_H + GAP_Y) + MARGIN;
  return { nodes, canvasWidth: CANVAS_W, canvasHeight: Math.max(680, canvasH) };
}
