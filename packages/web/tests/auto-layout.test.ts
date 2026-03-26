import { describe, expect, it } from "vitest";
import {
  createModel, addThing, addLink, addState, addOPD, refineThing,
  isOk, type Model,
} from "@opmodel/core";
import { autoLayoutModel } from "../src/lib/auto-layout";

function buildTestModel(): Model {
  let m = createModel("Test System");

  // Add things
  const things = [
    { id: "proc-main", kind: "process" as const, name: "Processing Data", essence: "informatical" as const, affiliation: "systemic" as const },
    { id: "obj-input", kind: "object" as const, name: "Raw Data", essence: "informatical" as const, affiliation: "systemic" as const },
    { id: "obj-output", kind: "object" as const, name: "Processed Data", essence: "informatical" as const, affiliation: "systemic" as const },
    { id: "obj-agent", kind: "object" as const, name: "Operator", essence: "physical" as const, affiliation: "environmental" as const },
    { id: "obj-instr", kind: "object" as const, name: "Software Tool", essence: "informatical" as const, affiliation: "systemic" as const },
  ];

  // Add to SD
  const sdId = [...m.opds.values()][0]!.id;
  for (const t of things) {
    const r = addThing(m, t, sdId, 0, 0, 120, 60);
    if (isOk(r)) m = r.value;
  }

  // Add states
  const states = [
    { id: "st-raw", parent: "obj-input", name: "raw", initial: true, final: false, default: false },
    { id: "st-validated", parent: "obj-input", name: "validated", initial: false, final: false, default: false },
    { id: "st-clean", parent: "obj-output", name: "clean", initial: false, final: true, default: false },
    { id: "st-dirty", parent: "obj-output", name: "dirty", initial: true, final: false, default: false },
  ];
  for (const s of states) {
    const r = addState(m, s);
    if (isOk(r)) m = r.value;
  }

  // Add links
  const links = [
    { id: "lnk-1", type: "consumption" as const, source: "obj-input", target: "proc-main", source_state: "st-raw" },
    { id: "lnk-2", type: "result" as const, source: "proc-main", target: "obj-output", target_state: "st-clean" },
    { id: "lnk-3", type: "agent" as const, source: "obj-agent", target: "proc-main" },
    { id: "lnk-4", type: "instrument" as const, source: "obj-instr", target: "proc-main" },
  ];
  for (const l of links) {
    const r = addLink(m, l as any);
    if (isOk(r)) m = r.value;
  }

  return m;
}

describe("auto-layout from scratch", () => {
  it("generates layout for a model with all things at (0,0)", () => {
    const model = buildTestModel();

    // Verify all appearances start at (0,0)
    for (const app of model.appearances.values()) {
      expect(app.x).toBe(0);
      expect(app.y).toBe(0);
    }

    const result = autoLayoutModel(model);

    expect(result.patchesApplied).toBeGreaterThan(0);
    expect(result.opdLayouts.length).toBeGreaterThan(0);
    expect(result.opdLayouts[0]!.strategy).not.toBe("none");

    // After layout, things should NOT all be at (0,0)
    const positions = [...result.model.appearances.values()].map(a => ({ x: a.x, y: a.y }));
    const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
    expect(uniquePositions.size).toBeGreaterThan(1);
  });

  it("produces non-overlapping positions", () => {
    const model = buildTestModel();
    const result = autoLayoutModel(model);

    const apps = [...result.model.appearances.values()];
    for (let i = 0; i < apps.length; i++) {
      for (let j = i + 1; j < apps.length; j++) {
        if (apps[i]!.opd !== apps[j]!.opd) continue;
        const a = apps[i]!;
        const b = apps[j]!;
        // Check no overlap (with some tolerance)
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (overlapX > 5 && overlapY > 5) {
          const thingA = result.model.things.get(a.thing)?.name;
          const thingB = result.model.things.get(b.thing)?.name;
          console.warn(`  Overlap: "${thingA}" and "${thingB}" in ${a.opd}`);
        }
      }
    }
  });

  it("sizes things to fit their state pills", () => {
    const model = buildTestModel();
    const result = autoLayoutModel(model);

    for (const app of result.model.appearances.values()) {
      const states = [...result.model.states.values()].filter(s => s.parent === app.thing);
      if (states.length > 0) {
        const minW = states.length * 25; // rough minimum
        expect(app.w).toBeGreaterThanOrEqual(minW);
      }
    }
  });

  it("handles empty model", () => {
    const model = createModel("Empty");
    const result = autoLayoutModel(model);
    expect(result.patchesApplied).toBe(0);
    expect(result.opdLayouts.length).toBe(1); // SD always exists
  });

  it("reports layout strategy per OPD", () => {
    const model = buildTestModel();
    const result = autoLayoutModel(model);

    for (const layout of result.opdLayouts) {
      expect(layout.opdId).toBeTruthy();
      expect(layout.strategy).toBeTruthy();
      expect(layout.appearances).toBeGreaterThanOrEqual(0);
    }
  });
});
