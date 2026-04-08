// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createModel } from "@opmodel/core";
import { OplLiveEditor } from "../src/components/OplLiveEditor";

describe("OplLiveEditor diagnostics", () => {
  it("jumps to the reported source span when clicking an issue", async () => {
    render(
      React.createElement(OplLiveEditor, {
        model: createModel("Test"),
        opdId: "opd-sd",
        dispatch: vi.fn(() => true),
      }),
    );

    const editor = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(editor).toBeTruthy();

    const badText = [
      "Water is an object, physical.",
      "Boiling is a process, physical.",
      "Boiling requires Tea.",
    ].join("\n");

    fireEvent.change(editor, { target: { value: badText } });
    fireEvent.click(screen.getByTitle("Jump to source"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const expectedStart = "Water is an object, physical.\nBoiling is a process, physical.\n".length;
    expect(editor.selectionStart).toBe(expectedStart);
    expect(editor.selectionEnd).toBeGreaterThanOrEqual(editor.selectionStart);
  });
});
