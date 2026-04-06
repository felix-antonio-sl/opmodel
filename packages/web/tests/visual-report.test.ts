import { describe, expect, it } from "vitest";
import { createModel } from "@opmodel/core";
import { buildVisualReport } from "../src/lib/visual-report";

describe("visual-report", () => {
  it("builds per-OPD reports through projection-backed slices", () => {
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

    const report = buildVisualReport(model);
    const sd1 = report.opds.find((r) => r.opdId === "opd-sd1");

    expect(sd1).toBeDefined();
    expect(sd1?.findings).toBeDefined();
    expect(sd1?.score).toBeGreaterThanOrEqual(0);
    expect(sd1?.grade).toBeDefined();
  });
});
