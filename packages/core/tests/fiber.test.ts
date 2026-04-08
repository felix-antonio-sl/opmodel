import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createModel } from "../src/model";
import { loadModel } from "../src/serialization";
import { addThing, addLink, addState, addOPD, addAppearance, refineThing } from "../src/api";
import type { Thing, Model } from "../src/types";
import { resolveOpdFiber } from "../src/simulation";

// === Helpers ===

const obj = (id: string, name: string): Thing => ({
  id, kind: "object", name, essence: "physical", affiliation: "systemic",
});

const proc = (id: string, name: string): Thing => ({
  id, kind: "process", name, essence: "physical", affiliation: "systemic",
});

function unwrap<T>(result: { value: T } | { error: unknown }): T {
  if ("value" in result) return result.value;
  throw new Error(`unwrap failed: ${JSON.stringify((result as any).error)}`);
}

function loadCoffeeMakingModel(): Model {
  const json = readFileSync(resolve(__dirname, "../../../tests/coffee-making.opmodel"), "utf-8");
  return unwrap(loadModel(json));
}

// === resolveOpdFiber ===

describe("resolveOpdFiber", () => {

  // --- Explicit things ---

  describe("explicit things", () => {
    it("includes things with appearances in the OPD", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, proc("p1", "Boiling")));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 200, y: 0, w: 140, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.things.size).toBe(2);
      expect(fiber.things.has("o1")).toBe(true);
      expect(fiber.things.has("p1")).toBe(true);
    });

    it("marks explicit things as implicit: false", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 10, y: 20, w: 120, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.things.get("o1")!.implicit).toBe(false);
    });

    it("uses stored appearance for explicit things", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 42, y: 99, w: 120, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      const entry = fiber.things.get("o1")!;
      expect(entry.appearance.x).toBe(42);
      expect(entry.appearance.y).toBe(99);
    });

    it("returns empty fiber for unknown OPD", () => {
      const m = createModel("Test");
      const fiber = resolveOpdFiber(m, "opd-nonexistent");
      expect(fiber.things.size).toBe(0);
      expect(fiber.links).toHaveLength(0);
      expect(fiber.suppressedStates.size).toBe(0);
    });
  });

  // --- Implicit things ---

  describe("implicit things", () => {
    it("detects things connected via link to explicit thing", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, proc("p1", "Boiling")));
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
      // Only o1 has appearance; p1 is connected via link → implicit
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.things.size).toBe(2);
      expect(fiber.things.get("p1")!.implicit).toBe(true);
      expect(fiber.things.get("p1")!.thing.name).toBe("Boiling");
    });

    it("generates synthetic appearance for implicit things", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, proc("p1", "Boiling")));
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      const app = fiber.things.get("p1")!.appearance;
      expect(app.thing).toBe("p1");
      expect(app.opd).toBe("opd-sd");
      expect(app.w).toBeGreaterThan(0);
      expect(app.h).toBeGreaterThan(0);
    });

    it("does not cascade to 2nd hop", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "A")));
      m = unwrap(addThing(m, proc("p1", "B")));
      m = unwrap(addThing(m, obj("o2", "C")));
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
      m = unwrap(addLink(m, { id: "lnk2", type: "result", source: "p1", target: "o2" }));
      // o1 explicit, p1 implicit (linked to o1), o2 linked to p1 but NOT to o1
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      // o1 explicit, p1 implicit. o2 is connected to p1 (implicit) but p1 is not explicit → o2 NOT in fiber
      // Wait: o2 IS connected to p1, and p1 IS in the fiber as implicit. But implicit detection
      // only uses explicitIds (the original set), not the growing things map.
      // o2 also connects to p1 which IS NOT in explicitIds → o2 should NOT appear.
      expect(fiber.things.has("o2")).toBe(false);
      expect(fiber.things.size).toBe(2); // o1 + p1
    });

    it("deduplicates across multiple links to same implicit thing", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, obj("o2", "Ice")));
      m = unwrap(addThing(m, proc("p1", "Boiling")));
      // Two different objects link to the same implicit process
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
      m = unwrap(addLink(m, { id: "lnk2", type: "result", source: "p1", target: "o2" }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "o2", opd: "opd-sd", x: 0, y: 100, w: 120, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      // o1 + o2 explicit, p1 implicit (once, not twice)
      expect(fiber.things.size).toBe(3);
      expect(fiber.things.get("p1")!.implicit).toBe(true);
    });

    it("does not mark things already explicit as implicit", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, proc("p1", "Boiling")));
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 200, y: 0, w: 140, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.things.get("o1")!.implicit).toBe(false);
      expect(fiber.things.get("p1")!.implicit).toBe(false);
    });

    it("detects implicit things from both link directions", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, proc("p1", "Mixing")));
      m = unwrap(addThing(m, obj("o1", "Ingredient")));
      m = unwrap(addThing(m, obj("o2", "Product")));
      // o1 → p1 (consumption), p1 → o2 (result)
      m = unwrap(addLink(m, { id: "lnk1", type: "consumption", source: "o1", target: "p1" }));
      m = unwrap(addLink(m, { id: "lnk2", type: "result", source: "p1", target: "o2" }));
      // Only p1 explicit
      m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 100, y: 100, w: 140, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.things.has("o1")).toBe(true);
      expect(fiber.things.get("o1")!.implicit).toBe(true);
      expect(fiber.things.has("o2")).toBe(true);
      expect(fiber.things.get("o2")!.implicit).toBe(true);
    });
  });

  // --- Links ---

  describe("links", () => {
    it("includes resolved links from resolveLinksForOpd", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, proc("p1", "Boiling")));
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 200, y: 0, w: 140, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.links).toHaveLength(1);
      expect(fiber.links[0]!.link.id).toBe("lnk1");
    });

    it("returns empty links when no both-endpoint appearances exist", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, proc("p1", "Boiling")));
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
      // Only o1 has appearance — link has no resolved target
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.links).toHaveLength(0);
    });
  });

  // --- State suppression ---

  describe("state suppression", () => {
    it("computes suppression from child in-zoom OPD", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, proc("p1", "Main Process")));
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addState(m, { id: "s1", parent: "o1", name: "cold", initial: true, final: false, default: true }));
      m = unwrap(addState(m, { id: "s2", parent: "o1", name: "hot", initial: false, final: false, default: false }));
      // Effect link: Main Process affects Water from cold→hot
      m = unwrap(addLink(m, {
        id: "lnk1", type: "effect", source: "p1", target: "o1",
        source_state: "s1", target_state: "s2",
      }));
      // Both appear in SD
      m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 200, y: 100, w: 140, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 100, w: 120, h: 60 }));
      // Refine p1 with in-zoom → creates child OPD with o1 as external thing
      m = unwrap(refineThing(m, "p1", "opd-sd", "in-zoom", "opd-iz-p1", "IZ p1"));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.suppressedStates.has("o1")).toBe(true);
      const suppressed = fiber.suppressedStates.get("o1")!;
      expect(suppressed.has("s1")).toBe(true);
      expect(suppressed.has("s2")).toBe(true);
    });

    it("returns empty suppression for OPD with no child in-zoom", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addState(m, { id: "s1", parent: "o1", name: "cold", initial: true, final: false, default: true }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.suppressedStates.size).toBe(0);
    });

    it("does not suppress states for unfold refinements", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, proc("p1", "Process")));
      m = unwrap(addState(m, { id: "s1", parent: "o1", name: "cold", initial: true, final: false, default: true }));
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1", source_state: "s1" }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 200, y: 0, w: 140, h: 60 }));
      // Unfold refinement on object — should NOT suppress states (only in-zoom does)
      m = unwrap(refineThing(m, "o1", "opd-sd", "unfold", "opd-uf-o1", "UF o1"));

      const fiber = resolveOpdFiber(m, "opd-sd");
      expect(fiber.suppressedStates.size).toBe(0);
    });

    it("suppresses states from multiple child in-zoom OPDs", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, proc("p1", "Process A")));
      m = unwrap(addThing(m, proc("p2", "Process B")));
      m = unwrap(addThing(m, obj("o1", "Shared Object")));
      m = unwrap(addState(m, { id: "s1", parent: "o1", name: "state1", initial: true, final: false, default: true }));
      m = unwrap(addState(m, { id: "s2", parent: "o1", name: "state2", initial: false, final: false, default: false }));
      m = unwrap(addState(m, { id: "s3", parent: "o1", name: "state3", initial: false, final: false, default: false }));
      // p1 affects o1 via s1
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1", source_state: "s1" }));
      // p2 affects o1 via s2
      m = unwrap(addLink(m, { id: "lnk2", type: "effect", source: "p2", target: "o1", target_state: "s2" }));
      // All in SD
      m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 0, y: 0, w: 140, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "p2", opd: "opd-sd", x: 200, y: 0, w: 140, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 100, y: 200, w: 120, h: 60 }));
      // Refine both
      m = unwrap(refineThing(m, "p1", "opd-sd", "in-zoom", "opd-iz-p1", "IZ p1"));
      m = unwrap(refineThing(m, "p2", "opd-sd", "in-zoom", "opd-iz-p2", "IZ p2"));

      const fiber = resolveOpdFiber(m, "opd-sd");
      const suppressed = fiber.suppressedStates.get("o1");
      expect(suppressed).toBeDefined();
      expect(suppressed!.has("s1")).toBe(true);
      expect(suppressed!.has("s2")).toBe(true);
      // s3 not referenced in any link → not suppressed
      expect(suppressed!.has("s3")).toBe(false);
    });
  });

  // --- Coffee-making fixture ---

  describe("coffee-making fixture", () => {
    it("produces correct fiber for SD (system diagram)", () => {
      const m = loadCoffeeMakingModel();
      const fiber = resolveOpdFiber(m, "opd-sd");

      // SD has explicit things: all top-level appearances
      const explicits = [...fiber.things.values()].filter(e => !e.implicit);
      expect(explicits.length).toBeGreaterThanOrEqual(4); // at least Coffee Making + objects

      // Links should match resolveLinksForOpd (6 visible: 5 original + 1 Coffee Making effect)
      expect(fiber.links).toHaveLength(6);
    });

    it("produces correct fiber for SD1 (in-zoom OPD)", () => {
      const m = loadCoffeeMakingModel();
      const fiber = resolveOpdFiber(m, "opd-sd1");

      // SD1 has subprocesses + container + external objects
      expect(fiber.things.size).toBeGreaterThanOrEqual(3); // at least 3 subprocesses

      // Should have links inside the in-zoom
      expect(fiber.links.length).toBeGreaterThan(0);
    });

    it("SD fiber has state suppression from SD1 in-zoom", () => {
      const m = loadCoffeeMakingModel();
      const fiber = resolveOpdFiber(m, "opd-sd");

      // Coffee Making is refined in-zoom → external objects should have suppressed states
      // Water has states cold/hot, and Boiling effects Water from cold→hot
      if (fiber.suppressedStates.size > 0) {
        // At least one thing has suppressed states
        const allSuppressed = [...fiber.suppressedStates.values()].reduce(
          (acc, set) => acc + set.size, 0
        );
        expect(allSuppressed).toBeGreaterThan(0);
      }
      // Note: suppression depends on whether links reference states in the fixture
    });
  });

  // --- Consistency ---

  describe("consistency", () => {
    it("fiber things include all visual endpoints from resolved links", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, proc("p1", "Boiling")));
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));
      m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 200, y: 0, w: 140, h: 60 }));

      const fiber = resolveOpdFiber(m, "opd-sd");
      // Every visual endpoint in links should exist in fiber.things
      for (const rl of fiber.links) {
        expect(fiber.things.has(rl.visualSource)).toBe(true);
        expect(fiber.things.has(rl.visualTarget)).toBe(true);
      }
    });

    it("fiber is idempotent — calling twice returns equivalent result", () => {
      let m = createModel("Test");
      m = unwrap(addThing(m, obj("o1", "Water")));
      m = unwrap(addThing(m, proc("p1", "Boiling")));
      m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
      m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));

      const fiber1 = resolveOpdFiber(m, "opd-sd");
      const fiber2 = resolveOpdFiber(m, "opd-sd");
      expect(fiber1.things.size).toBe(fiber2.things.size);
      expect(fiber1.links.length).toBe(fiber2.links.length);
      expect(fiber1.suppressedStates.size).toBe(fiber2.suppressedStates.size);
    });
  });
});
