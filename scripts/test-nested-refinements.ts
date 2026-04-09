#!/usr/bin/env bun
/**
 * Test: Nested OPD refinements (SD -> SD1 -> SD1.1) through kernel pipeline.
 * Checks fiber isolation, link distribution/cascade, refines metadata.
 */

import {
  parseOplDocuments,
  compileToKernel,
  compileOplDocuments,
  exposeSemanticKernel,
  legacyModelFromSemanticKernel,
  resolveOpdFiber,
  resolveLinksForOpd,
  loadModel,
} from "../packages/core/src/index";
import type { Model, OPD, ResolvedLink } from "../packages/core/src/index";
import { readFileSync } from "fs";

let failures = 0;
let passes = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passes++;
  } else {
    failures++;
    console.log(`FAIL: ${msg}`);
  }
}

function thingNames(model: Model, opdId: string): Set<string> {
  const fiber = resolveOpdFiber(model, opdId);
  const names = new Set<string>();
  for (const entry of fiber.things.values()) {
    names.add(entry.thing.name);
  }
  return names;
}

function linkSummary(model: Model, opdId: string): { type: string; src: string; tgt: string; agg: boolean }[] {
  const links = resolveLinksForOpd(model, opdId);
  return links.map(l => {
    const src = model.things.get(l.visualSource)?.name ?? l.visualSource;
    const tgt = model.things.get(l.visualTarget)?.name ?? l.visualTarget;
    return { type: l.link.type, src, tgt, agg: l.aggregated };
  });
}

// ========== PART 1: Synthetic 3-level OPL ==========

const opl = `=== SD ===
System is an object, physical.
Main Processing is a process, physical.
System exhibits Main Processing.
Data is an object, informatical.
Main Processing changes Data.

=== SD1 ===
SD is refined by in-zooming Main Processing in SD1.
Main Processing is a process, physical.
System exhibits Main Processing.
Sub A is a process, physical.
Sub B is a process, physical.
Main Processing zooms into Sub A and Sub B, in that sequence.

=== SD1.1 ===
SD1 is refined by in-zooming Sub A in SD1.1.
Sub A is a process, physical.
Sub A1 is a process, physical.
Sub A2 is a process, physical.
Sub A zooms into Sub A1 and Sub A2, in that sequence.
`;

console.log("=== PART 1: Synthetic 3-level nested refinement ===\n");

// Step 1: Parse
const parseResult = parseOplDocuments(opl);
if (!parseResult.ok) {
  console.log("PARSE FAILED:", parseResult.error);
  process.exit(1);
}
const docs = parseResult.value;
console.log(`Parsed ${docs.length} documents: ${docs.map(d => d.opdName).join(", ")}`);

// Step 2: Check refinement edges parsed correctly
assert(docs[0]!.opdName === "SD", "Doc 0 is SD");
assert(!docs[0]!.refinementEdge, "SD has no refinement edge");
assert(docs[1]!.opdName === "SD1", "Doc 1 is SD1");
assert(docs[1]!.refinementEdge?.refinementType === "in-zoom", "SD1 refines by in-zoom");
assert(docs[1]!.refinementEdge?.refinedThingName === "Main Processing", "SD1 refines Main Processing");
assert(docs[1]!.refinementEdge?.parentOpdName === "SD", "SD1 parent is SD");
assert(docs[2]!.opdName === "SD1.1", "Doc 2 is SD1.1");
assert(docs[2]!.refinementEdge?.refinementType === "in-zoom", "SD1.1 refines by in-zoom");
assert(docs[2]!.refinementEdge?.refinedThingName === "Sub A", "SD1.1 refines Sub A");
assert(docs[2]!.refinementEdge?.parentOpdName === "SD1", "SD1.1 parent is SD1");

// Step 3: Compile through kernel pipeline
const kernelResult = compileToKernel(docs);
if (!kernelResult.ok) {
  console.log("KERNEL COMPILE FAILED:", kernelResult.error);
  process.exit(1);
}
const kernel = kernelResult.value;
console.log(`Kernel: ${kernel.things.size} things, ${kernel.links.size} links, ${kernel.opds.size} OPDs`);

// Step 4: Convert to legacy model
const atlas = exposeSemanticKernel(kernel);
const model = legacyModelFromSemanticKernel(kernel, atlas);
console.log(`Model: ${model.things.size} things, ${model.links.size} links, ${model.opds.size} OPDs, ${model.appearances.size} appearances`);

// Step 5: Find OPD IDs
const opdsByName = new Map<string, OPD>();
for (const opd of model.opds.values()) {
  opdsByName.set(opd.name, opd);
}
console.log("\nOPDs:");
for (const [name, opd] of opdsByName) {
  const refinesName = opd.refines ? model.things.get(opd.refines)?.name ?? opd.refines : "none";
  console.log(`  ${name}: id=${opd.id}, parent=${opd.parent_opd}, refines=${refinesName}, type=${opd.refinement_type ?? "none"}`);
}

