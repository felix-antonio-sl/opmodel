import { addAppearance, addThing, refineThing, updateThing } from "../api";
import type { Result } from "../result";
import { err, ok } from "../result";
import { semanticKernelFromModel } from "../semantic-kernel";
import type { SemanticKernel } from "../semantic-kernel";
import type { Model, Thing } from "../types";

export interface MainProcessRefinementDraft {
  childOpdId?: string;
  childOpdName?: string;
  subprocesses: string[];
  internalObjects?: string[];
}

export interface RefinedMainProcessArtifacts {
  model: Model;
  kernel: SemanticKernel;
  mainProcessId: string;
  childOpdId: string;
}

export interface RefineMainProcessError {
  message: string;
}

function slug(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function nonEmpty(items: string[] | undefined): string[] {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

export function inferMainProcessId(model: Model): string | null {
  const sdProcessAppearance = [...model.appearances.values()].find((appearance) => {
    if (appearance.opd !== "opd-sd") return false;
    return model.things.get(appearance.thing)?.kind === "process";
  });
  return sdProcessAppearance?.thing ?? null;
}

export function refineMainProcess(
  model: Model,
  draft: MainProcessRefinementDraft,
  options?: { mainProcessId?: string },
): Result<RefinedMainProcessArtifacts, RefineMainProcessError> {
  const mainProcessId = options?.mainProcessId ?? inferMainProcessId(model);
  if (!mainProcessId) {
    return err({ message: "Could not infer main process from SD." });
  }

  const mainProcess = model.things.get(mainProcessId);
  if (!mainProcess || mainProcess.kind !== "process") {
    return err({ message: `Thing ${mainProcessId} is not a process.` });
  }

  const subprocesses = nonEmpty(draft.subprocesses);
  if (subprocesses.length === 0) {
    return err({ message: "At least one subprocess is required for SD1 refinement." });
  }

  const childOpdId = draft.childOpdId?.trim() || "opd-sd1";
  const childOpdName = draft.childOpdName?.trim() || "SD1";

  const refined = refineThing(model, mainProcessId, "opd-sd", "in-zoom", childOpdId, childOpdName);
  if (!refined.ok) {
    return err({ message: refined.error.message });
  }

  let nextModel = refined.value;
  const placeholderIds = [...nextModel.appearances.values()]
    .filter((appearance) => appearance.opd === childOpdId && appearance.internal && nextModel.things.get(appearance.thing)?.kind === "process" && appearance.thing !== mainProcessId)
    .map((appearance) => appearance.thing)
    .slice(0, subprocesses.length);

  for (let index = 0; index < placeholderIds.length; index += 1) {
    const placeholderId = placeholderIds[index]!;
    const name = subprocesses[index]!;
    const updated = updateThing(nextModel, placeholderId, { name });
    if (!updated.ok) {
      return err({ message: updated.error.message });
    }
    nextModel = updated.value;
  }

  if (subprocesses.length > placeholderIds.length) {
    let counter = 0;
    for (const name of subprocesses.slice(placeholderIds.length)) {
      const id = `${childOpdId}-proc-${slug(name)}-${++counter}`;
      const thingResult = addThing(nextModel, {
        id,
        kind: "process",
        name,
        essence: mainProcess.essence,
        affiliation: mainProcess.affiliation,
      } as Thing);
      if (!thingResult.ok) return err({ message: thingResult.error.message });
      nextModel = thingResult.value;
      const appearanceResult = addAppearance(nextModel, {
        thing: id,
        opd: childOpdId,
        x: 240,
        y: 80 + (placeholderIds.length + counter - 1) * 92,
        w: 120,
        h: 50,
        internal: true,
      });
      if (!appearanceResult.ok) return err({ message: appearanceResult.error.message });
      nextModel = appearanceResult.value;
    }
  }

  let objectCounter = 0;
  for (const name of nonEmpty(draft.internalObjects)) {
    const id = `${childOpdId}-obj-${slug(name)}-${++objectCounter}`;
    const thingResult = addThing(nextModel, {
      id,
      kind: "object",
      name,
      essence: "physical",
      affiliation: "systemic",
    } as Thing);
    if (!thingResult.ok) return err({ message: thingResult.error.message });
    nextModel = thingResult.value;
    const appearanceResult = addAppearance(nextModel, {
      thing: id,
      opd: childOpdId,
      x: 180 + (objectCounter % 2) * 170,
      y: 70 + placeholderIds.length * 100 + objectCounter * 68,
      w: 140,
      h: 48,
      internal: true,
    });
    if (!appearanceResult.ok) return err({ message: appearanceResult.error.message });
    nextModel = appearanceResult.value;
  }

  return ok({
    model: nextModel,
    kernel: semanticKernelFromModel(nextModel),
    mainProcessId,
    childOpdId,
  });
}
