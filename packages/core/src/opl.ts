// packages/core/src/opl.ts
import type { Model, ComputationalObject, Thing, State, Link, Modifier, Appearance } from "./types";
import type { LayoutModel, OpdAtlas, SemanticKernel } from "./semantic-kernel";
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
import { legacyModelFromSemanticKernel } from "./semantic-kernel";

// === OPL-ES Vocabulary (per urn:fxsl:kb:opm-opl-es §2, §15) ===

type OplVocab = {
  isAn: (word: string) => string;  // "is a/an" or "es un/una"
  object: string; process: string;
  physical: string; informatical: string; environmental: string; systemic: string;
  canBe: string; stateOf: string; isInitial: string; isFinal: string; isDefault: string;
  requires: string; consumes: string; yields: string; affects: string; handles: string;
  changes: string; from: string; to: string; and: string; or: string;
  invokes: string; exhibitsWord: string; consistsOf: string; isInstanceOf: string;
  inThatSequence: string; zoomsInto: string; parallel: string;
  refinedBy: string; inZooming: string; unfolding: string;
  triggers: string; handlesException: string; overtimeException: string; undertimeException: string;
  occursIf: string; isState: string; otherwise: string; isSkipped: string;
  notToBe: string; notToExist: string; absenceOf: string;
  // Path labels
  path: string;
  // Meta
  appliesTo: string; linksOnPath: string; scenario: string;
  // Probability
  probability: string;
  // Fan
  exactlyOneOf: string; atLeastOneOf: string;
  // Duration
  requiresDuration: string;
  // Structural incomplete
  atLeastOneOtherPart: string; atLeastOneOtherFeature: string; atLeastOneOtherSpecialization: string;
};

