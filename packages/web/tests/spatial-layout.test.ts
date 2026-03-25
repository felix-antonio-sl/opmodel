import { describe, expect, it } from "vitest";
import {
  addAppearance,
  addLink,
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
});
