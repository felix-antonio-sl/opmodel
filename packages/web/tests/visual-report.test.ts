import { describe, expect, it } from "vitest";
import { addAppearance, addThing, createModel, isOk, refineThing } from "@opmodel/core";
import { buildVisualReport } from "../src/lib/visual-report";
import { buildEffectiveVisualSlice, effectiveVisualLinks } from "../src/lib/projection-view";

describe("visual-report", () => {
  it("ignores hidden placeholder subprocesses in visual findings", () => {
    let model = createModel("Visual Report Placeholder Filter");

    let r = addThing(model, {
      id: "proc-main",
      kind: "process",
      name: "Main Coordinating",
      essence: "informatical",
      affiliation: "systemic",
    });
    expect(isOk(r)).toBe(true);
    model = isOk(r) ? r.value : model;

    r = addAppearance(model, {
      thing: "proc-main",
      opd: "opd-sd",
      x: 100,
      y: 100,
      w: 180,
      h: 80,
    });
    expect(isOk(r)).toBe(true);
    model = isOk(r) ? r.value : model;

    const refined = refineThing(model, "proc-main", "opd-sd", "in-zoom", "opd-sd1", "SD1");
    expect(isOk(refined)).toBe(true);
    model = isOk(refined) ? refined.value : model;

    for (const [id, name, y] of [["proc-a", "A", 100], ["proc-b", "B", 220]] as const) {
      r = addThing(model, {
        id,
        kind: "process",
        name,
        essence: "informatical",
        affiliation: "systemic",
      });
      expect(isOk(r)).toBe(true);
      model = isOk(r) ? r.value : model;

      r = addAppearance(model, {
        thing: id,
        opd: "opd-sd1",
        x: 220,
        y,
        w: 140,
        h: 60,
        internal: true,
      });
      expect(isOk(r)).toBe(true);
      model = isOk(r) ? r.value : model;
    }

    const report = buildVisualReport(model);
    const sd1 = report.opds.find((entry) => entry.opdId === "opd-sd1");
    expect(sd1).toBeDefined();
    expect(sd1?.findings.some((finding) => finding.summary.includes("opd-sd1-sub-"))).toBe(false);
    expect(sd1?.findings.some((finding) => finding.primaryEntity?.startsWith("opd-sd1-sub-") ?? false)).toBe(false);
  });

  it("builds per-OPD reports through the same effective visual slice used by visual consumers", () => {
    const model = createModel("Visual Report Test");

    model.things.set("proc-parent", {
      id: "proc-parent",
      kind: "process",
      name: "Parent",
      essence: "physical",
      affiliation: "systemic",
    });
    model.things.set("proc-child", {
      id: "proc-child",
      kind: "process",
      name: "Child",
      essence: "physical",
      affiliation: "systemic",
    });
    model.opds.set("opd-sd1", {
      id: "opd-sd1",
      name: "SD1",
      opd_type: "hierarchical",
      parent_opd: "opd-sd",
      refines: "proc-parent",
      refinement_type: "in-zoom",
    });
    model.appearances.set("proc-parent::opd-sd1", {
      thing: "proc-parent",
      opd: "opd-sd1",
      x: 10,
      y: 10,
      w: 120,
      h: 60,
    });
    model.appearances.set("proc-child::opd-sd1", {
      thing: "proc-child",
      opd: "opd-sd1",
      x: 10,
      y: 120,
      w: 120,
      h: 60,
    });

    const slice = buildEffectiveVisualSlice(model, "opd-sd1");
    const report = buildVisualReport(model);
    const sd1 = report.opds.find((r) => r.opdId === "opd-sd1");

    expect(sd1).toBeDefined();
    expect(sd1?.findings).toBeDefined();
    expect(sd1?.score).toBeGreaterThanOrEqual(0);
    expect(sd1?.grade).toBeDefined();
    expect(effectiveVisualLinks(slice).every((link) => link.source === "proc-parent" || link.target === "proc-parent" || link.source === "proc-child" || link.target === "proc-child")).toBe(true);
  });
});
