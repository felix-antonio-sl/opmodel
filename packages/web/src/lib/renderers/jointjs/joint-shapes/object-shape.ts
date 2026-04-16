import { dia, shapes } from "@joint/core";

export interface ObjectShapeAttrs {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  affiliation: "systemic" | "environmental";
}

export function createObjectShape(attrs: ObjectShapeAttrs): dia.Element {
  const stroke = attrs.affiliation === "environmental" ? "#9aa4ad" : "#1d4ed8";
  const fill = attrs.affiliation === "environmental" ? "#f3f4f6" : "#dbeafe";

  const rect = new shapes.standard.Rectangle({
    id: attrs.id,
    position: { x: attrs.x, y: attrs.y },
    size: { width: attrs.width, height: attrs.height },
    attrs: {
      body: {
        fill,
        stroke,
        strokeWidth: 2,
        rx: 2,
        ry: 2,
        strokeDasharray: attrs.affiliation === "environmental" ? "6 4" : "0",
      },
      label: {
        text: attrs.label,
        fill: "#0f172a",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 12,
        fontWeight: 500,
        textWrap: { width: attrs.width - 16, height: attrs.height - 8, ellipsis: true },
      },
    },
  });

  return rect;
}
