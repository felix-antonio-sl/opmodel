import { describe, expect, it } from "vitest";
import { createModel, addThing, addAppearance, addOPD } from "@opmodel/core";
import { canCreateRefinement, getRefinementContext, nextChildOpdDisplayName, nextChildOpdName } from "../src/lib/refinement-navigation";

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

  it("provides naming and creation helpers for new refinements", () => {
    const model = buildRefinementModel();
    expect(nextChildOpdName(model, "opd-sd")).toBe("SD4");
    const coffee = model.things.get("thing-coffee") ?? null;
    expect(coffee).toBeTruthy();
    expect(nextChildOpdDisplayName(model, "opd-sd", coffee!, "in-zoom")).toBe("SD4 · In-zoom · Coffee Making");
    const grinding = model.things.get("thing-grinding") ?? null;
    const coffeeChildren = getRefinementContext(model, "opd-sd", "thing-coffee").selectedThingChildRefinements;
    const grindingChildren = getRefinementContext(model, "opd-sd", "thing-grinding").selectedThingChildRefinements;
    expect(canCreateRefinement(coffee, coffeeChildren, "in-zoom")).toBe(false);
    expect(canCreateRefinement(coffee, coffeeChildren, "unfold")).toBe(false);
    expect(canCreateRefinement(grinding, grindingChildren, "in-zoom")).toBe(false);
    expect(canCreateRefinement(grinding, grindingChildren, "unfold")).toBe(false);
  });

  it("allows create actions only when that refinement does not yet exist", () => {
    const model = buildRefinementModel();
    const grinding = model.things.get("thing-grinding") ?? null;
    const grindingChildren = getRefinementContext(model, "opd-sd", "thing-grinding").selectedThingChildRefinements;
    expect(canCreateRefinement(grinding, grindingChildren, "unfold")).toBe(false);
    expect(canCreateRefinement(null, [], "in-zoom")).toBe(false);
  });
});
