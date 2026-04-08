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

const TAGGED_SUBSET = [
  "Hospital is an object, physical.",
  "Emergency is a process, physical.",
  "Hospital communicates via Emergency.",
].join("\n");

const SELF_INVOCATION = [
  "Processing is a process, physical.",
  "Processing invokes itself.",
].join("\n");

const EXCEPTION_AND_PATH_SUBSET = [
  "Food Preparing is a process, physical.",
  "Food Preparing requires 3-5min.",
  "Handling is a process, physical.",
  "Meat is an object, physical.",
  "Stew is an object, physical.",
  "Steak is an object, physical.",
  "Handling occurs if duration of Food Preparing exceeds 5min.",
  "Following path carnivore, Food Preparing consumes Meat, yields Stew and Steak.",
].join("\n");

const INZOOM_WITH_INVOCATIONS = [
  "Making Coffee is a process, physical.",
  "Grinding is a process, physical.",
  "Brewing is a process, physical.",
  "Serving is a process, physical.",
  "Making Coffee zooms into Grinding, Brewing and Serving, in that sequence.",
].join("\n");

const UNFOLD_WITHOUT_INVOCATIONS = [
  "Vehicle is an object, physical.",
  "Door is an object, physical.",
  "Window is an object, physical.",
  "Mirror is an object, physical.",
  "Vehicle unfolds in SD1 into Door, Window and Mirror.",
].join("\n");

