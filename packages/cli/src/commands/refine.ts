// packages/cli/src/commands/refine.ts
import {
  refineThing, type RefinementType,
} from "@opmodel/core";
import { handleResult, fatal } from "../format";
import { readModel, writeModel, resolveModelFile } from "../io";
import { slug } from "../slug";

interface RefineOptions {
  file?: string;
  opd: string;
  type: RefinementType;
}

interface RefineResult {
  type: "refinement";
  opd: { id: string; name: string; refines: string; refinement_type: string; parent_opd: string };
  appearancesCreated: number;
}

function computeChildOpdName(parentName: string, existingChildCount: number): string {
  const index = existingChildCount + 1;
  return parentName.length <= 2
    ? `${parentName}${index}`
    : `${parentName}.${index}`;
}


export function executeRefine(
  thingId: string,
  opts: RefineOptions,
): RefineResult {
  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);

  const parentOpd = model.opds.get(opts.opd);
  if (!parentOpd) {
    fatal(`OPD not found: ${opts.opd}`);
  }

  let childCount = 0;
  for (const opd of model.opds.values()) {
    if (opd.parent_opd === opts.opd) childCount++;
  }

  const childName = computeChildOpdName(parentOpd.name, childCount);
  const childId = `opd-${slug(childName)}`;

  const appearancesBefore = model.appearances.size;
  const newModel = handleResult(
    refineThing(model, thingId, opts.opd, opts.type, childId, childName),
    { json: false },
  );
  const appearancesCreated = newModel.appearances.size - appearancesBefore;

  writeModel(newModel, filePath);

  const createdOpd = newModel.opds.get(childId)!;
  return {
    type: "refinement",
    opd: {
      id: createdOpd.id,
      name: createdOpd.name,
      refines: createdOpd.refines!,
      refinement_type: createdOpd.refinement_type!,
      parent_opd: createdOpd.parent_opd!,
    },
    appearancesCreated,
  };
}
