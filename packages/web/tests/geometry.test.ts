import { describe, it, expect } from "vitest";
import {
  center,
  rectEdgePoint,
  ellipseEdgePoint,
  midpoint,
  distance,
  angleDeg,
} from "../src/lib/geometry";

describe("center", () => {
  it("returns center of a rectangle at origin", () => {
    const p = center({ x: 0, y: 0, w: 100, h: 60 });
    expect(p).toEqual({ x: 50, y: 30 });
  });

  it("returns center of a rectangle with non-zero origin", () => {
    const p = center({ x: 20, y: 10, w: 100, h: 60 });
    expect(p).toEqual({ x: 70, y: 40 });
  });
});

describe("rectEdgePoint", () => {
  const rect = { x: 0, y: 0, w: 100, h: 60 };
  // center is (50, 30), halfW=50, halfH=30

  it("target to the right exits on the right edge", () => {
    const p = rectEdgePoint(rect, { x: 200, y: 30 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(30);
  });

  it("target to the left exits on the left edge", () => {
    const p = rectEdgePoint(rect, { x: -100, y: 30 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(30);
  });

  it("target above exits on the top edge", () => {
    const p = rectEdgePoint(rect, { x: 50, y: -100 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
  });

  it("target below exits on the bottom edge", () => {
    const p = rectEdgePoint(rect, { x: 50, y: 200 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(60);
  });

  it("diagonal target exits correctly", () => {
    // target far to the bottom-right: (200, 130) => dx=150, dy=100
    // |dx|*halfH = 150*30 = 4500 > |dy|*halfW = 100*50 = 5000? No, 4500 < 5000
    // So it exits on the bottom edge (dy branch)
    const p = rectEdgePoint(rect, { x: 200, y: 130 });
    expect(p.y).toBeCloseTo(60); // bottom edge
    // x = cx + (dx * halfH) / |dy| = 50 + (150*30)/100 = 50 + 45 = 95
    expect(p.x).toBeCloseTo(95);
  });

  it("coincident target (dx=0, dy=0) returns center", () => {
    const p = rectEdgePoint(rect, { x: 50, y: 30 });
    expect(p).toEqual({ x: 50, y: 30 });
  });
});

describe("ellipseEdgePoint", () => {
  const rect = { x: 0, y: 0, w: 100, h: 60 };
  // center (50, 30), a=50, b=30

  it("target to the right exits on right of ellipse", () => {
    const p = ellipseEdgePoint(rect, { x: 200, y: 30 });
    // angle = 0, cos(0)=1, sin(0)=0
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(30);
  });

  it("target to the left exits on left of ellipse", () => {
    const p = ellipseEdgePoint(rect, { x: -100, y: 30 });
    // angle = PI, cos(PI)=-1, sin(PI)=0
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(30);
  });

  it("target above exits on top of ellipse", () => {
    const p = ellipseEdgePoint(rect, { x: 50, y: -100 });
    // angle = -PI/2, cos=-0, sin=-1
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
  });

  it("target below exits on bottom of ellipse", () => {
    const p = ellipseEdgePoint(rect, { x: 50, y: 200 });
    // angle = PI/2, cos=0, sin=1
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(60);
  });

  it("coincident target returns center", () => {
    const p = ellipseEdgePoint(rect, { x: 50, y: 30 });
    expect(p).toEqual({ x: 50, y: 30 });
  });
});

describe("midpoint", () => {
  it("returns midpoint of two positive points", () => {
    const p = midpoint({ x: 0, y: 0 }, { x: 10, y: 20 });
    expect(p).toEqual({ x: 5, y: 10 });
  });

  it("handles negative coordinates", () => {
    const p = midpoint({ x: -10, y: -20 }, { x: 10, y: 20 });
    expect(p).toEqual({ x: 0, y: 0 });
  });
});

describe("distance", () => {
  it("horizontal distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(10);
  });

  it("vertical distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 7 })).toBeCloseTo(7);
  });

  it("diagonal distance (3-4-5 triangle)", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });

  it("same point returns 0", () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe("angleDeg", () => {
  const origin = { x: 0, y: 0 };

  it("returns 0 for target directly to the right", () => {
    expect(angleDeg(origin, { x: 10, y: 0 })).toBeCloseTo(0);
  });

  it("returns 90 for target directly below (positive y)", () => {
    expect(angleDeg(origin, { x: 0, y: 10 })).toBeCloseTo(90);
  });

  it("returns 180 for target directly to the left", () => {
    expect(angleDeg(origin, { x: -10, y: 0 })).toBeCloseTo(180);
  });

  it("returns -90 for target directly above (negative y)", () => {
    expect(angleDeg(origin, { x: 0, y: -10 })).toBeCloseTo(-90);
  });

  it("returns 45 for diagonal target", () => {
    expect(angleDeg(origin, { x: 10, y: 10 })).toBeCloseTo(45);
  });
});
