import type {
  Affiliation,
  Essence,
  OplEssenceVisibility,
  OplUnitsVisibility,
  TimeUnit,
} from "./types";
import type {
  OplAssertionSentence,
  OplAttributeValue,
  OplDocument,
  OplDuration,
  OplFanSentence,
  OplGroupedStructuralSentence,
  OplInZoomSequence,
  OplLinkSentence,
  OplModifierSentence,
  OplRenderSettings,
  OplRequirementSentence,
  OplScenarioSentence,
  OplSourceSpan,
  OplStateDescription,
  OplStateEnumeration,
  OplThingDeclaration,
} from "./opl-types";
import type { Result } from "./result";
import { err, ok } from "./result";
import { oplSlug } from "./opl";

export interface OplParseIssue {
  message: string;
  line: number;
  column: number;
  text: string;
}

export interface OplParseError {
  message: string;
  issues: OplParseIssue[];
}

function defaultRenderSettings(locale: "en" | "es"): OplRenderSettings {
  return {
    essenceVisibility: "all" satisfies OplEssenceVisibility,
    unitsVisibility: "always" satisfies OplUnitsVisibility,
    aliasVisibility: false,
    primaryEssence: "informatical",
    locale,
  };
}

type ParseContext = {
  thingIdByName: Map<string, string>;
  stateIdByThingAndName: Map<string, string>;
  linkCounter: number;
  locale: "en" | "es";
};

type ParsedSentence = OplDocument["sentences"][number];
type ParsedSentenceResult = ParsedSentence | ParsedSentence[] | null;

function spanForLine(lineText: string, line: number, offset: number): OplSourceSpan {
  return {
    line,
    column: 1,
    offset,
    endLine: line,
    endColumn: lineText.length + 1,
    endOffset: offset + lineText.length,
  };
}

function splitLinesWithOffsets(text: string): Array<{ lineNumber: number; text: string; offset: number }> {
  const lines = text.split("\n");
  const out: Array<{ lineNumber: number; text: string; offset: number }> = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    out.push({ lineNumber: i + 1, text: lines[i]!, offset });
    offset += lines[i]!.length + 1;
  }
  return out;
}

function pushIssue(issues: OplParseIssue[], line: number, text: string, message: string) {
  issues.push({ line, column: 1, text, message });
}

function thingId(name: string): string {
  return `thing-${oplSlug(name)}`;
}

function stateKey(thingName: string, stateName: string): string {
  return `${thingName}::${stateName}`;
}

function stateId(thingName: string, stateName: string): string {
  return `state-${oplSlug(thingName)}-${oplSlug(stateName)}`;
}

/**
 * Try to split an OPL object phrase into { state, thing } using known thing names.
 * EN: "state Thing" — state prefix
 * ES: "Thing en state" — state suffix with "en" separator
 * Returns null if the full phrase IS a known thing name (no state to extract).
 */
function splitStateAndThing(phrase: string, knownThings: Map<string, string>, locale: "en" | "es"): { stateName: string; thingName: string } | null {
  // If the full phrase is a known thing, no split needed
  if (knownThings.has(phrase)) return null;

  if (locale === "es") {
    // ES: "Thing en state" — look for " en " separator
    const enIdx = phrase.lastIndexOf(" en ");
    if (enIdx !== -1) {
      const maybeThing = phrase.slice(0, enIdx).trim();
      const maybeState = phrase.slice(enIdx + 4).trim();
      if (knownThings.has(maybeThing) && maybeState.length > 0) {
        return { stateName: maybeState, thingName: maybeThing };
      }
    }
  }

  // EN (or ES fallback): "state Thing" — try longest known thing name from the end
  const parts = phrase.split(" ");
  for (let i = parts.length - 2; i >= 0; i--) {
    const maybeThing = parts.slice(i + 1).join(" ");
    const maybeState = parts.slice(0, i + 1).join(" ");
    if (knownThings.has(maybeThing) && maybeState.length > 0) {
      return { stateName: maybeState, thingName: maybeThing };
    }
  }

  return null;
}

function ensureThing(ctx: ParseContext, name: string): string {
  const existing = ctx.thingIdByName.get(name);
  if (existing) return existing;
  const id = thingId(name);
  ctx.thingIdByName.set(name, id);
  return id;
}

function registerThingAlias(ctx: ParseContext, alias: string, id: string) {
  if (!alias.trim()) return;
  ctx.thingIdByName.set(alias, id);
}

function splitCompoundDisplay(
  raw: string,
  locale: "en" | "es",
  knownNames: Iterable<string>,
): { thingName: string; exhibitorName?: string } {
  const separator = locale === "es" ? " de " : " of ";
  const trimmed = raw.trim();
  let best: string | null = null;

  for (const candidate of knownNames) {
    if (!candidate) continue;
    if (candidate.length >= trimmed.length) continue;
    if (!trimmed.endsWith(`${separator}${candidate}`)) continue;
    if (!best || candidate.length > best.length) best = candidate;
  }

  if (!best) {
    const splitCandidates: Array<{ thingName: string; exhibitorName: string }> = [];
    let from = 0;
    while (from < trimmed.length) {
      const idx = trimmed.indexOf(separator, from);
      if (idx < 0) break;
      const thingName = trimmed.slice(0, idx).trim();
      const exhibitorName = trimmed.slice(idx + separator.length).trim();
      if (thingName && exhibitorName) splitCandidates.push({ thingName, exhibitorName });
      from = idx + separator.length;
    }

    const heuristic = splitCandidates.find(candidate => candidate.thingName.split(/\s+/).length >= 2);
    return heuristic ?? { thingName: trimmed };
  }
  const splitAt = trimmed.length - (separator.length + best.length);
  const thingName = trimmed.slice(0, splitAt).trim();
  return thingName ? { thingName, exhibitorName: best } : { thingName: trimmed };
}

function longestKnownThingSuffix(
  raw: string,
  locale: "en" | "es",
  knownNames: Iterable<string>,
): string | null {
  const separator = locale === "es" ? " de " : " of ";
  const trimmed = raw.trim();
  let best: string | null = null;

  for (const candidate of knownNames) {
    if (!candidate) continue;
    if (!trimmed.endsWith(`${separator}${candidate}`)) continue;
    if (!best || candidate.length > best.length) best = candidate;
  }

  return best;
}

function longestKnownThingPrefix(
  raw: string,
  knownNames: Iterable<string>,
): string | null {
  const trimmed = raw.trim();
  let best: string | null = null;

  for (const candidate of knownNames) {
    if (!candidate) continue;
    if (!trimmed.startsWith(candidate)) continue;
    const next = trimmed[candidate.length];
    if (next && next !== " ") continue;
    if (!best || candidate.length > best.length) best = candidate;
  }

  return best;
}

function parseList(raw: string, locale: "en" | "es"): string[] {
  const normalized = locale === "es"
    ? raw.replace(/\s+así como\s+/g, ", ").replace(/\s+u\s+/g, ", ").replace(/\s+o\s+/g, ", ").replace(/\s+y\s+/g, ", ")
    : raw.replace(/\s+as well as\s+/g, ", ").replace(/\s+or\s+/g, ", ").replace(/\s+and\s+/g, ", ");
  return normalized
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^otros? estados$/i.test(s));
}

function detectLocale(text: string): "en" | "es" {
  const lower = text.toLowerCase();
  const esSignals = [
    " es un objeto",
    " es una objeto",
    " es un proceso",
    " puede estar ",
    " maneja ",
    " requiere ",
    " consume ",
    " genera ",
    " cambia ",
    " estado ",
    " por defecto",
  ];
  return esSignals.some((s) => lower.includes(s)) ? "es" : "en";
}

function parseThingDeclaration(line: string, span: OplSourceSpan, ctx: ParseContext): OplThingDeclaration | null {
  const match = ctx.locale === "es"
    ? line.match(/^(.*?) es un(?:a)? (objeto|proceso)(.*)\.$/)
    : line.match(/^(.*?) is (a|an) (object|process)(.*)\.$/);
  if (!match) return null;

  const name = match[1]!.trim();
  const thingKindRaw = ctx.locale === "es" ? match[2]! : match[3]!;
  const normalizedThingKind: "object" | "process" =
    thingKindRaw === "objeto" ? "object" :
    thingKindRaw === "proceso" ? "process" :
    thingKindRaw as "object" | "process";
  const splitName = splitCompoundDisplay(name, ctx.locale, ctx.thingIdByName.keys());
  const tail = (ctx.locale === "es" ? match[3] : match[4]) ?? "";
  const tokens = tail.split(",").map((t) => t.trim()).filter(Boolean);

  let essence: Essence = "informatical";
  let affiliation: Affiliation = "systemic";
  let perseverance: "static" | "dynamic" | undefined;

  for (const token of tokens) {
    const normalized = token
      .replace("físico", "physical")
      .replace("física", "physical")
      .replace("informático", "informatical")
      .replace("informática", "informatical")
      .replace("ambiental", "environmental")
      .replace("sistémico", "systemic")
      .replace("sistémica", "systemic")
      .replace("dinámico", "dynamic")
      .replace("dinámica", "dynamic");
    if (normalized === "physical" || normalized === "informatical") essence = normalized;
    if (normalized === "environmental" || normalized === "systemic") affiliation = normalized;
    if (normalized === "dynamic") perseverance = "dynamic";
  }

  return {
    kind: "thing-declaration",
    thingId: (() => {
      const id = ensureThing(ctx, splitName.thingName);
      registerThingAlias(ctx, name, id);
      return id;
    })(),
    name: splitName.thingName,
    thingKind: normalizedThingKind,
    essence,
    affiliation,
    ...(perseverance ? { perseverance } : {}),
    ...(splitName.exhibitorName ? { exhibitorName: splitName.exhibitorName } : {}),
    sourceSpan: span,
  };
}

