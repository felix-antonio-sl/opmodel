import { dia, shapes } from "@joint/core";
import { isoStyle } from "../style-packs/iso-19450";

export interface ProcessShapeAttrs {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  affiliation: "systemic" | "environmental";
  essence?: "physical" | "informational";
  isMainProcess: boolean;
  isRefined?: boolean;
  isContainer?: boolean;  // §10.3/§10.4: in-zoom container — label sits at top so subprocesses don't cover it.
  duration?: { min?: number; expected?: number; max?: number; unit?: string; distribution?: string };
}

function formatDuration(d: NonNullable<ProcessShapeAttrs["duration"]>): string {
  const u = d.unit ?? "";
  if (d.min !== undefined && d.max !== undefined) return `[${d.min}–${d.max}${u}]`;
  if (d.expected !== undefined) return `[~${d.expected}${u}]`;
  if (d.distribution) return `[${d.distribution}]`;
  return "";
}

export function createProcessShape(attrs: ProcessShapeAttrs): dia.Element {
  const stroke = attrs.affiliation === "environmental"
    ? isoStyle.palette.thingStrokeEnvironmental
    : isoStyle.palette.thingStrokeProcess;

  const fill = attrs.isMainProcess
    ? isoStyle.palette.thingFillProcessMain
    : isoStyle.palette.thingFillProcess;

  const strokeDasharray = attrs.affiliation === "environmental"
    ? isoStyle.affiliation.environmentalDash
    : isoStyle.affiliation.systemicDash;

  const strokeWidth = attrs.isRefined
    ? isoStyle.dimensions.stroke.refined
    : isoStyle.dimensions.stroke.normal;

  const filter = attrs.essence === "physical"
    ? {
        name: "dropShadow",
        args: {
          dx: isoStyle.essence.physicalShadowOffsetX,
          dy: isoStyle.essence.physicalShadowOffsetY,
          blur: isoStyle.essence.physicalShadowBlur,
          color: isoStyle.essence.physicalShadowColor,
        },
      }
    : undefined;

  const fontWeight = attrs.isMainProcess
    ? isoStyle.typography.thingFontWeightMain
    : isoStyle.typography.thingFontWeightNormal;

  // V-45: duration annotation below process name
  const durationStr = attrs.duration ? formatDuration(attrs.duration) : "";
  const displayText = durationStr ? `${attrs.label}\n${durationStr}` : attrs.label;

  // §10.3/§10.4: container labels go to top so subprocess timeline doesn't cover them.
  const labelTopAttrs = attrs.isContainer
    ? { y: 14, refY: null, textVerticalAnchor: "top" as const }
    : {};

  const ellipse = new shapes.standard.Ellipse({
    id: attrs.id,
    position: { x: attrs.x, y: attrs.y },
    size: { width: attrs.width, height: attrs.height },
    attrs: {
      body: {
        fill,
        stroke,
        strokeWidth,
        strokeDasharray,
        ...(filter ? { filter: filter as any } : {}),
      },
      label: {
        ...labelTopAttrs,
        text: displayText,
        fill: isoStyle.palette.labelText,
        fontFamily: isoStyle.typography.family,
        fontSize: isoStyle.typography.thingFontSize,
        fontWeight,
        textWrap: attrs.isContainer
          ? { width: attrs.width - 32, height: 36, ellipsis: true }
          : { width: attrs.width - 16, height: attrs.height - 8, ellipsis: true },
      },
    },
  });

  return ellipse;
}
