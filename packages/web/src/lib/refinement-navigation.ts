import type { Model, OPD, Thing, RefinementType } from "@opmodel/core";

export interface RefinementContext {
  currentOpd: OPD | null;
  parentOpd: OPD | null;
  refinedThing: Thing | null;
  siblingRefinements: OPD[];
  selectedThingChildRefinements: OPD[];
}

export function nextChildOpdName(model: Model, parentOpdId: string): string {
  const parentOpd = model.opds.get(parentOpdId);
  const parentName = parentOpd?.name ?? "SD";
  let maxN = 0;
  for (const opd of model.opds.values()) {
    if (opd.parent_opd === parentOpdId) maxN += 1;
  }
  const sep = /\d$/.test(parentName) ? "." : "";
  return `${parentName}${sep}${maxN + 1}`;
}

export function canCreateRefinement(thing: Thing | null, existing: OPD[], type: RefinementType): boolean {
  if (!thing) return false;
  if (type === "unfold" && thing.kind !== "object") return false;
  return !existing.some((opd) => opd.refinement_type === type);
}

export function getRefinementContext(model: Model, opdId: string, selectedThingId?: string | null): RefinementContext {
  const currentOpd = model.opds.get(opdId) ?? null;
  const parentOpd = currentOpd?.parent_opd ? model.opds.get(currentOpd.parent_opd) ?? null : null;
  const refinedThing = currentOpd?.refines ? model.things.get(currentOpd.refines) ?? null : null;

  const siblingRefinements = currentOpd?.parent_opd && currentOpd.refines
    ? [...model.opds.values()]
        .filter((opd) => opd.parent_opd === currentOpd.parent_opd && opd.refines === currentOpd.refines && opd.id !== currentOpd.id)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const selectedThingChildRefinements = selectedThingId
    ? [...model.opds.values()]
        .filter((opd) => opd.parent_opd === opdId && opd.refines === selectedThingId)
        .sort((a, b) => {
          if ((a.refinement_type ?? "") !== (b.refinement_type ?? "")) return (a.refinement_type ?? "").localeCompare(b.refinement_type ?? "");
          return a.name.localeCompare(b.name);
        })
    : [];

  return {
    currentOpd,
    parentOpd,
    refinedThing,
    siblingRefinements,
    selectedThingChildRefinements,
  };
}
