/**
 * Edge Router — intelligent link path computation
 *
 * Provides curved paths for links to avoid crossings and improve
 * visual clarity in dense OPD diagrams.
 *
 * Strategies:
 * 1. Straight line for short, non-crossing links
 * 2. Smart port selection based on flow direction
 * 3. Quadratic/cubic Bézier curves for crossing links with topological awareness
 * 4. Bundled parallel links (same source→target pair offset)
 * 5. Fan grouping with consistent arc direction
 * 6. Orthogonal routing hints for refinement-internal links
 */

import type { Point, Rect } from "./geometry";
import { center } from "./geometry";

export interface EdgePath {
  /** SVG path `d` attribute */
  d: string;
  /** Midpoint for label placement */
  labelPoint: Point;
  /** Whether this is a curved path */
  curved: boolean;
}

interface LinkEndpoints {
  id: string;
  p1: Point;
  p2: Point;
}

/** Check if two line segments intersect */
function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;

  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 0.001) return false; // parallel

  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / cross;
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / cross;

  // Intersection within segments (excluding endpoints to avoid false positives at shared nodes)
  return t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95;
}

/** Count how many other links this link crosses */
function countCrossings(link: LinkEndpoints, others: LinkEndpoints[]): number {
  let count = 0;
  for (const other of others) {
    if (other.id === link.id) continue;
    if (segmentsIntersect(link.p1, link.p2, other.p1, other.p2)) {
      count++;
    }
  }
  return count;
}

/** Compute perpendicular offset direction for a line */
function perpendicular(p1: Point, p2: Point): Point {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { x: 0, y: -1 };
  return { x: -dy / len, y: dx / len };
}

/** Generate a quadratic Bézier curve that bows away from crossings */
function curvedPath(p1: Point, p2: Point, offset: number): EdgePath {
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const perp = perpendicular(p1, p2);
  const cp = { x: mid.x + perp.x * offset, y: mid.y + perp.y * offset };

  // Label point at t=0.5 on quadratic Bézier
  const labelPoint = {
    x: 0.25 * p1.x + 0.5 * cp.x + 0.25 * p2.x,
    y: 0.25 * p1.y + 0.5 * cp.y + 0.25 * p2.y,
  };

  return {
    d: `M ${p1.x},${p1.y} Q ${cp.x},${cp.y} ${p2.x},${p2.y}`,
    labelPoint,
    curved: true,
  };
}

/** Generate a straight line path */
function straightPath(p1: Point, p2: Point): EdgePath {
  return {
    d: `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`,
    labelPoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
    curved: false,
  };
}

/** Generate a cubic path that preserves stronger horizontal flow for long fan links */
function cubicHorizontalPath(p1: Point, p2: Point, offsetY: number): EdgePath {
  const dx = p2.x - p1.x;
  const cp1 = { x: p1.x + dx * 0.35, y: p1.y + offsetY };
  const cp2 = { x: p2.x - dx * 0.35, y: p2.y + offsetY };
  const labelPoint = {
    x: (p1.x + 3 * cp1.x + 3 * cp2.x + p2.x) / 8,
    y: (p1.y + 3 * cp1.y + 3 * cp2.y + p2.y) / 8,
  };
  return {
    d: `M ${p1.x},${p1.y} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`,
    labelPoint,
    curved: true,
  };
}

/** Key for parallel link detection (same source↔target pair) */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/** Key for convergent link detection (multiple sources → same target) */
function targetKey(targetId: string): string {
  return `tgt::${targetId}`;
}

/** Key for divergent link detection (same source → multiple targets) */
function sourceKey(sourceId: string): string {
  return `src::${sourceId}`;
}

export interface RouteInput {
  id: string;
  sourceId: string;
  targetId: string;
  p1: Point;
  p2: Point;
  /** Optional: the bounding rect of a refinement container, used for layer separation */
  containerRect?: Rect;
  /** Whether this link is internal to a refinement */
  internal?: boolean;
  /** Link type hint for semantic routing (agent, result, etc.) */
  linkType?: string;
}

