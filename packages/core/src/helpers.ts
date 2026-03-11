import type { Model } from "./types";

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
