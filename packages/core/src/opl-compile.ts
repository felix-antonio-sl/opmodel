import type { Result } from "./result";
import { err, ok } from "./result";
import { createModel } from "./model";
import { oplSlug } from "./opl";
import { appearanceKey, collectAllIds } from "./helpers";
import {
  addAppearance,
  addAssertion,
  addFan,
  addLink,
  addModifier,
  addOPD,
  addRequirement,
  addScenario,
  addState,
  addThing,
  updateOPD,
  updateSettings,
  updateState,
  updateThing,
} from "./api";
import type { Model, OPD, Link, Thing, State, Appearance } from "./types";
import type { OplDocument, OplSentence } from "./opl-types";

export interface OplCompileIssue {
  message: string;
  sentenceKind?: OplSentence["kind"];
  opdName?: string;
  line?: number;
  column?: number;
}

export interface OplCompileError {
  message: string;
  issues: OplCompileIssue[];
}

export interface OplCompileOptions {
  modelName?: string;
  ignoreUnsupported?: boolean;
}

type CompoundHint = {
  baseName: string;
  exhibitorName: string;
};

type ThingRef = {
  thingId: string;
  actualName: string;
  displayName: string;
  exhibitorName?: string;
};

function uniqueId(base: string, model: Model): string {
  const taken = collectAllIds(model);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function pushIssue(issues: OplCompileIssue[], message: string, sentence?: OplSentence, opdName?: string) {
  issues.push({
    message,
    ...(sentence ? { sentenceKind: sentence.kind } : {}),
    ...(opdName ? { opdName } : {}),
    ...(sentence?.sourceSpan ? { line: sentence.sourceSpan.line, column: sentence.sourceSpan.column } : {}),
  });
}

function displayName(baseName: string, exhibitorName: string, locale: "en" | "es") {
  return `${baseName} ${locale === "es" ? "de" : "of"} ${exhibitorName}`;
}

function collectCompoundHints(docs: OplDocument[]): Map<string, CompoundHint> {
  const hints = new Map<string, CompoundHint>();
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if ((s.kind === "state-enumeration" || s.kind === "state-description" || s.kind === "attribute-value") && s.exhibitorName) {
        hints.set(displayName(s.thingName, s.exhibitorName, "en"), { baseName: s.thingName, exhibitorName: s.exhibitorName });
        hints.set(displayName(s.thingName, s.exhibitorName, "es"), { baseName: s.thingName, exhibitorName: s.exhibitorName });
      }
    }
  }
  return hints;
}

function isSupportedSentenceKind(kind: OplSentence["kind"]): boolean {
  return [
    "thing-declaration",
    "state-enumeration",
    "state-description",
    "duration",
    "attribute-value",
    "grouped-structural",
    "link",
    "modifier",
    "fan",
    "requirement",
    "assertion",
    "scenario",
    "in-zoom-sequence",
  ].includes(kind);
}

function isSupportedLinkType(type: Link["type"]): boolean {
  return ["agent", "instrument", "consumption", "result", "effect", "invocation", "tagged"].includes(type);
}

function isSupportedGroupedStructuralType(type: string): boolean {
  return ["aggregation", "exhibition", "generalization", "classification"].includes(type);
}

