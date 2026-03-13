import { ok, err, type Result, type Model, type OplEdit, type Link, applyOplEdit } from "@opmodel/core";
import type { NlEditDescriptor, ResolveError } from "./types";

// O(n) linear scan — acceptable for typical model sizes (<500 things)
function findThingByName(model: Model, name: string) {
  const lower = name.toLowerCase();
  return [...model.things.values()].find(t => t.name.toLowerCase() === lower);
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

function resolveOne(
  desc: NlEditDescriptor,
  model: Model,
  opdId: string,
  addThingCount: number,
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
        position: { x: 100 + addThingCount * 150, y: 100 },
      });

    case "remove-thing": {
      const thing = findThingByName(model, desc.name);
      if (!thing) return mkErr(`Thing not found: "${desc.name}"`);
      return ok({ kind: "remove-thing", thingId: thing.id });
    }

    case "add-states": {
      const thing = findThingByName(model, desc.thingName);
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
      const thing = findThingByName(model, desc.thingName);
      if (!thing) return mkErr(`Thing not found: "${desc.thingName}"`);
      const state = findStateByName(model, thing.id, desc.stateName);
      if (!state) return mkErr(`State "${desc.stateName}" not found on thing "${desc.thingName}"`);
      return ok({ kind: "remove-state", stateId: state.id });
    }

    case "add-link": {
      const source = findThingByName(model, desc.sourceName);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName);
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
      const source = findThingByName(model, desc.sourceName);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const link = findLinkByEndpoints(model, source.id, target.id, desc.linkType);
      if (!link) return mkErr(`Link not found: ${desc.sourceName} → ${desc.targetName} (${desc.linkType})`);
      return ok({ kind: "remove-link", linkId: link.id });
    }

    case "add-modifier": {
      const source = findThingByName(model, desc.sourceName);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName);
      if (!target) return mkErr(`Target thing not found: "${desc.targetName}"`);
      const link = findLinkByEndpoints(model, source.id, target.id, desc.linkType);
      if (!link) return mkErr(`Link not found: ${desc.sourceName} → ${desc.targetName} (${desc.linkType})`);
      return ok({
        kind: "add-modifier",
        modifier: { over: link.id, type: desc.modifierType, negated: desc.negated ?? false },
      });
    }

    case "remove-modifier": {
      const source = findThingByName(model, desc.sourceName);
      if (!source) return mkErr(`Source thing not found: "${desc.sourceName}"`);
      const target = findThingByName(model, desc.targetName);
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

  for (let i = 0; i < descriptors.length; i++) {
    const desc = descriptors[i]!;

    const editResult = resolveOne(desc, current, opdId, addThingCount);
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
  }

  return ok(edits);
}
