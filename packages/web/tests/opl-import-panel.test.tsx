// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createModel } from "@opmodel/core";
import { OplImportPanel } from "../src/components/OplImportPanel";

describe("OplImportPanel", () => {
  it("can open imported OPL directly in Graph Generator", async () => {
    const onApply = vi.fn();
    const onOpenInGraphGenerator = vi.fn();
    const onClose = vi.fn();

    render(
      React.createElement(OplImportPanel, {
        model: createModel("Test"),
        onApply,
        onOpenInGraphGenerator,
        onClose,
      }),
    );

    fireEvent.change(screen.getByPlaceholderText(/Coffee Making is a process/i), {
      target: {
        value: [
          "Coffee Making is a process, physical.",
          "Water is an object, physical.",
          "Coffee Making consumes Water.",
        ].join("\n"),
      },
    });

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Open in Graph Generator" }) as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByText("Open in Graph Generator"));

    expect(onOpenInGraphGenerator).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