export function compileOplDocuments(docs: OplDocument[], options: OplCompileOptions = {}): Result<Model, OplCompileError> {
  if (docs.length === 0) {
    return err({ message: "No OPL documents to compile", issues: [] });
  }

  const issues: OplCompileIssue[] = [];
  const modelName = options.modelName ?? docs[0]!.opdName ?? "Compiled OPL";
  let model = createModel(modelName);

  // Preserve OPL render settings from root doc.
  const rootSettings = docs[0]!.renderSettings;
  let settingsResult = updateSettings(model, {
    opl_language: rootSettings.locale,
    opl_essence_visibility: rootSettings.essenceVisibility,
    opl_units_visibility: rootSettings.unitsVisibility,
    opl_alias_visibility: rootSettings.aliasVisibility,
    primary_essence: rootSettings.primaryEssence,
  });
  if (settingsResult.ok) model = settingsResult.value;

  // Root OPD already exists as opd-sd, just align its human-readable name.
  if (docs[0]!.opdName !== "SD") {
    const updated = updateOPD(model, "opd-sd", { name: docs[0]!.opdName });
    if (updated.ok) model = updated.value;
  }

  const compoundHints = collectCompoundHints(docs);
  const actualOpdIdByName = new Map<string, string>([[docs[0]!.opdName, "opd-sd"]]);
  const thingRefByDisplayName = new Map<string, ThingRef>();
  const thingIdsByActualName = new Map<string, string[]>();
  const stateIdByThingAndName = new Map<string, string>();
  const declarationsByDoc = new Map<string, string[]>();

  // Pass 0: register unsupported sentence kinds unless caller explicitly ignores them.
  if (!options.ignoreUnsupported) {
    for (const doc of docs) {
      for (const s of doc.sentences) {
        if (!isSupportedSentenceKind(s.kind)) {
          pushIssue(issues, `Compiler subset does not support sentence kind: ${s.kind}`, s, doc.opdName);
        }
      }
    }
    if (issues.length > 0) {
      return err({ message: "Unsupported OPL sentences for current compiler subset", issues });
    }
  }

  // Pass 1: create OPD skeletons from sections.
  for (let i = 1; i < docs.length; i++) {
    const doc = docs[i]!;
    const parentActualId = doc.refinementEdge
      ? actualOpdIdByName.get(doc.refinementEdge.parentOpdName) ?? "opd-sd"
      : "opd-sd";
    const actualId = uniqueId(doc.opdId || `opd-${oplSlug(doc.opdName) || "section"}`, model);
    const opd: OPD = {
      id: actualId,
      name: doc.opdName,
      opd_type: "hierarchical",
      parent_opd: parentActualId,
    };
    const r = addOPD(model, opd);
    if (!r.ok) {
      pushIssue(issues, r.error.message, undefined, doc.opdName);
      continue;
    }
    model = r.value;
    actualOpdIdByName.set(doc.opdName, actualId);
  }

  // Pass 2: create things from declarations, normalizing compound display names.
  for (const doc of docs) {
    const declaredThingIds: string[] = [];
    for (const s of doc.sentences) {
      if (s.kind !== "thing-declaration") continue;
      const hint = compoundHints.get(s.name);
      const actualName = hint?.baseName ?? s.name;
      const exhibitorName = hint?.exhibitorName;
      const display = exhibitorName ? displayName(actualName, exhibitorName, doc.renderSettings.locale) : s.name;

      let ref = thingRefByDisplayName.get(display);
      if (!ref) {
        const prefix = s.thingKind === "object" ? "obj" : "proc";
        const id = uniqueId(`${prefix}-${oplSlug(display) || "thing"}`, model);
        const thing: Thing = {
          id,
          kind: s.thingKind,
          name: actualName,
          essence: s.essence,
          affiliation: s.affiliation,
          ...(s.perseverance ? { perseverance: s.perseverance } : {}),
        };
        const r = addThing(model, thing);
        if (!r.ok) {
          pushIssue(issues, r.error.message, s, doc.opdName);
          continue;
        }
        model = r.value;
        ref = { thingId: id, actualName, displayName: display, ...(exhibitorName ? { exhibitorName } : {}) };
        thingRefByDisplayName.set(display, ref);
        if (exhibitorName) {
          thingRefByDisplayName.set(displayName(actualName, exhibitorName, "en"), ref);
          thingRefByDisplayName.set(displayName(actualName, exhibitorName, "es"), ref);
        }
        const bucket = thingIdsByActualName.get(actualName) ?? [];
        bucket.push(id);
        thingIdsByActualName.set(actualName, bucket);
      }
      declaredThingIds.push(ref.thingId);
    }
    declarationsByDoc.set(doc.opdName, declaredThingIds);
  }

  // Pass 3: refine OPDs now that refined thing IDs exist.
  for (const doc of docs) {
    if (!doc.refinementEdge) continue;
    const actualOpdId = actualOpdIdByName.get(doc.opdName);
    if (!actualOpdId) continue;
    const refined = resolveThingRef(doc.refinementEdge.refinedThingName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
    if (!refined) {
      pushIssue(issues, `Could not resolve refined thing: ${doc.refinementEdge.refinedThingName}`, undefined, doc.opdName);
      continue;
    }
    const r = updateOPD(model, actualOpdId, {
      refines: refined.thingId,
      refinement_type: doc.refinementEdge.refinementType,
    });
    if (!r.ok) {
      pushIssue(issues, r.error.message, undefined, doc.opdName);
      continue;
    }
    model = r.value;
  }

  // Pass 4: add appearances in each OPD for declared things.
  for (const doc of docs) {
    const actualOpdId = actualOpdIdByName.get(doc.opdName) ?? "opd-sd";
    const opd = model.opds.get(actualOpdId);
    const declaredIds = declarationsByDoc.get(doc.opdName) ?? [];
    let col = 0;
    let row = 0;
    for (const thingId of declaredIds) {
      const key = appearanceKey(thingId, actualOpdId);
      if (model.appearances.has(key)) continue;
      const appearance: Appearance = {
        thing: thingId,
        opd: actualOpdId,
        x: 120 + col * 180,
        y: 120 + row * 120,
        w: 120,
        h: 60,
        ...(opd?.refines ? { internal: true } : {}),
      };
      const r = addAppearance(model, appearance);
      if (!r.ok) {
        pushIssue(issues, r.error.message, undefined, doc.opdName);
        continue;
      }
      model = r.value;
      col++;
      if (col >= 4) {
        col = 0;
        row++;
      }
    }
  }

  // Pass 5: add inferred exhibition links for compound declarations.
  const uniqueThingRefs = new Map<string, ThingRef>();
  for (const ref of thingRefByDisplayName.values()) {
    if (!uniqueThingRefs.has(ref.thingId)) uniqueThingRefs.set(ref.thingId, ref);
  }
  for (const ref of uniqueThingRefs.values()) {
    if (!ref.exhibitorName) continue;
    const exhibitor = resolveThingRef(ref.exhibitorName, undefined, thingRefByDisplayName, thingIdsByActualName, rootSettings.locale);
    if (!exhibitor) continue;
    const link: Link = {
      id: uniqueId(`lnk-${oplSlug(exhibitor.displayName)}-exhibition-${oplSlug(ref.displayName)}`, model),
      type: "exhibition",
      source: exhibitor.thingId,
      target: ref.thingId,
    };
    const exists = [...model.links.values()].some(l => l.type === "exhibition" && l.source === link.source && l.target === link.target);
    if (exists) continue;
    const r = addLink(model, link);
    if (!r.ok) {
      pushIssue(issues, r.error.message);
      continue;
    }
    model = r.value;
  }

  // Pass 6: states
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "state-enumeration") continue;
      const thing = resolveThingRef(s.thingName, s.exhibitorName, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
      if (!thing) {
        pushIssue(issues, `Could not resolve thing for state enumeration: ${s.thingName}`, s, doc.opdName);
        continue;
      }
      for (const stateName of s.stateNames) {
        const key = `${thing.thingId}::${stateName}`;
        if (stateIdByThingAndName.has(key)) continue;
        const state: State = {
          id: uniqueId(`state-${oplSlug(thing.displayName)}-${oplSlug(stateName)}`, model),
          parent: thing.thingId,
          name: stateName,
          initial: false,
          final: false,
          default: false,
        };
        const r = addState(model, state);
        if (!r.ok) {
          pushIssue(issues, r.error.message, s, doc.opdName);
          continue;
        }
        model = r.value;
        stateIdByThingAndName.set(key, state.id);
      }
    }
  }

  // Pass 7: state qualifiers
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "state-description") continue;
      const thing = resolveThingRef(s.thingName, s.exhibitorName, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
      if (!thing) {
        pushIssue(issues, `Could not resolve thing for state description: ${s.thingName}`, s, doc.opdName);
        continue;
      }
      const key = `${thing.thingId}::${s.stateName}`;
      let stateId = stateIdByThingAndName.get(key);
      if (!stateId) {
        const state: State = {
          id: uniqueId(`state-${oplSlug(thing.displayName)}-${oplSlug(s.stateName)}`, model),
          parent: thing.thingId,
          name: s.stateName,
          initial: false,
          final: false,
          default: false,
        };
        const add = addState(model, state);
        if (!add.ok) {
          pushIssue(issues, add.error.message, s, doc.opdName);
          continue;
        }
        model = add.value;
        stateId = state.id;
        stateIdByThingAndName.set(key, stateId);
      }
      const r = updateState(model, stateId, {
        initial: s.initial,
        final: s.final,
        default: s.default,
      });
      if (!r.ok) {
        pushIssue(issues, r.error.message, s, doc.opdName);
        continue;
      }
      model = r.value;
    }
  }

  // Pass 8: durations
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "duration") continue;
      const thing = resolveThingRef(s.thingName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
      if (!thing) {
        pushIssue(issues, `Could not resolve thing for duration: ${s.thingName}`, s, doc.opdName);
        continue;
      }
      const r = updateThing(model, thing.thingId, {
        duration: {
          nominal: s.nominal,
          ...(s.min != null ? { min: s.min } : {}),
          ...(s.max != null ? { max: s.max } : {}),
          unit: s.unit,
        },
      });
      if (!r.ok) {
        pushIssue(issues, r.error.message, s, doc.opdName);
        continue;
      }
      model = r.value;
    }
  }

  // Pass 9: attribute values → ensure state exists and mark it default/current-ish.
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "attribute-value") continue;
      const thing = resolveThingRef(s.thingName, s.exhibitorName, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
      if (!thing) {
        pushIssue(issues, `Could not resolve thing for attribute-value: ${s.thingName}`, s, doc.opdName);
        continue;
      }
      const targetKey = `${thing.thingId}::${s.valueName}`;
      let targetStateId = stateIdByThingAndName.get(targetKey);
      if (!targetStateId) {
        const state: State = {
          id: uniqueId(`state-${oplSlug(thing.displayName)}-${oplSlug(s.valueName)}`, model),
          parent: thing.thingId,
          name: s.valueName,
          initial: false,
          final: false,
          default: false,
        };
        const add = addState(model, state);
        if (!add.ok) {
          pushIssue(issues, add.error.message, s, doc.opdName);
          continue;
        }
        model = add.value;
        targetStateId = state.id;
        stateIdByThingAndName.set(targetKey, targetStateId);
      }

      // One default/current state per feature object.
      for (const st of [...model.states.values()].filter(st => st.parent === thing.thingId)) {
        const patch = {
          default: st.id === targetStateId,
          current: st.id === targetStateId,
        };
        const r = updateState(model, st.id, patch);
        if (!r.ok) {
          pushIssue(issues, r.error.message, s, doc.opdName);
          continue;
        }
        model = r.value;
      }
    }
  }

  // Pass 10: grouped structural + procedural links subset.
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind === "grouped-structural") {
        if (!isSupportedGroupedStructuralType(s.linkType)) {
          if (!options.ignoreUnsupported) {
            pushIssue(issues, `Compiler subset does not support grouped structural type: ${s.linkType}`, s, doc.opdName);
          }
          continue;
        }

        const parentRef = resolveThingRef(s.parentName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
        if (!parentRef) {
          pushIssue(issues, `Could not resolve parent thing for grouped structural sentence: ${s.parentName}`, s, doc.opdName);
          continue;
        }

        for (const childName of s.childNames) {
          const childRef = resolveThingRef(childName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
          if (!childRef) {
            pushIssue(issues, `Could not resolve child thing for grouped structural sentence: ${childName}`, s, doc.opdName);
            continue;
          }

          const linkData: Link = {
            id: uniqueId(`lnk-${oplSlug(parentRef.displayName)}-${s.linkType}-${oplSlug(childRef.displayName)}`, model),
            type: s.linkType,
            source: parentRef.thingId,
            target: childRef.thingId,
            ...(s.incomplete ? { incomplete: true } : {}),
          };

          const exists = [...model.links.values()].some(l =>
            l.type === linkData.type &&
            l.source === linkData.source &&
            l.target === linkData.target,
          );
          if (exists) continue;

          const r = addLink(model, linkData);
          if (!r.ok) {
            pushIssue(issues, r.error.message, s, doc.opdName);
            continue;
          }
          model = r.value;
        }
        continue;
      }

      if (s.kind !== "link") continue;
      if (!isSupportedLinkType(s.linkType)) {
        if (!options.ignoreUnsupported) {
          pushIssue(issues, `Compiler subset does not support link type: ${s.linkType}`, s, doc.opdName);
        }
        continue;
      }

      let sourceRef = resolveThingRef(s.sourceName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
      let targetRef = s.targetName === "itself" || s.targetName === "sí mismo" || s.targetName === "si mismo"
        ? null  // will be set below
        : resolveThingRef(s.targetName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
      if (!sourceRef) {
        pushIssue(issues, `Could not resolve source thing for link: ${s.sourceName}`, s, doc.opdName);
        continue;
      }
      // Self-invocation: target = source
      if (!targetRef && (s.targetName === "itself" || s.targetName === "sí mismo" || s.targetName === "si mismo")) {
        targetRef = sourceRef;
      }
      if (!targetRef) {
        pushIssue(issues, `Could not resolve target thing for link: ${s.targetName}`, s, doc.opdName);
        continue;
      }

      const linkData: Link = {
        id: uniqueId(`lnk-${oplSlug(sourceRef.displayName)}-${s.linkType}-${oplSlug(targetRef.displayName)}`, model),
        type: s.linkType,
        source: sourceRef.thingId,
        target: targetRef.thingId,
      };

      const resolvedSourceState = resolveStateForLinkSide(model, stateIdByThingAndName, s.linkType, "source", sourceRef.thingId, targetRef.thingId, s.sourceStateName);
      const resolvedTargetState = resolveStateForLinkSide(model, stateIdByThingAndName, s.linkType, "target", sourceRef.thingId, targetRef.thingId, s.targetStateName);
      if (s.sourceStateName && !resolvedSourceState) {
        pushIssue(issues, `Could not resolve source state for link: ${s.sourceStateName}`, s, doc.opdName);
        continue;
      }
      if (s.targetStateName && !resolvedTargetState) {
        pushIssue(issues, `Could not resolve target state for link: ${s.targetStateName}`, s, doc.opdName);
        continue;
      }
      if (resolvedSourceState) linkData.source_state = resolvedSourceState;
      if (resolvedTargetState) linkData.target_state = resolvedTargetState;
      if (s.tag) linkData.tag = s.tag;
      if (s.direction) linkData.direction = s.direction;
      if (s.multiplicitySource) linkData.multiplicity_source = s.multiplicitySource;
      if (s.multiplicityTarget) linkData.multiplicity_target = s.multiplicityTarget;
      if (s.probability != null) linkData.probability = s.probability;
      if (s.pathLabel) linkData.path_label = s.pathLabel;
      if (s.exceptionType) linkData.exception_type = s.exceptionType;
      if (s.incomplete) linkData.incomplete = s.incomplete;

      const exists = [...model.links.values()].some(l =>
        l.type === linkData.type &&
        l.source === linkData.source &&
        l.target === linkData.target &&
        l.source_state === linkData.source_state &&
        l.target_state === linkData.target_state,
      );
      if (exists) continue;

      const r = addLink(model, linkData);
      if (!r.ok) {
        pushIssue(issues, r.error.message, s, doc.opdName);
        continue;
      }
      model = r.value;
    }
  }

  // Pass 11: modifiers.
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "modifier") continue;

      const over = resolveModifierOverLink(model, stateIdByThingAndName, thingRefByDisplayName, thingIdsByActualName, s, doc.renderSettings.locale);
      if (!over) {
        pushIssue(issues, `Could not resolve target link for modifier`, s, doc.opdName);
        continue;
      }

      const exists = [...model.modifiers.values()].some(m =>
        m.over === over &&
        m.type === s.modifierType &&
        !!m.negated === !!s.negated &&
        (m.condition_mode ?? undefined) === (s.conditionMode ?? undefined),
      );
      if (exists) continue;

      const r = addModifier(model, {
        id: uniqueId(`mod-${oplSlug(over)}-${s.modifierType}`, model),
        over,
        type: s.modifierType,
        ...(s.negated ? { negated: true } : {}),
        ...(s.conditionMode ? { condition_mode: s.conditionMode } : {}),
      });
      if (!r.ok) {
        pushIssue(issues, r.error.message, s, doc.opdName);
        continue;
      }
      model = r.value;
    }
  }

  // Pass 12: fans.
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "fan") continue;

      const sharedRef = resolveThingRef(s.sharedEndpointName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
      if (!sharedRef) {
        pushIssue(issues, `Could not resolve shared endpoint for fan: ${s.sharedEndpointName}`, s, doc.opdName);
        continue;
      }

      const memberLinkIds: string[] = [];
      let allResolved = true;

      for (let i = 0; i < s.memberNames.length; i++) {
        const memberName = s.memberNames[i]!;
        const memberRef = resolveThingRef(memberName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
        if (!memberRef) {
          pushIssue(issues, `Could not resolve member thing for fan: ${memberName}`, s, doc.opdName);
          allResolved = false;
          break;
        }

        const sourceRef = s.direction === "diverging" ? sharedRef : memberRef;
        const targetRef = s.direction === "diverging" ? memberRef : sharedRef;

        // Try to find an existing link of the right type.
        let existing = [...model.links.values()].find(l =>
          l.type === s.linkType &&
          l.source === sourceRef.thingId &&
          l.target === targetRef.thingId,
        );

        // Resolve states if provided.
        const srcState = s.memberSourceStateNames?.[i]
          ? resolveStateForLinkSide(model, stateIdByThingAndName, s.linkType, "source", sourceRef.thingId, targetRef.thingId, s.memberSourceStateNames[i])
          : undefined;
        const tgtState = s.memberTargetStateNames?.[i]
          ? resolveStateForLinkSide(model, stateIdByThingAndName, s.linkType, "target", sourceRef.thingId, targetRef.thingId, s.memberTargetStateNames[i])
          : undefined;

        if (existing && !srcState && !tgtState) {
          memberLinkIds.push(existing.id);
          continue;
        }

        // Check with state match too.
        if (existing && (srcState || tgtState)) {
          const stateMatch =
            (!srcState || existing.source_state === srcState) &&
            (!tgtState || existing.target_state === tgtState);
          if (stateMatch) {
            memberLinkIds.push(existing.id);
            continue;
          }
        }

        // Create the implicit link.
        const linkData: Link = {
          id: uniqueId(`lnk-${oplSlug(sourceRef.displayName)}-${s.linkType}-${oplSlug(targetRef.displayName)}`, model),
          type: s.linkType,
          source: sourceRef.thingId,
          target: targetRef.thingId,
          ...(srcState ? { source_state: srcState } : {}),
          ...(tgtState ? { target_state: tgtState } : {}),
        };
        const r = addLink(model, linkData);
        if (!r.ok) {
          pushIssue(issues, r.error.message, s, doc.opdName);
          allResolved = false;
          break;
        }
        model = r.value;
        memberLinkIds.push(linkData.id);
      }

      if (!allResolved) continue;

      const fanId = uniqueId(`fan-${oplSlug(sharedRef.displayName)}-${s.fanType}`, model);
      const r = addFan(model, {
        id: fanId,
        type: s.fanType,
        direction: s.direction,
        members: memberLinkIds,
      });
      if (!r.ok) {
        pushIssue(issues, r.error.message, s, doc.opdName);
        continue;
      }
      model = r.value;
    }
  }

  // Pass 13: requirements.
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "requirement") continue;

      const target = resolveThingRef(s.targetName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
      if (!target) {
        pushIssue(issues, `Could not resolve target for requirement: ${s.targetName}`, s, doc.opdName);
        continue;
      }

      const r = addRequirement(model, {
        id: uniqueId(`req-${oplSlug(s.name)}`, model),
        target: target.thingId,
        name: s.name,
        description: s.description,
        req_id: s.reqCode,
      });
      if (!r.ok) {
        pushIssue(issues, r.error.message, s, doc.opdName);
        continue;
      }
      model = r.value;
    }
  }

  // Pass 14: assertions.
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "assertion") continue;

      let targetId: string | undefined;
      if (s.targetName) {
        const ref = resolveThingRef(s.targetName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
        if (ref) targetId = ref.thingId;
      }

      const r = addAssertion(model, {
        id: uniqueId(`assertion-${oplSlug(s.category)}`, model),
        target: targetId,
        predicate: s.predicate,
        category: s.category as any,
        enabled: true,
      });
      if (!r.ok) {
        pushIssue(issues, r.error.message, s, doc.opdName);
        continue;
      }
      model = r.value;
    }
  }

  // Pass 15: scenarios.
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "scenario") continue;

      const r = addScenario(model, {
        id: uniqueId(`scenario-${oplSlug(s.name)}`, model),
        name: s.name,
        path_labels: s.pathLabels,
      });
      if (!r.ok) {
        pushIssue(issues, r.error.message, s, doc.opdName);
        continue;
      }
      model = r.value;
    }
  }

  // Pass 16: in-zoom sequences — create implicit invocation links between sequential subprocesses.
  for (const doc of docs) {
    for (const s of doc.sentences) {
      if (s.kind !== "in-zoom-sequence") continue;

      const parentRef = resolveThingRef(s.parentName, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
      if (!parentRef) {
        pushIssue(issues, `Could not resolve parent thing for in-zoom sequence: ${s.parentName}`, s, doc.opdName);
        continue;
      }

      for (const step of s.steps) {
        if (step.parallel) continue;

        const resolved: ThingRef[] = [];
        for (const name of step.thingNames) {
          const ref = resolveThingRef(name, undefined, thingRefByDisplayName, thingIdsByActualName, doc.renderSettings.locale);
          if (!ref) {
            pushIssue(issues, `Could not resolve step thing for in-zoom sequence: ${name}`, s, doc.opdName);
            continue;
          }
          resolved.push(ref);
        }

        // Create implicit invocation links between sequential steps
        for (let i = 0; i < resolved.length - 1; i++) {
          const src = resolved[i]!;
          const tgt = resolved[i + 1]!;
          const exists = [...model.links.values()].some(l =>
            l.type === "invocation" && l.source === src.thingId && l.target === tgt.thingId,
          );
          if (exists) continue;

          const linkData: Link = {
            id: uniqueId(`lnk-${oplSlug(src.displayName)}-invocation-${oplSlug(tgt.displayName)}`, model),
            type: "invocation",
            source: src.thingId,
            target: tgt.thingId,
          };
          const r = addLink(model, linkData);
          if (!r.ok) {
            pushIssue(issues, r.error.message, s, doc.opdName);
            continue;
          }
          model = r.value;
        }
      }
    }
  }

  if (issues.length > 0) {
    return err({ message: "Failed to compile OPL documents", issues });
  }
  return ok(model);
}

