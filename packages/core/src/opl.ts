// packages/core/src/opl.ts
import type { Model, ComputationalObject, Thing, State, Link, Modifier, Appearance } from "./types";
import type { InvariantError, Result } from "./result";
import type {
  OplDocument, OplEdit, OplSentence,
  OplThingDeclaration, OplLinkSentence, OplModifierSentence, OplRenderSettings,
  OplStateDescription, OplGroupedStructuralSentence, OplInZoomSequence, OplAttributeValue,
  OplFanSentence,
} from "./opl-types";
import { ok, err, isOk } from "./result";
import { STRUCTURAL_TYPES, structuralParentEnd } from "./structural";
import { collectAllIds } from "./helpers";
import {
  addThing, removeThing, addState, removeState,
  addLink, removeLink, addModifier, removeModifier,
  addAppearance,
} from "./api";

export function expose(model: Model, opdId: string): OplDocument {
  const opd = model.opds.get(opdId);
  const opdName = opd?.name ?? opdId;
  const containerThingId = opd?.refines;

  const settings = model.settings;
  const renderSettings: OplRenderSettings = {
    essenceVisibility: settings.opl_essence_visibility ?? "all",
    unitsVisibility: settings.opl_units_visibility ?? "always",
    aliasVisibility: settings.opl_alias_visibility ?? false,
    primaryEssence: settings.primary_essence ?? "informatical",
  };

  // 1. Collect visible things
  const visibleThings = new Set<string>();
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) visibleThings.add(app.thing);
  }

  // Build exhibition feature lookup: featureId → exhibitorName
  // Build exhibitorOf: maps feature → exhibitor for "X of Y" declarations.
  // Uses centralized structuralParentEnd for convention detection.
  const exhibitorOf = new Map<string, { id: string; name: string }>();
  const exhParentEnd = structuralParentEnd(model.links.values(), "exhibition");
  for (const link of model.links.values()) {
    if (link.type !== "exhibition") continue;
    if (!visibleThings.has(link.source) || !visibleThings.has(link.target)) continue;
    const exhibitorId = exhParentEnd === "source" ? link.source : link.target;
    const featureId = exhParentEnd === "source" ? link.target : link.source;
    const exhibitor = model.things.get(exhibitorId);
    if (exhibitor && !exhibitorOf.has(featureId)) {
      exhibitorOf.set(featureId, { id: exhibitorId, name: exhibitor.name });
    }
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

  // In-zoom sequence sentence — ISO §14.2.1.3
  if (containerThingId) {
    const containerThing = model.things.get(containerThingId);
    if (containerThing) {
      const subprocessApps: Array<{ thingId: string; name: string; y: number }> = [];
      for (const app of model.appearances.values()) {
        if (app.opd !== opdId) continue;
        if (app.thing === containerThingId) continue;
        if (!app.internal) continue;
        const thing = model.things.get(app.thing);
        if (thing?.kind === "process") {
          subprocessApps.push({ thingId: thing.id, name: thing.name, y: app.y });
        }
      }
      subprocessApps.sort((a, b) => a.y - b.y || a.thingId.localeCompare(b.thingId));

      if (subprocessApps.length > 0) {
        sentences.push({
          kind: "in-zoom-sequence",
          parentId: containerThingId,
          parentName: containerThing.name,
          steps: subprocessApps.map(sp => ({
            thingIds: [sp.thingId],
            thingNames: [sp.name],
            parallel: false,
          })),
        } as OplInZoomSequence);
      }
    }
  }

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
    const exhibitor = exhibitorOf.get(thingId);
    if (exhibitor) {
      declaration.exhibitorName = exhibitor.name;
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
        exhibitorName: exhibitorOf.get(thingId)?.name,
      });
    }

    // State descriptions (initial/final/default markers) — ISO §A.4.4.4
    for (const st of thingStates) {
      if (st.initial || st.final || st.default) {
        sentences.push({
          kind: "state-description",
          thingId,
          thingName: thing.name,
          stateId: st.id,
          stateName: st.name,
          initial: st.initial,
          final: st.final,
          default: st.default,
          exhibitorName: exhibitorOf.get(thingId)?.name,
        } as OplStateDescription);
      }
    }

    // Attribute value — ISO §10.3.3.2.2: "Feature of Exhibitor is value."
    const exh = exhibitorOf.get(thingId);
    if (exh) {
      const defaultState = thingStates.find(s => s.default);
      if (defaultState) {
        sentences.push({
          kind: "attribute-value",
          thingId,
          thingName: thing.name,
          exhibitorId: exh.id,
          exhibitorName: exh.name,
          valueName: defaultState.name,
        } as OplAttributeValue);
      }
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
  let sortedLinks = [...model.links.values()]
    .filter(l => visibleThings.has(l.source) && visibleThings.has(l.target))
    .sort((a, b) => a.id.localeCompare(b.id));

  // In refinement OPDs, filter parent-level procedural links (ISO: distributive semantics).
  // Keep structural links to container — they ARE the content of unfold/object in-zoom.
  if (containerThingId) {
    const internalThings = new Set<string>();
    for (const app of model.appearances.values()) {
      if (app.opd === opdId && app.internal === true) internalThings.add(app.thing);
    }
    sortedLinks = sortedLinks.filter(l => {
      const isStructural = STRUCTURAL_TYPES.has(l.type);
      const touchesContainer = l.source === containerThingId || l.target === containerThingId;
      if (touchesContainer && !isStructural) return false;
      if (!touchesContainer && !internalThings.has(l.source) && !internalThings.has(l.target)) return false;
      return true;
    });
  }

  // Separate structural links for grouping (GAP-OPL-04)
  const structuralLinks: Link[] = [];
  const nonStructuralLinks: Link[] = [];
  for (const link of sortedLinks) {
    if (STRUCTURAL_TYPES.has(link.type)) {
      structuralLinks.push(link);
    } else {
      nonStructuralLinks.push(link);
    }
  }

  // Group structural links by (parentId, linkType) using centralized convention detection.
  const structuralByType = new Map<string, { parentEnd: "source" | "target"; links: Link[] }>();
  for (const type of STRUCTURAL_TYPES) {
    const typeLinks = structuralLinks.filter(l => l.type === type);
    if (typeLinks.length === 0) continue;
    structuralByType.set(type, {
      parentEnd: structuralParentEnd(model.links.values(), type),
      links: typeLinks,
    });
  }

  // Build groups by parent
  const structuralGroups = new Map<string, { parentId: string; linkType: string; links: Link[]; parentIsSource: boolean }>();
  for (const [type, { parentEnd, links: typeLinks }] of structuralByType) {
    for (const link of typeLinks) {
      const parentId = parentEnd === "source" ? link.source : link.target;
      const key = `${parentId}::${type}`;
      if (!structuralGroups.has(key)) {
        structuralGroups.set(key, { parentId, linkType: type, links: [], parentIsSource: parentEnd === "source" });
      }
      structuralGroups.get(key)!.links.push(link);
    }
  }

  for (const group of structuralGroups.values()) {
    const parent = model.things.get(group.parentId);
    if (!parent) continue;
    const childIds = group.links.map(l => group.parentIsSource ? l.target : l.source);
    const childNames = childIds.map(id => model.things.get(id)?.name ?? id);
    const childKinds = childIds.map(id => model.things.get(id)?.kind ?? "object" as const);
    const childMultiplicities = group.links.map(l =>
      group.parentIsSource ? l.multiplicity_target : l.multiplicity_source
    );
    sentences.push({
      kind: "grouped-structural",
      linkType: group.linkType,
      parentId: group.parentId,
      parentName: parent.name,
      parentKind: parent.kind,
      childIds,
      childNames,
      childKinds,
      childMultiplicities,
      incomplete: group.links.some(l => l.incomplete),
    } as OplGroupedStructuralSentence);
  }

  // Build set of link IDs that are members of XOR/OR fans (suppressed from individual rendering)
  const fanSuppressed = new Set<string>();
  const nonStructuralLinkIds = new Set(nonStructuralLinks.map(l => l.id));
  for (const fan of model.fans.values()) {
    if (fan.type === "and") continue; // AND = default behavior, no suppression
    const allVisible = fan.members.every(mid => nonStructuralLinkIds.has(mid));
    if (!allVisible) continue;
    for (const mid of fan.members) fanSuppressed.add(mid);

    // Determine direction: shared source → diverging, shared target → converging
    const memberLinks = fan.members.map(mid => model.links.get(mid)!);
    const allSameSource = memberLinks.every(l => l.source === memberLinks[0]!.source);
    const allSameTarget = memberLinks.every(l => l.target === memberLinks[0]!.target);
    const direction = fan.direction ?? (allSameSource ? "diverging" : "converging");

    // Shared endpoint and member endpoints
    const firstLink = memberLinks[0]!;
    const sharedId = direction === "converging" ? firstLink.target : firstLink.source;
    const memberIds = direction === "converging"
      ? memberLinks.map(l => l.source)
      : memberLinks.map(l => l.target);

    // For consumption/agent/instrument the naming convention differs:
    // consumption: source=object, target=process — converging means shared=process, members=objects
    // For enabling (agent/instrument): source=object, target=process — same pattern
    // For others (effect/result/invocation): source=process, target=object — converging means shared=object, members=processes

    const memberNames = memberIds.map(id => model.things.get(id)?.name ?? id);

    // State qualifiers per member
    const memberSourceStateNames = memberLinks.map(l =>
      l.source_state ? model.states.get(l.source_state)?.name : undefined
    );
    const memberTargetStateNames = memberLinks.map(l =>
      l.target_state ? model.states.get(l.target_state)?.name : undefined
    );

    const fanSentence: OplFanSentence = {
      kind: "fan",
      fanId: fan.id,
      fanType: fan.type,
      direction,
      linkType: firstLink.type,
      sharedEndpointName: model.things.get(sharedId)?.name ?? sharedId,
      memberNames,
      memberSourceStateNames,
      memberTargetStateNames,
    };
    sentences.push(fanSentence);
  }

  // Non-structural links: emit individually (skip fan-suppressed)
  for (const link of nonStructuralLinks) {
    if (fanSuppressed.has(link.id)) continue;
    const sentence: OplLinkSentence = {
      kind: "link",
      linkId: link.id,
      linkType: link.type,
      sourceId: link.source,
      targetId: link.target,
      sourceName: model.things.get(link.source)?.name ?? link.source,
      targetName: model.things.get(link.target)?.name ?? link.target,
      sourceKind: model.things.get(link.source)?.kind,
      targetKind: model.things.get(link.target)?.kind,
      incomplete: link.incomplete ?? false,
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
    if (link.direction) {
      sentence.direction = link.direction;
    }
    if (link.multiplicity_source) {
      sentence.multiplicitySource = link.multiplicity_source;
    }
    if (link.multiplicity_target) {
      sentence.multiplicityTarget = link.multiplicity_target;
    }
    sentences.push(sentence);
  }

  // 5. Modifiers (sorted by ID)
  const sortedModifiers = [...model.modifiers.values()]
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const mod of sortedModifiers) {
    const link = model.links.get(mod.over);
    if (!link || !visibleThings.has(link.source) || !visibleThings.has(link.target)) continue;
    const sourceState = link.source_state ? model.states.get(link.source_state) : undefined;
    const targetState = link.target_state ? model.states.get(link.target_state) : undefined;
    sentences.push({
      kind: "modifier",
      modifierId: mod.id,
      linkId: mod.over,
      linkType: link.type,
      sourceName: model.things.get(link.source)?.name ?? link.source,
      targetName: model.things.get(link.target)?.name ?? link.target,
      modifierType: mod.type,
      negated: mod.negated ?? false,
      conditionMode: mod.type === "condition" ? (mod.condition_mode ?? "wait") : undefined,
      sourceStateName: sourceState?.name,
      targetStateName: targetState?.name,
    });
  }

  return { opdId, opdName, sentences, renderSettings };
}

