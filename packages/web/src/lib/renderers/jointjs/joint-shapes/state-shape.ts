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

// Elemento custom con doble borde real para estado final (§2.2).
// Usa markup JSON (no util.svg template) para evitar DOMParser en SSR/tests.
const FinalStateElement = dia.Element.define(
  "opm.FinalState",
  {
    size: { width: isoStyle.dimensions.state.width, height: isoStyle.dimensions.state.height },
    attrs: {
      bodyOuter: {
        refWidth: "100%",
        refHeight: "100%",
        strokeWidth: isoStyle.dimensions.stroke.stateFinalOuter,
        stroke: "#1e293b",
        fill: isoStyle.palette.stateFill,
        rx: isoStyle.dimensions.state.cornerRadius,
        ry: isoStyle.dimensions.state.cornerRadius,
      },
      bodyInner: {
        refWidth: -6,
        refHeight: -6,
        refX: 3,
        refY: 3,
        strokeWidth: isoStyle.dimensions.stroke.stateFinalInner,
        stroke: "#1e293b",
        fill: "transparent",
        rx: Math.max(0, isoStyle.dimensions.state.cornerRadius - 2),
        ry: Math.max(0, isoStyle.dimensions.state.cornerRadius - 2),
      },
      label: {
        refX: "50%",
        refY: "50%",
        textAnchor: "middle",
        textVerticalAnchor: "middle",
        fill: isoStyle.palette.labelText,
        fontFamily: isoStyle.typography.family,
        fontSize: isoStyle.typography.stateFontSize,
        fontWeight: 500,
      },
    },
  },
  {
    markup: [
      { tagName: "rect", selector: "bodyOuter" },
      { tagName: "rect", selector: "bodyInner" },
      { tagName: "text", selector: "label" },
    ],
  },
);

/**
 * State rountangle — representa un estado de un object. Se embebe dentro
 * del object padre via paper.addCell + parent.embed(child) en el adapter.
 *
 * Normas SSOT §2.2 aplicadas:
 * - initial: bold-contour (strokeWidth mayor)
 * - final: doble borde real con dos rects concéntricos (markup custom)
 * - default: marker textual ↘ (flecha diagonal) a la izquierda
 * - current: fill resaltado
 */
export function createStateShape(attrs: StateShapeAttrs): dia.Element {
  const fill = attrs.current ? "#dbeafe" : isoStyle.palette.stateFill;
  const stroke = isoStyle.palette.stateStroke;

  const labelParts: string[] = [];
  if (attrs.default) labelParts.push(isoStyle.markers.defaultArrow);
  labelParts.push(attrs.label);
  const displayLabel = labelParts.join(" ");

  // §2.2: estado final → doble borde real via elemento custom con dos rects
  if (attrs.final) {
    const el = new FinalStateElement({ id: attrs.id });
    el.attr("bodyOuter/fill", fill);
    el.attr("label/text", displayLabel);
    return el;
  }

  const strokeWidth = attrs.initial
    ? isoStyle.dimensions.stroke.stateInitial
    : isoStyle.dimensions.stroke.normal;

  return new shapes.standard.Rectangle({
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
}
