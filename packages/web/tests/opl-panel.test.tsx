// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createModel, addThing, addAppearance, addLink } from "@opmodel/core";
import { OplPanel } from "../src/components/OplPanel";

function buildSimpleModel() {
  let model = createModel("Test");
  const water = { id: "thing-water", name: "Water", kind: "object", essence: "physical", affiliation: "system" } as const;
  const boiling = { id: "thing-boiling", name: "Boiling", kind: "process", essence: "physical", affiliation: "system" } as const;
  let r = addThing(model, water); if (!r.ok) throw new Error(r.error.message); model = r.value;
  r = addThing(model, boiling); if (!r.ok) throw new Error(r.error.message); model = r.value;
  let a = addAppearance(model, { thing: water.id, opd: "opd-sd", x: 40, y: 40, w: 120, h: 60 }); if (!a.ok) throw new Error(a.error.message); model = a.value;
  a = addAppearance(model, { thing: boiling.id, opd: "opd-sd", x: 220, y: 40, w: 140, h: 60 }); if (!a.ok) throw new Error(a.error.message); model = a.value;
  const l = addLink(model, { id: "link-consumes", type: "consumption", source: water.id, target: boiling.id }); if (!l.ok) throw new Error(l.error.message); model = l.value;
  return model;
}

describe("OplPanel", () => {
  it("defaults to OPL authoring and hides the NL Assist tab", () => {
    render(
      <OplPanel
        model={createModel("Test")}
        opdId="opd-sd"
        selectedThing={null}
        selectedLink={null}
        dispatch={() => true}
      />,
    );

    expect(screen.getByRole("button", { name: "Author" })).toBeTruthy();
    expect(screen.getByText("Author OPL directly, then apply back to the model.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "NL Assist" })).toBeNull();
  });

  it("returns to Author when the external selection changes", () => {
    const model = buildSimpleModel();
    const { rerender } = render(
      React.createElement(OplPanel, {
        model,
        opdId: "opd-sd",
        selectedThing: null,
        selectedLink: null,
        dispatch: () => true,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Structured" }));
    expect(screen.getByText("Browse generated OPL sentences by entity.")).toBeTruthy();

    rerender(
      React.createElement(OplPanel, {
        model,
        opdId: "opd-sd",
        selectedThing: "thing-boiling",
        selectedLink: null,
        dispatch: () => true,
      }),
    );

    expect(screen.getByText("Author OPL directly, then apply back to the model.")).toBeTruthy();
  });

  it("keeps a recent focus trail and lets you jump back", () => {
    const model = buildSimpleModel();
    const dispatch = vi.fn(() => true);
    const { rerender } = render(
      React.createElement(OplPanel, {
        model,
        opdId: "opd-sd",
        selectedThing: "thing-water",
        selectedLink: null,
        dispatch,
      }),
    );

    expect(screen.getByText("Recent focus")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Water" })).toBeTruthy();

    rerender(
      React.createElement(OplPanel, {
        model,
        opdId: "opd-sd",
        selectedThing: null,
        selectedLink: "link-consumes",
        dispatch,
      }),
    );

    expect(screen.getByRole("button", { name: "Water → Boiling" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Water" }));
    expect(dispatch).toHaveBeenCalledWith({ tag: "selectThing", thingId: "thing-water" });
  });

  it("shows refinement actions in the OPL workspace and can create them", () => {
    const model = buildSimpleModel();
    const dispatch = vi.fn(() => true);
    render(
      React.createElement(OplPanel, {
        model,
        opdId: "opd-sd",
        selectedThing: "thing-water",
        selectedLink: null,
        dispatch,
      }),
    );

    expect(screen.getByText("Refinement actions")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+ In-zoom Water" }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      tag: "refineThing",
      thingId: "thing-water",
      opdId: "opd-sd",
      refinementType: "in-zoom",
      childOpdName: expect.stringContaining("Water"),
    }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ tag: "selectOpd", opdId: expect.any(String) }));
  });

  it("lets structured sentences select links and returns to Author", () => {
    const model = buildSimpleModel();
    const dispatch = vi.fn(() => true);
    render(
      React.createElement(OplPanel, {
        model,
        opdId: "opd-sd",
        selectedThing: null,
        selectedLink: null,
        dispatch,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Structured" }));
    fireEvent.click(screen.getByText(/Boiling consumes Water\./i));

    expect(dispatch).toHaveBeenCalledWith({ tag: "selectLink", linkId: "link-consumes" });
    expect(screen.getByText("Author OPL directly, then apply back to the model.")).toBeTruthy();
  });
});
