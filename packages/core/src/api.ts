import type { Model, Thing, State, Link, OPD, Appearance } from "./types";
import type { InvariantError } from "./result";
import { ok, err, type Result } from "./result";
import { collectAllIds } from "./helpers";

export function addThing(
  model: Model,
  thing: Thing,
): Result<Model, InvariantError> {
  // I-08: unique ID globally
  if (collectAllIds(model).has(thing.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${thing.id}`, entity: thing.id });
  }

  return ok({
    ...model,
    things: new Map(model.things).set(thing.id, thing),
  });
}

export function removeThing(
  model: Model,
  thingId: string,
): Result<Model, InvariantError> {
  if (!model.things.has(thingId)) {
    return err({ code: "NOT_FOUND", message: `Thing not found: ${thingId}`, entity: thingId });
  }

  // I-02 cascade: states, links, modifiers over those links, appearances, requirements, fans, assertions, stereotypes
  const states = new Map(model.states);
  const stateIdsToRemove = new Set<string>();
  for (const [id, s] of states) {
    if (s.parent === thingId) {
      stateIdsToRemove.add(id);
      states.delete(id);
    }
  }

  const links = new Map(model.links);
  const linkIdsToRemove = new Set<string>();
  for (const [id, l] of links) {
    if (l.source === thingId || l.target === thingId) {
      linkIdsToRemove.add(id);
      links.delete(id);
    }
  }

  const modifiers = new Map(model.modifiers);
  for (const [id, m] of modifiers) {
    if (linkIdsToRemove.has(m.over)) {
      modifiers.delete(id);
    }
  }

  const appearances = new Map(model.appearances);
  for (const [key, a] of appearances) {
    if (a.thing === thingId) {
      appearances.delete(key);
    }
  }

  const requirements = new Map(model.requirements);
  for (const [id, r] of requirements) {
    if (r.target === thingId || stateIdsToRemove.has(r.target) || linkIdsToRemove.has(r.target)) {
      requirements.delete(id);
    }
  }

  // Cascade: fans that lost members
  const fans = new Map(model.fans);
  for (const [id, fan] of fans) {
    const remaining = fan.members.filter((m) => !linkIdsToRemove.has(m));
    if (remaining.length < 2) {
      fans.delete(id);
    } else if (remaining.length < fan.members.length) {
      fans.set(id, { ...fan, members: remaining });
    }
  }

  // Cascade: assertions targeting this thing
  const assertions = new Map(model.assertions);
  for (const [id, a] of assertions) {
    if (a.target === thingId) assertions.delete(id);
  }

  // Cascade: stereotypes targeting this thing
  const stereotypes = new Map(model.stereotypes);
  for (const [id, s] of stereotypes) {
    if (s.thing === thingId) stereotypes.delete(id);
  }

  const things = new Map(model.things);
  things.delete(thingId);

  return ok({ ...model, things, states, links, modifiers, appearances, requirements, fans, assertions, stereotypes });
}

export function addState(
  model: Model,
  state: State,
): Result<Model, InvariantError> {
  // I-08: unique ID
  if (collectAllIds(model).has(state.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${state.id}`, entity: state.id });
  }
  // I-01: parent must be object
  const parent = model.things.get(state.parent);
  if (!parent) {
    return err({ code: "I-01", message: `Parent thing not found: ${state.parent}`, entity: state.id });
  }
  if (parent.kind !== "object") {
    return err({ code: "I-01", message: `State parent must be object, got process: ${state.parent}`, entity: state.id });
  }
  return ok({
    ...model,
    states: new Map(model.states).set(state.id, state),
  });
}

export function removeState(
  model: Model,
  stateId: string,
): Result<Model, InvariantError> {
  if (!model.states.has(stateId)) {
    return err({ code: "NOT_FOUND", message: `State not found: ${stateId}`, entity: stateId });
  }
  const states = new Map(model.states);
  states.delete(stateId);
  return ok({ ...model, states });
}

// ── Links ──────────────────────────────────────────────────────────────

