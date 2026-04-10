import { describe, expect, it } from "vitest";
import { buildFanOverlayGeometry } from "../src/lib/fan-overlay";

describe("buildFanOverlayGeometry", () => {
  it("returns no geometry for fewer than 2 fan members", () => {
    expect(buildFanOverlayGeometry({ x: 0, y: 0 }, [{ x: 10, y: 0 }], "xor")).toBeNull();
  });

  it("builds primary and secondary arcs for OR fans", () => {
    const geometry = buildFanOverlayGeometry(
      { x: 0, y: 0 },
      [{ x: 80, y: -20 }, { x: 90, y: 0 }, { x: 80, y: 20 }],
      "or",
    );

    expect(geometry).not.toBeNull();
    expect(geometry?.primaryPath.startsWith("M ")).toBe(true);
    expect(geometry?.secondaryPath?.startsWith("M ")).toBe(true);
    expect(geometry?.secondaryPath).not.toBe(geometry?.primaryPath);
  });

  it("inflates small fans to a readable minimum radius", () => {
    const geometry = buildFanOverlayGeometry(
      { x: 100, y: 100 },
      [{ x: 110, y: 96 }, { x: 111, y: 100 }, { x: 110, y: 104 }],
      "xor",
    );

    expect(geometry).not.toBeNull();
    expect(geometry?.primaryPath).toContain("M ");
  });
});
