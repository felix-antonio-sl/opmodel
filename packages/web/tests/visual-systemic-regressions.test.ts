import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  compileOplDocuments,
  createModel,
  addThing,
  addAppearance,
  addLink,
  isOk,
  parseOplDocuments,
  refineThing,
  type Link,
  type Model,
  type Thing,
} from "@opmodel/core";
import { suggestLayoutForOpd } from "../src/lib/spatial-layout";
import { findNonContainerOverlaps } from "../src/lib/visual-lint";
import { autoLayoutModel } from "../src/lib/auto-layout";
import { buildVisualReport } from "../src/lib/visual-report";
import { buildPatchableOpdProjectionSlice } from "../src/lib/projection-view";

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

describe("visual systemic regressions", () => {
  it("does not treat the refinee container as an external lane node in in-zoom layouts", () => {
    let m = createModel("Container stays put");
    m = withThing(m, { id: "proc-main", kind: "process", name: "Main", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "proc-a", kind: "process", name: "A", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "proc-b", kind: "process", name: "B", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent", kind: "object", name: "Agent", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-result", kind: "object", name: "Result", essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, "proc-main", "opd-sd", 100, 100, 180, 80);
    const refined = refineThing(m, "proc-main", "opd-sd", "in-zoom", "opd-sd1", "SD1");
    if (!isOk(refined)) throw new Error(refined.error.message);
    m = refined.value;
    m = withAppearance(m, "proc-a", "opd-sd1", 0, 0, 120, 60, true);
    m = withAppearance(m, "proc-b", "opd-sd1", 0, 0, 120, 60, true);
    m = withAppearance(m, "obj-agent", "opd-sd1", 0, 0, 120, 50);
    m = withAppearance(m, "obj-result", "opd-sd1", 0, 0, 120, 50);
    m = withLink(m, { id: "l1", type: "agent", source: "obj-agent", target: "proc-a" });
    m = withLink(m, { id: "l2", type: "result", source: "proc-b", target: "obj-result" });

    const slice = buildPatchableOpdProjectionSlice(m, "opd-sd1");
    const containerInSlice = slice.appearances.find((a) => a.thing === "proc-main");
    expect(containerInSlice?.internal).toBe(true);

    const suggestion = suggestLayoutForOpd(m, "opd-sd1");
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd1")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    expect(findNonContainerOverlaps(patched)).toEqual([]);
  });

  it("lays out multiple SD processes without collapsing them onto the same anchor", () => {
    let m = createModel("SD process spread");
    for (const [id, name] of [["proc-main", "Main Coordination"], ["proc-a", "Diagnose"], ["proc-b", "Treat"], ["proc-c", "Discharge"]] as const) {
      m = withThing(m, { id, kind: "process", name, essence: "physical", affiliation: "systemic" });
      m = withAppearance(m, id, "opd-sd", 0, 0, 120, 40);
    }
    m = withThing(m, { id: "obj-system", kind: "object", name: "System", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-agent", kind: "object", name: "Agent", essence: "physical", affiliation: "systemic" });
    m = withThing(m, { id: "obj-result", kind: "object", name: "Result", essence: "physical", affiliation: "systemic" });
    m = withAppearance(m, "obj-system", "opd-sd", 0, 0, 120, 40);
    m = withAppearance(m, "obj-agent", "opd-sd", 0, 0, 120, 40);
    m = withAppearance(m, "obj-result", "opd-sd", 0, 0, 120, 40);
    m = withLink(m, { id: "exh", type: "exhibition", source: "obj-system", target: "proc-main" });
    m = withLink(m, { id: "ag", type: "agent", source: "obj-agent", target: "proc-main" });
    m = withLink(m, { id: "r1", type: "result", source: "proc-a", target: "obj-result" });
    m = withLink(m, { id: "r2", type: "result", source: "proc-b", target: "obj-result" });
    m = withLink(m, { id: "r3", type: "result", source: "proc-c", target: "obj-result" });

    const suggestion = suggestLayoutForOpd(m, "opd-sd");
    const patched = [...m.appearances.values()]
      .filter((a) => a.opd === "opd-sd")
      .map((a) => {
        const patch = suggestion.patches.find((p) => p.thingId === a.thing)?.patch;
        return patch ? { ...a, ...patch } : a;
      });
    expect(findNonContainerOverlaps(patched)).toEqual([]);
  });

  it("improves the stress visual report enough to clear catastrophic SD/SD1 collapse", () => {
    const opl = readFileSync(new URL("../../../tests/stress-test-max-complexity.opl", import.meta.url), "utf8");
    const parsed = parseOplDocuments(opl);
    if (!parsed.ok) throw new Error(parsed.error.message);
    const compiled = compileOplDocuments(parsed.value, { ignoreUnsupported: true });
    if (!compiled.ok) throw new Error(compiled.error.message);
    const laidOut = autoLayoutModel(compiled.value).model;
    const report = buildVisualReport(laidOut);
    const byName = new Map(report.opds.map((opd) => [opd.name, opd]));
    expect(byName.get("SD")?.errors ?? 99).toBeLessThanOrEqual(1);
    expect(byName.get("SD1")?.errors ?? 99).toBeLessThanOrEqual(1);
    expect(byName.get("SD")?.score ?? 0).toBeGreaterThanOrEqual(75);
    expect(byName.get("SD1")?.score ?? 0).toBeGreaterThanOrEqual(75);
  });
});
