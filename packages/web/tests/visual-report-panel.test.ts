// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { loadModel } from "@opmodel/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import { VisualReportPanel } from "../src/components/VisualReportPanel";

describe("VisualReportPanel", () => {
  it("renders detailed findings and navigates to the selected OPD/entity", () => {
    const fixture = readFileSync(resolve(process.cwd(), "tests/ev-ams.opmodel"), "utf8");
    const parsed = loadModel(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const dispatch = vi.fn(() => true);
    const onClose = vi.fn();

    render(React.createElement(VisualReportPanel, { model: parsed.value, dispatch, onClose }));

    expect(screen.getByText("Visual Quality Report")).toBeTruthy();
    expect(screen.getAllByText(/findings/i).length).toBeGreaterThan(0);

    const actionableFinding = screen.getAllByRole("button").find((el) =>
      el.getAttribute("title")?.includes("Go to affected thing")
    );

    expect(actionableFinding).toBeTruthy();
    if (!actionableFinding) return;

    fireEvent.click(actionableFinding);

    expect(dispatch).toHaveBeenCalled();
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ tag: "selectOpd" });
    expect(dispatch.mock.calls[1]?.[0]).toMatchObject({ tag: "selectThing" });
    expect(onClose).toHaveBeenCalled();
  });
});
