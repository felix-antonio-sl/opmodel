/**
 * Canonical Score Tests — cases where the old score lied
 *
 * Each test constructs a diagram where the pre-clutter score overestimated
 * quality, and verifies that the new perceptual metrics (clutterScore,
 * crossingRate, localDensity) correctly flag the problem.
 */
import { describe, expect, it } from "vitest";
import {
  createModel,
  addThing,
  addAppearance,
  addLink,
  isOk,
  type Link,
  type Model,
  type Thing,
} from "@opmodel/core";
import {
  auditVisualOpd,
  computeVisualQuality,
  findLinkCrossings,
} from "../src/lib/visual-lint";

function withThing(model: Model, thing: Thing): Model {
  const r = addThing(model, thing);
  if (!isOk(r)) throw new Error(r.error.message);
  return r.value;
}

function withAppearance(
  model: Model,
  thing: string,
  opd: string,
  x: number,
  y: number,
  w: number,
  h: number,
  internal = false,
): Model {
  const r = addAppearance(model, { thing, opd, x, y, w, h, ...(internal ? { internal: true } : {}) });
  if (!isOk(r)) throw new Error(r.error.message);
  return r.value;
}

function withLink(model: Model, link: Link): Model {
  const r = addLink(model, link);
  if (!isOk(r)) throw new Error(r.error.message);
  return r.value;
}

/**
 * Canonical Case 1: Dense star pattern — many crossings
 *
 * Place objects at four corners of a rectangle, then create crossing
 * diagonal links (top-left→bottom-right and top-right→bottom-left).
 * Add a process in center to create agent/result links that also cross.
 */
