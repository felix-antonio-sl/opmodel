import type { Appearance, Link, State, Thing } from "@opmodel/core";
import type { Rect } from "./geometry";
import { VISUAL_RULES, estimatedStateTextCapacity, statePillLayout } from "./visual-rules";

export interface OverlapFinding {
  kind: "overlap";
  aThing: string;
  bThing: string;
  area: number;
}

export interface OrphanFinding {
  kind: "orphan";
  thing: string;
}

export interface TruncatedStateFinding {
  kind: "truncated-state";
  thing: string;
  state: string;
  capacity: number;
}

export interface DegenerateBoundsFinding {
  kind: "degenerate-bounds";
  width: number;
  height: number;
  aspectRatio: number;
}

export interface CrowdedDiagramFinding {
  kind: "crowded-diagram";
  nodeCount: number;
  fillRatio: number;
  width: number;
  height: number;
}

export interface TightSpacingFinding {
  kind: "tight-spacing";
  aThing: string;
  bThing: string;
  gap: number;
  axis: "x" | "y";
}

export type VisualFinding = OverlapFinding | OrphanFinding | TruncatedStateFinding | DegenerateBoundsFinding | CrowdedDiagramFinding | TightSpacingFinding;
export type VisualSeverity = "error" | "warning" | "info";

function intersectionArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

function appearanceRect(a: Pick<Appearance, "x" | "y" | "w" | "h">): Rect {
  return { x: a.x, y: a.y, w: a.w, h: a.h };
}

function axisGap(a: Rect, b: Rect): { axis: "x" | "y"; gap: number } | null {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (overlapX > 0 && overlapY > 0) return null;
  if (overlapY > 0) {
    const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    return { axis: "x", gap };
  }
  if (overlapX > 0) {
    const gap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    return { axis: "y", gap };
  }
  return null;
}

export function findNonContainerOverlaps(appearances: Appearance[]): OverlapFinding[] {
  const visible = appearances.filter((a) => !a.internal);
  const findings: OverlapFinding[] = [];
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const area = intersectionArea(appearanceRect(visible[i]), appearanceRect(visible[j]));
      if (area > 0) {
        findings.push({ kind: "overlap", aThing: visible[i].thing, bThing: visible[j].thing, area });
      }
    }
  }
  return findings.sort((a, b) => b.area - a.area);
}

export function findVisibleOrphans(appearances: Appearance[], links: Link[]): OrphanFinding[] {
  const visible = appearances.filter((a) => !a.internal);
  const ids = new Set(appearances.map((a) => a.thing));
  const connected = new Set<string>();
  for (const link of links) {
    if (ids.has(link.source) && ids.has(link.target)) {
      connected.add(link.source);
      connected.add(link.target);
    }
  }
  return visible
    .filter((a) => !connected.has(a.thing))
    .map((a) => ({ kind: "orphan" as const, thing: a.thing }));
}

export function findTruncatedStateBoxes(
  appearances: Appearance[],
  statesByThing: Map<string, State[]>,
  thingsById?: Map<string, Thing>,
): TruncatedStateFinding[] {
  const findings: TruncatedStateFinding[] = [];
  for (const app of appearances) {
    const thing = thingsById?.get(app.thing);
    if (thing?.kind === "process") continue;
    const states = statesByThing.get(app.thing) ?? [];
    if (states.length === 0) continue;
    const layout = statePillLayout(app.w, states.length, "compact");
    const capacity = estimatedStateTextCapacity(layout.pillW);
    for (const state of states) {
      if (state.name.length > capacity) {
        findings.push({ kind: "truncated-state", thing: app.thing, state: state.id, capacity });
      }
    }
  }
  return findings;
}