// === render ===

function aOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function formatList(names: string[], incomplete?: boolean, incompletePhrase?: string): string {
  if (names.length === 0) return "";
  if (names.length === 1) {
    return incomplete && incompletePhrase ? `${names[0]} and ${incompletePhrase}` : names[0]!;
  }
  if (names.length === 2) {
    if (incomplete && incompletePhrase) {
      return `${names[0]}, ${names[1]}, and ${incompletePhrase}`;
    }
    return `${names[0]} and ${names[1]}`;
  }
  const last = names[names.length - 1]!;
  const rest = names.slice(0, -1);
  if (incomplete && incompletePhrase) {
    return `${rest.join(", ")}, ${last}, and ${incompletePhrase}`;
  }
  return `${rest.join(", ")}, and ${last}`;
}

// STRUCTURAL_TYPES imported from ./structural

const INCOMPLETE_PHRASES: Record<string, string> = {
  aggregation: "at least one other part",
  exhibition: "at least one other feature",
  generalization: "at least one other specialization",
  classification: "at least one other instance",
};

/** Convert ISO 19450 multiplicity symbol to OPL phrase. Returns null for default (1). */
function multiplicityPhrase(mult: string | undefined): string | null {
  if (!mult || mult === "1") return null;
  switch (mult) {
    case "?": return "an optional";
    case "*": return "zero or more";
    case "+": return "at least one";
    default: {
      const match = mult.match(/^(\d+)\.\.(\d+|\*)$/);
      if (match) {
        const [, min, max] = match;
        if (max === "*") return `${min} or more`;
        return `${min} to ${max}`;
      }
      return mult; // fallback: raw value
    }
  }
}

