import type { Appearance, Fan, Link, Model, Thing } from "@opmodel/core";
import { auditVisualOpd, type VisualFinding } from "./visual-lint";
import { VISUAL_RULES, minimumWidthForStateNames } from "./visual-rules";

export interface AppearancePatch {
  thingId: string;
  opdId: string;
  patch: Partial<Pick<Appearance, "x" | "y" | "w" | "h">>;
}

export interface LayoutSuggestion {
  strategy: "in-zoom-sequential" | "unfold-grid" | "branching-control" | "none";
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

function resolveLaneOverlaps(entries: Array<{ thingId: string; y: number; h: number }>, minGap = VISUAL_RULES.spacing.nodeGap) {
  const sorted = [...entries].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const prevBottom = sorted[i - 1].y + sorted[i - 1].h + minGap;
    if (sorted[i].y < prevBottom) sorted[i].y = prevBottom;
  }
  return sorted;
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
  trunk.forEach((app, i) => {
    patches.push({
      thingId: app.thing,
      opdId,
      patch: { x: trunkStartX + i * (trunkW + trunkGap), y: trunkY + (i === 0 ? -70 : i === 1 ? 0 : 70), w: Math.max(app.w, 220), h: Math.max(app.h, 60) },
    });
  });

  const branchXs = [containerX + 100, containerX + 390, containerX + 690];
  branches.forEach((app, i) => {
    const x = branchXs[i] ?? (containerX + 100 + i * 250);
    const y = branchYBase + (i === 1 ? -60 : 20);
    patches.push({ thingId: app.thing, opdId, patch: { x, y, w: Math.max(app.w, 230), h: Math.max(app.h, 60) } });
  });

  const targetContainerW = Math.max(container.w, 980);
  const targetContainerH = Math.max(container.h, 560);
  patches.push({ thingId: container.thing, opdId, patch: { w: targetContainerW, h: targetContainerH } });

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

  const patchedApps = apps.map((app) => {
    const p = patches.find((x) => x.thingId === app.thing);
    return p ? { ...app, ...p.patch } : app;
  });
  return {
    strategy: "branching-control",
    patches,
    findings: auditVisualOpd({ appearances: patchedApps, links, things: model.things.values(), states: model.states.values() }),
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
  internal.forEach((app, i) => {
    patches.push({
      thingId: app.thing,
      opdId,
      patch: { x: processX, y: processStartY + i * (processH + processGap), w: Math.max(app.w, processW), h: Math.max(app.h, processH) },
    });
  });

  const lastInternalBottom = processStartY + (internal.length - 1) * (processH + processGap) + processH;
  const targetContainerW = Math.max(container.w, 420);
  const targetContainerH = Math.max(container.h, lastInternalBottom - containerY + 50);
  patches.push({ thingId: container.thing, opdId, patch: { w: targetContainerW, h: targetContainerH } });

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

  const patchedApps = apps.map((app) => {
    const p = patches.find((x) => x.thingId === app.thing);
    return p ? { ...app, ...p.patch } : app;
  });

  return {
    strategy: "in-zoom-sequential",
    patches,
    findings: auditVisualOpd({ appearances: patchedApps, links, things: model.things.values(), states: model.states.values() }),
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
  internal.forEach((app, idx) => {
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
  patches.push({ thingId: container.thing, opdId, patch: { w: targetContainerW, h: targetContainerH } });

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

  const patchedApps = apps.map((app) => {
    const p = patches.find((x) => x.thingId === app.thing);
    return p ? { ...app, ...p.patch } : app;
  });

  return {
    strategy: "unfold-grid",
    patches,
    findings: auditVisualOpd({ appearances: patchedApps, links, things: model.things.values(), states: model.states.values() }),
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
  return {
    strategy: "none",
    patches: [],
    findings: auditVisualOpd({ appearances: apps, links, things: model.things.values(), states: model.states.values() }),
  };
}
