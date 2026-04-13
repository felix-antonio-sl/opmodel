// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createModel, saveModel } from "@opmodel/core";
import { OplImportPanel } from "../src/components/OplImportPanel";

describe("OplImportPanel", () => {
  it("can open imported OPL directly in Graph Generator", async () => {
    const onApply = vi.fn();
    const onOpenInGraphGenerator = vi.fn();
    const onClose = vi.fn();

    const imported = createModel("Imported from orchestrator");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        task_kind: "opl-import",
        status: "proposed",
        artifacts: [{
          artifact_kind: "normalized-opl",
          summary: "Imported OPL compiled through @opmodel/core into a real SemanticKernel.",
          payload: {
            ok: true,
            proposal: {
              summary: "Imported OPL compiled through @opmodel/core into a real SemanticKernel.",
              rationale: "ok",
              confidence: 0.93,
              requiresHumanReview: false,
              ssotChecksExpected: [],
            },
            context: {},
            outputs: { modelJson: saveModel(imported), canonicalOpl: "=== SD ===" },
          },
        }],
        guardrail: { ok: true, checks: [], issues: [] },
        trace: ["received-task"],
      }),
    }) as Response));

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

    await waitFor(() => {
      expect(onOpenInGraphGenerator).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onApply).not.toHaveBeenCalled();
  });
});
