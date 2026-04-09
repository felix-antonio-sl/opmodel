import { describe, expect, it } from "vitest";
import { createModel, addThing, addAppearance, addOPD } from "@opmodel/core";
import { getRefinementContext } from "../src/lib/refinement-navigation";

function buildRefinementModel() {
  let model = createModel("Test");
  const coffee = { id: "thing-coffee", name: "Coffee Making", kind: "process", essence: "physical", affiliation: "system" } as const;
  const grinding = { id: "thing-grinding", name: "Grinding", kind: "process", essence: "physical", affiliation: "system" } as const;
  let r = addThing(model, coffee); if (!r.ok) throw new Error(r.error.message); model = r.value;
  r = addThing(model, grinding); if (!r.ok) throw new Error(r.error.message); model = r.value;
  let a = addAppearance(model, { thing: coffee.id, opd: "opd-sd", x: 40, y: 40, w: 140, h: 60 }); if (!a.ok) throw new Error(a.error.message); model = a.value;
  a = addAppearance(model, { thing: grinding.id, opd: "opd-sd", x: 240, y: 40, w: 140, h: 60 }); if (!a.ok) throw new Error(a.error.message); model = a.value;
  let o = addOPD(model, { id: "opd-sd1", name: "SD1", parent_opd: "opd-sd", opd_type: "hierarchical", refines: coffee.id, refinement_type: "in-zoom" }); if (!o.ok) throw new Error(o.error.message); model = o.value;
  o = addOPD(model, { id: "opd-sd1b", name: "SD1b", parent_opd: "opd-sd", opd_type: "hierarchical", refines: coffee.id, refinement_type: "unfold" }); if (!o.ok) throw new Error(o.error.message); model = o.value;
  o = addOPD(model, { id: "opd-sd2", name: "SD2", parent_opd: "opd-sd", opd_type: "hierarchical", refines: grinding.id, refinement_type: "in-zoom" }); if (!o.ok) throw new Error(o.error.message); model = o.value;
  return model;
}

describe("getRefinementContext", () => {
  it("returns parent, refinee, siblings, and selected child refinements", () => {
    const model = buildRefinementModel();
    const ctx = getRefinementContext(model, "opd-sd1", "thing-grinding");

    expect(ctx.parentOpd?.id).toBe("opd-sd");
    expect(ctx.refinedThing?.id).toBe("thing-coffee");
    expect(ctx.siblingRefinements.map((opd) => opd.id)).toEqual(["opd-sd1b"]);
    expect(ctx.selectedThingChildRefinements.map((opd) => opd.id)).toEqual([]);
  });

  it("finds child refinements for the currently selected thing in the current OPD", () => {
    const model = buildRefinementModel();
    const ctx = getRefinementContext(model, "opd-sd", "thing-coffee");
    expect(ctx.selectedThingChildRefinements.map((opd) => opd.id)).toEqual(["opd-sd1", "opd-sd1b"]);
  });
});
