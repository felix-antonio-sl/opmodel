import type { Appearance, Fan, Link, Model, Thing } from "@opmodel/core";
import { auditVisualOpd, type VisualFinding } from "./visual-lint";
import { VISUAL_RULES, minimumWidthForStateNames } from "./visual-rules";

export interface AppearancePatch {
  thingId: string;
  opdId: string;
  patch: Partial<Pick<Appearance, "x" | "y" | "w" | "h">>;
}

export interface LayoutSuggestion {
  strategy: "in-zoom-sequential" | "unfold-grid" | "branching-control" | "structural-cluster" | "sd-balanced" | "none";
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

function resolveLaneOverlaps(entries: Array<{ thingId: string; y: number; h: number }>, minGap = VISUAL_RULES.spacing.nodeGap) {
  const sorted = [...entries].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const prevBottom = sorted[i - 1].y + sorted[i - 1].h + minGap;
    if (sorted[i].y < prevBottom) sorted[i].y = prevBottom;
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

function applyRelaxationPass(apps: Appearance[], iterations = 3): Appearance[] {
  const relaxed = apps.map((app) => ({ ...app }));
  const visible = relaxed.filter((a) => !a.internal).sort((a, b) => sortByPosition(a, b));
  const gap = VISUAL_RULES.spacing.nodeGap;

  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i];
        const b = visible[j];
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
        } else {
          target.y += Math.max(gap, overlapY + gap);
        }
      }
    }
  }

  return relaxed;
}

function finalizeLayout(
  model: Model,
  apps: Appearance[],
  links: Link[],
  patches: AppearancePatch[],
): { patches: AppearancePatch[]; findings: VisualFinding[] } {
  const pinnedIds = new Set(apps.filter((app) => app.pinned).map((app) => app.thing));
  const effectivePatches = patches.filter((patch) => !pinnedIds.has(patch.thingId));
  const patchedApps = apps.map((app) => {
    const p = effectivePatches.find((x) => x.thingId === app.thing);
    if (!p) return app;
    if (!allowsAutoSizing(app)) {
      const { w: _w, h: _h, ...rest } = p.patch;
      return { ...app, ...rest };
    }
    return { ...app, ...p.patch };
  });
  const relaxedApps = applyRelaxationPass(patchedApps);
  const relaxedPatches: AppearancePatch[] = relaxedApps.map((app) => {
    const original = apps.find((a) => a.thing === app.thing)!;
    const patch: Partial<Pick<Appearance, "x" | "y" | "w" | "h">> = allowsAutoSizing(original)
      ? { x: app.x, y: app.y, w: app.w, h: app.h }
      : { x: app.x, y: app.y };
    return {
      thingId: app.thing,
      opdId: app.opd,
      patch,
    } satisfies AppearancePatch;
  }).filter((patch) => {
    const original = apps.find((a) => a.thing === patch.thingId)!;
    if (original.pinned) return false;
    return original.x !== patch.patch.x || original.y !== patch.patch.y || original.w !== patch.patch.w || original.h !== patch.patch.h;
  });

  return {
    patches: relaxedPatches,
    findings: auditVisualOpd({ appearances: relaxedApps, links, things: model.things.values(), states: model.states.values() }),
  };
}