export function compileOplDocument(doc: OplDocument, options: OplCompileOptions = {}): Result<Model, OplCompileError> {
  return compileOplDocuments([doc], options);
}

function resolveStateForLinkSide(
  model: Model,
  stateIdByThingAndName: Map<string, string>,
  linkType: Link["type"],
  side: "source" | "target",
  sourceThingId: string,
  targetThingId: string,
  stateName: string | undefined,
): string | undefined {
  if (!stateName) return undefined;

  const primaryThingId = (() => {
    if (linkType === "effect") return targetThingId;
    if (linkType === "result") return targetThingId;
    if (linkType === "consumption") return sourceThingId;
    return side === "source" ? sourceThingId : targetThingId;
  })();

  const fallbackThingId = primaryThingId === sourceThingId ? targetThingId : sourceThingId;
  return stateIdByThingAndName.get(`${primaryThingId}::${stateName}`)
    ?? stateIdByThingAndName.get(`${fallbackThingId}::${stateName}`)
    ?? [...model.states.values()].find(s => s.parent === primaryThingId && s.name === stateName)?.id
    ?? [...model.states.values()].find(s => s.parent === fallbackThingId && s.name === stateName)?.id;
}

function resolveModifierOverLink(
  model: Model,
  stateIdByThingAndName: Map<string, string>,
  thingRefByDisplayName: Map<string, ThingRef>,
  thingIdsByActualName: Map<string, string[]>,
  sentence: Extract<OplSentence, { kind: "modifier" }>,
  locale: "en" | "es",
): string | null {
  const sourceRef = resolveThingRef(sentence.sourceName, undefined, thingRefByDisplayName, thingIdsByActualName, locale);
  const targetRef = resolveThingRef(sentence.targetName, undefined, thingRefByDisplayName, thingIdsByActualName, locale);
  if (!sourceRef || !targetRef) return null;

  const sourceThing = model.things.get(sourceRef.thingId);
  const targetThing = model.things.get(targetRef.thingId);
  if (!sourceThing || !targetThing) return null;

  let candidates = [...model.links.values()].filter(link => {
    const sameOrientation = link.source === sourceRef.thingId && link.target === targetRef.thingId;
    const reverseOrientation = link.source === targetRef.thingId && link.target === sourceRef.thingId;
    return sameOrientation || reverseOrientation;
  });

  if (candidates.length === 0) return null;

  // Use parser hint when it narrows meaningfully.
  const hinted = candidates.filter(link => link.type === sentence.linkType);
  if (hinted.length > 0) candidates = hinted;

  if (sentence.sourceStateName) {
    const resolved = resolveStateForLinkSide(
      model,
      stateIdByThingAndName,
      candidates[0]!.type,
      "source",
      sourceRef.thingId,
      targetRef.thingId,
      sentence.sourceStateName,
    );
    if (resolved) {
      const byState = candidates.filter(link => link.source_state === resolved || link.target_state === resolved);
      if (byState.length > 0) candidates = byState;
    }
  }
  if (sentence.targetStateName) {
    const resolved = resolveStateForLinkSide(
      model,
      stateIdByThingAndName,
      candidates[0]!.type,
      "target",
      sourceRef.thingId,
      targetRef.thingId,
      sentence.targetStateName,
    );
    if (resolved) {
      const byState = candidates.filter(link => link.source_state === resolved || link.target_state === resolved);
      if (byState.length > 0) candidates = byState;
    }
  }

  // Prefer non-structural links for modifiers.
  const procedural = candidates.filter(link => !["aggregation", "exhibition", "generalization", "classification"].includes(link.type));
  if (procedural.length > 0) candidates = procedural;

  return candidates.length === 1 ? candidates[0]!.id : candidates[0]?.id ?? null;
}

function resolveThingRef(
  thingName: string,
  exhibitorName: string | undefined,
  byDisplayName: Map<string, ThingRef>,
  idsByActualName: Map<string, string[]>,
  locale: "en" | "es",
): ThingRef | null {
  if (exhibitorName) {
    return byDisplayName.get(displayName(thingName, exhibitorName, locale))
      ?? byDisplayName.get(displayName(thingName, exhibitorName, "en"))
      ?? byDisplayName.get(displayName(thingName, exhibitorName, "es"))
      ?? null;
  }

  const exact = byDisplayName.get(thingName);
  if (exact) return exact;

  const ids = idsByActualName.get(thingName) ?? [];
  if (ids.length === 1) {
    for (const ref of byDisplayName.values()) {
      if (ref.thingId === ids[0]) return ref;
    }
  }
  return null;
}