function buildDenseStar(): Model {
  let m = createModel("Dense Star");
  const sdId = [...m.opds.values()][0]!.id;

  // 4 processes spread vertically, with objects on both sides
  // This creates many horizontal links that cross
  const procs = [
    { id: "p1", name: "Process 1", y: 80 },
    { id: "p2", name: "Process 2", y: 220 },
    { id: "p3", name: "Process 3", y: 360 },
    { id: "p4", name: "Process 4", y: 500 },
  ];
  const objs = [
    { id: "o1", name: "Input A", x: 50, y: 80 },
    { id: "o2", name: "Input B", x: 50, y: 220 },
    { id: "o3", name: "Output A", x: 550, y: 360 },
    { id: "o4", name: "Output B", x: 550, y: 500 },
  ];

  for (const p of procs) {
    m = withThing(m, { id: p.id, kind: "process", name: p.name, essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, p.id, sdId, 260, p.y, 160, 60);
  }
  for (const o of objs) {
    m = withThing(m, { id: o.id, kind: "object", name: o.name, essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, o.id, sdId, o.x, o.y, 130, 50);
  }

  // Create crossing links: o1→p3 (skips p1, crosses o2→p2), o2→p4 (crosses o1→p3), etc.
  // Left side: inputs to far-away processes → crossings
  m = withLink(m, { id: "l1", type: "agent", source: "o1", target: "p3" });   // crosses l2
  m = withLink(m, { id: "l2", type: "agent", source: "o2", target: "p2" });   // no cross
  m = withLink(m, { id: "l3", type: "agent", source: "o1", target: "p4" });   // crosses l2
  m = withLink(m, { id: "l4", type: "agent", source: "o2", target: "p3" });   // crosses l1, l2

  // Right side: results from far-away processes → crossings
  m = withLink(m, { id: "l5", type: "result", source: "p1", target: "o3" });   // crosses l6
  m = withLink(m, { id: "l6", type: "result", source: "p2", target: "o4" });   // crosses l5
  m = withLink(m, { id: "l7", type: "result", source: "p3", target: "o3" });   // crosses l6
  m = withLink(m, { id: "l8", type: "result", source: "p4", target: "o4" });   // no cross

  return m;
}

/**
 * Canonical Case 2: Tight cluster — low crossing count but high local density
 *
 * Old behavior: no crossings → no link-crossing penalty. tight-spacing catches
 * some gaps but penalty is small (4 pts each). Score stays high (~80+).
 * New behavior: localDensity should be very high because nodes are crammed
 * into one corner.
 */
function buildTightCluster(): Model {
  let m = createModel("Tight Cluster");
  const sdId = [...m.opds.values()][0]!.id;

  // Pack 8 objects into a small area (upper-left quadrant)
  const positions = [
    { id: "obj-1", x: 50, y: 50 },
    { id: "obj-2", x: 85, y: 50 },
    { id: "obj-3", x: 50, y: 85 },
    { id: "obj-4", x: 85, y: 85 },
    { id: "obj-5", x: 120, y: 50 },
    { id: "obj-6", x: 120, y: 85 },
    { id: "obj-7", x: 50, y: 120 },
    { id: "obj-8", x: 85, y: 120 },
  ];

  for (const p of positions) {
    m = withThing(m, { id: p.id, kind: "object", name: `Node ${p.id.split("-")[1]}`, essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, p.id, sdId, p.x, p.y, 120, 50);
  }

  // Linear chain links (exhibition: obj→proc, result: proc→obj)
  // Add a process to mediate between objects
  m = withThing(m, { id: "proc-chain", kind: "process", name: "Chain", essence: "physical", affiliation: "systemic" });
  m = withAppearance(m, "proc-chain", sdId, 80, 70, 140, 50);
  for (let i = 1; i <= 8; i++) {
    m = withLink(m, { id: `l${i}`, type: "exhibition", source: `obj-${i}`, target: "proc-chain" });
  }

  return m;
}

/**
 * Canonical Case 3: Sparse diagram with a few crossings — old score was too harsh
 *
 * Old behavior: 2 crossings × 5 pts = 10 pts penalty on a diagram with only
 * 3 links. Score drops to ~90 which looks like there's a problem.
 * New behavior: crossingRate = 2/3 = 0.67 (high), but with proper context
 * of the diagram being sparse, the penalty should be proportional.
 */
function buildSparseWithCrossings(): Model {
  let m = createModel("Sparse Cross");
  const sdId = [...m.opds.values()][0]!.id;

  // 2 objects and 2 processes in a crossing X pattern
  m = withThing(m, { id: "obj-a", kind: "object", name: "A", essence: "physical", affiliation: "systemic" });
  m = withAppearance(m, "obj-a", sdId, 100, 100, 140, 50);
  m = withThing(m, { id: "obj-b", kind: "object", name: "B", essence: "physical", affiliation: "systemic" });
  m = withAppearance(m, "obj-b", sdId, 600, 100, 140, 50);
  m = withThing(m, { id: "proc-c", kind: "process", name: "C", essence: "physical", affiliation: "systemic" });
  m = withAppearance(m, "proc-c", sdId, 100, 500, 160, 60);
  m = withThing(m, { id: "proc-d", kind: "process", name: "D", essence: "physical", affiliation: "systemic" });
  m = withAppearance(m, "proc-d", sdId, 600, 500, 160, 60);

  // Diagonal crossings: A→D and B→C create X
  m = withLink(m, { id: "l1", type: "agent", source: "obj-a", target: "proc-d" });
  m = withLink(m, { id: "l2", type: "agent", source: "obj-b", target: "proc-c" });
  // One more non-crossing link
  m = withLink(m, { id: "l3", type: "result", source: "proc-d", target: "obj-b" });

  return m;
}

describe("canonical score tests", () => {
  it("case 1: dense star — clutter score catches crossing-heavy diagram", () => {
    const model = buildDenseStar();
    const sdId = [...model.opds.values()][0]!.id;
    const apps = [...model.appearances.values()].filter((a) => a.opd === sdId);
    const ids = new Set(apps.map((a) => a.thing));
    const links = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));

    const findings = auditVisualOpd({ appearances: apps, links, things: model.things.values() });
    const quality = computeVisualQuality(findings, apps, links);

    // The new crossing rate should be significant
    expect(quality.crossingRate).toBeGreaterThan(0);
    // Clutter score should be notable
    expect(quality.clutterScore).toBeGreaterThan(0.1);
    // Score should reflect the visual mess — lower than clean diagram
    expect(quality.score).toBeLessThan(95);
  });

  it("case 2: tight cluster — local density catches spatial cramming", () => {
    const model = buildTightCluster();
    const sdId = [...model.opds.values()][0]!.id;
    const apps = [...model.appearances.values()].filter((a) => a.opd === sdId);
    const ids = new Set(apps.map((a) => a.thing));
    const links = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));

    const findings = auditVisualOpd({ appearances: apps, links, things: model.things.values() });
    const quality = computeVisualQuality(findings, apps, links);

    // Local density should detect the cramming
    expect(quality.localDensity).toBeGreaterThan(0.3);
    // Clutter score should be elevated
    expect(quality.clutterScore).toBeGreaterThan(0.05);
    // Score should reflect the visual mess
    expect(quality.score).toBeLessThan(95);
  });

  it("case 3: sparse with crossings — score is contextually fair", () => {
    const model = buildSparseWithCrossings();
    const sdId = [...model.opds.values()][0]!.id;
    const apps = [...model.appearances.values()].filter((a) => a.opd === sdId);
    const ids = new Set(apps.map((a) => a.thing));
    const links = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));

    const findings = auditVisualOpd({ appearances: apps, links, things: model.things.values() });
    const quality = computeVisualQuality(findings, apps, links);

    // Should detect the crossings
    const crossings = findings.filter((f) => f.kind === "link-crossing");
    expect(crossings.length).toBeGreaterThan(0);
    // Crossing rate should be calculated
    expect(quality.crossingRate).toBeGreaterThan(0);
    // But the sparse layout means moderate local density (4 nodes in corners, but not cramming)
    expect(quality.localDensity).toBeLessThan(0.7);
    // Score should be moderate (not catastrophic for just 2 crossings on a sparse diagram)
    expect(quality.score).toBeGreaterThan(50);
  });

  it("empty diagram scores perfectly", () => {
    const quality = computeVisualQuality([], [], []);
    expect(quality.score).toBe(100);
    expect(quality.grade).toBe("A");
    expect(quality.clutterScore).toBe(0);
    expect(quality.crossingRate).toBe(0);
    expect(quality.localDensity).toBe(0);
  });
});
