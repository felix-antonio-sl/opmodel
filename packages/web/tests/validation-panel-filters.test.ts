// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { loadModel, validate } from "@opmodel/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ValidationPanel } from "../src/components/ValidationPanel";
import { auditVisualOpd } from "../src/lib/visual-lint";

function renderPanel(initialTab?: "issues" | "visual-report") {
  const fixture = readFileSync(resolve(process.cwd(), "tests/ev-ams.opmodel"), "utf8");
  const parsed = loadModel(fixture);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return null;

  const model = parsed.value;
  const currentOpd = "opd-sd1-1-1";
  const appearances = [...model.appearances.values()].filter((a) => a.opd === currentOpd);
  const ids = new Set(appearances.map((a) => a.thing));
  const links = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
  const visualFindings = auditVisualOpd({ appearances, links, things: model.things.values(), states: model.states.values() });
  const dispatch = vi.fn(() => true);

  render(React.createElement(ValidationPanel, {
    model,
    currentOpd,
    errors: validate(model),
    visualFindings,
    dispatch,
    onClose: vi.fn(),
    initialTab,
  }));

  return { model, currentOpd, dispatch };
}

describe("ValidationPanel filters", () => {
  it("filters model issues by current OPD and severity", () => {
    renderPanel();

    expect(screen.getByText("Current OPD")).toBeTruthy();
    fireEvent.click(screen.getByText("Info"));
    expect(screen.getAllByText(/Truncated state pill|VISUAL/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Whole model"));
    expect(screen.getByText("Whole model")).toBeTruthy();
  });

  it("opens on visual report tab and navigates from a finding", () => {
    const rendered = renderPanel("visual-report");
    expect(rendered).toBeTruthy();
    if (!rendered) return;

    expect(screen.getByText("Visual Report")).toBeTruthy();
    expect(screen.getByText(/Avg/)).toBeTruthy();

    const actionableFinding = screen.getAllByRole("button").find((el) =>
      el.getAttribute("title")?.includes("Go to affected thing")
    );
    expect(actionableFinding).toBeTruthy();
    if (!actionableFinding) return;

    fireEvent.click(actionableFinding);
    expect(rendered.dispatch.mock.calls[0]?.[0]).toMatchObject({ tag: "selectOpd" });
  });
});
