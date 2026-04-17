import { dia, shapes } from "@joint/core";
import { isoStyle } from "../style-packs/iso-19450";

export interface ObjectShapeAttrs {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  affiliation: "systemic" | "environmental";
  essence?: "physical" | "informational";
  isRefined?: boolean;
}

export function createObjectShape(attrs: ObjectShapeAttrs): dia.Element {
  const stroke = attrs.affiliation === "environmental"
    ? isoStyle.palette.thingStrokeEnvironmental
    : isoStyle.palette.thingStrokeObject;
  const fill = isoStyle.palette.thingFillObject;

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

  const rect = new shapes.standard.Rectangle({
    id: attrs.id,
    position: { x: attrs.x, y: attrs.y },
    size: { width: attrs.width, height: attrs.height },
    attrs: {
      body: {
        fill,
        stroke,
        strokeWidth,
        rx: isoStyle.dimensions.object.cornerRadius,
        ry: isoStyle.dimensions.object.cornerRadius,
        strokeDasharray,
        ...(filter ? { filter: filter as any } : {}),
      },
      label: {
        // V-4/V-5: keep label in top band so the bottom state strip never
        // hides it. Override the standard.Rectangle's centered y=calc(0.5*h)
        // with an absolute y, anchored to the top.
        y: 6,
        refY: null,
        textVerticalAnchor: "top",
        text: attrs.label,
        fill: isoStyle.palette.labelText,
        fontFamily: isoStyle.typography.family,
        fontSize: isoStyle.typography.thingFontSize,
        fontWeight: isoStyle.typography.thingFontWeightNormal,
        // Label band height: when the box grew because of states (height>60),
        // reserve at least 32px (≥2 text lines @13px) so long names like
        // "Servicio de Hospitalización Domiciliaria" wrap instead of getting
        // ellipsis-truncated. Otherwise use most of the box.
        textWrap: {
          width: attrs.width - 16,
          height: attrs.height > 60 ? Math.max(32, attrs.height - 36) : attrs.height - 14,
          ellipsis: true,
        },
      },
    },
  });

  return rect;
}
