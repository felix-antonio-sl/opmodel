import type { Appearance, Fan, Link, Model, Thing } from "@opmodel/core";
import { auditVisualOpd, type VisualFinding } from "./visual-lint";
import { VISUAL_RULES, minimumWidthForStateNames } from "./visual-rules";
import { buildPatchableOpdProjectionSlice } from "./projection-view";

export interface AppearancePatch {
  thingId: string;
  opdId: string;
  patch: Partial<Pick<Appearance, "x" | "y" | "w" | "h" | "internal">>;
}

export type LayoutStrategy = "process-in-zoom" | "object-in-zoom" | "unfold-grid" | "branching-control" | "structural-cluster" | "sd-balanced" | "none";

export type LayoutRelaxPolicy = "by-strategy" | "always" | "never";

export interface LayoutSuggestion {
  strategy: LayoutStrategy;
  patches: AppearancePatch[];
  findings: VisualFinding[];
}

function sortByPosition(a: Appearance, b: Appearance): number {
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

function linkedProcesses(app: Appearance, internalProcessIds: Set<string>, links: Link[]): string[] {
  const ids = new Set<string>();
  for (const link of links) {
    if (link.source === app.thing && internalProcessIds.has(link.target)) ids.add(link.target);
    if (link.target === app.thing && internalProcessIds.has(link.source)) ids.add(link.source);
  }
  return [...ids];
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function isPinned(app: Appearance | undefined): boolean {
  return Boolean(app?.pinned);
}

function allowsAutoSizing(app: Appearance | undefined): boolean {
  return app?.auto_sizing !== false;
}

function resolveLaneOverlaps(entries: Array<{ thingId: string; y: number; h: number }>, minGap: number = VISUAL_RULES.spacing.nodeGap) {
  const sorted = [...entries].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (!prev || !current) continue;
    const prevBottom = prev.y + prev.h + minGap;
    if (current.y < prevBottom) current.y = prevBottom;
  }
  return sorted;
}

function rectsOverlap(a: Pick<Appearance, "x" | "y" | "w" | "h">, b: Pick<Appearance, "x" | "y" | "w" | "h">, gap = 0): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

function classifyBand(app: Appearance, centerX: number): "left" | "center" | "right" {
  const mid = app.x + app.w / 2;
  if (mid < centerX - 140) return "left";
  if (mid > centerX + 140) return "right";
  return "center";
}

function clampToBand(app: Appearance, band: "left" | "center" | "right", centerX: number): void {
  const mid = app.x + app.w / 2;
  if (band === "left" && mid > centerX - 40) {
    app.x = Math.max(0, centerX - 40 - app.w / 2);
  }
  if (band === "right" && mid < centerX + 40) {
    app.x = centerX + 40 - app.w / 2;
  }
  if (band === "center") {
    const desired = centerX - app.w / 2;
    const maxDrift = 120;
    if (app.x < desired - maxDrift) app.x = desired - maxDrift;
    if (app.x > desired + maxDrift) app.x = desired + maxDrift;
  }
}

function applyRelaxationPass(apps: Appearance[], iterations = 3): Appearance[] {
  const relaxed = apps.map((app) => ({ ...app }));
  const visible = relaxed.filter((a) => !a.internal).sort((a, b) => sortByPosition(a, b));
  const gap = VISUAL_RULES.spacing.nodeGap;
  const centerX = average(visible.map((a) => a.x + a.w / 2));
  const bands = new Map(visible.map((app) => [app.thing, classifyBand(app, centerX)]));

  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i];
        const b = visible[j];
        if (!a || !b) continue;
        if (!rectsOverlap(a, b, gap)) continue;
        if (isPinned(a) && isPinned(b)) continue;

        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const target = isPinned(a) ? b : b;
        if (isPinned(b) && !isPinned(a)) {
          if (overlapX <= overlapY) {
            a.x = Math.max(0, a.x - Math.max(gap, overlapX + gap));
          } else {
            a.y = Math.max(0, a.y - Math.max(gap, overlapY + gap));
          }
          continue;
        }

        if (overlapX <= overlapY) {
          target.x += Math.max(gap, overlapX + gap);
          clampToBand(target, bands.get(target.thing) ?? "center", centerX);
        } else {
          target.y += Math.max(gap, overlapY + gap);
        }
      }
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    const findings = auditVisualOpd({ appearances: relaxed, links: [] });

    for (const finding of findings) {
      if (finding.kind === "tight-spacing") {
        const a = visible.find((app) => app.thing === finding.aThing);
        const b = visible.find((app) => app.thing === finding.bThing);
        if (!a || !b) continue;
        const nudge = Math.ceil((VISUAL_RULES.lint.minReadableGap - finding.gap) / 2) + 2;
        if (finding.axis === "x") {
          if (!isPinned(a)) {
            a.x = Math.max(0, a.x - nudge);
            clampToBand(a, bands.get(a.thing) ?? "center", centerX);
          }
          if (!isPinned(b)) {
            b.x += nudge;
            clampToBand(b, bands.get(b.thing) ?? "center", centerX);
          }
        } else {
          if (!isPinned(a)) a.y = Math.max(0, a.y - nudge);
          if (!isPinned(b)) b.y += nudge;
        }
      }
    }

    const crowded = findings.find((f) => f.kind === "crowded-diagram");
    if (crowded) {
      const centerY = average(visible.map((a) => a.y + a.h / 2));
      for (const app of visible) {
        if (isPinned(app)) continue;
        const dx = app.x + app.w / 2 - centerX;
        const dy = app.y + app.h / 2 - centerY;
        app.x += dx >= 0 ? 10 : -10;
        app.y += dy >= 0 ? 8 : -8;
        clampToBand(app, bands.get(app.thing) ?? "center", centerX);
        app.x = Math.max(0, app.x);
        app.y = Math.max(0, app.y);
      }
    }
  }

  for (let fixPass = 0; fixPass < 5; fixPass++) {
    const finalFindings = auditVisualOpd({ appearances: relaxed, links: [] });
    let fixed = false;

    for (const finding of finalFindings) {
      if (finding.kind !== "overlap") continue;
      const aIdx = relaxed.findIndex((app) => app.thing === finding.aThing);
      const bIdx = relaxed.findIndex((app) => app.thing === finding.bThing);
      if (aIdx < 0 || bIdx < 0) continue;
      const a = relaxed[aIdx];
      const b = relaxed[bIdx];
      if (!a || !b) continue;
      if (isPinned(a) && isPinned(b)) continue;
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (overlapX <= 0 || overlapY <= 0) continue;
      const halfGap = Math.ceil(gap / 2);
      if (overlapX <= overlapY) {
        if (!isPinned(a)) relaxed[aIdx] = { ...a, x: Math.max(0, a.x - Math.ceil(overlapX / 2) - halfGap) };
        if (!isPinned(b)) relaxed[bIdx] = { ...b, x: b.x + Math.ceil(overlapX / 2) + halfGap };
      } else {
        if (!isPinned(a)) relaxed[aIdx] = { ...a, y: Math.max(0, a.y - Math.ceil(overlapY / 2) - halfGap) };
        if (!isPinned(b)) relaxed[bIdx] = { ...b, y: b.y + Math.ceil(overlapY / 2) + halfGap };
      }
      fixed = true;
    }

    for (const finding of finalFindings) {
      if (finding.kind !== "tight-spacing") continue;
      const aIdx = relaxed.findIndex((app) => app.thing === finding.aThing);
      const bIdx = relaxed.findIndex((app) => app.thing === finding.bThing);
      if (aIdx < 0 || bIdx < 0) continue;
      const a = relaxed[aIdx];
      const b = relaxed[bIdx];
      if (!a || !b) continue;
      if (isPinned(a) && isPinned(b)) continue;
      const nudge = Math.ceil((VISUAL_RULES.lint.minReadableGap - finding.gap) / 2) + 2;
      if (finding.axis === "x") {
        if (!isPinned(a)) relaxed[aIdx] = { ...a, x: Math.max(0, a.x - nudge) };
        if (!isPinned(b)) relaxed[bIdx] = { ...b, x: b.x + nudge };
      } else {
        if (!isPinned(a)) relaxed[aIdx] = { ...a, y: Math.max(0, a.y - nudge) };
        if (!isPinned(b)) relaxed[bIdx] = { ...b, y: b.y + nudge };
      }
      fixed = true;
    }

    if (!fixed) break;
  }

  return relaxed;
}