/** Apply multiplicity phrase to a name: "at least one Wheel" or just "Wheel" */
function withMultiplicity(name: string, mult: string | undefined): string {
  const phrase = multiplicityPhrase(mult);
  return phrase ? `${phrase} ${name}` : name;
}

function renderLinkSentence(s: OplLinkSentence): string {
  const processName = s.sourceName; // For transforming links, source is process
  const objectName = s.targetName; // For transforming links, target is object
  
  switch (s.linkType) {
    case "agent": {
      // State-specified agent: "S Agent handles Process"
      if (s.sourceStateName) {
        return `${s.sourceStateName} ${s.sourceName} handles ${s.targetName}.`;
      }
      return `${s.sourceName} handles ${s.targetName}.`;
    }
    case "instrument": {
      // State-specified instrument: "Process requires S Instrument"
      if (s.sourceStateName) {
        return `${s.targetName} requires ${s.sourceStateName} ${s.sourceName}.`;
      }
      return `${s.targetName} requires ${s.sourceName}.`;
    }
    case "consumption": {
      // consumption: source=object, target=process (ISO direction)
      // OPL: "Process consumes [State] Object" → target consumes source
      if (s.sourceStateName) {
        return `${s.targetName} consumes ${s.sourceStateName} ${s.sourceName}.`;
      }
      return `${s.targetName} consumes ${withMultiplicity(s.sourceName, s.multiplicitySource)}.`;
    }
    case "effect": {
      // State-specified effect (ISO 19450 9.3.3)
      if (s.sourceStateName && s.targetStateName) {
        // Input-output-specified: "Process changes Object from input-state to output-state"
        return `${processName} changes ${objectName} from ${s.sourceStateName} to ${s.targetStateName}.`;
      }
      if (s.sourceStateName && !s.targetStateName) {
        // Input-specified: "Process changes Object from input-state"
        return `${processName} changes ${objectName} from ${s.sourceStateName}.`;
      }
      if (!s.sourceStateName && s.targetStateName) {
        // Output-specified: "Process changes Object to output-state"
        return `${processName} changes ${objectName} to ${s.targetStateName}.`;
      }
      // Basic effect
      return `${s.sourceName} affects ${s.targetName}.`;
    }
    case "result": {
      // State-specified result: "Process yields S Object"
      if (s.targetStateName) {
        return `${s.sourceName} yields ${s.targetStateName} ${s.targetName}.`;
      }
      return `${s.sourceName} yields ${s.targetName}.`;
    }
    case "input": return `${processName} changes ${objectName} from ${s.sourceStateName ?? "unspecified state"}.`;
    case "output": return `${processName} changes ${objectName} to ${s.targetStateName ?? "unspecified state"}.`;
    case "aggregation": {
      // aggregation: source=whole, target=part. Multiplicity on target = part count.
      const partName = withMultiplicity(s.targetName, s.multiplicityTarget);
      if (s.incomplete) {
        return `${s.sourceName} consists of ${partName} and at least one other part.`;
      }
      return `${s.sourceName} consists of ${partName}.`;
    }
    case "exhibition": {
      // Invariant: source=Exhibitor (parent), target=Feature (child)
      // OPL: "Exhibitor exhibits Feature."
      const featureName = withMultiplicity(s.targetName, s.multiplicityTarget);
      if (s.incomplete) {
        return `${s.sourceName} exhibits ${featureName} and at least one other feature.`;
      }
      return `${s.sourceName} exhibits ${featureName}.`;
    }
    case "generalization": {
      if (s.incomplete) {
        return `${s.sourceName}, ${s.targetName} and other specializations are general.`;
      }
      // ISO: objects use article ("B is a/an A"), processes omit article ("B is A")
      if (s.targetKind === "object") {
        return `${s.targetName} is ${aOrAn(s.sourceName)}.`;
      }
      return `${s.targetName} is ${s.sourceName}.`;
    }
    case "classification": return `${s.targetName} is an instance of ${s.sourceName}.`;
    case "invocation": return `${s.sourceName} invokes ${s.targetName}.`;
    case "exception": return `${s.sourceName} handles exception from ${s.targetName}.`;
    case "tagged": {
      // ISO §10.2.2: null-tagged defaults — "relates to" (uni/bi), "are related" (reciprocal)
      const defaultTag = s.direction === "reciprocal" ? "are related" : "relates to";
      const tag = s.tag ?? defaultTag;
      return s.direction === "bidirectional"
        ? `${s.sourceName} ${tag} ${s.targetName} and vice versa.`
        : s.direction === "reciprocal"
          ? `${s.sourceName} and ${s.targetName} ${tag}.`
          : `${s.sourceName} ${tag} ${s.targetName}.`;
    }
    default: return `${s.sourceName} --[${s.linkType}]--> ${s.targetName}.`;
  }
}

