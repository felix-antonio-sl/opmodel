import type { Rect } from "./geometry";

export const LINK_COLORS: Record<string, string> = {
  agent: "#2b6cb0",
  instrument: "#2b6cb0",
  consumption: "#16794a",
  effect: "#16794a",
  result: "#16794a",
  input: "#16794a",
  output: "#16794a",
  aggregation: "#6b5fad",
  exhibition: "#6b5fad",
  generalization: "#6b5fad",
  classification: "#6b5fad",
  tagged: "#6b5fad",
  invocation: "#c05621",
  exception: "#c05621",
};

export const VISUAL_RULES = {
  statePill: {
    height: 16,
    maxWidth: 55,
    compactMaxWidth: 50,
    horizontalPadding: 12,
    compactHorizontalPadding: 8,
    gap: 4,
    textInset: 2,
    approxCharPx: 5,
    minReadableChars: 4,
  },
  spacing: {
    laneGap: 80,
    nodeGap: 24,
    containerPadding: 20,
    fitPadding: 40,
  },
  size: {
    minObjectWidth: 140,
    minProcessWidth: 180,
    minStatefulWidth: 180,
    minContainerWidth: 260,
    minHeight: 50,
  },
  lint: {
    degenerateAspectRatio: 4,
    minContentWidth: 120,
    minContentHeight: 80,
  },
} as const;

export interface StatePillLayout {
  pillW: number;
  pillH: number;
  totalPillW: number;
  startXOffset: number;
  visibleCount: number;
}

export function statePillLayout(
  nodeWidth: number,
  visibleCount: number,
  variant: "compact" | "default" = "default",
): StatePillLayout {
  const compact = variant === "compact";
  const maxWidth = compact ? VISUAL_RULES.statePill.compactMaxWidth : VISUAL_RULES.statePill.maxWidth;
  const horizontalPadding = compact ? VISUAL_RULES.statePill.compactHorizontalPadding : VISUAL_RULES.statePill.horizontalPadding;
  const pillW = Math.min(maxWidth, (nodeWidth - horizontalPadding) / Math.max(visibleCount, 1) - VISUAL_RULES.statePill.gap);
  const pillH = VISUAL_RULES.statePill.height;
  const totalPillW = visibleCount * (pillW + VISUAL_RULES.statePill.gap) - VISUAL_RULES.statePill.gap;
  const startXOffset = (nodeWidth - totalPillW) / 2;
  return { pillW, pillH, totalPillW, startXOffset, visibleCount };
}

export function estimatedStateTextCapacity(pillWidth: number): number {
  return Math.max(
    VISUAL_RULES.statePill.minReadableChars,
    Math.floor((pillWidth - VISUAL_RULES.statePill.textInset * 2) / VISUAL_RULES.statePill.approxCharPx),
  );
}

export function minimumWidthForStateNames(stateNames: string[], visibleCount = stateNames.length): number {
  if (visibleCount <= 0) return VISUAL_RULES.size.minStatefulWidth;
  const longest = stateNames.reduce((max, s) => Math.max(max, s.length), 0);
  const perPill = Math.max(
    VISUAL_RULES.statePill.maxWidth,
    longest * VISUAL_RULES.statePill.approxCharPx + VISUAL_RULES.statePill.textInset * 2,
  );
  return Math.max(
    VISUAL_RULES.size.minStatefulWidth,
    visibleCount * (perPill + VISUAL_RULES.statePill.gap) + VISUAL_RULES.statePill.compactHorizontalPadding,
  );
}

export function paddedBounds(bounds: Rect, padding = VISUAL_RULES.spacing.fitPadding): Rect {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    w: bounds.w + padding * 2,
    h: bounds.h + padding * 2,
  };
}
