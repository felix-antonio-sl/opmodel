import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OplSentence } from "../src/opl-types";
import {
  compileOplDocument,
  expose,
  loadModel,
  parseOplDocument,
  render,
} from "../src/index";

const FIXTURES = [
  "tests/coffee-making.opmodel",
  "tests/driver-rescuing.opmodel",
  "tests/hodom-v2.opmodel",
  "tests/hodom-hsc.opmodel",
  "tests/ev-ams.opmodel",
  "tests/hospitalizacion-domiciliaria.opmodel",
] as const;

function sentenceSignature(sentence: OplSentence): string | null {
  switch (sentence.kind) {
    case "thing-declaration":
      return JSON.stringify([
        sentence.kind,
        sentence.name,
        sentence.exhibitorName ?? null,
        sentence.thingKind,
      ]);
    case "state-enumeration":
      return JSON.stringify([
        sentence.kind,
        sentence.thingName,
        sentence.exhibitorName ?? null,
        [...sentence.stateNames].sort(),
      ]);
    case "state-description":
      return JSON.stringify([
        sentence.kind,
        sentence.thingName,
        sentence.exhibitorName ?? null,
        sentence.stateName,
        !!sentence.initial,
        !!sentence.final,
        !!sentence.default,
      ]);
    case "duration":
      return JSON.stringify([
        sentence.kind,
        sentence.thingName,
        sentence.min ?? null,
        sentence.nominal,
        sentence.max ?? null,
        sentence.unit,
      ]);
    case "attribute-value":
      return JSON.stringify([
        sentence.kind,
        sentence.thingName,
        sentence.exhibitorName,
        sentence.valueName,
      ]);
    case "grouped-structural":
      return JSON.stringify([
        sentence.kind,
        sentence.linkType,
        sentence.parentName,
        [...sentence.childNames].sort(),
        sentence.incomplete,
      ]);
    case "link":
      return JSON.stringify([
        sentence.kind,
        sentence.linkType,
        sentence.sourceName,
        sentence.targetName,
        sentence.sourceStateName ?? null,
        sentence.targetStateName ?? null,
        sentence.tag ?? null,
        sentence.direction ?? null,
        sentence.pathLabel ?? null,
        sentence.exceptionType ?? null,
      ]);
    case "modifier":
      return JSON.stringify([
        sentence.kind,
        sentence.linkType,
        sentence.sourceName,
        sentence.targetName,
        sentence.modifierType,
        sentence.sourceStateName ?? null,
        sentence.targetStateName ?? null,
        sentence.conditionMode ?? null,
        !!sentence.negated,
      ]);
    case "fan":
      return JSON.stringify([
        sentence.kind,
        sentence.fanType,
        sentence.direction,
        sentence.linkType,
        sentence.sharedEndpointName,
        [...sentence.memberNames].sort(),
      ]);
    case "requirement":
      return JSON.stringify([
        sentence.kind,
        sentence.reqCode,
        sentence.name,
        sentence.description,
        sentence.targetName,
      ]);
    case "assertion":
      return null;
    case "scenario":
      return JSON.stringify([
        sentence.kind,
        sentence.name,
        [...sentence.pathLabels].sort(),
        sentence.linkCount,
      ]);
    case "in-zoom-sequence":
      return JSON.stringify([
        sentence.kind,
        sentence.parentName,
        sentence.refinementType ?? null,
        sentence.steps.map((step) => [...step.thingNames].sort()).sort(),
      ]);
  }
}

function sortedSignatures(sentences: OplSentence[]): string[] {
  return sentences
    .map(sentenceSignature)
    .filter((signature): signature is string => signature != null)
    .sort();
}

describe("OPL fixture roundtrip", () => {
  for (const fixture of FIXTURES) {
    it(`roundtrips ${fixture}`, () => {
      const raw = readFileSync(resolve(fixture), "utf-8");
      const loaded = loadModel(raw);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;

      const exposed = expose(loaded.value, "opd-sd");
      const opl = render(exposed);
      expect(opl.trim().length).toBeGreaterThan(0);

      const parsed = parseOplDocument(opl, exposed.opdName, exposed.opdId);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;

      const compiled = compileOplDocument(parsed.value, { ignoreUnsupported: true });
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) return;

      const roundtripDoc = expose(compiled.value, "opd-sd");
      const roundtripOpl = render(roundtripDoc);
      expect(roundtripOpl.trim().length).toBeGreaterThan(0);

      const reparsed = parseOplDocument(roundtripOpl, roundtripDoc.opdName, roundtripDoc.opdId);
      expect(reparsed.ok).toBe(true);
      if (!reparsed.ok) return;

      expect(sortedSignatures(reparsed.value.sentences)).toEqual(sortedSignatures(parsed.value.sentences));
    });
  }
});
