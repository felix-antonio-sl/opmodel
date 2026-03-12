import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addOPD, addAppearance, addLink, refineThing, removeThing, validate } from "../src/api";

function unwrap<T, E>(result: { ok: boolean; value?: T; error?: E }): T {
  if (!result.ok) throw new Error(`Expected ok, got error: ${JSON.stringify((result as any).error)}`);
  return result.value as T;
}

function buildTestModel() {
  let m = createModel("test");
  // Note: createModel already creates "opd-sd" (SD), so we don't add it again
  m = unwrap(addThing(m, { id: "proc-make-coffee", kind: "process", name: "Making Coffee", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-beans", kind: "object", name: "Coffee Beans", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-sugar", kind: "object", name: "Sugar", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addAppearance(m, { thing: "proc-make-coffee", opd: "opd-sd", x: 100, y: 100, w: 150, h: 80 }));
  m = unwrap(addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 60 }));
  m = unwrap(addAppearance(m, { thing: "obj-beans", opd: "opd-sd", x: 200, y: 50, w: 120, h: 60 }));
  m = unwrap(addAppearance(m, { thing: "obj-sugar", opd: "opd-sd", x: 350, y: 50, w: 120, h: 60 }));
  m = unwrap(addLink(m, { id: "lnk-1", type: "effect", source: "obj-water", target: "proc-make-coffee" }));
  m = unwrap(addLink(m, { id: "lnk-2", type: "consumption", source: "obj-beans", target: "proc-make-coffee" }));
  return m;
}

