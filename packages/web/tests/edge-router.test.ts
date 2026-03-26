import { describe, expect, it } from "vitest";
import { routeEdges, type RouteInput } from "../src/lib/edge-router";

describe("edge-router", () => {
  it("returns straight paths for non-crossing links", () => {
    const links: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } },
      { id: "b", sourceId: "s2", targetId: "t2", p1: { x: 0, y: 100 }, p2: { x: 100, y: 100 } },
    ];
    const result = routeEdges(links);
    expect(result.size).toBe(2);
    expect(result.get("a")!.curved).toBe(false);
    expect(result.get("b")!.curved).toBe(false);
  });

  it("curves links that have multiple crossings", () => {
    // Create a star pattern where many links cross
    const links: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 0, y: 0 }, p2: { x: 200, y: 200 } },
      { id: "b", sourceId: "s2", targetId: "t2", p1: { x: 200, y: 0 }, p2: { x: 0, y: 200 } },
      { id: "c", sourceId: "s3", targetId: "t3", p1: { x: 0, y: 100 }, p2: { x: 200, y: 100 } },
      { id: "d", sourceId: "s4", targetId: "t4", p1: { x: 100, y: 0 }, p2: { x: 100, y: 200 } },
    ];
    const result = routeEdges(links);
    expect(result.size).toBe(4);
    // At least some should be curved
    const curved = [...result.values()].filter(p => p.curved).length;
    expect(curved).toBeGreaterThan(0);
  });

  it("offsets parallel links between same endpoints", () => {
    const links: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 } },
      { id: "b", sourceId: "s1", targetId: "t1", p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 } },
      { id: "c", sourceId: "s1", targetId: "t1", p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 } },
    ];
    const result = routeEdges(links);
    expect(result.size).toBe(3);
    // Parallel links should have different paths
    const paths = [...result.values()].map(p => p.d);
    const unique = new Set(paths);
    expect(unique.size).toBe(3); // all different due to offset
  });

  it("provides label points for all paths", () => {
    const links: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 0, y: 0 }, p2: { x: 100, y: 100 } },
    ];
    const result = routeEdges(links);
    const path = result.get("a")!;
    expect(path.labelPoint.x).toBeCloseTo(50, 0);
    expect(path.labelPoint.y).toBeCloseTo(50, 0);
  });

  it("handles empty input", () => {
    const result = routeEdges([]);
    expect(result.size).toBe(0);
  });

  it("handles single link", () => {
    const links: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } },
    ];
    const result = routeEdges(links);
    expect(result.size).toBe(1);
    expect(result.get("a")!.curved).toBe(false);
  });
});
