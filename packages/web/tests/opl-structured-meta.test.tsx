// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { addAppearance, addAssertion, addLink, addRequirement, addScenario, addThing, createModel } from "@opmodel/core";
import { OplSentencesView } from "../src/components/OplSentencesView";

function buildModelWithMeta() {
  let model = createModel("Test");
  const water = { id: "thing-water", name: "Water", kind: "object", essence: "physical", affiliation: "system" } as const;
  const boiling = { id: "thing-boiling", name: "Boiling", kind: "process", essence: "physical", affiliation: "system" } as const;
  let r = addThing(model, water); if (!r.ok) throw new Error(r.error.message); model = r.value;
  r = addThing(model, boiling); if (!r.ok) throw new Error(r.error.message); model = r.value;
  let a = addAppearance(model, { thing: water.id, opd: "opd-sd", x: 40, y: 40, w: 120, h: 60 }); if (!a.ok) throw new Error(a.error.message); model = a.value;
  a = addAppearance(model, { thing: boiling.id, opd: "opd-sd", x: 220, y: 40, w: 140, h: 60 }); if (!a.ok) throw new Error(a.error.message); model = a.value;
  const l = addLink(model, { id: "link-consumes", type: "consumption", source: water.id, target: boiling.id, path_label: "critical-path" }); if (!l.ok) throw new Error(l.error.message); model = l.value;
  const req = addRequirement(model, { id: "req-water", target: water.id, name: "Water quality", description: "Must be potable", req_id: "R-01" }); if (!req.ok) throw new Error(req.error.message); model = req.value;
  const assertion = addAssertion(model, { id: "assert-link", target: "link-consumes", predicate: "must remain valid", category: "correctness", enabled: true }); if (!assertion.ok) throw new Error(assertion.error.message); model = assertion.value;
  const scenario = addScenario(model, { id: "scenario-critical", name: "Critical path", path_labels: ["critical-path"] }); if (!scenario.ok) throw new Error(scenario.error.message); model = scenario.value;
  return model;
}

describe("OplSentencesView meta navigation", () => {
  it("lets requirement/assertion/scenario sentences navigate to their semantic targets", () => {
    const model = buildModelWithMeta();
    const onSelectEntity = vi.fn();

    render(
      React.createElement(OplSentencesView, {
        model,
        opdId: "opd-sd",
        selectedThing: null,
        selectedLink: null,
        onSelectEntity,
      }),
    );

    fireEvent.click(screen.getByText(/Water quality: Must be potable/i));
    expect(onSelectEntity).toHaveBeenCalledWith({ tag: "selectThing", thingId: "thing-water" });

    fireEvent.click(screen.getByText(/must remain valid/i));
    expect(onSelectEntity).toHaveBeenCalledWith({ tag: "selectLink", linkId: "link-consumes" });

    fireEvent.click(screen.getByText(/Critical path/i));
    expect(onSelectEntity).toHaveBeenCalledWith({ tag: "selectLink", linkId: "link-consumes" });
  });

  it("highlights meta sentences when their semantic target is selected", () => {
    const model = buildModelWithMeta();
    const { container, rerender } = render(
      React.createElement(OplSentencesView, {
        model,
        opdId: "opd-sd",
        selectedThing: "thing-water",
        selectedLink: null,
        onSelectEntity: vi.fn(),
      }),
    );

    expect([...container.querySelectorAll(".opl-sentence--highlighted")].some((node) => node.textContent?.includes("Water quality"))).toBe(true);

    rerender(
      React.createElement(OplSentencesView, {
        model,
        opdId: "opd-sd",
        selectedThing: null,
        selectedLink: "link-consumes",
        onSelectEntity: vi.fn(),
      }),
    );

    const highlightedTexts = [...container.querySelectorAll(".opl-sentence--highlighted")].map((node) => node.textContent || "");
    expect(highlightedTexts.some((text) => text.includes("must remain valid"))).toBe(true);
    expect(highlightedTexts.some((text) => text.includes("Critical path"))).toBe(true);
  });
});
