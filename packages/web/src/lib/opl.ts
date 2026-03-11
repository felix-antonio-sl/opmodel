import type { Model, Link, Thing, State } from "@opmodel/core";

export interface OplBlock {
  category: "thing" | "state" | "link" | "modifier";
  entityId: string;
  text: string;
}

function thingLabel(t: Thing): string {
  const kind = t.kind === "process" ? "process" : "object";
  return `${t.name} is ${a(kind)}, ${t.essence}, ${t.affiliation}.`;
}

function stateLabel(thing: Thing, states: State[]): string {
  if (states.length === 0) return "";
  const names = states.map((s) => s.name);
  if (names.length === 1) return `${thing.name} can be ${names[0]}.`;
  const last = names.pop()!;
  return `${thing.name} can be ${names.join(", ")} or ${last}.`;
}

function linkLabel(link: Link, things: Map<string, Thing>, states: Map<string, State>): string {
  const src = things.get(link.source)?.name ?? link.source;
  const tgt = things.get(link.target)?.name ?? link.target;

  switch (link.type) {
    case "agent":
      return `${src} handles ${tgt}.`;
    case "instrument":
      return `${src} is an instrument of ${tgt}.`;
    case "consumption":
      return `${src} consumes ${tgt}.`;
    case "effect": {
      const fromState = link.source_state ? states.get(link.source_state)?.name : null;
      const toState = link.target_state ? states.get(link.target_state)?.name : null;
      if (fromState && toState) return `${src} affects ${tgt}, from ${fromState} to ${toState}.`;
      return `${src} affects ${tgt}.`;
    }
    case "result":
      return `${src} yields ${tgt}.`;
    case "input":
      return `${src} requires ${tgt}.`;
    case "output":
      return `${src} outputs ${tgt}.`;
    case "aggregation":
      return `${src} consists of ${tgt}.`;
    case "exhibition":
      return `${src} exhibits ${tgt}.`;
    case "generalization":
      return `${tgt} is a ${src}.`;
    case "classification":
      return `${tgt} is classified by ${src}.`;
    case "invocation":
      return `${src} invokes ${tgt}.`;
    case "exception":
      return `${src} handles exception from ${tgt}.`;
    default:
      return `${src} --[${link.type}]--> ${tgt}.`;
  }
}

function a(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

/** Generate OPL sentences for things and links visible in a given OPD */
export function generateOpl(model: Model, opdId: string): OplBlock[] {
  const blocks: OplBlock[] = [];
  const visibleThings = new Set<string>();

  // Collect things with appearances in this OPD
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) visibleThings.add(app.thing);
  }

  // Thing declarations
  for (const thingId of visibleThings) {
    const thing = model.things.get(thingId);
    if (!thing) continue;
    blocks.push({ category: "thing", entityId: thingId, text: thingLabel(thing) });

    // States
    const thingStates = [...model.states.values()].filter((s) => s.parent === thingId);
    if (thingStates.length > 0) {
      blocks.push({
        category: "state",
        entityId: thingId,
        text: stateLabel(thing, thingStates),
      });
    }

    // Duration
    if (thing.duration?.nominal) {
      blocks.push({
        category: "thing",
        entityId: thingId,
        text: `${thing.name} requires ${thing.duration.nominal}${thing.duration.unit}.`,
      });
    }
  }

  // Links where both endpoints are visible
  for (const link of model.links.values()) {
    if (visibleThings.has(link.source) && visibleThings.has(link.target)) {
      blocks.push({
        category: "link",
        entityId: link.id,
        text: linkLabel(link, model.things, model.states),
      });
    }
  }

  // Modifiers on visible links
  for (const mod of model.modifiers.values()) {
    const link = model.links.get(mod.over);
    if (link && visibleThings.has(link.source) && visibleThings.has(link.target)) {
      blocks.push({
        category: "modifier",
        entityId: mod.id,
        text: `${link.type} link from ${model.things.get(link.source)?.name} to ${model.things.get(link.target)?.name} has ${mod.type} modifier.`,
      });
    }
  }

  return blocks;
}
