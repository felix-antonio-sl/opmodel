import type {
  Model, Thing, State, Link, OPD, Appearance,
  Modifier, Fan, Assertion, Requirement, Stereotype,
  SubModel, Scenario,
} from "./types";
import type { InvariantError } from "./result";
import { ok, err, type Result } from "./result";
import { collectAllIds, touch } from "./helpers";

export function addThing(
  model: Model,
  thing: Thing,
): Result<Model, InvariantError> {
  // I-08: unique ID globally
  if (collectAllIds(model).has(thing.id)) {
    return err({ code: "I-08", message: `Duplicate id: ${thing.id}`, entity: thing.id });
  }

  return ok(touch({
    ...model,
    things: new Map(model.things).set(thing.id, thing),
  }));
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

  return ok(touch({ ...model, things, states, links, modifiers, appearances, requirements, fans, assertions, stereotypes }));
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
  return ok(touch({
    ...model,
    states: new Map(model.states).set(state.id, state),
  }));
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
  return ok(touch({ ...model, states }));
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

  return ok(touch({
    ...model,
    things,
    links: new Map(model.links).set(link.id, link),
  }));
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
  return ok(touch({ ...model, links, modifiers, fans }));
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
  // I-03: view OPDs must have parent_opd = null
  if (opd.opd_type === "view" && opd.parent_opd !== null) {
    return err({ code: "I-03", message: `View OPD must have parent_opd=null`, entity: opd.id });
  }
  return ok(touch({ ...model, opds: new Map(model.opds).set(opd.id, opd) }));
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
  return ok(touch({ ...model, opds, appearances }));
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
  return ok(touch({ ...model, appearances: new Map(model.appearances).set(key, appearance) }));
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
  return ok(touch({ ...model, appearances }));
}

// ── Modifiers ──────────────────────────────────────────────────────────

export function addModifier(model: Model, mod: Modifier): Result<Model, InvariantError> {
  if (collectAllIds(model).has(mod.id)) return err({ code: "I-08", message: `Duplicate id: ${mod.id}`, entity: mod.id });
  if (!model.links.has(mod.over)) return err({ code: "I-06", message: `Link not found: ${mod.over}`, entity: mod.id });
  return ok(touch({ ...model, modifiers: new Map(model.modifiers).set(mod.id, mod) }));
}

export function removeModifier(model: Model, modId: string): Result<Model, InvariantError> {
  if (!model.modifiers.has(modId)) return err({ code: "NOT_FOUND", message: `Modifier not found: ${modId}`, entity: modId });
  const modifiers = new Map(model.modifiers);
  modifiers.delete(modId);
  return ok(touch({ ...model, modifiers }));
}

// ── Fans ───────────────────────────────────────────────────────────────

export function addFan(model: Model, fan: Fan): Result<Model, InvariantError> {
  if (collectAllIds(model).has(fan.id)) return err({ code: "I-08", message: `Duplicate id: ${fan.id}`, entity: fan.id });
  if (fan.members.length < 2) return err({ code: "I-07", message: `Fan must have at least 2 members, got ${fan.members.length}`, entity: fan.id });
  for (const memberId of fan.members) {
    if (!model.links.has(memberId)) return err({ code: "I-07", message: `Fan member link not found: ${memberId}`, entity: fan.id });
  }
  return ok(touch({ ...model, fans: new Map(model.fans).set(fan.id, fan) }));
}

export function removeFan(model: Model, fanId: string): Result<Model, InvariantError> {
  if (!model.fans.has(fanId)) return err({ code: "NOT_FOUND", message: `Fan not found: ${fanId}`, entity: fanId });
  const fans = new Map(model.fans);
  fans.delete(fanId);
  return ok(touch({ ...model, fans }));
}

// ── Assertions ─────────────────────────────────────────────────────────

export function addAssertion(model: Model, assertion: Assertion): Result<Model, InvariantError> {
  if (collectAllIds(model).has(assertion.id)) return err({ code: "I-08", message: `Duplicate id: ${assertion.id}`, entity: assertion.id });
  if (assertion.target != null && !model.things.has(assertion.target) && !model.links.has(assertion.target)) {
    return err({ code: "I-09", message: `Assertion target not found: ${assertion.target}`, entity: assertion.id });
  }
  return ok(touch({ ...model, assertions: new Map(model.assertions).set(assertion.id, assertion) }));
}

export function removeAssertion(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.assertions.has(id)) return err({ code: "NOT_FOUND", message: `Assertion not found: ${id}`, entity: id });
  const assertions = new Map(model.assertions);
  assertions.delete(id);
  return ok(touch({ ...model, assertions }));
}

// ── Requirements ───────────────────────────────────────────────────────