function parseStateEnumeration(line: string, span: OplSourceSpan, ctx: ParseContext): OplStateEnumeration | null {
  const match = ctx.locale === "es"
    ? line.match(/^(.*?) puede estar (.*?)\.$/)
    : line.match(/^(.*?) can be (.*?)\.$/);
  if (!match) return null;
  const displayName = match[1]!.trim();
  const splitName = splitCompoundDisplay(displayName, ctx.locale, ctx.thingIdByName.keys());
  const stateNames = parseList(match[2]!.trim(), ctx.locale);
  if (stateNames.length === 0) return null;
  const thingId = ensureThing(ctx, splitName.thingName);
  registerThingAlias(ctx, displayName, thingId);
  const stateIds = stateNames.map((name) => {
    const id = stateId(splitName.thingName, name);
    ctx.stateIdByThingAndName.set(stateKey(splitName.thingName, name), id);
    return id;
  });
  return {
    kind: "state-enumeration",
    thingId,
    thingName: splitName.thingName,
    stateIds,
    stateNames,
    ...(splitName.exhibitorName ? { exhibitorName: splitName.exhibitorName } : {}),
    sourceSpan: span,
  };
}

function parseStateDescription(line: string, span: OplSourceSpan, ctx: ParseContext): OplStateDescription | null {
  const isES = ctx.locale === "es";
  const prefix = isES ? "Estado " : "State ";
  const ofWord = isES ? " de " : " of ";
  const isWord = isES ? " es " : " is ";
  if (!line.startsWith(prefix)) return null;

  // Pattern: "State {stateName} of {thingDisplay} is {qualifiers}."
  // where thingDisplay may be "{thingName} of {exhibitorName}" (compound)
  // and stateName / thingName may contain "of"/"de" internally.
  // Strategy: match from the end — qualifiers are known, then "is/es", then
  // split the middle at the LAST "of"/"de" for stateName vs thingDisplay.
  const qualRe = isES ? /\b(inicial|final|por defecto)\b/g : /\b(initial|final|default)\b/g;
  const dotLine = line.endsWith(".") ? line.slice(0, -1) : line;

  // Split at " is " / " es "
  const isIdx = isES ? dotLine.lastIndexOf(" es ") : dotLine.lastIndexOf(" is ");
  if (isIdx < 0) return null;
  const beforeIs = dotLine.substring(0, isIdx);
  const qualRaw = dotLine.substring(isIdx + (isES ? 4 : 4)); // length of " es " / " is "

  // Validate qualifiers
  const normalizedQuals = qualRaw
    .split(isES ? /\s+y\s+/ : /\s+and\s+/)
    .map(q => q.trim())
    .map(q => q.replace("por defecto", "default").replace("inicial", "initial"));
  const validQualifiers = ["initial", "final", "default"];
  if (!normalizedQuals.every(q => validQualifiers.includes(q))) return null;

  // Now beforeIs is: "State {stateName} of {thingDisplay}" or "Estado {stateName} de {thingDisplay}"
  const rest = beforeIs.substring(prefix.length);
  if (!rest) return null;

  const thingDisplay = longestKnownThingSuffix(rest, ctx.locale, ctx.thingIdByName.keys());
  if (!thingDisplay) return null;
  const separator = isES ? " de " : " of ";
  const stateName = rest.slice(0, rest.length - (separator.length + thingDisplay.length)).trim();
  if (!stateName || !thingDisplay) return null;

  const splitName = splitCompoundDisplay(thingDisplay, ctx.locale, ctx.thingIdByName.keys());
  const thingName = splitName.thingName;
  const exhibitorName = splitName.exhibitorName;

  const thingId = ensureThing(ctx, thingName);
  registerThingAlias(ctx, thingDisplay, thingId);
  const stateIdValue = ctx.stateIdByThingAndName.get(stateKey(thingName, stateName)) ?? stateId(thingName, stateName);
  ctx.stateIdByThingAndName.set(stateKey(thingName, stateName), stateIdValue);

  return {
    kind: "state-description",
    thingId,
    thingName,
    stateId: stateIdValue,
    stateName,
    initial: normalizedQuals.includes("initial"),
    final: normalizedQuals.includes("final"),
    default: normalizedQuals.includes("default"),
    ...(exhibitorName ? { exhibitorName } : {}),
    sourceSpan: span,
  };
}

