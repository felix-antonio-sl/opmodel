import { addAppearance, addLink, addThing, refineThing, removeLink, updateThing } from "../api";
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

function linkId(childOpdId: string, role: string, source: string, target: string, index: number) {
  return `${childOpdId}-${role}-${source}-${target}-${index}`;
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

  const orderedSubprocessIds = [...nextModel.appearances.values()]
    .filter((appearance) => appearance.opd === childOpdId && appearance.internal && nextModel.things.get(appearance.thing)?.kind === "process" && appearance.thing !== mainProcessId)
    .sort((a, b) => a.y - b.y)
    .map((appearance) => appearance.thing);

  const parentTransformLinks = [...nextModel.links.values()].filter(
    (link) => (link.source === mainProcessId || link.target === mainProcessId) && ["consumption", "result", "input", "output", "effect"].includes(link.type),
  );

  const inboundLinks = parentTransformLinks.filter((link) => link.target === mainProcessId && ["consumption", "input"].includes(link.type));
  const outboundLinks = parentTransformLinks.filter((link) => link.source === mainProcessId && ["result", "output", "effect"].includes(link.type));

  for (const link of parentTransformLinks) {
    if (link.type === "consumption" || link.type === "result" || link.type === "input" || link.type === "output") {
      const removed = removeLink(nextModel, link.id);
      if (!removed.ok) return err({ message: removed.error.message });
      nextModel = removed.value;
    }
  }

  const firstSubprocessId = orderedSubprocessIds[0];
  const lastSubprocessId = orderedSubprocessIds[orderedSubprocessIds.length - 1];
  let generatedLinkIndex = 0;

  if (firstSubprocessId) {
    for (const link of inboundLinks) {
      const added = addLink(nextModel, {
        ...link,
        id: linkId(childOpdId, "distributed-in", link.source, firstSubprocessId, ++generatedLinkIndex),
        target: firstSubprocessId,
      });
      if (!added.ok) return err({ message: added.error.message });
      nextModel = added.value;
    }
  }

  if (lastSubprocessId) {
    for (const link of outboundLinks) {
      const added = addLink(nextModel, {
        ...link,
        id: linkId(childOpdId, "distributed-out", lastSubprocessId, link.target, ++generatedLinkIndex),
        source: lastSubprocessId,
      });
      if (!added.ok) return err({ message: added.error.message });
      nextModel = added.value;
    }
  }

  const fallbackTransformeeId = inboundLinks[0]?.source ?? outboundLinks[0]?.target;
  if (fallbackTransformeeId) {
    for (const subprocessId of orderedSubprocessIds.slice(1, -1)) {
      const consume = addLink(nextModel, {
        id: linkId(childOpdId, "sub-consumption", fallbackTransformeeId, subprocessId, ++generatedLinkIndex),
        type: "consumption",
        source: fallbackTransformeeId,
        target: subprocessId,
      });
      if (!consume.ok) return err({ message: consume.error.message });
      nextModel = consume.value;

      const resultLink = addLink(nextModel, {
        id: linkId(childOpdId, "sub-result", subprocessId, fallbackTransformeeId, ++generatedLinkIndex),
        type: "result",
        source: subprocessId,
        target: fallbackTransformeeId,
      });
      if (!resultLink.ok) return err({ message: resultLink.error.message });
      nextModel = resultLink.value;
    }
  }

  return ok({
    model: nextModel,
    kernel: semanticKernelFromModel(nextModel),
    mainProcessId,
    childOpdId,
  });
}
