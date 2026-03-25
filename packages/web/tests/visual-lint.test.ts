import { describe, expect, it } from "vitest";
import { loadModel, type Appearance, type Link, type State, type Thing } from "@opmodel/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  auditVisualOpd,
  contentBounds,
  findCrowdedDiagrams,
  findDegenerateBounds,
  findNonContainerOverlaps,
  findTightSpacing,
  findTruncatedStateBoxes,
  findVisibleOrphans,
} from "../src/lib/visual-lint";

function makeAppearance(thing: string, x: number, y: number, w: number, h: number, internal = false): Appearance {
  return { thing, opd: "opd-sd", x, y, w, h, internal } as Appearance;
}

describe("visual-lint", () => {
  it("detects non-container overlaps only for visible appearances", () => {
    const overlaps = findNonContainerOverlaps([
      makeAppearance("a", 0, 0, 100, 60),
      makeAppearance("b", 80, 20, 100, 60),
      makeAppearance("container", 0, 0, 300, 200, true),
    ]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toMatchObject({ aThing: "a", bThing: "b" });
  });

  it("detects visible orphan appearances", () => {
    const appearances = [
      makeAppearance("a", 0, 0, 100, 60),
      makeAppearance("b", 120, 0, 100, 60),
      makeAppearance("c", 240, 0, 100, 60),
    ];
    const links = [
      { id: "l1", type: "agent", source: "a", target: "b" } as Link,
    ];
    expect(findVisibleOrphans(appearances, links)).toEqual([{ kind: "orphan", thing: "c" }]);
  });

  it("detects truncated state pills for narrow stateful objects", () => {
    const appearances = [makeAppearance("obj-quality", 0, 0, 160, 60)];
    const statesByThing = new Map<string, State[]>([
      [
        "obj-quality",
        [
          { id: "s1", parent: "obj-quality", name: "unverified" } as State,
          { id: "s2", parent: "obj-quality", name: "assembled" } as State,
          { id: "s3", parent: "obj-quality", name: "certified" } as State,
          { id: "s4", parent: "obj-quality", name: "tested" } as State,
        ],
      ],
    ]);
    const findings = findTruncatedStateBoxes(appearances, statesByThing);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.kind === "truncated-state")).toBe(true);
  });

  it("detects degenerate fit bounds", () => {
    const findings = findDegenerateBounds([
      makeAppearance("a", 0, 0, 1200, 40),
      makeAppearance("b", 1300, 0, 120, 40),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("degenerate-bounds");
  });

  it("computes content bounds for visible content", () => {
    const bounds = contentBounds([
      makeAppearance("a", 10, 20, 100, 60),
      makeAppearance("b", 150, 90, 80, 40),
    ]);
    expect(bounds).toEqual({ x: 10, y: 20, w: 220, h: 110 });
  });

  it("detects crowded diagrams even without direct overlaps", () => {
    const findings = findCrowdedDiagrams([
      makeAppearance("a", 0, 0, 120, 60),
      makeAppearance("b", 126, 0, 120, 60),
      makeAppearance("c", 252, 0, 120, 60),
      makeAppearance("d", 378, 0, 120, 60),
      makeAppearance("e", 0, 66, 120, 60),
      makeAppearance("f", 126, 66, 120, 60),
      makeAppearance("g", 252, 66, 120, 60),
      makeAppearance("h", 378, 66, 120, 60),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: "crowded-diagram", nodeCount: 8 });
  });

  it("detects tight readable gaps between nearby nodes", () => {
    const findings = findTightSpacing([
      makeAppearance("a", 0, 0, 120, 60),
      makeAppearance("b", 132, 0, 120, 60),
      makeAppearance("c", 400, 0, 120, 60),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: "tight-spacing", aThing: "a", bThing: "b", axis: "x" });
  });

  it("audits EV-AMS with no overlap/orphan findings", () => {
    const fixture = readFileSync(resolve(process.cwd(), "tests/ev-ams.opmodel"), "utf8");
    const parsed = loadModel(fixture);
    if (!parsed.ok) throw new Error("fixture load failed");
    const model = parsed.value;

    for (const opd of model.opds.values()) {
      const appearances = [...model.appearances.values()].filter((a) => a.opd === opd.id);
      const ids = new Set(appearances.map((a) => a.thing));
      const links = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
      const findings = auditVisualOpd({
        appearances,
        links,
        things: model.things.values() as Iterable<Thing>,
        states: model.states.values() as Iterable<State>,
      });
      expect(findings.filter((f) => f.kind === "overlap" || f.kind === "orphan")).toEqual([]);
    }
  });
});
