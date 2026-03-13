import { describe, test, expect } from "vitest";
import { resolve } from "../src/resolve";
import { createModel, addThing, addOPD, addAppearance, addState, addLink, addModifier } from "@opmodel/core";
import type { Model } from "@opmodel/core";

// Helper: build a test model with Water (object, states cold/hot), Boiling (process), consumption link
function buildTestModel(): { model: Model; opdId: string } {
  let m = createModel("test");
  const opdId = "opd-main";

  let r = addOPD(m, { id: opdId, name: "Main", parentId: null });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addAppearance(m, { thing: "obj-water", opd: opdId, x: 50, y: 50, w: 120, h: 60 });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addThing(m, { id: "proc-boiling", kind: "process", name: "Boiling", essence: "physical", affiliation: "systemic" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addAppearance(m, { thing: "proc-boiling", opd: opdId, x: 200, y: 50, w: 120, h: 60 });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addState(m, { id: "state-cold", parent: "obj-water", name: "cold" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addState(m, { id: "state-hot", parent: "obj-water", name: "hot" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addLink(m, { id: "lnk-consumption", type: "consumption", source: "proc-boiling", target: "obj-water" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  r = addModifier(m, { id: "mod-event", over: "lnk-consumption", type: "event" });
  if (!r.ok) throw new Error("setup failed");
  m = r.value;

  return { model: m, opdId };
}

describe("resolve", () => {
  const { model, opdId } = buildTestModel();

  // --- add-thing (no resolution needed) ---

  test("resolves add-thing with defaults", () => {
    const result = resolve(
      [{ kind: "add-thing", name: "Steam", thingKind: "object" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    const edit = result.value[0];
    expect(edit.kind).toBe("add-thing");
    if (edit.kind !== "add-thing") return;
    expect(edit.thing.name).toBe("Steam");
    expect(edit.thing.kind).toBe("object"); // mapped from thingKind
    expect(edit.thing.essence).toBe("informatical"); // default
    expect(edit.position.x).toBe(100); // first thing at x=100
  });

  test("increments position for multiple add-thing", () => {
    const result = resolve([
      { kind: "add-thing", name: "A", thingKind: "object" },
      { kind: "add-thing", name: "B", thingKind: "process" },
    ], model, opdId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const e1 = result.value[0] as Extract<typeof result.value[0], { kind: "add-thing" }>;
    const e2 = result.value[1] as Extract<typeof result.value[1], { kind: "add-thing" }>;
    expect(e1.position.x).toBe(100);
    expect(e2.position.x).toBe(250); // 100 + 1*150
  });

  // --- remove-thing (name resolution) ---

  test("resolves remove-thing by name", () => {
    const result = resolve(
      [{ kind: "remove-thing", name: "Water" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ kind: "remove-thing", thingId: "obj-water" });
  });

  test("resolves case-insensitively", () => {
    const result = resolve(
      [{ kind: "remove-thing", name: "water" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
  });

  test("fails on unknown thing name", () => {
    const result = resolve(
      [{ kind: "remove-thing", name: "NonExistent" }],
      model, opdId,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("not found");
    expect(result.error.index).toBe(0);
  });

  // --- add-states ---

  test("resolves add-states by thing name", () => {
    const result = resolve(
      [{ kind: "add-states", thingName: "Water", stateNames: ["boiling", "frozen"] }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edit = result.value[0];
    expect(edit.kind).toBe("add-states");
    if (edit.kind !== "add-states") return;
    expect(edit.thingId).toBe("obj-water");
    expect(edit.states).toHaveLength(2);
  });

  // --- remove-state ---

  test("resolves remove-state by thing and state name", () => {
    const result = resolve(
      [{ kind: "remove-state", thingName: "Water", stateName: "cold" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ kind: "remove-state", stateId: "state-cold" });
  });

  // --- add-link ---

  test("resolves add-link by endpoint names", () => {
    const result = resolve(
      [{ kind: "add-link", sourceName: "Boiling", targetName: "Water", linkType: "effect" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edit = result.value[0];
    expect(edit.kind).toBe("add-link");
    if (edit.kind !== "add-link") return;
    expect(edit.link.source).toBe("proc-boiling");
    expect(edit.link.target).toBe("obj-water");
    expect(edit.link.type).toBe("effect");
  });

  test("resolves add-link with state names scoped to endpoints", () => {
    const result = resolve(
      [{
        kind: "add-link", sourceName: "Boiling", targetName: "Water",
        linkType: "effect", targetState: "hot",
      }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edit = result.value[0] as Extract<typeof result.value[0], { kind: "add-link" }>;
    expect(edit.link.target_state).toBe("state-hot");
  });

  // --- remove-link ---

  test("resolves remove-link by endpoint names and type", () => {
    const result = resolve(
      [{ kind: "remove-link", sourceName: "Boiling", targetName: "Water", linkType: "consumption" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ kind: "remove-link", linkId: "lnk-consumption" });
  });

  test("fails remove-link when no matching link", () => {
    const result = resolve(
      [{ kind: "remove-link", sourceName: "Boiling", targetName: "Water", linkType: "agent" }],
      model, opdId,
    );
    expect(result.ok).toBe(false);
  });

  // --- add-modifier ---

  test("resolves add-modifier by link endpoint names", () => {
    const result = resolve(
      [{ kind: "add-modifier", sourceName: "Boiling", targetName: "Water", linkType: "consumption", modifierType: "condition" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edit = result.value[0];
    expect(edit.kind).toBe("add-modifier");
    if (edit.kind !== "add-modifier") return;
    expect(edit.modifier.over).toBe("lnk-consumption");
  });

  // --- remove-modifier ---

  test("resolves remove-modifier", () => {
    const result = resolve(
      [{ kind: "remove-modifier", sourceName: "Boiling", targetName: "Water", linkType: "consumption", modifierType: "event" }],
      model, opdId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ kind: "remove-modifier", modifierId: "mod-event" });
  });

  // --- Batch mode (accumulated model) ---

  test("batch: thing created in edit 1 available in edit 2", () => {
    const result = resolve([
      { kind: "add-thing", name: "Steam", thingKind: "object" },
      { kind: "add-link", sourceName: "Boiling", targetName: "Steam", linkType: "result" },
    ], model, opdId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[1].kind).toBe("add-link");
  });

  test("batch: states added in edit 1 available for link in edit 2", () => {
    const result = resolve([
      { kind: "add-states", thingName: "Water", stateNames: ["boiling"] },
      { kind: "add-link", sourceName: "Boiling", targetName: "Water", linkType: "effect", targetState: "boiling" },
    ], model, opdId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const linkEdit = result.value[1] as Extract<typeof result.value[1], { kind: "add-link" }>;
    expect(linkEdit.link.target_state).toBeDefined();
  });
});
