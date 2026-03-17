import type { Model, Link } from "./types";

export function collectAllIds(model: Model): Set<string> {
  const ids = new Set<string>();
  for (const id of model.things.keys()) ids.add(id);
  for (const id of model.states.keys()) ids.add(id);
  for (const id of model.opds.keys()) ids.add(id);
  for (const id of model.links.keys()) ids.add(id);
  for (const id of model.modifiers.keys()) ids.add(id);
  for (const id of model.fans.keys()) ids.add(id);
  for (const id of model.scenarios.keys()) ids.add(id);
  for (const id of model.assertions.keys()) ids.add(id);
  for (const id of model.requirements.keys()) ids.add(id);
  for (const id of model.stereotypes.keys()) ids.add(id);
  for (const id of model.subModels.keys()) ids.add(id);
  return ids;
}

export function cleanPatch<T extends Record<string, unknown>>(patch: T): T {
  const cleaned = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return cleaned as T;
}

export function appearanceKey(thing: string, opd: string): string {
  return `${thing}::${opd}`;
}

export type TransformingMode = "effect" | "input-specified" | "output-specified" | "input-output";

export function transformingMode(link: Link): TransformingMode | null {
  if (link.type !== "effect") return null;
  const hasSource = !!link.source_state;
  const hasTarget = !!link.target_state;
  if (hasSource && hasTarget) return "input-output";
  if (hasSource) return "input-specified";
  if (hasTarget) return "output-specified";
  return "effect";
}

export function touch(model: Model): Model {
  return {
    ...model,
    meta: { ...model.meta, modified: new Date().toISOString() },
  };
}