export function addRequirement(model: Model, req: Requirement): Result<Model, InvariantError> {
  if (collectAllIds(model).has(req.id)) return err({ code: "I-08", message: `Duplicate id: ${req.id}`, entity: req.id });
  if (!model.things.has(req.target) && !model.states.has(req.target) && !model.links.has(req.target)) {
    return err({ code: "I-10", message: `Requirement target not found: ${req.target}`, entity: req.id });
  }
  return ok(touch({ ...model, requirements: new Map(model.requirements).set(req.id, req) }));
}

export function removeRequirement(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.requirements.has(id)) return err({ code: "NOT_FOUND", message: `Requirement not found: ${id}`, entity: id });
  const requirements = new Map(model.requirements);
  requirements.delete(id);
  return ok(touch({ ...model, requirements }));
}

// ── Stereotypes ────────────────────────────────────────────────────────

export function addStereotype(model: Model, stp: Stereotype): Result<Model, InvariantError> {
  if (collectAllIds(model).has(stp.id)) return err({ code: "I-08", message: `Duplicate id: ${stp.id}`, entity: stp.id });
  if (!model.things.has(stp.thing)) return err({ code: "I-11", message: `Stereotype target thing not found: ${stp.thing}`, entity: stp.id });
  return ok(touch({ ...model, stereotypes: new Map(model.stereotypes).set(stp.id, stp) }));
}

export function removeStereotype(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.stereotypes.has(id)) return err({ code: "NOT_FOUND", message: `Stereotype not found: ${id}`, entity: id });
  const stereotypes = new Map(model.stereotypes);
  stereotypes.delete(id);
  return ok(touch({ ...model, stereotypes }));
}

// ── SubModels ──────────────────────────────────────────────────────────

export function addSubModel(model: Model, sub: SubModel): Result<Model, InvariantError> {
  if (collectAllIds(model).has(sub.id)) return err({ code: "I-08", message: `Duplicate id: ${sub.id}`, entity: sub.id });
  for (const thingId of sub.shared_things) {
    if (!model.things.has(thingId)) return err({ code: "I-12", message: `Shared thing not found: ${thingId}`, entity: sub.id });
  }
  return ok(touch({ ...model, subModels: new Map(model.subModels).set(sub.id, sub) }));
}

export function removeSubModel(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.subModels.has(id)) return err({ code: "NOT_FOUND", message: `SubModel not found: ${id}`, entity: id });
  const subModels = new Map(model.subModels);
  subModels.delete(id);
  return ok(touch({ ...model, subModels }));
}

// ── Scenarios ──────────────────────────────────────────────────────────

export function addScenario(model: Model, scn: Scenario): Result<Model, InvariantError> {
  if (collectAllIds(model).has(scn.id)) return err({ code: "I-08", message: `Duplicate id: ${scn.id}`, entity: scn.id });
  const allPathLabels = new Set([...model.links.values()].map((l) => l.path_label).filter(Boolean) as string[]);
  for (const pl of scn.path_labels) {
    if (!allPathLabels.has(pl)) return err({ code: "I-13", message: `Path label not found in any link: ${pl}`, entity: scn.id });
  }
  return ok(touch({ ...model, scenarios: new Map(model.scenarios).set(scn.id, scn) }));
}

export function removeScenario(model: Model, id: string): Result<Model, InvariantError> {
  if (!model.scenarios.has(id)) return err({ code: "NOT_FOUND", message: `Scenario not found: ${id}`, entity: id });
  const scenarios = new Map(model.scenarios);
  scenarios.delete(id);
  return ok(touch({ ...model, scenarios }));
}

// ── Batch Validate ─────────────────────────────────────────────────────

