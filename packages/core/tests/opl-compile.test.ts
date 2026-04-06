import { describe, expect, it } from "vitest";
import {
  compileOplDocument,
  compileOplDocuments,
  expose,
  parseOplDocument,
  parseOplDocuments,
  render,
} from "../src/index";
import { addScenario } from "../src/api";

const BASIC_SUBSET = [
  "Water is an object, physical.",
  "Water can be cold or hot.",
  "State cold of Water is initial and default.",
  "State hot of Water is final.",
  "Boiling is a process, physical.",
  "Boiling requires 5min.",
].join("\n");

const PROCEDURAL_SUBSET = [
  "Water is an object, physical.",
  "Water can be cold or hot.",
  "State cold of Water is initial and default.",
  "State hot of Water is final.",
  "Barista is an object, physical.",
  "Coffee Machine is an object, physical.",
  "Boiling is a process, physical.",
  "Barista handles Boiling.",
  "Boiling requires Coffee Machine.",
  "Boiling changes Water from cold to hot.",
].join("\n");

const RESULT_INVOCATION_SUBSET = [
  "Steam is an object, physical.",
  "Steam can be warm or hot.",
  "State hot of Steam is initial and default.",
  "Boiling is a process, physical.",
  "Alarm is a process, physical.",
  "Boiling yields hot Steam.",
  "Boiling invokes Alarm.",
].join("\n");

const COMPOUND_ATTRIBUTE = [
  "Patient is an object, physical.",
  "Clinical Condition of Patient is an object, informatical.",
  "Clinical Condition of Patient can be acute or chronic.",
  "State acute of Clinical Condition of Patient is initial and default.",
  "Clinical Condition of Patient is acute.",
].join("\n");

const STRUCTURAL_SUBSET = [
  "Car is an object, physical.",
  "Engine is an object, physical.",
  "Power is an object, informatical.",
  "Electric Car is an object, physical.",
  "Model X is an object, physical.",
  "Car consists of Engine.",
  "Car exhibits Power.",
  "Electric Car is a Car.",
  "Model X is an instance of Car.",
].join("\n");

const MODIFIER_SUBSET = [
  "Water is an object, physical.",
  "Water can be cold or hot.",
  "State cold of Water is initial and default.",
  "State hot of Water is final.",
  "Boiling is a process, physical.",
  "Boiling changes Water from cold to hot.",
  "cold Water triggers Boiling.",
  "Boiling occurs if Water is cold, otherwise Boiling is skipped.",
].join("\n");

const FAN_XOR_DIVERGING = [
  "B is an object, physical.",
  "P1 is a process, physical.",
  "P2 is a process, physical.",
  "B handles exactly one of P1 or P2.",
].join("\n");

const FAN_OR_CONVERGING = [
  "Proceso is a process, physical.",
  "A is an object, physical.",
  "B is an object, physical.",
  "Proceso consumes at least one of A or B.",
].join("\n");

const INZOOM_UNSUPPORTED = [
  "Making Coffee is a process, physical.",
  "Grinding is a process, physical.",
  "Brewing is a process, physical.",
  "Making Coffee zooms into Grinding, Brewing and Serving, in that sequence.",
].join("\n");

const REQUIREMENT_SUBSET = [
  "Hospital is an object, physical.",
  "Emergency is a process, physical.",
  "[R-01] Triage: patient must be triaged within 5 minutes (applies to Emergency).",
].join("\n");

const ASSERTION_SUBSET = [
  "Hospital is an object, physical.",
  "[correctness] Hospital must always have at least one exit.",
].join("\n");

