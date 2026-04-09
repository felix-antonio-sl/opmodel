// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createModel, addThing, addAppearance, addLink } from "@opmodel/core";
import { OplLiveEditor } from "../src/components/OplLiveEditor";

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

describe("OplLiveEditor focus card", () => {
  it("shows the currently focused sentence for a selected link", async () => {
    const model = buildSimpleModel();
    render(
      React.createElement(OplLiveEditor, {
        model,
        opdId: "opd-sd",
        selectedThing: null,
        selectedLink: "link-consumes",
        dispatch: vi.fn(() => true),
      }),
    );

    expect(screen.getByText("Current focus")).toBeTruthy();
    const card = document.querySelector(".opl-editor-context-card") as HTMLElement;
    expect(card).toBeTruthy();
    expect(within(card).getByText(/Boiling consumes Water\./i)).toBeTruthy();
    expect(within(card).getByText(/L4:1/i)).toBeTruthy();
  });

  it("can toggle focus mode in the context card", () => {
    const model = buildSimpleModel();
    render(
      React.createElement(OplLiveEditor, {
        model,
        opdId: "opd-sd",
        selectedThing: "thing-water",
        selectedLink: null,
        dispatch: vi.fn(() => true),
      }),
    );

    const toggle = screen.getByRole("button", { name: "Focus mode" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Focus mode on" })).toBeTruthy();
    expect(document.querySelector(".opl-editor-textarea--focus")).toBeTruthy();
  });

  it("can move through related sentences for the current selection", () => {
    const model = buildSimpleModel();
    render(
      React.createElement(OplLiveEditor, {
        model,
        opdId: "opd-sd",
        selectedThing: "thing-water",
        selectedLink: null,
        dispatch: vi.fn(() => true),
      }),
    );

    const card = document.querySelector(".opl-editor-context-card") as HTMLElement;
    expect(within(card).getByText(/Water is an object, physical, system\./i)).toBeTruthy();
    expect(within(card).getByText("1/3")).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: "→" }));
    expect(within(card).getByText(/Boiling consumes Water\./i)).toBeTruthy();
    expect(within(card).getByText("2/3")).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: "←" }));
    expect(within(card).getByText(/Water is an object, physical, system\./i)).toBeTruthy();
  });
});