function parseDuration(line: string, span: OplSourceSpan, ctx: ParseContext): OplDuration | null {
  const verb = ctx.locale === "es" ? "requiere" : "requires";
  const rangeRe = new RegExp(`^(.*?) ${verb} (\\d+(?:\\.\\d+)?)\\s*[–\\-](\\d+(?:\\.\\d+)?)\\s*[–\\-](\\d+(?:\\.\\d+)?)(ms|s|min|h|d)\\.$`);
  const twoRe = new RegExp(`^(.*?) ${verb} (\\d+(?:\\.\\d+)?)\\s*[–\\-](\\d+(?:\\.\\d+)?)(ms|s|min|h|d)\\.$`);
  const simpleRe = new RegExp(`^(.*?) ${verb} (\\d+(?:\\.\\d+)?)(ms|s|min|h|d)\\.$`);

  let match = line.match(rangeRe);
  if (match) {
    const thingName = match[1]!.trim();
    return {
      kind: "duration",
      thingId: ensureThing(ctx, thingName),
      thingName,
      min: Number(match[2]),
      nominal: Number(match[3]),
      max: Number(match[4]),
      unit: match[5] as TimeUnit,
      sourceSpan: span,
    };
  }

  match = line.match(twoRe);
  if (match) {
    const thingName = match[1]!.trim();
    return {
      kind: "duration",
      thingId: ensureThing(ctx, thingName),
      thingName,
      nominal: Number(match[2]),
      max: Number(match[3]),
      unit: match[4] as TimeUnit,
      sourceSpan: span,
    };
  }

  match = line.match(simpleRe);
  if (match) {
    const thingName = match[1]!.trim();
    return {
      kind: "duration",
      thingId: ensureThing(ctx, thingName),
      thingName,
      nominal: Number(match[2]),
      unit: match[3] as TimeUnit,
      sourceSpan: span,
    };
  }

  return null;
}
function parseLink(line: string, span: OplSourceSpan, ctx: ParseContext): OplLinkSentence | null {
  let match = ctx.locale === "es"
    ? line.match(/^(.*?) maneja (.*?)\.$/)
    : line.match(/^(.*?) handles (.*?)\.$/);
  if (match) {
    let sourceName = match[1]!.trim();
    let targetName = match[2]!.trim();
    let sourceStateName: string | undefined;
    // Prefer full phrase as known thing name before splitting into state + thing.
    if (!ctx.thingIdByName.has(sourceName)) {
      const split = splitStateAndThing(sourceName, ctx.thingIdByName, ctx.locale);
      if (split) sourceName = split.thingName; // agent source state not used in this pattern
    }
    // Also check target for state prefix
    if (!ctx.thingIdByName.has(targetName)) {
      const split = splitStateAndThing(targetName, ctx.thingIdByName, ctx.locale);
      if (split) targetName = split.thingName;
    }
    return {
      kind: "link",
      linkId: `link-${++ctx.linkCounter}`,
      linkType: "agent",
      sourceId: ensureThing(ctx, sourceName),
      targetId: ensureThing(ctx, targetName),
      sourceName,
      targetName,
      sourceKind: "object",
      targetKind: "process",
      sourceSpan: span,
    };
  }

  match = ctx.locale === "es"
    ? line.match(/^(.*?) requiere (.*?)\.$/)
    : line.match(/^(.*?) requires (.*?)\.$/);
  if (match) {
    const targetName = match[1]!.trim();
    let sourceName = match[2]!.trim();
    let sourceStateName: string | undefined;
    // avoid consuming duration sentence
    if (/\d+(?:\.\d+)?(?:ms|s|min|h|d)$/.test(sourceName)) return null;
    // Prefer full phrase as known thing name before splitting into state + thing.
    if (!ctx.thingIdByName.has(sourceName)) {
      const split = splitStateAndThing(sourceName, ctx.thingIdByName, ctx.locale);
      if (split) {
        sourceName = split.thingName;
        sourceStateName = split.stateName;
      }
    }
    return {
      kind: "link",
      linkId: `link-${++ctx.linkCounter}`,
      linkType: "instrument",
      sourceId: ensureThing(ctx, sourceName),
      targetId: ensureThing(ctx, targetName),
      sourceName,
      targetName,
      sourceKind: "object",
      targetKind: "process",
      ...(sourceStateName ? { sourceStateName } : {}),
      sourceSpan: span,
    };
  }

  match = ctx.locale === "es"
    ? line.match(/^(.*?) consume (.*?)\.$/)
    : line.match(/^(.*?) consumes (.*?)\.$/);
  if (match) {
    const targetName = match[1]!.trim();
    const objectPhrase = match[2]!.trim();
    let sourceName = objectPhrase;
    let sourceStateName: string | undefined;
    // Prefer full phrase as known thing name before splitting into state + thing.
    if (!ctx.thingIdByName.has(objectPhrase)) {
      const split = splitStateAndThing(objectPhrase, ctx.thingIdByName, ctx.locale);
      if (split) {
        sourceName = split.thingName;
        sourceStateName = split.stateName;
      }
    }
    return {
      kind: "link",
      linkId: `link-${++ctx.linkCounter}`,
      linkType: "consumption",
      sourceId: ensureThing(ctx, sourceName),
      targetId: ensureThing(ctx, targetName),
      sourceName,
      targetName,
      sourceKind: "object",
      targetKind: "process",
      ...(sourceStateName ? { sourceStateName } : {}),
      sourceSpan: span,
    };
  }

  match = ctx.locale === "es"
    ? line.match(/^(.*?) genera (.*?)\.$/)
    : line.match(/^(.*?) yields (.*?)\.$/);
  if (match) {
    const sourceName = match[1]!.trim();
    const objectPhrase = match[2]!.trim();
    let targetName = objectPhrase;
    let targetStateName: string | undefined;
    // Prefer full phrase as known thing name before splitting into state + thing.
    if (!ctx.thingIdByName.has(objectPhrase)) {
      const split = splitStateAndThing(objectPhrase, ctx.thingIdByName, ctx.locale);
      if (split) {
        targetName = split.thingName;
        targetStateName = split.stateName;
      }
    }
    return {
      kind: "link",
      linkId: `link-${++ctx.linkCounter}`,
      linkType: "result",
      sourceId: ensureThing(ctx, sourceName),
      targetId: ensureThing(ctx, targetName),
      sourceName,
      targetName,
      sourceKind: "process",
      targetKind: "object",
      ...(targetStateName ? { targetStateName } : {}),
      sourceSpan: span,
    };
  }

  const effectVerb = ctx.locale === "es" ? " cambia " : " changes ";
  if (line.includes(effectVerb) && line.endsWith(".")) {
    const verbIdx = line.indexOf(effectVerb);
    const sourceName = line.slice(0, verbIdx).trim();
    const remainder = line.slice(verbIdx + effectVerb.length, -1).trim();
    const targetName = longestKnownThingPrefix(remainder, ctx.thingIdByName.keys());
    if (targetName) {
      const tail = remainder.slice(targetName.length).trim();
      const fromWord = ctx.locale === "es" ? "de" : "from";
      const toWord = ctx.locale === "es" ? "a" : "to";
      const fromToRe = new RegExp(`^${fromWord} (.*?) ${toWord} (.*?)$`);
      const fromRe = new RegExp(`^${fromWord} (.*?)$`);
      const toRe = new RegExp(`^${toWord} (.*?)$`);

      let sourceStateName: string | undefined;
      let targetStateName: string | undefined;
      if (!tail) {
        // no-op
      } else {
        const fromToMatch = tail.match(fromToRe);
        const fromMatch = tail.match(fromRe);
        const toMatch = tail.match(toRe);
        if (fromToMatch) {
          sourceStateName = fromToMatch[1]!.trim();
          targetStateName = fromToMatch[2]!.trim();
        } else if (fromMatch) {
          sourceStateName = fromMatch[1]!.trim();
        } else if (toMatch) {
          targetStateName = toMatch[1]!.trim();
        } else {
          return null;
        }
      }

      return {
        kind: "link",
        linkId: `link-${++ctx.linkCounter}`,
        linkType: "effect",
        sourceId: ensureThing(ctx, sourceName),
        targetId: ensureThing(ctx, targetName),
        sourceName,
        targetName,
        sourceKind: "process",
        targetKind: "object",
        ...(sourceStateName ? { sourceStateName } : {}),
        ...(targetStateName ? { targetStateName } : {}),
        sourceSpan: span,
      };
    }
  }

  match = ctx.locale === "es"
    ? line.match(/^(.*?) afecta (.*?)\.$/)
    : line.match(/^(.*?) affects (.*?)\.$/);
  if (match) {
    const sourceName = match[1]!.trim();
    const targetName = match[2]!.trim();
    return {
      kind: "link",
      linkId: `link-${++ctx.linkCounter}`,
      linkType: "effect",
      sourceId: ensureThing(ctx, sourceName),
      targetId: ensureThing(ctx, targetName),
      sourceName,
      targetName,
      sourceKind: "process",
      targetKind: "object",
      sourceSpan: span,
    };
  }

  return null;
}

function parseStructuralSentence(line: string, span: OplSourceSpan, ctx: ParseContext): OplGroupedStructuralSentence | null {
  const isES = ctx.locale === "es";
  const parseStructuralChildren = (raw: string): Pick<OplGroupedStructuralSentence, "childIds" | "childNames" | "childKinds" | "multiplicities"> & { incomplete: boolean } | null => {
    // Check for incomplete markers: "and at least one other part" / "y al menos una otra parte"
    let incomplete = false;
    let text = raw;
    const incompleteEN = "at least one other part";
    const incompleteES = "al menos una otra parte";
    if (text.endsWith(incompleteEN)) {
      incomplete = true;
      text = text.slice(0, -incompleteEN.length).replace(/,\s*$/, "").replace(/\s+and\s*$/, "").trim();
    } else if (text.endsWith(incompleteES)) {
      incomplete = true;
      text = text.slice(0, -incompleteES.length).replace(/,\s*$/, "").replace(/\s+y\s*$/, "").trim();
    }

    const parsedChildren = parseList(text, ctx.locale)
      .map((item) => parseStructuralChild(item, ctx.locale))
      .filter((item): item is { name: string; multiplicity?: string } => item != null);
    if (parsedChildren.length === 0) return null;

    const multiplicities = Object.fromEntries(
      parsedChildren
        .filter((item): item is { name: string; multiplicity: string } => item.multiplicity != null)
        .map((item) => [item.name, item.multiplicity]),
    );

    return {
      childIds: parsedChildren.map((item) => ensureThing(ctx, item.name)),
      childNames: parsedChildren.map((item) => item.name),
      childKinds: parsedChildren.map(() => "object" as const),
      ...(Object.keys(multiplicities).length > 0 ? { multiplicities } : {}),
      incomplete,
    };
  };

  // Aggregation: "X consta de A, B y C." / "X consists of A, B and C."
  let match = isES
    ? line.match(/^(.*?) consta de (.*?)\.$/)
    : line.match(/^(.*?) consists of (.*?)\.$/);
  if (match) {
    const parentName = match[1]!.trim();
    const children = parseStructuralChildren(match[2]!.trim());
    if (!children) return null;
    return {
      kind: "grouped-structural",
      linkType: "aggregation",
      parentId: ensureThing(ctx, parentName),
      parentName,
      parentKind: "object",
      ...children,
      sourceSpan: span,
    };
  }

  // Exhibition: "X exhibe A y B." / "X exhibits A and B."
  match = isES
    ? line.match(/^(.*?) exhibe (.*?)\.$/)
    : line.match(/^(.*?) exhibits (.*?)\.$/);
  if (match) {
    const parentName = match[1]!.trim();
    const children = parseStructuralChildren(match[2]!.trim());
    if (!children) return null;
    return {
      kind: "grouped-structural",
      linkType: "exhibition",
      parentId: ensureThing(ctx, parentName),
      parentName,
      parentKind: "object",
      ...children,
      sourceSpan: span,
    };
  }

  // Classification (single): "X es una instancia de Y." / "X is an instance of Y."
  match = isES
    ? line.match(/^(.*?) es una instancia de (.*?)\.$/)
    : line.match(/^(.*?) is an instance of (.*?)\.$/);
  if (match) {
    const child = parseStructuralChild(match[1]!.trim(), ctx.locale);
    if (!child) return null;
    const parentName = match[2]!.trim();
    return {
      kind: "grouped-structural",
      linkType: "classification",
      parentId: ensureThing(ctx, parentName),
      parentName,
      parentKind: "object",
      childIds: [ensureThing(ctx, child.name)],
      childNames: [child.name],
      childKinds: ["object"],
      ...(child.multiplicity ? { multiplicities: { [child.name]: child.multiplicity } } : {}),
      incomplete: false,
      sourceSpan: span,
    };
  }

  // Generalization (single): "X es un Y." (ES) / "X is a Y." (EN)
  // Generalization (single with article): "X es un Y." where parentName includes article
  match = isES
    ? line.match(/^(.*?) es un(?:a)? (.*?)\.$/)
    : line.match(/^(.*?) is (?:a |an )([A-Z].*?)\.$/);
  if (match) {
    const child = parseStructuralChild(match[1]!.trim(), ctx.locale);
    if (!child) return null;
    const parentName = match[2]!.trim();
    // Skip if it looks like a thing declaration
    if (["object", "process", "objeto", "proceso", "physical", "informatical", "físico", "informático"].includes(parentName.toLowerCase())) return null;
    // Skip if it matches thing declaration exactly
    if (isES && /^.*? es un(?:a)? (objeto|proceso)/.test(line)) return null;
    if (!isES && /^.*? is (a|an) (object|process)/.test(line)) return null;
    return {
      kind: "grouped-structural",
      linkType: "generalization",
      parentId: ensureThing(ctx, parentName),
      parentName,
      parentKind: "object",
      childIds: [ensureThing(ctx, child.name)],
      childNames: [child.name],
      childKinds: ["object"],
      ...(child.multiplicity ? { multiplicities: { [child.name]: child.multiplicity } } : {}),
      incomplete: false,
      sourceSpan: span,
    };
  }

  // Generalization (multiple): "A y B son C." (ES) / "A and B are C." (EN)
  // Also: "A and B son un C." (ES, singular parent with article)
  match = isES
    ? line.match(/^(.*?) son (?:un |una )?(.*?)\.$/)
    : line.match(/^(.*?) are (?:a |an )?(.*?)\.$/);
  if (match) {
    const children = parseStructuralChildren(match[1]!.trim());
    const parentName = match[2]!.trim();
    if (!children || children.childNames.length < 2) return null;
    // Skip thing declarations
    if (["object", "process", "objeto", "proceso"].includes(parentName.toLowerCase())) return null;
    return {
      kind: "grouped-structural",
      linkType: "generalization",
      parentId: ensureThing(ctx, parentName),
      parentName,
      parentKind: "object",
      ...children,
      sourceSpan: span,
    };
  }

  return null;
}