export function mergeLayoutPatches(apps: Appearance[], patches: AppearancePatch[]): Map<string, AppearancePatch> {
  const pinnedIds = new Set(apps.filter((app) => app.pinned).map((app) => app.thing));
  const mergedPatches = new Map<string, AppearancePatch>();

  for (const patch of patches) {
    if (pinnedIds.has(patch.thingId)) continue;
    const existing = mergedPatches.get(patch.thingId);
    mergedPatches.set(
      patch.thingId,
      existing
        ? { thingId: patch.thingId, opdId: patch.opdId, patch: { ...existing.patch, ...patch.patch } }
        : patch,
    );
  }

  return mergedPatches;
}

export function applyLayoutPatches(
  model: Model,
  apps: Appearance[],
  mergedPatches: ReadonlyMap<string, AppearancePatch>,
): Appearance[] {
  return apps.map((app) => {
    const patch = mergedPatches.get(app.thing);
    let result = app;
    if (patch) {
      if (!allowsAutoSizing(app)) {
        const { w: _w, h: _h, ...rest } = patch.patch;
        result = { ...app, ...rest };
      } else {
        result = { ...app, ...patch.patch };
      }
    }

    if (allowsAutoSizing(result) && !result.pinned) {
      const sized = autoSizeAppearance(model, result);
      if (sized.w > result.w || sized.h > result.h) {
        result = { ...result, w: Math.max(result.w, sized.w), h: Math.max(result.h, sized.h) };
      }
    }
    return result;
  });
}

export function diffPatchedAppearances(originalApps: Appearance[], patchedApps: Appearance[]): AppearancePatch[] {
  const originalByThing = new Map(originalApps.map((app) => [app.thing, app]));

  return patchedApps.map((app) => {
    const original = originalByThing.get(app.thing)!;
    const patch: Partial<Pick<Appearance, "x" | "y" | "w" | "h" | "internal">> = allowsAutoSizing(original)
      ? { x: app.x, y: app.y, w: app.w, h: app.h }
      : { x: app.x, y: app.y };
    if (original.internal !== app.internal) patch.internal = app.internal;
    return {
      thingId: app.thing,
      opdId: app.opd,
      patch,
    } satisfies AppearancePatch;
  }).filter((patch) => {
    const original = originalByThing.get(patch.thingId)!;
    if (original.pinned) return false;
    return original.x !== patch.patch.x || original.y !== patch.patch.y || original.w !== patch.patch.w || original.h !== patch.patch.h || original.internal !== patch.patch.internal;
  });
}

function shouldRelaxLayout(strategy: LayoutStrategy, policy: LayoutRelaxPolicy = "by-strategy"): boolean {
  if (policy === "always") return true;
  if (policy === "never") return false;
  switch (strategy) {
    case "structural-cluster":
    case "object-in-zoom":
      return false;
    default:
      return true;
  }
}

function finalizeLayout(
  model: Model,
  strategy: LayoutStrategy,
  apps: Appearance[],
  links: Link[],
  patches: AppearancePatch[],
  options?: { relaxPolicy?: LayoutRelaxPolicy },
): { patches: AppearancePatch[]; findings: VisualFinding[] } {
  const mergedPatches = mergeLayoutPatches(apps, patches);
  const patchedApps = applyLayoutPatches(model, apps, mergedPatches);
  const finalApps = shouldRelaxLayout(strategy, options?.relaxPolicy) ? applyRelaxationPass(patchedApps) : patchedApps;
  const finalPatches = diffPatchedAppearances(apps, finalApps);

  return {
    patches: finalPatches,
    findings: auditVisualOpd({ appearances: finalApps, links, things: model.things.values(), states: model.states.values() }),
  };
}