export function contentBounds(appearances: Appearance[]): Rect | null {
  if (appearances.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const a of appearances) {
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x + a.w);
    maxY = Math.max(maxY, a.y + a.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function findDegenerateBounds(appearances: Appearance[]): DegenerateBoundsFinding[] {
  const bounds = contentBounds(appearances);
  if (!bounds) return [];
  const width = bounds.w;
  const height = bounds.h;
  const aspectRatio = Math.max(width / Math.max(height, 1), height / Math.max(width, 1));
  if (
    width < VISUAL_RULES.lint.minContentWidth ||
    height < VISUAL_RULES.lint.minContentHeight ||
    aspectRatio > VISUAL_RULES.lint.degenerateAspectRatio
  ) {
    return [{ kind: "degenerate-bounds", width, height, aspectRatio }];
  }
  return [];
}

export function findCrowdedDiagrams(appearances: Appearance[]): CrowdedDiagramFinding[] {
  const visible = appearances.filter((a) => !a.internal);
  const bounds = contentBounds(visible);
  if (!bounds || visible.length < VISUAL_RULES.lint.crowdedNodeCount) return [];
  const contentArea = visible.reduce((sum, a) => sum + a.w * a.h, 0);
  const boundsArea = Math.max(bounds.w * bounds.h, 1);
  const fillRatio = contentArea / boundsArea;
  if (fillRatio >= VISUAL_RULES.lint.crowdedFillRatio) {
    return [{ kind: "crowded-diagram", nodeCount: visible.length, fillRatio, width: bounds.w, height: bounds.h }];
  }
  return [];
}

export function findTightSpacing(appearances: Appearance[]): TightSpacingFinding[] {
  const visible = appearances.filter((a) => !a.internal);
  const findings: TightSpacingFinding[] = [];
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = appearanceRect(visible[i]);
      const b = appearanceRect(visible[j]);
      if (intersectionArea(a, b) > 0) continue;
      const gap = axisGap(a, b);
      if (!gap) continue;
      if (gap.gap >= 0 && gap.gap < VISUAL_RULES.lint.minReadableGap) {
        findings.push({ kind: "tight-spacing", aThing: visible[i].thing, bThing: visible[j].thing, gap: gap.gap, axis: gap.axis });
      }
    }
  }
  return findings.sort((a, b) => a.gap - b.gap);
}

export function visualFindingSeverity(finding: VisualFinding): VisualSeverity {
  switch (finding.kind) {
    case "overlap":
    case "degenerate-bounds":
      return "error";
    case "orphan":
    case "crowded-diagram":
    case "tight-spacing":
      return "warning";
    case "truncated-state":
      return "info";
  }
}

function visualFindingRank(finding: VisualFinding): number {
  switch (visualFindingSeverity(finding)) {
    case "error": return 0;
    case "warning": return 1;
    case "info": return 2;
  }
}

export interface AuditVisualOpdArgs {
  appearances: Appearance[];
  links: Link[];
  things?: Iterable<Thing>;
  states?: Iterable<State>;
}

export interface VisualQualityScore {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export function computeVisualQuality(findings: VisualFinding[]): VisualQualityScore {
  let score = 100;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const f of findings) {
    const sev = visualFindingSeverity(f);
    if (sev === "error") {
      errorCount++;
      score -= f.kind === "overlap" ? 15 : 10;
    } else if (sev === "warning") {
      warningCount++;
      score -= f.kind === "crowded-diagram" ? 8 : f.kind === "tight-spacing" ? 4 : 3;
    } else {
      infoCount++;
      score -= 1;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const grade: VisualQualityScore["grade"] =
    score >= 90 ? "A" :
    score >= 75 ? "B" :
    score >= 60 ? "C" :
    score >= 40 ? "D" : "F";

  return { score, grade, errorCount, warningCount, infoCount };
}

export function auditVisualOpd({ appearances, links, things, states }: AuditVisualOpdArgs): VisualFinding[] {
  const thingsById = things ? new Map([...things].map((t) => [t.id, t])) : undefined;
  const statesByThing = new Map<string, State[]>();
  if (states) {
    for (const state of states) {
      const list = statesByThing.get(state.parent) ?? [];
      list.push(state);
      statesByThing.set(state.parent, list);
    }
  }
  return [
    ...findNonContainerOverlaps(appearances),
    ...findVisibleOrphans(appearances, links),
    ...findTruncatedStateBoxes(appearances, statesByThing, thingsById),
    ...findDegenerateBounds(appearances),
    ...findCrowdedDiagrams(appearances),
    ...findTightSpacing(appearances),
  ].sort((a, b) => {
    const rank = visualFindingRank(a) - visualFindingRank(b);
    if (rank !== 0) return rank;
    return a.kind.localeCompare(b.kind);
  });
}
