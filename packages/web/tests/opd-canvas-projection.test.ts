// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createModel } from "@opmodel/core";
import { buildPatchableOpdProjectionSlice } from "../src/lib/projection-view";
import { OpdCanvas } from "../src/components/OpdCanvas";

describe("OpdCanvas projection slice migration", () => {
  it("renders thing geometry from an injected projection slice instead of legacy appearances", () => {
    const model = createModel("Canvas Projection Test");
    model.things.set("obj-a", {
      id: "obj-a",
      kind: "object",
      name: "A",
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

    const baseSlice = buildPatchableOpdProjectionSlice(model, "opd-sd");
    const projectedAppearance = { ...baseSlice.appearances[0]!, x: 220, y: 140 };
    const projectionSlice = {
      ...baseSlice,
      visualGraph: {
        ...baseSlice.visualGraph,
        thingsById: new Map([[
          "obj-a",
          {
            ...baseSlice.visualGraph.thingsById.get("obj-a")!,
            appearance: projectedAppearance,
          },
        ]]),
        implicitThingIds: new Set<string>(),
      },
    };

    const { container } = render(React.createElement(OpdCanvas, {
      model,
      projectionSlice,
      opdId: "opd-sd",
      selectedThing: null,
      mode: "select",
      linkType: "auto",
      dispatch: vi.fn(() => true),
      simulation: null,
    }));

    const shape = container.querySelector(".thing-shape");
    expect(shape?.getAttribute("x")).toBe("220");
    expect(shape?.getAttribute("y")).toBe("140");
  });

  it("prefers projection-provided visible links over locally derived ones", () => {
    const model = createModel("Canvas Projection Links");
    model.things.set("obj-a", {
      id: "obj-a",
      kind: "object",
      name: "A",
      essence: "physical",
      affiliation: "systemic",
    });
    model.things.set("proc-b", {
      id: "proc-b",
      kind: "process",
      name: "B",
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
    model.appearances.set("proc-b::opd-sd", {
      thing: "proc-b",
      opd: "opd-sd",
      x: 220,
      y: 20,
      w: 120,
      h: 60,
    });
    model.links.set("lnk-a-b", {
      id: "lnk-a-b",
      type: "instrument",
      source: "obj-a",
      target: "proc-b",
    });

    const baseSlice = buildPatchableOpdProjectionSlice(model, "opd-sd");
    const projectionSlice = {
      ...baseSlice,
      visualGraph: {
        ...baseSlice.visualGraph,
        links: [],
      },
    };

    const { container } = render(React.createElement(OpdCanvas, {
      model,
      projectionSlice,
      opdId: "opd-sd",
      selectedThing: null,
      mode: "select",
      linkType: "auto",
      dispatch: vi.fn(() => true),
      simulation: null,
    }));

    expect(container.querySelectorAll(".link-line").length).toBe(0);
  });

  it("respects projected state pill anchoring from visualGraph", () => {
    const model = createModel("Projected State Pill Anchoring");
    model.things.set("obj-a", { id: "obj-a", name: "A", kind: "object", essence: "physical" });
    model.states.set("state-a", { id: "state-a", parent: "obj-a", name: "Ready" });
    model.appearances.set("app-a", { id: "app-a", thing: "obj-a", opd: "opd-sd", x: 20, y: 30, w: 120, h: 60 });

    const baseSlice = buildPatchableOpdProjectionSlice(model, "opd-sd");
    const projectedThing = baseSlice.visualGraph.thingsById.get("obj-a");
    expect(projectedThing?.statePills.length).toBe(1);
    if (!projectedThing) return;

    const projectionSlice = {
      ...baseSlice,
      visualGraph: {
        ...baseSlice.visualGraph,
        thingsById: new Map(baseSlice.visualGraph.thingsById).set("obj-a", {
          ...projectedThing,
          statePills: projectedThing.statePills.map((pill) => ({ ...pill, x: 333, y: 444 })),
        }),
      },
    };

    const { container } = render(
      <svg>
        <OpdCanvas model={model} opdId="opd-sd" currentProjectionSlice={projectionSlice} />
      </svg>,
    );

    const pill = container.querySelector("rect.state-pill");
    expect(pill).not.toBeNull();
    expect(pill?.getAttribute("x")).toBe("333");
    expect(pill?.getAttribute("y")).toBe("444");
  });

});
