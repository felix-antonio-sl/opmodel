import { dia, shapes } from "@joint/core";
import { isoStyle } from "../style-packs/iso-19450";

export interface FanShapeAttrs {
  id: string;
  operator: "xor" | "or" | "and";
  x: number;
  y: number;
  isProbabilistic?: boolean;       // §5.8, V-18: badge con "Pr" prefix
  hiddenRefinersCount?: number;    // V-118: refinadores ocultos en semi-plegado
}

/**
 * Fan badge — aproximación provisional del arco normativo (§5.1–§5.3,
 * V-14/V-16/V-17). En versión geométrica completa, el arco discontinuo
 * se dibuja en el extremo convergente sobre los endpoints reales de los
 * links miembros; requiere post-routing de JointJS.
 *
 * Slice 2.3 renderea un badge textual XOR / OR / AND posicionado cerca
 * del endpoint común. El arco literal llega en slice posterior.
 */
export function createFanShape(attrs: FanShapeAttrs): dia.Element {
  if (attrs.operator === "and") {
    // V-14: AND es default, no hay símbolo explícito — no render.
    throw new Error("AND fans have no explicit visual marker; caller must skip");
  }

  // §5.8 V-18: fan probabilístico → prefijo "Pr:" en el badge
  const baseLabel = attrs.isProbabilistic
    ? `Pr:${attrs.operator.toUpperCase()}`
    : attrs.operator.toUpperCase();
  // V-118: número de refinadores ocultos sufijo "+N"
  const label = attrs.hiddenRefinersCount
    ? `${baseLabel} +${attrs.hiddenRefinersCount}`
    : baseLabel;
  const width = attrs.hiddenRefinersCount ? 52 : 36;
  const height = 18;

  return new shapes.standard.Rectangle({
    id: attrs.id,
    position: { x: attrs.x - width / 2, y: attrs.y - height / 2 },
    size: { width, height },
    attrs: {
      body: {
        fill: "#fef3c7",
        stroke: "#78350f",
        strokeWidth: 1.2,
        rx: 4,
        ry: 4,
        strokeDasharray: attrs.operator === "or" ? "4 2" : "0",
      },
      label: {
        text: label,
        fill: "#78350f",
        fontFamily: isoStyle.typography.family,
        fontSize: isoStyle.typography.markerFontSize - 1,
        fontWeight: 600,
      },
    },
  });
}
