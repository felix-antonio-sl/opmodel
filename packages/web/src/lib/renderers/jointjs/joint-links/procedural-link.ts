import { dia, shapes } from "@joint/core";
import { isoStyle } from "../style-packs/iso-19450";

export interface ProceduralLinkAttrs {
  id: string;
  sourceId: string;
  targetId: string;
  opmLinkKind: string;
  label?: string;
  routingPriority: "primary" | "secondary";
}

/**
 * Fase 1+2.2: marker closed-triangle para todos los kinds. Los markers
 * especializados (lollipop-black/white §3.3, lightning §9, structural
 * triangles §1.7, open-arrow §8.1) quedan para slice 2.4 donde se
 * materializan respetando iso-19450 style pack.
 */
const CLOSED_TRIANGLE_PATH = "M 10 -5 L 0 0 L 10 5 Z";

export function createProceduralLink(attrs: ProceduralLinkAttrs): dia.Link {
  const kindStyle = isoStyle.links.byKind[attrs.opmLinkKind] ?? { stroke: "#475569", marker: "closed-triangle" as const };
  const strokeWidth = attrs.routingPriority === "primary"
    ? isoStyle.links.strokeWidthPrimary
    : isoStyle.links.strokeWidthSecondary;

  const link = new shapes.standard.Link({
    id: attrs.id,
    source: { id: attrs.sourceId },
    target: { id: attrs.targetId },
    attrs: {
      line: {
        stroke: kindStyle.stroke,
        strokeWidth,
        strokeDasharray: kindStyle.dash ?? "0",
        targetMarker: {
          type: "path",
          d: CLOSED_TRIANGLE_PATH,
          fill: kindStyle.stroke,
          stroke: kindStyle.stroke,
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
          fill: isoStyle.palette.labelText,
          fontSize: isoStyle.typography.linkFontSize,
          fontFamily: isoStyle.typography.family,
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
