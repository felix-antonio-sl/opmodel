/**
 * Auto-layout from scratch — generate initial appearances for a model
 * and apply intelligent layout per OPD.
 *
 * This is the missing piece for programmatic model creation (NL, API, import):
 * given a model with things and links but no positions, produce a fully
 * positioned visual representation.
 */

import type { Model, Appearance, Thing, Link, OPD } from "@opmodel/core";
import { addAppearance, isOk } from "@opmodel/core";
import { suggestLayoutForOpd, type AppearancePatch } from "./spatial-layout";
import { VISUAL_RULES, minimumWidthForStateNames } from "./visual-rules";

/** Compute ideal size for a thing based on its properties */
function computeThingSize(model: Model, thing: Thing): { w: number; h: number } {
  const stateNames = [...model.states.values()]
    .filter(s => s.parent === thing.id)
    .map(s => s.name);

  // Base width from name length
  const nameW = thing.name.length * 8 + 28;
  const durationW = thing.kind === "process" && thing.duration ? 40 : 0;

  // Width for states
  const stateW = stateNames.length > 0
    ? minimumWidthForStateNames(stateNames)
    : 0;

  const w = Math.max(
    thing.kind === "process" ? VISUAL_RULES.size.minProcessWidth : VISUAL_RULES.size.minObjectWidth,
    nameW,
    durationW + nameW * 0.5,
    stateW,
  );

  const h = Math.max(
    thing.kind === "process" ? 60 : 50,
    stateNames.length > 0 ? 50 : 40,
  );

  return { w: Math.round(w), h: Math.round(h) };
}

/** Classify a thing's role in an OPD based on its links */
function classifyRole(
  thingId: string,
  thing: Thing,
  links: Link[],
): "main-process" | "enabler" | "transformer-object" | "structural-parent" | "structural-child" | "other" {
  const asSource = links.filter(l => l.source === thingId);
  const asTarget = links.filter(l => l.target === thingId);
  const all = [...asSource, ...asTarget];

  // Main process: has transforming links
  if (thing.kind === "process" && all.some(l =>
    ["effect", "consumption", "result", "input", "output"].includes(l.type)
  )) return "main-process";

  // Enabler: only agent/instrument links
  if (all.length > 0 && all.every(l => ["agent", "instrument"].includes(l.type))) return "enabler";

  // Structural parent: has structural children
  const structTypes = ["aggregation", "exhibition", "generalization", "classification"];
  if (asSource.some(l => structTypes.includes(l.type))) return "structural-parent";
  if (asTarget.some(l => structTypes.includes(l.type))) return "structural-child";

  // Transformer object: connected to transforming process
  if (thing.kind === "object" && all.some(l =>
    ["effect", "consumption", "result"].includes(l.type)
  )) return "transformer-object";

  return "other";
}

export interface AutoLayoutResult {
  model: Model;
  patchesApplied: number;
  opdLayouts: Array<{
    opdId: string;
    strategy: string;
    appearances: number;
    patches: number;
  }>;
}

/**
 * Generate appearances and apply layout for all OPDs in a model.
 * Creates initial positions based on thing roles, then refines with layout engine.
 */
export function autoLayoutModel(inputModel: Model): AutoLayoutResult {
  let model = inputModel;
  const opdLayouts: AutoLayoutResult["opdLayouts"] = [];
  let totalPatches = 0;

  // Process OPDs in tree order (parents first)
  const sortedOpds = topologicalSortOpds(model);

  for (const opd of sortedOpds) {
    // 1. Find things that need appearances in this OPD
    const existingApps = new Set(
      [...model.appearances.values()]
        .filter(a => a.opd === opd.id)
        .map(a => a.thing)
    );

    // Determine which things belong in this OPD
    const thingsForOpd = findThingsForOpd(model, opd, existingApps);

    // 2. Create initial appearances for things without them
    let newAppCount = 0;
    for (const thingId of thingsForOpd) {
      if (existingApps.has(thingId)) continue;
      const thing = model.things.get(thingId);
      if (!thing) continue;

      const size = computeThingSize(model, thing);
      const links = [...model.links.values()].filter(l =>
        (l.source === thingId || l.target === thingId) &&
        (thingsForOpd.has(l.source) && thingsForOpd.has(l.target))
      );
      const role = classifyRole(thingId, thing, links);
      const pos = initialPosition(role, newAppCount, thingsForOpd.size, opd);
      const isInternal = opd.refines === thingId;

      const result = addAppearance(model, {
        thing: thingId,
        opd: opd.id,
        x: pos.x,
        y: pos.y,
        w: size.w,
        h: size.h,
        internal: isInternal ? true : undefined,
      } as Appearance);

      if (isOk(result)) {
        model = result.value;
        newAppCount++;
      }
    }

    // 3. Apply layout engine
    const suggestion = suggestLayoutForOpd(model, opd.id);
    for (const patch of suggestion.patches) {
      // Apply patch manually (updateAppearance modifies the model)
      const app = [...model.appearances.values()].find(
        a => a.thing === patch.thingId && a.opd === patch.opdId
      );
      if (app) {
        const key = `${patch.thingId}::${patch.opdId}`;
        const updated = new Map(model.appearances);
        updated.set(key, { ...app, ...patch.patch });
        model = { ...model, appearances: updated };
      }
    }
    totalPatches += suggestion.patches.length;

    opdLayouts.push({
      opdId: opd.id,
      strategy: suggestion.strategy,
      appearances: existingApps.size + newAppCount,
      patches: suggestion.patches.length,
    });
  }

  return { model, patchesApplied: totalPatches, opdLayouts };
}

