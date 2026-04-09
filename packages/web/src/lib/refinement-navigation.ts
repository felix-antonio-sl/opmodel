import type { Appearance, Model, OPD, Thing, RefinementType } from "@opmodel/core";

export interface RefinementContext {
  currentOpd: OPD | null;
  parentOpd: OPD | null;
  refinedThing: Thing | null;
  siblingRefinements: OPD[];
  selectedThingChildRefinements: OPD[];
}

export interface RefinementActionState {
  enabled: boolean;
  reason?: string;
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

export function isInOwnRefinementTree(model: Model, thingId: string, opdId: string): boolean {
  let id: string | null = opdId;
  while (id) {
    const opd = model.opds.get(id);
    if (!opd) break;
    if (opd.refines === thingId) return true;
    id = opd.parent_opd;
  }
  return false;
}

export function getRefinementActionState(
  model: Model,
  opdId: string,
  thing: Thing | null,
  appearance: Appearance | null | undefined,
  existing: OPD[],
  type: RefinementType,
): RefinementActionState {
  const opd = model.opds.get(opdId);
  if (!thing) return { enabled: false, reason: "Select a thing first" };
  if (!opd || opd.opd_type !== "hierarchical") return { enabled: false, reason: "Only hierarchical OPDs can create refinements" };
  if (appearance?.internal === false) return { enabled: false, reason: "External appearance, refine from its home OPD" };
  if (isInOwnRefinementTree(model, thing.id, opdId)) return { enabled: false, reason: "Cannot refine from inside the same refinement tree" };
  if (type === "unfold" && thing.kind !== "object") return { enabled: false, reason: "Unfold is only available for objects" };
  if (existing.some((child) => child.refinement_type === type)) return { enabled: false, reason: `This ${type} refinement already exists here` };
  return { enabled: true };
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
