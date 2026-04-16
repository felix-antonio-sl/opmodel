import type { dia } from "@joint/core";
import { isoStyle } from "../style-packs/iso-19450";

export interface ModifierMarkerAttrs {
  link: dia.Link;
  kind: "event" | "condition";
  negated?: boolean;
  conditionMode?: "skip" | "wait";
}

/**
 * Aplica un marker de modifier (Event "e" / Condition "c") a un link
 * existente. §4.1/§4.2: letra textual sobre la línea, cerca del
 * extremo del proceso (position ≈ 0.8).
 *
 * Para `negated` antepone "¬". Para condition-mode agrega paréntesis
 * con la letra inicial: "c(w)" o "c(s)".
 */
export function applyModifierMarker(attrs: ModifierMarkerAttrs): void {
  let label = attrs.kind === "event"
    ? isoStyle.markers.eventLabel
    : isoStyle.markers.conditionLabel;

  if (attrs.negated) label = `¬${label}`;
  if (attrs.kind === "condition" && attrs.conditionMode) {
    label = `${label}(${attrs.conditionMode === "wait" ? "w" : "s"})`;
  }

  attrs.link.appendLabel({
    position: 0.8,
    attrs: {
      text: {
        text: label,
        fill: "#b45309",
        fontSize: isoStyle.typography.markerFontSize + 1,
        fontFamily: isoStyle.typography.family,
        fontWeight: 700,
      },
      rect: {
        fill: "#fffbeb",
        stroke: "#b45309",
        strokeWidth: 1,
        rx: 8,
        ry: 8,
      },
    },
  });
}