export function addLink(
  model: Model,
  link: Link,
): Result<Model, InvariantError> {
  // I-08: unique ID
  if (collectAllIds(model).has(link.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${link.id}`, entity: link.id });
  }
  // I-05: source and target must exist (as things)
  if (!model.things.has(link.source)) {
    return err({ code: "I-05", message: `Source thing not found: ${link.source}`, entity: link.id });
  }
  if (!model.things.has(link.target)) {
    return err({ code: "I-05", message: `Target thing not found: ${link.target}`, entity: link.id });
  }
  // I-18: agent source must be physical
  if (link.type === "agent") {
    const source = model.things.get(link.source)!;
    if (source.essence !== "physical") {
      return err({ code: "I-18", message: `Agent source must be physical: ${link.source}`, entity: link.id });
    }
  }
  // I-14: exception link requires source process to have duration.max
  if (link.type === "exception") {
    const source = model.things.get(link.source)!;
    if (!source.duration?.max) {
      return err({ code: "I-14", message: `Exception source must have duration.max: ${link.source}`, entity: link.id });
    }
  }

  let things = model.things;
  // I-19 effect: exhibition forces source.essence := informatical
  if (link.type === "exhibition") {
    const source = things.get(link.source)!;
    if (source.essence !== "informatical") {
      things = new Map(things).set(source.id, { ...source, essence: "informatical" });
    }
  }

  return ok({
    ...model,
    things,
    links: new Map(model.links).set(link.id, link),
  });
}

export function removeLink(
  model: Model,
  linkId: string,
): Result<Model, InvariantError> {
  if (!model.links.has(linkId)) {
    return err({ code: "NOT_FOUND", message: `Link not found: ${linkId}`, entity: linkId });
  }
  const links = new Map(model.links);
  links.delete(linkId);
  // Cascade: remove modifiers over this link
  const modifiers = new Map(model.modifiers);
  for (const [id, m] of modifiers) {
    if (m.over === linkId) modifiers.delete(id);
  }
  // Cascade: remove fans that lost this member
  const fans = new Map(model.fans);
  for (const [id, fan] of fans) {
    if (fan.members.includes(linkId)) {
      const remaining = fan.members.filter((m) => m !== linkId);
      if (remaining.length < 2) {
        fans.delete(id);
      } else {
        fans.set(id, { ...fan, members: remaining });
      }
    }
  }
  return ok({ ...model, links, modifiers, fans });
}

// ── OPDs ───────────────────────────────────────────────────────────────

export function addOPD(
  model: Model,
  opd: OPD,
): Result<Model, InvariantError> {
  if (collectAllIds(model).has(opd.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${opd.id}`, entity: opd.id });
  }
  // I-03: hierarchical OPD parent must exist
  if (opd.opd_type === "hierarchical" && opd.parent_opd !== null) {
    if (!model.opds.has(opd.parent_opd)) {
      return err({ code: "I-03", message: `Parent OPD not found: ${opd.parent_opd}`, entity: opd.id });
    }
  }
  return ok({ ...model, opds: new Map(model.opds).set(opd.id, opd) });
}

export function removeOPD(
  model: Model,
  opdId: string,
): Result<Model, InvariantError> {
  if (!model.opds.has(opdId)) {
    return err({ code: "NOT_FOUND", message: `OPD not found: ${opdId}`, entity: opdId });
  }
  // Collect this OPD and all descendant OPDs recursively
  const opdsToRemove = new Set<string>();
  const collectDescendants = (parentId: string) => {
    opdsToRemove.add(parentId);
    for (const [id, opd] of model.opds) {
      if (opd.parent_opd === parentId && !opdsToRemove.has(id)) {
        collectDescendants(id);
      }
    }
  };
  collectDescendants(opdId);

  const opds = new Map(model.opds);
  for (const id of opdsToRemove) opds.delete(id);

  // Cascade: remove appearances in any removed OPD
  const appearances = new Map(model.appearances);
  for (const [key, a] of appearances) {
    if (opdsToRemove.has(a.opd)) appearances.delete(key);
  }
  return ok({ ...model, opds, appearances });
}

// ── Appearances ────────────────────────────────────────────────────────

export function addAppearance(
  model: Model,
  appearance: Appearance,
): Result<Model, InvariantError> {
  const key = `${appearance.thing}::${appearance.opd}`;
  // I-04: unique per (thing, opd)
  if (model.appearances.has(key)) {
    return err({ code: "I-04", message: `Appearance already exists: ${key}`, entity: key });
  }
  // I-15: internal only in refinement OPDs
  if (appearance.internal) {
    const opd = model.opds.get(appearance.opd);
    if (!opd || !opd.refines) {
      return err({ code: "I-15", message: `internal=true only allowed in refinement OPDs`, entity: key });
    }
  }
  return ok({ ...model, appearances: new Map(model.appearances).set(key, appearance) });
}

export function removeAppearance(
  model: Model,
  thing: string,
  opd: string,
): Result<Model, InvariantError> {
  const key = `${thing}::${opd}`;
  if (!model.appearances.has(key)) {
    return err({ code: "NOT_FOUND", message: `Appearance not found: ${key}`, entity: key });
  }
  const appearances = new Map(model.appearances);
  appearances.delete(key);
  return ok({ ...model, appearances });
}
