import { dia, shapes } from "@joint/core";

export interface ProceduralLinkAttrs {
  id: string;
  sourceId: string;
  targetId: string;
  opmLinkKind: string;
  label?: string;
  routingPriority: "primary" | "secondary";
}

const LINK_KIND_STYLE: Record<string, { stroke: string; dash?: string; marker?: string }> = {
  agent: { stroke: "#0f172a", marker: "filled-triangle" },
  instrument: { stroke: "#0f172a", marker: "circle" },
  consumption: { stroke: "#b91c1c" },
  result: { stroke: "#047857" },
  effect: { stroke: "#7c3aed", dash: "4 3" },
  invocation: { stroke: "#ea580c", dash: "2 3" },
  exhibition: { stroke: "#334155" },
  aggregation: { stroke: "#334155" },
  generalization: { stroke: "#334155" },
  classification: { stroke: "#334155" },
};

export function createProceduralLink(attrs: ProceduralLinkAttrs): dia.Link {
  const style = LINK_KIND_STYLE[attrs.opmLinkKind] ?? { stroke: "#475569" };
  const link = new shapes.standard.Link({
    id: attrs.id,
    source: { id: attrs.sourceId },
    target: { id: attrs.targetId },
    attrs: {
      line: {
        stroke: style.stroke,
        strokeWidth: attrs.routingPriority === "primary" ? 2 : 1.5,
        strokeDasharray: style.dash ?? "0",
        targetMarker: {
          type: "path",
          d: "M 10 -5 0 0 10 5 Z",
          fill: style.stroke,
        },
      },
    },
  });

  if (attrs.label && attrs.label.trim().length > 0) {
    link.appendLabel({
      position: 0.5,
      attrs: {
        text: {
          text: attrs.label,
          fill: "#0f172a",
          fontSize: 10,
          fontFamily: "Inter, system-ui, sans-serif",
        },
        rect: {
          fill: "#ffffff",
          stroke: "#e2e8f0",
          strokeWidth: 1,
          rx: 2,
          ry: 2,
        },
      },
    });
  }

  return link;
}