const EN_VOCAB: OplVocab = {
  isAn: (w) => /^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`,
  object: "object", process: "process",
  physical: "physical", informatical: "informatical", environmental: "environmental", systemic: "systemic",
  canBe: "can be", stateOf: "State", isInitial: "initial", isFinal: "final", isDefault: "default",
  requires: "requires", consumes: "consumes", yields: "yields", affects: "affects", handles: "handles",
  changes: "changes", from: "from", to: "to", and: "and", or: "or",
  invokes: "invokes", exhibitsWord: "exhibits", consistsOf: "consists of", isInstanceOf: "is an instance of",
  inThatSequence: "in that sequence", zoomsInto: "zooms into", parallel: "parallel",
  refinedBy: "is refined by", inZooming: "in-zooming", unfolding: "unfolding",
  triggers: "triggers", handlesException: "handles exception from", overtimeException: "handles overtime exception from", undertimeException: "handles undertime exception from",
  occursIf: "occurs if", isState: "is", otherwise: "otherwise", isSkipped: "is skipped",
  notToBe: "not to be", notToExist: "not to exist", absenceOf: "absence of",
  path: "path",
  appliesTo: "applies to", linksOnPath: "links on path", scenario: "scenario",
  probability: "probability",
  exactlyOneOf: "exactly one of", atLeastOneOf: "at least one of",
  requiresDuration: "requires",
  atLeastOneOtherPart: "at least one other part", atLeastOneOtherFeature: "at least one other feature", atLeastOneOtherSpecialization: "at least one other specialization",
};

const ES_VOCAB: OplVocab = {
  isAn: (_w) => `un`, // Simplified: "es un" (masculine default per §1.4)
  object: "objeto", process: "proceso",
  physical: "físico", informatical: "informático", environmental: "ambiental", systemic: "sistémico",
  canBe: "puede estar", stateOf: "Estado", isInitial: "inicial", isFinal: "final", isDefault: "por defecto",
  requires: "requiere", consumes: "consume", yields: "genera", affects: "afecta", handles: "maneja",
  changes: "cambia", from: "de", to: "a", and: "y", or: "o",
  invokes: "invoca", exhibitsWord: "exhibe", consistsOf: "consta de", isInstanceOf: "es una instancia de",
  inThatSequence: "en esa secuencia", zoomsInto: "se descompone en", parallel: "paralelo",
  refinedBy: "se refina por descomposición de", inZooming: "", unfolding: "despliegue de",
  triggers: "inicia", handlesException: "maneja excepción de", overtimeException: "maneja excepción de sobretiempo de", undertimeException: "maneja excepción de subtiempo de",
  occursIf: "ocurre si", isState: "está en", otherwise: "de lo contrario", isSkipped: "se omite",
  notToBe: "no esté en", notToExist: "no exista", absenceOf: "ausencia de",
  path: "ruta",
  appliesTo: "aplica a", linksOnPath: "enlaces en ruta", scenario: "escenario",
  probability: "probabilidad",
  exactlyOneOf: "exactamente uno de", atLeastOneOf: "al menos uno de",
  requiresDuration: "requiere",
  atLeastOneOtherPart: "al menos otra parte", atLeastOneOtherFeature: "al menos otro rasgo", atLeastOneOtherSpecialization: "al menos otra especialización",
};

function getVocab(locale: string): OplVocab {
  return locale === "es" ? ES_VOCAB : EN_VOCAB;
}

export function exposeFromSemanticKernel(
  kernel: SemanticKernel,
  opdId: string,
  atlas?: OpdAtlas,
  layout?: LayoutModel,
): OplDocument {
  const model = legacyModelFromSemanticKernel(kernel, atlas, layout);
  return expose(model, opdId);
}

export function expose(model: Model, opdId: string): OplDocument {
  const opd = model.opds.get(opdId);
  const opdName = opd?.name ?? opdId;
  const containerThingId = opd?.refines;

  const settings = model.settings;
  const locale = (settings.opl_language === "es" ? "es" : "en") as import("./opl-types").OplLocale;
  const renderSettings: OplRenderSettings = {
    essenceVisibility: settings.opl_essence_visibility ?? "all",
    unitsVisibility: settings.opl_units_visibility ?? "always",
    aliasVisibility: settings.opl_alias_visibility ?? false,
    primaryEssence: settings.primary_essence ?? "informatical",
    locale,
  };

  // 1. Collect visible things + appearance lookup for this OPD
  const visibleThings = new Set<string>();
  const opdAppearances = new Map<string, typeof model.appearances extends Map<any, infer V> ? V : never>();
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) {
      visibleThings.add(app.thing);
      opdAppearances.set(app.thing, app);
    }
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
      const internalObjects: Array<{ thingId: string; name: string }> = [];
      for (const app of model.appearances.values()) {
        if (app.opd !== opdId) continue;
        if (app.thing === containerThingId) continue;
        if (!app.internal) continue;
        const thing = model.things.get(app.thing);
        if (thing?.kind === "process") {
          subprocessApps.push({ thingId: thing.id, name: thing.name, y: app.y });
        } else if (thing?.kind === "object") {
          internalObjects.push({ thingId: thing.id, name: thing.name });
        }
      }
      subprocessApps.sort((a, b) => a.y - b.y || a.thingId.localeCompare(b.thingId));
      internalObjects.sort((a, b) => a.name.localeCompare(b.name));

      if (subprocessApps.length > 0) {
        // R-OC-7: group subprocesses at same Y as parallel
        type InZoomStepWithY = OplInZoomSequence["steps"][number] & { _y: number };
        const steps: InZoomStepWithY[] = [];
        for (const sp of subprocessApps) {
          const last = steps[steps.length - 1];
          if (last && last._y === sp.y) {
            last.thingIds.push(sp.thingId);
            last.thingNames.push(sp.name);
            last.parallel = true;
          } else {
            steps.push({ thingIds: [sp.thingId], thingNames: [sp.name], parallel: false, _y: sp.y });
          }
        }
        // Strip internal _y helper
        const cleanSteps = steps.map(({ thingIds, thingNames, parallel }) => ({ thingIds, thingNames, parallel }));

        sentences.push({
          kind: "in-zoom-sequence",
          parentId: containerThingId,
          parentName: containerThing.name,
          steps: cleanSteps,
          ...(internalObjects.length > 0 ? { internalObjects } : {}),
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
      perseverance: thing.perseverance,
    };
    if (thing.computational && "value_type" in thing.computational) {
      const comp = thing.computational as ComputationalObject;
      declaration.valueType = comp.value_type;
      declaration.unit = comp.unit;
    }
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
        min: thing.duration.min,
        max: thing.duration.max,
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
      // Container links: only structural (aggregation, exhibition, etc.) — not procedural (effect, agent, etc.)
      if (touchesContainer && !isStructural) return false;
      // Non-container links: keep structural links between any visible things;
      // for procedural links, require at least one internal thing
      if (!touchesContainer && !isStructural && !internalThings.has(l.source) && !internalThings.has(l.target)) return false;
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
    const multiplicities = Object.fromEntries(
      childNames.flatMap((name, index) => {
        const link = group.links[index];
        const multiplicity = group.parentIsSource ? link?.multiplicity_target : link?.multiplicity_source;
        return multiplicity ? [[name, multiplicity]] : [];
      }),
    );
    const parentApp = opdAppearances.get(group.parentId);
    sentences.push({
      kind: "grouped-structural",
      linkType: group.linkType,
      parentId: group.parentId,
      parentName: parent.name,
      parentKind: parent.kind,
      childIds,
      childNames,
      childKinds,
      ...(Object.keys(multiplicities).length > 0 ? { multiplicities } : {}),
      incomplete: group.links.some(l => l.incomplete),
      ...(parentApp?.semi_folded ? { semiFolded: true } : {}),
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
    if (link.exception_type) {
      sentence.exceptionType = link.exception_type;
    }
    if (link.probability != null) {
      sentence.probability = link.probability;
    }
    if (link.path_label) {
      sentence.pathLabel = link.path_label;
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

  // R-OPL-3: OPD tree edge label for refinement OPDs
  let refinementEdge: OplDocument["refinementEdge"];
  if (opd?.refines && opd.refinement_type && opd.parent_opd) {
    const parentOpd = model.opds.get(opd.parent_opd);
    const refinedThing = model.things.get(opd.refines);
    if (parentOpd && refinedThing) {
      refinementEdge = {
        parentOpdName: parentOpd.name,
        refinementType: opd.refinement_type,
        refinedThingName: refinedThing.name,
        childOpdName: opdName,
      };
    }
  }

  // 6. Requirements targeting visible things
  for (const req of model.requirements.values()) {
    if (!visibleThings.has(req.target)) continue;
    const targetThing = model.things.get(req.target);
    if (!targetThing) continue;
    sentences.push({
      kind: "requirement",
      reqId: req.id,
      reqCode: req.req_id ?? req.id,
      name: req.name,
      description: req.description ?? "",
      targetName: targetThing.name,
    });
  }

  // 7. Assertions targeting visible things or links with visible endpoints
  for (const ast of model.assertions.values()) {
    if (!ast.enabled) continue;
    // Target can be a thing or a link
    const targetThing = ast.target ? model.things.get(ast.target) : undefined;
    const targetLink = ast.target ? model.links.get(ast.target) : undefined;
    let targetName: string;
    if (targetThing && visibleThings.has(targetThing.id)) {
      targetName = targetThing.name;
    } else if (targetLink && visibleThings.has(targetLink.source) && visibleThings.has(targetLink.target)) {
      const srcName = model.things.get(targetLink.source)?.name ?? targetLink.source;
      const tgtName = model.things.get(targetLink.target)?.name ?? targetLink.target;
      targetName = `${srcName} → ${tgtName}`;
    } else {
      continue;
    }
    sentences.push({
      kind: "assertion",
      assertionId: ast.id,
      predicate: ast.predicate,
      targetName,
      category: ast.category ?? "correctness",
    });
  }

  // 8. Scenarios — list scenarios that have links visible in this OPD
  for (const scenario of model.scenarios.values()) {
    const scenarioLinks = [...model.links.values()].filter(l =>
      l.path_label && scenario.path_labels.includes(l.path_label) &&
      visibleThings.has(l.source) && visibleThings.has(l.target)
    );
    if (scenarioLinks.length > 0) {
      sentences.push({
        kind: "scenario",
        scenarioId: scenario.id,
        name: scenario.name,
        pathLabels: scenario.path_labels,
        linkCount: scenarioLinks.length,
      });
    }
  }

  return { opdId, opdName, sentences, renderSettings, ...(refinementEdge ? { refinementEdge } : {}) };
}

// === render ===

function aOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function formatList(names: string[], incomplete?: boolean, incompletePhrase?: string, v?: OplVocab): string {
  const andWord = v?.and ?? "and";
  if (names.length === 0) return "";
  if (names.length === 1) {
    return incomplete && incompletePhrase ? `${names[0]} ${andWord} ${incompletePhrase}` : names[0]!;
  }
  if (names.length === 2) {
    if (incomplete && incompletePhrase) {
      return `${names[0]}, ${names[1]}, ${andWord} ${incompletePhrase}`;
    }
    return `${names[0]} ${andWord} ${names[1]}`;
  }
  const last = names[names.length - 1]!;
  const rest = names.slice(0, -1);
  if (incomplete && incompletePhrase) {
    return `${rest.join(", ")}, ${last}, ${andWord} ${incompletePhrase}`;
  }
  return `${rest.join(", ")}, ${andWord} ${last}`;
}

// STRUCTURAL_TYPES imported from ./structural

const INCOMPLETE_PHRASES: Record<string, string> = {
  aggregation: "at least one other part",
  exhibition: "at least one other feature",
  generalization: "at least one other specialization",
  classification: "at least one other instance",
};

/** Convert ISO 19450 multiplicity symbol to OPL phrase. Returns null for default (1). */
function multiplicityPhrase(mult: string | undefined, isES = false): string | null {
  if (!mult || mult === "1") return null;
  switch (mult) {
    case "?": return isES ? "un opcional" : "an optional";
    case "*": return isES ? "cero o más" : "zero or more";
    case "+": return isES ? "al menos un" : "at least one";
    default: {
      const match = mult.match(/^(\d+)\.\.(\d+|\*)$/);
      if (match) {
        const [, min, max] = match;
        if (max === "*") return isES ? `${min} o más` : `${min} or more`;
        return isES ? `${min} a ${max}` : `${min} to ${max}`;
      }
      return mult; // fallback: raw value
    }
  }
}

/** Apply multiplicity phrase to a name: "at least one Wheel" or just "Wheel" */
function withMultiplicity(name: string, mult: string | undefined, isES = false): string {
  const phrase = multiplicityPhrase(mult, isES);
  return phrase ? `${phrase} ${name}` : name;
}

function renderLinkSentence(s: OplLinkSentence, v: OplVocab): string {
  const processName = s.sourceName;
  const objectName = s.targetName;
  // OPL-ES §1.9: state follows object with "en" — "Objeto en estado"
  // OPL-EN: state precedes object — "state Object"
  const isES = v === ES_VOCAB;
  const ss = (stateName: string | undefined, name: string) =>
    stateName ? (isES ? `${name} en ${stateName}` : `${stateName} ${name}`) : name;

  switch (s.linkType) {
    case "agent": {
      // H1/HS1: Agent handles Process / Agente maneja Proceso
      return `${ss(s.sourceStateName, s.sourceName)} ${v.handles} ${s.targetName}.`;
    }
    case "instrument": {
      // H2/HS2: Process requires Instrument / Proceso requiere Instrumento
      return `${s.targetName} ${v.requires} ${ss(s.sourceStateName, s.sourceName)}.`;
    }
    case "consumption": {
      // T1/TS1: Process consumes Object / Proceso consume Objeto
      if (s.sourceStateName) {
        return `${s.targetName} ${v.consumes} ${ss(s.sourceStateName, s.sourceName)}.`;
      }
      return `${s.targetName} ${v.consumes} ${withMultiplicity(s.sourceName, s.multiplicitySource, isES)}.`;
    }
    case "effect": {
      // TS3-TS5: Process changes Object from A to B / Proceso cambia Objeto de A a B
      const prob = s.probability != null ? ` (${v.probability} ${Math.round(s.probability * 100)}%)` : "";
      if (s.sourceStateName && s.targetStateName) {
        return `${processName} ${v.changes} ${objectName} ${v.from} ${s.sourceStateName} ${v.to} ${s.targetStateName}${prob}.`;
      }
      if (s.sourceStateName && !s.targetStateName) {
        return `${processName} ${v.changes} ${objectName} ${v.from} ${s.sourceStateName}${prob}.`;
      }
      if (!s.sourceStateName && s.targetStateName) {
        return `${processName} ${v.changes} ${objectName} ${v.to} ${s.targetStateName}${prob}.`;
      }
      return `${s.sourceName} ${v.affects} ${s.targetName}${prob}.`;
    }
    case "result": {
      // T2/TS2: Process yields Object / Proceso genera Objeto
      if (s.targetStateName) {
        return `${s.sourceName} ${v.yields} ${ss(s.targetStateName, s.targetName)}.`;
      }
      return `${s.sourceName} ${v.yields} ${s.targetName}.`;
    }
    case "input": {
      if (s.sourceStateName) {
        return isES
          ? `${ss(s.sourceStateName, s.sourceName)} es entrada de ${s.targetName}.`
          : `${s.sourceStateName} ${s.sourceName} is an input of ${s.targetName}.`;
      }
      return isES
        ? `${s.sourceName} es entrada de ${s.targetName}.`
        : `${s.sourceName} is an input of ${s.targetName}.`;
    }
    case "output": {
      if (s.targetStateName) {
        return isES
          ? `${s.sourceName} produce ${ss(s.targetStateName, s.targetName)}.`
          : `${s.sourceName} outputs ${s.targetStateName} ${s.targetName}.`;
      }
      return isES
        ? `${s.sourceName} produce ${s.targetName}.`
        : `${s.sourceName} outputs ${s.targetName}.`;
    }
    case "aggregation": {
      // RF1: Whole consists of Parts / Todo consta de Partes
      const partName = withMultiplicity(s.targetName, s.multiplicityTarget, isES);
      if (s.incomplete) {
        return `${s.sourceName} ${v.consistsOf} ${partName} ${v.and} ${v.atLeastOneOtherPart}.`;
      }
      return `${s.sourceName} ${v.consistsOf} ${partName}.`;
    }
    case "exhibition": {
      // RF2: Exhibitor exhibits Feature / Exhibidor exhibe Atributo
      const featureName = withMultiplicity(s.targetName, s.multiplicityTarget, isES);
      if (s.incomplete) {
        return `${s.sourceName} ${v.exhibitsWord} ${featureName} ${v.and} ${v.atLeastOneOtherFeature}.`;
      }
      return `${s.sourceName} ${v.exhibitsWord} ${featureName}.`;
    }
    case "generalization": {
      // RF3/RF3b
      if (s.incomplete) {
        return isES
          ? `${s.sourceName}, ${s.targetName} ${v.and} ${v.atLeastOneOtherSpecialization} son generales.`
          : `${s.sourceName}, ${s.targetName} and other specializations are general.`;
      }
      if (s.targetKind === "object") {
        return isES
          ? `${s.targetName} es ${v.isAn(s.sourceName)} ${s.sourceName}.`
          : `${s.targetName} is ${aOrAn(s.sourceName)}.`;
      }
      return isES
        ? `${s.targetName} es ${s.sourceName}.`
        : `${s.targetName} is ${s.sourceName}.`;
    }
    case "classification":
      // RF4
      return `${s.targetName} ${v.isInstanceOf} ${s.sourceName}.`;
    case "invocation":
      // IV1
      return `${s.sourceName} ${v.invokes} ${s.targetName}.`;
    case "exception": {
      // EX1/EX2
      const excType = s.exceptionType === "overtime" ? v.overtimeException
        : s.exceptionType === "undertime" ? v.undertimeException
        : v.handlesException;
      return `${s.targetName} ${excType} ${s.sourceName}.`;
    }
    case "tagged": {
      // SE1-SE5
      const defaultTag = s.direction === "reciprocal"
        ? (isES ? "se relacionan" : "are related")
        : (isES ? "se relaciona con" : "relates to");
      const tag = s.tag ?? defaultTag;
      if (s.direction === "bidirectional") {
        return isES
          ? `${s.sourceName} ${tag} ${s.targetName} ${v.and} viceversa.`
          : `${s.sourceName} ${tag} ${s.targetName} and vice versa.`;
      }
      if (s.direction === "reciprocal") {
        return `${s.sourceName} ${v.and} ${s.targetName} ${tag}.`;
      }
      return `${s.sourceName} ${tag} ${s.targetName}.`;
    }
    default: return `${s.sourceName} --[${s.linkType}]--> ${s.targetName}.`;
  }
}

function renderModifierSentence(s: OplModifierSentence, v: OplVocab): string {
  const isES = v === ES_VOCAB;
  const isEnabling = ["agent", "instrument"].includes(s.linkType);
  const isConsumption = s.linkType === "consumption";
  const isInvocation = ["invocation", "exception"].includes(s.linkType);
  const objectIsSource = isEnabling || isConsumption;
  let processName: string;
  let objectName: string;
  let stateName: string | undefined;
  if (isInvocation) {
    processName = s.targetName;
    objectName = s.sourceName;
    stateName = s.sourceStateName;
  } else {
    processName = objectIsSource ? s.targetName : s.sourceName;
    objectName = objectIsSource ? s.sourceName : s.targetName;
    stateName = objectIsSource ? s.sourceStateName : s.targetStateName;
  }
  // OPL-ES §1.9: state after object with "en"
  const ssObj = stateName ? (isES ? `${objectName} en ${stateName}` : `${stateName} ${objectName}`) : objectName;

  if (s.modifierType === "event") {
    // ET/EH: event trigger — "Object triggers Process" / "Objeto inicia Proceso"
    if (s.negated && stateName) {
      return isES
        ? `no-${stateName} ${objectName} ${v.triggers} ${processName}.`
        : `non-${stateName} ${objectName} triggers ${processName}.`;
    }
    if (s.negated) {
      return isES
        ? `${v.absenceOf} ${objectName} ${v.triggers} ${processName}.`
        : `absence of ${objectName} triggers ${processName}.`;
    }
    return `${ssObj} ${v.triggers} ${processName}.`;
  }

  if (s.modifierType === "condition") {
    const mode = s.conditionMode ?? "wait";

    if (mode === "wait") {
      // CH/CS: "Process requires Object" / "Proceso requiere Objeto"
      if (s.negated && stateName) {
        return isES
          ? `${processName} ${v.requires} ${objectName} ${v.notToBe} ${stateName}.`
          : `${processName} requires ${objectName} not to be ${stateName}.`;
      }
      if (s.negated) {
        return isES
          ? `${processName} ${v.requires} que ${objectName} ${v.notToExist}.`
          : `${processName} requires ${objectName} not to exist.`;
      }
      if (stateName) {
        return `${processName} ${v.requires} ${ssObj}.`;
      }
      return `${processName} ${v.requires} ${objectName}.`;
    }

    if (mode === "skip") {
      // CT/CS: "Process occurs if Object is state, otherwise skipped"
      if (s.negated && stateName) {
        return isES
          ? `${processName} ${v.occursIf} ${objectName} no ${v.isState} ${stateName}, ${v.otherwise} ${processName} ${v.isSkipped}.`
          : `${processName} occurs if ${objectName} is not ${stateName}, otherwise ${processName} is skipped.`;
      }
      if (s.negated) {
        return isES
          ? `${processName} ${v.occursIf} ${objectName} no existe, ${v.otherwise} ${processName} ${v.isSkipped}.`
          : `${processName} occurs if ${objectName} does not exist, otherwise ${processName} is skipped.`;
      }
      if (stateName) {
        return isES
          ? `${processName} ${v.occursIf} ${objectName} ${v.isState} ${stateName}, ${v.otherwise} ${processName} ${v.isSkipped}.`
          : `${processName} occurs if ${objectName} is ${stateName}, otherwise ${processName} is skipped.`;
      }
      return isES
        ? `${processName} ${v.occursIf} ${objectName} existe, ${v.otherwise} ${processName} ${v.isSkipped}.`
        : `${processName} occurs if ${objectName} exists, otherwise ${processName} is skipped.`;
    }
  }

  const neg = s.negated ? (isES ? "negado " : "negated ") : "";
  return isES
    ? `enlace ${s.linkType} de ${s.sourceName} a ${s.targetName} tiene modificador ${neg}${s.modifierType}.`
    : `${s.linkType} link from ${s.sourceName} to ${s.targetName} has ${neg}${s.modifierType} modifier.`;
}

function renderGroupedStructural(s: OplGroupedStructuralSentence, v: OplVocab): string {
  const isES = v === ES_VOCAB;
  const incPhrases: Record<string, string> = isES
    ? { aggregation: v.atLeastOneOtherPart, exhibition: v.atLeastOneOtherFeature, generalization: v.atLeastOneOtherSpecialization, classification: "al menos otra instancia" }
    : INCOMPLETE_PHRASES;
  const phrase = incPhrases[s.linkType] ?? (isES ? "al menos otro" : "at least one other");

  switch (s.linkType) {
    case "aggregation": {
      const qualifiedNames = s.childNames.map((name, i) =>
        withMultiplicity(name, s.multiplicities?.[name], isES)
      );
      if (s.semiFolded) {
        return isES
          ? `${s.parentName} lista ${formatList(qualifiedNames, false, "", v)} como partes.`
          : `${s.parentName} lists ${formatList(qualifiedNames)} as parts.`;
      }
      return `${s.parentName} ${v.consistsOf} ${formatList(qualifiedNames, s.incomplete, phrase, v)}.`;
    }

    case "exhibition": {
      const qualifiedNames = s.childNames.map((name, i) =>
        withMultiplicity(name, s.multiplicities?.[name], isES)
      );
      const attrs = qualifiedNames.filter((_, i) => s.childKinds[i] === "object");
      const ops = qualifiedNames.filter((_, i) => s.childKinds[i] === "process");
      const isObjectExhibitor = s.parentKind === "object";
      const first = isObjectExhibitor ? attrs : ops;
      const second = isObjectExhibitor ? ops : attrs;
      const asWellAs = isES ? "así como" : "as well as";
      if (first.length === 0 && second.length === 0) {
        return `${s.parentName} ${v.exhibitsWord} ${formatList(qualifiedNames, s.incomplete, phrase, v)}.`;
      }
      if (first.length > 0 && second.length > 0) {
        return `${s.parentName} ${v.exhibitsWord} ${formatList(first, false, "", v)}, ${asWellAs} ${formatList(second, false, "", v)}.`;
      }
      const combined = first.length > 0 ? first : second;
      return `${s.parentName} ${v.exhibitsWord} ${formatList(combined, s.incomplete, phrase, v)}.`;
    }

    case "generalization": {
      const list = formatList(s.childNames, s.incomplete, phrase, v);
      if (s.childNames.length === 1 && !s.incomplete) {
        // RF3b: single specialization
        if (isES) {
          return `${s.childNames[0]} es ${v.isAn(s.parentName)} ${s.parentName}.`;
        }
        if (s.parentKind === "object") {
          return `${s.childNames[0]} is ${aOrAn(s.parentName)}.`;
        }
        return `${s.childNames[0]} is ${s.parentName}.`;
      }
      // RF3: multiple specializations
      if (isES) {
        return `${list} son ${v.isAn(s.parentName)} ${s.parentName}.`;
      }
      if (s.parentKind === "object") {
        return `${list} are ${aOrAn(s.parentName)}.`;
      }
      return `${list} are ${s.parentName}.`;
    }

    case "classification": {
      const list = formatList(s.childNames, s.incomplete, phrase, v);
      if (s.childNames.length === 1) {
        return isES
          ? `${s.childNames[0]} ${v.isInstanceOf} ${s.parentName}.`
          : `${s.childNames[0]} is an instance of ${s.parentName}.`;
      }
      return isES
        ? `${list} son instancias de ${s.parentName}.`
        : `${list} are instances of ${s.parentName}.`;
    }

    default:
      return "";
  }
}

function formatFanList(names: string[], stateNames?: (string | undefined)[], v?: OplVocab): string {
  const isES = v === ES_VOCAB;
  const orWord = v?.or ?? "or";
  const qualified = names.map((name, i) => {
    const st = stateNames?.[i];
    // OPL-ES §1.9: state after object — "Objeto en estado"
    return st ? (isES ? `${name} en ${st}` : `${st} ${name}`) : name;
  });
  if (qualified.length === 1) return qualified[0]!;
  if (qualified.length === 2) return `${qualified[0]} ${orWord} ${qualified[1]}`;
  const last = qualified[qualified.length - 1]!;
  const rest = qualified.slice(0, -1);
  return `${rest.join(", ")}, ${orWord} ${last}`;
}

function renderFanSentence(s: OplFanSentence, v: OplVocab): string {
  const quantifier = s.fanType === "xor" ? v.exactlyOneOf : v.atLeastOneOf;
  const list = formatFanList(
    s.memberNames,
    s.direction === "converging" ? s.memberSourceStateNames : s.memberTargetStateNames,
    v,
  );

  switch (s.linkType) {
    case "consumption":
      if (s.direction === "converging") {
        return `${s.sharedEndpointName} ${v.consumes} ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} ${v.consumes} ${s.sharedEndpointName}.`;

    case "result":
      if (s.direction === "diverging") {
        return `${s.sharedEndpointName} ${v.yields} ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} ${v.yields} ${s.sharedEndpointName}.`;

    case "effect":
      if (s.direction === "diverging") {
        return `${s.sharedEndpointName} ${v.affects} ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} ${v.affects} ${s.sharedEndpointName}.`;

    case "agent":
      if (s.direction === "converging") {
        return `${capitalize(quantifier)} ${list} ${v.handles} ${s.sharedEndpointName}.`;
      }
      return `${s.sharedEndpointName} ${v.handles} ${quantifier} ${list}.`;

    case "instrument":
      if (s.direction === "converging") {
        return `${s.sharedEndpointName} ${v.requires} ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} ${v.requires} ${s.sharedEndpointName}.`;

    case "invocation":
      if (s.direction === "diverging") {
        return `${s.sharedEndpointName} ${v.invokes} ${quantifier} ${list}.`;
      }
      return `${capitalize(quantifier)} ${list} ${v.invokes} ${s.sharedEndpointName}.`;

    default:
      return `${s.sharedEndpointName} → ${quantifier} ${list}.`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderSentence(s: OplSentence, settings: OplRenderSettings): string {
  const v = getVocab(settings.locale);

  switch (s.kind) {
    case "thing-declaration": {
      const displayName = s.exhibitorName ? `${s.name} ${v.from === "de" ? "de" : "of"} ${s.exhibitorName}` : s.name;
      const kindWord = s.thingKind === "object" ? v.object : v.process;
      const essenceMap: Record<string, string> = { physical: v.physical, informatical: v.informatical };
      const affiliationMap: Record<string, string> = { environmental: v.environmental, systemic: v.systemic };
      let text = settings.locale === "es"
        ? `${displayName} es ${v.isAn(kindWord)} ${kindWord}`
        : `${displayName} is ${aOrAn(s.thingKind)}`;
      if (settings.essenceVisibility === "all" ||
          (settings.essenceVisibility === "non_default" && s.essence !== settings.primaryEssence)) {
        text += `, ${essenceMap[s.essence] ?? s.essence}`;
      }
      if (s.affiliation !== "systemic") {
        text += `, ${affiliationMap[s.affiliation] ?? s.affiliation}`;
      }
      if (s.perseverance === "dynamic") {
        text += settings.locale === "es" ? ", dinámico" : ", dynamic";
      }
      if (s.valueType) {
        text += settings.locale === "es" ? `, de tipo ${s.valueType}` : `, of type ${s.valueType}`;
        if (s.unit) text += ` [${s.unit}]`;
      }
      if (s.alias && settings.aliasVisibility) {
        text += ` (alias: ${s.alias})`;
      }
      return text + ".";
    }
    case "state-enumeration": {
      const displayName = s.exhibitorName
        ? `${s.thingName} ${settings.locale === "es" ? "de" : "of"} ${s.exhibitorName}`
        : s.thingName;
      if (s.stateNames.length === 0) return "";
      if (s.stateNames.length === 1) return `${displayName} ${v.canBe} ${s.stateNames[0]}.`;
      const last = s.stateNames[s.stateNames.length - 1];
      const rest = s.stateNames.slice(0, -1);
      return `${displayName} ${v.canBe} ${rest.join(", ")} ${v.or} ${last}.`;
    }
    case "duration": {
      const unit = settings.unitsVisibility === "hide" ? "" : s.unit;
      if (s.min != null && s.max != null) {
        return `${s.thingName} ${v.requiresDuration} ${s.min}–${s.nominal}–${s.max}${unit}.`;
      }
      if (s.max != null) {
        return `${s.thingName} ${v.requiresDuration} ${s.nominal}–${s.max}${unit}.`;
      }
      if (s.min != null) {
        return `${s.thingName} ${v.requiresDuration} ${s.min}–${s.nominal}${unit}.`;
      }
      return `${s.thingName} ${v.requiresDuration} ${s.nominal}${unit}.`;
    }
    case "link":
    {
      let text = renderLinkSentence(s, v);
      if (s.pathLabel) {
        text = text.slice(0, -1) + ` [${v.path}: ${s.pathLabel}].`;
      }
      return text;
    }
    case "modifier": {
      return renderModifierSentence(s, v);
    }
    case "state-description": {
      const qualifiers: string[] = [];
      if (s.initial) qualifiers.push(v.isInitial);
      if (s.final) qualifiers.push("final");
      if (s.default) qualifiers.push(v.isDefault);
      const ofWord = settings.locale === "es" ? "de" : "of";
      const thingDisplay = s.exhibitorName
        ? `${s.thingName} ${ofWord} ${s.exhibitorName}`
        : s.thingName;
      return `${v.stateOf} ${s.stateName} ${ofWord} ${thingDisplay} ${settings.locale === "es" ? "es" : "is"} ${qualifiers.join(` ${v.and} `)}.`;
    }
    case "attribute-value": {
      const ofWord = settings.locale === "es" ? "de" : "of";
      const isWord = settings.locale === "es" ? "es" : "is";
      return `${s.thingName} ${ofWord} ${s.exhibitorName} ${isWord} ${s.valueName}.`;
    }
    case "grouped-structural":
      return renderGroupedStructural(s, v);
    case "fan":
      return renderFanSentence(s, v);
    case "in-zoom-sequence": {
      const allNames = s.steps.flatMap(step =>
        step.parallel
          ? [`${v.parallel} ${formatList(step.thingNames, false, "", v)}`]
          : step.thingNames
      );
      const list = formatList(allNames, false, "", v);
      const objClause = s.internalObjects && s.internalObjects.length > 0
        ? `, ${settings.locale === "es" ? "así como" : "as well as"} ${formatList(s.internalObjects.map(o => o.name), false, "", v)}`
        : "";
      const allParallel = s.steps.length === 1 && s.steps[0]!.parallel;
      if (s.steps.length === 1 && s.steps[0]!.thingNames.length === 1) {
        return `${s.parentName} ${v.zoomsInto} ${list}${objClause}.`;
      }
      if (allParallel) {
        return `${s.parentName} ${v.zoomsInto} ${list}${objClause}.`;
      }
      return `${s.parentName} ${v.zoomsInto} ${list}${objClause}, ${v.inThatSequence}.`;
    }
    case "requirement":
      return `[${s.reqCode}] ${s.name}: ${s.description} (${v.appliesTo} ${s.targetName}).`;
    case "assertion": {
      const catLabel = v === ES_VOCAB
        ? { safety: "seguridad", liveness: "vivacidad", correctness: "correctitud" }[s.category] ?? s.category
        : s.category;
      return `[${catLabel}] ${s.predicate}`;
    }
    case "scenario":
      return `[${v.scenario}: ${s.name}] ${s.linkCount} ${v.linksOnPath} "${s.pathLabels.join(", ")}"`;
  }
}

export function render(doc: OplDocument): string {
  const lines: string[] = [];
  // R-OPL-3: OPD tree edge label
  if (doc.refinementEdge) {
    const e = doc.refinementEdge;
    const v = getVocab(doc.renderSettings.locale);
    if (doc.renderSettings.locale === "es") {
      const verb = e.refinementType === "in-zoom" ? "" : `${v.unfolding} `;
      lines.push(`${e.parentOpdName} ${v.refinedBy} ${verb}${e.refinedThingName} en ${e.childOpdName}.`);
    } else {
      const verb = e.refinementType === "in-zoom" ? "in-zooming" : "unfolding";
      lines.push(`${e.parentOpdName} is refined by ${verb} ${e.refinedThingName} in ${e.childOpdName}.`);
    }
  }
  // Group sentences by category for structured output
  const thingSentences = doc.sentences.filter(s =>
    s.kind === "thing-declaration" || s.kind === "state-enumeration" ||
    s.kind === "duration" || s.kind === "state-description" || s.kind === "attribute-value"
  );
  const linkSentences = doc.sentences.filter(s =>
    s.kind === "link" || s.kind === "modifier" || s.kind === "grouped-structural" ||
    s.kind === "in-zoom-sequence" || s.kind === "fan"
  );
  const metaSentences = doc.sentences.filter(s =>
    s.kind === "requirement" || s.kind === "assertion" || s.kind === "scenario"
  );

  const renderGroup = (sentences: typeof doc.sentences): string[] => {
    const rendered = sentences
      .map(s => renderSentence(s, doc.renderSettings))
      .filter(Boolean) as string[];
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const line of rendered) {
      if (!seen.has(line)) {
        deduped.push(line);
        seen.add(line);
      }
    }
    return deduped;
  };

  lines.push(...renderGroup(thingSentences));
  const linkLines = renderGroup(linkSentences);
  if (linkLines.length > 0) lines.push(...linkLines);
  const metaLines = renderGroup(metaSentences);
  if (metaLines.length > 0) lines.push(...metaLines);
  return lines.join("\n");
}

// === Full-model OPL export ===

export function renderAllFromSemanticKernel(
  kernel: SemanticKernel,
  atlas?: OpdAtlas,
  layout?: LayoutModel,
): string {
  const model = legacyModelFromSemanticKernel(kernel, atlas, layout);
  return renderAll(model);
}

/**
 * Render OPL from SemanticKernel via atlas-derived visibility.
 * This is the ADR-003 kernel-native path: kernel + atlas → OPL text.
 * The atlas provides per-OPD visibility; the kernel provides all semantic data.
 * Layout is not needed for OPL generation (only for visual rendering).
 */
export function renderAllFromKernelNative(
  kernel: SemanticKernel,
  atlas: OpdAtlas,
): string {
  // Use legacyModelFromSemanticKernel to build a Model with all semantic data
  // (mod/fan now preserved) and atlas-derived appearances for correct per-OPD visibility
  const layout: LayoutModel = { opdLayouts: new Map() };
  // Build minimal layout so expose() can derive per-OPD thing visibility
  for (const [opdId, slice] of atlas.nodes) {
    const nodes = new Map<string, import("./semantic-kernel").LayoutNode>();
    let col = 0;
    for (const thingId of slice.visibleThings) {
      const occurrence = [...atlas.occurrences.values()].find(
        (o) => o.opdId === opdId && o.thingId === thingId,
      );
      if (occurrence) {
        nodes.set(occurrence.id, {
          viewId: occurrence.id,
          x: 120 + (col % 4) * 180,
          y: 120 + Math.floor(col / 4) * 120,
          w: 120,
          h: 60,
          ...(occurrence.role === "internal" ? { internal: true } : {}),
        });
        col++;
      }
    }
    layout.opdLayouts.set(opdId, { opdId, nodes, edges: new Map() });
  }

  const model = legacyModelFromSemanticKernel(kernel, atlas, layout);
  return renderAll(model);
}

/** Render OPL for all OPDs in the model, sorted hierarchically (root first, depth-first). */
export function renderAll(model: Model): string {
  // Build hierarchy: root OPDs first, then children depth-first
  const opdEntries = [...model.opds.entries()];
  const childrenOf = new Map<string | null, Array<[string, typeof model.opds extends Map<any, infer V> ? V : never]>>();
  for (const [id, opd] of opdEntries) {
    const parent = opd.parent_opd;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push([id, opd]);
  }

  const sorted: Array<[string, typeof model.opds extends Map<any, infer V> ? V : never]> = [];
  function walk(parentId: string | null) {
    const children = childrenOf.get(parentId) ?? [];
    // Sort children by name for deterministic output
    children.sort((a, b) => a[1].name.localeCompare(b[1].name));
    for (const entry of children) {
      sorted.push(entry);
      walk(entry[0]);
    }
  }
  walk(null);

  const sections: string[] = [];
  for (const [id, opd] of sorted) {
    const doc = expose(model, id);
    const text = render(doc);
    if (text.trim()) {
      sections.push(`=== ${opd.name} ===\n${text}`);
    }
  }
  return sections.join("\n\n");
}

// === Model Statistics ===

export interface ModelStats {
  things: { total: number; objects: number; processes: number };
  states: number;
  links: { total: number; byType: Record<string, number> };
  opds: { total: number; maxDepth: number };
  appearances: number;
  modifiers: number;
  fans: number;
  scenarios: number;
  assertions: number;
  requirements: number;
  oplSentences: number;
}

/** Compute summary statistics for a model. */
export function modelStats(model: Model): ModelStats {
  let objects = 0, processes = 0;
  for (const t of model.things.values()) {
    if (t.kind === "object") objects++;
    else processes++;
  }

  const byType: Record<string, number> = {};
  for (const link of model.links.values()) {
    byType[link.type] = (byType[link.type] ?? 0) + 1;
  }

  // OPD max depth
  function opdDepth(opdId: string): number {
    const opd = model.opds.get(opdId);
    if (!opd?.parent_opd) return 0;
    return 1 + opdDepth(opd.parent_opd);
  }
  let maxDepth = 0;
  for (const id of model.opds.keys()) {
    maxDepth = Math.max(maxDepth, opdDepth(id));
  }

  // Total OPL sentences across all OPDs
  let oplSentences = 0;
  for (const opdId of model.opds.keys()) {
    const doc = expose(model, opdId);
    oplSentences += doc.sentences.length;
  }

  return {
    things: { total: model.things.size, objects, processes },
    states: model.states.size,
    links: { total: model.links.size, byType },
    opds: { total: model.opds.size, maxDepth },
    appearances: model.appearances.size,
    modifiers: model.modifiers.size,
    fans: model.fans.size,
    scenarios: model.scenarios.size,
    assertions: model.assertions.size,
    requirements: model.requirements.size,
    oplSentences,
  };
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
