import { dia, shapes } from "@joint/core";
import { isoStyle } from "../style-packs/iso-19450";

export interface StateShapeAttrs {
  id: string;
  label: string;
  initial: boolean;
  final: boolean;
  default: boolean;
  current?: boolean;
}

/**
 * State rountangle — representa un estado de un object. Se embebe dentro
 * del object padre via paper.addCell + parent.embed(child) en el adapter.
 *
 * Normas SSOT §2.2 aplicadas:
 * - initial: bold-contour (strokeWidth mayor)
 * - final: doble borde (rect anidado)
 * - default: marker textual ↘ (flecha diagonal) a la izquierda
 * - current: fill resaltado
 */
export function createStateShape(attrs: StateShapeAttrs): dia.Element {
  const strokeWidth = attrs.initial
    ? isoStyle.dimensions.stroke.stateInitial
    : isoStyle.dimensions.stroke.stateFinalInner;

  const fill = attrs.current ? "#dbeafe" : isoStyle.palette.stateFill;
  const stroke = isoStyle.palette.stateStroke;

  const labelParts: string[] = [];
  if (attrs.default) labelParts.push(isoStyle.markers.defaultArrow);
  labelParts.push(attrs.label);
  const displayLabel = labelParts.join(" ");

  const rect = new shapes.standard.Rectangle({
    id: attrs.id,
    size: { width: isoStyle.dimensions.state.width, height: isoStyle.dimensions.state.height },
    attrs: {
      body: {
        fill,
        stroke,
        strokeWidth,
        rx: isoStyle.dimensions.state.cornerRadius,
        ry: isoStyle.dimensions.state.cornerRadius,
      },
      label: {
        text: displayLabel,
        fill: isoStyle.palette.labelText,
        fontFamily: isoStyle.typography.family,
        fontSize: isoStyle.typography.stateFontSize,
        fontWeight: 500,
        textWrap: { width: isoStyle.dimensions.state.width - 8, height: isoStyle.dimensions.state.height - 4, ellipsis: true },
      },
    },
  });

  // final: overlay con un doble borde (rect anidado más pequeño)
  if (attrs.final) {
    rect.attr("body/strokeWidth", isoStyle.dimensions.stroke.stateFinalOuter);
    // Un segundo borde interno lo representamos con un box-shadow inset emulado
    // vía stroke-dasharray… JointJS no soporta doble borde en un body. Lo
    // aproximamos engrosando el borde y ajustando fill. El doble borde real
    // llega via markup custom en un shape dedicado (futuro).
    rect.attr("body/stroke", "#1e293b");
  }

  return rect;
}
