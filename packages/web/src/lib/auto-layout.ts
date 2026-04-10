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
    const opdLinks = [...model.links.values()].filter(l =>
      thingsForOpd.has(l.source) && thingsForOpd.has(l.target)
    );
    const needsAppearance = new Set([...thingsForOpd].filter(id => !existingApps.has(id)));
    const initialPositions = computeInitialPositions(model, needsAppearance, opdLinks);

    for (const thingId of needsAppearance) {
      const thing = model.things.get(thingId);
      if (!thing) continue;

      const size = computeThingSize(model, thing);
      const pos = initialPositions.get(thingId) ?? { x: 40 + newAppCount * 160, y: 60 };
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

  // If the OPD already has an explicit cast, preserve that cast and avoid
  // auto-materializing descendants from child refinements into this level.
  if (existingApps.size > 0) {
    if (opd.refines) thingIds.add(opd.refines);
    return thingIds;
  }

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
    // SD (root): keep root scoped to things that are explicitly in SD,
    // plus unassigned things that do not already belong to descendant OPDs.
    const descendantThingIds = new Set(
      [...model.appearances.values()]
        .filter((app) => app.opd !== opd.id)
        .map((app) => app.thing),
    );

    for (const thing of model.things.values()) {
      if (descendantThingIds.has(thing.id) && !existingApps.has(thing.id)) continue;
      thingIds.add(thing.id);
    }
  }

  if (thingIds.size === 0) {
    for (const thing of model.things.values()) {
      thingIds.add(thing.id);
    }
  }

  return thingIds;
}

/**
 * Compute topology-aware initial positions for all things in an OPD.
 * Uses the link graph to place things in logical lanes:
 * - Left lane: enablers (agents, instruments)
 * - Center band: main processes (top to bottom by dependency chain)
 * - Right lane: transformer objects (inputs above, outputs below)
 * - Bottom: structural children
 */