function naturalPreferredWidth(model: Model, app: Appearance, thing: Thing | undefined): number {
  const stateNames = [...model.states.values()].filter((s) => s.parent === app.thing).map((s) => s.name);
  if (stateNames.length > 0) return minimumWidthForStateNames(stateNames);
  if (thing?.kind === "process") return VISUAL_RULES.size.minProcessWidth;
  return VISUAL_RULES.size.minObjectWidth;
}

function preferredWidth(model: Model, app: Appearance, thing: Thing | undefined): number {
  return Math.max(app.w, naturalPreferredWidth(model, app, thing));
}

function classifyExternalLane(model: Model, app: Appearance, links: Link[]): "left" | "right" {
  const rel = links.filter((l) => l.source === app.thing || l.target === app.thing);
  if (rel.some((l) => l.type === "agent" || l.type === "consumption" || l.type === "input")) return "left";
  if (rel.some((l) => l.type === "result" || l.type === "output")) return "right";
  const thing = model.things.get(app.thing);
  if (thing?.affiliation === "environmental") return "right";
  if (rel.some((l) => l.type === "instrument")) return "right";
  return "right";
}

function branchProcessIdsForFan(fan: Fan, links: Link[], internalProcessIds: Set<string>): string[] {
  const ids = new Set<string>();
  for (const memberId of fan.members) {
    const link = links.find((l) => l.id === memberId);
    if (!link) continue;
    if (internalProcessIds.has(link.source)) ids.add(link.source);
    if (internalProcessIds.has(link.target)) ids.add(link.target);
  }
  return [...ids];
}

