// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OpmGraphGeneratorPanel } from "../src/features/generator/components/OpmGraphGeneratorPanel";
import { createModel, addAppearance, addThing } from "@opmodel/core";

function buildImportedModel() {
  let model = createModel("Imported Coffee");
  const process = { id: "proc-coffee-making", name: "Coffee Making", kind: "process", essence: "physical", affiliation: "system" } as const;
  const water = { id: "obj-water", name: "Water", kind: "object", essence: "physical", affiliation: "system" } as const;
  let result = addThing(model, process); if (!result.ok) throw new Error(result.error.message); model = result.value;
  result = addThing(model, water); if (!result.ok) throw new Error(result.error.message); model = result.value;
  let appearance = addAppearance(model, { thing: process.id, opd: "opd-sd", x: 220, y: 80, w: 180, h: 90 }); if (!appearance.ok) throw new Error(appearance.error.message); model = appearance.value;
  appearance = addAppearance(model, { thing: water.id, opd: "opd-sd", x: 40, y: 80, w: 140, h: 70 }); if (!appearance.ok) throw new Error(appearance.error.message); model = appearance.value;
  return model;
}

describe("OpmGraphGeneratorPanel", () => {
  it("walks the wizard, refines to SD1, and opens a generated model", () => {
    const onOpenInEditor = vi.fn();
    const onOpenLlmSettings = vi.fn();

    render(
      React.createElement(OpmGraphGeneratorPanel, {
        onClose: vi.fn(),
        onOpenInEditor,
        onOpenLlmSettings,
      }),
    );

    fireEvent.click(screen.getByText("Abrir wizard SD"));

    fireEvent.change(screen.getByPlaceholderText("Battery Charging System"), { target: { value: "Battery Charging System" } });
    fireEvent.change(screen.getByPlaceholderText("Battery Charging"), { target: { value: "Battery Charging" } });
    fireEvent.click(screen.getByText("Next"));

    fireEvent.change(screen.getByPlaceholderText("Driver Group"), { target: { value: "Driver Group" } });
    fireEvent.change(screen.getByPlaceholderText("Mobility Convenience"), { target: { value: "Mobility Convenience" } });
    fireEvent.change(screen.getByPlaceholderText("Battery"), { target: { value: "Battery" } });
    fireEvent.click(screen.getByText("Next"));

    fireEvent.click(screen.getAllByText("+ Add")[0]!);
    fireEvent.change(screen.getByPlaceholderText("Operator"), { target: { value: "Operator" } });
    fireEvent.click(screen.getAllByText("+ Add")[1]!);
    fireEvent.change(screen.getByPlaceholderText("Charging Station"), { target: { value: "Charging Station" } });
    fireEvent.click(screen.getByText("Next"));

    fireEvent.click(screen.getByText("Generate model"));
    expect(screen.getByText(/Active LLM:/).textContent).toContain("not configured");
    fireEvent.click(screen.getByText("Change LLM settings"));
    expect(onOpenLlmSettings).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Refine main process"));
    fireEvent.click(screen.getByText("Generate SD1"));
    expect(screen.getByText(/Current view:/).textContent).toContain("SD1");

    fireEvent.click(screen.getByText("Open in editor"));

    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
  });

  it("can open directly into workspace from an imported model", () => {
    render(
      React.createElement(OpmGraphGeneratorPanel, {
        onClose: vi.fn(),
        onOpenInEditor: vi.fn(),
        initialModel: buildImportedModel(),
      }),
    );

    expect(screen.getByText(/Current view:/).textContent).toContain("Imported OPL");
    expect(screen.getByText(/Imported Coffee/)).toBeTruthy();
  });
});
