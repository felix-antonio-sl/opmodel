// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { createModel, addThing, addAppearance } from "@opmodel/core";
import { OplLiveEditor } from "../src/components/OplLiveEditor";
import { OplTextView } from "../src/components/OplTextView";

function buildSimpleModel() {
  let model = createModel("Test");
  const water = { id: "thing-water", name: "Water", kind: "object", essence: "physical", affiliation: "system" } as const;
  const boiling = { id: "thing-boiling", name: "Boiling", kind: "process", essence: "physical", affiliation: "system" } as const;
  const r1 = addThing(model, water);
  if (!r1.ok) throw new Error(r1.error.message);
  model = r1.value;
  const r2 = addThing(model, boiling);
  if (!r2.ok) throw new Error(r2.error.message);
  model = r2.value;
  const a1 = addAppearance(model, { thing: water.id, opd: "opd-sd", x: 40, y: 40, w: 120, h: 60 });
  if (!a1.ok) throw new Error(a1.error.message);
  model = a1.value;
  const a2 = addAppearance(model, { thing: boiling.id, opd: "opd-sd", x: 220, y: 40, w: 140, h: 60 });
  if (!a2.ok) throw new Error(a2.error.message);
  return a2.value;
}

describe("OPL navigation bridge", () => {
  it("reveals the current selected thing inside the live editor", async () => {
    const model = buildSimpleModel();
    render(
      React.createElement(OplLiveEditor, {
        model,
        opdId: "opd-sd",
        selectedThing: "thing-boiling",
        selectedLink: null,
        dispatch: vi.fn(() => true),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    const editor = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(editor.selectionStart).toBeGreaterThanOrEqual("=== SD ===\n".length);
  });

  it("selects the corresponding thing when clicking an OPL line", () => {
    const model = buildSimpleModel();
    const dispatch = vi.fn(() => true);
    const { container } = render(
      React.createElement(OplTextView, {
        model,
        opdId: "opd-sd",
        dispatch,
      }),
    );

    const lines = container.querySelectorAll(".opl-text__line");
    const boilingLine = [...lines].find((line) => line.textContent?.includes("Boiling is a process"));
    expect(boilingLine).toBeTruthy();
    fireEvent.click(boilingLine!);

    expect(dispatch).toHaveBeenCalledWith({ tag: "selectThing", thingId: "thing-boiling" });
  });
});