export interface RouteResult {
  id: string;
  path: EdgePath;
}

/** Classify the predominant flow direction for a set of links */
function classifyFlowDirection(links: RouteInput[]): "top-down" | "left-right" | "mixed" {
  let vertical = 0;
  let horizontal = 0;
  for (const link of links) {
    const dx = Math.abs(link.p2.x - link.p1.x);
    const dy = Math.abs(link.p2.y - link.p1.y);
    if (dy > dx * 1.4) vertical++;
    else if (dx > dy * 1.4) horizontal++;
  }
  if (vertical > horizontal * 2) return "top-down";
  if (horizontal > vertical * 2) return "left-right";
  return "mixed";
}

/** Determine the preferred exit/entry side for a link endpoint based on flow */
function preferredExitSide(
  p1: Point, p2: Point, flow: "top-down" | "left-right" | "mixed"
): "top" | "bottom" | "left" | "right" {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (flow === "top-down") {
    // In top-down flow, prefer exiting bottom when going down, top when going up
    return dy >= 0 ? "bottom" : "top";
  }
  if (flow === "left-right") {
    return dx >= 0 ? "right" : "left";
  }
  // mixed: use geometric direction
  if (Math.abs(dy) > Math.abs(dx)) return dy >= 0 ? "bottom" : "top";
  return dx >= 0 ? "right" : "left";
}

/** Compute adjusted endpoints with port-aware offsets */
function adjustPorts(
  p1: Point, p2: Point, flow: "top-down" | "left-right" | "mixed"
): { p1: Point; p2: Point } {
  const portOffset = 4; // small visual offset to separate port from edge
  const side = preferredExitSide(p1, p2, flow);
  const ap1 = { ...p1 };
  const ap2 = { ...p2 };
  switch (side) {
    case "bottom": ap1.y += portOffset; break;
    case "top": ap1.y -= portOffset; break;
    case "right": ap1.x += portOffset; break;
    case "left": ap1.x -= portOffset; break;
  }
  return { p1: ap1, p2: ap2 };
}

/** Generate an orthogonal-style cubic path for refinement-internal links */
function orthogonalPath(p1: Point, p2: Point, flow: "top-down" | "left-right" | "mixed", offset: number): EdgePath {
  if (flow === "top-down" || (flow === "mixed" && Math.abs(p2.y - p1.y) >= Math.abs(p2.x - p1.x))) {
    // Vertical preference: route down then across
    const midY = (p1.y + p2.y) / 2 + offset;
    const cp1 = { x: p1.x, y: midY };
    const cp2 = { x: p2.x, y: midY };
    const labelPoint = {
      x: (p1.x + 3 * cp1.x + 3 * cp2.x + p2.x) / 8,
      y: (p1.y + 3 * cp1.y + 3 * cp2.y + p2.y) / 8,
    };
    return {
      d: `M ${p1.x},${p1.y} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`,
      labelPoint,
      curved: true,
    };
  } else {
    // Horizontal preference: route across then down
    const midX = (p1.x + p2.x) / 2 + offset;
    const cp1 = { x: midX, y: p1.y };
    const cp2 = { x: midX, y: p2.y };
    const labelPoint = {
      x: (p1.x + 3 * cp1.x + 3 * cp2.x + p2.x) / 8,
      y: (p1.y + 3 * cp1.y + 3 * cp2.y + p2.y) / 8,
    };
    return {
      d: `M ${p1.x},${p1.y} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`,
      labelPoint,
      curved: true,
    };
  }
}

/** Semantic lane for link types */
function semanticLane(linkType?: string): "input" | "output" | "structural" | "control" {
  if (!linkType) return "control";
  if (["agent", "instrument", "consumption", "input"].includes(linkType)) return "input";
  if (["result", "output", "effect"].includes(linkType)) return "output";
  if (["aggregation", "exhibition", "generalization", "classification", "tagged"].includes(linkType)) return "structural";
  return "control";
}

