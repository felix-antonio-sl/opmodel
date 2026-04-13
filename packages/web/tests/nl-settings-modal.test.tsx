// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NlSettingsModal } from "../src/components/NlSettingsModal";

describe("NlSettingsModal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves provider, key, and model to localStorage", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      React.createElement(NlSettingsModal, {
        config: null,
        onSave,
        onClose,
      }),
    );

    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai" } });
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sk-test-key" } });
    fireEvent.change(screen.getByLabelText("Model (optional)"), { target: { value: "gpt-4.1" } });
    fireEvent.click(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("opmodel:nl-config")).toContain("openai");
    expect(localStorage.getItem("opmodel:nl-config")).toContain("gpt-4.1");
  });
});
