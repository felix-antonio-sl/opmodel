import type { Model, SystemType } from "./types";

const SCHEMA_VERSION = "1.1.0";

export function createModel(name: string, systemType?: SystemType): Model {
  const now = new Date().toISOString();
  const sdOPD = {
    id: "opd-sd",
    name: "SD",
    opd_type: "hierarchical" as const,
    parent_opd: null,
  };

  return {
    opmodel: SCHEMA_VERSION,
    meta: {
      name,
      system_type: systemType,
      created: now,
      modified: now,
    },
    settings: {},
    things: new Map(),
    states: new Map(),
    opds: new Map([["opd-sd", sdOPD]]),
    links: new Map(),
    modifiers: new Map(),
    appearances: new Map(),
    fans: new Map(),
    scenarios: new Map(),
    assertions: new Map(),
    requirements: new Map(),
    stereotypes: new Map(),
    subModels: new Map(),
  };
}
