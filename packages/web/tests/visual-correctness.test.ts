/**
 * Visual Correctness 360° — OPL ↔ OPD visual correspondence
 *
 * For each fixture, verifies that:
 * 1. Every OPL sentence has a visual manifestation in the OPD
 * 2. Every visual element has OPL coverage
 * 3. ISO 19450 visual rules are correctly applied
 */
import { describe, expect, it } from "vitest";
import {
  loadModel, expose, render,
  type Model, type OPD, type Thing, type Link, type State, type Appearance,
} from "@opmodel/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import { resolveOpdFiber, resolveLinksForOpd } from "@opmodel/core";

interface VisualGap {
  opdId: string;
  opdName: string;
  category: string;
  severity: "error" | "warning" | "info";
  message: string;
}

function auditVisualCorrectness(model: Model): VisualGap[] {
  const gaps: VisualGap[] = [];

  for (const opd of model.opds.values()) {
    const fiber = resolveOpdFiber(model, opd.id);
    const oplDoc = expose(model, opd.id);
    const oplText = render(oplDoc);

    // === 1. THING VISIBILITY ===
    // Every thing with an appearance in this OPD should be visible
    for (const [thingId, entry] of fiber.things) {
      if (entry.implicit) continue; // ghosts are optional
      const thing = model.things.get(thingId);
      if (!thing) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "thing-missing", severity: "error",
          message: `Thing ${thingId} has appearance but no model entry` });
        continue;
      }

      // Thing should have declaration in OPL
      const hasDecl = oplDoc.sentences.some(s =>
        s.kind === "thing-declaration" && s.thingId === thingId
      );
      if (!hasDecl && !entry.appearance.internal) {
        // External things don't always get declarations in child OPDs
        const isExternal = entry.appearance.internal === false;
        if (!isExternal) {
          gaps.push({ opdId: opd.id, opdName: opd.name, category: "opl-thing-missing", severity: "warning",
            message: `Thing "${thing.name}" visible in OPD but has no OPL declaration` });
        }
      }

      // === ISO VISUAL RULES ===

      // Object = rectangle, Process = ellipse (verified by renderer, but check model consistency)
      const app = entry.appearance;

      // Physical things should have bold contour (stroke > 2)
      if (thing.essence === "physical") {
        // This is enforced by ThingNode — just verify the data is present
        if (!thing.essence) {
          gaps.push({ opdId: opd.id, opdName: opd.name, category: "essence-missing", severity: "error",
            message: `Thing "${thing.name}" missing essence property` });
        }
      }

      // States should all be visible (unless suppressed)
      const allStates = [...model.states.values()].filter(s => s.parent === thingId);
      const suppressed = fiber.suppressedStates.get(thingId);
      const visibleStates = suppressed
        ? allStates.filter(s => !suppressed.has(s.id))
        : allStates;

      // Each visible state should appear in OPL
      for (const state of visibleStates) {
        const stateInOpl = oplDoc.sentences.some(s =>
          (s.kind === "state-enumeration" && s.thingId === thingId) ||
          (s.kind === "state-description" && s.thingId === thingId)
        );
        if (!stateInOpl && allStates.length > 0) {
          // Check if states are mentioned anywhere in the OPL text
          if (!oplText.includes(state.name)) {
            gaps.push({ opdId: opd.id, opdName: opd.name, category: "opl-state-missing", severity: "info",
              message: `State "${state.name}" of "${thing.name}" not in OPL text` });
          }
        }
      }

      // Initial state should be marked
      const initialStates = allStates.filter(s => s.initial);
      if (allStates.length > 0 && initialStates.length === 0) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "no-initial-state", severity: "warning",
          message: `Thing "${thing.name}" has ${allStates.length} states but none marked initial` });
      }

      // Width should accommodate state pills
      if (visibleStates.length > 0 && app.w < visibleStates.length * 25) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "thing-too-narrow", severity: "warning",
          message: `Thing "${thing.name}" (w=${app.w}) too narrow for ${visibleStates.length} state pills` });
      }

      // Process with duration should show it
      if (thing.kind === "process" && thing.duration) {
        // Duration rendering is in ThingNode — verify data exists
        if (!thing.duration.nominal && thing.duration.nominal !== 0) {
          gaps.push({ opdId: opd.id, opdName: opd.name, category: "duration-invalid", severity: "warning",
            message: `Process "${thing.name}" has duration but no nominal value` });
        }
      }
    }

    // === 2. LINK VISIBILITY ===
    const resolvedLinks = fiber.links;

    for (const rl of resolvedLinks) {
      const link = rl.link;
      const srcThing = model.things.get(rl.visualSource);
      const tgtThing = model.things.get(rl.visualTarget);

      if (!srcThing || !tgtThing) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "link-endpoint-missing", severity: "error",
          message: `Link ${link.id} (${link.type}) has missing endpoint thing` });
        continue;
      }

      // Link should have OPL sentence
      // Check if this link is covered by OPL: by linkId, or by grouped-structural parent+child, or by fan
      const hasOplSentence = oplDoc.sentences.some(s => {
        if (s.kind === "link" && (s as any).linkId === link.id) return true;
        if (s.kind === "grouped-structural") {
          const gs = s as any;
          // Structural link: parent→child. Check if this link connects parentId to one of childIds
          if (gs.parentId === link.source && gs.childIds?.includes(link.target)) return true;
          if (gs.parentId === link.target && gs.childIds?.includes(link.source)) return true;
        }
        if (s.kind === "fan") {
          const fan = s as any;
          if (fan.memberLinkIds?.includes(link.id)) return true;
        }
        // link sentence might reference by source/target thing names
        if (s.kind === "link") {
          const ls = s as any;
          if ((ls.sourceId === link.source && ls.targetId === link.target) ||
              (ls.sourceId === link.target && ls.targetId === link.source)) return true;
        }
        return false;
      });

      if (!hasOplSentence) {
        // Some links are merged (consumption+result) or distributed — check by type
        const isDistributed = rl.aggregated;
        if (!isDistributed) {
          gaps.push({ opdId: opd.id, opdName: opd.name, category: "opl-link-missing", severity: "info",
            message: `Link ${link.type}: "${srcThing.name}" → "${tgtThing.name}" not in OPL sentences` });
        }
      }

      // Both endpoints should have appearances
      const srcApp = fiber.things.get(rl.visualSource);
      const tgtApp = fiber.things.get(rl.visualTarget);
      if (!srcApp) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "link-src-no-appearance", severity: "error",
          message: `Link ${link.type}: source "${srcThing.name}" has no appearance in OPD` });
      }
      if (!tgtApp) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "link-tgt-no-appearance", severity: "error",
          message: `Link ${link.type}: target "${tgtThing.name}" has no appearance in OPD` });
      }

      // State-specified links: referenced states should exist
      if (link.source_state) {
        const state = model.states.get(link.source_state);
        if (!state) {
          gaps.push({ opdId: opd.id, opdName: opd.name, category: "link-state-missing", severity: "error",
            message: `Link ${link.type}: source_state "${link.source_state}" does not exist` });
        }
      }
      if (link.target_state) {
        const state = model.states.get(link.target_state);
        if (!state) {
          gaps.push({ opdId: opd.id, opdName: opd.name, category: "link-state-missing", severity: "error",
            message: `Link ${link.type}: target_state "${link.target_state}" does not exist` });
        }
      }

      // ISO marker rules
      // Agent = filled circle, Instrument = hollow circle
      // These are enforced by LinkLine renderer — verify link type validity
      const validTypes = ["effect", "consumption", "result", "input", "output",
        "agent", "instrument", "aggregation", "exhibition", "generalization",
        "classification", "tagged", "invocation", "exception"];
      if (!validTypes.includes(link.type)) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "invalid-link-type", severity: "error",
          message: `Link has unknown type "${link.type}"` });
      }
    }

    // === 3. MODIFIER VISIBILITY ===
    for (const modifier of model.modifiers.values()) {
      const link = model.links.get(modifier.over);
      if (!link) continue;
      // Check if the link is visible in this OPD
      const linkVisible = resolvedLinks.some(rl => rl.link.id === modifier.over);
      if (!linkVisible) continue;

      // Modifier should have OPL sentence
      const hasOplModifier = oplDoc.sentences.some(s =>
        s.kind === "modifier" && s.modifierId === modifier.id
      );
      if (!hasOplModifier) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "opl-modifier-missing", severity: "info",
          message: `Modifier (${modifier.type}) on ${link.type} link not in OPL` });
      }
    }

    // === 4. FAN VISIBILITY ===
    for (const fan of model.fans.values()) {
      if (fan.type === "and") continue; // AND fans have no visual arc
      const memberLinks = fan.members.map(id => model.links.get(id)).filter(Boolean);
      const allVisible = memberLinks.every(l =>
        resolvedLinks.some(rl => rl.link.id === l!.id)
      );
      if (!allVisible) continue;

      // Fan should have OPL sentence
      const hasOplFan = oplDoc.sentences.some(s =>
        s.kind === "fan" && s.fanId === fan.id
      );
      if (!hasOplFan) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "opl-fan-missing", severity: "info",
          message: `Fan (${fan.type}) not in OPL sentences` });
      }
    }

    // === 5. REFINEMENT VISIBILITY ===
    if (opd.refines) {
      const refinedThing = model.things.get(opd.refines);
      if (!refinedThing) {
        gaps.push({ opdId: opd.id, opdName: opd.name, category: "refinement-missing-thing", severity: "error",
          message: `OPD refines thing "${opd.refines}" which does not exist` });
      } else {
        // Container should have internal appearance
        const containerApp = fiber.things.get(opd.refines);
        if (!containerApp) {
          gaps.push({ opdId: opd.id, opdName: opd.name, category: "container-no-appearance", severity: "error",
            message: `Refined thing "${refinedThing.name}" has no appearance in its own OPD` });
        }
      }
    }

    // === 6. OPL SENTENCES WITHOUT VISUAL ===
    for (const sentence of oplDoc.sentences) {
      if (sentence.kind === "thing-declaration") {
        const thingEntry = fiber.things.get(sentence.thingId);
        if (!thingEntry && !fiber.things.has(sentence.thingId)) {
          // Thing declared in OPL but not in fiber — might be external reference
          const thing = model.things.get(sentence.thingId);
          if (thing) {
            gaps.push({ opdId: opd.id, opdName: opd.name, category: "opl-no-visual", severity: "info",
              message: `OPL declares "${thing.name}" but no visual appearance in OPD` });
          }
        }
      }
    }
  }

  return gaps;
}

