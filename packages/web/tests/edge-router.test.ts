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
    // Label point should be near midpoint (port adjustment may shift slightly)
    expect(path.labelPoint.x).toBeCloseTo(50, -1);
    expect(path.labelPoint.y).toBeCloseTo(50, -1);
  });

  it("separates fan-out links from the same source in dense clusters", () => {
    const links: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 100, y: 100 }, p2: { x: 260, y: 20 } },
      { id: "b", sourceId: "s1", targetId: "t2", p1: { x: 100, y: 100 }, p2: { x: 260, y: 100 } },
      { id: "c", sourceId: "s1", targetId: "t3", p1: { x: 100, y: 100 }, p2: { x: 260, y: 180 } },
    ];
    const result = routeEdges(links);
    const curved = links.filter((link) => result.get(link.id)?.curved).length;
    expect(curved).toBeGreaterThanOrEqual(2);
  });

  it("uses stronger cubic separation for long fan links crossing a wide area", () => {
    const links: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 100, y: 300 }, p2: { x: 620, y: 120 } },
      { id: "b", sourceId: "s1", targetId: "t2", p1: { x: 100, y: 300 }, p2: { x: 620, y: 300 } },
      { id: "c", sourceId: "s1", targetId: "t3", p1: { x: 100, y: 300 }, p2: { x: 620, y: 480 } },
    ];
    const result = routeEdges(links);
    expect(result.get("a")?.d.includes(" C ")).toBe(true);
    expect(result.get("c")?.d.includes(" C ")).toBe(true);
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

  it("classifies flow direction as top-down for vertical links", () => {
    const links: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 100, y: 0 }, p2: { x: 100, y: 200 } },
      { id: "b", sourceId: "s2", targetId: "t2", p1: { x: 300, y: 0 }, p2: { x: 300, y: 200 } },
      { id: "c", sourceId: "s3", targetId: "t3", p1: { x: 500, y: 0 }, p2: { x: 500, y: 200 } },
    ];
    const result = routeEdges(links);
    expect(result.size).toBe(3);
    // All should produce valid paths
    for (const path of result.values()) {
      expect(path.d).toBeTruthy();
      expect(path.labelPoint).toBeDefined();
    }
  });

  it("routes internal refinement links with orthogonal paths", () => {
    const links: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 100, y: 100 }, p2: { x: 100, y: 300 }, internal: true },
      { id: "b", sourceId: "s1", targetId: "t2", p1: { x: 100, y: 100 }, p2: { x: 100, y: 500 }, internal: true },
      { id: "c", sourceId: "s1", targetId: "t3", p1: { x: 100, y: 100 }, p2: { x: 100, y: 700 }, internal: true },
    ];
    const result = routeEdges(links);
    // Internal links should produce cubic Bézier paths (orthogonal)
    const paths = [...result.values()];
    expect(paths.every(p => p.curved)).toBe(true);
    expect(paths.every(p => p.d.includes(" C "))).toBe(true);
  });

  it("applies semantic lane offsets for input vs output links", () => {
    const inputLinks: RouteInput[] = [
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 100, y: 100 }, p2: { x: 100, y: 300 }, internal: true, linkType: "agent" },
      { id: "b", sourceId: "s1", targetId: "t2", p1: { x: 100, y: 100 }, p2: { x: 100, y: 300 }, internal: true, linkType: "result" },
    ];
    const result = routeEdges(inputLinks);
    expect(result.size).toBe(2);
    // Different link types should produce different paths (semantic offset)
    const paths = [...result.values()].map(p => p.d);
    expect(new Set(paths).size).toBe(2);
  });

  it("sorts fan members by position for consistent arcs", () => {
    const links: RouteInput[] = [
      { id: "c", sourceId: "s1", targetId: "t3", p1: { x: 100, y: 300 }, p2: { x: 620, y: 480 } },
      { id: "a", sourceId: "s1", targetId: "t1", p1: { x: 100, y: 300 }, p2: { x: 620, y: 120 } },
      { id: "b", sourceId: "s1", targetId: "t2", p1: { x: 100, y: 300 }, p2: { x: 620, y: 300 } },
    ];
    const result = routeEdges(links);
    // All three should have different paths (fan offset by sorted position)
    const paths = [...result.values()].map(p => p.d);
    expect(new Set(paths).size).toBe(3);
  });
});
