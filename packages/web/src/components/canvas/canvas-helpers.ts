import type { Model, Thing, State, Link, Appearance, Modifier, OPD } from "@opmodel/core";
import { transformingMode } from "@opmodel/core";
import {
  center,
  rectEdgePoint,
  ellipseEdgePoint,
  midpoint,
  type Point,
  type Rect,
} from "../../lib/geometry";
import { statePillLayout } from "../../lib/visual-rules";

/* ─── Breadcrumb: OPD ancestor chain ─── */

export function opdAncestors(model: Model, opdId: string): OPD[] {
  const chain: OPD[] = [];
  let current = model.opds.get(opdId);
  while (current) {
    chain.unshift(current);
    current = current.parent_opd ? model.opds.get(current.parent_opd) : undefined;
  }
  return chain;
}

/* ─── Helpers ─── */

export function edgePoint(kind: "object" | "process", rect: Rect, target: Point): Point {
  return kind === "process" ? ellipseEdgePoint(rect, target) : rectEdgePoint(rect, target);
}

export function statesForThing(model: Model, thingId: string): State[] {
  return [...model.states.values()]
    .filter((s) => s.parent === thingId)
    .sort((a, b) => {
      if (a.initial && !b.initial) return -1;
      if (!a.initial && b.initial) return 1;
      return a.name.localeCompare(b.name);
    });
}

/* State pill rect — matches ThingNode rendering layout exactly */
export function statePillRect(
  app: { x: number; y: number; w: number; h: number },
  visibleStates: State[],
  stateId: string,
): Rect | null {
  const idx = visibleStates.findIndex((s) => s.id === stateId);
  if (idx === -1) return null;
  const layout = statePillLayout(app.w, visibleStates.length, "compact");
  const startX = app.x + layout.startXOffset;
  return {
    x: startX + idx * (layout.pillW + 4),
    y: app.y + app.h - 4,
    w: layout.pillW,
    h: layout.pillH,
  };
}

/* ─── DA-8: Adjust effect link endpoints per transformingMode ─── */

export interface VisualLinkEntry {
  link: Link;
  modifier: Modifier | undefined;
  visualSource: string;
  visualTarget: string;
  labelOverride: string | undefined;
  isMergedPair: boolean;
  isInputHalf?: boolean;
  isOutputHalf?: boolean;
  aggregated?: boolean;
}

export function adjustEffectEndpoints(
  entries: VisualLinkEntry[],
  model: Model,
): VisualLinkEntry[] {
  return entries.flatMap(entry => {
    // Aggregated (distributed) links show as simple effect — no input/output split
    if (entry.aggregated) return [entry];
    const mode = transformingMode(entry.link);
    if (!mode || mode === "effect") return [entry];

    // Resolve object/process endpoints (I-33 guarantees object↔process)
    const srcThing = model.things.get(entry.visualSource);
    const objectId = srcThing?.kind === "object" ? entry.visualSource : entry.visualTarget;
    const processId = srcThing?.kind === "process" ? entry.visualSource : entry.visualTarget;

    switch (mode) {
      case "input-specified":
        return [
          {
            ...entry,
            link: { ...entry.link },
            labelOverride: "input",
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            labelOverride: "output",
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true as const,
          },
        ];

      case "output-specified":
        return [
          {
            ...entry,
            link: { ...entry.link, target_state: undefined },
            labelOverride: "input",
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link },
            labelOverride: "output",
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true as const,
          },
        ];

      case "input-output":
        return [
          {
            ...entry,
            link: { ...entry.link, target_state: undefined },
            labelOverride: "input",
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            labelOverride: "output",
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true as const,
          },
        ];

      default:
        return [entry];
    }
  });
}

/* ─── Grid snap ─── */

export const GRID_SIZE = 20;
export function snap(v: number): number { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

/* ─── Link categories for filter UI ─── */

export const LINK_CATEGORIES: Record<string, string[]> = {
  "Procedural": ["effect", "consumption", "result", "input", "output"],
  "Enabling": ["agent", "instrument"],
  "Structural": ["aggregation", "exhibition", "generalization", "classification", "tagged"],
  "Control": ["invocation", "exception"],
};
