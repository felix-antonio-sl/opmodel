/**
 * KernelPatchOperation — descripción declarativa e inmutable de una
 * intención de mutación semántica sobre el SemanticKernel.
 *
 * ADR-008 I1: ningún evento visual muta kernel.things/links/states/etc.
 * directamente. Debe pasar por KernelPatchOperation → validate → apply
 * → re-derive spec → re-render.
 *
 * Las 6 operaciones iniciales cubren el context-menu del plan T3:
 * add thing, delete thing, rename thing, add link, delete link,
 * change link kind. Refinement/state/fan/modifier patches quedan
 * para operaciones posteriores.
 */

export interface AddThingPatch {
  op: "addThing";
  payload: {
    id?: string;
    kind: "object" | "process";
    name: string;
    affiliation?: "systemic" | "environmental";
    essence?: "physical" | "informatical";
    opdId?: string;
  };
}

export interface DeleteThingPatch {
  op: "deleteThing";
  payload: { thingId: string };
}

export interface RenameThingPatch {
  op: "renameThing";
  payload: { thingId: string; newName: string };
}

export interface AddLinkPatch {
  op: "addLink";
  payload: {
    id?: string;
    source: string;
    target: string;
    type: string;
    opdId?: string;
  };
}

export interface DeleteLinkPatch {
  op: "deleteLink";
  payload: { linkId: string };
}

export interface ChangeLinkKindPatch {
  op: "changeLinkKind";
  payload: { linkId: string; newKind: string };
}

export type KernelPatchOperation =
  | AddThingPatch
  | DeleteThingPatch
  | RenameThingPatch
  | AddLinkPatch
  | DeleteLinkPatch
  | ChangeLinkKindPatch;

export interface KernelPatchValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface KernelPatchValidationResult {
  ok: boolean;
  issues: KernelPatchValidationIssue[];
}

export interface KernelPatchApplyResult {
  ok: boolean;
  createdId?: string;
  error?: string;
}