/** Topological sort of processes based on link direction for natural flow */
function topologicalSort(processes: Appearance[], links: Link[], processIds: Set<string>): Appearance[] {
  if (processes.length <= 1) return processes;
  const idToApp = new Map(processes.map((a) => [a.thing, a]));
  const inDegree = new Map(processes.map((a) => [a.thing, 0]));
  const successors = new Map<string, string[]>();
  for (const id of processIds) successors.set(id, []);

  for (const link of links) {
    if (!processIds.has(link.source) || !processIds.has(link.target)) continue;
    const deg = inDegree.get(link.target) ?? 0;
    inDegree.set(link.target, deg + 1);
    const succ = successors.get(link.source) ?? [];
    succ.push(link.target);
    successors.set(link.source, succ);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: Appearance[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const app = idToApp.get(id);
    if (app) sorted.push(app);
    for (const succId of (successors.get(id) ?? [])) {
      const newDeg = (inDegree.get(succId) ?? 1) - 1;
      inDegree.set(succId, newDeg);
      if (newDeg === 0) queue.push(succId);
    }
  }

  // Append any remaining (cycle participants) in position order
  const sortedIds = new Set(sorted.map((a) => a.thing));
  for (const app of processes) {
    if (!sortedIds.has(app.thing)) sorted.push(app);
  }

  return sorted;
}

function layoutBranchingControl(model: Model, opdId: string, apps: Appearance[], links: Link[], fans: Fan[], refines?: string): LayoutSuggestion {
  const patches: AppearancePatch[] = [];
  const container = refines ? apps.find((a) => a.thing === refines) : undefined;
  const internal = apps.filter((a) => a.internal && a.thing !== refines).sort(sortByPosition);
  const external = apps.filter((a) => !a.internal && a.thing !== refines).sort(sortByPosition);
  if (!container || internal.length === 0) return { strategy: "none", patches: [], findings: [] };

  const internalProcesses = internal.filter((a) => model.things.get(a.thing)?.kind === "process");
  const internalObjects = internal.filter((a) => model.things.get(a.thing)?.kind === "object");
  const internalProcessIds = new Set(internalProcesses.map((a) => a.thing));
  const diverging = fans.find((f) => f.direction === "diverging" && (f.type === "xor" || f.type === "or" || f.type === "and"));
  if (!diverging) return { strategy: "none", patches: [], findings: [] };

  if (internalProcesses.length > 7 || internalObjects.length > 6) {
    return { strategy: "none", patches: [], findings: [] };
  }

  const branchIds = branchProcessIdsForFan(diverging, links, internalProcessIds);
  const branches = internalProcesses.filter((a) => branchIds.includes(a.thing)).sort(sortByPosition);
  const trunk = internalProcesses.filter((a) => !branchIds.includes(a.thing)).sort(sortByPosition);
  if (branches.length === 0 || trunk.length === 0) return { strategy: "none", patches: [], findings: [] };

  const containerX = container.x;
  const containerY = container.y;
  const trunkY = containerY + 110;
  const branchYBase = containerY + 420;
  const trunkW = 220;
  const trunkGap = 70;
  const trunkStartX = containerX + 80;
  trunk.filter((app) => !isPinned(app)).forEach((app, i) => {
    patches.push({
      thingId: app.thing,
      opdId,
      patch: { x: trunkStartX + i * (trunkW + trunkGap), y: trunkY + (i === 0 ? -70 : i === 1 ? 0 : 70), w: Math.max(app.w, 220), h: Math.max(app.h, 60) },
    });
  });

  const branchXs = [containerX + 100, containerX + 390, containerX + 690];
  branches.filter((app) => !isPinned(app)).forEach((app, i) => {
    const x = branchXs[i] ?? (containerX + 100 + i * 250);
    const y = branchYBase + (i === 1 ? -60 : 20);
    patches.push({ thingId: app.thing, opdId, patch: { x, y, w: Math.max(app.w, 230), h: Math.max(app.h, 60) } });
  });

  const targetContainerW = Math.max(container.w, 980);
  const targetContainerH = Math.max(container.h, 560);
  if (!isPinned(container)) patches.push({ thingId: container.thing, opdId, patch: { w: targetContainerW, h: targetContainerH } });

  const patchedInternals = internal.map((app) => {
    const patch = patches.find((p) => p.thingId === app.thing)?.patch;
    return patch ? { ...app, ...patch } : app;
  });
  const processCenters = new Map(patchedInternals.map((a) => [a.thing, a.y + a.h / 2]));

  const laneBaseLeft = containerX - 260;
  const laneBaseRight = containerX + targetContainerW + 60;
  const leftEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];
  const rightEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];
  for (const app of external) {
    const connected = linkedProcesses(app, internalProcessIds, links);
    const centerY = average(connected.map((id) => processCenters.get(id) ?? containerY + 120)) || containerY + 120;
    const thing = model.things.get(app.thing);
    const h = Math.max(app.h, thing?.kind === "object" && [...model.states.values()].some((s) => s.parent === app.thing) ? 68 : 50);
    const w = preferredWidth(model, app, thing);
    const y = centerY - h / 2;
    const lane = classifyExternalLane(model, app, links);
    (lane === "left" ? leftEntries : rightEntries).push({ app, y, h, w });
  }

  for (const entry of resolveLaneOverlaps(leftEntries.map((e) => ({ thingId: e.app.thing, y: e.y, h: e.h })))) {
    const full = leftEntries.find((e) => e.app.thing === entry.thingId)!;
    patches.push({ thingId: entry.thingId, opdId, patch: { x: laneBaseLeft, y: entry.y, w: full.w, h: full.h } });
  }
  for (const entry of resolveLaneOverlaps(rightEntries.map((e) => ({ thingId: e.app.thing, y: e.y, h: e.h })))) {
    const full = rightEntries.find((e) => e.app.thing === entry.thingId)!;
    patches.push({ thingId: entry.thingId, opdId, patch: { x: laneBaseRight, y: entry.y, w: full.w, h: full.h } });
  }

  const strategy: LayoutStrategy = "branching-control";
  const finalized = finalizeLayout(model, strategy, apps, links, patches);
  return {
    strategy,
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

function layoutInZoom(model: Model, opdId: string, apps: Appearance[], links: Link[], refines?: string): LayoutSuggestion {
  const patches: AppearancePatch[] = [];
  const container = refines ? apps.find((a) => a.thing === refines) : undefined;
  const refinee = refines ? model.things.get(refines) : undefined;
  const structuralInternalThingIds = new Set<string>();
  if (refines && refinee?.kind === "object") {
    for (const link of links) {
      if (!["aggregation", "exhibition", "generalization", "classification"].includes(link.type)) continue;
      if (link.source === refines) structuralInternalThingIds.add(link.target);
      if (link.target === refines) structuralInternalThingIds.add(link.source);
    }
  }
  const internal = apps
    .filter((a) => a.thing !== refines)
    .filter((a) => a.internal || structuralInternalThingIds.has(a.thing))
    .sort(sortByPosition);
  const external = apps
    .filter((a) => a.thing !== refines)
    .filter((a) => !a.internal && !structuralInternalThingIds.has(a.thing))
    .sort(sortByPosition);
  if (!container || internal.length === 0) return { strategy: "none", patches: [], findings: [] };

  const containerX = container.x;
  const containerY = container.y;
  const processW = 220;
  const processH = 60;
  const processGapX = 72;
  const processGapY = 52;
  const innerPaddingX = 28;
  const innerPaddingY = 64;
  const maxInternalObjectWidth = 280;
  const maxExternalObjectWidth = 220;

  const internalProcesses = internal.filter((app) => model.things.get(app.thing)?.kind === "process");
  const internalObjects = internal.filter((app) => model.things.get(app.thing)?.kind === "object");
  const processSource = internalProcesses.length > 0 ? internalProcesses : internal;
  const internalProcessIds = new Set(processSource.map((a) => a.thing));

  // Topological sort of internal processes based on link direction
  const topoSorted = topologicalSort(processSource, links, internalProcessIds);

  const cols = topoSorted.length > 12 ? 2 : 1;
  const rowsPerCol = Math.ceil(topoSorted.length / cols);

  const plannedCenters = new Map<string, number>();
  topoSorted.forEach((app, i) => {
    const row = i % rowsPerCol;
    plannedCenters.set(app.thing, containerY + innerPaddingY + row * (processH + processGapY) + processH / 2);
  });

  const internalLeftEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];
  const internalRightEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];
  for (const app of internalObjects) {
    if (structuralInternalThingIds.has(app.thing) && !app.internal) {
      patches.push({ thingId: app.thing, opdId, patch: { internal: true } });
    }
    const connected = linkedProcesses(app, internalProcessIds, links);
    const centerY = average(connected.map((id) => plannedCenters.get(id) ?? containerY + 120)) || containerY + 120;
    const thing = model.things.get(app.thing);
    const h = Math.max(app.h, thing?.kind === "object" && [...model.states.values()].some((s) => s.parent === app.thing) ? 64 : 50);
    const w = Math.min(naturalPreferredWidth(model, app, thing), maxInternalObjectWidth);
    const y = centerY - h / 2;
    const lane = classifyExternalLane(model, app, links);
    (lane === "left" ? internalLeftEntries : internalRightEntries).push({ app, y, h, w });
  }

  const estimateLaneColumns = (entries: Array<{ app: Appearance; y: number; h: number; w: number }>) => {
    if (entries.length <= 3) return 1;
    const totalHeight = entries.reduce((sum, entry) => sum + entry.h, 0) + Math.max(0, entries.length - 1) * (VISUAL_RULES.spacing.nodeGap + 8);
    return Math.max(1, Math.ceil(totalHeight / 420));
  };

  const leftInnerColumns = estimateLaneColumns(internalLeftEntries);
  const rightInnerColumns = estimateLaneColumns(internalRightEntries);
  const leftInnerWidth = internalLeftEntries.reduce((max, entry) => Math.max(max, entry.w), 0) * leftInnerColumns + Math.max(0, leftInnerColumns - 1) * 36;
  const rightInnerWidth = internalRightEntries.reduce((max, entry) => Math.max(max, entry.w), 0) * rightInnerColumns + Math.max(0, rightInnerColumns - 1) * 36;
  const processBandWidth = cols * processW + Math.max(0, cols - 1) * processGapX;
  const processStartX = containerX + innerPaddingX + leftInnerWidth + (leftInnerWidth > 0 ? 56 : 0);
  const processStartY = containerY + innerPaddingY;

  topoSorted.filter((app) => !isPinned(app)).forEach((app, i) => {
    const col = Math.floor(i / rowsPerCol);
    const row = i % rowsPerCol;
    patches.push({
      thingId: app.thing,
      opdId,
      patch: {
        x: processStartX + col * (processW + processGapX),
        y: processStartY + row * (processH + processGapY),
        w: Math.max(app.w, processW),
        h: Math.max(app.h, processH),
      },
    });
  });

  const lastInternalBottom = processStartY + Math.max(0, rowsPerCol - 1) * (processH + processGapY) + processH;
  const targetContainerW = Math.max(container.w, innerPaddingX * 2 + leftInnerWidth + (leftInnerWidth > 0 ? 56 : 0) + processBandWidth + (rightInnerWidth > 0 ? 56 : 0) + rightInnerWidth);
  const targetContainerH = Math.max(container.h, lastInternalBottom - containerY + innerPaddingY);
  if (!isPinned(container)) patches.push({ thingId: container.thing, opdId, patch: { w: targetContainerW, h: targetContainerH } });

  const processCenters = new Map(topoSorted.map((app, i) => {
    const row = i % rowsPerCol;
    return [app.thing, processStartY + row * (processH + processGapY) + processH / 2] as const;
  }));

  const placeInternalEntries = (
    entries: Array<{ app: Appearance; y: number; h: number; w: number }>,
    baseX: number,
    direction: -1 | 1,
  ) => {
    if (entries.length === 0) return;
    const resolved = resolveLaneOverlaps(entries.map((e) => ({ thingId: e.app.thing, y: e.y, h: e.h })), VISUAL_RULES.spacing.nodeGap + 8);
    const merged = resolved.map((entry) => {
      const full = entries.find((e) => e.app.thing === entry.thingId)!;
      return { ...full, y: entry.y };
    }).sort((a, b) => a.y - b.y);
    const maxLaneHeight = Math.max(targetContainerH - 180, 360);
    const colGap = 36;
    let column = 0;
    let columnStartY = processStartY;
    let cursorBottom = columnStartY;
    let columnWidth = 0;
    for (const entry of merged) {
      if (cursorBottom > columnStartY && cursorBottom - columnStartY + entry.h > maxLaneHeight) {
        column += 1;
        columnStartY = processStartY;
        cursorBottom = columnStartY;
        columnWidth = 0;
      }
      // Internal lanes must stay inside the container, so extra columns always grow inward.
      const x = baseX + column * (Math.max(entry.w, columnWidth) + colGap);
      patches.push({ thingId: entry.app.thing, opdId, patch: { x, y: cursorBottom, w: entry.w, h: entry.h } });
      cursorBottom += entry.h + VISUAL_RULES.spacing.nodeGap + 8;
      columnWidth = Math.max(columnWidth, entry.w);
    }
  };

  const internalLeftX = containerX + innerPaddingX;
  const internalRightX = processStartX + processBandWidth + (rightInnerWidth > 0 ? 40 : 0);
  placeInternalEntries(internalLeftEntries, internalLeftX, -1);
  placeInternalEntries(internalRightEntries, internalRightX, 1);

  const laneBaseLeft = containerX - 180;
  const laneBaseRight = containerX + targetContainerW + 36;
  const leftEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];
  const rightEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];
  const supportEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];

  for (const app of external) {
    const connected = linkedProcesses(app, internalProcessIds, links);
    const centerY = average(connected.map((id) => processCenters.get(id) ?? containerY + targetContainerH / 2)) || containerY + targetContainerH / 2;
    const thing = model.things.get(app.thing);
    const h = Math.max(app.h, thing?.kind === "object" && [...model.states.values()].some((s) => s.parent === app.thing) ? 64 : 50);
    const w = Math.min(preferredWidth(model, app, thing), maxExternalObjectWidth);
    const y = centerY - h / 2;
    const supportLinkCount = links.filter((l) => (l.type === "agent" || l.type === "instrument") && (l.source === app.thing || l.target === app.thing)).length;
    if (connected.length >= 4 || supportLinkCount >= 4) {
      supportEntries.push({ app, y, h, w });
      continue;
    }
    const lane = classifyExternalLane(model, app, links);
    (lane === "left" ? leftEntries : rightEntries).push({ app, y, h, w });
  }

  const placeExternalEntries = (
    entries: Array<{ app: Appearance; y: number; h: number; w: number }>,
    baseX: number,
    direction: -1 | 1,
  ) => {
    if (entries.length === 0) return;
    const resolved = resolveLaneOverlaps(entries.map((e) => ({ thingId: e.app.thing, y: e.y, h: e.h })));
    const merged = resolved.map((entry) => {
      const full = entries.find((e) => e.app.thing === entry.thingId)!;
      return { ...full, y: entry.y };
    }).sort((a, b) => a.y - b.y);

    const maxLaneHeight = Math.max(targetContainerH + 160, 720);
    let column = 0;
    let columnStartY = merged[0]?.y ?? containerY;
    let cursorBottom = columnStartY;
    let maxWidthInColumn = 0;

    for (const entry of merged) {
      if (cursorBottom > columnStartY && cursorBottom - columnStartY + entry.h > maxLaneHeight) {
        column += 1;
        columnStartY = Math.max(containerY, entry.y);
        cursorBottom = columnStartY;
        maxWidthInColumn = 0;
      }
      const x = direction === -1
        ? baseX - column * 188 - maxWidthInColumn
        : baseX + column * 188;
      patches.push({ thingId: entry.app.thing, opdId, patch: { x, y: cursorBottom, w: entry.w, h: entry.h } });
      cursorBottom += entry.h + VISUAL_RULES.spacing.nodeGap;
      maxWidthInColumn = Math.max(maxWidthInColumn, entry.w);
    }
  };

  placeExternalEntries(leftEntries, laneBaseLeft, -1);
  placeExternalEntries(rightEntries, laneBaseRight, 1);

  if (supportEntries.length > 0) {
    const supportBaseY = containerY + targetContainerH + 70;
    let supportX = containerX + 40;
    let supportY = supportBaseY;
    let rowMaxH = 0;
    const supportMaxX = containerX + Math.max(targetContainerW, 980);
    for (const entry of supportEntries.sort((a, b) => a.app.thing.localeCompare(b.app.thing))) {
      if (supportX > containerX + 40 && supportX + entry.w > supportMaxX) {
        supportX = containerX + 40;
        supportY += rowMaxH + VISUAL_RULES.spacing.nodeGap + 12;
        rowMaxH = 0;
      }
      patches.push({ thingId: entry.app.thing, opdId, patch: { x: supportX, y: supportY, w: entry.w, h: entry.h } });
      supportX += entry.w + VISUAL_RULES.spacing.nodeGap + 16;
      rowMaxH = Math.max(rowMaxH, entry.h);
    }
  }

  const strategy: LayoutStrategy = refinee?.kind === "object" ? "object-in-zoom" : "process-in-zoom";
  const finalized = finalizeLayout(model, strategy, apps, links, patches);

  return {
    strategy,
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

function layoutUnfold(model: Model, opdId: string, apps: Appearance[], links: Link[], refines?: string): LayoutSuggestion {
  const patches: AppearancePatch[] = [];
  const container = refines ? apps.find((a) => a.thing === refines) : undefined;
  const internal = apps.filter((a) => a.internal && a.thing !== refines).sort(sortByPosition);
  const external = apps.filter((a) => !a.internal && a.thing !== refines).sort(sortByPosition);
  if (!container || internal.length === 0) return { strategy: "none", patches: [], findings: [] };

  const cols = Math.min(2, internal.length);
  const rows = Math.ceil(internal.length / cols);
  const cellW = 260;
  const cellH = 120;
  const processW = 240;
  const processH = 60;
  const startX = container.x + 50;
  const startY = container.y + 70;
  internal.filter((app) => !isPinned(app)).forEach((app, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    patches.push({
      thingId: app.thing,
      opdId,
      patch: {
        x: startX + col * cellW,
        y: startY + row * cellH,
        w: Math.max(app.w, processW),
        h: Math.max(app.h, processH),
      },
    });
  });

  const targetContainerW = Math.max(container.w, cols * cellW + 120);
  const targetContainerH = Math.max(container.h, rows * cellH + 140);
  if (!isPinned(container)) patches.push({ thingId: container.thing, opdId, patch: { w: targetContainerW, h: targetContainerH } });

  const internalProcessIds = new Set(internal.map((a) => a.thing));
  const processCenters = new Map(internal.map((app, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return [app.thing, startY + row * cellH + processH / 2] as const;
  }));

  const laneBaseLeft = container.x - 250;
  const laneBaseRight = container.x + targetContainerW + 70;
  const leftEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];
  const rightEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];
  for (const app of external) {
    const connected = linkedProcesses(app, internalProcessIds, links);
    const centerY = average(connected.map((id) => processCenters.get(id) ?? container.y + 100)) || container.y + 100;
    const thing = model.things.get(app.thing);
    const h = Math.max(app.h, thing?.kind === "object" && [...model.states.values()].some((s) => s.parent === app.thing) ? 64 : 50);
    const w = preferredWidth(model, app, thing);
    const y = centerY - h / 2;
    const lane = classifyExternalLane(model, app, links);
    (lane === "left" ? leftEntries : rightEntries).push({ app, y, h, w });
  }

  for (const entry of resolveLaneOverlaps(leftEntries.map((e) => ({ thingId: e.app.thing, y: e.y, h: e.h })))) {
    const full = leftEntries.find((e) => e.app.thing === entry.thingId)!;
    patches.push({ thingId: entry.thingId, opdId, patch: { x: laneBaseLeft, y: entry.y, w: full.w, h: full.h } });
  }
  for (const entry of resolveLaneOverlaps(rightEntries.map((e) => ({ thingId: e.app.thing, y: e.y, h: e.h })))) {
    const full = rightEntries.find((e) => e.app.thing === entry.thingId)!;
    patches.push({ thingId: entry.thingId, opdId, patch: { x: laneBaseRight, y: entry.y, w: full.w, h: full.h } });
  }

  const strategy: LayoutStrategy = "unfold-grid";
  const finalized = finalizeLayout(model, strategy, apps, links, patches);

  return {
    strategy,
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

const STRUCTURAL_TYPES = new Set(["aggregation", "exhibition", "generalization", "classification"]);

interface StructuralCluster {
  parentId: string;
  childIds: string[];
  types: Set<string>;
}

function findStructuralClusters(links: Link[], visibleThings: Set<string>): StructuralCluster[] {
  const groups = new Map<string, StructuralCluster>();
  for (const link of links) {
    if (!STRUCTURAL_TYPES.has(link.type)) continue;
    if (!visibleThings.has(link.source) || !visibleThings.has(link.target)) continue;
    // Convention: parent is source for aggregation/exhibition/classification, target for generalization
    const parentId = link.type === "generalization" ? link.target : link.source;
    const childId = link.type === "generalization" ? link.source : link.target;
    if (!groups.has(parentId)) groups.set(parentId, { parentId, childIds: [], types: new Set() });
    const group = groups.get(parentId)!;
    group.childIds.push(childId);
    group.types.add(link.type);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    childIds: [...new Set(group.childIds)],
  })).filter((g) => g.childIds.length >= 1);
}

