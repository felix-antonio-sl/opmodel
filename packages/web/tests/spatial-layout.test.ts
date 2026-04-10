import { describe, expect, it } from "vitest";
import {
  addAppearance,
  addFan,
  addLink,
  addState,
  addThing,
  createModel,
  refineThing,
  isOk,
  type Link,
  type Model,
  type Thing,
} from "@opmodel/core";
import { findNonContainerOverlaps, findTightSpacing, findVisibleOrphans } from "../src/lib/visual-lint";
import {
  applyLayoutPatches,
  diffPatchedAppearances,
  mergeLayoutPatches,
  suggestLayoutForOpd,
  type AppearancePatch,
} from "../src/lib/spatial-layout";

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
  pinned = false,
  autoSizing: boolean | undefined = undefined,
): Model {
  const r = addAppearance(model, {
    thing,
    opd,
    x,
    y,
    w,
    h,
    ...(internal ? { internal: true } : {}),
    ...(pinned ? { pinned: true } : {}),
    ...(autoSizing !== undefined ? { auto_sizing: autoSizing } : {}),
  });
  if (!isOk(r)) throw new Error(r.error.message);
  return r.value;
}

function withLink(model: Model, link: Link): Model {
  const r = addLink(model, link);
  if (!isOk(r)) throw new Error(r.error.message);
  return r.value;
}

