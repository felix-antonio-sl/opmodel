import type { Model, Link, Thing } from "../types";
import { ok, err, isOk, type Result } from "../result";
import type { InvariantError } from "../result";
import {
  addThing,
  removeThing,
  updateThing,
  addLink as apiAddLink,
  removeLink,
  updateLink,
  validate,
} from "../api";
import type {
  KernelPatchOperation,
  KernelPatchValidationResult,
  KernelPatchApplyResult,
} from "./kernel-patch-types";

/**
 * ADR-008 I5: semantic events always go through KernelPatchOperation.
 * Implementation delegates to the existing Model-level API — which is
 * where invariants I-01..I-37 already live — and lets the adapter
 * recompute kernel from the updated Model.
 */

function genId(prefix: string, existing: Set<string>): string {
  let i = 1;
  while (existing.has(`${prefix}-${i}`)) i++;
  return `${prefix}-${i}`;
}

function collectAllIds(model: Model): Set<string> {
  const ids = new Set<string>();
  for (const t of model.things.keys()) ids.add(t);
  for (const s of model.states.keys()) ids.add(s);
  for (const l of model.links.keys()) ids.add(l);
  return ids;
}

export interface PatchedModelResult {
  model: Model;
  createdId?: string;
}

export function applyKernelPatch(
  model: Model,
  patch: KernelPatchOperation,
): Result<PatchedModelResult, InvariantError> {
  switch (patch.op) {
    case "addThing": {
      const id = patch.payload.id ?? genId(patch.payload.kind === "process" ? "proc" : "obj", collectAllIds(model));
      const thing: Thing = {
        id,
        kind: patch.payload.kind,
        name: patch.payload.name,
        affiliation: patch.payload.affiliation ?? "systemic",
        essence: patch.payload.essence ?? "informatical",
      };
      const result = addThing(model, thing);
      if (!isOk(result)) return err(result.error);
      return ok({ model: result.value, createdId: id });
    }

    case "deleteThing": {
      const result = removeThing(model, patch.payload.thingId);
      if (!isOk(result)) return err(result.error);
      return ok({ model: result.value });
    }

    case "renameThing": {
      const existing = model.things.get(patch.payload.thingId);
      if (!existing) {
        return err({ code: "NOT_FOUND", message: `Thing not found: ${patch.payload.thingId}`, entity: patch.payload.thingId });
      }
      const result = updateThing(model, patch.payload.thingId, { name: patch.payload.newName });
      if (!isOk(result)) return err(result.error);
      return ok({ model: result.value });
    }

    case "addLink": {
      const id = patch.payload.id ?? genId("lnk", collectAllIds(model));
      const link: Link = {
        id,
        source: patch.payload.source,
        target: patch.payload.target,
        type: patch.payload.type as Link["type"],
      };
      const result = apiAddLink(model, link);
      if (!isOk(result)) return err(result.error);
      return ok({ model: result.value, createdId: id });
    }

    case "deleteLink": {
      const result = removeLink(model, patch.payload.linkId);
      if (!isOk(result)) return err(result.error);
      return ok({ model: result.value });
    }

    case "changeLinkKind": {
      const existing = model.links.get(patch.payload.linkId);
      if (!existing) {
        return err({ code: "NOT_FOUND", message: `Link not found: ${patch.payload.linkId}`, entity: patch.payload.linkId });
      }
      const result = updateLink(model, patch.payload.linkId, { type: patch.payload.newKind as Link["type"] });
      if (!isOk(result)) return err(result.error);
      return ok({ model: result.value });
    }
  }
}

export function validateKernelPatch(
  model: Model,
  patch: KernelPatchOperation,
): KernelPatchValidationResult {
  const applied = applyKernelPatch(model, patch);
  if (!isOk(applied)) {
    return {
      ok: false,
      issues: [{ code: applied.error.code, message: applied.error.message, severity: "error" }],
    };
  }
  const validation = validate(applied.value.model);
  if (validation.errors.length > 0) {
    return {
      ok: false,
      issues: validation.errors.map((e) => ({ code: e.code, message: e.message, severity: "error" as const })),
    };
  }
  return { ok: true, issues: validation.warnings.map((w) => ({ code: w.code, message: w.message, severity: "warning" as const })) };
}

export function tryApplyKernelPatch(
  model: Model,
  patch: KernelPatchOperation,
): KernelPatchApplyResult {
  const result = applyKernelPatch(model, patch);
  if (!isOk(result)) {
    return { ok: false, error: `${result.error.code}: ${result.error.message}` };
  }
  return { ok: true, createdId: result.value.createdId };
}