function estimateDurationTextWidth(thing: Thing): number {
  if (!thing.duration) return 0;
  const d = thing.duration;
  const text = `${d.min != null ? `${d.min}–` : ""}${d.nominal}${d.max != null ? `–${d.max}` : ""} ${d.unit}`;
  return text.length * 7 + 36;
}

function autoSizeAppearance(model: Model, app: Appearance): { w: number; h: number } {
  const thing = model.things.get(app.thing);
  if (!thing) return { w: app.w, h: app.h };

  const stateNames = [...model.states.values()].filter((s) => s.parent === app.thing).map((s) => s.name);
  const badgeLeft = thing.computational ? 16 : 0;
  const badgeRight = !app.internal ? 14 : 0;
  const labelPadding = 28 + badgeLeft + badgeRight;
  const nameW = thing.name.length * 8 + labelPadding;
  const durationW = thing.kind === "process" ? estimateDurationTextWidth(thing) : 0;

  let w = thing.kind === "process"
    ? Math.max(nameW, durationW, VISUAL_RULES.size.minProcessWidth)
    : Math.max(nameW, VISUAL_RULES.size.minObjectWidth);

  if (stateNames.length > 0) w = Math.max(w, minimumWidthForStateNames(stateNames));
  if (thing.kind === "object" && stateNames.length > 0 && thing.computational) w += 12;
  w = Math.max(w, app.w);
  if (app.internal && thing.kind === "object") w = Math.min(w, 320);

  let h = Math.max(app.h, VISUAL_RULES.size.minHeight);
  if (stateNames.length > 0) h = Math.max(h, 68);
  if (thing.kind === "process" && thing.duration) h = Math.max(h, stateNames.length > 0 ? 84 : 72);
  if (thing.computational && h < 56) h = 56;

  return { w, h };
}

