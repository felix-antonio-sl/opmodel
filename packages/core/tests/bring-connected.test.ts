import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, addAppearance, bringConnectedThings } from "../src/api";
import type { Thing, Model } from "../src/types";
import { appearanceKey } from "../src/helpers";

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

/** Build model: o1 (Water) --[effect]--> p1 (Boiling), o1 --[agent]--> p2 (Heating), o1 --[aggregation]--> o2 (Part) */
function buildConnectedModel(): Model {
  let m = createModel("Test");
  m = unwrap(addThing(m, obj("o1", "Water")));
  m = unwrap(addThing(m, proc("p1", "Boiling")));
  m = unwrap(addThing(m, proc("p2", "Heating")));
  m = unwrap(addThing(m, obj("o2", "Part")));
  m = unwrap(addLink(m, { id: "lnk1", type: "effect", source: "p1", target: "o1" }));
  m = unwrap(addLink(m, { id: "lnk2", type: "agent", source: "o1", target: "p2" }));
  m = unwrap(addLink(m, { id: "lnk3", type: "aggregation", source: "o1", target: "o2" }));
  // Only o1 has appearance in SD
  m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 100, y: 100, w: 120, h: 60 }));
  return m;
}

// === bringConnectedThings ===

describe("bringConnectedThings", () => {
  it("materializes all connected things without appearances", () => {
    const m = buildConnectedModel();
    const result = bringConnectedThings(m, "o1", "opd-sd");
    expect("value" in result).toBe(true);
    const m2 = unwrap(result);

    // p1, p2, o2 should now have appearances
    expect(m2.appearances.has(appearanceKey("p1", "opd-sd"))).toBe(true);
    expect(m2.appearances.has(appearanceKey("p2", "opd-sd"))).toBe(true);
    expect(m2.appearances.has(appearanceKey("o2", "opd-sd"))).toBe(true);
  });

  it("does not duplicate existing appearances", () => {
    let m = buildConnectedModel();
    // Add p1 appearance
    m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 300, y: 100, w: 140, h: 60 }));
    const m2 = unwrap(bringConnectedThings(m, "o1", "opd-sd"));

    // p1 should keep original appearance (x=300)
    const p1App = m2.appearances.get(appearanceKey("p1", "opd-sd"))!;
    expect(p1App.x).toBe(300);

    // p2 and o2 should be new
    expect(m2.appearances.has(appearanceKey("p2", "opd-sd"))).toBe(true);
    expect(m2.appearances.has(appearanceKey("o2", "opd-sd"))).toBe(true);
  });

  it("filters by procedural links only", () => {
    const m = buildConnectedModel();
    const m2 = unwrap(bringConnectedThings(m, "o1", "opd-sd", "procedural"));

    // p1 (effect) and p2 (agent) are procedural
    expect(m2.appearances.has(appearanceKey("p1", "opd-sd"))).toBe(true);
    expect(m2.appearances.has(appearanceKey("p2", "opd-sd"))).toBe(true);
    // o2 (aggregation) is structural — NOT included
    expect(m2.appearances.has(appearanceKey("o2", "opd-sd"))).toBe(false);
  });

  it("filters by structural links only", () => {
    const m = buildConnectedModel();
    const m2 = unwrap(bringConnectedThings(m, "o1", "opd-sd", "structural"));

    // Only o2 (aggregation) is structural
    expect(m2.appearances.has(appearanceKey("o2", "opd-sd"))).toBe(true);
    // p1, p2 are procedural — NOT included
    expect(m2.appearances.has(appearanceKey("p1", "opd-sd"))).toBe(false);
    expect(m2.appearances.has(appearanceKey("p2", "opd-sd"))).toBe(false);
  });

  it("returns model unchanged when nothing to materialize", () => {
    let m = buildConnectedModel();
    m = unwrap(addAppearance(m, { thing: "p1", opd: "opd-sd", x: 0, y: 0, w: 140, h: 60 }));
    m = unwrap(addAppearance(m, { thing: "p2", opd: "opd-sd", x: 0, y: 100, w: 140, h: 60 }));
    m = unwrap(addAppearance(m, { thing: "o2", opd: "opd-sd", x: 0, y: 200, w: 120, h: 60 }));

    const m2 = unwrap(bringConnectedThings(m, "o1", "opd-sd"));
    // Same model — nothing changed
    expect(m2.appearances.size).toBe(m.appearances.size);
  });

  it("positions new appearances relative to anchor thing", () => {
    const m = buildConnectedModel();
    const m2 = unwrap(bringConnectedThings(m, "o1", "opd-sd"));

    // o1 is at x=100, w=120. New appearances should start at x=100+120+50=270
    for (const [key, app] of m2.appearances) {
      if (app.thing !== "o1" && app.opd === "opd-sd") {
        expect(app.x).toBeGreaterThanOrEqual(270);
      }
    }
  });

  it("errors on nonexistent thing", () => {
    const m = createModel("Test");
    const result = bringConnectedThings(m, "nope", "opd-sd");
    expect("error" in result).toBe(true);
  });

  it("errors on nonexistent OPD", () => {
    let m = createModel("Test");
    m = unwrap(addThing(m, obj("o1", "Water")));
    const result = bringConnectedThings(m, "o1", "nope");
    expect("error" in result).toBe(true);
  });

  it("handles thing with no links", () => {
    let m = createModel("Test");
    m = unwrap(addThing(m, obj("o1", "Water")));
    m = unwrap(addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }));

    const m2 = unwrap(bringConnectedThings(m, "o1", "opd-sd"));
    // No new appearances — just the original
    expect(m2.appearances.size).toBe(1);
  });
});
