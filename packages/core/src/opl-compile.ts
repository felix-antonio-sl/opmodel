import type { Result } from "./result";
import { err, ok } from "./result";
import { createModel } from "./model";
import { oplSlug } from "./opl";
import { appearanceKey, collectAllIds } from "./helpers";
import {
  addAppearance,
  addLink,
  addOPD,
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
  ].includes(kind);
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

  if (issues.length > 0) {
    return err({ message: "Failed to compile OPL documents", issues });
  }
  return ok(model);
}

export function compileOplDocument(doc: OplDocument, options: OplCompileOptions = {}): Result<Model, OplCompileError> {
  return compileOplDocuments([doc], options);
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
