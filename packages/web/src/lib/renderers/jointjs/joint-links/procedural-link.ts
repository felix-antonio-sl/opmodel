import { dia, shapes } from "@joint/core";
import { isoStyle } from "../style-packs/iso-19450";

export interface ProceduralLinkAttrs {
  id: string;
  sourceId: string;
  targetId: string;
  opmLinkKind: string;
  label?: string;
  routingPriority: "primary" | "secondary";
  exceptionKind?: "overtime" | "undertime";
  multiplicitySource?: string;
  multiplicityTarget?: string;
  pathLabel?: string;
}

/**
 * Markers SSOT (opm-visual-es.md):
 * - §3.1 consumption/result/effect → punta cerrada
 * - §3.3 agent → lollipop negro (círculo relleno)
 * - §3.3 instrument → lollipop blanco (círculo vacío con stroke)
 * - §9 invocation → zigzag
 * - §1.7 aggregation → triángulo negro sólido
 * - §1.7 generalization → triángulo vacío
 * - §1.7 exhibition → triángulo hollow + triángulo filled interior (compuesto: unicode fallback)
 * - §1.7 classification → triángulo hollow + círculo relleno interior (compuesto: unicode fallback)
 * - §8.1 tagged → open arrowhead
 * - §4.4 exception → dash pattern + /|// marker textual
 */
function buildTargetMarker(kind: string, stroke: string): Record<string, unknown> {
  const marker = isoStyle.links.byKind[kind]?.marker ?? "closed-triangle";
  const a = isoStyle.links.arrowSize;
  const r = isoStyle.links.lollipopRadius;
  const t = isoStyle.links.triangleSize;

  switch (marker) {
    case "closed-triangle":
      return { type: "path", d: `M ${a + 1} -${a / 2} L 0 0 L ${a + 1} ${a / 2} Z`, fill: stroke, stroke };
    case "open-arrow":
      return { type: "path", d: `M ${a + 1} -${a / 2} L 0 0 L ${a + 1} ${a / 2}`, fill: "none", stroke };
    case "lollipop-black":
      return { type: "circle", r, cx: r, cy: 0, fill: stroke, stroke, "stroke-width": 1 };
    case "lollipop-white":
      return { type: "circle", r, cx: r, cy: 0, fill: "#ffffff", stroke, "stroke-width": 1.5 };
    case "triangle-filled":
      return { type: "path", d: `M ${t + 2} -${t * 0.6} L 0 0 L ${t + 2} ${t * 0.6} Z`, fill: stroke, stroke };
    case "triangle-hollow":
      return { type: "path", d: `M ${t + 2} -${t * 0.6} L 0 0 L ${t + 2} ${t * 0.6} Z`, fill: "#ffffff", stroke, "stroke-width": 1.5 };
    case "triangle-hollow-with-filled-inner":
    case "triangle-hollow-with-circle-inner":
      // Base is hollow triangle; inner fill is rendered as a mid-line label
      // with Unicode glyph (▲ or ●) close to the target endpoint.
      return { type: "path", d: `M ${t + 2} -${t * 0.6} L 0 0 L ${t + 2} ${t * 0.6} Z`, fill: "#ffffff", stroke, "stroke-width": 1.5 };
    case "lightning":
      // Zigzag approximation (bolt): runs backwards from endpoint
      return {
        type: "path",
        d: `M ${a + 2} -${a * 0.6} L ${a - 2} 0 L ${a + 2} ${a * 0.4} L 0 ${a * 0.6}`,
        fill: "none",
        stroke,
        "stroke-width": 2,
      };
    case "none":
      return { type: "path", d: "M 0 0 Z", fill: "none", stroke: "transparent" };
    default:
      return { type: "path", d: `M ${a + 1} -${a / 2} L 0 0 L ${a + 1} ${a / 2} Z`, fill: stroke, stroke };
  }
}

function innerGlyphForMarker(kind: string): string | null {
  const marker = isoStyle.links.byKind[kind]?.marker;
  if (marker === "triangle-hollow-with-filled-inner") return "▲";
  if (marker === "triangle-hollow-with-circle-inner") return "●";
  return null;
}

export function createProceduralLink(attrs: ProceduralLinkAttrs): dia.Link {
  const kindStyle = isoStyle.links.byKind[attrs.opmLinkKind] ?? { stroke: "#475569", marker: "closed-triangle" as const };
  const strokeWidth = attrs.routingPriority === "primary"
    ? isoStyle.links.strokeWidthPrimary
    : isoStyle.links.strokeWidthSecondary;

  const targetMarker = buildTargetMarker(attrs.opmLinkKind, kindStyle.stroke);

  const link = new shapes.standard.Link({
    id: attrs.id,
    source: { id: attrs.sourceId },
    target: { id: attrs.targetId },
    attrs: {
      line: {
        stroke: kindStyle.stroke,
        strokeWidth,
        strokeDasharray: kindStyle.dash ?? "0",
        targetMarker,
      },
    },
  });

  // Base kind label (secondary — small, unobtrusive).
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

  // Compound-marker inner glyph (exhibition ▲, classification ●)
  // rendered near target for readability.
  const innerGlyph = innerGlyphForMarker(attrs.opmLinkKind);
  if (innerGlyph) {
    link.appendLabel({
      position: 0.92,
      attrs: {
        text: {
          text: innerGlyph,
          fill: kindStyle.stroke,
          fontSize: isoStyle.typography.markerFontSize + 2,
          fontFamily: isoStyle.typography.family,
          fontWeight: 700,
        },
        rect: { fill: "transparent", stroke: "transparent" },
      },
    });
  }

  // Exception subtime/overtime textual marker (§4.4)
  if (attrs.exceptionKind) {
    link.appendLabel({
      position: 0.35,
      attrs: {
        text: {
          text: attrs.exceptionKind === "overtime" ? "/" : "//",
          fill: kindStyle.stroke,
          fontSize: isoStyle.typography.markerFontSize + 2,
          fontFamily: isoStyle.typography.family,
          fontWeight: 900,
        },
        rect: { fill: "#fff", stroke: "transparent" },
      },
    });
  }

  // Path label (§6) at midpoint.
  if (attrs.pathLabel) {
    link.appendLabel({
      position: 0.6,
      attrs: {
        text: {
          text: attrs.pathLabel,
          fill: "#334155",
          fontSize: isoStyle.typography.linkFontSize,
          fontFamily: isoStyle.typography.family,
          fontStyle: "italic",
        },
        rect: { fill: "#f8fafc", stroke: "#cbd5e1", strokeWidth: 0.8, rx: 2, ry: 2 },
      },
    });
  }

  // Multiplicity near respective endpoint (§7).
  if (attrs.multiplicitySource) {
    link.appendLabel({
      position: 0.1,
      attrs: {
        text: {
          text: attrs.multiplicitySource,
          fill: "#475569",
          fontSize: isoStyle.typography.markerFontSize - 1,
          fontFamily: isoStyle.typography.family,
        },
        rect: { fill: "#fff", stroke: "transparent" },
      },
    });
  }
  if (attrs.multiplicityTarget) {
    link.appendLabel({
      position: 0.9,
      attrs: {
        text: {
          text: attrs.multiplicityTarget,
          fill: "#475569",
          fontSize: isoStyle.typography.markerFontSize - 1,
          fontFamily: isoStyle.typography.family,
        },
        rect: { fill: "#fff", stroke: "transparent" },
      },
    });
  }

  return link;
}