function computeInitialPositions(
  model: Model,
  thingIds: Set<string>,
  links: Link[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const GAP = VISUAL_RULES.spacing.nodeGap;
  const COL_W = 220;
  const ROW_H = 100;
  const LEFT_X = 40;
  const CENTER_X = COL_W + GAP;
  const RIGHT_X = CENTER_X + COL_W + GAP;

  // Classify all things
  const roles = new Map<string, ReturnType<typeof classifyRole>>();
  for (const thingId of thingIds) {
    const thing = model.things.get(thingId);
    if (!thing) continue;
    const thingLinks = links.filter(l => l.source === thingId || l.target === thingId);
    roles.set(thingId, classifyRole(thingId, thing, thingLinks));
  }

  // Group by role
  const mainProcesses: string[] = [];
  const enablers: string[] = [];
  const transformerObjects: string[] = [];
  const structuralParents: string[] = [];
  const structuralChildren: string[] = [];
  const others: string[] = [];

  for (const [id, role] of roles) {
    switch (role) {
      case "main-process": mainProcesses.push(id); break;
      case "enabler": enablers.push(id); break;
      case "transformer-object": transformerObjects.push(id); break;
      case "structural-parent": structuralParents.push(id); break;
      case "structural-child": structuralChildren.push(id); break;
      default: others.push(id); break;
    }
  }

  // Sort main processes by dependency chain (topological sort via link order)
  const processOrder = topologicalSortThings(mainProcesses, links);

  // Sort transformer objects: inputs first (consumption sources), outputs last (result targets)
  const inputObjects: string[] = [];
  const outputObjects: string[] = [];
  const neutralObjects: string[] = [];
  for (const objId of transformerObjects) {
    const isInput = links.some(l => l.source === objId && ["consumption", "input"].includes(l.type));
    const isOutput = links.some(l => l.target === objId && ["result", "output"].includes(l.type));
    if (isInput && !isOutput) inputObjects.push(objId);
    else if (isOutput && !isInput) outputObjects.push(objId);
    else neutralObjects.push(objId);
  }

  // Place main processes in center band
  let centerY = 60;
  for (const procId of processOrder) {
    positions.set(procId, { x: CENTER_X, y: centerY });
    centerY += ROW_H;
  }

  // Place enablers in left lane, aligned with their connected processes
  let enablerY = 60;
  for (const enId of enablers) {
    // Try to align with connected process
    const connectedProc = links.find(l =>
      (l.source === enId || l.target === enId) &&
      processOrder.includes(l.source === enId ? l.target : l.source)
    );
    const procPos = connectedProc
      ? positions.get(connectedProc.source === enId ? connectedProc.target : connectedProc.source)
      : null;
    const y = procPos ? procPos.y : enablerY;
    positions.set(enId, { x: LEFT_X, y });
    enablerY = Math.max(enablerY, y + ROW_H);
  }

  // Place input objects in right lane, top section
  let inputY = 40;
  for (const objId of inputObjects) {
    // Align with consuming process
    const link = links.find(l => l.source === objId && processOrder.includes(l.target));
    const procPos = link ? positions.get(link.target) : null;
    const y = procPos ? Math.max(inputY, procPos.y - 20) : inputY;
    positions.set(objId, { x: RIGHT_X, y });
    inputY = y + ROW_H;
  }

  // Place neutral objects
  for (const objId of neutralObjects) {
    positions.set(objId, { x: RIGHT_X, y: inputY });
    inputY += ROW_H;
  }

  // Place output objects in right lane, bottom section
  let outputY = Math.max(inputY, centerY - ROW_H);
  for (const objId of outputObjects) {
    const link = links.find(l => l.target === objId && processOrder.includes(l.source));
    const procPos = link ? positions.get(link.source) : null;
    const y = procPos ? Math.max(outputY, procPos.y) : outputY;
    positions.set(objId, { x: RIGHT_X, y });
    outputY = y + ROW_H;
  }

  // Place structural parents centered
  let structY = Math.max(centerY, outputY) + GAP;
  for (const id of structuralParents) {
    if (!positions.has(id)) {
      positions.set(id, { x: CENTER_X, y: structY });
      structY += ROW_H;
    }
  }

  // Place structural children in grid below parent
  let childIdx = 0;
  for (const id of structuralChildren) {
    if (!positions.has(id)) {
      const col = childIdx % 3;
      const row = Math.floor(childIdx / 3);
      positions.set(id, { x: LEFT_X + col * (COL_W * 0.7 + GAP), y: structY + row * ROW_H });
      childIdx++;
    }
  }

  // Place remaining things
  let otherIdx = 0;
  for (const id of others) {
    if (!positions.has(id)) {
      const col = otherIdx % 3;
      const row = Math.floor(otherIdx / 3);
      positions.set(id, { x: LEFT_X + col * (COL_W + GAP), y: 60 + row * ROW_H });
      otherIdx++;
    }
  }

  return positions;
}

/** Topological sort of processes based on link dependencies */
function topologicalSortThings(thingIds: string[], links: Link[]): string[] {
  if (thingIds.length <= 1) return [...thingIds];

  // Build dependency graph: process A → process B if A's output is B's input
  const deps = new Map<string, Set<string>>();
  for (const id of thingIds) deps.set(id, new Set());

  for (const link of links) {
    if (!thingIds.includes(link.source) || !thingIds.includes(link.target)) continue;
    // result/output from source → consumption/input to target suggests source before target
    if (["result", "output", "invocation"].includes(link.type)) {
      deps.get(link.target)?.add(link.source);
    }
    if (["consumption", "input"].includes(link.type)) {
      deps.get(link.source)?.add(link.target);
    }
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const id of thingIds) inDegree.set(id, 0);
  for (const [id, depSet] of deps) {
    inDegree.set(id, depSet.size);
  }

  const queue = thingIds.filter(id => (inDegree.get(id) ?? 0) === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const [other, depSet] of deps) {
      if (depSet.has(id)) {
        depSet.delete(id);
        inDegree.set(other, (inDegree.get(other) ?? 1) - 1);
        if (inDegree.get(other) === 0) queue.push(other);
      }
    }
  }

  // Add any remaining (cycles) at the end
  for (const id of thingIds) {
    if (!sorted.includes(id)) sorted.push(id);
  }

  return sorted;
}