function renderModifierSentence(s: OplModifierSentence): string {
  // Determine process/object names based on link direction convention:
  // Enabling links (agent, instrument): source=object, target=process
  // Consumption (ISO): source=object, target=process
  // Other transforming (effect, result): source=process, target=object
  const isEnabling = ["agent", "instrument"].includes(s.linkType);
  const isConsumption = s.linkType === "consumption";
  // For enabling and consumption: source=object, target=process
  // For other transforming (effect, result): source=process, target=object
  const objectIsSource = isEnabling || isConsumption;
  const processName = objectIsSource ? s.targetName : s.sourceName;
  const objectName = objectIsSource ? s.sourceName : s.targetName;
  const stateName = objectIsSource ? s.sourceStateName : s.targetStateName;

  if (s.modifierType === "event") {
    if (s.negated && stateName) {
      return `non-${stateName} ${objectName} triggers ${processName}.`;
    }
    if (s.negated) {
      return `absence of ${objectName} triggers ${processName}.`;
    }
    if (stateName) {
      return `${stateName} ${objectName} triggers ${processName}.`;
    }
    return `${objectName} triggers ${processName}.`;
  }

  if (s.modifierType === "condition") {
    const mode = s.conditionMode ?? "wait";

    if (mode === "wait") {
      if (s.negated && stateName) {
        return `${processName} requires ${objectName} not to be ${stateName}.`;
      }
      if (s.negated) {
        return `${processName} requires ${objectName} not to exist.`;
      }
      if (stateName) {
        return `${processName} requires ${stateName} ${objectName}.`;
      }
      return `${processName} requires ${objectName}.`;
    }

    if (mode === "skip") {
      if (s.negated && stateName) {
        return `${processName} occurs if ${objectName} is not ${stateName}, otherwise ${processName} is skipped.`;
      }
      if (s.negated) {
        return `${processName} occurs if ${objectName} does not exist, otherwise ${processName} is skipped.`;
      }
      if (stateName) {
        return `${processName} occurs if ${objectName} is ${stateName}, otherwise ${processName} is skipped.`;
      }
      return `${processName} occurs if ${objectName} exists, otherwise ${processName} is skipped.`;
    }
  }

  // Fallback
  const neg = s.negated ? "negated " : "";
  return `${s.linkType} link from ${s.sourceName} to ${s.targetName} has ${neg}${s.modifierType} modifier.`;
}