function structuralDominanceScore(apps: Appearance[], links: Link[]): number {
  if (apps.length === 0 || links.length === 0) return 0;
  const visibleThings = new Set(apps.map((a) => a.thing));
  const structuralLinks = links.filter((l) => STRUCTURAL_TYPES.has(l.type));
  if (structuralLinks.length === 0) return 0;
  const clusters = findStructuralClusters(links, visibleThings);
  const clusteredThings = new Set<string>();
  for (const cluster of clusters) {
    clusteredThings.add(cluster.parentId);
    for (const childId of cluster.childIds) clusteredThings.add(childId);
  }
  const structuralLinkRatio = structuralLinks.length / links.length;
  const clusteredThingRatio = clusteredThings.size / Math.max(visibleThings.size, 1);
  const multiChildBonus = clusters.some((c) => c.childIds.length >= 2) ? 0.15 : 0;
  return structuralLinkRatio * 0.6 + clusteredThingRatio * 0.4 + multiChildBonus;
}

function layoutStructuralCluster(
  model: Model, opdId: string, apps: Appearance[], links: Link[],
): LayoutSuggestion {
  const visibleThings = new Set(apps.map((a) => a.thing));
  const clusters = findStructuralClusters(links, visibleThings);
  if (clusters.length === 0) return { strategy: "none", patches: [], findings: [] };

  const patches: AppearancePatch[] = [];
  const placed = new Set<string>();
  let nextClusterY = 40;
  const clusterBaseX = 120;
  const clusterMaxWidth = 760;

  for (const cluster of clusters) {
    const parentApp = apps.find((a) => a.thing === cluster.parentId);
    if (!parentApp) continue;
    const childApps = cluster.childIds.map((id) => apps.find((a) => a.thing === id)).filter(Boolean) as Appearance[];
    if (childApps.length === 0) continue;

    const parentSize = autoSizeAppearance(model, parentApp);
    const childGapX = cluster.types.has("exhibition") && cluster.childIds.length === 1 ? 24 : 32;
    const rowGapY = cluster.types.has("generalization") ? 48 : 36;
    const childStartY = nextClusterY + parentSize.h + 42;

    const childLayouts: Array<{ app: Appearance; x: number; y: number; w: number; h: number }> = [];
    let cursorX = clusterBaseX;
    let cursorY = childStartY;
    let rowHeight = 0;
    let minChildX = Infinity;
    let maxChildRight = -Infinity;

    for (const childApp of childApps) {
      const childSize = autoSizeAppearance(model, childApp);
      if (cursorX > clusterBaseX && cursorX + childSize.w > clusterBaseX + clusterMaxWidth) {
        cursorX = clusterBaseX;
        cursorY += rowHeight + rowGapY;
        rowHeight = 0;
      }
      childLayouts.push({ app: childApp, x: cursorX, y: cursorY, w: childSize.w, h: childSize.h });
      minChildX = Math.min(minChildX, cursorX);
      maxChildRight = Math.max(maxChildRight, cursorX + childSize.w);
      rowHeight = Math.max(rowHeight, childSize.h);
      cursorX += childSize.w + childGapX;
    }

    const childBandCenter = minChildX < Infinity && maxChildRight > -Infinity
      ? (minChildX + maxChildRight) / 2
      : clusterBaseX + parentSize.w / 2;
    const parentX = Math.max(40, childBandCenter - parentSize.w / 2);
    const parentY = nextClusterY;
    if (!isPinned(parentApp)) patches.push({ thingId: cluster.parentId, opdId, patch: { x: parentX, y: parentY, ...parentSize } });
    placed.add(cluster.parentId);

    for (const child of childLayouts) {
      if (!isPinned(child.app)) {
        patches.push({
          thingId: child.app.thing,
          opdId,
          patch: { x: child.x, y: child.y, w: child.w, h: child.h },
        });
      }
      placed.add(child.app.thing);
    }

    const clusterBottom = childLayouts.reduce((max, child) => Math.max(max, child.y + child.h), childStartY);
    nextClusterY = clusterBottom + 54;
  }

  // Place remaining unplaced things in a separate right rail
  const unplaced = apps.filter((a) => !placed.has(a.thing));
  let remainX = 940;
  let remainY = 40;
  for (const app of unplaced) {
    const size = autoSizeAppearance(model, app);
    if (!isPinned(app)) patches.push({ thingId: app.thing, opdId, patch: { x: remainX, y: remainY, ...size } });
    remainY += size.h + VISUAL_RULES.spacing.nodeGap;
  }

  const strategy: LayoutStrategy = "structural-cluster";
  const finalized = finalizeLayout(model, strategy, apps, links, patches);
  return {
    strategy,
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

function layoutSdBalanced(
  model: Model, opdId: string, apps: Appearance[], links: Link[],
): LayoutSuggestion {
  const patches: AppearancePatch[] = [];

  const placeRow = (
    rowApps: Appearance[],
    y: number,
    minX: number,
    maxX: number,
    minWidth: number,
    minHeight: number,
  ) => {
    const laidOut = rowApps
      .filter((app) => !isPinned(app))
      .map((app) => ({
        app,
        size: autoSizeAppearance(model, { ...app, w: Math.max(app.w, minWidth), h: Math.max(app.h, minHeight) }),
      }));
    if (laidOut.length === 0) return;
    const gap = 40;
    const totalWidth = laidOut.reduce((sum, item) => sum + item.size.w, 0) + gap * Math.max(laidOut.length - 1, 0);
    const available = Math.max(maxX - minX, totalWidth);
    let cursorX = minX + Math.max(0, Math.floor((available - totalWidth) / 2));
    for (const item of laidOut) {
      patches.push({ thingId: item.app.thing, opdId, patch: { x: cursorX, y, ...item.size } });
      cursorX += item.size.w + gap;
    }
  };

  // Classify things into semantic bands
  const processes = apps.filter((a) => model.things.get(a.thing)?.kind === "process");
  const objects = apps.filter((a) => model.things.get(a.thing)?.kind === "object");
  const agents = objects.filter((a) => links.some((l) => l.type === "agent" && l.source === a.thing));
  const instruments = objects.filter((a) => links.some((l) => l.type === "instrument" && l.source === a.thing) && !agents.some((ag) => ag.thing === a.thing));
  const consumed = objects.filter((a) => links.some((l) => (l.type === "consumption" || l.type === "input") && l.source === a.thing));
  const results = objects.filter((a) => links.some((l) => (l.type === "result" || l.type === "output") && l.target === a.thing));
  const exhibited = objects.filter((a) => links.some((l) => l.type === "exhibition" && (l.source === a.thing || l.target === a.thing)));
  const remaining = objects.filter((a) =>
    !agents.some((x) => x.thing === a.thing) &&
    !instruments.some((x) => x.thing === a.thing) &&
    !consumed.some((x) => x.thing === a.thing) &&
    !results.some((x) => x.thing === a.thing) &&
    !exhibited.some((x) => x.thing === a.thing)
  );

  const mainProcesses = processes.filter((proc) => links.some((l) => l.type === "exhibition" && l.target === proc.thing));
  const secondaryProcesses = processes.filter((proc) => !mainProcesses.some((main) => main.thing === proc.thing));

  // Top band: exhibited attributes and descriptors.
  let topX = 60;
  const topY = 40;
  for (const app of exhibited) {
    const size = autoSizeAppearance(model, app);
    if (!isPinned(app)) patches.push({ thingId: app.thing, opdId, patch: { x: topX, y: topY, ...size } });
    topX += size.w + VISUAL_RULES.spacing.nodeGap;
  }

  // Central process band: explicit rows instead of a single shared anchor that causes overlaps.
  const mainRow = mainProcesses.length > 0 ? mainProcesses : processes.slice(0, 1);
  const auxProcesses = mainProcesses.length > 0 ? secondaryProcesses : processes.slice(1);
  placeRow(mainRow, 220, 260, 1080, 300, 100);

  const auxRows: Appearance[][] = [];
  const maxPerRow = 3;
  for (let i = 0; i < auxProcesses.length; i += maxPerRow) {
    auxRows.push(auxProcesses.slice(i, i + maxPerRow));
  }
  auxRows.forEach((row, rowIndex) => placeRow(row, 390 + rowIndex * 140, 220, 1120, 240, 72));

  // Left band: agents + consumed inputs.
  let leftY = 180;
  for (const group of [agents, consumed]) {
    for (const app of group) {
      const size = autoSizeAppearance(model, app);
      if (!isPinned(app)) patches.push({ thingId: app.thing, opdId, patch: { x: 40, y: leftY, ...size } });
      leftY += size.h + VISUAL_RULES.spacing.nodeGap;
    }
  }

  // Right band: instruments.
  let rightY = 180;
  for (const app of instruments) {
    const size = autoSizeAppearance(model, app);
    if (!isPinned(app)) patches.push({ thingId: app.thing, opdId, patch: { x: 1160, y: rightY, ...size } });
    rightY += size.h + VISUAL_RULES.spacing.nodeGap;
  }

  // Bottom band: results + remaining objects.
  const bottomBaseY = 560 + Math.max(0, auxRows.length - 1) * 140;
  let bottomY = bottomBaseY;
  let bottomX = 60;
  for (const group of [results, remaining]) {
    for (const app of group) {
      const size = autoSizeAppearance(model, app);
      if (!isPinned(app)) patches.push({ thingId: app.thing, opdId, patch: { x: bottomX, y: bottomY, ...size } });
      bottomX += size.w + VISUAL_RULES.spacing.nodeGap;
      if (bottomX > 1100) {
        bottomX = 60;
        bottomY += size.h + 36;
      }
    }
  }

  const strategy: LayoutStrategy = "sd-balanced";
  const finalized = finalizeLayout(model, strategy, apps, links, patches);
  return {
    strategy,
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

export function suggestLayoutForOpd(model: Model, opdId: string): LayoutSuggestion {
  const opd = model.opds.get(opdId);
  if (!opd) return { strategy: "none", patches: [], findings: [] };
  const projected = buildPatchableOpdProjectionSlice(model, opdId);
  const apps = projected.appearances;
  const links = projected.links;
  const fans = projected.fans;
  if (opd.refinement_type === "in-zoom") {
    const branching = layoutBranchingControl(model, opdId, apps, links, fans, opd.refines ?? undefined);
    if (branching.strategy !== "none") return branching;
    return layoutInZoom(model, opdId, apps, links, opd.refines ?? undefined);
  }
  if (opd.refinement_type === "unfold") return layoutUnfold(model, opdId, apps, links, opd.refines ?? undefined);

  // SD-level or view OPDs: prefer structural layout only when the OPD is actually dominated by structure
  const structuralScore = structuralDominanceScore(apps, links);
  if (structuralScore >= 0.65) {
    const structural = layoutStructuralCluster(model, opdId, apps, links);
    if (structural.strategy !== "none") return structural;
  }
  if (!opd.parent_opd || opd.opd_type === "view") {
    return layoutSdBalanced(model, opdId, apps, links);
  }
  return {
    strategy: "none",
    patches: [],
    findings: auditVisualOpd({ appearances: apps, links, things: model.things.values(), states: model.states.values() }),
  };
}
