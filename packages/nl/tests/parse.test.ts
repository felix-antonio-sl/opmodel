import { describe, test, expect } from "vitest";
import { parse } from "../src/parse";

describe("parse", () => {
  // --- Valid inputs ---

  test("parses single add-thing descriptor", () => {
    const raw = '[{"kind":"add-thing","name":"Water","thingKind":"object"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      kind: "add-thing", name: "Water", thingKind: "object",
      essence: "informatical", affiliation: "systemic",
    });
  });

  test("parses multiple descriptors", () => {
    const raw = JSON.stringify([
      { kind: "add-thing", name: "Water", thingKind: "object" },
      { kind: "add-states", thingName: "Water", stateNames: ["cold", "hot"] },
      { kind: "add-thing", name: "Boiling", thingKind: "process" },
      { kind: "add-link", sourceName: "Water", targetName: "Boiling", linkType: "consumption" },
    ]);
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(4);
  });

  test("applies default essence and affiliation for add-thing", () => {
    const raw = '[{"kind":"add-thing","name":"X","thingKind":"process"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const desc = result.value[0] as Extract<typeof result.value[number], { kind: "add-thing" }>;
    expect(desc.essence).toBe("informatical");
    expect(desc.affiliation).toBe("systemic");
  });

  test("preserves explicit essence and affiliation", () => {
    const raw = '[{"kind":"add-thing","name":"X","thingKind":"object","essence":"physical","affiliation":"environmental"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const desc = result.value[0] as Extract<typeof result.value[number], { kind: "add-thing" }>;
    expect(desc.essence).toBe("physical");
    expect(desc.affiliation).toBe("environmental");
  });

  test("applies default negated=false for add-modifier", () => {
    const raw = '[{"kind":"add-modifier","sourceName":"A","targetName":"B","linkType":"agent","modifierType":"event"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const desc = result.value[0] as Extract<typeof result.value[number], { kind: "add-modifier" }>;
    expect(desc.negated).toBe(false);
  });

  test("trims whitespace from names", () => {
    const raw = '[{"kind":"add-thing","name":"  Water  ","thingKind":"object"}]';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value[0] as any).name).toBe("Water");
  });

  // --- JSON extraction ---

  test("extracts JSON from markdown code block", () => {
    const raw = 'Here are the edits:\n```json\n[{"kind":"add-thing","name":"Water","thingKind":"object"}]\n```\nThese will add Water.';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });

  test("extracts JSON from bare code block", () => {
    const raw = '```\n[{"kind":"add-thing","name":"Water","thingKind":"object"}]\n```';
    const result = parse(raw);
    expect(result.ok).toBe(true);
  });

  test("extracts first JSON array from prose", () => {
    const raw = 'Sure! Here you go: [{"kind":"remove-thing","name":"Water"}] Hope that helps!';
    const result = parse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });

  // --- Error cases ---

  test("rejects non-JSON input", () => {
    const result = parse("this is not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("JSON");
  });

  test("rejects non-array JSON", () => {
    const result = parse('{"kind":"add-thing","name":"X"}');
    expect(result.ok).toBe(false);
  });

  test("rejects unknown kind", () => {
    const result = parse('[{"kind":"add-widget","name":"X"}]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("kind");
  });

  test("rejects add-thing missing name", () => {
    const result = parse('[{"kind":"add-thing","thingKind":"object"}]');
    expect(result.ok).toBe(false);
  });

  test("rejects add-thing missing thingKind", () => {
    const result = parse('[{"kind":"add-thing","name":"Water"}]');
    expect(result.ok).toBe(false);
  });

  test("rejects add-link with invalid linkType", () => {
    const result = parse('[{"kind":"add-link","sourceName":"A","targetName":"B","linkType":"banana"}]');
    expect(result.ok).toBe(false);
  });

  test("rejects add-thing with invalid essence", () => {
    const result = parse('[{"kind":"add-thing","name":"X","thingKind":"object","essence":"banana"}]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("essence");
  });

  test("rejects add-thing with invalid affiliation", () => {
    const result = parse('[{"kind":"add-thing","name":"X","thingKind":"object","affiliation":"banana"}]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("affiliation");
  });

  test("rejects add-states with non-string stateNames elements", () => {
    const result = parse('[{"kind":"add-states","thingName":"Water","stateNames":[123, true]}]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("stateNames");
  });

  test("rejects empty array gracefully", () => {
    const result = parse("[]");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  // --- All 8 kinds parse correctly ---

  test("parses remove-thing", () => {
    const result = parse('[{"kind":"remove-thing","name":"Water"}]');
    expect(result.ok).toBe(true);
  });

  test("parses add-states", () => {
    const result = parse('[{"kind":"add-states","thingName":"Water","stateNames":["cold","hot"]}]');
    expect(result.ok).toBe(true);
  });

  test("parses remove-state", () => {
    const result = parse('[{"kind":"remove-state","thingName":"Water","stateName":"cold"}]');
    expect(result.ok).toBe(true);
  });

  test("parses add-link with optional states", () => {
    const result = parse('[{"kind":"add-link","sourceName":"Boiling","targetName":"Water","linkType":"effect","sourceState":"active","targetState":"hot"}]');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const desc = result.value[0] as Extract<typeof result.value[number], { kind: "add-link" }>;
    expect(desc.sourceState).toBe("active");
    expect(desc.targetState).toBe("hot");
  });

  test("parses remove-link", () => {
    const result = parse('[{"kind":"remove-link","sourceName":"A","targetName":"B","linkType":"agent"}]');
    expect(result.ok).toBe(true);
  });

  test("parses remove-modifier", () => {
    const result = parse('[{"kind":"remove-modifier","sourceName":"A","targetName":"B","linkType":"agent","modifierType":"event"}]');
    expect(result.ok).toBe(true);
  });
});