function renderGroupedStructural(s: OplGroupedStructuralSentence): string {
  const phrase = INCOMPLETE_PHRASES[s.linkType] ?? "at least one other";

  switch (s.linkType) {
    case "aggregation": {
      const qualifiedNames = s.childNames.map((name, i) =>
        withMultiplicity(name, s.childMultiplicities?.[i])
      );
      return `${s.parentName} consists of ${formatList(qualifiedNames, s.incomplete, phrase)}.`;
    }

    case "exhibition": {
      const qualifiedNames = s.childNames.map((name, i) =>
        withMultiplicity(name, s.childMultiplicities?.[i])
      );
      const attrs = qualifiedNames.filter((_, i) => s.childKinds[i] === "object");
      const ops = qualifiedNames.filter((_, i) => s.childKinds[i] === "process");
      const isObjectExhibitor = s.parentKind === "object";
      const first = isObjectExhibitor ? attrs : ops;
      const second = isObjectExhibitor ? ops : attrs;
      if (first.length === 0 && second.length === 0) {
        return `${s.parentName} exhibits ${formatList(qualifiedNames, s.incomplete, phrase)}.`;
      }
      if (first.length > 0 && second.length > 0) {
        return `${s.parentName} exhibits ${formatList(first)}, as well as ${formatList(second)}.`;
      }
      // Only one kind present
      const combined = first.length > 0 ? first : second;
      return `${s.parentName} exhibits ${formatList(combined, s.incomplete, phrase)}.`;
    }

    case "generalization": {
      const list = formatList(s.childNames, s.incomplete, phrase);
      if (s.childNames.length === 1 && !s.incomplete) {
        // Single specialization (complete): "Spec is a/an General." (objects) / "Spec is General." (processes)
        if (s.parentKind === "object") {
          return `${s.childNames[0]} is ${aOrAn(s.parentName)}.`;
        }
        return `${s.childNames[0]} is ${s.parentName}.`;
      }
      // Multiple specializations or incomplete: use "are"
      if (s.parentKind === "object") {
        return `${list} are ${aOrAn(s.parentName)}.`;
      }
      return `${list} are ${s.parentName}.`;
    }

    case "classification": {
      const list = formatList(s.childNames, s.incomplete, phrase);
      if (s.childNames.length === 1) {
        return `${s.childNames[0]} is an instance of ${s.parentName}.`;
      }
      return `${list} are instances of ${s.parentName}.`;
    }

    default:
      return "";
  }
}