export function validate(model: Model): InvariantError[] {
  const errors: InvariantError[] = [];

  // I-01
  for (const [id, state] of model.states) {
    const parent = model.things.get(state.parent);
    if (!parent) errors.push({ code: "I-01", message: `State ${id} parent not found: ${state.parent}`, entity: id });
    else if (parent.kind !== "object") errors.push({ code: "I-01", message: `State ${id} parent must be object: ${state.parent}`, entity: id });
  }

  // I-03
  for (const [id, opd] of model.opds) {
    if (opd.opd_type === "hierarchical" && opd.parent_opd !== null) {
      if (!model.opds.has(opd.parent_opd)) errors.push({ code: "I-03", message: `OPD ${id} parent not found: ${opd.parent_opd}`, entity: id });
    }
    if (opd.opd_type === "view" && opd.parent_opd !== null) errors.push({ code: "I-03", message: `View OPD ${id} must have parent_opd=null`, entity: id });
  }

  // I-04: appearance (thing, opd) uniqueness — structurally enforced by Map key,
  // but verify no duplicate thing+opd pairs exist in values
  const seenAppearances = new Set<string>();
  for (const app of model.appearances.values()) {
    const key = `${app.thing}::${app.opd}`;
    if (seenAppearances.has(key)) errors.push({ code: "I-04", message: `Duplicate appearance: ${key}`, entity: key });
    seenAppearances.add(key);
  }

  // I-05
  for (const [id, link] of model.links) {
    if (!model.things.has(link.source)) errors.push({ code: "I-05", message: `Link ${id} source not found: ${link.source}`, entity: id });
    if (!model.things.has(link.target)) errors.push({ code: "I-05", message: `Link ${id} target not found: ${link.target}`, entity: id });
  }

  // I-06
  for (const [id, mod] of model.modifiers) {
    if (!model.links.has(mod.over)) errors.push({ code: "I-06", message: `Modifier ${id} link not found: ${mod.over}`, entity: id });
  }

  // I-07
  for (const [id, fan] of model.fans) {
    if (fan.members.length < 2) errors.push({ code: "I-07", message: `Fan ${id} must have >= 2 members`, entity: id });
    for (const memberId of fan.members) {
      if (!model.links.has(memberId)) errors.push({ code: "I-07", message: `Fan ${id} member not found: ${memberId}`, entity: id });
    }
  }

  // I-08
  const seen = new Map<string, string>();
  const checkId = (id: string, collection: string) => {
    if (seen.has(id)) errors.push({ code: "I-08", message: `Duplicate id ${id} in ${collection} and ${seen.get(id)}`, entity: id });
    seen.set(id, collection);
  };
  for (const id of model.things.keys()) checkId(id, "things");
  for (const id of model.states.keys()) checkId(id, "states");
  for (const id of model.opds.keys()) checkId(id, "opds");
  for (const id of model.links.keys()) checkId(id, "links");
  for (const id of model.modifiers.keys()) checkId(id, "modifiers");
  for (const id of model.fans.keys()) checkId(id, "fans");
  for (const id of model.scenarios.keys()) checkId(id, "scenarios");
  for (const id of model.assertions.keys()) checkId(id, "assertions");
  for (const id of model.requirements.keys()) checkId(id, "requirements");
  for (const id of model.stereotypes.keys()) checkId(id, "stereotypes");
  for (const id of model.subModels.keys()) checkId(id, "subModels");

  // I-09
  for (const [id, a] of model.assertions) {
    if (a.target != null && !model.things.has(a.target) && !model.links.has(a.target))
      errors.push({ code: "I-09", message: `Assertion ${id} target not found: ${a.target}`, entity: id });
  }

  // I-10
  for (const [id, req] of model.requirements) {
    if (!model.things.has(req.target) && !model.states.has(req.target) && !model.links.has(req.target))
      errors.push({ code: "I-10", message: `Requirement ${id} target not found: ${req.target}`, entity: id });
  }

  // I-11
  for (const [id, stp] of model.stereotypes) {
    if (!model.things.has(stp.thing)) errors.push({ code: "I-11", message: `Stereotype ${id} thing not found: ${stp.thing}`, entity: id });
  }

  // I-12
  for (const [id, sub] of model.subModels) {
    for (const thingId of sub.shared_things) {
      if (!model.things.has(thingId)) errors.push({ code: "I-12", message: `SubModel ${id} shared thing not found: ${thingId}`, entity: id });
    }
  }

  // I-13
  const allPathLabels = new Set([...model.links.values()].map((l) => l.path_label).filter(Boolean) as string[]);
  for (const [id, scn] of model.scenarios) {
    for (const pl of scn.path_labels) {
      if (!allPathLabels.has(pl)) errors.push({ code: "I-13", message: `Scenario ${id} path label not found: ${pl}`, entity: id });
    }
  }

  // I-14
  for (const [id, link] of model.links) {
    if (link.type === "exception") {
      const source = model.things.get(link.source);
      if (source && !source.duration?.max) errors.push({ code: "I-14", message: `Exception link ${id} source must have duration.max`, entity: id });
    }
  }

  // I-15
  for (const [key, app] of model.appearances) {
    if (app.internal) {
      const opd = model.opds.get(app.opd);
      if (!opd || !opd.refines) errors.push({ code: "I-15", message: `Appearance ${key} internal=true in non-refinement OPD`, entity: key });
    }
  }

  // I-18
  for (const [id, link] of model.links) {
    if (link.type === "agent") {
      const source = model.things.get(link.source);
      if (source && source.essence !== "physical") errors.push({ code: "I-18", message: `Agent link ${id} source must be physical`, entity: id });
    }
  }

  // I-19
  for (const [id, link] of model.links) {
    if (link.type === "exhibition") {
      const source = model.things.get(link.source);
      if (source && source.essence !== "informatical") errors.push({ code: "I-19", message: `Exhibition link ${id} source must be informatical`, entity: id });
    }
  }

  return errors;
}
