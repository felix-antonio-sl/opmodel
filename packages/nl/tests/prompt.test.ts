import { describe, test, expect } from "vitest";
import { buildSystemPrompt, buildContextMessage, buildUserMessage } from "../src/prompt";
import { createModel, addThing, addOPD, addAppearance, addState } from "@opmodel/core";
import type { Model } from "@opmodel/core";

function buildTestModel(): { model: Model; opdId: string } {
  let m = createModel("test");
  const opdId = "opd-main";
  let r = addOPD(m, { id: opdId, name: "Main", opd_type: "hierarchical", parent_opd: null });
  m = r.ok ? r.value : m;
  r = addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" });
  m = r.ok ? r.value : m;
  r = addAppearance(m, { thing: "obj-water", opd: opdId, x: 50, y: 50, w: 120, h: 60 });
  m = r.ok ? r.value : m;
  r = addState(m, { id: "s1", parent: "obj-water", name: "cold", initial: false, final: false, default: false });
  m = r.ok ? r.value : m;
  r = addState(m, { id: "s2", parent: "obj-water", name: "hot", initial: false, final: false, default: false });
  m = r.ok ? r.value : m;
  return { model: m, opdId };
}

describe("prompt", () => {
  test("buildSystemPrompt contains all 8 edit kinds", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("add-thing");
    expect(prompt).toContain("remove-thing");
    expect(prompt).toContain("add-states");
    expect(prompt).toContain("remove-state");
    expect(prompt).toContain("add-link");
    expect(prompt).toContain("remove-link");
    expect(prompt).toContain("add-modifier");
    expect(prompt).toContain("remove-modifier");
  });

  test("buildSystemPrompt mentions JSON array format", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("JSON array");
  });

  test("buildContextMessage includes existing things", () => {
    const { model, opdId } = buildTestModel();
    const ctx = buildContextMessage(model, opdId);
    expect(ctx).toContain("Water");
    expect(ctx).toContain("object");
  });

  test("buildContextMessage includes states", () => {
    const { model, opdId } = buildTestModel();
    const ctx = buildContextMessage(model, opdId);
    expect(ctx).toContain("cold");
    expect(ctx).toContain("hot");
  });

  test("buildContextMessage handles empty model", () => {
    const m = createModel("empty");
    let r = addOPD(m, { id: "opd-x", name: "X", opd_type: "hierarchical", parent_opd: null });
    const model = r.ok ? r.value : m;
    const ctx = buildContextMessage(model, "opd-x");
    expect(ctx).toContain("(none)");
  });

  test("buildUserMessage wraps user input", () => {
    const msg = buildUserMessage("Add a Water object");
    expect(msg).toContain("Add a Water object");
  });
});