const sd = opdsByName.get("SD")!;
const sd1 = opdsByName.get("SD1")!;
const sd11 = opdsByName.get("SD1.1")!;

assert(!!sd, "SD OPD exists");
assert(!!sd1, "SD1 OPD exists");
assert(!!sd11, "SD1.1 OPD exists");

// Step 6: Check OPD hierarchy
assert(sd1.parent_opd === sd.id, "SD1 parent is SD");
assert(sd11.parent_opd === sd1.id, "SD1.1 parent is SD1");

// Step 7: Check refines metadata
assert(sd1.refinement_type === "in-zoom", "SD1 refinement_type is in-zoom");
assert(sd11.refinement_type === "in-zoom", "SD1.1 refinement_type is in-zoom");

const mainProc = [...model.things.values()].find(t => t.name === "Main Processing");
const subA = [...model.things.values()].find(t => t.name === "Sub A");
assert(!!mainProc, "Main Processing thing exists");
assert(!!subA, "Sub A thing exists");
if (mainProc) assert(sd1.refines === mainProc.id, "SD1 refines Main Processing thing");
if (subA) assert(sd11.refines === subA.id, "SD1.1 refines Sub A thing");

// Step 8: Check fiber isolation
console.log("\n--- Fiber check ---");
const sdThings = thingNames(model, sd.id);
const sd1Things = thingNames(model, sd1.id);
const sd11Things = thingNames(model, sd11.id);

console.log(`SD things: ${[...sdThings].join(", ")}`);
console.log(`SD1 things: ${[...sd1Things].join(", ")}`);
console.log(`SD1.1 things: ${[...sd11Things].join(", ")}`);

// SD should NOT contain subprocesses
assert(!sdThings.has("Sub A"), "SD should NOT contain Sub A");
assert(!sdThings.has("Sub B"), "SD should NOT contain Sub B");
assert(!sdThings.has("Sub A1"), "SD should NOT contain Sub A1");
assert(!sdThings.has("Sub A2"), "SD should NOT contain Sub A2");
assert(sdThings.has("System"), "SD should contain System");
assert(sdThings.has("Main Processing"), "SD should contain Main Processing");
assert(sdThings.has("Data"), "SD should contain Data");

// SD1 should contain Sub A, Sub B, Main Processing (container), System (external)
// but NOT Sub A1, Sub A2
assert(sd1Things.has("Sub A"), "SD1 should contain Sub A");
assert(sd1Things.has("Sub B"), "SD1 should contain Sub B");
assert(sd1Things.has("Main Processing"), "SD1 should contain Main Processing (container)");
assert(!sd1Things.has("Sub A1"), "SD1 should NOT contain Sub A1");
assert(!sd1Things.has("Sub A2"), "SD1 should NOT contain Sub A2");

// SD1.1 should contain Sub A (container), Sub A1, Sub A2
assert(sd11Things.has("Sub A"), "SD1.1 should contain Sub A (container)");
assert(sd11Things.has("Sub A1"), "SD1.1 should contain Sub A1");
assert(sd11Things.has("Sub A2"), "SD1.1 should contain Sub A2");

// Step 9: Check link distribution
console.log("\n--- Link distribution ---");
const sdLinks = linkSummary(model, sd.id);
const sd1Links = linkSummary(model, sd1.id);
const sd11Links = linkSummary(model, sd11.id);

console.log("SD links:");
for (const l of sdLinks) console.log(`  ${l.type}: ${l.src} -> ${l.tgt} (agg=${l.agg})`);

console.log("SD1 links:");
for (const l of sd1Links) console.log(`  ${l.type}: ${l.src} -> ${l.tgt} (agg=${l.agg})`);

console.log("SD1.1 links:");
for (const l of sd11Links) console.log(`  ${l.type}: ${l.src} -> ${l.tgt} (agg=${l.agg})`);

// In SD: effect link between Main Processing and Data should be direct
const sdEffect = sdLinks.filter(l => l.type === "effect");
assert(sdEffect.length > 0, "SD should have effect link (Main Processing changes Data)");

// In SD1: the "changes Data" effect should be distributed to Sub A and Sub B (aggregated)
const sd1Effect = sd1Links.filter(l => l.type === "effect");
console.log(`\nSD1 effect links: ${sd1Effect.length}`);
for (const l of sd1Effect) console.log(`  ${l.src} -> ${l.tgt} (agg=${l.agg})`);
assert(sd1Effect.length >= 2, "SD1 should distribute effect link to subprocesses (>= 2 effect links)");
const sd1EffectToSubA = sd1Effect.some(l => l.src === "Sub A" || l.tgt === "Sub A");
const sd1EffectToSubB = sd1Effect.some(l => l.src === "Sub B" || l.tgt === "Sub B");
assert(sd1EffectToSubA, "SD1 effect should reach Sub A");
assert(sd1EffectToSubB, "SD1 effect should reach Sub B");

