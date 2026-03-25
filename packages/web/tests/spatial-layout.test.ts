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
import { findNonContainerOverlaps, findVisibleOrphans } from "../src/lib/visual-lint";
import { suggestLayoutForOpd } from "../src/lib/spatial-layout";

function withThing(model: Model, thing: Thing): Model {
  const r = addThing(model, thing);
  if (!isOk(r)) throw new Error(r.error.message);
  return r.value;
}

function withAppearance(model: Model, thing: string, opd: string, x: number, y: number, w: number, h: number, internal = false): Model {
  const r = addAppearance(model, { thing, opd, x, y, w, h, ...(internal ? { internal: true } : {}) });
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
    for (const [id, name] of [["obj-service", "Service"], ["obj-team", "Clinical Team"], ["obj-vehicle", "Vehicle"], ["obj-status", "Service Status"]] as const) {
      m = withThing(m, { id, kind: "object", name, essence: "physical", affiliation: "systemic" });
      m = withAppearance(m, id, "opd-sd", 0, 0, 100, 40);
    }
    m = withLink(m, { id: "agg-1", type: "aggregation", source: "obj-service", target: "obj-team" });
    m = withLink(m, { id: "agg-2", type: "aggregation", source: "obj-service", target: "obj-vehicle" });
    m = withLink(m, { id: "exh-1", type: "exhibition", source: "obj-service", target: "obj-status" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    expect(suggestion.strategy).toBe("structural-cluster");
    const parentPatch = suggestion.patches.find((p) => p.thingId === "obj-service")?.patch;
    const childPatch = suggestion.patches.find((p) => p.thingId === "obj-team")?.patch;
    expect(parentPatch?.y).toBeLessThan(childPatch?.y ?? 0);
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
});
