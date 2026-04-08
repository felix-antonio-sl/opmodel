// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
    const card = document.querySelector(".opl-editor-focus-card") as HTMLElement;
    expect(card).toBeTruthy();
    expect(within(card).getByText(/Boiling consumes Water\./i)).toBeTruthy();
    expect(within(card).getByText(/L4:1/i)).toBeTruthy();
  });
});
