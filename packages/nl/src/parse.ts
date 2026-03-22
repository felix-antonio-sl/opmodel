import { ok, err, type Result } from "@opmodel/core";
import type { NlEditDescriptor, ParseError } from "./types";

const VALID_KINDS = [
  "add-thing", "remove-thing", "add-states", "remove-state",
  "add-link", "remove-link", "add-modifier", "remove-modifier",
] as const;

const VALID_LINK_TYPES = [
  "agent", "instrument", "effect", "consumption", "result", "input", "output",
  "aggregation", "exhibition",
  "generalization", "classification", "tagged", "invocation", "exception",
];

const VALID_MODIFIER_TYPES = ["event", "condition"];
const VALID_ESSENCES = ["physical", "informatical"];
const VALID_AFFILIATIONS = ["systemic", "environmental"];

function extractJson(raw: string): string {
  // Try markdown fenced block first (```json or ```)
  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced && fenced[1] != null) return fenced[1].trim();
  // Try bare JSON array
  const array = raw.match(/\[[\s\S]*\]/);
  if (array) return array[0];
  return raw.trim();
}

function validateDescriptor(item: unknown, index: number): Result<NlEditDescriptor, ParseError> {
  if (typeof item !== "object" || item === null || !("kind" in item)) {
    return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: missing kind`, index });
  }

  const obj = item as Record<string, unknown>;
  const kind = obj.kind as string;

  if (!VALID_KINDS.includes(kind as any)) {
    return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: unknown kind "${kind}"`, index });
  }

  const trimStr = (v: unknown): string | undefined =>
    typeof v === "string" ? v.trim() : undefined;

  switch (kind) {
    case "add-thing": {
      const name = trimStr(obj.name);
      const thingKind = obj.thingKind;
      if (!name) return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-thing requires name`, index });
      if (thingKind !== "object" && thingKind !== "process")
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-thing requires thingKind "object" or "process"`, index });
      const essence = obj.essence ?? "informatical";
      if (!VALID_ESSENCES.includes(essence as string))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-thing invalid essence "${essence}"`, index });
      const affiliation = obj.affiliation ?? "systemic";
      if (!VALID_AFFILIATIONS.includes(affiliation as string))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-thing invalid affiliation "${affiliation}"`, index });
      return ok({
        kind: "add-thing" as const,
        name,
        thingKind,
        essence: essence as any,
        affiliation: affiliation as any,
      });
    }
    case "remove-thing": {
      const name = trimStr(obj.name);
      if (!name) return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-thing requires name`, index });
      return ok({ kind: "remove-thing" as const, name });
    }
    case "add-states": {
      const thingName = trimStr(obj.thingName);
      if (!thingName) return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-states requires thingName`, index });
      if (!Array.isArray(obj.stateNames) || obj.stateNames.length === 0)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-states requires non-empty stateNames array`, index });
      if (!obj.stateNames.every((s: unknown) => typeof s === "string"))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-states stateNames must all be strings`, index });
      const stateNames = obj.stateNames.map((s: string) => s.trim());
      return ok({ kind: "add-states" as const, thingName, stateNames });
    }
    case "remove-state": {
      const thingName = trimStr(obj.thingName);
      const stateName = trimStr(obj.stateName);
      if (!thingName || !stateName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-state requires thingName and stateName`, index });
      return ok({ kind: "remove-state" as const, thingName, stateName });
    }
    case "add-link": {
      const sourceName = trimStr(obj.sourceName);
      const targetName = trimStr(obj.targetName);
      const linkType = obj.linkType as string;
      if (!sourceName || !targetName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-link requires sourceName and targetName`, index });
      if (!VALID_LINK_TYPES.includes(linkType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-link invalid linkType "${linkType}"`, index });
      const desc: NlEditDescriptor = { kind: "add-link", sourceName, targetName, linkType: linkType as any };
      const sourceState = trimStr(obj.sourceState);
      const targetState = trimStr(obj.targetState);
      if (sourceState) (desc as any).sourceState = sourceState;
      if (targetState) (desc as any).targetState = targetState;
      return ok(desc);
    }
    case "remove-link": {
      const sourceName = trimStr(obj.sourceName);
      const targetName = trimStr(obj.targetName);
      const linkType = obj.linkType as string;
      if (!sourceName || !targetName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-link requires sourceName and targetName`, index });
      if (!VALID_LINK_TYPES.includes(linkType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-link invalid linkType "${linkType}"`, index });
      return ok({ kind: "remove-link" as const, sourceName, targetName, linkType: linkType as any });
    }
    case "add-modifier": {
      const sourceName = trimStr(obj.sourceName);
      const targetName = trimStr(obj.targetName);
      const linkType = obj.linkType as string;
      const modifierType = obj.modifierType as string;
      if (!sourceName || !targetName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-modifier requires sourceName and targetName`, index });
      if (!VALID_LINK_TYPES.includes(linkType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-modifier invalid linkType`, index });
      if (!VALID_MODIFIER_TYPES.includes(modifierType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: add-modifier invalid modifierType "${modifierType}"`, index });
      return ok({
        kind: "add-modifier" as const, sourceName, targetName,
        linkType: linkType as any, modifierType: modifierType as any,
        negated: obj.negated === true,
      });
    }
    case "remove-modifier": {
      const sourceName = trimStr(obj.sourceName);
      const targetName = trimStr(obj.targetName);
      const linkType = obj.linkType as string;
      const modifierType = obj.modifierType as string;
      if (!sourceName || !targetName)
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-modifier requires sourceName and targetName`, index });
      if (!VALID_LINK_TYPES.includes(linkType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-modifier invalid linkType`, index });
      if (!VALID_MODIFIER_TYPES.includes(modifierType))
        return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: remove-modifier invalid modifierType`, index });
      return ok({
        kind: "remove-modifier" as const, sourceName, targetName,
        linkType: linkType as any, modifierType: modifierType as any,
      });
    }
    default:
      return err({ raw: JSON.stringify(item), message: `Descriptor at index ${index}: unknown kind`, index });
  }
}

export function parse(raw: string): Result<NlEditDescriptor[], ParseError> {
  const jsonStr = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return err({ raw, message: "Failed to extract valid JSON from response" });
  }

  if (!Array.isArray(parsed)) {
    return err({ raw, message: "Expected JSON array of descriptors" });
  }

  const descriptors: NlEditDescriptor[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const result = validateDescriptor(parsed[i], i);
    if (!result.ok) return result;
    descriptors.push(result.value);
  }

  return ok(descriptors);
}