describe("refineThing", () => {
  describe("in-zoom", () => {
    it("creates child OPD with correct fields", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(true);
      const model = unwrap(result);
      const opd = model.opds.get("opd-sd1");
      expect(opd).toBeDefined();
      expect(opd!.opd_type).toBe("hierarchical");
      expect(opd!.parent_opd).toBe("opd-sd");
      expect(opd!.refines).toBe("proc-make-coffee");
      expect(opd!.refinement_type).toBe("in-zoom");
      expect(opd!.name).toBe("SD1");
    });

    it("creates external appearances for connected things only", () => {
      const m = buildTestModel();
      const model = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      const waterApp = model.appearances.get("obj-water::opd-sd1");
      expect(waterApp).toBeDefined();
      expect(waterApp!.internal).toBe(false);
      const beansApp = model.appearances.get("obj-beans::opd-sd1");
      expect(beansApp).toBeDefined();
      expect(beansApp!.internal).toBe(false);
      expect(model.appearances.has("obj-sugar::opd-sd1")).toBe(false);
    });

    it("creates internal appearance for refined thing", () => {
      const m = buildTestModel();
      const model = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      const app = model.appearances.get("proc-make-coffee::opd-sd1");
      expect(app).toBeDefined();
      expect(app!.internal).toBe(true);
    });

    it("returns correct total appearances count", () => {
      const m = buildTestModel();
      const model = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      expect(model.appearances.size).toBe(7);
    });
  });

  describe("pre-conditions", () => {
    it("rejects non-existent thing", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-nonexistent", "opd-sd", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("NOT_FOUND");
    });

    it("rejects non-existent parent OPD", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-make-coffee", "opd-nonexistent", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("NOT_FOUND");
    });

    it("rejects thing without appearance in parent OPD", () => {
      let m = buildTestModel();
      m = unwrap(addThing(m, { id: "obj-orphan", kind: "object", name: "Orphan", essence: "physical", affiliation: "systemic" }));
      const result = refineThing(m, "obj-orphan", "opd-sd", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("NOT_FOUND");
    });

    it("rejects duplicate refinement", () => {
      const m = buildTestModel();
      const m2 = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      const result = refineThing(m2, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd2", "SD2");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("ALREADY_REFINED");
    });

    it("rejects duplicate child OPD ID (I-08)", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("I-08");
    });

    it("rejects refinement from view OPD", () => {
      let m = buildTestModel();
      m = unwrap(addOPD(m, { id: "opd-view", name: "View1", opd_type: "view", parent_opd: null }));
      m = unwrap(addAppearance(m, { thing: "proc-make-coffee", opd: "opd-view", x: 0, y: 0, w: 100, h: 50 }));
      const result = refineThing(m, "proc-make-coffee", "opd-view", "in-zoom", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("INVALID_REFINEMENT");
    });

    it("rejects unfold on process (only objects)", () => {
      const m = buildTestModel();
      const result = refineThing(m, "proc-make-coffee", "opd-sd", "unfold", "opd-sd1", "SD1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("INVALID_REFINEMENT");
    });

    it("I-REFINE-EXT: rejects refining external appearance (pullback projection)", () => {
      const m = buildTestModel();
      // In-zoom Making Coffee from SD → Water appears as external in SD1
      const m2 = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      const waterApp = m2.appearances.get("obj-water::opd-sd1");
      expect(waterApp?.internal).toBe(false);
      // Try to refine Water from SD1 — should be blocked
      const result = refineThing(m2, "obj-water", "opd-sd1", "unfold", "opd-sd1-1", "SD1.1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("INVALID_REFINEMENT");
      expect((result as any).error.message).toContain("external");
    });

    it("I-REFINE-CYCLE: rejects refining container from within its own refinement", () => {
      const m = buildTestModel();
      // In-zoom Making Coffee from SD → Making Coffee is internal container in SD1
      const m2 = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      // Try to in-zoom Making Coffee again from SD1 — circular
      const result = refineThing(m2, "proc-make-coffee", "opd-sd1", "in-zoom", "opd-sd1-1", "SD1.1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("INVALID_REFINEMENT");
      expect((result as any).error.message).toContain("refinement tree");
    });

    it("I-REFINE-CYCLE: rejects refining from nested descendant of refinement", () => {
      let m = buildTestModel();
      // In-zoom Making Coffee from SD → creates SD1
      m = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      // Add a sub-process Grinding inside SD1
      m = unwrap(addThing(m, { id: "proc-grind", kind: "process", name: "Grinding", essence: "physical", affiliation: "systemic" }));
      m = unwrap(addAppearance(m, { thing: "proc-grind", opd: "opd-sd1", x: 50, y: 50, w: 120, h: 60, internal: true }));
      // In-zoom Grinding from SD1 → creates SD1.1
      m = unwrap(refineThing(m, "proc-grind", "opd-sd1", "in-zoom", "opd-sd1-1", "SD1.1"));
      // Making Coffee appears as external in SD1.1 (if it has an appearance there)
      // Even if it had an internal appearance, trying to refine it should fail
      // because SD1 (ancestor of SD1.1) refines Making Coffee
      m = unwrap(addAppearance(m, { thing: "proc-make-coffee", opd: "opd-sd1-1", x: 0, y: 0, w: 100, h: 50, internal: true }));
      const result = refineThing(m, "proc-make-coffee", "opd-sd1-1", "in-zoom", "opd-sd1-1-1", "SD1.1.1");
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe("INVALID_REFINEMENT");
    });

    it("allows refining a different thing from within a refinement tree", () => {
      let m = buildTestModel();
      // In-zoom Making Coffee from SD → creates SD1
      m = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
      // Add a new sub-process Grinding inside SD1 (internal: true)
      m = unwrap(addThing(m, { id: "proc-grind", kind: "process", name: "Grinding", essence: "physical", affiliation: "systemic" }));
      m = unwrap(addAppearance(m, { thing: "proc-grind", opd: "opd-sd1", x: 50, y: 50, w: 120, h: 60, internal: true }));
      // In-zoom Grinding from SD1 — should succeed (Grinding ≠ Making Coffee)
      const result = refineThing(m, "proc-grind", "opd-sd1", "in-zoom", "opd-sd1-1", "SD1.1");
      expect(result.ok).toBe(true);
    });

    it("allows same thing to be refined with different type from same OPD", () => {
      let m = buildTestModel();
      m = unwrap(addThing(m, { id: "obj-car", kind: "object", name: "Car", essence: "physical", affiliation: "systemic" }));
      m = unwrap(addAppearance(m, { thing: "obj-car", opd: "opd-sd", x: 400, y: 50, w: 120, h: 60 }));
      m = unwrap(addLink(m, { id: "lnk-agg", type: "aggregation", source: "obj-water", target: "obj-car" }));
      // Unfold Car from SD
      m = unwrap(refineThing(m, "obj-car", "opd-sd", "unfold", "opd-sd1", "SD1"));
      // In-zoom Car from SD — different type, should succeed
      const result = refineThing(m, "obj-car", "opd-sd", "in-zoom", "opd-sd2", "SD2");
      expect(result.ok).toBe(true);
    });
  });

  describe("unfold", () => {
    function buildUnfoldModel() {
      let m = createModel("test");
      // Note: createModel already creates "opd-sd" (SD)
      m = unwrap(addThing(m, { id: "obj-car", kind: "object", name: "Car", essence: "physical", affiliation: "systemic" }));
      m = unwrap(addThing(m, { id: "obj-engine", kind: "object", name: "Engine", essence: "physical", affiliation: "systemic" }));
      m = unwrap(addThing(m, { id: "obj-wheel", kind: "object", name: "Wheel", essence: "physical", affiliation: "systemic" }));
      m = unwrap(addThing(m, { id: "obj-color", kind: "object", name: "Color", essence: "informatical", affiliation: "systemic" }));
      m = unwrap(addThing(m, { id: "proc-drive", kind: "process", name: "Driving", essence: "physical", affiliation: "systemic" }));
      m = unwrap(addAppearance(m, { thing: "obj-car", opd: "opd-sd", x: 100, y: 100, w: 150, h: 80 }));
      m = unwrap(addAppearance(m, { thing: "obj-engine", opd: "opd-sd", x: 50, y: 200, w: 120, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "obj-wheel", opd: "opd-sd", x: 200, y: 200, w: 120, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "obj-color", opd: "opd-sd", x: 350, y: 200, w: 120, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "proc-drive", opd: "opd-sd", x: 350, y: 100, w: 150, h: 80 }));
      // P-01 fix: correct link directions per spec — aggregation: Part→Whole, exhibition: Attribute→Exhibitor
      m = unwrap(addLink(m, { id: "lnk-agg1", type: "aggregation", source: "obj-engine", target: "obj-car" }));
      m = unwrap(addLink(m, { id: "lnk-agg2", type: "aggregation", source: "obj-wheel", target: "obj-car" }));
      m = unwrap(addLink(m, { id: "lnk-exh1", type: "exhibition", source: "obj-color", target: "obj-car" }));
      m = unwrap(addLink(m, { id: "lnk-eff1", type: "effect", source: "proc-drive", target: "obj-car" }));
      return m;
    }

    it("pulls back aggregation and exhibition targets only", () => {
      const m = buildUnfoldModel();
      const model = unwrap(refineThing(m, "obj-car", "opd-sd", "unfold", "opd-sd1", "SD1"));
      expect(model.appearances.has("obj-engine::opd-sd1")).toBe(true);
      expect(model.appearances.has("obj-wheel::opd-sd1")).toBe(true);
      expect(model.appearances.has("obj-color::opd-sd1")).toBe(true);
      expect(model.appearances.has("proc-drive::opd-sd1")).toBe(false);
      expect(model.appearances.get("obj-engine::opd-sd1")!.internal).toBe(false);
      expect(model.appearances.get("obj-color::opd-sd1")!.internal).toBe(false);
    });

    it("creates internal appearance for unfolded object", () => {
      const m = buildUnfoldModel();
      const model = unwrap(refineThing(m, "obj-car", "opd-sd", "unfold", "opd-sd1", "SD1"));
      const app = model.appearances.get("obj-car::opd-sd1");
      expect(app).toBeDefined();
      expect(app!.internal).toBe(true);
    });
  });
});

describe("validate() refinement checks", () => {
  it("detects DANGLING_REFINES — OPD refines non-existent thing", () => {
    let m = createModel("test");
    // Manually insert OPD with dangling refines (bypass addOPD guards)
    const opds = new Map(m.opds);
    opds.set("opd-sd1", { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-nonexistent", refinement_type: "in-zoom" });
    m = { ...m, opds };
    const errors = validate(m);
    expect(errors.some(e => e.code === "DANGLING_REFINES")).toBe(true);
  });

  it("detects INCONSISTENT_REFINEMENT — refines without refinement_type", () => {
    let m = createModel("test");
    const opds = new Map(m.opds);
    opds.set("opd-sd1", { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-something" } as any);
    m = { ...m, opds };
    const errors = validate(m);
    expect(errors.some(e => e.code === "INCONSISTENT_REFINEMENT")).toBe(true);
  });

  it("detects INCONSISTENT_REFINEMENT — refinement_type without refines", () => {
    let m = createModel("test");
    const opds = new Map(m.opds);
    opds.set("opd-sd1", { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refinement_type: "in-zoom" } as any);
    m = { ...m, opds };
    const errors = validate(m);
    expect(errors.some(e => e.code === "INCONSISTENT_REFINEMENT")).toBe(true);
  });

  it("passes validation for correctly formed refinement", () => {
    let m = buildTestModel();
    m = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
    const errors = validate(m);
    expect(errors.length).toBe(0);
  });
});

describe("removeThing cascade to refinement OPDs", () => {
  it("removes refinement OPDs when thing is deleted", () => {
    let m = buildTestModel();
    m = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
    expect(m.opds.has("opd-sd1")).toBe(true);
    const result = removeThing(m, "proc-make-coffee");
    expect(result.ok).toBe(true);
    const model = unwrap(result);
    expect(model.opds.has("opd-sd1")).toBe(false);
    expect(model.appearances.has("obj-water::opd-sd1")).toBe(false);
    expect(model.appearances.has("proc-make-coffee::opd-sd1")).toBe(false);
  });

  it("cascades nested refinement OPDs", () => {
    let m = buildTestModel();
    m = unwrap(refineThing(m, "proc-make-coffee", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
    m = unwrap(addThing(m, { id: "proc-grind", kind: "process", name: "Grinding", essence: "physical", affiliation: "systemic" }));
    m = unwrap(addAppearance(m, { thing: "proc-grind", opd: "opd-sd1", x: 50, y: 50, w: 120, h: 60, internal: true }));
    m = unwrap(addOPD(m, { id: "opd-sd1-1", name: "SD1.1", opd_type: "hierarchical", parent_opd: "opd-sd1", refines: "proc-grind", refinement_type: "in-zoom" }));
    const model = unwrap(removeThing(m, "proc-make-coffee"));
    expect(model.opds.has("opd-sd1")).toBe(false);
    expect(model.opds.has("opd-sd1-1")).toBe(false);
  });
});