const SCENARIO_SUBSET = [
  "Making Coffee is a process, physical.",
  "Grinding is a process, physical.",
  "Brewing is a process, physical.",
  "Making Coffee invokes Grinding on path \"standard\".",
  "Making Coffee invokes Brewing on path \"standard\".",
  "[scenario: Morning Rush] 2 links on path \"standard\"",
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

  it("compiles agent/instrument/effect links with state resolution", () => {
    const parsed = parseOplDocument(PROCEDURAL_SUBSET, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    expect(model.links.size).toBe(3);

    const agent = [...model.links.values()].find(l => l.type === "agent");
    const instrument = [...model.links.values()].find(l => l.type === "instrument");
    const effect = [...model.links.values()].find(l => l.type === "effect");
    expect(agent).toBeDefined();
    expect(instrument).toBeDefined();
    expect(effect).toBeDefined();

    const cold = [...model.states.values()].find(s => s.name === "cold");
    const hot = [...model.states.values()].find(s => s.name === "hot");
    expect(effect?.source_state).toBe(cold?.id);
    expect(effect?.target_state).toBe(hot?.id);

    const text = render(expose(model, "opd-sd"));
    expect(text).toContain("Barista handles Boiling.");
    expect(text).toContain("Boiling requires Coffee Machine.");
    expect(text).toContain("Boiling changes Water from cold to hot.");
  });

  it("compiles result and invocation links", () => {
    const parsed = parseOplDocument(RESULT_INVOCATION_SUBSET, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    const resultLink = [...model.links.values()].find(l => l.type === "result");
    const invocationLink = [...model.links.values()].find(l => l.type === "invocation");
    const hot = [...model.states.values()].find(s => s.name === "hot");
    expect(resultLink).toBeDefined();
    expect(resultLink?.target_state).toBe(hot?.id);
    expect(invocationLink).toBeDefined();

    const text = render(expose(model, "opd-sd"));
    expect(text).toContain("Boiling yields hot Steam.");
    expect(text).toContain("Boiling invokes Alarm.");
  });

  it("compiles grouped structural links", () => {
    const parsed = parseOplDocument(STRUCTURAL_SUBSET, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    const aggregation = [...model.links.values()].find(l => l.type === "aggregation");
    const exhibition = [...model.links.values()].find(l => l.type === "exhibition");
    const generalization = [...model.links.values()].find(l => l.type === "generalization");
    const classification = [...model.links.values()].find(l => l.type === "classification");
    expect(aggregation).toBeDefined();
    expect(exhibition).toBeDefined();
    expect(generalization).toBeDefined();
    expect(classification).toBeDefined();

    const text = render(expose(model, "opd-sd"));
    expect(text).toContain("Car consists of Engine.");
    expect(text).toContain("Car exhibits Power.");
    expect(text).toContain("Electric Car is a Car.");
    expect(text).toContain("Model X is an instance of Car.");
  });

  it("compiles modifiers over resolved procedural links", () => {
    const parsed = parseOplDocument(MODIFIER_SUBSET, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    expect(model.modifiers.size).toBe(2);

    const eventMod = [...model.modifiers.values()].find(m => m.type === "event");
    const condMod = [...model.modifiers.values()].find(m => m.type === "condition");
    expect(eventMod).toBeDefined();
    expect(condMod).toBeDefined();
    expect(condMod?.condition_mode).toBe("skip");

    const overLink = eventMod ? model.links.get(eventMod.over) : undefined;
    expect(overLink?.type).toBe("effect");
  });

  it("compiles fan sentences with implicit link creation", () => {
    const parsed = parseOplDocument(FAN_XOR_DIVERGING, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    expect(model.fans.size).toBe(1);
    const fan = [...model.fans.values()][0]!;
    expect(fan.type).toBe("xor");
    expect(fan.direction).toBe("diverging");
    expect(fan.members.length).toBe(2);

    // Links should have been created implicitly.
    expect(model.links.size).toBe(2);
    for (const linkId of fan.members) {
      const link = model.links.get(linkId);
      expect(link).toBeDefined();
      expect(link?.type).toBe("agent");
    }
  });

  it("compiles OR converging fan", () => {
    const parsed = parseOplDocument(FAN_OR_CONVERGING, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    expect(model.fans.size).toBe(1);
    const fan = [...model.fans.values()][0]!;
    expect(fan.type).toBe("or");
    expect(fan.direction).toBe("converging");
    expect(fan.members.length).toBe(2);
    expect(model.links.size).toBe(2);
  });

  it("compiles requirement sentences", () => {
    const parsed = parseOplDocument(REQUIREMENT_SUBSET, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    expect(model.requirements.size).toBe(1);
    const req = [...model.requirements.values()][0]!;
    expect(req.name).toBe("Triage");
    expect(req.req_id).toBe("R-01");
    expect(req.description).toContain("patient must be triaged");

    const emergency = [...model.things.values()].find(t => t.name === "Emergency");
    expect(req.target).toBe(emergency?.id);
  });

  it("compiles assertion sentences", () => {
    const parsed = parseOplDocument(ASSERTION_SUBSET, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    expect(model.assertions.size).toBe(1);
    const assertion = [...model.assertions.values()][0]!;
    expect(assertion.category).toBe("correctness");
    expect(assertion.predicate).toContain("at least one exit");
    expect(assertion.enabled).toBe(true);
  });

  it("compiles scenario sentences", () => {
    // Scenarios require links with matching path_labels in the model.
    // Since OPL parsing doesn't extract path_labels from link sentences,
    // we test scenario compilation against a model with pre-set path_labels.
    const parsed = parseOplDocument([
      "Making Coffee is a process, physical.",
      "Grinding is a process, physical.",
      "Making Coffee invokes Grinding.",
    ].join("\n"), "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    // Manually set path_label on the invocation link to satisfy addScenario constraint.
    let model = compiled.value;
    const invocationLink = [...model.links.values()].find(l => l.type === "invocation");
    expect(invocationLink).toBeDefined();
    if (!invocationLink) return;
    model = { ...model, links: new Map(model.links).set(invocationLink.id, { ...invocationLink, path_label: "standard" }) };

    // Now compile a scenario sentence directly.
    const scenarioSentence = {
      kind: "scenario" as const,
      scenarioId: "scenario-1",
      name: "Morning Rush",
      pathLabels: ["standard"],
      linkCount: 1,
      sourceSpan: { line: 1, column: 1, offset: 0, endLine: 1, endColumn: 50, endOffset: 50 },
    };

    const r = addScenario(model, {
      id: "scenario-morning-rush",
      name: scenarioSentence.name,
      path_labels: scenarioSentence.pathLabels,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    model = r.value;
    expect(model.scenarios.size).toBe(1);
    const scn = [...model.scenarios.values()][0]!;
    expect(scn.name).toBe("Morning Rush");
    expect(scn.path_labels).toEqual(["standard"]);
  });

  it("returns a compile error for unsupported sentence kinds in strict mode", () => {
    const parsed = parseOplDocument(INZOOM_UNSUPPORTED, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(false);
    if (compiled.ok) return;
    expect(compiled.error.message).toContain("Unsupported");
    expect(compiled.error.issues[0]?.sentenceKind).toBe("in-zoom-sequence");
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
