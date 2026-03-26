/**
 * Edge Router — intelligent link path computation
 *
 * Provides curved paths for links to avoid crossings and improve
 * visual clarity in dense OPD diagrams.
 *
 * Strategies:
 * 1. Straight line for short, non-crossing links
 * 2. Quadratic Bézier curve for links that cross others
 * 3. Bundled parallel links (same source→target pair offset)
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

/** Key for parallel link detection */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export interface RouteInput {
  id: string;
  sourceId: string;
  targetId: string;
  p1: Point;
  p2: Point;
}

export interface RouteResult {
  id: string;
  path: EdgePath;
}

/**
 * Route a batch of links, applying curves where crossings occur
 * and offsetting parallel links.
 */
export function routeEdges(links: RouteInput[]): Map<string, EdgePath> {
  const result = new Map<string, EdgePath>();
  if (links.length === 0) return result;

  const endpoints: LinkEndpoints[] = links.map(l => ({ id: l.id, p1: l.p1, p2: l.p2 }));

  // Detect parallel links (same source↔target pair)
  const parallelGroups = new Map<string, RouteInput[]>();
  for (const link of links) {
    const key = pairKey(link.sourceId, link.targetId);
    if (!parallelGroups.has(key)) parallelGroups.set(key, []);
    parallelGroups.get(key)!.push(link);
  }

  // For each link, decide path
  for (const link of links) {
    const key = pairKey(link.sourceId, link.targetId);
    const group = parallelGroups.get(key)!;

    if (group.length > 1) {
      // Parallel links: offset each one
      const idx = group.indexOf(link);
      const total = group.length;
      const spread = 20; // pixels between parallel links
      const offset = (idx - (total - 1) / 2) * spread;

      if (Math.abs(offset) < 1) {
        // Center link stays straight but might need curve for crossings
        const crossings = countCrossings({ id: link.id, p1: link.p1, p2: link.p2 }, endpoints);
        if (crossings > 0) {
          result.set(link.id, curvedPath(link.p1, link.p2, 25 + crossings * 10));
        } else {
          result.set(link.id, straightPath(link.p1, link.p2));
        }
      } else {
        result.set(link.id, curvedPath(link.p1, link.p2, offset));
      }
    } else {
      // Single link: check for crossings
      const crossings = countCrossings({ id: link.id, p1: link.p1, p2: link.p2 }, endpoints);
      if (crossings >= 2) {
        // Significant crossings — curve away
        // Direction of curve alternates based on link ID hash to avoid all curving the same way
        const hash = link.id.split("").reduce((h, c) => h * 31 + c.charCodeAt(0), 0);
        const sign = hash % 2 === 0 ? 1 : -1;
        result.set(link.id, curvedPath(link.p1, link.p2, sign * (20 + crossings * 8)));
      } else {
        result.set(link.id, straightPath(link.p1, link.p2));
      }
    }
  }

  return result;
}