/**
 * Route a batch of links, applying curves where crossings occur,
 * offsetting parallel links, and nudging labels to avoid collisions.
 *
 * Enhanced with:
 * - Flow-direction awareness (top-down, left-right, mixed)
 * - Semantic link type routing (input vs output lanes)
 * - Orthogonal routing hints for refinement-internal links
 * - Consistent fan arc direction
 */
export function routeEdges(links: RouteInput[]): Map<string, EdgePath> {
  const result = new Map<string, EdgePath>();
  if (links.length === 0) return result;

  const flow = classifyFlowDirection(links);
  const endpoints: LinkEndpoints[] = links.map(l => ({ id: l.id, p1: l.p1, p2: l.p2 }));

  // Detect parallel links (same source↔target pair)
  const parallelGroups = new Map<string, RouteInput[]>();
  for (const link of links) {
    const key = pairKey(link.sourceId, link.targetId);
    if (!parallelGroups.has(key)) parallelGroups.set(key, []);
    parallelGroups.get(key)!.push(link);
  }

  // Detect convergent links (different sources → same target)
  const convergentGroups = new Map<string, RouteInput[]>();
  for (const link of links) {
    const key = targetKey(link.targetId);
    if (!convergentGroups.has(key)) convergentGroups.set(key, []);
    convergentGroups.get(key)!.push(link);
  }

  // Detect divergent links (same source → different targets)
  const divergentGroups = new Map<string, RouteInput[]>();
  for (const link of links) {
    const key = sourceKey(link.sourceId);
    if (!divergentGroups.has(key)) divergentGroups.set(key, []);
    divergentGroups.get(key)!.push(link);
  }

  // For each link, decide path
  for (const link of links) {
    const key = pairKey(link.sourceId, link.targetId);
    const group = parallelGroups.get(key)!;
    const convKey = targetKey(link.targetId);
    const convGroup = convergentGroups.get(convKey)!;
    const divKey = sourceKey(link.sourceId);
    const divGroup = divergentGroups.get(divKey)!;

    // Apply port adjustment for flow awareness
    const adjusted = adjustPorts(link.p1, link.p2, flow);
    const ap1 = adjusted.p1;
    const ap2 = adjusted.p2;

    if (group.length > 1) {
      // Parallel links (same pair): offset each one
      const idx = group.indexOf(link);
      const total = group.length;
      const spread = Math.min(30, Math.max(15, 60 / total)); // adaptive spread
      const offset = (idx - (total - 1) / 2) * spread;

      if (Math.abs(offset) < 1) {
        const crossings = countCrossings({ id: link.id, p1: ap1, p2: ap2 }, endpoints);
        if (crossings > 0) {
          result.set(link.id, curvedPath(ap1, ap2, 25 + crossings * 10));
        } else {
          result.set(link.id, straightPath(ap1, ap2));
        }
      } else {
        result.set(link.id, curvedPath(ap1, ap2, offset));
      }
    } else if (convGroup.length >= 3 || divGroup.length >= 3) {
      // Fan-in / fan-out: use consistent arc direction sorted by position
      const fanGroup = convGroup.length >= divGroup.length ? convGroup : divGroup;
      // Sort fan members by their endpoint position for consistent ordering
      const sortedFan = [...fanGroup].sort((a, b) => {
        const aPos = a.p2.y * 10000 + a.p2.x;
        const bPos = b.p2.y * 10000 + b.p2.x;
        return aPos - bPos;
      });
      const idx = sortedFan.findIndex(l => l.id === link.id);
      const total = sortedFan.length;
      const spread = Math.min(34, Math.max(14, 84 / total));
      const offset = (idx - (total - 1) / 2) * spread;
      const crossings = countCrossings({ id: link.id, p1: ap1, p2: ap2 }, endpoints);
      const amplified = offset === 0 ? 0 : offset * (crossings > 0 ? 1.15 : 0.9);
      const dx = Math.abs(ap2.x - ap1.x);
      const dy = Math.abs(ap2.y - ap1.y);

      // Use orthogonal routing for internal refinement links
      if (link.internal && (flow === "top-down" || flow === "left-right")) {
        result.set(link.id, orthogonalPath(ap1, ap2, flow, amplified * 0.4));
      } else if (Math.abs(amplified) < 2) {
        result.set(link.id, straightPath(ap1, ap2));
      } else if (dx > 260 && dy > 30) {
        result.set(link.id, cubicHorizontalPath(ap1, ap2, amplified));
      } else {
        result.set(link.id, curvedPath(ap1, ap2, amplified));
      }
    } else if (link.internal && (flow === "top-down" || flow === "left-right")) {
      // Single internal link in a refinement with clear flow: use orthogonal routing
      const crossings = countCrossings({ id: link.id, p1: ap1, p2: ap2 }, endpoints);
      const semanticOff = semanticLane(link.linkType) === "input" ? -12 : semanticLane(link.linkType) === "output" ? 12 : 0;
      if (crossings >= 1) {
        result.set(link.id, orthogonalPath(ap1, ap2, flow, semanticOff + crossings * 8));
      } else {
        result.set(link.id, orthogonalPath(ap1, ap2, flow, semanticOff));
      }
    } else {
      // Single link: check for crossings
      const crossings = countCrossings({ id: link.id, p1: ap1, p2: ap2 }, endpoints);
      if (crossings >= 2) {
        // Use geometric direction instead of hash for consistent curve direction
        const midX = (ap1.x + ap2.x) / 2;
        const midY = (ap1.y + ap2.y) / 2;
        const perp = perpendicular(ap1, ap2);
        // Bias curve toward the side with more space
        const sign = perp.x > 0 ? 1 : perp.y > 0 ? -1 : 1;
        result.set(link.id, curvedPath(ap1, ap2, sign * (20 + crossings * 8)));
      } else {
        result.set(link.id, straightPath(ap1, ap2));
      }
    }
  }

  // Label nudging: detect label collisions and offset them
  nudgeLabels(result);

  return result;
}

