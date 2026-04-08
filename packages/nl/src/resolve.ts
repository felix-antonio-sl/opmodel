import { ok, err, type Result, type Model, type OplEdit, type Link, applyOplEdit } from "@opmodel/core";
import type { NlEditDescriptor, ResolveError } from "./types";

/** Build name→thingId index for O(1) lookups */
function buildNameIndex(model: Model): Map<string, string> {
  const idx = new Map<string, string>();
  for (const [id, t] of model.things) {
    idx.set(t.name.toLowerCase(), id);
  }
  return idx;
}

function findThingByName(model: Model, name: string, nameIndex: Map<string, string>) {
  const id = nameIndex.get(name.toLowerCase());
  return id ? model.things.get(id) : undefined;
}

function findStateByName(model: Model, parentId: string, stateName: string) {
  const lower = stateName.toLowerCase();
  return [...model.states.values()].find(
    s => s.parent === parentId && s.name.toLowerCase() === lower,
  );
}

function findLinkByEndpoints(model: Model, sourceId: string, targetId: string, linkType: string) {
  return [...model.links.values()].find(
    l => l.source === sourceId && l.target === targetId && l.type === linkType,
  );
}

function findModifier(model: Model, linkId: string, modifierType: string) {
  return [...model.modifiers.values()].find(
    m => m.over === linkId && m.type === modifierType,
  );
}

/** OPM semantic pre-validation warnings (non-blocking) */
function checkSemantics(
  desc: NlEditDescriptor,
  model: Model,
  nameIndex: Map<string, string>,
): string[] {
  const warns: string[] = [];
  if (desc.kind === "add-link") {
    // For agent/instrument links, source should typically be an object
    if (desc.linkType === "agent" || desc.linkType === "instrument") {
      const source = findThingByName(model, desc.sourceName, nameIndex);
      if (source && source.kind === "process") {
        warns.push(`OPM warning: ${desc.linkType} link source "${desc.sourceName}" is a process — typically should be an object`);
      }
    }
  }
  if (desc.kind === "add-states") {
    // States are typically on objects, not processes in standard OPM
    const parent = findThingByName(model, desc.thingName, nameIndex);
    if (parent && parent.kind === "process") {
      warns.push(`OPM warning: adding states to process "${desc.thingName}" — states are typically on objects`);
    }
  }
  return warns;
}

function resolveOne(
  desc: NlEditDescriptor,
  model: Model,
  opdId: string,
  addThingCount: number,
  nameIndex: Map<string, string>,
): Result<OplEdit, Omit<ResolveError, "index">> {
  const mkErr = (message: string) => err({ descriptor: desc, message });

  switch (desc.kind) {
    case "add-thing":
      return ok({
        kind: "add-thing",
        opdId,
        thing: {
          name: desc.name,
          kind: desc.thingKind,                   // thingKind → kind mapping
          essence: desc.essence ?? "informatical",
          affiliation: desc.affiliation ?? "systemic",
        },
        position: {
          x: 100 + (addThingCount % 4) * 180,
          y: 100 + Math.floor(addThingCount / 4) * 150,
        },
      });

    case "remove-thing": {
      const thing = findThingByName(model, desc.name, nameIndex);
      if (!thing) return mkErr(`Thing not found: "${desc.name}"`);
      return ok({ kind: "remove-thing", thingId: thing.id });
    }

    case "add-states": {
      const thing = findThingByName(model, desc.thingName, nameIndex);
      if (!thing) return mkErr(`Thing not found: "${desc.thingName}"`);
      return ok({
        kind: "add-states",
        thingId: thing.id,
        states: desc.stateNames.map(name => ({
          name, initial: false, final: false, default: false,
        })),
      });
    }

    case "remove-state": {
      const thing = findThingByName(model, desc.thingName, nameIndex);
      if (!thing) return mkErr(`Thing not found: "${desc.thingName}"`);
      const state = findStateByName(model, thing.id, desc.stateName);
      if (!state) return mkErr(`State "${desc.stateName}" not found on thing "${desc.thingName}"`);
      return ok({ kind: "remove-state", stateId: state.id });
    }

    case "add-link": {
      const source = findThingByName(model, desc.sourceName, nameIndex);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName, nameIndex);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const linkData: Omit<Link, "id"> = {
        source: source.id,
        target: target.id,
        type: desc.linkType,
      };
      if (desc.sourceState) {
        const s = findStateByName(model, source.id, desc.sourceState);
        if (!s) return mkErr(`Source state "${desc.sourceState}" not found on "${desc.sourceName}"`);
        linkData.source_state = s.id;
      }
      if (desc.targetState) {
        const s = findStateByName(model, target.id, desc.targetState);
        if (!s) return mkErr(`Target state "${desc.targetState}" not found on "${desc.targetName}"`);
        linkData.target_state = s.id;
      }
      return ok({ kind: "add-link", link: linkData });
    }

    case "remove-link": {
      const source = findThingByName(model, desc.sourceName, nameIndex);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName, nameIndex);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const link = findLinkByEndpoints(model, source.id, target.id, desc.linkType);
      if (!link) return mkErr(`Link not found: ${desc.sourceName} → ${desc.targetName} (${desc.linkType})`);
      return ok({ kind: "remove-link", linkId: link.id });
    }

    case "add-modifier": {
      const source = findThingByName(model, desc.sourceName, nameIndex);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName, nameIndex);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const link = findLinkByEndpoints(model, source.id, target.id, desc.linkType);
      if (!link) return mkErr(`Link not found: ${desc.sourceName} → ${desc.targetName} (${desc.linkType})`);
      return ok({
        kind: "add-modifier",
        modifier: { over: link.id, type: desc.modifierType, negated: desc.negated ?? false },
      });
    }

    case "remove-modifier": {
      const source = findThingByName(model, desc.sourceName, nameIndex);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName, nameIndex);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const link = findLinkByEndpoints(model, source.id, target.id, desc.linkType);
      if (!link) return mkErr(`Link not found: ${desc.sourceName} → ${desc.targetName} (${desc.linkType})`);
      const mod = findModifier(model, link.id, desc.modifierType);
      if (!mod) return mkErr(`Modifier not found: ${desc.modifierType} on ${desc.sourceName} → ${desc.targetName}`);
      return ok({ kind: "remove-modifier", modifierId: mod.id });
    }
  }
}

export function resolve(
  descriptors: NlEditDescriptor[],
  model: Model,
  opdId: string,
): Result<OplEdit[], ResolveError> {
  const edits: OplEdit[] = [];
  let current = model;
  let addThingCount = 0;
  let nameIndex = buildNameIndex(model);

  for (let i = 0; i < descriptors.length; i++) {
    const desc = descriptors[i]!;

    const editResult = resolveOne(desc, current, opdId, addThingCount, nameIndex);
    if (!editResult.ok) return err({ ...editResult.error, index: i });

    const edit = editResult.value;
    edits.push(edit);

    const nextModel = applyOplEdit(current, edit);
    if (!nextModel.ok) return err({
      descriptor: desc, index: i,
      message: `Edit application failed: ${nextModel.error.code}`,
    });
    current = nextModel.value;
    if (desc.kind === "add-thing") addThingCount++;
    nameIndex = buildNameIndex(current);
  }

  return ok(edits);
}