function preferredWidth(model: Model, app: Appearance, thing: Thing | undefined): number {
  const stateNames = [...model.states.values()].filter((s) => s.parent === app.thing).map((s) => s.name);
  if (stateNames.length > 0) return Math.max(app.w, minimumWidthForStateNames(stateNames));
  if (thing?.kind === "process") return Math.max(app.w, VISUAL_RULES.size.minProcessWidth);
  return Math.max(app.w, VISUAL_RULES.size.minObjectWidth);
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

function layoutBranchingControl(model: Model, opdId: string, apps: Appearance[], links: Link[], fans: Fan[], refines?: string): LayoutSuggestion {
  const patches: AppearancePatch[] = [];
  const container = refines ? apps.find((a) => a.thing === refines) : undefined;
  const internal = apps.filter((a) => a.internal && a.thing !== refines).sort(sortByPosition);
  const external = apps.filter((a) => !a.internal).sort(sortByPosition);
  if (!container || internal.length === 0) return { strategy: "none", patches: [], findings: [] };

  const internalProcessIds = new Set(internal.map((a) => a.thing));
  const diverging = fans.find((f) => f.direction === "diverging" && (f.type === "xor" || f.type === "or" || f.type === "and"));
  if (!diverging) return { strategy: "none", patches: [], findings: [] };

  const branchIds = branchProcessIdsForFan(diverging, links, internalProcessIds);
  const branches = internal.filter((a) => branchIds.includes(a.thing)).sort(sortByPosition);
  const trunk = internal.filter((a) => !branchIds.includes(a.thing)).sort(sortByPosition);
  if (branches.length === 0) return { strategy: "none", patches: [], findings: [] };

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

  const finalized = finalizeLayout(model, apps, links, patches);
  return {
    strategy: "branching-control",
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

function layoutInZoom(model: Model, opdId: string, apps: Appearance[], links: Link[], refines?: string): LayoutSuggestion {
  const patches: AppearancePatch[] = [];
  const container = refines ? apps.find((a) => a.thing === refines) : undefined;
  const internal = apps.filter((a) => a.internal && a.thing !== refines).sort(sortByPosition);
  const external = apps.filter((a) => !a.internal).sort(sortByPosition);
  if (!container || internal.length === 0) return { strategy: "none", patches: [], findings: [] };

  const containerX = container.x;
  const containerY = container.y;
  const processW = 240;
  const processH = 60;
  const processGap = 52;
  const processX = containerX + 120;
  const processStartY = containerY + 70;

  const internalProcessIds = new Set(internal.map((a) => a.thing));
  internal.filter((app) => !isPinned(app)).forEach((app, i) => {
    patches.push({
      thingId: app.thing,
      opdId,
      patch: { x: processX, y: processStartY + i * (processH + processGap), w: Math.max(app.w, processW), h: Math.max(app.h, processH) },
    });
  });

  const lastInternalBottom = processStartY + (internal.length - 1) * (processH + processGap) + processH;
  const targetContainerW = Math.max(container.w, 420);
  const targetContainerH = Math.max(container.h, lastInternalBottom - containerY + 50);
  if (!isPinned(container)) patches.push({ thingId: container.thing, opdId, patch: { w: targetContainerW, h: targetContainerH } });

  const processCenters = new Map(internal.map((app, i) => [app.thing, processStartY + i * (processH + processGap) + processH / 2]));

  const laneBaseLeft = containerX - 240;
  const laneBaseRight = containerX + targetContainerW + 70;
  const leftEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];
  const rightEntries: Array<{ app: Appearance; y: number; h: number; w: number }> = [];

  for (const app of external) {
    const connected = linkedProcesses(app, internalProcessIds, links);
    const centerY = average(connected.map((id) => processCenters.get(id) ?? containerY + 100)) || containerY + 100;
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

  const finalized = finalizeLayout(model, apps, links, patches);

  return {
    strategy: "in-zoom-sequential",
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

function layoutUnfold(model: Model, opdId: string, apps: Appearance[], links: Link[], refines?: string): LayoutSuggestion {
  const patches: AppearancePatch[] = [];
  const container = refines ? apps.find((a) => a.thing === refines) : undefined;
  const internal = apps.filter((a) => a.internal && a.thing !== refines).sort(sortByPosition);
  const external = apps.filter((a) => !a.internal).sort(sortByPosition);
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

  const finalized = finalizeLayout(model, apps, links, patches);

  return {
    strategy: "unfold-grid",
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

const STRUCTURAL_TYPES = new Set(["aggregation", "exhibition", "generalization", "classification", "tagged"]);

interface StructuralCluster {
  parentId: string;
  childIds: string[];
  type: string;
}

function findStructuralClusters(links: Link[], visibleThings: Set<string>): StructuralCluster[] {
  const groups = new Map<string, StructuralCluster>();
  for (const link of links) {
    if (!STRUCTURAL_TYPES.has(link.type)) continue;
    if (!visibleThings.has(link.source) || !visibleThings.has(link.target)) continue;
    // Convention: parent is source for aggregation/exhibition/classification, target for generalization
    const parentId = link.type === "generalization" ? link.target : link.source;
    const childId = link.type === "generalization" ? link.source : link.target;
    const key = `${link.type}::${parentId}`;
    if (!groups.has(key)) groups.set(key, { parentId, childIds: [], type: link.type });
    groups.get(key)!.childIds.push(childId);
  }
  return [...groups.values()].filter((g) => g.childIds.length >= 1);
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
    const childGapX = cluster.type === "exhibition" ? 24 : 32;
    const rowGapY = cluster.type === "generalization" ? 48 : 36;
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

  const finalized = finalizeLayout(model, apps, links, patches);
  return {
    strategy: "structural-cluster",
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

function layoutSdBalanced(
  model: Model, opdId: string, apps: Appearance[], links: Link[],
): LayoutSuggestion {
  const patches: AppearancePatch[] = [];

  // Classify things into semantic bands
  const processes = apps.filter((a) => model.things.get(a.thing)?.kind === "process");
  const objects = apps.filter((a) => model.things.get(a.thing)?.kind === "object");
  const agents = objects.filter((a) => links.some((l) => l.type === "agent" && l.source === a.thing));
  const instruments = objects.filter((a) => links.some((l) => l.type === "instrument" && l.source === a.thing) && !agents.some((ag) => ag.thing === a.thing));
  const consumed = objects.filter((a) => links.some((l) => l.type === "consumption" && l.source === a.thing));
  const results = objects.filter((a) => links.some((l) => l.type === "result" && l.target === a.thing));
  const exhibited = objects.filter((a) => links.some((l) => l.type === "exhibition" && (l.source === a.thing || l.target === a.thing)));
  const remaining = objects.filter((a) =>
    !agents.some((x) => x.thing === a.thing) &&
    !instruments.some((x) => x.thing === a.thing) &&
    !consumed.some((x) => x.thing === a.thing) &&
    !results.some((x) => x.thing === a.thing) &&
    !exhibited.some((x) => x.thing === a.thing)
  );

  // Layout bands
  const centerX = 380;
  const centerY = 300;

  // Main process center
  for (const proc of processes) {
    if (isPinned(proc)) continue;
    const size = autoSizeAppearance(model, { ...proc, w: Math.max(proc.w, 300), h: Math.max(proc.h, 100) });
    const isMain = links.some((l) => l.type === "exhibition" && l.target === proc.thing);
    const y = isMain ? centerY : centerY + 200;
    patches.push({ thingId: proc.thing, opdId, patch: { x: centerX, y, ...size } });
  }

  // Left band: agents + consumed
  let leftY = 180;
  for (const group of [agents, consumed]) {
    for (const app of group) {
      const size = autoSizeAppearance(model, app);
      if (!isPinned(app)) patches.push({ thingId: app.thing, opdId, patch: { x: 40, y: leftY, ...size } });
      leftY += size.h + VISUAL_RULES.spacing.nodeGap;
    }
  }

  // Right band: instruments
  let rightY = 240;
  for (const app of instruments) {
    const size = autoSizeAppearance(model, app);
    if (!isPinned(app)) patches.push({ thingId: app.thing, opdId, patch: { x: 780, y: rightY, ...size } });
    rightY += size.h + VISUAL_RULES.spacing.nodeGap;
  }

  // Top band: exhibited attributes + beneficiary
  let topX = 50;
  for (const app of exhibited) {
    const size = autoSizeAppearance(model, app);
    if (!isPinned(app)) patches.push({ thingId: app.thing, opdId, patch: { x: topX, y: 40, ...size } });
    topX += size.w + VISUAL_RULES.spacing.nodeGap;
  }

  // Bottom band: results + remaining
  let bottomY = centerY + 200;
  let bottomX = 40;
  for (const group of [results, remaining]) {
    for (const app of group) {
      const size = autoSizeAppearance(model, app);
      if (!isPinned(app)) patches.push({ thingId: app.thing, opdId, patch: { x: bottomX, y: bottomY, ...size } });
      bottomX += size.w + VISUAL_RULES.spacing.nodeGap;
      if (bottomX > 800) { bottomX = 40; bottomY += 80; }
    }
  }

  const finalized = finalizeLayout(model, apps, links, patches);
  return {
    strategy: "sd-balanced",
    patches: finalized.patches,
    findings: finalized.findings,
  };
}

export function suggestLayoutForOpd(model: Model, opdId: string): LayoutSuggestion {
  const opd = model.opds.get(opdId);
  const apps = [...model.appearances.values()].filter((a) => a.opd === opdId);
  const ids = new Set(apps.map((a) => a.thing));
  const links = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
  const fans = [...model.fans.values()].filter((f) => f.members.some((id) => links.some((l) => l.id === id)));
  if (!opd) return { strategy: "none", patches: [], findings: [] };
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
