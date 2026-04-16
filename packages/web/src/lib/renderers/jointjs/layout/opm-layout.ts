import type { VisualRenderSpec, VisualRenderNode } from "@opmodel/core";

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
  const CANVAS_W = 1080;
  const CANVAS_H = 680;
  const MARGIN = 30;

  const containerBox: NodeBox = {
    id: container.id,
    x: MARGIN,
    y: MARGIN + 40,
    width: CANVAS_W - 2 * MARGIN,
    height: CANVAS_H - 2 * MARGIN - 40,
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

  // Subprocesses in center column, stacked vertically
  const subProcW = 150;
  const subProcH = 60;
  const subGap = Math.max(20, (insideHeight - subprocesses.length * subProcH) / Math.max(1, subprocesses.length + 1));
  const subColX = insideOriginX + (insideWidth - subProcW) / 2;
  subprocesses.forEach((n, i) => {
    nodes.set(n.id, {
      id: n.id,
      x: subColX,
      y: insideOriginY + subGap + i * (subProcH + subGap),
      width: subProcW,
      height: subProcH,
      isEmbedded: true,
      parentId: container.id,
    });
  });

  // Internal objects split between left and right inner columns
  const objW = 150;
  const objH = 60;
  const leftColX = insideOriginX + 10;
  const rightColX = insideOriginX + insideWidth - objW - 10;
  const objRows = Math.max(1, Math.ceil(internalObjects.length / 2));
  const objGap = Math.max(16, (insideHeight - objRows * objH) / (objRows + 1));
  internalObjects.forEach((n, i) => {
    const left = i % 2 === 0;
    const row = Math.floor(i / 2);
    nodes.set(n.id, {
      id: n.id,
      x: left ? leftColX : rightColX,
      y: insideOriginY + objGap + row * (objH + objGap),
      width: objW,
      height: objH,
      isEmbedded: true,
      parentId: container.id,
    });
  });

  // Environmentals positioned OUTSIDE the container (top row)
  const envW = 150;
  const envH = 60;
  const envGap = 18;
  const envRowWidth = environmentals.length * envW + (environmentals.length - 1) * envGap;
  let envX = (CANVAS_W - envRowWidth) / 2;
  environmentals.forEach((n) => {
    nodes.set(n.id, {
      id: n.id,
      x: envX,
      y: 4,
      width: envW,
      height: envH,
      isEmbedded: false,
    });
    envX += envW + envGap;
  });

  return { nodes, canvasWidth: CANVAS_W, canvasHeight: CANVAS_H };
}

function rootLayout(spec: VisualRenderSpec): LayoutResult {
  const CANVAS_W = 1080;
  const CANVAS_H = 680;
  const CENTER_X = CANVAS_W / 2;
  const CENTER_Y = CANVAS_H / 2;

  const nodes = new Map<string, NodeBox>();
  const nodeW = 150;
  const nodeH = 60;

  const mainProc = spec.nodes.find((n) => n.visualRole === "main-process");
  const others = spec.nodes.filter((n) => n !== mainProc);

  if (mainProc) {
    nodes.set(mainProc.id, {
      id: mainProc.id,
      x: CENTER_X - nodeW / 2,
      y: CENTER_Y - nodeH / 2,
      width: nodeW + 30,
      height: nodeH + 10,
    });
  }

  // Arrange others in concentric grid around main process
  const radius = 260;
  const count = others.length || 1;
  others.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const ring = Math.floor(i / 10); // break out to outer ring after 10
    const r = radius + ring * 180;
    const x = CENTER_X + Math.cos(angle) * r - nodeW / 2;
    const y = CENTER_Y + Math.sin(angle) * r - nodeH / 2;
    nodes.set(n.id, {
      id: n.id,
      x: Math.max(10, Math.min(CANVAS_W - nodeW - 10, x)),
      y: Math.max(10, Math.min(CANVAS_H - nodeH - 10, y)),
      width: nodeW,
      height: nodeH,
    });
  });

  return { nodes, canvasWidth: CANVAS_W, canvasHeight: CANVAS_H };
}
