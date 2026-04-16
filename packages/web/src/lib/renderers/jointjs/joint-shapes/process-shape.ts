import { dia, shapes } from "@joint/core";

export interface ProcessShapeAttrs {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  affiliation: "systemic" | "environmental";
  isMainProcess: boolean;
}

export function createProcessShape(attrs: ProcessShapeAttrs): dia.Element {
  const stroke = attrs.affiliation === "environmental" ? "#9aa4ad" : "#047857";
  const fill = attrs.isMainProcess ? "#bbf7d0" : "#d1fae5";

  const ellipse = new shapes.standard.Ellipse({
    id: attrs.id,
    position: { x: attrs.x, y: attrs.y },
    size: { width: attrs.width, height: attrs.height },
    attrs: {
      body: {
        fill,
        stroke,
        strokeWidth: attrs.isMainProcess ? 3 : 2,
        strokeDasharray: attrs.affiliation === "environmental" ? "6 4" : "0",
      },
      label: {
        text: attrs.label,
        fill: "#0f172a",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 12,
        fontWeight: attrs.isMainProcess ? 700 : 500,
        textWrap: { width: attrs.width - 16, height: attrs.height - 8, ellipsis: true },
      },
    },
  });

  return ellipse;
}
