import { describe, expect, it } from "vitest";
import { addAppearance, addFan, addThing, createModel, isOk, refineThing } from "@opmodel/core";
import {
  buildEffectiveVisualSlice,
  buildOpdProjectionView,
  buildPatchableOpdProjectionSlice,
  effectiveVisualAppearances,
  effectiveVisualLinks,
} from "../src/lib/projection-view";

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

    model.states.set("state-a-hidden", {
      id: "state-a-hidden",
      parent: "obj-a",
      name: "hidden",
      initial: false,
      final: false,
      default: false,
    });

    model.appearances.set("obj-a::opd-sd", {
      thing: "obj-a",
      opd: "opd-sd",
      x: 10,
      y: 20,
      w: 100,
      h: 50,
      pinned: true,
      suppressed_states: ["state-a-hidden"],
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
    expect(slice.visibleThingIds).toEqual(new Set(["obj-a", "obj-b"]));
    expect(slice.appearances.map((app) => app.thing)).toEqual(["obj-a", "obj-b"]);
    expect(slice.appearancesByThing.get("obj-a")?.pinned).toBe(true);
    expect(slice.suppressedStateIdsByThing.get("obj-a")).toEqual(new Set(["state-a-hidden"]));
    expect(slice.visualGraph.thingsById.get("obj-a")?.thing?.name).toBe("A");
    expect(slice.visualGraph.thingsById.get("obj-a")?.implicit).toBe(false);
    expect(slice.visualGraph.thingsById.get("obj-a")?.hasSuppressedStates).toBe(true);
    expect(slice.visualGraph.thingsById.get("obj-a")?.isContainer).toBe(false);
    expect(slice.visualGraph.thingsById.get("obj-a")?.isRefined).toBe(false);
    expect(slice.visualGraph.thingsById.get("obj-a")?.suppressedStateIds).toEqual(new Set(["state-a-hidden"]));
    expect(slice.visualGraph.thingsById.get("obj-a")?.visibleStates).toEqual([]);
    expect(slice.visualGraph.thingsById.get("obj-a")?.hiddenStateCount).toBe(1);
    expect(slice.visualGraph.thingsById.get("obj-a")?.statePills).toEqual([]);
    expect(slice.links.map((link) => link.id)).toEqual(["link-visible"]);
    expect(slice.visualLinks.map((entry) => entry.link.id)).toEqual(["link-visible"]);
    expect(slice.visualGraph.links.map((entry) => entry.link.id)).toEqual(["link-visible"]);
    expect(slice.fans.map((fan) => fan.id)).toEqual(["fan-visible"]);
  });

  it("hides in-zoom placeholder subprocesses once concrete subprocesses exist", () => {
    let model = createModel("Projection hides placeholders");

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

    r = addThing(model, {
      id: "proc-real",
      kind: "process",
      name: "Real Subprocess",
      essence: "informatical",
      affiliation: "systemic",
    });
    expect(isOk(r)).toBe(true);
    model = isOk(r) ? r.value : model;

    r = addAppearance(model, {
      thing: "proc-real",
      opd: "opd-sd1",
      x: 220,
      y: 120,
      w: 140,
      h: 60,
      internal: true,
    });
    expect(isOk(r)).toBe(true);
    model = isOk(r) ? r.value : model;

    const slice = buildPatchableOpdProjectionSlice(model, "opd-sd1");
    expect(slice.appearances.map((app) => app.thing)).toContain("proc-real");
    expect(slice.appearances.map((app) => app.thing)).not.toContain("opd-sd1-sub-1");
    expect(slice.appearances.map((app) => app.thing)).not.toContain("opd-sd1-sub-2");
    expect(slice.appearances.map((app) => app.thing)).not.toContain("opd-sd1-sub-3");
    expect(slice.visualGraph.thingsById.get("opd-sd1-sub-1")?.implicit).toBe(true);
  });

  it("uses the effective visual slice as the canonical visible boundary for appearances and links", () => {
    const model = createModel("Effective visual slice contract");

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

    const slice = buildEffectiveVisualSlice(model, "opd-sd");
    expect(effectiveVisualAppearances(slice).map((app) => app.thing)).toEqual(["obj-a", "obj-b"]);
    expect(effectiveVisualLinks(slice).map((link) => link.id)).toEqual(["link-visible"]);
  });

  it("keeps an explicit appearance visible even when the projection atlas prefers another OPD occurrence", () => {
    const model = createModel("Projection explicit appearance precedence");

    model.things.set("obj-shared", {
      id: "obj-shared",
      kind: "object",
      name: "Shared",
      essence: "physical",
      affiliation: "systemic",
    });
    model.things.set("obj-local", {
      id: "obj-local",
      kind: "object",
      name: "Local",
      essence: "physical",
      affiliation: "systemic",
    });

    model.opds.set("opd-sd1", {
      id: "opd-sd1",
      name: "SD1",
      opd_type: "hierarchical",
      parent_opd: "opd-sd",
    });

    model.appearances.set("obj-shared::opd-sd", {
      thing: "obj-shared",
      opd: "opd-sd",
      x: 10,
      y: 20,
      w: 100,
      h: 50,
    });
    model.appearances.set("obj-shared::opd-sd1", {
      thing: "obj-shared",
      opd: "opd-sd1",
      x: 210,
      y: 220,
      w: 140,
      h: 60,
    });
    model.appearances.set("obj-local::opd-sd1", {
      thing: "obj-local",
      opd: "opd-sd1",
      x: 420,
      y: 220,
      w: 120,
      h: 50,
    });

    model.links.set("link-local", {
      id: "link-local",
      type: "tagged",
      source: "obj-shared",
      target: "obj-local",
    });

    const slice = buildPatchableOpdProjectionSlice(model, "opd-sd1");
    expect(slice.appearances.map((app) => app.thing)).toEqual(["obj-shared", "obj-local"]);
    expect(slice.visualGraph.thingsById.has("obj-shared")).toBe(true);
    expect(slice.visualGraph.thingsById.get("obj-shared")?.appearance.opd).toBe("opd-sd1");
    expect(slice.visualGraph.links.map((entry) => entry.link.id)).toEqual(["link-local"]);
  });

  it("prepares visual graph links for merged transforming pairs", () => {
    const model = createModel("Projection Visual Graph Links");

    model.things.set("obj-water", {
      id: "obj-water",
      kind: "object",
      name: "Water",
      essence: "physical",
      affiliation: "systemic",
    });
    model.things.set("proc-heat", {
      id: "proc-heat",
      kind: "process",
      name: "Heat",
      essence: "physical",
      affiliation: "systemic",
    });

    model.states.set("state-cold", {
      id: "state-cold",
      parent: "obj-water",
      name: "Cold",
      initial: false,
      final: false,
      default: false,
    });
    model.states.set("state-hot", {
      id: "state-hot",
      parent: "obj-water",
      name: "Hot",
      initial: false,
      final: false,
      default: false,
    });

    model.appearances.set("obj-water::opd-sd", {
      thing: "obj-water",
      opd: "opd-sd",
      x: 10,
      y: 20,
      w: 100,
      h: 50,
    });
    model.appearances.set("proc-heat::opd-sd", {
      thing: "proc-heat",
      opd: "opd-sd",
      x: 200,
      y: 20,
      w: 120,
      h: 60,
    });

    model.links.set("lnk-consume", {
      id: "lnk-consume",
      type: "consumption",
      source: "obj-water",
      target: "proc-heat",
      source_state: "state-cold",
    });
    model.links.set("lnk-result", {
      id: "lnk-result",
      type: "result",
      source: "proc-heat",
      target: "obj-water",
      target_state: "state-hot",
    });

    const slice = buildPatchableOpdProjectionSlice(model, "opd-sd");

    expect(slice.visualGraph.links).toHaveLength(1);
    expect(slice.visualGraph.links[0]).toMatchObject({
      isMergedPair: true,
      visualSource: "proc-heat",
      visualTarget: "obj-water",
      labelOverride: "Cold → Hot",
    });
  });
});
