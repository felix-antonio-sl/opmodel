import { describe, expect, it } from "vitest";
import {
  compileOplDocument,
  compileOplDocuments,
  expose,
  parseOplDocument,
  parseOplDocuments,
  render,
} from "../src/index";

const BASIC_SUBSET = [
  "Water is an object, physical.",
  "Water can be cold or hot.",
  "State cold of Water is initial and default.",
  "State hot of Water is final.",
  "Boiling is a process, physical.",
  "Boiling requires 5min.",
].join("\n");

const COMPOUND_ATTRIBUTE = [
  "Patient is an object, physical.",
  "Clinical Condition of Patient is an object, informatical.",
  "Clinical Condition of Patient can be acute or chronic.",
  "State acute of Clinical Condition of Patient is initial and default.",
  "Clinical Condition of Patient is acute.",
].join("\n");

describe("compileOplDocument", () => {
  it("compiles thing/state/duration subset into Model", () => {
    const parsed = parseOplDocument(BASIC_SUBSET, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    expect(model.things.size).toBe(2);
    expect(model.states.size).toBe(2);
    const water = [...model.things.values()].find(t => t.name === "Water");
    const boiling = [...model.things.values()].find(t => t.name === "Boiling");
    expect(water?.kind).toBe("object");
    expect(boiling?.duration?.nominal).toBe(5);
    expect(boiling?.duration?.unit).toBe("min");

    const cold = [...model.states.values()].find(s => s.name === "cold");
    const hot = [...model.states.values()].find(s => s.name === "hot");
    expect(cold?.initial).toBe(true);
    expect(cold?.default).toBe(true);
    expect(hot?.final).toBe(true);
  });

  it("round-trips compound attribute declarations via exhibition + default state", () => {
    const parsed = parseOplDocument(COMPOUND_ATTRIBUTE, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    expect([...model.things.values()].map(t => t.name).sort()).toEqual(["Clinical Condition", "Patient"]);

    const exhibition = [...model.links.values()].find(l => l.type === "exhibition");
    expect(exhibition).toBeDefined();

    const conditionThing = [...model.things.values()].find(t => t.name === "Clinical Condition");
    expect(conditionThing).toBeDefined();
    if (!conditionThing) return;

    const acute = [...model.states.values()].find(s => s.parent === conditionThing.id && s.name === "acute");
    expect(acute?.default).toBe(true);
    expect(acute?.current).toBe(true);

    const doc = expose(model, "opd-sd");
    const text = render(doc);
    expect(text).toContain("Clinical Condition of Patient is an object, informatical.");
    expect(text).toContain("Clinical Condition of Patient can be acute or chronic.");
    expect(text).toContain("State acute of Clinical Condition of Patient is initial and default.");
    expect(text).toContain("Clinical Condition of Patient is acute.");
  });

  it("returns a compile error for unsupported sentence kinds in strict mode", () => {
    const parsed = parseOplDocument([
      "Water is an object, physical.",
      "Boiling is a process, physical.",
      "Water handles Boiling.",
    ].join("\n"), "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(false);
    if (compiled.ok) return;
    expect(compiled.error.message).toContain("Unsupported");
    expect(compiled.error.issues[0]?.sentenceKind).toBe("link");
  });
});

describe("compileOplDocuments", () => {
  it("compiles OPD skeleton with refinement edge", () => {
    const parsed = parseOplDocuments([
      "=== SD ===",
      "Coffee Making is a process, physical.",
      "",
      "=== SD1 ===",
      "SD is refined by in-zooming Coffee Making in SD1.",
      "Grinding is a process, physical.",
    ].join("\n"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocuments(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    expect(model.opds.size).toBe(2);
    const child = [...model.opds.values()].find(o => o.name === "SD1");
    expect(child).toBeDefined();
    expect(child?.parent_opd).toBe("opd-sd");
    expect(child?.refinement_type).toBe("in-zoom");

    const coffeeMaking = [...model.things.values()].find(t => t.name === "Coffee Making");
    expect(child?.refines).toBe(coffeeMaking?.id);
  });
});
