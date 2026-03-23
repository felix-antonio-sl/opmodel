import type {
  Model,
  Appearance,
  Thing,
  State,
  OPD,
  Link,
  Modifier,
  Fan,
  Scenario,
  Assertion,
  Requirement,
  Stereotype,
  SubModel,
} from "./types";
import type { InvariantError } from "./result";
import { ok, err, type Result } from "./result";

// Only skip undefined. Preserve null (required for parent_opd: null).
function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const val = obj[key];
    if (val === undefined) continue;
    if (val === null) {
      sorted[key] = null;
    } else if (Array.isArray(val)) {
      sorted[key] = val.map((item) =>
        typeof item === "object" && item !== null && !Array.isArray(item)
          ? sortKeys(item as Record<string, unknown>)
          : item
      );
    } else if (typeof val === "object") {
      sorted[key] = sortKeys(val as Record<string, unknown>);
    } else {
      sorted[key] = val;
    }
  }
  return sorted;
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function sortAppearances(items: Appearance[]): Appearance[] {
  return [...items].sort((a, b) => {
    const cmp = a.thing.localeCompare(b.thing);
    return cmp !== 0 ? cmp : a.opd.localeCompare(b.opd);
  });
}

export function saveModel(model: Model): string {
  const raw: Record<string, unknown> = {
    opmodel: model.opmodel,
    meta: model.meta,
    settings: model.settings,
    things: sortById([...model.things.values()]),
    states: sortById([...model.states.values()]),
    opds: sortById([...model.opds.values()]),
    links: sortById([...model.links.values()]),
    modifiers: sortById([...model.modifiers.values()]),
    appearances: sortAppearances([...model.appearances.values()].map(
      ({ suppressed_states: _, ...app }) => app // DA-9: strip deprecated field on save
    )),
    fans: sortById([...model.fans.values()]),
    scenarios: sortById([...model.scenarios.values()]),
    assertions: sortById([...model.assertions.values()]),
    requirements: sortById([...model.requirements.values()]),
    stereotypes: sortById([...model.stereotypes.values()]),
    sub_models: sortById([...model.subModels.values()]),
  };

  const sorted = sortKeys(raw);

  // Custom format per §7.2:
  // - Array items: one JSON object per line (compact), indented 4 spaces
  // - Non-array objects (meta, settings): pretty-printed with indentation
  const sections = Object.entries(sorted).map(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `  "${key}": []`;
      }
      const items = value.map((item) => `    ${JSON.stringify(item)}`).join(",\n");
      return `  "${key}": [\n${items}\n  ]`;
    }
    if (typeof value === "object" && value !== null) {
      const inner = JSON.stringify(value, null, 4)
        .split("\n")
        .map((line, i) => (i === 0 ? line : `  ${line}`))
        .join("\n");
      return `  "${key}": ${inner}`;
    }
    return `  "${key}": ${JSON.stringify(value)}`;
  });

  return `{\n${sections.join(",\n")}\n}\n`;
}

// === loadModel ===

export interface LoadError {
  phase: "parse" | "structure" | "invariant";
  message: string;
  details?: InvariantError[];
}

const REQUIRED_SECTIONS = [
  "opmodel",
  "meta",
  "settings",
  "things",
  "states",
  "opds",
  "links",
  "modifiers",
  "appearances",
  "fans",
  "scenarios",
  "assertions",
  "requirements",
  "stereotypes",
  "sub_models",
] as const;

export function loadModel(json: string): Result<Model, LoadError> {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return err({ phase: "parse", message: "Invalid JSON" });
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return err({ phase: "structure", message: "Root must be an object" });
  }

  for (const key of REQUIRED_SECTIONS) {
    if (!(key in raw)) {
      return err({ phase: "structure", message: `Missing required section: ${key}` });
    }
  }

  const opmodelVersion = (raw as Record<string, unknown>).opmodel;
  if (
    typeof opmodelVersion !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(opmodelVersion)
  ) {
    return err({ phase: "structure", message: "Invalid opmodel version (must be semver)" });
  }

  const ARRAY_SECTIONS = [
    "things",
    "states",
    "opds",
    "links",
    "modifiers",
    "appearances",
    "fans",
    "scenarios",
    "assertions",
    "requirements",
    "stereotypes",
    "sub_models",
  ];
  for (const key of ARRAY_SECTIONS) {
    if (!Array.isArray((raw as Record<string, unknown>)[key])) {
      return err({ phase: "structure", message: `Section "${key}" must be an array` });
    }
  }

  const r = raw as Record<string, unknown>;

  const model: Model = {
    opmodel: r.opmodel as string,
    meta: r.meta as Model["meta"],
    settings: r.settings as Model["settings"],
    things: arrayToMap(r.things as Thing[]),
    states: arrayToMap(r.states as State[]),
    opds: arrayToMap(r.opds as OPD[]),
    links: arrayToMap(r.links as Link[]),
    modifiers: arrayToMap(r.modifiers as Modifier[]),
    appearances: appearancesToMap(r.appearances as Appearance[]),
    fans: arrayToMap(r.fans as Fan[]),
    scenarios: arrayToMap(r.scenarios as Scenario[]),
    assertions: arrayToMap(r.assertions as Assertion[]),
    requirements: arrayToMap(r.requirements as Requirement[]),
    stereotypes: arrayToMap(r.stereotypes as Stereotype[]),
    subModels: arrayToMap(r.sub_models as SubModel[]),
  };

  return ok(model);
}

function arrayToMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function appearancesToMap(items: Appearance[]): Map<string, Appearance> {
  return new Map(items.map((a) => [`${a.thing}::${a.opd}`, a]));
}
