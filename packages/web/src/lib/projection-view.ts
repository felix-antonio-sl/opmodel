import {
  projectLegacyModel,
  type Appearance,
  type Fan,
  type LegacyProjection,
  type Link,
  type Model,
} from "@opmodel/core";

export interface OpdProjectionView {
  projection: LegacyProjection;
  appearancesByThing: Map<string, Appearance>;
  multiOpdThings: Set<string>;
}

export interface PatchableOpdProjectionSlice extends OpdProjectionView {
  appearances: Appearance[];
  links: Link[];
  fans: Fan[];
  patchableThingIds: Set<string>;
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

  for (const app of model.appearances.values()) {
    if (app.opd !== opdId) continue;
    patchableThingIds.add(app.thing);
    appearances.push(view.appearancesByThing.get(app.thing) ?? app);
  }

  const visibleThingIds = new Set(appearances.map((app) => app.thing));
  const links = [...model.links.values()].filter((link) => visibleThingIds.has(link.source) && visibleThingIds.has(link.target));
  const visibleLinkIds = new Set(links.map((link) => link.id));
  const fans = [...model.fans.values()].filter((fan) => fan.members.some((id) => visibleLinkIds.has(id)));

  return {
    ...view,
    appearances,
    links,
    fans,
    patchableThingIds,
  };
}

export function buildPatchableOpdProjectionSlice(model: Model, opdId: string): PatchableOpdProjectionSlice {
  const projection = projectLegacyModel(model);
  return buildPatchableOpdProjectionSliceFromProjection(projection, model, opdId);
}