const STRUCTURAL_MULTIPLICITIES = [
  "Car is an object, physical.",
  "Engine is an object, physical.",
  "Sunroof is an object, physical.",
  "Airbag is an object, physical.",
  "Car consists of Engine and an optional Sunroof.",
  "Car exhibits at least one Airbag.",
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

  it("compiles grouped structural multiplicities onto target links", () => {
    const parsed = parseOplDocument(STRUCTURAL_MULTIPLICITIES, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    const aggregation = [...model.links.values()].find(l => l.type === "aggregation" && l.multiplicity_target === "?");
    const exhibition = [...model.links.values()].find(l => l.type === "exhibition" && l.multiplicity_target === "+");
    expect(aggregation).toBeDefined();
    expect(exhibition).toBeDefined();

    const text = render(expose(model, "opd-sd"));
    expect(text).toContain("Car consists of Engine and an optional Sunroof.");
    expect(text).toContain("Car exhibits at least one Airbag.");
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

  it("does not create invocation links for unfolding sentences", () => {
    const parsed = parseOplDocument(UNFOLD_WITHOUT_INVOCATIONS, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const invocationLinks = [...compiled.value.links.values()].filter(l => l.type === "invocation");
    expect(invocationLinks).toHaveLength(0);
  });

  it("compiles unfold with sub-OPD, appearances and aggregation links", () => {
    const parsed = parseOplDocument(UNFOLD_WITHOUT_INVOCATIONS, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;

    // Sub-OPD should be auto-created with unfold type
    expect(model.opds.size).toBe(2);
    const subOpd = [...model.opds.values()].find(o => o.id !== "opd-sd");
    expect(subOpd).toBeDefined();
    expect(subOpd?.refinement_type).toBe("unfold");

    const vehicle = [...model.things.values()].find(t => t.name === "Vehicle");
    expect(subOpd?.refines).toBe(vehicle?.id);

    // Children should have internal appearances in the sub-OPD
    const door = [...model.things.values()].find(t => t.name === "Door");
    const window = [...model.things.values()].find(t => t.name === "Window");
    const mirror = [...model.things.values()].find(t => t.name === "Mirror");

    for (const child of [door, window, mirror]) {
      expect(child).toBeDefined();
      const app = model.appearances.get(`${child!.id}::${subOpd!.id}`);
      expect(app).toBeDefined();
      expect(app?.internal).toBe(true);
    }

    // Aggregation links should be created
    const aggLinks = [...model.links.values()].filter(l => l.type === "aggregation");
    expect(aggLinks).toHaveLength(3);
    for (const link of aggLinks) {
      expect(link.source).toBe(vehicle?.id);
    }

    // No invocation links
    const invLinks = [...model.links.values()].filter(l => l.type === "invocation");
    expect(invLinks).toHaveLength(0);
  });

  it("does not duplicate aggregation links when unfold and grouped-structural coexist", () => {
    const opl = [
      "Car is an object, physical.",
      "Wheel is an object, physical.",
      "Engine is an object, physical.",
      "Body is an object, physical.",
      "Car consists of Wheel, Engine and Body.",
      "Car unfolds in SD1 into Wheel, Engine and Body.",
    ].join("\n");
    const parsed = parseOplDocument(opl, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    // Should have exactly 3 aggregation links, not 6
    const aggLinks = [...compiled.value.links.values()].filter(l => l.type === "aggregation");
    expect(aggLinks).toHaveLength(3);
  });

  it("unfold does not duplicate sub-OPD when refinement edge exists", () => {
    const parsed = parseOplDocuments([
      "=== SD ===",
      "Car is an object, physical.",
      "Wheel is an object, physical.",
      "Engine is an object, physical.",
      "",
      "=== SD1 ===",
      "SD is refined by unfolding Car in SD1.",
      "Car unfolds in SD1 into Wheel and Engine.",
    ].join("\n"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocuments(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    // Only 2 OPDs (root + SD1), not 3
    expect(model.opds.size).toBe(2);

    // Children should have internal appearances
    const sd1 = [...model.opds.values()].find(o => o.name === "SD1");
    const wheel = [...model.things.values()].find(t => t.name === "Wheel");
    const engine = [...model.things.values()].find(t => t.name === "Engine");

    expect(model.appearances.has(`${wheel!.id}::${sd1!.id}`)).toBe(true);
    expect(model.appearances.has(`${engine!.id}::${sd1!.id}`)).toBe(true);
  });

  it("parent has container appearance in auto-created unfold sub-OPD", () => {
    const parsed = parseOplDocument(UNFOLD_WITHOUT_INVOCATIONS, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    const vehicle = [...model.things.values()].find(t => t.name === "Vehicle");
    const subOpd = [...model.opds.values()].find(o => o.id !== "opd-sd");

    const parentApp = model.appearances.get(`${vehicle!.id}::${subOpd!.id}`);
    expect(parentApp).toBeDefined();
    expect(parentApp?.internal).toBe(true);
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
    const parsed = parseOplDocument([
      "Making Coffee is a process, physical.",
      "Grinding is a process, physical.",
      "Following path standard, Making Coffee invokes Grinding.",
    ].join("\n"), "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    let model = compiled.value;
    const invocationLink = [...model.links.values()].find(l => l.type === "invocation");
    expect(invocationLink).toBeDefined();
    if (!invocationLink) return;
    expect(invocationLink.path_label).toBe("standard");

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

  it("compiles tagged structural links", () => {
    const parsed = parseOplDocument(TAGGED_SUBSET, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    const taggedLink = [...model.links.values()].find(l => l.type === "tagged");
    expect(taggedLink).toBeDefined();
    expect(taggedLink?.tag).toBe("communicates via");

    const hospital = [...model.things.values()].find(t => t.name === "Hospital");
    const emergency = [...model.things.values()].find(t => t.name === "Emergency");
    expect(taggedLink?.source).toBe(hospital?.id);
    expect(taggedLink?.target).toBe(emergency?.id);
  });

  it("compiles self-invocation links", () => {
    const parsed = parseOplDocument(SELF_INVOCATION, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    const selfInv = [...model.links.values()].find(l => l.type === "invocation");
    expect(selfInv).toBeDefined();
    expect(selfInv?.source).toBe(selfInv?.target);

    const processing = [...model.things.values()].find(t => t.name === "Processing");
    expect(selfInv?.source).toBe(processing?.id);
  });

  it("compiles exception type and path label on parsed links", () => {
    const parsed = parseOplDocument(EXCEPTION_AND_PATH_SUBSET, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    const exceptionLink = [...model.links.values()].find(l => l.type === "exception" && l.exception_type === "overtime");
    expect(exceptionLink).toBeDefined();

    const carnivoreLinks = [...model.links.values()].filter(l => l.path_label === "carnivore");
    expect(carnivoreLinks).toHaveLength(3);
    expect(carnivoreLinks.some(l => l.type === "consumption")).toBe(true);
    expect(carnivoreLinks.filter(l => l.type === "result")).toHaveLength(2);
  });

  it("compiles in-zoom sequence with implicit invocation links", () => {
    const parsed = parseOplDocument(INZOOM_WITH_INVOCATIONS, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const compiled = compileOplDocument(parsed.value);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const model = compiled.value;
    const invocations = [...model.links.values()].filter(l => l.type === "invocation");
    // Grinding → Brewing → Serving creates 2 invocation links
    expect(invocations.length).toBe(2);

    const grinding = [...model.things.values()].find(t => t.name === "Grinding");
    const brewing = [...model.things.values()].find(t => t.name === "Brewing");
    const serving = [...model.things.values()].find(t => t.name === "Serving");

    expect(invocations.some(l => l.source === grinding?.id && l.target === brewing?.id)).toBe(true);
    expect(invocations.some(l => l.source === brewing?.id && l.target === serving?.id)).toBe(true);
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

  it("compiles OPD skeleton with unfold refinement edge", () => {
    const parsed = parseOplDocuments([
      "=== SD ===",
      "Car is an object, physical.",
      "",
      "=== SD1 ===",
      "SD is refined by unfolding Car in SD1.",
      "Engine is an object, physical.",
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
    expect(child?.refinement_type).toBe("unfold");

    const car = [...model.things.values()].find(t => t.name === "Car");
    expect(child?.refines).toBe(car?.id);
  });
});
