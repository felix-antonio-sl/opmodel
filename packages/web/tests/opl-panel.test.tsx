// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createModel } from "@opmodel/core";
import { OplPanel } from "../src/components/OplPanel";

describe("OplPanel", () => {
  it("defaults to OPL authoring and hides the NL Assist tab", () => {
    render(
      <OplPanel
        model={createModel("Test")}
        opdId="opd-sd"
        selectedThing={null}
        selectedLink={null}
        dispatch={() => true}
      />,
    );

    expect(screen.getByRole("button", { name: "Author" })).toBeTruthy();
    expect(screen.getByText("Author OPL directly, then apply back to the model.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "NL Assist" })).toBeNull();
  });
});