describe("spatial layout engine", () => {
  it("suggests branching control layout for in-zoom OPDs with diverging fans", () => {
    let m = createModel("Branch");
    m = withThing(m, { id: "proc-main", kind: "process", name: "Main", essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, "proc-main", "opd-sd", 100, 100, 200, 80);
    const ref = refineThing(m, "proc-main", "opd-sd", "in-zoom", "opd-sd1", "SD1");
    if (!isOk(ref)) throw new Error(ref.error.message);
    m = ref.value;
    for (const id of ["proc-sense", "proc-assess", "proc-alert", "proc-warning", "proc-brake"]) {
      m = withThing(m, { id, kind: "process", name: id, essence: "physical", affiliation: "systemic" });
      m = withAppearance(m, id, "opd-sd1", 0, 0, 120, 60, true);
    }
    for (const id of ["obj-left", "obj-right", "obj-threat"]) {
      m = withThing(m, { id, kind: "object", name: id, essence: "physical", affiliation: "systemic" });
      m = withAppearance(m, id, "opd-sd1", 0, 0, 120, 50);
    }
    m = withLink(m, { id: "l1", type: "agent", source: "obj-left", target: "proc-sense" });
    m = withLink(m, { id: "l2", type: "effect", source: "proc-assess", target: "obj-threat" });
    m = withLink(m, { id: "l3", type: "instrument", source: "obj-threat", target: "proc-alert" });
    m = withLink(m, { id: "l4", type: "instrument", source: "obj-threat", target: "proc-warning" });
    m = withLink(m, { id: "l5", type: "instrument", source: "obj-threat", target: "proc-brake" });
    m = withLink(m, { id: "l6", type: "result", source: "proc-warning", target: "obj-right" });
    const fan = addFan(m, { id: "fan-1", type: "xor", direction: "diverging", members: ["l3", "l4", "l5"] });
    if (!isOk(fan)) throw new Error(fan.error.message);
    m = fan.value;

    const suggestion = suggestLayoutForOpd(m, "opd-sd1");
    expect(suggestion.strategy).toBe("branching-control");
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd1")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    const ids = new Set(patched.map((a) => a.thing));
    const links = [...m.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
    expect(findNonContainerOverlaps(patched)).toEqual([]);
    expect(findVisibleOrphans(patched, links)).toEqual([]);
  });

  it("suggests sequential in-zoom layout with no visible overlap/orphans", () => {
    let m = createModel("Layout");
    m = withThing(m, { id: "proc-main", kind: "process", name: "Main", essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, "proc-main", "opd-sd", 100, 100, 200, 80);
    const ref = refineThing(m, "proc-main", "opd-sd", "in-zoom", "opd-sd1", "SD1");
    if (!isOk(ref)) throw new Error(ref.error.message);
    m = ref.value;
    m = withThing(m, { id: "proc-a", kind: "process", name: "A", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "proc-b", kind: "process", name: "B", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent", kind: "object", name: "Agent", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-output", kind: "object", name: "Output", essence: "physical", affiliation: "systemic" });

    m = withAppearance(m, "proc-a", "opd-sd1", 0, 0, 120, 60, true);
    m = withAppearance(m, "proc-b", "opd-sd1", 20, 20, 120, 60, true);
    m = withAppearance(m, "obj-agent", "opd-sd1", 10, 10, 120, 50);
    m = withAppearance(m, "obj-output", "opd-sd1", 20, 20, 120, 50);

    m = withLink(m, { id: "l1", type: "agent", source: "obj-agent", target: "proc-a" });
    m = withLink(m, { id: "l2", type: "result", source: "proc-b", target: "obj-output" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd1");
    expect(suggestion.strategy).toBe("in-zoom-sequential");
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd1")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    const ids = new Set(patched.map((a) => a.thing));
    const links = [...m.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
    expect(findNonContainerOverlaps(patched)).toEqual([]);
    expect(findVisibleOrphans(patched, links)).toEqual([]);
  });

  it("suggests unfold grid layout with no visible overlap/orphans", () => {
    let m = createModel("Layout");
    m = withThing(m, { id: "proc-main", kind: "process", name: "Main", essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, "proc-main", "opd-sd", 100, 100, 200, 80);
    const ref = refineThing(m, "proc-main", "opd-sd", "unfold", "opd-sd1", "SD1.1");
    if (!isOk(ref)) throw new Error(ref.error.message);
    m = ref.value;
    for (const id of ["proc-a", "proc-b", "proc-c", "proc-d"]) {
      m = withThing(m, { id, kind: "process", name: id, essence: "physical", affiliation: "systemic" });
      m = withAppearance(m, id, "opd-sd1", 0, 0, 120, 60, true);
    }
    m = withThing(m, { id: "obj-left", kind: "object", name: "Left", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-right", kind: "object", name: "Right", essence: "physical", affiliation: "environmental" });
    m = withAppearance(m, "obj-left", "opd-sd1", 10, 10, 120, 50);
    m = withAppearance(m, "obj-right", "opd-sd1", 20, 20, 120, 50);
    m = withLink(m, { id: "l1", type: "agent", source: "obj-left", target: "proc-a" });
    m = withLink(m, { id: "l2", type: "result", source: "proc-b", target: "obj-right" });
    m = withLink(m, { id: "l3", type: "instrument", source: "obj-right", target: "proc-c" });
    m = withLink(m, { id: "l4", type: "consumption", source: "obj-left", target: "proc-d" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd1");
    expect(suggestion.strategy).toBe("unfold-grid");
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd1")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    const ids = new Set(patched.map((a) => a.thing));
    const links = [...m.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
    expect(findNonContainerOverlaps(patched)).toEqual([]);
    expect(findVisibleOrphans(patched, links)).toEqual([]);
  });

  it("suggests structural cluster layout for structural OPDs", () => {
    let m = createModel("Structural");
    for (const [id, name] of [["obj-service", "Service"], ["obj-team", "Clinical Team"], ["obj-vehicle", "Vehicle"], ["obj-status", "Service Status"], ["obj-phone", "Telephone"], ["obj-stock", "Medication Stock"]] as const) {
      m = withThing(m, { id, kind: "object", name, essence: "physical", affiliation: "systemic" });
      m = withAppearance(m, id, "opd-sd", 0, 0, 100, 40);
    }
    m = withLink(m, { id: "agg-1", type: "aggregation", source: "obj-service", target: "obj-team" });
    m = withLink(m, { id: "agg-2", type: "aggregation", source: "obj-service", target: "obj-vehicle" });
    m = withLink(m, { id: "agg-3", type: "aggregation", source: "obj-service", target: "obj-phone" });
    m = withLink(m, { id: "agg-4", type: "aggregation", source: "obj-service", target: "obj-stock" });
    m = withLink(m, { id: "exh-1", type: "exhibition", source: "obj-service", target: "obj-status" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    expect(suggestion.strategy).toBe("structural-cluster");
    const parentPatch = suggestion.patches.find((p) => p.thingId === "obj-service")?.patch;
    const childPatches = ["obj-team", "obj-vehicle", "obj-status", "obj-phone", "obj-stock"]
      .map((id) => suggestion.patches.find((p) => p.thingId === id)?.patch)
      .filter(Boolean);
    const teamPatch = suggestion.patches.find((p) => p.thingId === "obj-team")?.patch;
    const vehiclePatch = suggestion.patches.find((p) => p.thingId === "obj-vehicle")?.patch;
    expect(parentPatch?.y).toBeLessThan(teamPatch?.y ?? 0);
    expect(teamPatch?.x).not.toBe(vehiclePatch?.x);
    const parentCenter = (parentPatch?.x ?? 0) + (parentPatch?.w ?? 0) / 2;
    const childrenMinX = Math.min(...childPatches.map((p) => p!.x ?? 0));
    const childrenMaxRight = Math.max(...childPatches.map((p) => (p!.x ?? 0) + (p!.w ?? 0)));
    expect(parentCenter).toBeGreaterThanOrEqual(childrenMinX);
    expect(parentCenter).toBeLessThanOrEqual(childrenMaxRight);
  });

  it("suggests balanced SD layout and auto-sizes stateful objects", () => {
    let m = createModel("SD");
    m = withThing(m, { id: "proc-care", kind: "process", name: "Clinical Care Coordination", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-nurse", kind: "object", name: "Advanced Practice Nurse", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-kit", kind: "object", name: "Monitoring Equipment Set", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-patient", kind: "object", name: "Patient Care Status", essence: "informatical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-record", kind: "object", name: "Clinical Record", essence: "informatical", affiliation: "systemic" });
    m = withAppearance(m, "proc-care", "opd-sd", 0, 0, 100, 40);
    m = withAppearance(m, "obj-nurse", "opd-sd", 0, 0, 100, 40);
    m = withAppearance(m, "obj-kit", "opd-sd", 0, 0, 100, 40);
    m = withAppearance(m, "obj-patient", "opd-sd", 0, 0, 100, 40);
    m = withAppearance(m, "obj-record", "opd-sd", 0, 0, 100, 40);
    const s1 = addState(m, { id: "st-1", parent: "obj-patient", name: "hemodynamically stable" });
    if (!isOk(s1)) throw new Error(s1.error.message);
    m = s1.value;
    const s2 = addState(m, { id: "st-2", parent: "obj-patient", name: "requires emergency escalation" });
    if (!isOk(s2)) throw new Error(s2.error.message);
    m = s2.value;
    m = withLink(m, { id: "l1", type: "agent", source: "obj-nurse", target: "proc-care" });
    m = withLink(m, { id: "l2", type: "instrument", source: "obj-kit", target: "proc-care" });
    m = withLink(m, { id: "l3", type: "result", source: "proc-care", target: "obj-record" });
    m = withLink(m, { id: "l4", type: "consumption", source: "obj-patient", target: "proc-care" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    expect(suggestion.strategy).toBe("sd-balanced");
    const patientPatch = suggestion.patches.find((p) => p.thingId === "obj-patient")?.patch;
    expect((patientPatch?.w ?? 0)).toBeGreaterThan(100);
  });

  it("keeps mixed SD OPDs on sd-balanced when structure is not dominant", () => {
    let m = createModel("Mixed SD");
    for (const [id, kind, name] of [
      ["proc-care", "process", "Clinical Care"] as const,
      ["obj-nurse", "object", "Nurse"] as const,
      ["obj-kit", "object", "Equipment"] as const,
      ["obj-record", "object", "Record"] as const,
      ["obj-patient-status", "object", "Patient Status"] as const,
    ]) {
      m = withThing(m, { id, kind, name, essence: "physical", affiliation: "systemic" });
      m = withAppearance(m, id, "opd-sd", 0, 0, 100, 40);
    }
    m = withLink(m, { id: "l1", type: "agent", source: "obj-nurse", target: "proc-care" });
    m = withLink(m, { id: "l2", type: "instrument", source: "obj-kit", target: "proc-care" });
    m = withLink(m, { id: "l3", type: "result", source: "proc-care", target: "obj-record" });
    m = withLink(m, { id: "l4", type: "exhibition", source: "obj-record", target: "obj-patient-status" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    expect(suggestion.strategy).toBe("sd-balanced");
  });

  it("auto-sizes duration processes and computational stateful objects", () => {
    let m = createModel("Sizing");
    m = withThing(m, {
      id: "proc-monitor",
      kind: "process",
      name: "Advanced Continuous Monitoring",
      essence: "physical",
      affiliation: "systemic",
      duration: { min: 15, nominal: 30, max: 90, unit: "min" },
    });
    m = withThing(m, {
      id: "obj-signal",
      kind: "object",
      name: "Physiological Signal Index",
      essence: "informatical",
      affiliation: "systemic",
      computational: { value: 0, value_type: "float", unit: "%" },
    });
    m = withThing(m, { id: "obj-nurse", kind: "object", name: "Nurse", essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, "proc-monitor", "opd-sd", 0, 0, 120, 40);
    m = withAppearance(m, "obj-signal", "opd-sd", 0, 0, 120, 40);
    m = withAppearance(m, "obj-nurse", "opd-sd", 0, 0, 120, 40);
    const s1 = addState(m, { id: "sig-ok", parent: "obj-signal", name: "within configured tolerance" });
    if (!isOk(s1)) throw new Error(s1.error.message);
    m = s1.value;
    const s2 = addState(m, { id: "sig-alert", parent: "obj-signal", name: "persistent multi-factor instability" });
    if (!isOk(s2)) throw new Error(s2.error.message);
    m = s2.value;
    m = withLink(m, { id: "l1", type: "agent", source: "obj-nurse", target: "proc-monitor" });
    m = withLink(m, { id: "l2", type: "result", source: "proc-monitor", target: "obj-signal" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    const procPatch = suggestion.patches.find((p) => p.thingId === "proc-monitor")?.patch;
    const signalPatch = suggestion.patches.find((p) => p.thingId === "obj-signal")?.patch;
    expect((procPatch?.h ?? 0)).toBeGreaterThanOrEqual(72);
    expect((procPatch?.w ?? 0)).toBeGreaterThan(180);
    expect((signalPatch?.h ?? 0)).toBeGreaterThanOrEqual(68);
    expect((signalPatch?.w ?? 0)).toBeGreaterThan(180);
  });

  it("applies a relaxation pass to avoid visible overlaps after layout", () => {
    let m = createModel("Relax");
    m = withThing(m, { id: "proc-main", kind: "process", name: "Main Coordination", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent-a", kind: "object", name: "Agent A", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent-b", kind: "object", name: "Agent B", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-result-a", kind: "object", name: "Result A", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-result-b", kind: "object", name: "Result B", essence: "physical", affiliation: "systemic" });
    for (const id of ["proc-main", "obj-agent-a", "obj-agent-b", "obj-result-a", "obj-result-b"]) {
      m = withAppearance(m, id, "opd-sd", 0, 0, 120, 40);
    }
    m = withLink(m, { id: "l1", type: "agent", source: "obj-agent-a", target: "proc-main" });
    m = withLink(m, { id: "l2", type: "agent", source: "obj-agent-b", target: "proc-main" });
    m = withLink(m, { id: "l3", type: "result", source: "proc-main", target: "obj-result-a" });
    m = withLink(m, { id: "l4", type: "result", source: "proc-main", target: "obj-result-b" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    expect(findNonContainerOverlaps(patched)).toEqual([]);
  });

  it("uses visual findings to reduce tight spacing after layout", () => {
    let m = createModel("Tight");
    m = withThing(m, { id: "proc-main", kind: "process", name: "Main Coordination", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent-a", kind: "object", name: "Agent Alpha", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent-b", kind: "object", name: "Agent Beta", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent-c", kind: "object", name: "Agent Gamma", essence: "physical", affiliation: "systemic" });
    for (const id of ["proc-main", "obj-agent-a", "obj-agent-b", "obj-agent-c"]) {
      m = withAppearance(m, id, "opd-sd", 0, 0, 120, 40);
    }
    m = withLink(m, { id: "l1", type: "agent", source: "obj-agent-a", target: "proc-main" });
    m = withLink(m, { id: "l2", type: "agent", source: "obj-agent-b", target: "proc-main" });
    m = withLink(m, { id: "l3", type: "agent", source: "obj-agent-c", target: "proc-main" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    expect(findTightSpacing(patched).length).toBe(0);
  });

  it("keeps left-lane agents on the left during relaxation", () => {
    let m = createModel("Lane aware");
    m = withThing(m, { id: "proc-main", kind: "process", name: "Main Coordination", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent-a", kind: "object", name: "Left Agent A", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent-b", kind: "object", name: "Left Agent B", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-result", kind: "object", name: "Result", essence: "physical", affiliation: "systemic" });
    for (const id of ["proc-main", "obj-agent-a", "obj-agent-b", "obj-result"]) {
      m = withAppearance(m, id, "opd-sd", 0, 0, 120, 40);
    }
    m = withLink(m, { id: "l1", type: "agent", source: "obj-agent-a", target: "proc-main" });
    m = withLink(m, { id: "l2", type: "agent", source: "obj-agent-b", target: "proc-main" });
    m = withLink(m, { id: "l3", type: "result", source: "proc-main", target: "obj-result" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    const proc = patched.find((a) => a.thing === "proc-main")!;
    const centerX = proc.x + proc.w / 2;
    const leftA = patched.find((a) => a.thing === "obj-agent-a")!;
    const leftB = patched.find((a) => a.thing === "obj-agent-b")!;
    expect(leftA.x + leftA.w / 2).toBeLessThan(centerX);
    expect(leftB.x + leftB.w / 2).toBeLessThan(centerX);
  });

  it("keeps center-band process within bounded lateral drift", () => {
    let m = createModel("Center band");
    m = withThing(m, { id: "proc-main", kind: "process", name: "Main Coordination", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-left-a", kind: "object", name: "Left A", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-left-b", kind: "object", name: "Left B", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-right-a", kind: "object", name: "Right A", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-right-b", kind: "object", name: "Right B", essence: "physical", affiliation: "systemic" });
    for (const id of ["proc-main", "obj-left-a", "obj-left-b", "obj-right-a", "obj-right-b"]) {
      m = withAppearance(m, id, "opd-sd", 0, 0, 120, 40);
    }
    m = withLink(m, { id: "l1", type: "agent", source: "obj-left-a", target: "proc-main" });
    m = withLink(m, { id: "l2", type: "agent", source: "obj-left-b", target: "proc-main" });
    m = withLink(m, { id: "l3", type: "result", source: "proc-main", target: "obj-right-a" });
    m = withLink(m, { id: "l4", type: "result", source: "proc-main", target: "obj-right-b" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    const proc = patched.find((a) => a.thing === "proc-main")!;
    expect(proc.x).toBeGreaterThanOrEqual(260);
    expect(proc.x).toBeLessThanOrEqual(560);
  });

  it("merges per-thing layout patches while ignoring pinned nodes", () => {
    const apps = [
      { thing: "proc", opd: "opd-sd", x: 10, y: 20, w: 120, h: 40 },
      { thing: "agent", opd: "opd-sd", x: 5, y: 8, w: 100, h: 40, pinned: true },
    ];
    const patches: AppearancePatch[] = [
      { thingId: "proc", opdId: "opd-sd", patch: { x: 100 } },
      { thingId: "proc", opdId: "opd-sd", patch: { y: 140, internal: true } },
      { thingId: "agent", opdId: "opd-sd", patch: { x: 999 } },
    ];

    const merged = mergeLayoutPatches(apps, patches);
    expect(merged.get("proc")?.patch).toEqual({ x: 100, y: 140, internal: true });
    expect(merged.has("agent")).toBe(false);
  });

  it("applies layout patches without resizing auto_sizing=false nodes", () => {
    let m = createModel("Apply patches");
    m = withThing(m, { id: "proc-monitor", kind: "process", name: "Advanced Continuous Monitoring", essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, "proc-monitor", "opd-sd", 5, 7, 120, 40, false, false, false);

    const [app] = [...m.appearances.values()];
    const merged = new Map<string, AppearancePatch>([
      ["proc-monitor", { thingId: "proc-monitor", opdId: "opd-sd", patch: { x: 50, y: 60, w: 400, h: 180 } }],
    ]);

    const [patched] = applyLayoutPatches(m, [app!], merged);
    expect(patched?.x).toBe(50);
    expect(patched?.y).toBe(60);
    expect(patched?.w).toBe(120);
    expect(patched?.h).toBe(40);
  });

  it("diffs patched appearances preserving internal changes", () => {
    const originalApps = [
      { thing: "obj-a", opd: "opd-sd", x: 10, y: 20, w: 100, h: 50 },
      { thing: "obj-b", opd: "opd-sd", x: 200, y: 20, w: 100, h: 50, pinned: true },
    ];
    const patchedApps = [
      { thing: "obj-a", opd: "opd-sd", x: 40, y: 60, w: 110, h: 50, internal: true },
      { thing: "obj-b", opd: "opd-sd", x: 220, y: 20, w: 100, h: 50, pinned: true },
    ];

    const diff = diffPatchedAppearances(originalApps, patchedApps);
    expect(diff).toEqual([
      {
        thingId: "obj-a",
        opdId: "opd-sd",
        patch: { x: 40, y: 60, w: 110, h: 50, internal: true },
      },
    ]);
  });

  it("respects pinned nodes during auto-layout and relaxation", () => {
    let m = createModel("Pinned");
    m = withThing(m, { id: "proc-main", kind: "process", name: "Main Coordination", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent", kind: "object", name: "Pinned Agent", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-result", kind: "object", name: "Result", essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, "proc-main", "opd-sd", 0, 0, 120, 40);
    m = withAppearance(m, "obj-agent", "opd-sd", 17, 23, 120, 40, false, true);
    m = withAppearance(m, "obj-result", "opd-sd", 0, 0, 120, 40);
    m = withLink(m, { id: "l1", type: "agent", source: "obj-agent", target: "proc-main" });
    m = withLink(m, { id: "l2", type: "result", source: "proc-main", target: "obj-result" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    const agentPatch = suggestion.patches.find((p) => p.thingId === "obj-agent");
    expect(agentPatch).toBeUndefined();
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    const pinnedAgent = patched.find((a) => a.thing === "obj-agent");
    expect(pinnedAgent?.x).toBe(17);
    expect(pinnedAgent?.y).toBe(23);
  });

  it("respects auto_sizing=false while still allowing repositioning", () => {
    let m = createModel("AutoSizing");
    m = withThing(m, {
      id: "proc-monitor",
      kind: "process",
      name: "Advanced Continuous Monitoring",
      essence: "physical",
      affiliation: "systemic",
      duration: { min: 15, nominal: 30, max: 90, unit: "min" },
    });
    m = withThing(m, {
      id: "obj-signal",
      kind: "object",
      name: "Physiological Signal Index",
      essence: "informatical",
      affiliation: "systemic",
      computational: { value: 0, value_type: "float", unit: "%" },
    });
    m = withThing(m, { id: "obj-nurse", kind: "object", name: "Nurse", essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, "proc-monitor", "opd-sd", 5, 7, 120, 40, false, false, false);
    m = withAppearance(m, "obj-signal", "opd-sd", 0, 0, 120, 40);
    m = withAppearance(m, "obj-nurse", "opd-sd", 0, 0, 120, 40);
    m = withLink(m, { id: "l1", type: "agent", source: "obj-nurse", target: "proc-monitor" });
    m = withLink(m, { id: "l2", type: "result", source: "proc-monitor", target: "obj-signal" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    const procPatch = suggestion.patches.find((p) => p.thingId === "proc-monitor")?.patch;
    expect(procPatch).toBeDefined();
    expect(procPatch?.x).not.toBeUndefined();
    expect(procPatch?.w).toBeUndefined();
    expect(procPatch?.h).toBeUndefined();
  });
});
