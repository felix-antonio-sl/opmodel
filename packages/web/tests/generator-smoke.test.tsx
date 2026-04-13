// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OpmGraphGeneratorPanel } from "../src/features/generator/components/OpmGraphGeneratorPanel";

describe("OpmGraphGeneratorPanel", () => {
  it("walks the wizard, refines to SD1, and opens a generated model", () => {
    const onOpenInEditor = vi.fn();

    render(
      React.createElement(OpmGraphGeneratorPanel, {
        onClose: vi.fn(),
        onOpenInEditor,
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
    fireEvent.click(screen.getByText("Refine main process"));
    fireEvent.click(screen.getByText("Generate SD1"));
    expect(screen.getByText(/Current view:/).textContent).toContain("SD1");

    fireEvent.click(screen.getByText("Open in editor"));

    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
  });
});
