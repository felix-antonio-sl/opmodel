// packages/core/src/opl.ts
import type { Model, ComputationalObject } from "./types";
import type { InvariantError } from "./result";
import type { Result } from "./result";
import type {
  OplDocument, OplEdit, OplSentence,
  OplThingDeclaration, OplLinkSentence, OplRenderSettings,
} from "./opl-types";
import { ok } from "./result";

export function expose(model: Model, opdId: string): OplDocument {
  const opd = model.opds.get(opdId);
  const opdName = opd?.name ?? opdId;

  const settings = model.settings;
  const renderSettings: OplRenderSettings = {
    essenceVisibility: settings.opl_essence_visibility ?? "all",
    unitsVisibility: settings.opl_units_visibility ?? "always",
    aliasVisibility: settings.opl_alias_visibility ?? false,
    primaryEssence: settings.primary_essence ?? "physical",
  };

  // 1. Collect visible things
  const visibleThings = new Set<string>();
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) visibleThings.add(app.thing);
  }

  // 2. Sort: objects first, then processes; within each group by ID
  const sortedThingIds = [...visibleThings].sort((a, b) => {
    const ta = model.things.get(a);
    const tb = model.things.get(b);
    if (!ta || !tb) return 0;
    if (ta.kind !== tb.kind) return ta.kind === "object" ? -1 : 1;
    return a.localeCompare(b);
  });

  const sentences: OplSentence[] = [];

  // 3. Thing declarations + states + durations
  for (const thingId of sortedThingIds) {
    const thing = model.things.get(thingId);
    if (!thing) continue;

    const declaration: OplThingDeclaration = {
      kind: "thing-declaration",
      thingId,
      name: thing.name,
      thingKind: thing.kind,
      essence: thing.essence,
      affiliation: thing.affiliation,
    };
    if (renderSettings.aliasVisibility && thing.computational && "alias" in thing.computational) {
      declaration.alias = (thing.computational as ComputationalObject).alias;
    }
    sentences.push(declaration);

    // States (sorted by ID)
    const thingStates = [...model.states.values()]
      .filter(s => s.parent === thingId)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (thingStates.length > 0) {
      sentences.push({
        kind: "state-enumeration",
        thingId,
        thingName: thing.name,
        stateIds: thingStates.map(s => s.id),
        stateNames: thingStates.map(s => s.name),
      });
    }

    // Duration
    if (thing.duration) {
      sentences.push({
        kind: "duration",
        thingId,
        thingName: thing.name,
        nominal: thing.duration.nominal,
        unit: thing.duration.unit,
      });
    }
  }

  // 4. Links (both endpoints visible, sorted by ID)
  const sortedLinks = [...model.links.values()]
    .filter(l => visibleThings.has(l.source) && visibleThings.has(l.target))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const link of sortedLinks) {
    const sentence: OplLinkSentence = {
      kind: "link",
      linkId: link.id,
      linkType: link.type,
      sourceId: link.source,
      targetId: link.target,
      sourceName: model.things.get(link.source)?.name ?? link.source,
      targetName: model.things.get(link.target)?.name ?? link.target,
    };
    if (link.source_state) {
      sentence.sourceStateName = model.states.get(link.source_state)?.name;
    }
    if (link.target_state) {
      sentence.targetStateName = model.states.get(link.target_state)?.name;
    }
    if (link.tag) {
      sentence.tag = link.tag;
    }
    sentences.push(sentence);
  }

  // 5. Modifiers (sorted by ID)
  const sortedModifiers = [...model.modifiers.values()]
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const mod of sortedModifiers) {
    const link = model.links.get(mod.over);
    if (!link || !visibleThings.has(link.source) || !visibleThings.has(link.target)) continue;
    sentences.push({
      kind: "modifier",
      modifierId: mod.id,
      linkId: mod.over,
      linkType: link.type,
      sourceName: model.things.get(link.source)?.name ?? link.source,
      targetName: model.things.get(link.target)?.name ?? link.target,
      modifierType: mod.type,
      negated: mod.negated ?? false,
    });
  }

  return { opdId, opdName, sentences, renderSettings };
}

// === render ===

function aOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function renderLinkSentence(s: OplLinkSentence): string {
  switch (s.linkType) {
    case "agent": return `${s.sourceName} handles ${s.targetName}.`;
    case "instrument": return `${s.sourceName} is an instrument of ${s.targetName}.`;
    case "consumption": return `${s.sourceName} consumes ${s.targetName}.`;
    case "effect": {
      if (s.sourceStateName && s.targetStateName) {
        return `${s.sourceName} affects ${s.targetName}, from ${s.sourceStateName} to ${s.targetStateName}.`;
      }
      return `${s.sourceName} affects ${s.targetName}.`;
    }
    case "result": return `${s.sourceName} yields ${s.targetName}.`;
    case "input": return `${s.sourceName} requires ${s.targetName}.`;
    case "output": return `${s.sourceName} outputs ${s.targetName}.`;
    case "aggregation": return `${s.sourceName} consists of ${s.targetName}.`;
    case "exhibition": return `${s.sourceName} exhibits ${s.targetName}.`;
    case "generalization": return `${s.targetName} is a ${s.sourceName}.`;
    case "classification": return `${s.targetName} is classified by ${s.sourceName}.`;
    case "invocation": return `${s.sourceName} invokes ${s.targetName}.`;
    case "exception": return `${s.sourceName} handles exception from ${s.targetName}.`;
    case "tagged": return `${s.sourceName} ${s.tag ?? "relates to"} ${s.targetName}.`;
    default: return `${s.sourceName} --[${s.linkType}]--> ${s.targetName}.`;
  }
}

function renderSentence(s: OplSentence, settings: OplRenderSettings): string {
  switch (s.kind) {
    case "thing-declaration": {
      let text = `${s.name} is ${aOrAn(s.thingKind)}`;
      if (settings.essenceVisibility === "all" ||
          (settings.essenceVisibility === "non_default" && s.essence !== settings.primaryEssence)) {
        text += `, ${s.essence}`;
      }
      text += `, ${s.affiliation}`;
      if (s.alias && settings.aliasVisibility) {
        text += ` (alias: ${s.alias})`;
      }
      return text + ".";
    }
    case "state-enumeration": {
      if (s.stateNames.length === 0) return "";
      if (s.stateNames.length === 1) return `${s.thingName} can be ${s.stateNames[0]}.`;
      const last = s.stateNames[s.stateNames.length - 1];
      const rest = s.stateNames.slice(0, -1);
      return `${s.thingName} can be ${rest.join(", ")} or ${last}.`;
    }
    case "duration": {
      if (settings.unitsVisibility === "hide") {
        return `${s.thingName} requires ${s.nominal}.`;
      }
      return `${s.thingName} requires ${s.nominal}${s.unit}.`;
    }
    case "link":
      return renderLinkSentence(s);
    case "modifier": {
      const neg = s.negated ? "negated " : "";
      return `${s.linkType} link from ${s.sourceName} to ${s.targetName} has ${neg}${s.modifierType} modifier.`;
    }
  }
}

export function render(doc: OplDocument): string {
  if (doc.sentences.length === 0) return "";
  return doc.sentences
    .map(s => renderSentence(s, doc.renderSettings))
    .filter(Boolean)
    .join("\n");
}

// === stubs for Task 3 ===

export function applyOplEdit(_model: Model, _edit: OplEdit): Result<Model, InvariantError> {
  throw new Error("Not implemented");
}

export function oplSlug(_name: string): string {
  throw new Error("Not implemented");
}

export function editsFrom(_doc: OplDocument): OplEdit[] {
  throw new Error("Not implemented");
}