function parseStructuralChild(raw: string, locale: "en" | "es"): { name: string; multiplicity?: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const patterns = locale === "es"
    ? [
      [/^(?:un|una) opcional\s+(.+)$/i, "?"],
      [/^opcional(?:\s*\(cero o m[aá]s\))?\s+(.+)$/i, "*"],
      [/^al menos (?:un|una)\s+(.+)$/i, "+"],
    ] as const
    : [
      [/^an optional\s+(.+)$/i, "?"],
      [/^optional(?:\s*\(none to many\))?\s+(.+)$/i, "*"],
      [/^at least one\s+(.+)$/i, "+"],
    ] as const;

  for (const [pattern, multiplicity] of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const name = match[1]!.trim();
    if (!name) return null;
    return { name, multiplicity };
  }

  return { name: trimmed };
}

function parseModifierSentence(line: string, span: OplSourceSpan, ctx: ParseContext): OplModifierSentence | null {
  const isES = ctx.locale === "es";

  // "critical X triggers Y" / "X crítico desencadena Y"
  let match = isES
    ? line.match(/^(.*?) (.*?) desencadena (.*?)\.$/)
    : line.match(/^(.*?) (.*?) triggers (.*?)\.$/);
  if (match) {
    const maybeState = match[1]!.trim();
    const sourceName = match[2]!.trim();
    const targetName = match[3]!.trim();
    // Check if maybeState is a valid state name (not just any word)
    // Accept common patterns like "critical", "none", "low", "high", etc.
    const isStateTrigger = maybeState.length > 0 && maybeState !== sourceName;
    if (isStateTrigger) {
      return {
        kind: "modifier",
        modifierId: `modifier-${++ctx.linkCounter}`,
        linkId: `link-${ctx.linkCounter}`,
        linkType: "agent",
        sourceName,
        targetName,
        modifierType: "event",
        negated: false,
        sourceStateName: maybeState,
        sourceSpan: span,
      };
    }
  }

  // Simple event trigger: "X triggers Y." / "X desencadena Y."
  match = isES
    ? line.match(/^(.*?) desencadena (.*?)\.$/)
    : line.match(/^(.*?) triggers (.*?)\.$/);
  if (match) {
    const sourceName = match[1]!.trim();
    const targetName = match[2]!.trim();
    return {
      kind: "modifier",
      modifierId: `modifier-${++ctx.linkCounter}`,
      linkId: `link-${ctx.linkCounter}`,
      linkType: "agent",
      sourceName,
      targetName,
      modifierType: "event",
      negated: false,
      sourceSpan: span,
    };
  }

  // Simple event trigger: "X inicia Y." / "X initiates Y."
  match = isES
    ? line.match(/^(.*?) inicia (.*?)\.$/)
    : line.match(/^(.*?) initiates (.*?)\.$/);
  if (match) {
    const sourceName = match[1]!.trim();
    const targetName = match[2]!.trim();
    return {
      kind: "modifier",
      modifierId: `modifier-${++ctx.linkCounter}`,
      linkId: `link-${ctx.linkCounter}`,
      linkType: "agent",
      sourceName,
      targetName,
      modifierType: "event",
      negated: false,
      sourceSpan: span,
    };
  }

  return null;
}

/** Parse an in-zoom sequence sentence, handling parallel steps.
 *
 *  Rendered forms (EN):
 *    Sequential:  "Parent zooms into A, B, and C, as well as X, in that sequence."
 *    Mixed:       "Parent zooms into A, parallel B, C, and D, as well as X, in that sequence."
 *    All parallel: "Parent zooms into parallel A, B, and C, as well as X."
 *    Single:      "Parent zooms into A."
 *
 *  The "parallel" prefix groups items that execute concurrently.
 *  Items without prefix are sequential. Consecutive sequential items share a step.
 */
function parseInZoomSequence(line: string, span: OplSourceSpan, ctx: ParseContext): OplInZoomSequence | null {
  const isES = ctx.locale === "es";
  const parallelWord = isES ? "paralelo" : "parallel";
  const zoomVerb = isES ? "se descompone en" : "zooms into";
  const seqSuffix = isES ? ", en esa secuencia." : ", in that sequence.";

  // Try with "in that sequence" suffix first (sequential or mixed)
  let rawBody: string | null = null;
  let parentName: string | null = null;

  if (line.endsWith(seqSuffix)) {
    const prefix = line.slice(0, -seqSuffix.length);
    const verbIdx = prefix.indexOf(` ${zoomVerb} `);
    if (verbIdx === -1) return null;
    parentName = prefix.slice(0, verbIdx).trim();
    rawBody = prefix.slice(verbIdx + zoomVerb.length + 2).trim();
  } else if (line.endsWith(".")) {
    // No sequence suffix → allParallel or single-item
    const prefix = line.slice(0, -1);
    const verbIdx = prefix.indexOf(` ${zoomVerb} `);
    if (verbIdx === -1) return null;
    parentName = prefix.slice(0, verbIdx).trim();
    rawBody = prefix.slice(verbIdx + zoomVerb.length + 2).trim();
  }

  if (!rawBody || !parentName) {
    // Try refinement pattern: "SD is refined by in-zooming Process in SD1."
    const refineMatch = isES
      ? line.match(/^(.*?) se refina por descomposici[óo]n de (.*?) en (.*?)\.$/)
      : line.match(/^(.*?) is refined by in-zooming (.*?) in (.*?)\.$/);
    if (refineMatch) return null;
    return null;
  }

  // Split "as well as" to separate process list from internal objects
  const asWellAsRe = isES ? /\s+así como\s+/ : /\s+as well as\s+/;
  const parts = rawBody.split(asWellAsRe);
  const processPart = parts[0]!.trim();
  const internalObjectNames: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    internalObjectNames.push(...parseList(parts[i]!.trim(), ctx.locale));
  }

  // Parse the process list into steps with parallel flags.
  // formatList produces: "Grinding, parallel Boiling and Brewing, and Serving"
  // Split on ", and " first (Oxford comma, 3+ items), then on ", " for the rest.
  const items = splitInZoomList(processPart, ctx.locale, ctx);

  // Group items into steps: consecutive non-parallel items share a step;
  // each parallel item becomes its own step.
  const steps: { thingIds: string[]; thingNames: string[]; parallel: boolean }[] = [];
  for (const { names, parallel } of items) {
    if (parallel) {
      steps.push({
        thingIds: names.map(n => ensureThing(ctx, n)),
        thingNames: names,
        parallel: true,
      });
    } else {
      // Sequential item — if last step is also sequential, merge
      const last = steps[steps.length - 1];
      if (last && !last.parallel) {
        for (const n of names) {
          last.thingIds.push(ensureThing(ctx, n));
          last.thingNames.push(n);
        }
      } else {
        steps.push({
          thingIds: names.map(n => ensureThing(ctx, n)),
          thingNames: names,
          parallel: false,
        });
      }
    }
  }

  return {
    kind: "in-zoom-sequence",
    parentId: ensureThing(ctx, parentName),
    parentName,
    refinementType: "in-zoom",
    steps,
    ...(internalObjectNames.length > 0 ? {
      internalObjects: internalObjectNames.map(n => ({ thingId: ensureThing(ctx, n), name: n })),
    } : {}),
    sourceSpan: span,
  };
}

