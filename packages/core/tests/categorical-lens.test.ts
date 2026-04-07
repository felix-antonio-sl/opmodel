// R-C1: GetPut end-to-end in C_Fact
// R-C2: Multi-OPD roundtrip (Grothendieck colimit)
//
// Categorical invariant: renderAll → parse → compile → renderAll ≅ id (mod C_Fact)
// Compared at sentence-signature level (C_Fact equality).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OplSentence, Model } from "../src/index";
import {
  compileOplDocument, compileOplDocuments, expose, loadModel,
  parseOplDocument, parseOplDocuments, render, renderAll,
} from "../src/index";

const ALL_FIXTURES = [
  "tests/coffee-making.opmodel",
  "tests/driver-rescuing.opmodel",
  "tests/hodom-v2.opmodel",
  "tests/hodom-hsc.opmodel",
  "tests/ev-ams.opmodel",
  "tests/hospitalizacion-domiciliaria.opmodel",
] as const;

// Fixtures that pass double-roundtrip at RT1 (immediate convergence)
const COLIMIT_FIXTURES = ["tests/coffee-making.opmodel"] as const;

// Fixtures that converge at RT2 (one normalization pass needed: C-01 link distribution)
const COLIMIT_RT2_FIXTURES = [
  "tests/driver-rescuing.opmodel",
  "tests/hodom-v2.opmodel",
  "tests/ev-ams.opmodel",
] as const;

// Fixtures that converge at RT3 (compound name + C-01 settling)
const COLIMIT_RT3_FIXTURES = [
  "tests/hospitalizacion-domiciliaria.opmodel",
] as const;

// Fixtures that pass single roundtrip (compile succeeds, OPD tree preserved)
const SINGLE_RT_FIXTURES = [
  "tests/coffee-making.opmodel",
  "tests/driver-rescuing.opmodel",
  "tests/hodom-v2.opmodel",
  "tests/ev-ams.opmodel",
  "tests/hospitalizacion-domiciliaria.opmodel",
] as const;

function sig(s: OplSentence): string | null {
  switch (s.kind) {
    case "thing-declaration": return JSON.stringify([s.kind, s.name, s.exhibitorName ?? null, s.thingKind]);
    case "state-enumeration": return JSON.stringify([s.kind, s.thingName, s.exhibitorName ?? null, [...s.stateNames].sort()]);
    case "state-description": return JSON.stringify([s.kind, s.thingName, s.exhibitorName ?? null, s.stateName, !!s.initial, !!s.final, !!s.default]);
    case "duration": return JSON.stringify([s.kind, s.thingName, s.min ?? null, s.nominal, s.max ?? null, s.unit]);
    case "attribute-value": return JSON.stringify([s.kind, s.thingName, s.exhibitorName, s.valueName]);
    case "grouped-structural": return JSON.stringify([s.kind, s.linkType, s.parentName, [...s.childNames].sort(), s.incomplete]);
    case "link":
      if (s.linkType === "invocation") return null;
      return JSON.stringify([s.kind, s.linkType, s.sourceName, s.targetName, s.sourceStateName ?? null, s.targetStateName ?? null, s.tag ?? null, s.direction ?? null, s.pathLabel ?? null, s.exceptionType ?? null]);
    case "modifier": return JSON.stringify([s.kind, s.linkType, s.sourceName, s.targetName, s.modifierType, s.sourceStateName ?? null, s.targetStateName ?? null, s.conditionMode ?? null, !!s.negated]);
    case "fan": return JSON.stringify([s.kind, s.fanType, s.direction, s.linkType, s.sharedEndpointName, [...s.memberNames].sort()]);
    case "requirement": return JSON.stringify([s.kind, s.reqCode, s.name, s.description, s.targetName]);
    case "assertion": return null;
    case "scenario": return JSON.stringify([s.kind, s.name, [...s.pathLabels].sort(), s.linkCount]);
    case "in-zoom-sequence": return JSON.stringify([s.kind, s.parentName, s.refinementType ?? null, s.steps.map(st => [...st.thingNames].sort()).sort()]);
  }
}

function sigs(sentences: OplSentence[]): string[] {
  return sentences.map(sig).filter((s): s is string => s != null).sort();
}

