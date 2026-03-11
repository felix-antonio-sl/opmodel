import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addOPD, addAppearance, addLink, refineThing } from "../src/api";

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
  });
});