// In SD: exhibition link between System and Main Processing
const sdExhibition = sdLinks.filter(l => l.type === "exhibition");
assert(sdExhibition.length > 0, "SD should have exhibition link (System exhibits Main Processing)");

// In SD1: exhibition link should still be present (structural)
const sd1Exhibition = sd1Links.filter(l => l.type === "exhibition");
console.log(`\nSD1 exhibition links: ${sd1Exhibition.length}`);
for (const l of sd1Exhibition) console.log(`  ${l.src} -> ${l.tgt} (agg=${l.agg})`);

// Step 10: Check SD1.1 cascading
// In SD1.1, if Sub A has links distributed from parent, they should cascade further
const sd11Effect = sd11Links.filter(l => l.type === "effect");
console.log(`\nSD1.1 effect links: ${sd11Effect.length}`);
for (const l of sd11Effect) console.log(`  ${l.src} -> ${l.tgt} (agg=${l.agg})`);

// Step 11: Check kernel refinements
console.log("\n--- Kernel refinements ---");
for (const [id, ref] of kernel.refinements) {
  const parent = kernel.things.get(ref.parentThing)?.name ?? ref.parentThing;
  console.log(`  ${id}: kind=${ref.kind}, parent=${parent}, childOpd=${ref.childOpd}, steps=${ref.kind === "in-zoom" ? ref.steps.length : "N/A"}`);
  if (ref.kind === "in-zoom") {
    for (const step of ref.steps) {
      const names = step.thingIds.map(id => kernel.things.get(id)?.name ?? id).join(", ");
      console.log(`    step: [${names}] (${step.execution})`);
    }
  }
}

// ========== PART 2: Existing fixtures ==========
console.log("\n\n=== PART 2: Existing fixture refinement analysis ===\n");

const fixtures = [
  "tests/coffee-making.opmodel",
  "tests/hospitalizacion-domiciliaria.opmodel",
  "tests/driver-rescuing.opmodel",
  "tests/hodom-v2.opmodel",
];

for (const fixture of fixtures) {
  let json: string;
  try {
    json = readFileSync(fixture, "utf-8");
  } catch {
    console.log(`${fixture}: FILE NOT FOUND, skipping`);
    continue;
  }

  const result = loadModel(json);
  if (!result.ok) {
    console.log(`${fixture}: LOAD FAIL`);
    continue;
  }
  const m = result.value;
  console.log(`--- ${fixture} ---`);
  console.log(`  Things: ${m.things.size}, Links: ${m.links.size}, OPDs: ${m.opds.size}, Appearances: ${m.appearances.size}`);

  for (const [id, opd] of m.opds) {
    const fiber = resolveOpdFiber(m, id);
    const links = resolveLinksForOpd(m, id);
    const aggLinks = links.filter(l => l.aggregated);
    const refinesName = opd.refines ? m.things.get(opd.refines)?.name ?? opd.refines : "none";

    if (opd.refines || aggLinks.length > 0) {
      console.log(`  ${opd.name}: refines=${refinesName} (${opd.refinement_type ?? "none"}), things=${fiber.things.size}, links=${links.length}, aggregated=${aggLinks.length}`);

      // Check: container thing should be in fiber if in-zoom
      if (opd.refines && opd.refinement_type === "in-zoom") {
        const containerInFiber = fiber.things.has(opd.refines);
        if (!containerInFiber) {
          console.log(`    WARNING: Container thing ${refinesName} NOT in fiber!`);
        }
      }

      // Check: aggregated links should have valid visual endpoints
      for (const l of aggLinks) {
        const vsThing = m.things.get(l.visualSource);
        const vtThing = m.things.get(l.visualTarget);
        if (!vsThing) {
          console.log(`    BUG: Aggregated link visual source ${l.visualSource} has no Thing!`);
          failures++;
        }
        if (!vtThing) {
          console.log(`    BUG: Aggregated link visual target ${l.visualTarget} has no Thing!`);
          failures++;
        }
        // Visual endpoints should be in fiber
        if (vsThing && !fiber.things.has(l.visualSource)) {
          console.log(`    BUG: Aggregated link visual source ${vsThing.name} NOT in fiber!`);
          failures++;
        }
        if (vtThing && !fiber.things.has(l.visualTarget)) {
          console.log(`    BUG: Aggregated link visual target ${vtThing.name} NOT in fiber!`);
          failures++;
        }
      }

      // Check for nested refinements
      const childOpds = [...m.opds.values()].filter(o => o.parent_opd === id && o.refines);
      if (childOpds.length > 0) {
        console.log(`    Has ${childOpds.length} child refinement(s):`);
        for (const child of childOpds) {
          const childRefName = child.refines ? m.things.get(child.refines)?.name ?? child.refines : "?";
          console.log(`      ${child.name} refines ${childRefName} (${child.refinement_type})`);
        }
      }
    }
  }
}

// ========== Summary ==========
console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
if (failures > 0) {
  process.exit(1);
}
