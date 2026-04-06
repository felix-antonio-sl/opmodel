import { describe, expect, it } from "vitest";
import { addFan, createModel, isOk } from "@opmodel/core";
import { buildOpdProjectionView, buildPatchableOpdProjectionSlice } from "../src/lib/projection-view";

describe("projection-view", () => {
  it("builds projected appearances and multi-OPD thing detection from legacy model", () => {
    const model = createModel("Projection View Test");

    model.things.set("obj-water", {
      id: "obj-water",
      kind: "object",
      name: "Water",
      essence: "physical",
      affiliation: "systemic",
    });
    model.appearances.set("obj-water::opd-sd", {
      thing: "obj-water",
      opd: "opd-sd",
      x: 10,
      y: 20,
      w: 100,
      h: 50,
    });

    model.opds.set("opd-sd1", {
      id: "opd-sd1",
      name: "SD1",
      opd_type: "hierarchical",
      parent_opd: "opd-sd",
    });
    model.appearances.set("obj-water::opd-sd1", {
      thing: "obj-water",
      opd: "opd-sd1",
      x: 40,
      y: 60,
      w: 100,
      h: 50,
    });

    const view = buildOpdProjectionView(model, "opd-sd");

    expect(view.appearancesByThing.get("obj-water")?.x).toBe(10);
    expect(view.appearancesByThing.get("obj-water")?.opd).toBe("opd-sd");
    expect(view.multiOpdThings.has("obj-water")).toBe(true);
  });

  it("builds a patchable projection slice for layout consumers", () => {
    const model = createModel("Projection Slice Test");

    model.things.set("obj-a", {
      id: "obj-a",
      kind: "object",
      name: "A",
      essence: "physical",
      affiliation: "systemic",
    });
    model.things.set("obj-b", {
      id: "obj-b",
      kind: "object",
      name: "B",
      essence: "physical",
      affiliation: "systemic",
    });
    model.things.set("obj-hidden", {
      id: "obj-hidden",
      kind: "object",
      name: "Hidden",
      essence: "physical",
      affiliation: "systemic",
    });

    model.appearances.set("obj-a::opd-sd", {
      thing: "obj-a",
      opd: "opd-sd",
      x: 10,
      y: 20,
      w: 100,
      h: 50,
      pinned: true,
    });
    model.appearances.set("obj-b::opd-sd", {
      thing: "obj-b",
      opd: "opd-sd",
      x: 160,
      y: 20,
      w: 100,
      h: 50,
    });

    model.links.set("link-visible", {
      id: "link-visible",
      type: "tagged",
      source: "obj-a",
      target: "obj-b",
    });
    model.links.set("link-hidden", {
      id: "link-hidden",
      type: "tagged",
      source: "obj-a",
      target: "obj-hidden",
    });

    const fanResult = addFan(model, {
      id: "fan-visible",
      type: "tagged",
      direction: "diverging",
      members: ["link-visible", "link-hidden"],
    });
    expect(isOk(fanResult)).toBe(true);
    const withFan = isOk(fanResult) ? fanResult.value : model;

    const slice = buildPatchableOpdProjectionSlice(withFan, "opd-sd");

    expect(slice.patchableThingIds).toEqual(new Set(["obj-a", "obj-b"]));
    expect(slice.appearances.map((app) => app.thing)).toEqual(["obj-a", "obj-b"]);
    expect(slice.appearancesByThing.get("obj-a")?.pinned).toBe(true);
    expect(slice.links.map((link) => link.id)).toEqual(["link-visible"]);
    expect(slice.fans.map((fan) => fan.id)).toEqual(["fan-visible"]);
  });
});
