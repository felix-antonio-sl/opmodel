import { dia, shapes } from "@joint/core";
import { isoStyle } from "../style-packs/iso-19450";

export interface FanShapeAttrs {
  id: string;
  operator: "xor" | "or" | "and";
  x: number;
  y: number;
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

  const label = attrs.operator.toUpperCase();
  const width = 36;
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
