import { describe, expect, it } from "vitest";
import { createModel, addThing, addAppearance, addLink } from "@opmodel/core";
import type { OplSentence, OplSourceSpan } from "@opmodel/core";
import { sentenceScore, findRelatedSentenceRefs, type ParsedSentenceRef } from "../src/lib/opl-navigation";

/* ── helpers ────────────────────────────────────── */

const span: OplSourceSpan = { line: 1, column: 1, offset: 0, endLine: 1, endColumn: 10, endOffset: 9 };

function ref(sentence: OplSentence, opdName = "SD", line = 1): ParsedSentenceRef {
  return {
    doc: { opdId: "opd-sd", opdName, sentences: [sentence], renderSettings: { essenceVisibility: "all", unitsVisibility: "none", aliasVisibility: false, primaryEssence: "informatical", locale: "en" } },
    sentence,
    span: { ...span, line, endLine: line },
  };
}

/* ── sentenceScore ──────────────────────────────── */

describe("sentenceScore", () => {
  it("thing-declaration: 100 for exact name, 0 otherwise", () => {
    const s: OplSentence = { kind: "thing-declaration", thingId: "t1", name: "Water", thingKind: "object", essence: "physical", affiliation: "system" };
    expect(sentenceScore(s, "Water")).toBe(100);
    expect(sentenceScore(s, "Fire")).toBe(0);
  });

  it("state-enumeration: 90 for matching thingName", () => {
    const s: OplSentence = { kind: "state-enumeration", thingId: "t1", thingName: "Water", stateIds: [], stateNames: ["liquid", "solid"] };
    expect(sentenceScore(s, "Water")).toBe(90);
    expect(sentenceScore(s, "Fire")).toBe(0);
  });

  it("state-description: 90 for matching thingName", () => {
    const s: OplSentence = { kind: "state-description", thingId: "t1", thingName: "Water", stateId: "s1", stateName: "liquid", initial: true, final: false, default: false };
    expect(sentenceScore(s, "Water")).toBe(90);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("duration: 90 for matching thingName", () => {
    const s: OplSentence = { kind: "duration", thingId: "t1", thingName: "Boiling", nominal: 5, unit: "min" };
    expect(sentenceScore(s, "Boiling")).toBe(90);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("attribute-value: 80 for thingName or exhibitorName", () => {
    const s: OplSentence = { kind: "attribute-value", thingId: "t1", thingName: "Color", exhibitorId: "t2", exhibitorName: "Car", valueName: "red" };
    expect(sentenceScore(s, "Color")).toBe(80);
    expect(sentenceScore(s, "Car")).toBe(80);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("grouped-structural: 70 for parent or child name", () => {
    const s: OplSentence = { kind: "grouped-structural", linkType: "aggregation", parentId: "t1", parentName: "Car", parentKind: "object", childIds: ["t2", "t3"], childNames: ["Wheel", "Engine"], childKinds: ["object", "object"], incomplete: false };
    expect(sentenceScore(s, "Car")).toBe(70);
    expect(sentenceScore(s, "Wheel")).toBe(70);
    expect(sentenceScore(s, "Engine")).toBe(70);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("in-zoom-sequence: 70 for parent or step names", () => {
    const s: OplSentence = { kind: "in-zoom-sequence", parentId: "t1", parentName: "Cooking", steps: [{ thingIds: ["t2"], thingNames: ["Boiling"], parallel: false }, { thingIds: ["t3"], thingNames: ["Serving"], parallel: false }] };
    expect(sentenceScore(s, "Cooking")).toBe(70);
    expect(sentenceScore(s, "Boiling")).toBe(70);
    expect(sentenceScore(s, "Serving")).toBe(70);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("link: 60 for source or target name match", () => {
    const s: OplSentence = { kind: "link", linkId: "l1", linkType: "consumption", sourceId: "t1", targetId: "t2", sourceName: "Water", targetName: "Boiling" };
    expect(sentenceScore(s, "Water")).toBe(60);
    expect(sentenceScore(s, "Boiling")).toBe(60);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("link: 110 for exact link match (source+target)", () => {
    const s: OplSentence = { kind: "link", linkId: "l1", linkType: "consumption", sourceId: "t1", targetId: "t2", sourceName: "Water", targetName: "Boiling" };
    expect(sentenceScore(s, "Water", { source: "Water", target: "Boiling" })).toBe(110);
    expect(sentenceScore(s, "Water", { source: "Fire", target: "Boiling" })).toBe(60);
  });

  it("modifier: 50 for source or target name", () => {
    const s: OplSentence = { kind: "modifier", modifierId: "m1", linkId: "l1", linkType: "agent", sourceName: "Nurse", targetName: "Treating", modifierType: "condition", negated: false };
    expect(sentenceScore(s, "Nurse")).toBe(50);
    expect(sentenceScore(s, "Treating")).toBe(50);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("fan: 50 for shared endpoint or member names", () => {
    const s: OplSentence = { kind: "fan", fanId: "f1", fanType: "xor", direction: "diverging", linkType: "result", sharedEndpointName: "Sorting", memberNames: ["Good", "Bad"] };
    expect(sentenceScore(s, "Sorting")).toBe(50);
    expect(sentenceScore(s, "Good")).toBe(50);
    expect(sentenceScore(s, "Bad")).toBe(50);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("requirement: 40 for target name", () => {
    const s: OplSentence = { kind: "requirement", reqId: "r1", reqCode: "R-01", name: "Safety", description: "Must be safe", targetName: "System" };
    expect(sentenceScore(s, "System")).toBe(40);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("assertion: 40 for target name", () => {
    const s: OplSentence = { kind: "assertion", assertionId: "a1", predicate: "holds", targetName: "Protocol", category: "safety" };
    expect(sentenceScore(s, "Protocol")).toBe(40);
    expect(sentenceScore(s, "Other")).toBe(0);
  });

  it("scenario: always 0", () => {
    const s: OplSentence = { kind: "scenario", scenarioId: "sc1", name: "S1", pathLabels: ["l1"], linkCount: 1 };
    expect(sentenceScore(s, "Anything")).toBe(0);
  });
});

/* ── findRelatedSentenceRefs ────────────────────── */

describe("findRelatedSentenceRefs", () => {
  function buildModel() {
    let model = createModel("Test");
    const water = { id: "t-water", name: "Water", kind: "object", essence: "physical", affiliation: "system" } as const;
    const boiling = { id: "t-boiling", name: "Boiling", kind: "process", essence: "physical", affiliation: "system" } as const;
    let r = addThing(model, water); if (!r.ok) throw r.error; model = r.value;
    r = addThing(model, boiling); if (!r.ok) throw r.error; model = r.value;
    let a = addAppearance(model, { thing: "t-water", opd: "opd-sd", x: 0, y: 0, w: 100, h: 60 }); if (!a.ok) throw a.error; model = a.value;
    a = addAppearance(model, { thing: "t-boiling", opd: "opd-sd", x: 200, y: 0, w: 100, h: 60 }); if (!a.ok) throw a.error; model = a.value;
    const l = addLink(model, { id: "l-cons", type: "consumption", source: "t-water", target: "t-boiling" }); if (!l.ok) throw l.error; model = l.value;
    return model;
  }

  it("returns refs sorted by score descending, then by line", () => {
    const model = buildModel();
    const declaration = ref({ kind: "thing-declaration", thingId: "t-water", name: "Water", thingKind: "object", essence: "physical", affiliation: "system" }, "SD", 1);
    const link = ref({ kind: "link", linkId: "l-cons", linkType: "consumption", sourceId: "t-water", targetId: "t-boiling", sourceName: "Water", targetName: "Boiling" }, "SD", 3);
    const refs = [link, declaration]; // intentionally unsorted

    const result = findRelatedSentenceRefs(refs, model, "t-water", null, "opd-sd");
    expect(result).toHaveLength(2);
    expect(result[0]!.sentence.kind).toBe("thing-declaration"); // score 100+10
    expect(result[1]!.sentence.kind).toBe("link"); // score 60+10
  });

  it("applies +10 bonus for preferred OPD", () => {
    const model = buildModel();
    const sdRef = ref({ kind: "thing-declaration", thingId: "t-water", name: "Water", thingKind: "object", essence: "physical", affiliation: "system" }, "SD", 1);
    const otherRef = ref({ kind: "thing-declaration", thingId: "t-water", name: "Water", thingKind: "object", essence: "physical", affiliation: "system" }, "Other OPD", 2);

    // Without preferred OPD — same score, sorted by line
    const noPreferred = findRelatedSentenceRefs([otherRef, sdRef], model, "t-water");
    expect(noPreferred[0]!.doc.opdName).toBe("SD"); // line 1 < line 2

    // With preferred OPD = opd-sd — SD gets +10 bonus
    const withPreferred = findRelatedSentenceRefs([otherRef, sdRef], model, "t-water", null, "opd-sd");
    expect(withPreferred[0]!.doc.opdName).toBe("SD");
  });

  it("returns empty for no selection", () => {
    const model = buildModel();
    const refs = [ref({ kind: "thing-declaration", thingId: "t-water", name: "Water", thingKind: "object", essence: "physical", affiliation: "system" })];
    expect(findRelatedSentenceRefs(refs, model)).toEqual([]);
    expect(findRelatedSentenceRefs(refs, model, null, null)).toEqual([]);
  });

  it("filters out non-matching sentences", () => {
    const model = buildModel();
    const waterRef = ref({ kind: "thing-declaration", thingId: "t-water", name: "Water", thingKind: "object", essence: "physical", affiliation: "system" }, "SD", 1);
    const boilingRef = ref({ kind: "thing-declaration", thingId: "t-boiling", name: "Boiling", thingKind: "process", essence: "physical", affiliation: "system" }, "SD", 2);
    const scenarioRef = ref({ kind: "scenario", scenarioId: "sc1", name: "S1", pathLabels: [], linkCount: 0 }, "SD", 3);

    const result = findRelatedSentenceRefs([waterRef, boilingRef, scenarioRef], model, "t-water", null);
    expect(result).toHaveLength(1);
    expect(result[0]!.sentence.kind).toBe("thing-declaration");
  });
});