/** Split a formatted in-zoom process list into named groups with parallel flags.
 *
 *  Handles output from formatList where "parallel" is a prefix for parallel items.
 *  Example input:  "Grinding, parallel Boiling and Brewing, and Serving"
 *  Produces: [{ names: ["Grinding"], parallel: false },
 *             { names: ["Boiling", "Brewing"], parallel: true },
 *             { names: ["Serving"], parallel: false }]
 */
function splitInZoomList(raw: string, locale: "en" | "es", ctx: ParseContext): { names: string[]; parallel: boolean }[] {
  const parallelWord = locale === "es" ? "paralelo" : "parallel";
  const andWord = locale === "es" ? "y" : "and";

  // Replace ", and " / ", y " (Oxford comma) with a separator token.
  const OXFORD = "\x00OXFORD\x00";
  let text = raw;
  text = text.replace(new RegExp(",\\s+" + andWord + "\\s+", "g"), OXFORD);

  // Split on ", " to get segments
  const segments = text.split(/,\s*/).map(s => s.trim()).filter(Boolean);

  const result: { names: string[]; parallel: boolean }[] = [];
  for (const seg of segments) {
    // Oxford comma produces OXFORD token — split on it for separate items
    const oxfordParts = seg.split(OXFORD).map(s => s.trim()).filter(Boolean);
    for (const part of oxfordParts) {
      if (part.toLowerCase().startsWith(parallelWord + " ")) {
        const inner = part.slice(parallelWord.length).trim();
        const names = splitByKnownNames(inner, locale, ctx);
        result.push({ names, parallel: true });
      } else if (part.includes(" " + andWord + " ")) {
        const names = splitByKnownNames(part, locale, ctx);
        for (const n of names) {
          result.push({ names: [n], parallel: false });
        }
      } else {
        result.push({ names: [part], parallel: false });
      }
    }
  }

  return result;
}

/**
 * Greedy split of a string containing names joined by " y "/" and " conjunctions,
 * using known thing names to disambiguate compound names (e.g. "Alta Formal y Contrarreferencia APS")
 * from actual list conjunctions (e.g. "Trip Requesting and Road Danger Monitoring" = two items).
 *
 * Strategy: greedily match the longest known thing prefix from left to right.
 * If no known prefix matches, fall back to parseList splitting.
 */
function splitByKnownNames(raw: string, locale: "en" | "es", ctx: ParseContext): string[] {
  const knownNames = ctx.thingIdByName.keys();
  const andWord = locale === "es" ? "y" : "and";
  const andPattern = new RegExp("\\s+" + andWord + "\\s+");

  // If no conjunction present, return as-is
  if (!andPattern.test(raw)) return [raw];

  // Try full match first (common case: entire string is one compound name)
  const fullMatch = longestKnownThingPrefix(raw, knownNames);
  if (fullMatch && fullMatch.length === raw.length) return [raw];

  // Greedy left-to-right: try to consume known names
  const result: string[] = [];
  let remaining = raw;

  while (remaining.length > 0) {
    const match = longestKnownThingPrefix(remaining, knownNames);
    if (match) {
      result.push(match);
      remaining = remaining.slice(match.length).trim();
      // Strip leading conjunction
      const conjLead = new RegExp("^(?:,\\s*)?(?:" + andWord + "\\s+)?");
      remaining = remaining.replace(conjLead, "").trim();
    } else {
      // No known prefix — fall back to parseList for remainder and stop
      const fallback = parseList(remaining, locale);
      result.push(...fallback);
      break;
    }
  }

  return result.length > 0 ? result : parseList(raw, locale);
}

function parseUnfoldingSentence(line: string, span: OplSourceSpan, ctx: ParseContext): OplInZoomSequence | null {
  const match = ctx.locale === "es"
    ? line.match(/^(.*?)\s+se despliega en\s+(\S+)\s+en\s+(.*?)\.$/)
    : line.match(/^(.*?)\s+unfolds in\s+(\S+)\s+into\s+(.*?)\.$/);
  if (!match) return null;

  const parentName = match[1]!.trim();
  const childNames = parseList(match[3]!.trim(), ctx.locale);
  if (childNames.length === 0) return null;

  return {
    kind: "in-zoom-sequence",
    parentId: ensureThing(ctx, parentName),
    parentName,
    refinementType: "unfold",
    steps: [{ thingIds: childNames.map((name) => ensureThing(ctx, name)), thingNames: childNames, parallel: false }],
    sourceSpan: span,
  };
}