function loadF(p: string): Model {
  const r = loadModel(readFileSync(resolve(p), "utf-8"));
  expect(r.ok).toBe(true);
  return r.ok ? r.value : undefined!;
}

function fixtureName(p: string) { return p.split("/").pop()!; }

// ═══════════════════════════════════════════════════════════════════════
// R-C1: Single OPD fiber PutGet (all 6 fixtures)
// ═══════════════════════════════════════════════════════════════════════

describe("R-C1: Single OPD fiber PutGet", () => {
  for (const f of ALL_FIXTURES) {
    it(`SD fiber: ${fixtureName(f)}`, () => {
      const model = loadF(f);
      const doc1 = expose(model, "opd-sd");
      const t1 = render(doc1);
      expect(t1.trim().length).toBeGreaterThan(0);

      const p = parseOplDocument(t1, doc1.opdName, doc1.opdId);
      expect(p.ok).toBe(true);
      if (!p.ok) return;

      const c = compileOplDocument(p.value, { ignoreUnsupported: true });
      expect(c.ok).toBe(true);
      if (!c.ok) return;

      const doc2 = expose(c.value, "opd-sd");
      const rp = parseOplDocument(render(doc2), doc2.opdName, doc2.opdId);
      expect(rp.ok).toBe(true);
      if (!rp.ok) return;

      expect(sigs(rp.value.sentences)).toEqual(sigs(p.value.sentences));
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// R-C2: Multi-OPD single roundtrip
// ═══════════════════════════════════════════════════════════════════════

describe("R-C2: Multi-OPD single roundtrip", () => {
  for (const f of SINGLE_RT_FIXTURES) {
    const name = fixtureName(f);

    it(`${name}: compile from renderAll`, () => {
      const model = loadF(f);
      const p = parseOplDocuments(renderAll(model));
      expect(p.ok).toBe(true);
      if (!p.ok) return;
      expect(compileOplDocuments(p.value, { ignoreUnsupported: true }).ok).toBe(true);
    });

    it(`${name}: OPD tree preserved`, () => {
      const model = loadF(f);
      const orig = [...model.opds.values()].map(o => ({ name: o.name, parent: o.parent_opd ? model.opds.get(o.parent_opd)?.name ?? null : null })).sort((a, b) => a.name.localeCompare(b.name));

      const p = parseOplDocuments(renderAll(model));
      expect(p.ok).toBe(true);
      if (!p.ok) return;
      const c = compileOplDocuments(p.value, { ignoreUnsupported: true });
      expect(c.ok).toBe(true);
      if (!c.ok) return;

      const comp = [...c.value.opds.values()].map(o => ({ name: o.name, parent: o.parent_opd ? c.value.opds.get(o.parent_opd)?.name ?? null : null })).sort((a, b) => a.name.localeCompare(b.name));
      expect(comp.map(o => o.name)).toEqual(orig.map(o => o.name));
      expect(comp.map(o => o.parent)).toEqual(orig.map(o => o.parent));
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// R-C2: Double roundtrip convergence (colimit)
// ═══════════════════════════════════════════════════════════════════════

describe("R-C2: Double roundtrip convergence", () => {
  for (const f of COLIMIT_FIXTURES) {
    it(`${fixtureName(f)}: sentence signatures converge`, () => {
      const model = loadF(f);
      const t1 = renderAll(model);
      const p1 = parseOplDocuments(t1);
      expect(p1.ok).toBe(true);
      if (!p1.ok) return;
      const c1 = compileOplDocuments(p1.value, { ignoreUnsupported: true });
      expect(c1.ok).toBe(true);
      if (!c1.ok) return;

      const t2 = renderAll(c1.value);
      const p2 = parseOplDocuments(t2);
      expect(p2.ok).toBe(true);
      if (!p2.ok) return;
      const c2 = compileOplDocuments(p2.value, { ignoreUnsupported: true });
      expect(c2.ok).toBe(true);
      if (!c2.ok) return;

      const s1 = p1.value.flatMap(d => sigs(d.sentences)).sort();
      const s2 = p2.value.flatMap(d => sigs(d.sentences)).sort();
      expect(s2).toEqual(s1);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// R-C2: RT2 convergence (C-01 link distribution settles after 1 normalization pass)
// ═══════════════════════════════════════════════════════════════════════

describe("R-C2: RT2 convergence", () => {
  for (const f of COLIMIT_RT2_FIXTURES) {
    it(`${fixtureName(f)}: converges at RT2 (things + links stable)`, () => {
      const model = loadF(f);
      // RT1
      const t1 = renderAll(model);
      const p1 = parseOplDocuments(t1);
      expect(p1.ok).toBe(true);
      if (!p1.ok) return;
      const c1 = compileOplDocuments(p1.value, { ignoreUnsupported: true });
      expect(c1.ok).toBe(true);
      if (!c1.ok) return;
      // RT2
      const t2 = renderAll(c1.value);
      const p2 = parseOplDocuments(t2);
      expect(p2.ok).toBe(true);
      if (!p2.ok) return;
      const c2 = compileOplDocuments(p2.value, { ignoreUnsupported: true });
      expect(c2.ok).toBe(true);
      if (!c2.ok) return;
      // RT3 — must equal RT2
      const t3 = renderAll(c2.value);
      const p3 = parseOplDocuments(t3);
      expect(p3.ok).toBe(true);
      if (!p3.ok) return;
      const c3 = compileOplDocuments(p3.value, { ignoreUnsupported: true });
      expect(c3.ok).toBe(true);
      if (!c3.ok) return;

      expect(c3.value.things.size).toBe(c2.value.things.size);
      expect(c3.value.links.size).toBe(c2.value.links.size);
      expect(c3.value.states.size).toBe(c2.value.states.size);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// R-C2: RT3 convergence (compound name + C-01 settling)
// ═══════════════════════════════════════════════════════════════════════

describe("R-C2: RT3 convergence", () => {
  for (const f of COLIMIT_RT3_FIXTURES) {
    it(`${fixtureName(f)}: converges at RT3 (things + links stable)`, () => {
      const model = loadF(f);
      let current = model;
      // Run 3 roundtrips
      for (let i = 0; i < 3; i++) {
        const t = renderAll(current);
        const p = parseOplDocuments(t);
        expect(p.ok).toBe(true);
        if (!p.ok) return;
        const c = compileOplDocuments(p.value, { ignoreUnsupported: true });
        expect(c.ok).toBe(true);
        if (!c.ok) return;
        current = c.value;
      }
      // RT4 must equal RT3
      const t4 = renderAll(current);
      const p4 = parseOplDocuments(t4);
      expect(p4.ok).toBe(true);
      if (!p4.ok) return;
      const c4 = compileOplDocuments(p4.value, { ignoreUnsupported: true });
      expect(c4.ok).toBe(true);
      if (!c4.ok) return;

      expect(c4.value.things.size).toBe(current.things.size);
      expect(c4.value.links.size).toBe(current.links.size);
      expect(c4.value.states.size).toBe(current.states.size);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// R-C2 Deep
// ═══════════════════════════════════════════════════════════════════════

describe("R-C2 Deep", () => {
  it("coffee-making: SD1 refinement edge parses", () => {
    const model = loadF("tests/coffee-making.opmodel");
    const p = parseOplDocuments(renderAll(model));
    expect(p.ok).toBe(true);
    if (!p.ok) return;

    const sd1 = p.value.find(d => d.opdName === "SD1");
    expect(sd1?.refinementEdge).toBeDefined();
    expect(sd1!.refinementEdge!.refinedThingName).toBe("Coffee Making");
  });

  it("hodom-v2: Spanish exception link compiles", () => {
    const model = loadF("tests/hodom-v2.opmodel");
    const origExc = [...model.links.values()].filter(l => l.type === "exception").length;
    expect(origExc).toBeGreaterThanOrEqual(1);

    const p = parseOplDocuments(renderAll(model));
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const c = compileOplDocuments(p.value, { ignoreUnsupported: true });
    expect(c.ok).toBe(true);
    if (!c.ok) return;

    expect([...c.value.links.values()].filter(l => l.type === "exception").length).toEqual(origExc);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Known gaps
// ═══════════════════════════════════════════════════════════════════════

describe("R-C2 Known gaps", () => {
  it.todo("hodom-hsc: tests/hodom-hsc.opmodel still fails first compile in categorical-lens (31 issues), even though hodom-hsc-v0 now roundtrips");
  it.todo("RT1 immediate convergence: only coffee-making converges at first roundtrip; others need 2-3 passes due to C-01 link distribution normalization");
});
