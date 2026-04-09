import {
  findConsumptionResultPairs,
  projectLegacyModel,
  resolveLinksForOpd,
  type Appearance,
  type Fan,
  type LegacyProjection,
  type Link,
  type Model,
  type Modifier,
  type ResolvedLink,
  type State,
  type Thing,
  transformingMode,
} from "@opmodel/core";
import { statePillLayout } from "./visual-rules";

export interface OpdProjectionView {
  projection: LegacyProjection;
  appearancesByThing: Map<string, Appearance>;
  multiOpdThings: Set<string>;
}

export interface ProjectionStatePill {
  state: State;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProjectionVisualThing {
  thingId: string;
  thing: Thing | undefined;
  appearance: Appearance;
  implicit: boolean;
  suppressedStateIds: Set<string>;
  visibleStates: State[];
  hasSuppressedStates: boolean;
  hiddenStateCount: number;
  statePills: ProjectionStatePill[];
  isContainer: boolean;
  isRefined: boolean;
}

export interface ProjectionVisualLinkEntry {
  link: Link;
  modifier: Modifier | undefined;
  visualSource: string;
  visualTarget: string;
  labelOverride: string | undefined;
  isMergedPair: boolean;
  isInputHalf?: boolean;
  isOutputHalf?: boolean;
  aggregated?: boolean;
}

export interface ProjectionVisualGraph {
  thingsById: Map<string, ProjectionVisualThing>;
  links: ProjectionVisualLinkEntry[];
  implicitThingIds: Set<string>;
}

export interface PatchableOpdProjectionSlice extends OpdProjectionView {
  appearances: Appearance[];
  links: Link[];
  visualLinks: ResolvedLink[];
  visualGraph: ProjectionVisualGraph;
  fans: Fan[];
  patchableThingIds: Set<string>;
  visibleThingIds: Set<string>;
  suppressedStateIdsByThing: Map<string, Set<string>>;
}

export function buildOpdProjectionViewFromProjection(projection: LegacyProjection, opdId: string): OpdProjectionView {
  const appearancesByThing = new Map<string, Appearance>();

  const opdLayout = projection.layout.opdLayouts.get(opdId);
  if (opdLayout) {
    for (const occurrence of projection.atlas.occurrences.values()) {
      if (occurrence.opdId !== opdId) continue;
      const node = opdLayout.nodes.get(occurrence.id);
      if (!node) continue;
      appearancesByThing.set(occurrence.thingId, {
        thing: occurrence.thingId,
        opd: opdId,
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h,
        ...(occurrence.role === "internal" ? { internal: true } : {}),
        ...(node.pinned !== undefined ? { pinned: node.pinned } : {}),
        ...(node.autoSizing !== undefined ? { auto_sizing: node.autoSizing } : {}),
        ...(node.stateAlignment ? { state_alignment: node.stateAlignment } : {}),
      });
    }
  }

  const thingToOpds = new Map<string, Set<string>>();
  for (const occurrence of projection.atlas.occurrences.values()) {
    const bucket = thingToOpds.get(occurrence.thingId) ?? new Set<string>();
    bucket.add(occurrence.opdId);
    thingToOpds.set(occurrence.thingId, bucket);
  }
  const multiOpdThings = new Set<string>();
  for (const [thingId, opds] of thingToOpds) {
    if (opds.size > 1) multiOpdThings.add(thingId);
  }

  return { projection, appearancesByThing, multiOpdThings };
}

export function buildOpdProjectionView(model: Model, opdId: string): OpdProjectionView {
  return buildOpdProjectionViewFromProjection(projectLegacyModel(model), opdId);
}

export function buildPatchableOpdProjectionSliceFromProjection(
  projection: LegacyProjection,
  model: Model,
  opdId: string,
): PatchableOpdProjectionSlice {
  const view = buildOpdProjectionViewFromProjection(projection, opdId);
  const patchableThingIds = new Set<string>();
  const appearances: Appearance[] = [];
  const suppressedStateIdsByThing = new Map<string, Set<string>>();

  for (const app of model.appearances.values()) {
    if (app.opd !== opdId) continue;
    patchableThingIds.add(app.thing);
    const projected = view.appearancesByThing.get(app.thing);
    appearances.push(projected
      ? {
          ...projected,
          ...(app.internal ? { internal: true } : {}),
          ...(app.pinned !== undefined ? { pinned: app.pinned } : {}),
          ...(app.auto_sizing !== undefined ? { auto_sizing: app.auto_sizing } : {}),
          ...(app.state_alignment ? { state_alignment: app.state_alignment } : {}),
        }
      : app);
    suppressedStateIdsByThing.set(app.thing, new Set(app.suppressed_states ?? []));
  }

  const visualThingsById = new Map<string, ProjectionVisualThing>();
  for (const [thingId, projectedAppearance] of view.appearancesByThing) {
    const thing = model.things.get(thingId);
    const sourceAppearance = appearances.find((app) => app.thing === thingId);
    const appearance = sourceAppearance
      ? {
          ...projectedAppearance,
          ...(sourceAppearance.internal ? { internal: true } : {}),
          ...(sourceAppearance.pinned !== undefined ? { pinned: sourceAppearance.pinned } : {}),
          ...(sourceAppearance.auto_sizing !== undefined ? { auto_sizing: sourceAppearance.auto_sizing } : {}),
          ...(sourceAppearance.state_alignment ? { state_alignment: sourceAppearance.state_alignment } : {}),
        }
      : projectedAppearance;
    const suppressedStateIds = new Set(suppressedStateIdsByThing.get(thingId) ?? []);
    const visibleStates = [...model.states.values()]
      .filter((state) => state.parent === thingId)
      .filter((state) => !suppressedStateIds.has(state.id));

    const { pills, hiddenCount } = buildStatePills(appearance, visibleStates);

    visualThingsById.set(thingId, {
      thingId,
      thing,
      appearance,
      implicit: !patchableThingIds.has(thingId),
      suppressedStateIds,
      visibleStates,
      hasSuppressedStates: suppressedStateIds.size > 0,
      hiddenStateCount: hiddenCount + suppressedStateIds.size,
      statePills: pills,
      isContainer: false,
      isRefined: [...model.opds.values()].some((opd) => opd.refines === thingId),
    });
  }

  const containerThingId = model.opds.get(opdId)?.refines;
  if (containerThingId) {
    const entry = visualThingsById.get(containerThingId);
    if (entry) entry.isContainer = true;
  }

  const visibleThingIds = new Set(appearances.map((app) => app.thing));
  const links = [...model.links.values()].filter((link) => visibleThingIds.has(link.source) && visibleThingIds.has(link.target));
  const visualLinks = resolveLinksForOpd(model, opdId).filter((entry) => visibleThingIds.has(entry.visualSource) && visibleThingIds.has(entry.visualTarget));
  const visualGraph: ProjectionVisualGraph = {
    thingsById: visualThingsById,
    links: buildProjectionVisualLinks(model, visualLinks),
    implicitThingIds: new Set(
      [...visualThingsById.values()]
        .filter((entry) => entry.implicit)
        .map((entry) => entry.thingId),
    ),
  };
  const visibleLinkIds = new Set(visualLinks.map((entry) => entry.link.id));
  const fans = [...model.fans.values()].filter((fan) => fan.members.some((id) => visibleLinkIds.has(id)));

  return {
    ...view,
    appearances,
    links,
    visualLinks,
    visualGraph,
    fans,
    patchableThingIds,
    visibleThingIds,
    suppressedStateIdsByThing,
  };
}

export function buildPatchableOpdProjectionSlice(model: Model, opdId: string): PatchableOpdProjectionSlice {
  const projection = projectLegacyModel(model);
  return buildPatchableOpdProjectionSliceFromProjection(projection, model, opdId);
}

function buildStatePills(
  appearance: Appearance,
  visibleStates: State[],
): { pills: ProjectionStatePill[]; hiddenCount: number } {
  const denseInternalObject = appearance.internal && appearance.w <= 360;
  const minPillW = denseInternalObject ? 44 : 30;
  const minVisible = denseInternalObject ? 1 : 2;
  const preferredVisible = denseInternalObject ? 1 : Math.floor((appearance.w - 8) / (minPillW + 4));
  const maxVisible = Math.min(
    visibleStates.length,
    Math.max(minVisible, preferredVisible),
  );
  const layout = statePillLayout(appearance.w, maxVisible, denseInternalObject ? "compact" : "default");
  const visibleCount = Math.min(visibleStates.length, maxVisible);
  const totalPillW = visibleCount * (layout.pillW + 4) - 4;
  const startX = appearance.x + (appearance.w - totalPillW) / 2;
  const py = appearance.y + appearance.h - 4;
  const pills = visibleStates.slice(0, visibleCount).map((state, index) => ({
    state,
    x: startX + index * (layout.pillW + 4),
    y: py,
    w: layout.pillW,
    h: layout.pillH,
  }));
  return { pills, hiddenCount: Math.max(0, visibleStates.length - pills.length) };
}

function buildProjectionVisualLinks(model: Model, resolvedLinks: ResolvedLink[]): ProjectionVisualLinkEntry[] {
  const entries: ProjectionVisualLinkEntry[] = resolvedLinks.map((resolvedLink) => {
    let labelOverride = resolvedLink.splitHalf as string | undefined;
    if (!labelOverride && resolvedLink.link.source_state && resolvedLink.link.target_state) {
      const fromState = model.states.get(resolvedLink.link.source_state);
      const toState = model.states.get(resolvedLink.link.target_state);
      if (fromState && toState) {
        labelOverride = `${resolvedLink.link.type} (${fromState.name} → ${toState.name})`;
      }
    }

    return {
      link: resolvedLink.link,
      modifier: [...model.modifiers.values()].find((modifier) => modifier.over === resolvedLink.link.id),
      visualSource: resolvedLink.visualSource,
      visualTarget: resolvedLink.visualTarget,
      labelOverride,
      isMergedPair: false,
      aggregated: resolvedLink.aggregated,
    };
  });

  const pairs = findConsumptionResultPairs(model, resolvedLinks);
  const resultIds = new Set(pairs.map((pair) => pair.resultLink.id));
  const mergedEntries = new Map<string, ProjectionVisualLinkEntry>();

  for (const pair of pairs) {
    const consumptionEntry = entries.find((entry) => entry.link.id === pair.consumptionLink.id);
    const resultEntry = entries.find((entry) => entry.link.id === pair.resultLink.id);
    if (!consumptionEntry) continue;

    mergedEntries.set(pair.consumptionLink.id, {
      link: {
        ...consumptionEntry.link,
        source: pair.processId,
        target: pair.objectId,
        source_state: pair.consumptionLink.source_state,
        target_state: pair.resultLink.target_state,
      },
      modifier: consumptionEntry.modifier ?? resultEntry?.modifier,
      visualSource: pair.processId,
      visualTarget: pair.objectId,
      labelOverride: pair.fromStateName && pair.toStateName
        ? `${pair.fromStateName} → ${pair.toStateName}`
        : "consumption+result",
      isMergedPair: true,
    });
  }

  const filteredEntries = entries
    .filter((entry) => !resultIds.has(entry.link.id))
    .map((entry) => mergedEntries.get(entry.link.id) ?? entry);

  return adjustEffectEndpoints(model, filteredEntries);
}

function adjustEffectEndpoints(model: Model, entries: ProjectionVisualLinkEntry[]): ProjectionVisualLinkEntry[] {
  return entries.flatMap((entry) => {
    if (entry.aggregated) return [entry];

    const mode = transformingMode(entry.link);
    if (!mode || mode === "effect") return [entry];

    const sourceThing = model.things.get(entry.visualSource);
    const objectId = sourceThing?.kind === "object" ? entry.visualSource : entry.visualTarget;
    const processId = sourceThing?.kind === "process" ? entry.visualSource : entry.visualTarget;

    switch (mode) {
      case "input-specified":
        return [
          {
            ...entry,
            link: { ...entry.link },
            labelOverride: "input",
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            labelOverride: "output",
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true,
          },
        ];
      case "output-specified":
        return [
          {
            ...entry,
            link: { ...entry.link, target_state: undefined },
            labelOverride: "input",
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true,
          },
          {
            ...entry,
            link: { ...entry.link },
            labelOverride: "output",
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true,
          },
        ];
      case "input-output":
        return [
          {
            ...entry,
            link: { ...entry.link, target_state: undefined },
            labelOverride: "input",
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            labelOverride: "output",
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true,
          },
        ];
      default:
        return [entry];
    }
  });
}