/**
 * Nudge label positions when multiple labels would overlap.
 * Labels within `threshold` pixels are spread apart vertically.
 */
function nudgeLabels(paths: Map<string, EdgePath>): void {
  const threshold = 20; // px — labels closer than this get nudged
  const entries = Array.from(paths.entries());
  
  // Group labels by proximity
  const nudged = new Set<number>();
  for (let i = 0; i < entries.length; i++) {
    if (nudged.has(i)) continue;
    const entryA = entries[i]!;
    const pathA = entryA[1];
    const cluster: number[] = [i];
    
    for (let j = i + 1; j < entries.length; j++) {
      if (nudged.has(j)) continue;
      const entryB = entries[j]!;
      const pathB = entryB[1];
      const dx = pathA.labelPoint.x - pathB.labelPoint.x;
      const dy = pathA.labelPoint.y - pathB.labelPoint.y;
      if (Math.abs(dx) < 50 && Math.abs(dy) < threshold) {
        cluster.push(j);
      }
    }
    
    if (cluster.length > 1) {
      // Spread labels vertically
      const nudgeStep = 14; // px between labels
      const totalNudge = (cluster.length - 1) * nudgeStep;
      for (let k = 0; k < cluster.length; k++) {
        const ci = cluster[k]!;
        const entry = entries[ci]!;
        const id = entry[0];
        const path = entry[1];
        const nudge = k * nudgeStep - totalNudge / 2;
        paths.set(id, {
          ...path,
          labelPoint: {
            x: path.labelPoint.x,
            y: path.labelPoint.y + nudge,
          },
        });
        nudged.add(ci);
      }
    }
  }
}
