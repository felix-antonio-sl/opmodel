import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addAppearance, addLink, addState, refineThing, removeThing } from "../src/api";
import { resolveLinksForOpd } from "../src/simulation";
import type { Model } from "../src/types";

function unwrap<T, E>(result: { ok: boolean; value?: T; error?: E }): T {
  if (!result.ok) throw new Error(`Expected ok, got error: ${JSON.stringify((result as any).error)}`);
  return result.value as T;
}

/**
 * Builds a model with:
 * - proc-main (in-zoomed into opd-sd1 with 3 subprocesses P1, P2, P3 sorted by Y)
 * - obj-input (consumption → proc-main)
 * - obj-output (result: proc-main → obj-output)
 * - obj-tool (agent → proc-main)
 * - obj-affected (effect: proc-main ↔ obj-affected)
 */
function buildDistributionModel(): Model {
  let m = createModel("distribution-test");
  // Things
  m = unwrap(addThing(m, { id: "proc-main", kind: "process", name: "Main", essence: "informatical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-input", kind: "object", name: "Input", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-output", kind: "object", name: "Output", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-tool", kind: "object", name: "Tool", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-affected", kind: "object", name: "Affected", essence: "physical", affiliation: "systemic" }));
  // Subprocesses
  m = unwrap(addThing(m, { id: "proc-p1", kind: "process", name: "P1", essence: "informatical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "proc-p2", kind: "process", name: "P2", essence: "informatical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "proc-p3", kind: "process", name: "P3", essence: "informatical", affiliation: "systemic" }));
  // Appearances in SD
  m = unwrap(addAppearance(m, { thing: "proc-main", opd: "opd-sd", x: 200, y: 100, w: 150, h: 80 }));
  m = unwrap(addAppearance(m, { thing: "obj-input", opd: "opd-sd", x: 50, y: 50, w: 100, h: 50 }));
  m = unwrap(addAppearance(m, { thing: "obj-output", opd: "opd-sd", x: 400, y: 50, w: 100, h: 50 }));
  m = unwrap(addAppearance(m, { thing: "obj-tool", opd: "opd-sd", x: 50, y: 200, w: 100, h: 50 }));
  m = unwrap(addAppearance(m, { thing: "obj-affected", opd: "opd-sd", x: 400, y: 200, w: 100, h: 50 }));
  // Links
  m = unwrap(addLink(m, { id: "lnk-consume", type: "consumption", source: "obj-input", target: "proc-main" }));
  m = unwrap(addLink(m, { id: "lnk-result", type: "result", source: "proc-main", target: "obj-output" }));
  m = unwrap(addLink(m, { id: "lnk-agent", type: "agent", source: "obj-tool", target: "proc-main" }));
  m = unwrap(addLink(m, { id: "lnk-effect", type: "effect", source: "obj-affected", target: "proc-main" }));
  // In-zoom: creates child OPD with external appearances for connected objects
  // (R-OC-1 auto-creates placeholders — remove them so test controls its own subprocesses)
  m = unwrap(refineThing(m, "proc-main", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
  m = unwrap(removeThing(m, "opd-sd1-sub-1"));
  m = unwrap(removeThing(m, "opd-sd1-sub-2"));
  m = unwrap(removeThing(m, "opd-sd1-sub-3"));
  // Add subprocesses in child OPD with Y-ordering: P1(y=50), P2(y=120), P3(y=190)
  m = unwrap(addAppearance(m, { thing: "proc-p1", opd: "opd-sd1", x: 200, y: 50, w: 120, h: 60, internal: true }));
  m = unwrap(addAppearance(m, { thing: "proc-p2", opd: "opd-sd1", x: 200, y: 120, w: 120, h: 60, internal: true }));
  m = unwrap(addAppearance(m, { thing: "proc-p3", opd: "opd-sd1", x: 200, y: 190, w: 120, h: 60, internal: true }));
  return m;
}

describe("C-01: Link Distribution (derived via resolveLinksForOpd)", () => {
  it("consumption resolves to first subprocess (lowest Y)", () => {
    const m = buildDistributionModel();
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const consume = resolved.find(r => r.link.id === "lnk-consume");
    expect(consume).toBeDefined();
    // consumption target should be first subprocess (proc-p1, y=50)
    expect(consume!.visualTarget).toBe("proc-p1");
    expect(consume!.visualSource).toBe("obj-input");
  });

  it("result resolves to last subprocess (highest Y)", () => {
    const m = buildDistributionModel();
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const result = resolved.find(r => r.link.id === "lnk-result");
    expect(result).toBeDefined();
    // result source should be last subprocess (proc-p3, y=190)
    expect(result!.visualSource).toBe("proc-p3");
    expect(result!.visualTarget).toBe("obj-output");
  });

  it("agent distributes to all subprocesses", () => {
    const m = buildDistributionModel();
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const agents = resolved.filter(r => r.link.id === "lnk-agent");
    expect(agents.length).toBe(3); // one per subprocess
    const targets = agents.map(a => a.visualTarget).sort();
    expect(targets).toEqual(["proc-p1", "proc-p2", "proc-p3"]);
    // All have same source (obj-tool)
    for (const a of agents) expect(a.visualSource).toBe("obj-tool");
  });

  it("effect distributes to all subprocesses", () => {
    const m = buildDistributionModel();
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const effects = resolved.filter(r => r.link.id === "lnk-effect");
    expect(effects.length).toBe(3);
    const targets = effects.map(e => e.visualTarget).sort();
    expect(targets).toEqual(["proc-p1", "proc-p2", "proc-p3"]);
  });

  it("without subprocesses, links to container remain visible", () => {
    // Build model without adding subprocesses
    let m = createModel("no-subs");
    m = unwrap(addThing(m, { id: "proc-main", kind: "process", name: "Main", essence: "informatical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-x", kind: "object", name: "X", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addAppearance(m, { thing: "proc-main", opd: "opd-sd", x: 200, y: 100, w: 150, h: 80 }));
    m = unwrap(addAppearance(m, { thing: "obj-x", opd: "opd-sd", x: 50, y: 50, w: 100, h: 50 }));
    m = unwrap(addLink(m, { id: "lnk-c", type: "consumption", source: "obj-x", target: "proc-main" }));
    // R-OC-1 auto-creates placeholders — remove them to test the "no subprocesses" fallback
    m = unwrap(refineThing(m, "proc-main", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
    m = unwrap(removeThing(m, "opd-sd1-sub-1"));
    m = unwrap(removeThing(m, "opd-sd1-sub-2"));
    m = unwrap(removeThing(m, "opd-sd1-sub-3"));
    // No subprocesses → link shows to container (until subprocesses exist for distribution)
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const consume = resolved.find(r => r.link.id === "lnk-c");
    expect(consume).toBeDefined();
    expect(consume!.visualTarget).toBe("proc-main"); // still points to container
  });

  it("parent OPD still shows original links (not distributed)", () => {
    const m = buildDistributionModel();
    const resolved = resolveLinksForOpd(m, "opd-sd");
    // In parent OPD, links show between external objects and proc-main
    const consume = resolved.find(r => r.link.id === "lnk-consume");
    expect(consume).toBeDefined();
    expect(consume!.visualTarget).toBe("proc-main");
  });

  it("subprocess Y order determines first/last correctly", () => {
    const m = buildDistributionModel();
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    // P1(y=50) is first, P3(y=190) is last
    const consume = resolved.find(r => r.link.id === "lnk-consume");
    const result = resolved.find(r => r.link.id === "lnk-result");
    expect(consume!.visualTarget).toBe("proc-p1"); // first
    expect(result!.visualSource).toBe("proc-p3"); // last
  });
});

// === R-ES: Effect Split (state-specified effect → input half + output half) ===

describe("R-ES: Effect Split in in-zoom distribution", () => {
  function buildEffectSplitModel(): Model {
    let m = createModel("effect-split");
    m = unwrap(addThing(m, { id: "proc-main", kind: "process", name: "Main", essence: "informatical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "obj-x", kind: "object", name: "X", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "proc-p1", kind: "process", name: "P1", essence: "informatical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "proc-p2", kind: "process", name: "P2", essence: "informatical", affiliation: "systemic" }));
    m = unwrap(addThing(m, { id: "proc-p3", kind: "process", name: "P3", essence: "informatical", affiliation: "systemic" }));
    m = unwrap(addState(m, { id: "st-s1", parent: "obj-x", name: "s1", initial: true, final: false, default: false }));
    m = unwrap(addState(m, { id: "st-s2", parent: "obj-x", name: "s2", initial: false, final: true, default: false }));
    // Appearances in SD
    m = unwrap(addAppearance(m, { thing: "proc-main", opd: "opd-sd", x: 200, y: 100, w: 150, h: 80 }));
    m = unwrap(addAppearance(m, { thing: "obj-x", opd: "opd-sd", x: 400, y: 100, w: 100, h: 60 }));
    // Effect link with BOTH states: "Main changes X from s1 to s2"
    m = unwrap(addLink(m, { id: "lnk-effect-io", type: "effect", source: "obj-x", target: "proc-main", source_state: "st-s1", target_state: "st-s2" }));
    // In-zoom
    m = unwrap(refineThing(m, "proc-main", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
    m = unwrap(removeThing(m, "opd-sd1-sub-1"));
    m = unwrap(removeThing(m, "opd-sd1-sub-2"));
    m = unwrap(removeThing(m, "opd-sd1-sub-3"));
    m = unwrap(addAppearance(m, { thing: "proc-p1", opd: "opd-sd1", x: 200, y: 50, w: 120, h: 60, internal: true }));
    m = unwrap(addAppearance(m, { thing: "proc-p2", opd: "opd-sd1", x: 200, y: 120, w: 120, h: 60, internal: true }));
    m = unwrap(addAppearance(m, { thing: "proc-p3", opd: "opd-sd1", x: 200, y: 190, w: 120, h: 60, internal: true }));
    return m;
  }

  it("state-specified effect splits into 2 links (input→first, output→last)", () => {
    const m = buildEffectSplitModel();
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const effects = resolved.filter(r => r.link.id === "lnk-effect-io");
    // Should be 2 (split), not 3 (all subprocesses)
    expect(effects).toHaveLength(2);
  });

  it("input half targets first subprocess with source_state", () => {
    const m = buildEffectSplitModel();
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const effects = resolved.filter(r => r.link.id === "lnk-effect-io");
    // Input half: obj-x (with s1) → first subprocess (P1)
    const inputHalf = effects.find(r => r.visualTarget === "proc-p1");
    expect(inputHalf).toBeDefined();
    expect(inputHalf!.visualSource).toBe("obj-x");
  });

  it("output half targets last subprocess with target_state", () => {
    const m = buildEffectSplitModel();
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const effects = resolved.filter(r => r.link.id === "lnk-effect-io");
    // Output half: last subprocess (P3) → obj-x (with s2)
    const outputHalf = effects.find(r => r.visualSource === "proc-p3");
    expect(outputHalf).toBeDefined();
    expect(outputHalf!.visualTarget).toBe("obj-x");
  });

  it("basic effect (no states) still distributes to all subprocesses", () => {
    let m = buildEffectSplitModel();
    // Replace state-specified effect with basic effect
    const links = new Map(m.links);
    links.delete("lnk-effect-io");
    links.set("lnk-effect-basic", {
      id: "lnk-effect-basic", type: "effect" as const,
      source: "obj-x", target: "proc-main",
    } as any);
    m = { ...m, links };
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const effects = resolved.filter(r => r.link.id === "lnk-effect-basic");
    expect(effects).toHaveLength(3); // all subprocesses
  });

  it("input-specified effect (only source_state) splits into 2", () => {
    let m = buildEffectSplitModel();
    // Replace with input-specified only
    const links = new Map(m.links);
    links.delete("lnk-effect-io");
    links.set("lnk-effect-in", {
      id: "lnk-effect-in", type: "effect" as const,
      source: "obj-x", target: "proc-main", source_state: "st-s1",
    } as any);
    m = { ...m, links };
    const resolved = resolveLinksForOpd(m, "opd-sd1");
    const effects = resolved.filter(r => r.link.id === "lnk-effect-in");
    expect(effects).toHaveLength(2);
  });
});
