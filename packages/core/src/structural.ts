/**
 * Centralized structural link utilities.
 *
 * CONVENTION: For structural links, source = parent, target = child.
 *   - Aggregation:     source = whole,      target = part
 *   - Exhibition:      source = exhibitor,  target = feature
 *   - Generalization:  source = general,    target = specialization
 *   - Classification:  source = class,      target = instance
 *
 * NOTE: OPL compile follows this convention, but build scripts and fixtures
 * may use the opposite (source = child). All direction-dependent code MUST
 * use structuralParentEnd() hub detection instead of hardcoding direction.
 * Hub detection returns the side where one endpoint appears in 2+ links.
 */

import type { Model, Link, OpmDataView } from "./types";

export const STRUCTURAL_TYPES = new Set([
  "aggregation", "exhibition", "generalization", "classification",
]);

/**
 * Determine which link endpoint (source or target) is the parent for a given
 * structural link type across a set of links.
 *
 * Hub detection: the side where one endpoint appears in 2+ links is the parent side.
 * Default (no hubs or tie): "target" (conventional OPM direction).
 */
export function structuralParentEnd(
  links: Iterable<{ type: string; source: string; target: string }>,
  linkType: string,
): "source" | "target" {
  const bySrc = new Map<string, number>();
  const byTgt = new Map<string, number>();
  for (const link of links) {
    if (link.type !== linkType) continue;
    bySrc.set(link.source, (bySrc.get(link.source) ?? 0) + 1);
    byTgt.set(link.target, (byTgt.get(link.target) ?? 0) + 1);
  }
  const srcHubs = [...bySrc.values()].filter(c => c >= 2).length;
  const tgtHubs = [...byTgt.values()].filter(c => c >= 2).length;
  if (srcHubs > tgtHubs) return "source";
  if (tgtHubs > srcHubs) return "target";
  // No hubs: default "source" (invariant: source=parent for all structural types).
  return "source";
}

/**
 * Get structural children of a thing (parts, features, specializations, instances).
 * Direction-agnostic: uses hub detection to determine convention per link type.
 */
export function getStructuralChildren(
  model: OpmDataView,
  thingId: string,
  filterTypes?: Set<string>,
): Array<{ childId: string; link: Link }> {
  const types = filterTypes ?? STRUCTURAL_TYPES;
  const children: Array<{ childId: string; link: Link }> = [];

  for (const type of types) {
    const parentEnd = structuralParentEnd(model.links.values(), type);
    for (const link of model.links.values()) {
      if (link.type !== type) continue;
      const isParent = parentEnd === "source"
        ? link.source === thingId
        : link.target === thingId;
      if (isParent) {
        const childId = parentEnd === "source" ? link.target : link.source;
        children.push({ childId, link });
      }
    }
  }

  return children;
}

/**
 * Get the structural parent of a thing for a specific link type.
 * Returns the first parent found, or null.
 */
export function getStructuralParent(
  model: OpmDataView,
  thingId: string,
  linkType: string,
): { parentId: string; link: Link } | null {
  const parentEnd = structuralParentEnd(model.links.values(), linkType);
  for (const link of model.links.values()) {
    if (link.type !== linkType) continue;
    const isChild = parentEnd === "source"
      ? link.target === thingId
      : link.source === thingId;
    if (isChild) {
      const parentId = parentEnd === "source" ? link.source : link.target;
      return { parentId, link };
    }
  }
  return null;
}

/**
 * R-IH: Get all procedural links inherited via generalization hierarchy.
 * A specialization inherits all agent, instrument, consumption, result, effect links from its general.
 * Walks up the generalization chain (ISO §6.3).
 */
export function getInheritedLinks(model: OpmDataView, thingId: string): Link[] {
  const inherited: Link[] = [];
  const visited = new Set<string>();

  function walk(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    // Find generalizations where currentId is a specialization (child end)
    // Invariant: source=general, target=specialization
    const parentEnd = structuralParentEnd(model.links.values(), "generalization");
    for (const link of model.links.values()) {
      if (link.type !== "generalization") continue;
      const childEnd = parentEnd === "source" ? "target" : "source";
      if (link[childEnd] !== currentId) continue;
      const generalId = link[parentEnd];

      // Collect all procedural/enabling links of the general
      for (const l of model.links.values()) {
        if (l.type === "generalization" || l.type === "aggregation" || l.type === "exhibition" || l.type === "classification" || l.type === "tagged") continue;
        if (l.source === generalId || l.target === generalId) {
          inherited.push(l);
        }
      }

      // Continue up the hierarchy
      walk(generalId);
    }
  }

  walk(thingId);

  // R-IH-5: Override — if specialization has its own link of same type+endpoint, skip inherited
  const ownSignatures = new Set<string>();
  for (const l of model.links.values()) {
    if (l.source === thingId || l.target === thingId) {
      const other = l.source === thingId ? l.target : l.source;
      ownSignatures.add(`${l.type}::${other}`);
    }
  }
  // Inherited links have the general as endpoint; remap to check against specialization's own
  return inherited.filter(l => {
    const generalEnd = l.source === thingId ? l.target : (l.target === thingId ? l.source : null);
    // If inherited link doesn't touch the specialization directly, keep it
    // (it connects to the general which will be remapped at render time)
    if (!generalEnd) return true;
    return !ownSignatures.has(`${l.type}::${generalEnd}`);
  });

  // TODO R-IH-4: Environmental affiliation should propagate down generalization chain.
  // Attributes of environmental objects are automatically environmental (ISO line 302).
  // TODO R-IH-7: When multiple specializations share the same link (same type+endpoint),
  // suggest migrating that link to the general. Not yet implemented.
}
