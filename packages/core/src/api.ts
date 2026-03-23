import type {
  Model, Thing, State, Link, OPD, Appearance, Kind,
  Modifier, Fan, Assertion, Requirement, Stereotype,
  SubModel, Scenario, Meta, Settings, RefinementType,
} from "./types";
import type { InvariantError } from "./result";
import { ok, err, type Result } from "./result";
import { collectAllIds, touch, cleanPatch, appearanceKey } from "./helpers";
import type { ResolvedLink } from "./simulation";

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

  // Cascade: remove OPDs that refine this thing (DANGLING_REFINES prevention)
  let opds = new Map(model.opds);
  const opdsToRemove = new Set<string>();
  for (const [id, opd] of opds) {
    if (opd.refines === thingId) {
      const collectDescendants = (parentId: string) => {
        opdsToRemove.add(parentId);
        for (const [cid, copd] of opds) {
          if (copd.parent_opd === parentId && !opdsToRemove.has(cid)) {
            collectDescendants(cid);
          }
        }
      };
      collectDescendants(id);
    }
  }
  for (const id of opdsToRemove) opds.delete(id);
  // Also remove appearances in cascaded OPDs
  for (const [key, a] of appearances) {
    if (opdsToRemove.has(a.opd)) appearances.delete(key);
  }

  const things = new Map(model.things);
  things.delete(thingId);

  return ok(touch({ ...model, things, states, links, modifiers, appearances, requirements, fans, assertions, stereotypes, opds }));
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
  // I-STATELESS-STATES: stateless objects cannot have states (ISO §3.67)
  if (parent.stateful === false) {
    return err({ code: "I-STATELESS-STATES", message: "Stateless objects cannot have states (ISO §3.67)", entity: state.id });
  }
  // I-21: exclusive current state — auto-unset siblings (radio button coercion)
  const states = new Map(model.states).set(state.id, state);
  if (state.current) {
    for (const [sid, s] of states) {
      if (sid !== state.id && s.parent === state.parent && s.current) {
        states.set(sid, { ...s, current: false });
      }
    }
  }

  return ok(touch({ ...model, states }));
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

  // P-02: cascade — clear dangling source_state/target_state references on links
  const links = new Map(model.links);
  for (const [id, l] of links) {
    let updated = l;
    let changed = false;
    if (l.source_state === stateId) {
      updated = { ...updated, source_state: undefined };
      changed = true;
    }
    if (l.target_state === stateId) {
      updated = { ...updated, target_state: undefined };
      changed = true;
    }
    if (changed) links.set(id, updated);
  }

  return ok(touch({ ...model, states, links }));
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

  // I-34: No self-loops except invocation (ISO §8.5)
  if (link.source === link.target && link.type !== "invocation") {
    return err({ code: "I-34", message: `Self-loop not allowed for ${link.type} links`, entity: link.id });
  }

  const source = model.things.get(link.source)!;
  const target = model.things.get(link.target)!;

  // I-33: Procedural links must connect object↔process (ISO §6.1-§6.3)
  const PROCEDURAL_TYPES = new Set([
    "consumption", "result", "effect", "input", "output", "agent", "instrument",
  ]);
  if (PROCEDURAL_TYPES.has(link.type) && source.kind === target.kind) {
    return err({ code: "I-33", message: `${link.type} link must connect object↔process, not ${source.kind}↔${source.kind}`, entity: link.id });
  }
  // I-33b: Consumption must go object→process (ISO §6.1)
  if (link.type === "consumption" && source.kind !== "object") {
    return err({ code: "I-33", message: `consumption link source must be object (ISO §6.1)`, entity: link.id });
  }

  // I-16-EXT: Enabling link uniqueness — max 1 enabling link per (object, process) pair (ISO §8.1.2)
  if (link.type === "agent" || link.type === "instrument") {
    for (const existing of model.links.values()) {
      if ((existing.type === "agent" || existing.type === "instrument") &&
          existing.source === link.source && existing.target === link.target) {
        return err({ code: "I-16", message: `Multiple enabling links between ${link.source} and ${link.target}`, entity: link.id });
      }
    }
  }

  // I-22: Generalization requires same perseverance
  if (link.type === "generalization" && source.kind !== target.kind) {
    return err({ code: "I-22", message: `Generalization: source and target must have same kind`, entity: link.id });
  }
  // I-23: Classification requires same perseverance
  if (link.type === "classification" && source.kind !== target.kind) {
    return err({ code: "I-23", message: `Classification: source and target must have same kind`, entity: link.id });
  }
  // I-24: Invocation requires both processes
  if (link.type === "invocation" && (source.kind !== "process" || target.kind !== "process")) {
    return err({ code: "I-24", message: `Invocation link must connect processes only`, entity: link.id });
  }
  // I-25: Exception requires both processes
  if (link.type === "exception" && (source.kind !== "process" || target.kind !== "process")) {
    return err({ code: "I-25", message: `Exception link must connect processes only`, entity: link.id });
  }
  // I-26: Aggregation requires same perseverance
  if (link.type === "aggregation" && source.kind !== target.kind) {
    return err({ code: "I-26", message: `Aggregation: source and target must have same kind`, entity: link.id });
  }

  // I-28: State-specified link validation — states must exist and belong to correct parent
  if (link.source_state) {
    const state = model.states.get(link.source_state);
    if (!state) {
      return err({ code: "I-28", message: `source_state not found: ${link.source_state}`, entity: link.id });
    }
    // For enabling links: source_state belongs to source (the object enabler)
    // For transforming links: source_state belongs to the object endpoint
    const enablingSet = new Set(["agent", "instrument"]);
    const expectedParent = enablingSet.has(link.type) ? link.source :
      (source.kind === "object" ? link.source : link.target);
    if (state.parent !== expectedParent) {
      return err({ code: "I-28", message: `source_state ${link.source_state} does not belong to ${expectedParent}`, entity: link.id });
    }
  }
  if (link.target_state) {
    const state = model.states.get(link.target_state);
    if (!state) {
      return err({ code: "I-28", message: `target_state not found: ${link.target_state}`, entity: link.id });
    }
    // target_state always belongs to the object endpoint
    const objectId = source.kind === "object" ? link.source : link.target;
    if (state.parent !== objectId) {
      return err({ code: "I-28", message: `target_state ${link.target_state} does not belong to object ${objectId}`, entity: link.id });
    }
  }

  // I-EXCEPTION-TYPE: exception_type only valid on exception links (ISO §9.5.4)
  if (link.exception_type && link.type !== "exception") {
    return err({ code: "I-EXCEPTION-TYPE", message: `exception_type only allowed on exception links, not ${link.type}`, entity: link.id });
  }

  // I-18: agent source must be physical
  if (link.type === "agent") {
    if (source.essence !== "physical") {
      return err({ code: "I-18", message: `Agent source must be physical: ${link.source}`, entity: link.id });
    }
  }
  // I-14: exception link requires source process to have duration.max
  if (link.type === "exception") {
    if (!source.duration?.max) {
      return err({ code: "I-14", message: `Exception source must have duration.max: ${link.source}`, entity: link.id });
    }
  }

  // I-16: Transform exclusivity — effect/consumption/result mutually exclusive per (P,O) pair
  // Exception: consumption + result on same (P,O) is valid — object destroyed then recreated (ISO §9.3.1 + §9.3.2)
  const transformingTypesEager = new Set(["effect", "consumption", "result", "input", "output"]);
  if (transformingTypesEager.has(link.type)) {
    const procId = source.kind === "process" ? link.source : link.target;
    const objId = source.kind === "object" ? link.source : link.target;
    for (const existing of model.links.values()) {
      if (!transformingTypesEager.has(existing.type)) continue;
      const eSrc = model.things.get(existing.source);
      const eTgt = model.things.get(existing.target);
      if (!eSrc || !eTgt) continue;
      const eProcId = eSrc.kind === "process" ? existing.source : existing.target;
      const eObjId = eSrc.kind === "object" ? existing.source : existing.target;
      if (eProcId === procId && eObjId === objId) {
        const types = new Set([existing.type, link.type]);
        const isConsumptionResultPair = types.has("consumption") && types.has("result") && types.size === 2;
        if (!isConsumptionResultPair) {
          return err({ code: "I-16", message: `Conflicting transforming link: ${existing.type} already exists between process ${procId} and object ${objId}`, entity: link.id });
        }
      }
    }
  }

  // I-TAG-REQUIRED: tagged links must have a tag
  if (link.type === "tagged" && !link.tag) {
    return err({ code: "I-TAG-REQUIRED", message: "Tagged link requires a tag value", entity: link.id });
  }

  // I-31: at most 1 discriminating exhibition link per exhibitor
  if (link.type === "exhibition" && link.discriminating) {
    for (const existingLink of model.links.values()) {
      if (existingLink.type === "exhibition" && existingLink.discriminating && existingLink.target === link.target) {
        return err({ code: "I-31", message: `Exhibitor ${link.target} already has a discriminating attribute: ${existingLink.source}`, entity: link.id });
      }
    }
  }

  // I-STATELESS-EFFECT: effect links cannot target stateless objects
  if (link.type === "effect") {
    const target = model.things.get(link.target);
    if (target?.stateful === false) {
      return err({ code: "I-STATELESS-EFFECT", message: "Stateless objects cannot be affected — use consumption or result links", entity: link.id });
    }
  }
  // I-STATELESS-EFFECT: state-specified links cannot reference stateless objects
  if (link.source_state) {
    const sourceState = model.states.get(link.source_state);
    if (sourceState) {
      const parent = model.things.get(sourceState.parent);
      if (parent?.stateful === false) {
        return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects", entity: link.id });
      }
    }
  }
  if (link.target_state) {
    const targetState = model.states.get(link.target_state);
    if (targetState) {
      const parent = model.things.get(targetState.parent);
      if (parent?.stateful === false) {
        return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects", entity: link.id });
      }
    }
  }

  let things = model.things;
  // I-19 effect: exhibition forces source.essence := informatical
  if (link.type === "exhibition") {
    const exhibitSource = things.get(link.source)!;
    if (exhibitSource.essence !== "informatical") {
      things = new Map(things).set(exhibitSource.id, { ...exhibitSource, essence: "informatical" });
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
  // INCONSISTENT_REFINEMENT: refines and refinement_type must both be present or both absent
  const hasRefines = opd.refines !== undefined;
  const hasRefinementType = opd.refinement_type !== undefined;
  if (hasRefines !== hasRefinementType) {
    return err({ code: "INCONSISTENT_REFINEMENT", message: `OPD ${opd.id} has refines without refinement_type or vice versa`, entity: opd.id });
  }
  // I-30: in-zoom must refine a process, unfold must refine an object
  if (opd.refines !== undefined && opd.refinement_type !== undefined) {
    const refinesThing = model.things.get(opd.refines);
    if (refinesThing) {
      if (opd.refinement_type === "in-zoom" && refinesThing.kind !== "process") {
        return err({ code: "I-30", message: `In-zoom OPD must refine a process, not ${refinesThing.kind}`, entity: opd.id });
      }
      if (opd.refinement_type === "unfold" && refinesThing.kind !== "object") {
        return err({ code: "I-30", message: `Unfold OPD must refine an object, not ${refinesThing.kind}`, entity: opd.id });
      }
    }
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

// ── Refinement (In-zoom / Unfold) ─────────────────────────────────────

export function refineThing(
  model: Model,
  thingId: string,
  parentOpdId: string,
  refinementType: RefinementType,
  childOpdId: string,
  childOpdName: string,
): Result<Model, InvariantError> {
  const thing = model.things.get(thingId);
  if (!thing) {
    return err({ code: "NOT_FOUND", message: `Thing not found: ${thingId}`, entity: thingId });
  }
  const parentOpd = model.opds.get(parentOpdId);
  if (!parentOpd) {
    return err({ code: "NOT_FOUND", message: `OPD not found: ${parentOpdId}`, entity: parentOpdId });
  }
  if (parentOpd.opd_type !== "hierarchical") {
    return err({ code: "INVALID_REFINEMENT", message: `Cannot refine from view OPD: ${parentOpdId}`, entity: parentOpdId });
  }
  const thingAppKey = appearanceKey(thingId, parentOpdId);
  if (!model.appearances.has(thingAppKey)) {
    return err({ code: "NOT_FOUND", message: `Thing ${thingId} has no appearance in OPD ${parentOpdId}`, entity: thingId });
  }
  if (refinementType === "unfold" && thing.kind !== "object") {
    return err({ code: "INVALID_REFINEMENT", message: `Unfold only applies to objects, not processes: ${thingId}`, entity: thingId });
  }
  // I-REFINE-EXT: cannot refine pullback projections (external appearances)
  const thingApp = model.appearances.get(thingAppKey)!;
  if (thingApp.internal === false) {
    return err({ code: "INVALID_REFINEMENT", message: `Cannot refine external appearance of ${thingId} — refine from its home OPD`, entity: thingId });
  }
  // I-REFINE-CYCLE: cannot refine a thing from within its own refinement tree
  let ancestorId: string | null = parentOpdId;
  while (ancestorId) {
    const ancestor = model.opds.get(ancestorId);
    if (!ancestor) break;
    if (ancestor.refines === thingId) {
      return err({ code: "INVALID_REFINEMENT", message: `Cannot refine ${thingId} from within its own refinement tree`, entity: thingId });
    }
    ancestorId = ancestor.parent_opd;
  }
  for (const opd of model.opds.values()) {
    if (opd.refines === thingId && opd.parent_opd === parentOpdId && opd.refinement_type === refinementType) {
      return err({ code: "ALREADY_REFINED", message: `Thing ${thingId} already has ${refinementType} refinement from OPD ${parentOpdId}`, entity: thingId });
    }
  }
  if (collectAllIds(model).has(childOpdId)) {
    return err({ code: "I-08", message: `Duplicate id: ${childOpdId}`, entity: childOpdId });
  }

  // Compute pullback: things in fiber(parentOpd) connected to thingId via selector
  const thingsInFiber = new Set<string>();
  for (const app of model.appearances.values()) {
    if (app.opd === parentOpdId) thingsInFiber.add(app.thing);
  }

  const externalThings = new Set<string>();
  for (const link of model.links.values()) {
    if (refinementType === "in-zoom") {
      if (link.source === thingId && thingsInFiber.has(link.target) && link.target !== thingId) {
        externalThings.add(link.target);
      }
      if (link.target === thingId && thingsInFiber.has(link.source) && link.source !== thingId) {
        externalThings.add(link.source);
      }
    }
  }

  // Unfold: collect structural children (parts/features) of thingId.
  // Convention detection: count structural links per direction to determine
  // whether thingId is parent-as-source (canvas) or parent-as-target (old).
  if (refinementType === "unfold") {
    let asSource = 0, asTarget = 0;
    for (const link of model.links.values()) {
      if (link.type !== "aggregation" && link.type !== "exhibition") continue;
      if (link.source === thingId) asSource++;
      if (link.target === thingId) asTarget++;
    }
    for (const link of model.links.values()) {
      if (link.type !== "aggregation" && link.type !== "exhibition") continue;
      // If thingId appears more as source → canvas convention (source=parent)
      if (asSource > asTarget && link.source === thingId &&
          thingsInFiber.has(link.target) && link.target !== thingId) {
        externalThings.add(link.target);
      }
      // If thingId appears more as target → old convention (target=parent)
      if (asTarget >= asSource && link.target === thingId &&
          thingsInFiber.has(link.source) && link.source !== thingId) {
        externalThings.add(link.source);
      }
    }
  }

  const childOpd: OPD = {
    id: childOpdId,
    name: childOpdName,
    opd_type: "hierarchical",
    parent_opd: parentOpdId,
    refines: thingId,
    refinement_type: refinementType,
  };
  const opds = new Map(model.opds).set(childOpdId, childOpd);

  const appearances = new Map(model.appearances);
  appearances.set(appearanceKey(thingId, childOpdId), {
    thing: thingId, opd: childOpdId,
    x: 0, y: 0, w: 200, h: 150, internal: true,
  });
  let index = 0;
  for (const extThingId of externalThings) {
    appearances.set(appearanceKey(extThingId, childOpdId), {
      thing: extThingId, opd: childOpdId,
      x: 50 + index * 150, y: 50, w: 120, h: 60, internal: false,
    });
    index++;
  }

  return ok(touch({ ...model, opds, appearances }));
}

// ── Appearances ────────────────────────────────────────────────────────

export function addAppearance(
  model: Model,
  appearance: Appearance,
): Result<Model, InvariantError> {
  const key = appearanceKey(appearance.thing, appearance.opd);
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
  const key = appearanceKey(thing, opd);
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
  // I-CONDITION-MODE: condition_mode only valid on condition modifiers
  if (mod.condition_mode && mod.type !== "condition") {
    return err({ code: "I-CONDITION-MODE", message: "condition_mode is only valid on condition modifiers", entity: mod.id });
  }
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
  // I-29: all members must be same link type
  const memberTypes = fan.members.map(mid => model.links.get(mid)!.type);
  if (memberTypes.some(t => t !== memberTypes[0])) {
    return err({ code: "I-29", message: `Fan members must all be same link type`, entity: fan.id });
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

// ── Singleton Updates ─────────────────────────────────────────────────

export function updateMeta(
  model: Model,
  patch: Partial<Omit<Meta, "created" | "modified">>,
): Result<Model, InvariantError> {
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const { created, modified, ...safe } = cleaned as Record<string, unknown>;
  return ok(touch({
    ...model,
    meta: { ...model.meta, ...safe },
  }));
}

export function updateSettings(
  model: Model,
  patch: Partial<Settings>,
): Result<Model, InvariantError> {
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  return ok(touch({
    ...model,
    settings: { ...model.settings, ...cleaned },
  }));
}

// ── Entity Updates (simple reference checks) ──────────────────────────

export function updateModifier(
  model: Model,
  id: string,
  patch: Partial<Omit<Modifier, "id">>,
): Result<Model, InvariantError> {
  const existing = model.modifiers.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Modifier not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Modifier;
  if (cleaned.over !== undefined && !model.links.has(updated.over)) {
    return err({ code: "I-06", message: `Link not found: ${updated.over}`, entity: id });
  }
  // I-CONDITION-MODE: merged state must not have condition_mode on non-condition type
  if (updated.condition_mode && updated.type !== "condition") {
    return err({ code: "I-CONDITION-MODE", message: "condition_mode is only valid on condition modifiers", entity: id });
  }
  return ok(touch({ ...model, modifiers: new Map(model.modifiers).set(id, updated) }));
}

export function updateAssertion(
  model: Model,
  id: string,
  patch: Partial<Omit<Assertion, "id">>,
): Result<Model, InvariantError> {
  const existing = model.assertions.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Assertion not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Assertion;
  if (cleaned.target !== undefined && updated.target != null) {
    if (!model.things.has(updated.target) && !model.links.has(updated.target)) {
      return err({ code: "I-09", message: `Assertion target not found: ${updated.target}`, entity: id });
    }
  }
  return ok(touch({ ...model, assertions: new Map(model.assertions).set(id, updated) }));
}

export function updateRequirement(
  model: Model,
  id: string,
  patch: Partial<Omit<Requirement, "id">>,
): Result<Model, InvariantError> {
  const existing = model.requirements.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Requirement not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Requirement;
  if (cleaned.target !== undefined) {
    if (!model.things.has(updated.target) && !model.states.has(updated.target) && !model.links.has(updated.target)) {
      return err({ code: "I-10", message: `Requirement target not found: ${updated.target}`, entity: id });
    }
  }
  return ok(touch({ ...model, requirements: new Map(model.requirements).set(id, updated) }));
}

export function updateStereotype(
  model: Model,
  id: string,
  patch: Partial<Omit<Stereotype, "id">>,
): Result<Model, InvariantError> {
  const existing = model.stereotypes.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Stereotype not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Stereotype;
  if (cleaned.thing !== undefined && !model.things.has(updated.thing)) {
    return err({ code: "I-11", message: `Stereotype target thing not found: ${updated.thing}`, entity: id });
  }
  return ok(touch({ ...model, stereotypes: new Map(model.stereotypes).set(id, updated) }));
}

export function updateSubModel(
  model: Model,
  id: string,
  patch: Partial<Omit<SubModel, "id">>,
): Result<Model, InvariantError> {
  const existing = model.subModels.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `SubModel not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as SubModel;
  if (cleaned.shared_things !== undefined) {
    for (const thingId of updated.shared_things) {
      if (!model.things.has(thingId)) {
        return err({ code: "I-12", message: `Shared thing not found: ${thingId}`, entity: id });
      }
    }
  }
  return ok(touch({ ...model, subModels: new Map(model.subModels).set(id, updated) }));
}

export function updateScenario(
  model: Model,
  id: string,
  patch: Partial<Omit<Scenario, "id">>,
): Result<Model, InvariantError> {
  const existing = model.scenarios.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Scenario not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Scenario;
  if (cleaned.path_labels !== undefined) {
    const allPathLabels = new Set(
      [...model.links.values()].map((l) => l.path_label).filter(Boolean) as string[]
    );
    for (const pl of updated.path_labels) {
      if (!allPathLabels.has(pl)) {
        return err({ code: "I-13", message: `Path label not found in any link: ${pl}`, entity: id });
      }
    }
  }
  return ok(touch({ ...model, scenarios: new Map(model.scenarios).set(id, updated) }));
}

// ── Entity Updates (structural checks) ────────────────────────────────

export function updateState(
  model: Model,
  id: string,
  patch: Partial<Omit<State, "id">>,
): Result<Model, InvariantError> {
  const existing = model.states.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `State not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as State;
  if (cleaned.parent !== undefined) {
    const parent = model.things.get(updated.parent);
    if (!parent) return err({ code: "I-01", message: `Parent thing not found: ${updated.parent}`, entity: id });
    if (parent.kind !== "object") return err({ code: "I-01", message: `State parent must be object, got process: ${updated.parent}`, entity: id });
  }
  // I-21: exclusive current state — auto-unset siblings (radio button coercion)
  const states = new Map(model.states).set(id, updated);
  if (updated.current) {
    for (const [sid, s] of states) {
      if (sid !== id && s.parent === updated.parent && s.current) {
        states.set(sid, { ...s, current: false });
      }
    }
  }
  return ok(touch({ ...model, states }));
}

export function updateOPD(
  model: Model,
  id: string,
  patch: Partial<Omit<OPD, "id">>,
): Result<Model, InvariantError> {
  const existing = model.opds.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `OPD not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as OPD;
  if (updated.opd_type === "view" && updated.parent_opd !== null) {
    return err({ code: "I-03", message: `View OPD must have parent_opd=null`, entity: id });
  }
  if (updated.opd_type === "hierarchical" && updated.parent_opd !== null) {
    if (!model.opds.has(updated.parent_opd)) {
      return err({ code: "I-03", message: `Parent OPD not found: ${updated.parent_opd}`, entity: id });
    }
  }
  // INCONSISTENT_REFINEMENT: refines and refinement_type must both be present or both absent
  const hasRefines = updated.refines !== undefined;
  const hasRefinementType = updated.refinement_type !== undefined;
  if (hasRefines !== hasRefinementType) {
    return err({ code: "INCONSISTENT_REFINEMENT", message: `OPD ${id} has refines without refinement_type or vice versa`, entity: id });
  }
  // I-30: in-zoom must refine a process, unfold must refine an object
  if (updated.refines !== undefined && updated.refinement_type !== undefined) {
    const refinesThing = model.things.get(updated.refines);
    if (refinesThing) {
      if (updated.refinement_type === "in-zoom" && refinesThing.kind !== "process") {
        return err({ code: "I-30", message: `In-zoom OPD must refine a process, not ${refinesThing.kind}`, entity: id });
      }
      if (updated.refinement_type === "unfold" && refinesThing.kind !== "object") {
        return err({ code: "I-30", message: `Unfold OPD must refine an object, not ${refinesThing.kind}`, entity: id });
      }
    }
  }
  return ok(touch({ ...model, opds: new Map(model.opds).set(id, updated) }));
}

export function updateAppearance(
  model: Model,
  thing: string,
  opd: string,
  patch: Partial<Omit<Appearance, "thing" | "opd">>,
): Result<Model, InvariantError> {
  const key = appearanceKey(thing, opd);
  const existing = model.appearances.get(key);
  if (!existing) return err({ code: "NOT_FOUND", message: `Appearance not found: ${key}`, entity: key });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Appearance;
  if (updated.internal) {
    const opdEntity = model.opds.get(opd);
    if (!opdEntity || !opdEntity.refines) {
      return err({ code: "I-15", message: `internal=true only allowed in refinement OPDs`, entity: key });
    }
  }
  return ok(touch({ ...model, appearances: new Map(model.appearances).set(key, updated) }));
}

export function updateFan(
  model: Model,
  id: string,
  patch: Partial<Omit<Fan, "id">>,
): Result<Model, InvariantError> {
  const existing = model.fans.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Fan not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Fan;
  if (cleaned.members !== undefined) {
    if (updated.members.length < 2) {
      return err({ code: "I-07", message: `Fan must have at least 2 members, got ${updated.members.length}`, entity: id });
    }
    for (const memberId of updated.members) {
      if (!model.links.has(memberId)) {
        return err({ code: "I-07", message: `Fan member link not found: ${memberId}`, entity: id });
      }
    }
    // I-29: all members must be same link type
    const memberTypes = updated.members.map(mid => model.links.get(mid)!.type);
    if (memberTypes.some(t => t !== memberTypes[0])) {
      return err({ code: "I-29", message: `Fan members must all be same link type`, entity: id });
    }
  }
  return ok(touch({ ...model, fans: new Map(model.fans).set(id, updated) }));
}

// ── updateThing (complex fibered checks) ──────────────────────────────

export function updateThing(
  model: Model,
  id: string,
  patch: Partial<Omit<Thing, "id">>,
): Result<Model, InvariantError> {
  const existing = model.things.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Thing not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Thing;

  // I-01: if kind changes to process, reject if states exist
  if (cleaned.kind !== undefined && updated.kind === "process") {
    for (const state of model.states.values()) {
      if (state.parent === id) {
        return err({ code: "I-01", message: `Cannot change kind to process: thing has states`, entity: id });
      }
    }
  }

  // I-STATELESS-DOWNGRADE: cannot mark as stateless if states exist
  if (cleaned.stateful === false) {
    const hasStates = [...model.states.values()].some(s => s.parent === id);
    if (hasStates) {
      return err({ code: "I-STATELESS-DOWNGRADE", message: "Remove all states before marking as stateless", entity: id });
    }
  }

  // I-STATELESS-EFFECT: cannot mark as stateless if effect links target this object
  if (cleaned.stateful === false) {
    for (const link of model.links.values()) {
      if (link.type === "effect" && link.target === id) {
        return err({ code: "I-STATELESS-EFFECT", message: "Remove effect links before marking as stateless", entity: id });
      }
    }
  }

  // Check links where this thing is source
  if (cleaned.essence !== undefined || cleaned.duration !== undefined) {
    for (const link of model.links.values()) {
      if (link.source === id) {
        // I-18: agent source must be physical
        if (link.type === "agent" && updated.essence !== "physical") {
          return err({ code: "I-18", message: `Agent source must be physical: ${id}`, entity: id });
        }
        // I-19: exhibition source must be informatical
        if (link.type === "exhibition" && updated.essence !== "informatical") {
          return err({ code: "I-19", message: `Exhibition source must be informatical: ${id}`, entity: id });
        }
        // I-14: exception source must have duration.max
        if (link.type === "exception" && !updated.duration?.max) {
          return err({ code: "I-14", message: `Exception source must have duration.max: ${id}`, entity: id });
        }
      }
    }
  }

  return ok(touch({ ...model, things: new Map(model.things).set(id, updated) }));
}

// ── updateLink (complex fibered checks + I-19 coercion) ───────────────

export function updateLink(
  model: Model,
  id: string,
  patch: Partial<Omit<Link, "id">>,
): Result<Model, InvariantError> {
  const existing = model.links.get(id);
  if (!existing) return err({ code: "NOT_FOUND", message: `Link not found: ${id}`, entity: id });
  const cleaned = cleanPatch(patch as Record<string, unknown>);
  const updated = { ...existing, ...cleaned } as Link;

  // I-05: source and target must exist
  if (cleaned.source !== undefined && !model.things.has(updated.source)) {
    return err({ code: "I-05", message: `Source thing not found: ${updated.source}`, entity: id });
  }
  if (cleaned.target !== undefined && !model.things.has(updated.target)) {
    return err({ code: "I-05", message: `Target thing not found: ${updated.target}`, entity: id });
  }

  // Validate source_state/target_state when source, target, source_state, or target_state changes
  if ((cleaned.source !== undefined || cleaned.source_state !== undefined) && updated.source_state) {
    const state = model.states.get(updated.source_state);
    if (!state || state.parent !== updated.source) {
      return err({ code: "DANGLING_STATE", message: `source_state ${updated.source_state} does not belong to source ${updated.source}`, entity: id });
    }
  }
  if ((cleaned.target !== undefined || cleaned.target_state !== undefined) && updated.target_state) {
    const state = model.states.get(updated.target_state);
    if (!state || state.parent !== updated.target) {
      return err({ code: "DANGLING_STATE", message: `target_state ${updated.target_state} does not belong to target ${updated.target}`, entity: id });
    }
  }

  // If any of {source, target, type} changed, re-check I-14, I-18, I-19
  let things = model.things;
  if (cleaned.source !== undefined || cleaned.target !== undefined || cleaned.type !== undefined) {
    const source = things.get(updated.source);
    if (!source) return err({ code: "I-05", message: `Source thing not found: ${updated.source}`, entity: id });

    // I-18: agent source must be physical
    if (updated.type === "agent" && source.essence !== "physical") {
      return err({ code: "I-18", message: `Agent source must be physical: ${updated.source}`, entity: id });
    }

    // I-14: exception source must have duration.max
    if (updated.type === "exception" && !source.duration?.max) {
      return err({ code: "I-14", message: `Exception source must have duration.max: ${updated.source}`, entity: id });
    }

    // I-19: exhibition coercion
    if (updated.type === "exhibition") {
      if (source.essence !== "informatical") {
        things = new Map(things).set(source.id, { ...source, essence: "informatical" });
      }
    }
  }

  // I-31: at most 1 discriminating exhibition per exhibitor
  if (updated.type === "exhibition" && updated.discriminating) {
    for (const [existingId, existingLink] of model.links) {
      if (existingId !== id && existingLink.type === "exhibition" && existingLink.discriminating && existingLink.target === updated.target) {
        return err({ code: "I-31", message: `Exhibitor ${updated.target} already has a discriminating attribute: ${existingLink.source}`, entity: id });
      }
    }
  }

  // I-STATELESS-EFFECT: effect links cannot target stateless objects
  if (updated.type === "effect") {
    // Find the object endpoint (may be source or target depending on direction)
    const srcThing = model.things.get(updated.source);
    const tgtThing = model.things.get(updated.target);
    const objectThing = srcThing?.kind === "object" ? srcThing : tgtThing;
    if (objectThing?.stateful === false) {
      return err({ code: "I-STATELESS-EFFECT", message: "Stateless objects cannot be affected — use consumption or result links", entity: id });
    }
  }
  // I-STATELESS-EFFECT: state-specified links cannot reference stateless objects
  if (updated.source_state) {
    const sourceState = model.states.get(updated.source_state);
    if (sourceState) {
      const parent = model.things.get(sourceState.parent);
      if (parent?.stateful === false) {
        return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects", entity: id });
      }
    }
  }
  if (updated.target_state) {
    const targetState = model.states.get(updated.target_state);
    if (targetState) {
      const parent = model.things.get(targetState.parent);
      if (parent?.stateful === false) {
        return err({ code: "I-STATELESS-EFFECT", message: "State-specified links cannot reference stateless objects", entity: id });
      }
    }
  }

  return ok(touch({ ...model, things, links: new Map(model.links).set(id, updated) }));
}

// ── Semi-fold Query ───────────────────────────────────────────────────

export interface SemiFoldEntry {
  thingId: string;
  name: string;
  kind: Kind;
  linkType: "aggregation" | "exhibition";
}

/**
 * Get parts (aggregation) and features (exhibition) of a thing for semi-fold display.
 * Returns at most maxVisible items, plus count of remaining hidden items.
 */
export function getSemiFoldedParts(
  model: Model,
  thingId: string,
  maxVisible: number = 5,
): { visible: SemiFoldEntry[]; hiddenCount: number } {
  const thing = model.things.get(thingId);
  if (!thing || thing.kind !== "object") return { visible: [], hiddenCount: 0 };

  const entries: SemiFoldEntry[] = [];
  for (const link of model.links.values()) {
    // aggregation: source=whole, target=part → collect parts
    if (link.type === "aggregation" && link.source === thingId) {
      const part = model.things.get(link.target);
      if (part) entries.push({ thingId: link.target, name: part.name, kind: part.kind, linkType: "aggregation" });
    }
    // exhibition: direction-agnostic — handles both source=feature/target=exhibitor
    // and canvas-created source=exhibitor/target=feature
    if (link.type === "exhibition") {
      if (link.target === thingId && link.source !== thingId) {
        const feature = model.things.get(link.source);
        if (feature) entries.push({ thingId: link.source, name: feature.name, kind: feature.kind, linkType: "exhibition" });
      } else if (link.source === thingId && link.target !== thingId) {
        const feature = model.things.get(link.target);
        if (feature) entries.push({ thingId: link.target, name: feature.name, kind: feature.kind, linkType: "exhibition" });
      }
    }
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  if (entries.length <= maxVisible) return { visible: entries, hiddenCount: 0 };
  return { visible: entries.slice(0, maxVisible), hiddenCount: entries.length - maxVisible };
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
    const key = appearanceKey(app.thing, app.opd);
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
    // I-FAN-PROB: ISO §12.7 — XOR fan link probabilities must sum to 1.0
    if (fan.type === "xor") {
      const probs = fan.members.map(mid => model.links.get(mid)?.probability).filter((p): p is number => p != null);
      if (probs.length > 0 && probs.length === fan.members.length) {
        const sum = probs.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1.0) > 0.001) {
          errors.push({ code: "I-FAN-PROB", message: `Fan ${id} XOR probabilities sum to ${sum}, must be 1.0`, entity: id });
        }
      }
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
    // I-EXCEPTION-TYPE: exception_type only valid on exception links (ISO §9.5.4)
    if (link.exception_type && link.type !== "exception") {
      errors.push({ code: "I-EXCEPTION-TYPE", message: `Link ${id} has exception_type but type is ${link.type}`, entity: id });
    }
  }

  // I-15
  for (const [key, app] of model.appearances) {
    if (app.internal) {
      const opd = model.opds.get(app.opd);
      if (!opd || !opd.refines) errors.push({ code: "I-15", message: `Appearance ${key} internal=true in non-refinement OPD`, entity: key });
    }
  }

  // DANGLING_REFINES: OPD.refines must reference existing thing
  for (const [id, opd] of model.opds) {
    if (opd.refines !== undefined && !model.things.has(opd.refines)) {
      errors.push({ code: "DANGLING_REFINES", message: `OPD ${id} refines non-existent thing: ${opd.refines}`, entity: id });
    }
  }

  // INCONSISTENT_REFINEMENT: refines and refinement_type must be both present or both absent
  for (const [id, opd] of model.opds) {
    const hasRefines = opd.refines !== undefined;
    const hasType = opd.refinement_type !== undefined;
    if (hasRefines !== hasType) {
      errors.push({ code: "INCONSISTENT_REFINEMENT", message: `OPD ${id} has refines without refinement_type or vice versa`, entity: id });
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

  // I-33: Procedural links must connect object↔process (ISO §6.1-§6.3)
  const PROCEDURAL_TYPES = new Set([
    "consumption", "result", "effect", "input", "output", "agent", "instrument",
  ]);
  for (const [id, link] of model.links) {
    if (PROCEDURAL_TYPES.has(link.type)) {
      const src = model.things.get(link.source);
      const tgt = model.things.get(link.target);
      if (src && tgt && src.kind === tgt.kind) {
        errors.push({ code: "I-33", message: `${link.type} link ${id} must connect object↔process`, entity: id });
      }
      // I-33b: Consumption must go object→process (ISO §6.1)
      if (link.type === "consumption" && src && src.kind !== "object") {
        errors.push({ code: "I-33", message: `consumption link ${id} source must be object (ISO §6.1)`, entity: id });
      }
    }
  }

  // I-34: No self-loops except invocation (ISO §8.5)
  for (const [id, link] of model.links) {
    if (link.source === link.target && link.type !== "invocation") {
      errors.push({ code: "I-34", message: `Self-loop not allowed for ${link.type} link ${id}`, entity: id });
    }
  }

  // I-16: unique transforming link per (process, object) pair
  // Transforming links (effect/consumption/result) are mutually exclusive EXCEPT:
  // consumption + result on same (process, object) is valid — object is destroyed
  // (consumption) and a new instance created (result). NOT equivalent to effect/state-change.
  const transformingTypes = new Set(["effect", "consumption", "result", "input", "output"]);
  const proceduralPairs = new Map<string, { type: string; id: string }>();
  for (const [id, link] of model.links) {
    if (transformingTypes.has(link.type)) {
      const source = model.things.get(link.source);
      const target = model.things.get(link.target);
      if (source && target) {
        const procId = source.kind === "process" ? link.source : link.target;
        const objId = source.kind === "object" ? link.source : link.target;
        const pairKey = `${procId}::${objId}`;
        const existing = proceduralPairs.get(pairKey);
        if (existing) {
          // Allow consumption + result pair (destruction + creation, not state change)
          const types = new Set([existing.type, link.type]);
          const isConsumptionResultPair = types.has("consumption") && types.has("result") && types.size === 2;
          if (!isConsumptionResultPair) {
            errors.push({ code: "I-16", message: `Multiple procedural links between process ${procId} and object ${objId}`, entity: id });
          }
        } else {
          proceduralPairs.set(pairKey, { type: link.type, id });
        }
      }
    }
  }

  // I-16-EXT: Enabling link uniqueness (ISO §8.1.2)
  const enablingPairs = new Map<string, string>();
  for (const [id, link] of model.links) {
    if (link.type === "agent" || link.type === "instrument") {
      const src = model.things.get(link.source);
      const tgt = model.things.get(link.target);
      if (src && tgt) {
        const objId = src.kind === "object" ? link.source : link.target;
        const procId = src.kind === "process" ? link.source : link.target;
        const pairKey = `${procId}::${objId}`;
        if (enablingPairs.has(pairKey)) {
          errors.push({ code: "I-16", message: `Multiple enabling links between process ${procId} and object ${objId}`, entity: id });
        } else {
          enablingPairs.set(pairKey, id);
        }
      }
    }
  }

  // I-21: at most 1 current state per object
  const currentByParent = new Map<string, string[]>();
  for (const [id, state] of model.states) {
    if (state.current) {
      const list = currentByParent.get(state.parent) ?? [];
      list.push(id);
      currentByParent.set(state.parent, list);
    }
  }
  for (const [parent, stateIds] of currentByParent) {
    if (stateIds.length > 1) {
      errors.push({ code: "I-21", message: `Object ${parent} has ${stateIds.length} current states: ${stateIds.join(", ")}`, entity: parent });
    }
  }

  // I-31: at most 1 discriminating exhibition per exhibitor
  const discByExhibitor = new Map<string, string[]>();
  for (const [id, link] of model.links) {
    if (link.type === "exhibition" && link.discriminating) {
      const list = discByExhibitor.get(link.target) ?? [];
      list.push(id);
      discByExhibitor.set(link.target, list);
    }
  }
  for (const [exhibitor, linkIds] of discByExhibitor) {
    if (linkIds.length > 1) {
      errors.push({ code: "I-31", message: `Exhibitor ${exhibitor} has ${linkIds.length} discriminating attributes`, entity: exhibitor });
    }
  }

  // I-32: discriminating values disjoint and exhaustive
  for (const [id, link] of model.links) {
    if (link.type === "exhibition" && link.discriminating) {
      const discriminatorId = link.source;
      const generalId = link.target;

      // States of the discriminating attribute
      const discStates = new Set<string>();
      for (const [, s] of model.states) {
        if (s.parent === discriminatorId) discStates.add(s.id);
      }
      if (discStates.size === 0) continue;

      // Generalization links pointing to the general
      const specLinks: Link[] = [];
      for (const l of model.links.values()) {
        if (l.type === "generalization" && l.target === generalId) {
          specLinks.push(l);
        }
      }
      if (specLinks.length === 0) continue;

      // Disjointness: no value appears in two specializations
      const seen = new Set<string>();
      for (const sl of specLinks) {
        if (sl.discriminating_values) {
          for (const v of sl.discriminating_values) {
            if (seen.has(v)) {
              errors.push({ code: "I-32", message: `Discriminating value ${v} appears in multiple specializations of ${generalId}`, entity: sl.id });
            }
            seen.add(v);
          }
        }
      }

      // Exhaustiveness: every state of discriminator must be covered
      const covered = new Set(specLinks.flatMap(sl => sl.discriminating_values ?? []));
      for (const stateId of discStates) {
        if (!covered.has(stateId)) {
          errors.push({ code: "I-32", message: `State ${stateId} of discriminator ${discriminatorId} not covered by specializations of ${generalId}`, entity: id });
        }
      }
    }
  }

  // I-17: Process must have at least one transformation link (no orphan processes)
  // Exempt in-zoomed processes: their transformation is delegated to subprocesses (ISO §14.2.2.4.1)
  const inZoomedProcessIds = new Set(
    [...model.opds.values()]
      .filter(o => o.refines && o.refinement_type === "in-zoom")
      .map(o => o.refines!)
  );
  for (const [id, thing] of model.things) {
    if (thing.kind === "process" && !inZoomedProcessIds.has(id)) {
      const hasTransformLink = [...model.links.values()].some(
        l => (l.source === id || l.target === id) &&
        ["effect", "consumption", "result", "input", "output"].includes(l.type)
      );
      if (!hasTransformLink) {
        errors.push({ code: "I-17", message: `Process ${id} has no transformation link`, entity: id });
      }
    }
  }

  // I-20: Object with states must have at least 2 states defined
  for (const [id, thing] of model.things) {
    if (thing.kind === "object") {
      const stateCount = [...model.states.values()].filter(s => s.parent === id).length;
      if (stateCount === 1) {
        errors.push({ code: "I-20", message: `Object ${id} has only 1 state (minimum 2 required)`, entity: id });
      }
    }
  }

  // I-22: Generalization - specialization consistency (same perseverance)
  for (const [id, link] of model.links) {
    if (link.type === "generalization") {
      const general = model.things.get(link.target);
      const spec = model.things.get(link.source);
      if (general && spec && general.kind !== spec.kind) {
        errors.push({ code: "I-22", message: `Generalization ${id}: general and specialization must have same perseverance`, entity: id });
      }
    }
  }

  // I-23: Classification - instances must match class perseverance
  for (const [id, link] of model.links) {
    if (link.type === "classification") {
      const classThing = model.things.get(link.target);
      const instance = model.things.get(link.source);
      if (classThing && instance && classThing.kind !== instance.kind) {
        errors.push({ code: "I-23", message: `Classification ${id}: class and instance must have same perseverance`, entity: id });
      }
    }
  }

  // I-24: Invocation links must connect processes only
  for (const [id, link] of model.links) {
    if (link.type === "invocation") {
      const source = model.things.get(link.source);
      const target = model.things.get(link.target);
      if ((source && source.kind !== "process") || (target && target.kind !== "process")) {
        errors.push({ code: "I-24", message: `Invocation link ${id} must connect processes only`, entity: id });
      }
    }
  }

  // I-25: Exception links must connect processes only
  for (const [id, link] of model.links) {
    if (link.type === "exception") {
      const source = model.things.get(link.source);
      const target = model.things.get(link.target);
      if ((source && source.kind !== "process") || (target && target.kind !== "process")) {
        errors.push({ code: "I-25", message: `Exception link ${id} must connect processes only`, entity: id });
      }
    }
  }

  // I-26: Aggregation - parts must have same perseverance as whole
  for (const [id, link] of model.links) {
    if (link.type === "aggregation") {
      const whole = model.things.get(link.target);
      const part = model.things.get(link.source);
      if (whole && part && whole.kind !== part.kind) {
        errors.push({ code: "I-26", message: `Aggregation ${id}: whole and part must have same perseverance`, entity: id });
      }
    }
  }


  // I-28: State-specified links reference valid states
  for (const [id, link] of model.links) {
    const src = model.things.get(link.source);
    const tgt = model.things.get(link.target);
    const enablingSet = new Set(["agent", "instrument"]);
    if (link.source_state) {
      const state = model.states.get(link.source_state);
      if (!state) {
        errors.push({ code: "I-28", message: `Link ${id} source_state references non-existent state`, entity: id });
      } else {
        const expectedParent = enablingSet.has(link.type)
          ? link.source
          : (src?.kind === "object" ? link.source : link.target);
        if (state.parent !== expectedParent) {
          errors.push({ code: "I-28", message: `Link ${id} source_state does not belong to expected parent`, entity: id });
        }
      }
    }
    if (link.target_state) {
      const state = model.states.get(link.target_state);
      if (!state) {
        errors.push({ code: "I-28", message: `Link ${id} target_state references non-existent state`, entity: id });
      } else {
        const objectId = src?.kind === "object" ? link.source : link.target;
        if (state.parent !== objectId) {
          errors.push({ code: "I-28", message: `Link ${id} target_state does not belong to object endpoint`, entity: id });
        }
      }
    }
  }

  // I-29: Fan members must all be same link type
  for (const [fanId, fan] of model.fans) {
    if (fan.members.length > 0) {
      const firstMemberId = fan.members[0];
      if (!firstMemberId) continue;
      const firstLink = model.links.get(firstMemberId);
      if (firstLink) {
        for (let i = 1; i < fan.members.length; i++) {
          const memberId = fan.members[i];
          if (!memberId) continue;
          const memberLink = model.links.get(memberId);
          if (memberLink && memberLink.type !== firstLink.type) {
            errors.push({ code: "I-29", message: `Fan ${fanId}: all members must be same link type`, entity: fanId });
            break;
          }
        }
      }
    }
  }

  // I-30: OPD refines must be process (for in-zoom) or object (for unfold)
  for (const [id, opd] of model.opds) {
    if (opd.refines !== undefined) {
      const refinesThing = model.things.get(opd.refines);
      if (refinesThing) {
        // For hierarchical OPDs, refines must match the OPD type
        if (opd.opd_type === "hierarchical" && opd.refinement_type === "in-zoom" && refinesThing.kind !== "process") {
          errors.push({ code: "I-30", message: `OPD ${id} in-zoom refines must be a process`, entity: id });
        }
        if (opd.opd_type === "hierarchical" && opd.refinement_type === "unfold" && refinesThing.kind !== "object") {
          errors.push({ code: "I-30", message: `OPD ${id} unfold refines must be an object`, entity: id });
        }
      }
    }
  }

  // I-STATELESS-STATES: stateless objects cannot have states
  for (const [id, state] of model.states) {
    const parent = model.things.get(state.parent);
    if (parent?.stateful === false) {
      errors.push({ code: "I-STATELESS-STATES", message: `State ${id} belongs to stateless object ${state.parent}`, entity: id });
    }
  }

  // I-STATELESS-EFFECT: effect links cannot target stateless objects + state-specified links
  for (const [id, link] of model.links) {
    if (link.type === "effect") {
      const target = model.things.get(link.target);
      if (target?.stateful === false) {
        errors.push({ code: "I-STATELESS-EFFECT", message: `Effect link ${id} targets stateless object ${link.target}`, entity: id });
      }
    }
    if (link.source_state) {
      const sourceState = model.states.get(link.source_state);
      if (sourceState) {
        const parent = model.things.get(sourceState.parent);
        if (parent?.stateful === false) {
          errors.push({ code: "I-STATELESS-EFFECT", message: `Link ${id} source_state references stateless object`, entity: id });
        }
      }
    }
    if (link.target_state) {
      const targetState = model.states.get(link.target_state);
      if (targetState) {
        const parent = model.things.get(targetState.parent);
        if (parent?.stateful === false) {
          errors.push({ code: "I-STATELESS-EFFECT", message: `Link ${id} target_state references stateless object`, entity: id });
        }
      }
    }
  }

  // I-CONDITION-MODE: condition_mode only valid on condition modifiers
  for (const [id, mod] of model.modifiers) {
    if (mod.condition_mode && mod.type !== "condition") {
      errors.push({ code: "I-CONDITION-MODE", message: `Modifier ${id} has condition_mode but type is ${mod.type}`, entity: id });
    }
  }

  // I-EVENT-INZOOM-BOUNDARY: event links shall not cross in-zoom boundary (ISO §14.2.2.4.2)
  // Only PROCESSES inside in-zoom count as subprocesses; objects are shared resources.
  const inZoomSubprocesses = new Map<string, string>(); // subprocess ID → in-zoom OPD ID
  for (const opd of model.opds.values()) {
    if (opd.refines && opd.refinement_type === "in-zoom") {
      for (const app of model.appearances.values()) {
        if (app.opd === opd.id && app.thing !== opd.refines) {
          const thing = model.things.get(app.thing);
          if (thing?.kind === "process") {
            inZoomSubprocesses.set(thing.id, opd.id);
          }
        }
      }
    }
  }
  for (const [modId, mod] of model.modifiers) {
    if (mod.type !== "event") continue;
    const link = model.links.get(mod.over);
    if (!link) continue;
    // Check if either endpoint is a subprocess and the other is NOT in the same in-zoom OPD
    for (const [endpointId, otherId] of [[link.source, link.target], [link.target, link.source]] as const) {
      const opdId = inZoomSubprocesses.get(endpointId);
      if (!opdId) continue;
      // Other endpoint must also appear in the same in-zoom OPD
      const otherInSameOpd = [...model.appearances.values()].some(
        a => a.opd === opdId && a.thing === otherId
      );
      if (!otherInSameOpd) {
        errors.push({
          code: "I-EVENT-INZOOM-BOUNDARY",
          message: `Event modifier ${modId} on link ${link.id} crosses in-zoom boundary (ISO §14.2.2.4.2)`,
          entity: modId,
        });
        break;
      }
    }
  }

  return errors;
}

// ── Consumption+Result Pairing (DA-7) ──────────────────────────────────

export interface ConsumptionResultPair {
  consumptionLink: Link;
  resultLink: Link;
  objectId: string;
  processId: string;
  fromStateName?: string;
  toStateName?: string;
}

/**
 * Find consumption+result pairs within resolved links for an OPD.
 * A pair exists when both a consumption and result link connect the same
 * (object, process). This visual grouping shows the destruction+creation
 * cycle as a unified arrow (DA-7). NOT equivalent to effect (state change).
 */
export function findConsumptionResultPairs(
  model: Model,
  resolvedLinks: ResolvedLink[],
): ConsumptionResultPair[] {
  // Index consumption and result links by (objectId|processId) key
  const consumptions = new Map<string, number>();
  const results = new Map<string, number>();

  resolvedLinks.forEach((rl, i) => {
    const srcThing = model.things.get(rl.visualSource);
    const objId = srcThing?.kind === "object" ? rl.visualSource : rl.visualTarget;
    const procId = srcThing?.kind === "process" ? rl.visualSource : rl.visualTarget;
    if (rl.link.type === "consumption") consumptions.set(`${objId}|${procId}`, i);
    else if (rl.link.type === "result") results.set(`${objId}|${procId}`, i);
  });

  const pairs: ConsumptionResultPair[] = [];
  for (const [key, consIdx] of consumptions) {
    const resIdx = results.get(key);
    if (resIdx === undefined) continue;

    const consRL = resolvedLinks[consIdx]!;
    const resRL = resolvedLinks[resIdx]!;
    const [objId = "", procId = ""] = key.split("|");

    const fromState = consRL.link.source_state
      ? model.states.get(consRL.link.source_state)
      : undefined;
    const toState = resRL.link.target_state
      ? model.states.get(resRL.link.target_state)
      : undefined;

    pairs.push({
      consumptionLink: consRL.link,
      resultLink: resRL.link,
      objectId: objId,
      processId: procId,
      fromStateName: fromState?.name,
      toStateName: toState?.name,
    });
  }

  return pairs;
}

// ── Structural Fork Detection (C-05) ──────────────────────────────────

export interface StructuralFork {
  type: "aggregation" | "exhibition" | "generalization" | "classification";
  parentId: string;
  children: Array<{
    link: Link;
    childId: string;
    childIsTarget: boolean;
  }>;
}

/**
 * Find structural link forks within resolved links for an OPD.
 * A fork exists when 2+ structural links of the same type share the same
 * parent thing. ISO 19450 §6: these render as a single shared triangle
 * (trunk from parent to apex, branches from base to children).
 *
 * Direction-agnostic: groups by both source and target endpoints, then picks
 * the largest non-overlapping groups. This handles exhibition links created
 * in either direction (source=feature→target=exhibitor or vice versa).
 */
export function findStructuralForks(resolvedLinks: ResolvedLink[], minChildren: number = 2): StructuralFork[] {
  const STRUCTURAL = new Set(["aggregation", "exhibition", "generalization", "classification"]);
  const groups = new Map<string, StructuralFork>();

  for (const rl of resolvedLinks) {
    const type = rl.link.type;
    if (!STRUCTURAL.has(type)) continue;
    const sType = type as StructuralFork["type"];

    // Group by source as parent
    const srcKey = `src::${type}::${rl.visualSource}`;
    if (!groups.has(srcKey)) {
      groups.set(srcKey, { type: sType, parentId: rl.visualSource, children: [] });
    }
    groups.get(srcKey)!.children.push({ link: rl.link, childId: rl.visualTarget, childIsTarget: true });

    // Group by target as parent
    const tgtKey = `tgt::${type}::${rl.visualTarget}`;
    if (!groups.has(tgtKey)) {
      groups.set(tgtKey, { type: sType, parentId: rl.visualTarget, children: [] });
    }
    groups.get(tgtKey)!.children.push({ link: rl.link, childId: rl.visualSource, childIsTarget: false });
  }

  // Pick largest non-overlapping forks (prevent a link from appearing in two forks)
  const candidates = [...groups.values()]
    .filter(g => g.children.length >= minChildren)
    .sort((a, b) => b.children.length - a.children.length);

  const used = new Set<string>();
  const result: StructuralFork[] = [];
  for (const fork of candidates) {
    if (fork.children.some(c => used.has(c.link.id))) continue;
    result.push(fork);
    for (const c of fork.children) used.add(c.link.id);
  }
  return result;
}