function formatFanList(names: string[], stateNames?: (string | undefined)[]): string {
  const qualified = names.map((name, i) => {
    const st = stateNames?.[i];
    return st ? `${st} ${name}` : name;
  });
  if (qualified.length === 1) return qualified[0]!;
  if (qualified.length === 2) return `${qualified[0]} or ${qualified[1]}`;
  const last = qualified[qualified.length - 1]!;
  const rest = qualified.slice(0, -1);
  return `${rest.join(", ")}, or ${last}`;
}

function renderFanSentence(s: OplFanSentence): string {
  const quantifier = s.fanType === "xor" ? "exactly one of" : "at least one of";
  const list = formatFanList(
    s.memberNames,
    // For converging fans, member = source side → use source state names
    // For diverging fans, member = target side → use target state names
    s.direction === "converging" ? s.memberSourceStateNames : s.memberTargetStateNames,
  );

  // Converging: shared endpoint is the process/object all links point TO
  // "SharedName VERB quantifier list."
  // Diverging: shared endpoint is the thing all links come FROM
  // "quantifier list VERB SharedName."  (capitalized quantifier)

  switch (s.linkType) {
    case "consumption":
      // consumption: source=object, target=process
      // converging (shared=process, members=objects): "Process consumes quantifier A, B, or C."
      // diverging (shared=object, members=processes): "Quantifier P, Q, or R consumes Object."
      if (s.direction === "converging") {
        return `${s.sharedEndpointName} consumes ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} consumes ${s.sharedEndpointName}.`;

    case "result":
      // result: source=process, target=object
      // diverging (shared=process, members=objects): "Process yields quantifier A, B, or C."
      // converging (shared=object, members=processes): "Quantifier P, Q, or R yields Object."
      if (s.direction === "diverging") {
        return `${s.sharedEndpointName} yields ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} yields ${s.sharedEndpointName}.`;

    case "effect":
      // effect: source=process, target=object
      // diverging (shared=process, members=objects): "Process affects quantifier A, B, or C."
      // converging (shared=object, members=processes): "Quantifier P, Q, or R affects Object."
      if (s.direction === "diverging") {
        return `${s.sharedEndpointName} affects ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} affects ${s.sharedEndpointName}.`;

    case "agent":
      // agent: source=object, target=process
      // converging (shared=process, members=objects): "Quantifier A, B, or C handles Process."
      // diverging (shared=object, members=processes): "Object handles quantifier P, Q, or R."
      if (s.direction === "converging") {
        return `${capitalize(quantifier)} ${list} handles ${s.sharedEndpointName}.`;
      }
      return `${s.sharedEndpointName} handles ${quantifier} ${list}.`;

    case "instrument":
      // instrument: source=object, target=process
      // converging (shared=process, members=objects): "Process requires quantifier A, B, or C."
      // diverging (shared=object, members=processes): "Quantifier P, Q, or R requires Object."
      if (s.direction === "converging") {
        return `${s.sharedEndpointName} requires ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} requires ${s.sharedEndpointName}.`;

    case "invocation":
      // invocation: source=invoker, target=invoked
      // diverging (shared=invoker, members=invoked): "Process invokes quantifier Q, R."
      // converging (shared=invoked, members=invokers): "Quantifier P, Q invokes Process."
      if (s.direction === "diverging") {
        return `${s.sharedEndpointName} invokes ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} invokes ${s.sharedEndpointName}.`;

    default:
      return `${s.sharedEndpointName} links to ${quantifier} ${list}.`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderSentence(s: OplSentence, settings: OplRenderSettings): string {
  switch (s.kind) {
    case "thing-declaration": {
      const displayName = s.exhibitorName ? `${s.name} of ${s.exhibitorName}` : s.name;
      let text = `${displayName} is ${aOrAn(s.thingKind)}`;
      if (settings.essenceVisibility === "all" ||
          (settings.essenceVisibility === "non_default" && s.essence !== settings.primaryEssence)) {
        text += `, ${s.essence}`;
      }
      if (s.affiliation !== "systemic") {
        text += `, ${s.affiliation}`;
      }
      if (s.alias && settings.aliasVisibility) {
        text += ` (alias: ${s.alias})`;
      }
      return text + ".";
    }
    case "state-enumeration": {
      const displayName = s.exhibitorName ? `${s.thingName} of ${s.exhibitorName}` : s.thingName;
      if (s.stateNames.length === 0) return "";
      if (s.stateNames.length === 1) return `${displayName} can be ${s.stateNames[0]}.`;
      const last = s.stateNames[s.stateNames.length - 1];
      const rest = s.stateNames.slice(0, -1);
      return `${displayName} can be ${rest.join(", ")} or ${last}.`;
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
      return renderModifierSentence(s);
    }
    case "state-description": {
      const qualifiers: string[] = [];
      if (s.initial) qualifiers.push("initial");
      if (s.final) qualifiers.push("final");
      if (s.default) qualifiers.push("default");
      const thingDisplay = s.exhibitorName
        ? `${s.thingName} of ${s.exhibitorName}`
        : s.thingName;
      return `State ${s.stateName} of ${thingDisplay} is ${qualifiers.join(" and ")}.`;
    }
    case "attribute-value":
      return `${s.thingName} of ${s.exhibitorName} is ${s.valueName}.`;
    case "grouped-structural":
      return renderGroupedStructural(s);
    case "fan":
      return renderFanSentence(s);
    case "in-zoom-sequence": {
      const allNames = s.steps.flatMap(step =>
        step.parallel
          ? [`parallel ${formatList(step.thingNames)}`]
          : step.thingNames
      );
      const list = formatList(allNames);
      if (s.steps.length === 1 && s.steps[0]!.thingNames.length === 1) {
        return `${s.parentName} zooms into ${list}.`;
      }
      return `${s.parentName} zooms into ${list}, in that sequence.`;
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

// === OPL Slug & ID generation ===

export function oplSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueId(base: string, model: Model): string {
  const allIds = collectAllIds(model);
  if (!allIds.has(base)) return base;
  let i = 2;
  while (allIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// === applyOplEdit ===

export function applyOplEdit(model: Model, edit: OplEdit): Result<Model, InvariantError> {
  switch (edit.kind) {
    case "add-thing": {
      if (!model.opds.has(edit.opdId)) {
        return err({ code: "NOT_FOUND", message: `OPD not found: ${edit.opdId}`, entity: edit.opdId });
      }
      const prefix = edit.thing.kind === "object" ? "obj" : "proc";
      const id = uniqueId(`${prefix}-${oplSlug(edit.thing.name)}`, model);
      const thing: Thing = { id, ...edit.thing };
      const r1 = addThing(model, thing);
      if (!isOk(r1)) return r1;
      const appearance: Appearance = {
        thing: id, opd: edit.opdId,
        x: edit.position.x, y: edit.position.y,
        w: 120, h: 60,
      };
      return addAppearance(r1.value, appearance);
    }
    case "remove-thing":
      return removeThing(model, edit.thingId);
    case "add-states": {
      let current = model;
      for (const stateData of edit.states) {
        const id = uniqueId(`state-${oplSlug(stateData.name)}`, current);
        const state: State = { id, parent: edit.thingId, ...stateData };
        const r = addState(current, state);
        if (!isOk(r)) return r;
        current = r.value;
      }
      return ok(current);
    }
    case "remove-state":
      return removeState(model, edit.stateId);
    case "add-link": {
      const sourceName = model.things.get(edit.link.source)?.name ?? edit.link.source;
      const targetName = model.things.get(edit.link.target)?.name ?? edit.link.target;
      const id = uniqueId(`lnk-${oplSlug(sourceName)}-${edit.link.type}-${oplSlug(targetName)}`, model);
      const link: Link = { id, ...edit.link };
      return addLink(model, link);
    }
    case "remove-link":
      return removeLink(model, edit.linkId);
    case "add-modifier": {
      const id = uniqueId(`mod-${oplSlug(edit.modifier.over)}-${edit.modifier.type}`, model);
      const mod: Modifier = { id, ...edit.modifier };
      return addModifier(model, mod);
    }
    case "remove-modifier":
      return removeModifier(model, edit.modifierId);
    default: {
      const _exhaustive: never = edit;
      return err({ code: "UNKNOWN_EDIT", message: `Unknown edit kind`, entity: "" });
    }
  }
}

// === editsFrom ===

export function editsFrom(doc: OplDocument): OplEdit[] {
  // Multi-pass: collect things, enrich with duration, build state lookup, then emit edits
  const thingEdits = new Map<string, OplEdit & { kind: "add-thing" }>();
  const stateEdits: OplEdit[] = [];
  const linkEdits: OplEdit[] = [];
  const modifierEdits: OplEdit[] = [];

  // Build state name -> stateId lookup from state-enumeration sentences
  // Map key: "thingId::stateName" -> stateId
  const stateIdByName = new Map<string, string>();

  for (const s of doc.sentences) {
    if (s.kind === "state-enumeration") {
      for (let i = 0; i < s.stateNames.length; i++) {
        stateIdByName.set(`${s.thingId}::${s.stateNames[i]}`, s.stateIds[i]!);
      }
    }
  }

  // Build state qualifier lookup from state-description sentences
  const stateQualifiers = new Map<string, { initial: boolean; final: boolean; default: boolean }>();
  for (const s of doc.sentences) {
    if (s.kind === "state-description") {
      stateQualifiers.set(`${s.thingId}::${s.stateName}`, {
        initial: s.initial, final: s.final, default: s.default,
      });
    }
  }

  for (const s of doc.sentences) {
    switch (s.kind) {
      case "thing-declaration": {
        const edit = {
          kind: "add-thing" as const,
          opdId: doc.opdId,
          thing: {
            kind: s.thingKind,
            name: s.name,
            essence: s.essence,
            affiliation: s.affiliation,
          } as Omit<Thing, "id">,
          position: { x: 0, y: 0 },
        };
        thingEdits.set(s.thingId, edit);
        break;
      }
      case "duration": {
        // Enrich the corresponding add-thing edit with duration
        const thingEdit = thingEdits.get(s.thingId);
        if (thingEdit) {
          thingEdit.thing = { ...thingEdit.thing, duration: { nominal: s.nominal, unit: s.unit } };
        }
        break;
      }
      case "state-enumeration":
        stateEdits.push({
          kind: "add-states",
          thingId: s.thingId,
          states: s.stateNames.map(name => {
            const q = stateQualifiers.get(`${s.thingId}::${name}`);
            return {
              name,
              initial: q?.initial ?? false,
              final: q?.final ?? false,
              default: q?.default ?? false,
            };
          }),
        });
        break;
      case "link": {
        const linkData: Omit<Link, "id"> = {
          type: s.linkType,
          source: s.sourceId,
          target: s.targetId,
        };
        if (s.sourceStateName) {
          // State may belong to source or target thing (e.g. effect links reference target's states)
          const stateId = stateIdByName.get(`${s.sourceId}::${s.sourceStateName}`)
            ?? stateIdByName.get(`${s.targetId}::${s.sourceStateName}`);
          if (stateId) linkData.source_state = stateId;
        }
        if (s.targetStateName) {
          const stateId = stateIdByName.get(`${s.targetId}::${s.targetStateName}`)
            ?? stateIdByName.get(`${s.sourceId}::${s.targetStateName}`);
          if (stateId) linkData.target_state = stateId;
        }
        if (s.tag) linkData.tag = s.tag;
        linkEdits.push({ kind: "add-link", link: linkData });
        break;
      }
      case "modifier":
        modifierEdits.push({
          kind: "add-modifier",
          modifier: {
            over: s.linkId,
            type: s.modifierType,
            negated: s.negated,
            ...(s.conditionMode ? { condition_mode: s.conditionMode } : {}),
          },
        });
        break;
      case "state-description":
      case "in-zoom-sequence":
      case "attribute-value":
      case "fan":
        break; // Stub — implemented in subsequent tasks
      case "grouped-structural": {
        const directionMap: Record<string, "source" | "target"> = {
          aggregation: "source",
          exhibition: "target",
          generalization: "source",
          classification: "source",
        };
        const parentRole = directionMap[s.linkType] ?? "source";
        for (let i = 0; i < s.childIds.length; i++) {
          const linkData: Omit<Link, "id"> = {
            type: s.linkType,
            source: parentRole === "source" ? s.parentId : s.childIds[i]!,
            target: parentRole === "source" ? s.childIds[i]! : s.parentId,
            incomplete: s.incomplete || undefined,
          };
          linkEdits.push({ kind: "add-link", link: linkData });
        }
        break;
      }
    }
  }

  // Things first, then states, then links, then modifiers (order matters for ID references)
  return [...thingEdits.values(), ...stateEdits, ...linkEdits, ...modifierEdits];
}
