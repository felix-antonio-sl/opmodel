// packages/core/tests/structural-forks.test.ts
import { describe, it, expect } from "vitest";
import { findStructuralForks } from "../src/api";
import type { Link } from "../src/types";
import type { ResolvedLink } from "../src/simulation";

/** Helper: create a resolved link with visual endpoints matching link endpoints */
function rl(link: Link): ResolvedLink {
  return { link, visualSource: link.source, visualTarget: link.target, aggregated: false };
}

function mkLink(id: string, type: Link["type"], source: string, target: string): Link {
  return { id, type, source, target };
}

describe("findStructuralForks", () => {
  it("returns empty when no structural links", () => {
    const links: ResolvedLink[] = [
      rl(mkLink("lnk-1", "effect", "proc-a", "obj-b")),
      rl(mkLink("lnk-2", "agent", "obj-c", "proc-a")),
    ];
    expect(findStructuralForks(links)).toEqual([]);
  });

  it("returns empty when structural links have no forks (single child each)", () => {
    const links: ResolvedLink[] = [
      rl(mkLink("lnk-1", "aggregation", "obj-car", "obj-engine")),
      rl(mkLink("lnk-2", "exhibition", "obj-color", "obj-car")),
    ];
    expect(findStructuralForks(links)).toEqual([]);
  });

  it("detects aggregation fork (source=parent)", () => {
    const links: ResolvedLink[] = [
      rl(mkLink("lnk-1", "aggregation", "obj-car", "obj-engine")),
      rl(mkLink("lnk-2", "aggregation", "obj-car", "obj-wheel")),
      rl(mkLink("lnk-3", "aggregation", "obj-car", "obj-door")),
    ];
    const forks = findStructuralForks(links);
    expect(forks).toHaveLength(1);
    expect(forks[0]!.type).toBe("aggregation");
    expect(forks[0]!.parentId).toBe("obj-car");
    expect(forks[0]!.children).toHaveLength(3);
    expect(forks[0]!.children.map(c => c.childId).sort()).toEqual(["obj-door", "obj-engine", "obj-wheel"]);
  });

  it("detects exhibition fork (target=parent, correct convention)", () => {
    const links: ResolvedLink[] = [
      rl(mkLink("lnk-1", "exhibition", "obj-color", "obj-car")),
      rl(mkLink("lnk-2", "exhibition", "obj-weight", "obj-car")),
    ];
    const forks = findStructuralForks(links);
    expect(forks).toHaveLength(1);
    expect(forks[0]!.type).toBe("exhibition");
    expect(forks[0]!.parentId).toBe("obj-car");
    expect(forks[0]!.children.map(c => c.childId).sort()).toEqual(["obj-color", "obj-weight"]);
  });

  it("detects exhibition fork (source=parent, canvas UI convention)", () => {
    // Canvas UI creates exhibition links as source=exhibitor, target=feature
    const links: ResolvedLink[] = [
      rl(mkLink("lnk-1", "exhibition", "obj-car", "obj-color")),
      rl(mkLink("lnk-2", "exhibition", "obj-car", "obj-weight")),
      rl(mkLink("lnk-3", "exhibition", "obj-car", "obj-speed")),
    ];
    const forks = findStructuralForks(links);
    expect(forks).toHaveLength(1);
    expect(forks[0]!.type).toBe("exhibition");
    expect(forks[0]!.parentId).toBe("obj-car");
    expect(forks[0]!.children.map(c => c.childId).sort()).toEqual(["obj-color", "obj-speed", "obj-weight"]);
  });

  it("detects generalization fork (source=parent)", () => {
    const links: ResolvedLink[] = [
      rl(mkLink("lnk-1", "generalization", "obj-vehicle", "obj-car")),
      rl(mkLink("lnk-2", "generalization", "obj-vehicle", "obj-truck")),
    ];
    const forks = findStructuralForks(links);
    expect(forks).toHaveLength(1);
    expect(forks[0]!.type).toBe("generalization");
    expect(forks[0]!.parentId).toBe("obj-vehicle");
  });

  it("detects classification fork (source=parent)", () => {
    const links: ResolvedLink[] = [
      rl(mkLink("lnk-1", "classification", "obj-color", "obj-red")),
      rl(mkLink("lnk-2", "classification", "obj-color", "obj-blue")),
    ];
    const forks = findStructuralForks(links);
    expect(forks).toHaveLength(1);
    expect(forks[0]!.type).toBe("classification");
    expect(forks[0]!.parentId).toBe("obj-color");
  });

  it("separates forks by type on same parent", () => {
    const links: ResolvedLink[] = [
      // aggregation fork: car → engine, wheel
      rl(mkLink("lnk-a1", "aggregation", "obj-car", "obj-engine")),
      rl(mkLink("lnk-a2", "aggregation", "obj-car", "obj-wheel")),
      // exhibition fork: color, weight → car (correct convention)
      rl(mkLink("lnk-e1", "exhibition", "obj-color", "obj-car")),
      rl(mkLink("lnk-e2", "exhibition", "obj-weight", "obj-car")),
    ];
    const forks = findStructuralForks(links);
    expect(forks).toHaveLength(2);
    const aggFork = forks.find(f => f.type === "aggregation")!;
    const exhFork = forks.find(f => f.type === "exhibition")!;
    expect(aggFork.parentId).toBe("obj-car");
    expect(aggFork.children).toHaveLength(2);
    expect(exhFork.parentId).toBe("obj-car");
    expect(exhFork.children).toHaveLength(2);
  });

  it("ignores non-structural links mixed in", () => {
    const links: ResolvedLink[] = [
      rl(mkLink("lnk-a1", "aggregation", "obj-car", "obj-engine")),
      rl(mkLink("lnk-a2", "aggregation", "obj-car", "obj-wheel")),
      rl(mkLink("lnk-eff", "effect", "proc-drive", "obj-car")),
      rl(mkLink("lnk-agt", "agent", "obj-driver", "proc-drive")),
    ];
    const forks = findStructuralForks(links);
    expect(forks).toHaveLength(1);
    expect(forks[0]!.children).toHaveLength(2);
  });

  it("preserves link references and childIsTarget flag", () => {
    const link1 = mkLink("lnk-1", "aggregation", "obj-car", "obj-engine");
    const link2 = mkLink("lnk-2", "aggregation", "obj-car", "obj-wheel");
    const links: ResolvedLink[] = [rl(link1), rl(link2)];
    const forks = findStructuralForks(links);
    const linkIds = forks[0]!.children.map(c => c.link.id).sort();
    expect(linkIds).toEqual(["lnk-1", "lnk-2"]);
    // source=parent → children are targets
    expect(forks[0]!.children.every(c => c.childIsTarget)).toBe(true);
  });

  it("sets childIsTarget=false when parent is target", () => {
    // Correct exhibition convention: source=feature, target=exhibitor
    const links: ResolvedLink[] = [
      rl(mkLink("lnk-1", "exhibition", "obj-color", "obj-car")),
      rl(mkLink("lnk-2", "exhibition", "obj-weight", "obj-car")),
    ];
    const forks = findStructuralForks(links);
    expect(forks[0]!.parentId).toBe("obj-car");
    // Children are sources, not targets
    expect(forks[0]!.children.every(c => c.childIsTarget === false)).toBe(true);
  });
});
