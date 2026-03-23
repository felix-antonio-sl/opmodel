/**
 * Centralized structural link utilities.
 *
 * Structural links (aggregation, exhibition, generalization, classification)
 * connect parent → children, but the link direction (source/target) is
 * inconsistent across model creation paths. This module provides a single
 * source of truth for resolving parent vs child.
 *
 * Convention detection: hub detection via structuralParentEnd().
 * If an endpoint appears as source in 2+ links of a type → source is parent.
 * If as target → target is parent. No hubs → default "target" (conventional).
 */

import type { Model, Link } from "./types";

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
  // No hubs (single links): per-type default convention.
  // Exhibition: target=parent (exhibitor). Canvas fix normalizes to this.
  // Others: source=parent (OPL convention, canvas convention).
  return linkType === "exhibition" ? "target" : "source";
}

/**
 * Get structural children of a thing (parts, features, specializations, instances).
 * Direction-agnostic: uses hub detection to determine convention per link type.
 */
export function getStructuralChildren(
  model: Model,
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
  model: Model,
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
