import { addAppearance, addLink, addState, addThing, updateSettings } from "../api";
import { createModel } from "../model";
import type { Result } from "../result";
import { err, ok } from "../result";
import { semanticKernelFromModel } from "../semantic-kernel";
import type { Link, Model, State, Thing } from "../types";
import type { SemanticKernel } from "../semantic-kernel";
import type { DraftValidationIssue, SdDraft } from "./sd-draft-types";
import { validateSdDraft } from "./sd-draft-validation";

export interface DraftToKernelError {
  message: string;
  issues: DraftValidationIssue[];
}

export interface DraftBuildArtifacts {
  model: Model;
  kernel: SemanticKernel;
}

function slug(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function nonEmpty(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

export function buildModelFromSdDraft(draft: SdDraft): Result<Model, DraftToKernelError> {
  const report = validateSdDraft(draft);
  if (!report.ok) {
    return err({
      message: "SdDraft inválido para construir SD base",
      issues: report.issues,
    });
  }

  let model = createModel(draft.systemName.trim(), draft.systemType);
  const settings = updateSettings(model, { opl_language: "en" });
  if (settings.ok) model = settings.value;

  let counter = 0;
  const nextId = (prefix: string, name: string) => `${prefix}-${slug(name)}-${++counter}`;

  const addThingToModel = (thing: Omit<Thing, "id">, x: number, y: number, w = 180, h = 56) => {
    const id = nextId(thing.kind === "process" ? "proc" : "obj", thing.name);
    const thingResult = addThing(model, { ...thing, id } as Thing);
    if (!thingResult.ok) throw new Error(thingResult.error.message);
    model = thingResult.value;
    const appResult = addAppearance(model, { thing: id, opd: "opd-sd", x, y, w, h });
    if (!appResult.ok) throw new Error(appResult.error.message);
    model = appResult.value;
    return id;
  };

  const addLinkToModel = (link: Omit<Link, "id">) => {
    const result = addLink(model, { ...link, id: nextId("lnk", `${link.type}-${link.source}-${link.target}`) } as Link);
    if (!result.ok) throw new Error(result.error.message);
    model = result.value;
  };

  const addStateToModel = (parent: string, name: string, flags?: Partial<Pick<State, "initial" | "final" | "default">>) => {
    const id = nextId("st", `${parent}-${name}`);
    const result = addState(model, {
      id,
      parent,
      name,
      initial: flags?.initial ?? false,
      final: flags?.final ?? false,
      default: flags?.default ?? false,
    } as State);
    if (!result.ok) throw new Error(result.error.message);
    model = result.value;
    return id;
  };

  const processId = addThingToModel(
    { kind: "process", name: draft.mainProcess.trim(), essence: "physical", affiliation: "systemic" },
    380,
    280,
    260,
    96,
  );

  const systemId = addThingToModel(
    { kind: "object", name: draft.systemName.trim(), essence: "physical", affiliation: "systemic" },
    390,
    90,
    240,
    60,
  );
  addLinkToModel({ type: "instrument", source: systemId, target: processId });

  if (draft.beneficiary.trim()) {
    const beneficiaryId = addThingToModel(
      { kind: "object", name: draft.beneficiary.trim(), essence: "physical", affiliation: draft.systemType === "natural" ? "systemic" : "environmental" },
      70,
      90,
      220,
      60,
    );

    if (draft.beneficiaryAttribute.trim()) {
      const attributeId = addThingToModel(
        { kind: "object", name: draft.beneficiaryAttribute.trim(), essence: "informatical", affiliation: "systemic" },
        80,
        190,
        230,
        56,
      );
      addLinkToModel({ type: "exhibition", source: beneficiaryId, target: attributeId });
      if (draft.beneficiaryStateIn.trim() || draft.beneficiaryStateOut.trim()) {
        const sourceStateId = draft.beneficiaryStateIn.trim()
          ? addStateToModel(attributeId, draft.beneficiaryStateIn.trim(), { initial: true, default: true })
          : undefined;
        const targetStateId = draft.beneficiaryStateOut.trim()
          ? addStateToModel(attributeId, draft.beneficiaryStateOut.trim(), { final: true })
          : undefined;
        addLinkToModel({
          type: "effect",
          source: processId,
          target: attributeId,
          ...(sourceStateId ? { source_state: sourceStateId } : {}),
          ...(targetStateId ? { target_state: targetStateId } : {}),
        });
      }
    }
  }

  const valueObjectId = addThingToModel(
    { kind: "object", name: draft.valueObject.trim(), essence: "physical", affiliation: "systemic" },
    700,
    100,
    220,
    60,
  );
  if (draft.valueStateIn.trim() || draft.valueStateOut.trim()) {
    const sourceStateId = draft.valueStateIn.trim()
      ? addStateToModel(valueObjectId, draft.valueStateIn.trim(), { initial: true, default: true })
      : undefined;
    const targetStateId = draft.valueStateOut.trim()
      ? addStateToModel(valueObjectId, draft.valueStateOut.trim(), { final: true })
      : undefined;
    addLinkToModel({
      type: "effect",
      source: processId,
      target: valueObjectId,
      ...(sourceStateId ? { source_state: sourceStateId } : {}),
      ...(targetStateId ? { target_state: targetStateId } : {}),
    });
  }

  let agentY = 250;
  for (const agent of nonEmpty(draft.agents)) {
    const agentId = addThingToModel(
      { kind: "object", name: agent, essence: "physical", affiliation: "systemic" },
      70,
      agentY,
      180,
      52,
    );
    addLinkToModel({ type: "agent", source: agentId, target: processId });
    agentY += 74;
  }

  let instrumentY = 250;
  for (const instrument of nonEmpty(draft.instruments)) {
    const instrumentId = addThingToModel(
      { kind: "object", name: instrument, essence: "physical", affiliation: "systemic" },
      720,
      instrumentY,
      200,
      52,
    );
    addLinkToModel({ type: "instrument", source: instrumentId, target: processId });
    instrumentY += 74;
  }

  let inputY = 470;
  for (const input of nonEmpty(draft.inputs)) {
    const inputId = addThingToModel(
      { kind: "object", name: input, essence: "physical", affiliation: "systemic" },
      70,
      inputY,
      200,
      52,
    );
    addLinkToModel({ type: "consumption", source: inputId, target: processId });
    inputY += 64;
  }

  let outputY = 470;
  for (const output of nonEmpty(draft.outputs)) {
    const outputId = addThingToModel(
      { kind: "object", name: output, essence: "physical", affiliation: "systemic" },
      720,
      outputY,
      200,
      52,
    );
    addLinkToModel({ type: "result", source: processId, target: outputId });
    outputY += 64;
  }

  let environmentY = 620;
  for (const item of nonEmpty(draft.environment)) {
    const envId = addThingToModel(
      { kind: "object", name: item, essence: "physical", affiliation: "environmental" },
      390,
      environmentY,
      230,
      52,
    );
    addLinkToModel({ type: "instrument", source: envId, target: processId });
    environmentY += 64;
  }

  if (draft.problemOccurrence?.trim()) {
    const problemId = addThingToModel(
      { kind: "process", name: draft.problemOccurrence.trim(), essence: "physical", affiliation: "environmental" },
      390,
      520,
      240,
      76,
    );
    addLinkToModel({ type: "invocation", source: problemId, target: processId });
  }

  return ok(model);
}

export function sdDraftToKernel(draft: SdDraft): Result<SemanticKernel, DraftToKernelError> {
  const modelResult = buildModelFromSdDraft(draft);
  if (!modelResult.ok) return modelResult;
  return ok(semanticKernelFromModel(modelResult.value));
}

export function buildArtifactsFromSdDraft(draft: SdDraft): Result<DraftBuildArtifacts, DraftToKernelError> {
  const modelResult = buildModelFromSdDraft(draft);
  if (!modelResult.ok) return modelResult;
  return ok({
    model: modelResult.value,
    kernel: semanticKernelFromModel(modelResult.value),
  });
}