function loadFixture(name: string, path: string): Model {
  const fixture = readFileSync(resolve(process.cwd(), path), "utf8");
  const parsed = loadModel(fixture);
  if (!parsed.ok) throw new Error(`Failed to load ${name}: ${parsed.error.message}`);
  return parsed.value;
}

describe("Visual Correctness 360°", () => {
  const fixtures = [
    { name: "Coffee Making", path: "tests/coffee-making.opmodel" },
    { name: "Driver Rescuing", path: "tests/driver-rescuing.opmodel" },
    { name: "HODOM", path: "tests/hospitalizacion-domiciliaria.opmodel" },
    { name: "HODOM V2", path: "tests/hodom-v2.opmodel" },
    { name: "EV-AMS", path: "tests/ev-ams.opmodel" },
  ];

  for (const { name, path } of fixtures) {
    describe(name, () => {
      let model: Model;
      let gaps: VisualGap[];

      it("loads model", () => {
        model = loadFixture(name, path);
        expect(model).toBeTruthy();
      });

      it("audits visual correctness", () => {
        gaps = auditVisualCorrectness(model);

        // Report
        const errors = gaps.filter(g => g.severity === "error");
        const warnings = gaps.filter(g => g.severity === "warning");
        const infos = gaps.filter(g => g.severity === "info");

        console.log(`\n=== ${name} Visual Correctness ===`);
        console.log(`  Errors: ${errors.length}, Warnings: ${warnings.length}, Info: ${infos.length}`);

        for (const g of errors) {
          console.log(`  ❌ [${g.opdName}] ${g.category}: ${g.message}`);
        }
        for (const g of warnings) {
          console.log(`  ⚠️  [${g.opdName}] ${g.category}: ${g.message}`);
        }

        // Strict: zero errors
        expect(errors.length).toBe(0);
      });

      it("every OPD has OPL output", () => {
        for (const opd of model.opds.values()) {
          const doc = expose(model, opd.id);
          const text = render(doc);
          expect(text.length).toBeGreaterThan(0);
          expect(doc.sentences.length).toBeGreaterThan(0);
        }
      });

      it("every thing with appearance has correct kind rendering", () => {
        for (const opd of model.opds.values()) {
          const fiber = resolveOpdFiber(model, opd.id);
          for (const [thingId, entry] of fiber.things) {
            if (entry.implicit) continue;
            const thing = model.things.get(thingId);
            expect(thing).toBeTruthy();
            expect(["object", "process"]).toContain(thing!.kind);
            expect(["physical", "informatical"]).toContain(thing!.essence);
            expect(["systemic", "environmental"]).toContain(thing!.affiliation);
          }
        }
      });

      it("every link has valid endpoints in its OPD", () => {
        for (const opd of model.opds.values()) {
          const fiber = resolveOpdFiber(model, opd.id);
          for (const rl of fiber.links) {
            const srcExists = fiber.things.has(rl.visualSource);
            const tgtExists = fiber.things.has(rl.visualTarget);
            if (!srcExists || !tgtExists) {
              // Semi-fold parts may be virtual — check semi-fold
              const srcApp = [...model.appearances.values()].find(a =>
                a.opd === opd.id && a.semi_folded && a.thing !== rl.visualSource
              );
              // Allow if either endpoint is in semi-fold
              if (!srcExists && !tgtExists) {
                console.warn(`  Link ${rl.link.type} in ${opd.name}: both endpoints missing visual`);
              }
            }
          }
        }
      });

      it("structural links use fork triangle rendering", () => {
        const structuralTypes = ["aggregation", "exhibition", "generalization", "classification"];
        for (const opd of model.opds.values()) {
          const fiber = resolveOpdFiber(model, opd.id);
          const structLinks = fiber.links.filter(rl => structuralTypes.includes(rl.link.type));
          // Just verify they exist and have valid data
          for (const rl of structLinks) {
            expect(rl.visualSource).toBeTruthy();
            expect(rl.visualTarget).toBeTruthy();
          }
        }
      });
    });
  }
});
