// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { createModel, addThing, addAppearance, addLink } from "@opmodel/core";
import { OplTextView } from "../src/components/OplTextView";

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

describe("OplTextView", () => {
  it("highlights the exact active line for a selected link", () => {
    const model = buildSimpleModel();
    const { container } = render(
      React.createElement(OplTextView, {
        model,
        opdId: "opd-sd",
        highlightLinkId: "link-consumes",
        dispatch: vi.fn(() => true),
      }),
    );

    const active = container.querySelector(".opl-text__line--active");
    expect(active?.textContent).toMatch(/Boiling consumes Water\./i);
  });

  it("clicking a modifier-or-link sentence selects the link when possible", () => {
    const model = buildSimpleModel();
    const dispatch = vi.fn(() => true);
    const { container } = render(
      React.createElement(OplTextView, {
        model,
        opdId: "opd-sd",
        dispatch,
      }),
    );

    const line = [...container.querySelectorAll(".opl-text__line")].find((node) => node.textContent?.includes("Boiling consumes Water"));
    expect(line).toBeTruthy();
    fireEvent.click(line!);

    expect(dispatch).toHaveBeenCalledWith({ tag: "selectLink", linkId: "link-consumes" });
  });
});
