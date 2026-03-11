// packages/cli/src/format.ts
import { isOk, type Result, type InvariantError } from "@opmodel/core";
import type { Thing, State, Link, OPD } from "@opmodel/core";

export class CliError extends Error {
  constructor(message: string, public exitCode: 1 | 2) {
    super(message);
    this.name = "CliError";
  }
}

export function handleResult<T>(
  result: Result<T, InvariantError>,
  opts: { json: boolean },
): T {
  if (isOk(result)) return result.value;
  const { code, message, entity } = result.error;
  if (opts.json) {
    throw new CliError(JSON.stringify(result.error), 1);
  }
  throw new CliError(`${code}: ${message}${entity ? ` (${entity})` : ""}`, 1);
}

export function fatal(message: string): never {
  throw new CliError(message, 2);
}

export function formatErrors(
  errors: InvariantError[],
  opts: { json: boolean },
): string {
  if (opts.json) return JSON.stringify(errors, null, 2);
  const lines = [`${errors.length} errors found:`];
  for (const e of errors) {
    lines.push(`  ${e.code}  ${e.message}${e.entity ? ` (${e.entity})` : ""}`);
  }
  return lines.join("\n");
}

export function formatOutput(
  data: unknown,
  opts: { json: boolean },
): string {
  if (opts.json) return JSON.stringify(data, null, 2);
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (obj.action && obj.type && obj.id) {
      const name = (obj.entity as Record<string, unknown>)?.name ?? "";
      return `${capitalize(String(obj.action))} ${obj.type} ${obj.id}${name ? ` (${name})` : ""}`;
    }
    return Object.entries(obj)
      .map(([k, v]) => `  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join("\n");
  }
  return String(data);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Entity formatters (show) ---

export function formatThing(thing: Thing, opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(thing, null, 2);
  const lines = [`Thing: ${thing.id}`];
  lines.push(`  name:        ${thing.name}`);
  lines.push(`  kind:        ${thing.kind}`);
  lines.push(`  essence:     ${thing.essence}`);
  lines.push(`  affiliation: ${thing.affiliation}`);
  if (thing.perseverance) lines.push(`  perseverance: ${thing.perseverance}`);
  if (thing.duration) lines.push(`  duration:    ${thing.duration.nominal}${thing.duration.unit}`);
  if (thing.notes) lines.push(`  notes:       ${thing.notes}`);
  return lines.join("\n");
}

export function formatState(state: State, opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(state, null, 2);
  const flags = [
    state.initial ? "initial" : "",
    state.final ? "final" : "",
    state.default ? "default" : "",
    state.current ? "current" : "",
  ].filter(Boolean).join(", ");
  const lines = [`State: ${state.id}`];
  lines.push(`  name:   ${state.name}`);
  lines.push(`  parent: ${state.parent}`);
  if (flags) lines.push(`  flags:  ${flags}`);
  return lines.join("\n");
}

export function formatLink(link: Link, opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(link, null, 2);
  const lines = [`Link: ${link.id}`];
  lines.push(`  type:   ${link.type}`);
  lines.push(`  source: ${link.source}`);
  lines.push(`  target: ${link.target}`);
  if (link.source_state) lines.push(`  source_state: ${link.source_state}`);
  if (link.target_state) lines.push(`  target_state: ${link.target_state}`);
  return lines.join("\n");
}

export function formatOPD(opd: OPD, opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(opd, null, 2);
  const lines = [`OPD: ${opd.id}`];
  lines.push(`  name:       ${opd.name}`);
  lines.push(`  type:       ${opd.opd_type}`);
  lines.push(`  parent_opd: ${opd.parent_opd ?? "(root)"}`);
  if (opd.refines) lines.push(`  refines:    ${opd.refines} (${opd.refinement_type})`);
  return lines.join("\n");
}

// --- List formatters ---

export function formatThingList(things: Thing[], opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(things, null, 2);
  if (things.length === 0) return "No things found.";
  const header = "ID                          Kind      Name                 Essence";
  const sep = "-".repeat(header.length);
  const rows = things.map(t =>
    `${t.id.padEnd(28)}${t.kind.padEnd(10)}${t.name.padEnd(21)}${t.essence}`
  );
  return [header, sep, ...rows].join("\n");
}

export function formatStateList(states: State[], opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(states, null, 2);
  if (states.length === 0) return "No states found.";
  const header = "ID                          Parent               Name         Flags";
  const sep = "-".repeat(header.length);
  const rows = states.map(s => {
    const flags = [s.initial ? "I" : "", s.final ? "F" : "", s.default ? "D" : ""].filter(Boolean).join(",");
    return `${s.id.padEnd(28)}${s.parent.padEnd(21)}${s.name.padEnd(13)}${flags}`;
  });
  return [header, sep, ...rows].join("\n");
}

export function formatLinkList(links: Link[], opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(links, null, 2);
  if (links.length === 0) return "No links found.";
  const header = "ID                               Type          Source               Target";
  const sep = "-".repeat(header.length);
  const rows = links.map(l =>
    `${l.id.padEnd(33)}${l.type.padEnd(14)}${l.source.padEnd(21)}${l.target}`
  );
  return [header, sep, ...rows].join("\n");
}

export function formatOPDList(opds: OPD[], opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(opds, null, 2);
  if (opds.length === 0) return "No OPDs found.";
  const header = "ID                          Type            Parent";
  const sep = "-".repeat(header.length);
  const rows = opds.map(o =>
    `${o.id.padEnd(28)}${o.opd_type.padEnd(16)}${o.parent_opd ?? "(root)"}`
  );
  return [header, sep, ...rows].join("\n");
}

export function formatOPDTree(opds: OPD[], opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(opds, null, 2);
  if (opds.length === 0) return "No OPDs found.";

  // Build tree structure
  const roots = opds.filter(o => o.parent_opd === null);
  const children = new Map<string, OPD[]>();
  for (const opd of opds) {
    if (opd.parent_opd !== null) {
      const list = children.get(opd.parent_opd) ?? [];
      list.push(opd);
      children.set(opd.parent_opd, list);
    }
  }

  const lines: string[] = [];
  function walk(opd: OPD, indent: number) {
    const prefix = "  ".repeat(indent);
    const refine = opd.refines ? ` [${opd.refinement_type}: ${opd.refines}]` : "";
    lines.push(`${prefix}${opd.id} (${opd.name})${refine}`);
    for (const child of children.get(opd.id) ?? []) {
      walk(child, indent + 1);
    }
  }
  for (const root of roots) walk(root, 0);
  return lines.join("\n");
}
