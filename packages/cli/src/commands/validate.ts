// packages/cli/src/commands/validate.ts
import { validate, type InvariantError } from "@opmodel/core";
import { readModel, resolveModelFile } from "../io";

interface ValidateOptions {
  file?: string;
}

interface ValidateResult {
  valid: boolean;
  errors: InvariantError[];
  summary: {
    things: number;
    states: number;
    links: number;
    opds: number;
    modifiers: number;
    appearances: number;
  };
}

export function executeValidate(opts: ValidateOptions = {}): ValidateResult {
  const filePath = resolveModelFile(opts.file);
  const { model } = readModel(filePath);
  const errors = validate(model);

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      things: model.things.size,
      states: model.states.size,
      links: model.links.size,
      opds: model.opds.size,
      modifiers: model.modifiers.size,
      appearances: model.appearances.size,
    },
  };
}
