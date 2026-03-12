// packages/core/src/opl.ts
import type { Model } from "./types";
import type { InvariantError } from "./result";
import type { Result } from "./result";
import type { OplDocument, OplEdit } from "./opl-types";
import { ok } from "./result";

export function expose(_model: Model, _opdId: string): OplDocument {
  throw new Error("Not implemented");
}

export function applyOplEdit(_model: Model, _edit: OplEdit): Result<Model, InvariantError> {
  throw new Error("Not implemented");
}

export function render(_doc: OplDocument): string {
  throw new Error("Not implemented");
}

export function oplSlug(_name: string): string {
  throw new Error("Not implemented");
}

export function editsFrom(_doc: OplDocument): OplEdit[] {
  throw new Error("Not implemented");
}