function parseFanSentence(line: string, span: OplSourceSpan, ctx: ParseContext): OplFanSentence | null {
  const isES = ctx.locale === "es";
  const xor = isES ? "exactamente uno de" : "exactly one of";
  const or_ = isES ? "al menos uno de" : "at least one of";

  // Try both XOR and OR for each pattern
  for (const fanType of ["xor", "or"] as const) {
    const quantifier = fanType === "xor" ? xor : or_;
    const capQ = quantifier.charAt(0).toUpperCase() + quantifier.slice(1);

    // --- Agent ---
    // Converging: "Exactly one of P1, P2 or P3 handles B." / "Exactamente uno de P1, P2 o P3 maneja B."
    {
      const re = new RegExp(`^${capQ} (.*?) ${isES ? "maneja" : "handles"} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "converging", linkType: "agent", sharedEndpointName: m[2]!.trim(), memberNames: parseList(m[1]!.trim(), ctx.locale), sourceSpan: span };
      }
    }
    // Diverging: "B handles exactly one of P1, P2 or P3." / "B maneja exactamente uno de P1, P2 o P3."
    {
      const re = new RegExp(`^(.*?) ${isES ? "maneja" : "handles"} ${quantifier} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "diverging", linkType: "agent", sharedEndpointName: m[1]!.trim(), memberNames: parseList(m[2]!.trim(), ctx.locale), sourceSpan: span };
      }
    }

    // --- Instrument ---
    // Converging: "B requires exactly one of P1, P2 or P3."
    {
      const re = new RegExp(`^(.*?) ${isES ? "requiere" : "requires"} ${quantifier} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "converging", linkType: "instrument", sharedEndpointName: m[1]!.trim(), memberNames: parseList(m[2]!.trim(), ctx.locale), sourceSpan: span };
      }
    }
    // Diverging: "Exactly one of P1, P2 or P3 requires B."
    {
      const re = new RegExp(`^${capQ} (.*?) ${isES ? "requiere" : "requires"} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "diverging", linkType: "instrument", sharedEndpointName: m[2]!.trim(), memberNames: parseList(m[1]!.trim(), ctx.locale), sourceSpan: span };
      }
    }

    // --- Consumption ---
    // Converging: "P consumes exactly one of A, B or C."
    {
      const verb = isES ? "consume" : "consumes";
      const re = new RegExp(`^(.*?) ${verb} ${quantifier} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "converging", linkType: "consumption", sharedEndpointName: m[1]!.trim(), memberNames: parseList(m[2]!.trim(), ctx.locale), sourceSpan: span };
      }
    }
    // Diverging: "Exactly one of P, Q or R consumes B."
    {
      const verb = isES ? "consume" : "consumes";
      const re = new RegExp(`^${capQ} (.*?) ${verb} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "diverging", linkType: "consumption", sharedEndpointName: m[2]!.trim(), memberNames: parseList(m[1]!.trim(), ctx.locale), sourceSpan: span };
      }
    }

    // --- Result ---
    // Diverging: "P yields exactly one of A, B or C." / "P genera exactamente uno de A, B o C."
    {
      const verb = isES ? "genera" : "yields";
      const re = new RegExp(`^(.*?) ${verb} ${quantifier} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "diverging", linkType: "result", sharedEndpointName: m[1]!.trim(), memberNames: parseList(m[2]!.trim(), ctx.locale), sourceSpan: span };
      }
    }
    // Converging: "Exactly one of P, Q or R yields B."
    {
      const verb = isES ? "genera" : "yields";
      const re = new RegExp(`^${capQ} (.*?) ${verb} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "converging", linkType: "result", sharedEndpointName: m[2]!.trim(), memberNames: parseList(m[1]!.trim(), ctx.locale), sourceSpan: span };
      }
    }

    // --- Effect ---
    // Diverging: "P affects exactly one of A, B or C."
    {
      const verb = isES ? "afecta" : "affects";
      const re = new RegExp(`^(.*?) ${verb} ${quantifier} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "diverging", linkType: "effect", sharedEndpointName: m[1]!.trim(), memberNames: parseList(m[2]!.trim(), ctx.locale), sourceSpan: span };
      }
    }
    // Converging: "Exactly one of P, Q or R affects B."
    {
      const verb = isES ? "afecta" : "affects";
      const re = new RegExp(`^${capQ} (.*?) ${verb} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "converging", linkType: "effect", sharedEndpointName: m[2]!.trim(), memberNames: parseList(m[1]!.trim(), ctx.locale), sourceSpan: span };
      }
    }

    // --- Invocation ---
    // Diverging: "P invokes exactly one of Q or R."
    {
      const verb = isES ? "invoca" : "invokes";
      const re = new RegExp(`^(.*?) ${verb} ${quantifier} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "diverging", linkType: "invocation", sharedEndpointName: m[1]!.trim(), memberNames: parseList(m[2]!.trim(), ctx.locale), sourceSpan: span };
      }
    }
    // Converging: "Exactly one of P or Q invokes R."
    {
      const verb = isES ? "invoca" : "invokes";
      const re = new RegExp(`^${capQ} (.*?) ${verb} (.*?)\\.$`);
      const m = line.match(re);
      if (m) {
        return { kind: "fan", fanId: `fan-${++ctx.linkCounter}`, fanType, direction: "converging", linkType: "invocation", sharedEndpointName: m[2]!.trim(), memberNames: parseList(m[1]!.trim(), ctx.locale), sourceSpan: span };
      }
    }
  }

  return null;
}

function parseAttributeValue(line: string, span: OplSourceSpan, ctx: ParseContext): OplAttributeValue | null {
  const isES = ctx.locale === "es";
  const isWord = isES ? " es " : " is ";
  const dotLine = line.endsWith(".") ? line.slice(0, -1) : line;
  const isIdx = dotLine.lastIndexOf(isWord);
  if (isIdx < 0) return null;
  const thingDisplay = dotLine.slice(0, isIdx).trim();
  const valueName = dotLine.slice(isIdx + isWord.length).trim();
  // NOTE: do NOT reject lines starting with "Estado"/"State" here.
  // State-descriptions with non-standard qualifiers (like "deteriorado")
  // already return null from parseStateDescription, and should fall through
  // to attribute-value parsing. E.g. "Estado de Salud de Paciente Group es deteriorado."
  // is an attribute-value, not a state-description.
  // Disambiguate from thing declaration: "X is an object."
  if (["object", "process", "objeto", "proceso"].includes(valueName.toLowerCase())) return null;
  const splitName = splitCompoundDisplay(thingDisplay, ctx.locale, ctx.thingIdByName.keys());
  if (!splitName.exhibitorName) return null;
  return {
    kind: "attribute-value",
    thingId: (() => {
      const id = ensureThing(ctx, splitName.thingName);
      registerThingAlias(ctx, thingDisplay, id);
      return id;
    })(),
    thingName: splitName.thingName,
    exhibitorId: ensureThing(ctx, splitName.exhibitorName),
    exhibitorName: splitName.exhibitorName,
    valueName,
    sourceSpan: span,
  };
}

function parseRequirement(line: string, span: OplSourceSpan, ctx: ParseContext): OplRequirementSentence | null {
  // "[R-01] Name: description (applies to X)." / "[R-01] Nombre: descripción (aplica a X)."
  const match = line.match(/^\[([A-Z]-\d+)\]\s*(.*?):\s*(.*?)\s*\((?:applies to|aplica a)\s+(.*?)\)\.$/);
  if (!match) return null;
  return {
    kind: "requirement",
    reqId: `req-${match[1]}`,
    reqCode: match[1]!,
    name: match[2]!.trim(),
    description: match[3]!.trim(),
    targetName: match[4]!.trim(),
    sourceSpan: span,
  };
}

function parseAssertion(line: string, span: OplSourceSpan, ctx: ParseContext): OplAssertionSentence | null {
  // "[correctness] predicate" / "[correctitud] predicado"
  const match = line.match(/^\[(.*?)\]\s*(.+)$/);
  if (!match) return null;
  const categoryRaw = match[1]!.trim();
  const predicate = match[2]!.trim().replace(/\.$/, "");
  // Skip if this is a requirement (R-XX format)
  if (/^[A-Z]-\d+$/.test(categoryRaw)) return null;
  // Skip if this is a scenario
  const isES = ctx.locale === "es";
  const scenarioPrefix = isES ? "escenario: " : "scenario: ";
  if (categoryRaw.toLowerCase().startsWith(scenarioPrefix.trim())) return null;
  // Normalize category
  const categoryMap: Record<string, string> = {
    "correctness": "correctness", "correctitud": "correctness",
    "safety": "safety", "seguridad": "safety",
    "liveness": "liveness", "vivacidad": "liveness",
  };
  const category = categoryMap[categoryRaw.toLowerCase()] ?? categoryRaw;
  return {
    kind: "assertion",
    assertionId: `assertion-${++ctx.linkCounter}`,
    predicate,
    targetName: "",
    category,
    sourceSpan: span,
  };
}

function parseScenario(line: string, span: OplSourceSpan, ctx: ParseContext): OplScenarioSentence | null {
  const isES = ctx.locale === "es";
  // "[scenario: Name] 5 links on path \"label\"" / "[escenario: Nombre] 5 enlaces en ruta \"etiqueta\""
  const match = isES
    ? line.match(/^\[escenario:\s*(.*?)\]\s*(\d+) enlaces en ruta \"(.*?)\"$/)
    : line.match(/^\[scenario:\s*(.*?)\]\s*(\d+) links on path \"(.*?)\"$/);
  if (!match) return null;
  return {
    kind: "scenario",
    scenarioId: `scenario-${++ctx.linkCounter}`,
    name: match[1]!.trim(),
    pathLabels: match[3]!.split(", ").map(s => s.trim()),
    linkCount: Number(match[2]),
    sourceSpan: span,
  };
}

function parseExceptionLink(line: string, span: OplSourceSpan, ctx: ParseContext): OplLinkSentence | null {
  const isES = ctx.locale === "es";

  // Generic exception: "Q handles exception from P." / "Q maneja excepción de P."
  const excPatterns: { re: RegExp; exceptionType: "overtime" | "undertime" | undefined }[] = isES
    ? [
      { re: /^(.*?) maneja excepción de sobretiempo de (.*?)\.$/, exceptionType: "overtime" },
      { re: /^(.*?) maneja excepción de subtiempo de (.*?)\.$/, exceptionType: "undertime" },
      { re: /^(.*?) maneja excepción de (.*?)\.$/, exceptionType: undefined },
    ]
    : [
      { re: /^(.*?) handles overtime exception from (.*?)\.$/, exceptionType: "overtime" },
      { re: /^(.*?) handles undertime exception from (.*?)\.$/, exceptionType: "undertime" },
      { re: /^(.*?) handles exception from (.*?)\.$/, exceptionType: undefined },
    ];

  for (const { re, exceptionType } of excPatterns) {
    const match = line.match(re);
    if (!match) continue;
    const targetName = match[1]!.trim();
    const sourceName = match[2]!.trim();
    return {
      kind: "link",
      linkId: `link-${++ctx.linkCounter}`,
      linkType: "exception",
      sourceId: ensureThing(ctx, sourceName),
      targetId: ensureThing(ctx, targetName),
      sourceName,
      targetName,
      sourceKind: "process",
      targetKind: "process",
      ...(exceptionType ? { exceptionType } : {}),
      sourceSpan: span,
    };
  }

  // Duration-based exceptions
  const patterns = isES
    ? [
      { re: /^(.*?) ocurre si duración de (.*?) excede \d+(?:\.\d+)?(?:ms|s|min|h|d)\.$/, exceptionType: "overtime" as const },
      { re: /^(.*?) ocurre si duración de (.*?) es menor que \d+(?:\.\d+)?(?:ms|s|min|h|d)\.$/, exceptionType: "undertime" as const },
    ]
    : [
      { re: /^(.*?) occurs if duration of (.*?) exceeds \d+(?:\.\d+)?(?:ms|s|min|h|d)\.$/, exceptionType: "overtime" as const },
      { re: /^(.*?) occurs if duration of (.*?) falls short of \d+(?:\.\d+)?(?:ms|s|min|h|d)\.$/, exceptionType: "undertime" as const },
    ];

  for (const { re, exceptionType } of patterns) {
    const match = line.match(re);
    if (!match) continue;
    const targetName = match[1]!.trim();
    const sourceName = match[2]!.trim();
    return {
      kind: "link",
      linkId: `link-${++ctx.linkCounter}`,
      linkType: "invocation",
      sourceId: ensureThing(ctx, sourceName),
      targetId: ensureThing(ctx, targetName),
      sourceName,
      targetName,
      sourceKind: "process",
      targetKind: "process",
      exceptionType,
      sourceSpan: span,
    };
  }

  return null;
}

function parseInvocation(line: string, span: OplSourceSpan, ctx: ParseContext): OplLinkSentence | null {
  const isES = ctx.locale === "es";
  // "P invokes Q." / "P invoca Q."
  const match = isES
    ? line.match(/^(.*?) invoca (.*?)\.$/)
    : line.match(/^(.*?) invokes (.*?)\.$/);
  if (!match) return null;
  const sourceName = match[1]!.trim();
  const targetName = match[2]!.trim();
  return {
    kind: "link",
    linkId: `link-${++ctx.linkCounter}`,
    linkType: "invocation",
    sourceId: ensureThing(ctx, sourceName),
    targetId: ensureThing(ctx, targetName),
    sourceName,
    targetName,
    sourceKind: "process",
    targetKind: "process",
    sourceSpan: span,
  };
}

function parseTaggedLink(line: string, span: OplSourceSpan, ctx: ParseContext): OplLinkSentence | null {
  const isES = ctx.locale === "es";

  // "Source relates to Destination." / "Origen se relaciona con Destino."
  let match = isES
    ? line.match(/^(.*?) se relaciona con (.*?)\.$/)
    : line.match(/^(.*?) relates to (.*?)\.$/);
  if (match) {
    const sourceName = match[1]!.trim();
    const targetName = match[2]!.trim();
    return {
      kind: "link",
      linkId: `link-${++ctx.linkCounter}`,
      linkType: "tagged",
      sourceId: ensureThing(ctx, sourceName),
      targetId: ensureThing(ctx, targetName),
      sourceName,
      targetName,
      sourceKind: "object",
      targetKind: "object",
      sourceSpan: span,
    };
  }

  // Generic tagged link: "A verb-phrase B." where A and B are known things.
  // This catches patterns like:
  //   "Driver communicates via OnStar Console."
  //   "Cuidador habita en Domicilio."
  //   "Cuidador acompaña a Paciente."
  //   "Paciente reside en Domicilio."
  // Strategy: find the longest known thing name from the start and end,
  // the middle is the tag.
  if (!line.endsWith(".")) return null;
  const noDot = line.slice(0, -1);
  
  // Try to match against known thing names
  const knownNames = [...ctx.thingIdByName.keys()].sort((a, b) => b.length - a.length);
  for (const startName of knownNames) {
    if (!noDot.startsWith(startName)) continue;
    const rest = noDot.substring(startName.length).trim();
    if (!rest) continue;
    for (const endName of knownNames) {
      if (startName === endName) continue;
      if (!rest.endsWith(endName)) continue;
      const tag = rest.slice(0, rest.length - endName.length).trim();
      if (!tag || tag.length < 2) continue;
      // Valid: startName + tag + endName
      return {
        kind: "link",
        linkId: `link-${++ctx.linkCounter}`,
        linkType: "tagged",
        sourceId: ensureThing(ctx, startName),
        targetId: ensureThing(ctx, endName),
        sourceName: startName,
        targetName: endName,
        tag,
        sourceKind: "object",
        targetKind: "object",
        sourceSpan: span,
      };
    }
  }

  return null;
}

function parseConditionModifier(line: string, span: OplSourceSpan, ctx: ParseContext): OplModifierSentence | null {
  const isES = ctx.locale === "es";
  // "P ocurre si Objeto existe, en cuyo caso Objeto se consume, de lo contrario P se omite."
  // "P occurs if Object exists, in which case Object is consumed, otherwise P is skipped."
  let match = isES
    ? line.match(/^(.*?) ocurre si (.*?) existe, en cuyo caso (.*?) se consume, de lo contrario (.*?) se omite\.$/)
    : line.match(/^(.*?) occurs if (.*?) exists, in which case (.*?) is consumed, otherwise (.*?) is skipped\.$/);
  if (match) {
    const sourceName = match[2]!.trim();
    const targetName = match[1]!.trim();
    return {
      kind: "modifier",
      modifierId: `modifier-${++ctx.linkCounter}`,
      linkId: `link-${ctx.linkCounter}`,
      linkType: "consumption",
      sourceName,
      targetName,
      modifierType: "condition",
      negated: false,
      conditionMode: "skip",
      sourceSpan: span,
    };
  }

  // "Agent handles Process if Agent exists, else Process is skipped."
  // "Agente maneja Proceso si Agente existe, de lo contrario Proceso se omite."
  match = isES
    ? line.match(/^(.*?) maneja (.*?) si (.*?) existe, de lo contrario (.*?) se omite\.$/)
    : line.match(/^(.*?) handles (.*?) if (.*?) exists, else (.*?) is skipped\.$/);
  if (match) {
    const sourceName = match[1]!.trim();
    const targetName = match[2]!.trim();
    return {
      kind: "modifier",
      modifierId: `modifier-${++ctx.linkCounter}`,
      linkId: `link-${ctx.linkCounter}`,
      linkType: "agent",
      sourceName,
      targetName,
      modifierType: "condition",
      negated: false,
      conditionMode: "skip",
      sourceSpan: span,
    };
  }

  // "P occurs if Object is specified-state, in which case Object is consumed, otherwise Process is skipped."
  match = isES
    ? line.match(/^(.*?) ocurre si (.*?) está en (.*?), en cuyo caso (.*?) se consume, de lo contrario (.*?) se omite\.$/)
    : line.match(/^(.*?) occurs if (.*?) is (.*?), in which case (.*?) is consumed, otherwise (.*?) is skipped\.$/);
  if (match) {
    const targetName = match[1]!.trim();
    const sourceName = match[2]!.trim();
    const sourceStateName = match[3]!.trim();
    return {
      kind: "modifier",
      modifierId: `modifier-${++ctx.linkCounter}`,
      linkId: `link-${ctx.linkCounter}`,
      linkType: "consumption",
      sourceName,
      targetName,
      modifierType: "condition",
      negated: false,
      conditionMode: "skip",
      sourceStateName,
      sourceSpan: span,
    };
  }

  // "P occurs if Object is state, otherwise P is skipped." (condition on effect link)
  // "P ocurre si Objeto está en estado, de lo contrario P se omite."
  match = isES
    ? line.match(/^(.*?) ocurre si (.*?) está en (.*?), de lo contrario (.*?) se omite\.$/)
    : line.match(/^(.*?) occurs if (.*?) is (.*?), otherwise (.*?) is skipped\.$/);
  if (match) {
    const targetName = match[1]!.trim();
    const sourceName = match[2]!.trim();
    const sourceStateName = match[3]!.trim();
    return {
      kind: "modifier",
      modifierId: `modifier-${++ctx.linkCounter}`,
      linkId: `link-${ctx.linkCounter}`,
      linkType: "effect",
      sourceName,
      targetName,
      modifierType: "condition",
      negated: false,
      conditionMode: "skip",
      sourceStateName,
      sourceSpan: span,
    };
  }

  return null;
}

function parsePathLabelClause(line: string, span: OplSourceSpan, ctx: ParseContext): ParsedSentenceResult {
  const clausePatterns = ctx.locale === "es"
    ? [
      { re: /^(.*?) maneja (.*?)\.$/, build: (subject: string, item: string) => `${subject} maneja ${item}.` },
      { re: /^(.*?) requiere (.*?)\.$/, build: (subject: string, item: string) => `${subject} requiere ${item}.` },
      { re: /^(.*?) consume (.*?)\.$/, build: (subject: string, item: string) => `${subject} consume ${item}.` },
      { re: /^(.*?) genera (.*?)\.$/, build: (subject: string, item: string) => `${subject} genera ${item}.` },
      { re: /^(.*?) invoca (.*?)\.$/, build: (subject: string, item: string) => `${subject} invoca ${item}.` },
    ]
    : [
      { re: /^(.*?) handles (.*?)\.$/, build: (subject: string, item: string) => `${subject} handles ${item}.` },
      { re: /^(.*?) requires (.*?)\.$/, build: (subject: string, item: string) => `${subject} requires ${item}.` },
      { re: /^(.*?) consumes (.*?)\.$/, build: (subject: string, item: string) => `${subject} consumes ${item}.` },
      { re: /^(.*?) yields (.*?)\.$/, build: (subject: string, item: string) => `${subject} yields ${item}.` },
      { re: /^(.*?) invokes (.*?)\.$/, build: (subject: string, item: string) => `${subject} invokes ${item}.` },
    ];

  for (const { re, build } of clausePatterns) {
    const match = line.match(re);
    if (!match) continue;
    const subject = match[1]!.trim();
    const items = parseList(match[2]!.trim(), ctx.locale);
    if (items.length <= 1) continue;
    const sentences: ParsedSentence[] = items
      .map((item) => parseSentence(build(subject, item), span, ctx))
      .flatMap((sentence) => !sentence ? [] : Array.isArray(sentence) ? sentence : [sentence]);
    return sentences.length > 0 ? sentences : null;
  }

  return parseSentence(line, span, ctx);
}

function parsePathLabelLine(line: string, span: OplSourceSpan, ctx: ParseContext): ParsedSentenceResult {
  const match = ctx.locale === "es"
    ? line.match(/^Por ruta (.*?),\s*(.*)$/)
    : line.match(/^Following path (.*?),\s*(.*)$/);
  if (!match) return null;

  const pathLabel = match[1]!.trim();
  const remainder = match[2]!.trim();
  if (!pathLabel || !remainder) return null;

  const parsed: ParsedSentenceResult = (() => {
    const verbPattern = ctx.locale === "es"
      ? /\b(maneja|requiere|consume|genera|cambia|afecta|invoca)\b/
      : /\b(handles|requires|consumes|yields|changes|affects|invokes)\b/;
    const splitPattern = ctx.locale === "es"
      ? /,\s*(?=(?:maneja|requiere|consume|genera|cambia|afecta|invoca)\b)/g
      : /,\s*(?=(?:handles|requires|consumes|yields|changes|affects|invokes)\b)/g;
    const verbMatch = remainder.match(verbPattern);
    if (!verbMatch || verbMatch.index == null) return null;
    const subject = remainder.slice(0, verbMatch.index).trim();
    const clauseText = remainder.slice(verbMatch.index).trim();
    if (!subject || !clauseText) return null;

    const sentences: ParsedSentence[] = clauseText
      .split(splitPattern)
      .flatMap((clause) => {
        const normalized = clause.trim().replace(/\.$/, "");
        if (!normalized) return [];
        const fullClause = `${subject} ${normalized}.`;
        const sentence = parsePathLabelClause(fullClause, span, ctx);
        if (!sentence) return [];
        return Array.isArray(sentence) ? sentence : [sentence];
      });
    return sentences.length > 0 ? sentences : parsePathLabelClause(remainder, span, ctx);
  })();
  if (!parsed) return null;

  const sentences: ParsedSentence[] = Array.isArray(parsed) ? parsed : [parsed];
  return sentences.map((sentence) => sentence.kind === "link" ? { ...sentence, pathLabel } : sentence);
}

function parseSentence(line: string, span: OplSourceSpan, ctx: ParseContext): ParsedSentenceResult {
  // Try "Por ruta X, ..." / "Following path X, ..." prefix format first
  const pathLabeled: ParsedSentenceResult = parsePathLabelLine(line, span, ctx);
  if (pathLabeled) return pathLabeled;

  // Detect inline [ruta: X] / [path: X] suffix and strip it before parsing.
  // The renderer appends " [ruta: X]." to link sentences; the parser must strip it
  // and reattach the pathLabel to the parsed link.
  let inlinePathLabel: string | undefined;
  let cleanLine = line;
  const inlinePathMatch = line.match(/\s*\[(?:ruta|path):\s*(.+?)\]\s*\.?$/);
  if (inlinePathMatch) {
    inlinePathLabel = inlinePathMatch[1]!.trim();
    cleanLine = line.slice(0, inlinePathMatch.index!).trim();
    if (!cleanLine.endsWith(".")) cleanLine += ".";
  }

  // Bracketed sentences ([R-01], [correctness], [scenario: ...]) must be tried before generic link parsing
  // because "X requires Y" after [bracket] gets consumed by instrument link parser.
  const bracketed = parseRequirement(cleanLine, span, ctx) ?? parseScenario(cleanLine, span, ctx) ?? parseAssertion(cleanLine, span, ctx);
  if (bracketed) return bracketed;

  const result = parseThingDeclaration(cleanLine, span, ctx)
    ?? parseStateEnumeration(cleanLine, span, ctx)
    ?? parseStateDescription(cleanLine, span, ctx)
    ?? parseDuration(cleanLine, span, ctx)
    ?? parseStructuralSentence(cleanLine, span, ctx)
    ?? parseFanSentence(cleanLine, span, ctx)
    ?? parseModifierSentence(cleanLine, span, ctx)
    ?? parseConditionModifier(cleanLine, span, ctx)
    ?? parseInZoomSequence(cleanLine, span, ctx)
    ?? parseUnfoldingSentence(cleanLine, span, ctx)
    ?? parseExceptionLink(cleanLine, span, ctx)
    ?? parseAttributeValue(cleanLine, span, ctx)
    ?? parseInvocation(cleanLine, span, ctx)
    ?? parseLink(cleanLine, span, ctx)
    ?? parseTaggedLink(cleanLine, span, ctx);

  // Attach inline pathLabel to link sentences
  if (result && inlinePathLabel) {
    if (Array.isArray(result)) {
      return result.map(s => s.kind === "link" ? { ...s, pathLabel: inlinePathLabel } : s);
    }
    return result.kind === "link" ? { ...result, pathLabel: inlinePathLabel } : result;
  }

  return result;
}

function parseRefinementEdge(line: string): { parentOpdName: string; refinementType: "in-zoom" | "unfold"; refinedThingName: string; childOpdName: string } | null {
  // EN: "SD is refined by in-zooming Coffee Making in SD1."
  // EN: "SD1 is refined by unfolding AEV Fleet Operating in SD1.1."
  let m = line.match(/^(.*?) is refined by in-zooming (.*?) in (.*?)\.$/);
  if (m) return { parentOpdName: m[1]!.trim(), refinementType: "in-zoom", refinedThingName: m[2]!.trim(), childOpdName: m[3]!.trim() };
  m = line.match(/^(.*?) is refined by unfolding (.*?) in (.*?)\.$/);
  if (m) return { parentOpdName: m[1]!.trim(), refinementType: "unfold", refinedThingName: m[2]!.trim(), childOpdName: m[3]!.trim() };

  // ES: "SD se refina por descomposición de Proceso en SD1."
  m = line.match(/^(.*?) se refina por descomposici[óo]n de (.*?) en (.*?)\.$/);
  if (m) return { parentOpdName: m[1]!.trim(), refinementType: "in-zoom", refinedThingName: m[2]!.trim(), childOpdName: m[3]!.trim() };
  // ES: "SD se refina por despliegue de Proceso en SD1."
  m = line.match(/^(.*?) se refina por despliegue de (.*?) en (.*?)\.$/);
  if (m) return { parentOpdName: m[1]!.trim(), refinementType: "unfold", refinedThingName: m[2]!.trim(), childOpdName: m[3]!.trim() };

  return null;
}

export function parseOplDocument(text: string, opdName = "SD", opdId = `opd-${oplSlug(opdName) || "sd"}`): Result<OplDocument, OplParseError> {
  const locale = detectLocale(text);
  const ctx: ParseContext = {
    thingIdByName: new Map(),
    stateIdByThingAndName: new Map(),
    linkCounter: 0,
    locale,
  };
  const issues: OplParseIssue[] = [];
  const sentences = [] as OplDocument["sentences"];
  const lines = splitLinesWithOffsets(text);

  let refinementEdge: OplDocument["refinementEdge"];

  for (const entry of lines) {
    const raw = entry.text;
    const line = raw.trim();
    if (!line) continue;
    const span = spanForLine(raw, entry.lineNumber, entry.offset);

    // Try refinement edge first (it's a document-level property, not a sentence)
    const edge = parseRefinementEdge(line);
    if (edge) {
      refinementEdge = edge;
      continue;
    }

    const sentence = parseSentence(line, span, ctx);
    if (!sentence) {
      pushIssue(issues, entry.lineNumber, raw, "Unsupported or invalid OPL sentence in current parser subset");
      continue;
    }
    if (Array.isArray(sentence)) sentences.push(...sentence);
    else sentences.push(sentence);
  }

  if (issues.length > 0) {
    return err({ message: "Failed to parse OPL document", issues });
  }

  return ok({
    opdId,
    opdName,
    sentences,
    renderSettings: defaultRenderSettings(locale),
    sourceText: text,
    ...(refinementEdge ? { refinementEdge } : {}),
    sourceSpan: {
      line: 1,
      column: 1,
      offset: 0,
      endLine: lines.length,
      endColumn: (lines.at(-1)?.text.length ?? 0) + 1,
      endOffset: text.length,
    },
  });
}

export function parseOplDocuments(text: string): Result<OplDocument[], OplParseError> {
  const lines = splitLinesWithOffsets(text);
  const sections: Array<{ name: string; lines: string[] }> = [];
  let current: { name: string; lines: string[] } | null = null;

  for (const entry of lines) {
    const trimmed = entry.text.trim();
    const match = trimmed.match(/^=== (.*?) ===$/);
    if (match) {
      current = { name: match[1]!.trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      if (!trimmed) continue;
      return err({
        message: "Expected section header before OPL content",
        issues: [{ line: entry.lineNumber, column: 1, text: entry.text, message: "Missing section header" }],
      });
    }
    current.lines.push(entry.text);
  }

  if (sections.length === 0) {
    return err({
      message: "No OPL sections found",
      issues: [{ line: 1, column: 1, text, message: "Expected at least one === OPD === section header" }],
    });
  }

  const documents: OplDocument[] = [];
  for (const section of sections) {
    const parsed = parseOplDocument(section.lines.join("\n"), section.name, `opd-${oplSlug(section.name) || "section"}`);
    if (!parsed.ok) return parsed;
    documents.push(parsed.value);
  }
  return ok(documents);
}
