// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { addAppearance, addOPD, addThing, createModel } from "@opmodel/core";
import { OplLiveEditor } from "../src/components/OplLiveEditor";

function buildRefinementModel() {
  let model = createModel("Test");
  const heating = { id: "thing-heating", name: "Water Heating", kind: "process", essence: "physical", affiliation: "system" } as const;
  let r = addThing(model, heating); if (!r.ok) throw new Error(r.error.message); model = r.value;
  let a = addAppearance(model, { thing: heating.id, opd: "opd-sd", x: 40, y: 40, w: 160, h: 60 }); if (!a.ok) throw new Error(a.error.message); model = a.value;
  const o = addOPD(model, { id: "opd-sd1", name: "SD1 · In-zoom · Water Heating", parent_opd: "opd-sd", opd_type: "hierarchical", refines: heating.id, refinement_type: "in-zoom" });
  if (!o.ok) throw new Error(o.error.message);
  model = o.value;
  a = addAppearance(model, { thing: heating.id, opd: "opd-sd1", x: 120, y: 40, w: 220, h: 90, internal: true }); if (!a.ok) throw new Error(a.error.message); model = a.value;
  return model;
}

describe("OplLiveEditor refinement guidance", () => {
  it("shows OPL-first next-step guidance for a sparse refinement OPD", () => {
    const model = buildRefinementModel();
    render(
      React.createElement(OplLiveEditor, {
        model,
        opdId: "opd-sd1",
        selectedThing: null,
        selectedLink: null,
        dispatch: vi.fn(() => true),
      }),
    );

    expect(screen.getByText("Next OPL step")).toBeTruthy();
    expect(screen.getByText(/Start by declaring the main subprocesses/i)).toBeTruthy();
    expect(screen.getByText(/Water Heating zooms into Subprocess 1 and Subprocess 2, in that sequence\./i)).toBeTruthy();
  });

  it("can insert the suggested refinement template into the editor", () => {
    const model = buildRefinementModel();
    render(
      React.createElement(OplLiveEditor, {
        model,
        opdId: "opd-sd1",
        selectedThing: null,
        selectedLink: null,
        dispatch: vi.fn(() => true),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Insert template" }));
    const editor = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(editor.value).toContain("Water Heating zooms into Subprocess 1 and Subprocess 2, in that sequence.");
  });
});