/** Sort OPDs in tree order: parents before children */
function topologicalSortOpds(model: Model): OPD[] {
  const opds = [...model.opds.values()];
  const sorted: OPD[] = [];
  const visited = new Set<string>();

  function visit(opd: OPD) {
    if (visited.has(opd.id)) return;
    if (opd.parent_opd) {
      const parent = model.opds.get(opd.parent_opd);
      if (parent) visit(parent);
    }
    visited.add(opd.id);
    sorted.push(opd);
  }

  for (const opd of opds) visit(opd);
  return sorted;
}

/** Determine which things should appear in this OPD */
function findThingsForOpd(model: Model, opd: OPD, existingApps: Set<string>): Set<string> {
  const thingIds = new Set(existingApps);

  if (opd.refines) {
    // Refinement OPD: include the refined thing + its connected things
    thingIds.add(opd.refines);

    if (opd.refinement_type === "in-zoom") {
      // In-zoom: subprocesses + objects connected to them
      const links = [...model.links.values()];
      // Find things connected to the refined process
      for (const link of links) {
        if (link.source === opd.refines || link.target === opd.refines) {
          const other = link.source === opd.refines ? link.target : link.source;
          const otherThing = model.things.get(other);
          // Add subprocesses and connected objects
          if (otherThing) thingIds.add(other);
        }
      }
      // Also add things connected to the subprocesses
      for (const thing of model.things.values()) {
        if (thing.kind === "process" && thing.id !== opd.refines) {
          const connected = links.some(l =>
            (l.source === thing.id || l.target === thing.id) &&
            thingIds.has(l.source === thing.id ? l.target : l.source)
          );
          if (connected) thingIds.add(thing.id);
        }
      }
    } else if (opd.refinement_type === "unfold") {
      // Unfold: structural children
      const structTypes = ["aggregation", "exhibition", "generalization", "classification"];
      for (const link of model.links.values()) {
        if (structTypes.includes(link.type)) {
          if (link.source === opd.refines) thingIds.add(link.target);
          if (link.target === opd.refines) thingIds.add(link.source);
        }
      }
    }
  } else if (!opd.parent_opd) {
    // SD (root): include all things that don't belong exclusively to a child OPD
    for (const thing of model.things.values()) {
      thingIds.add(thing.id);
    }
  }

  return thingIds;
}

/** Compute initial position based on role */
function initialPosition(
  role: ReturnType<typeof classifyRole>,
  index: number,
  totalThings: number,
  opd: OPD,
): { x: number; y: number } {
  const GAP = VISUAL_RULES.spacing.nodeGap;
  const COL_W = 200;
  const ROW_H = 100;

  // Layout strategy: center band for processes, left/right for objects
  switch (role) {
    case "main-process":
      return { x: COL_W + GAP, y: 60 + index * ROW_H };
    case "enabler":
      return { x: 40, y: 60 + index * ROW_H };
    case "transformer-object":
      return { x: COL_W * 2 + GAP * 2, y: 60 + index * ROW_H };
    case "structural-parent":
      return { x: COL_W, y: 40 };
    case "structural-child":
      return { x: 40 + (index % 4) * (COL_W * 0.6 + GAP), y: 160 + Math.floor(index / 4) * ROW_H };
    default:
      return { x: 40 + (index % 3) * (COL_W + GAP), y: 60 + Math.floor(index / 3) * ROW_H };
  }
}
