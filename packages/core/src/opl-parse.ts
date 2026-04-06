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

function ensureThing(ctx: ParseContext, name: string): string {
  const existing = ctx.thingIdByName.get(name);
  if (existing) return existing;
  const id = thingId(name);
  ctx.thingIdByName.set(name, id);
  return id;
}

function parseList(raw: string, locale: "en" | "es"): string[] {
  const normalized = locale === "es"
    ? raw.replace(/\s+u\s+/g, ", ").replace(/\s+o\s+/g, ", ").replace(/\s+y\s+/g, ", ")
    : raw.replace(/\s+or\s+/g, ", ").replace(/\s+and\s+/g, ", ");
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
    thingId: ensureThing(ctx, name),
    name,
    thingKind: normalizedThingKind,
    essence,
    affiliation,
    ...(perseverance ? { perseverance } : {}),
    sourceSpan: span,
  };
}

function parseStateEnumeration(line: string, span: OplSourceSpan, ctx: ParseContext): OplStateEnumeration | null {
  const match = ctx.locale === "es"
    ? line.match(/^(.*?) puede estar (.*?)\.$/)
    : line.match(/^(.*?) can be (.*?)\.$/);
  if (!match) return null;
  const thingName = match[1]!.trim();
  const stateNames = parseList(match[2]!.trim(), ctx.locale);
  if (stateNames.length === 0) return null;
  const thingId = ensureThing(ctx, thingName);
  const stateIds = stateNames.map((name) => {
    const id = stateId(thingName, name);
    ctx.stateIdByThingAndName.set(stateKey(thingName, name), id);
    return id;
  });
  return {
    kind: "state-enumeration",
    thingId,
    thingName,
    stateIds,
    stateNames,
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
  // Strip prefix: "State " or "Estado "
  const rest = beforeIs.substring(prefix.length);
  if (!rest) return null;

  // Split at the LAST "of"/"de" to separate stateName from thingDisplay
  const lastOfIdx = isES ? rest.lastIndexOf(" de ") : rest.lastIndexOf(" of ");
  if (lastOfIdx < 0) return null;

  const stateName = rest.substring(0, lastOfIdx).trim();
  const thingDisplay = rest.substring(lastOfIdx + (isES ? 4 : 4)).trim(); // length of " de " / " of "
  if (!stateName || !thingDisplay) return null;

  // Check if thingDisplay contains another "of"/"de" → compound form: "{thingName} de {exhibitorName}"
  let thingName: string;
  let exhibitorName: string | undefined;
  const innerOfIdx = isES ? thingDisplay.lastIndexOf(" de ") : thingDisplay.lastIndexOf(" of ");
  if (innerOfIdx > 0) {
    thingName = thingDisplay.substring(0, innerOfIdx).trim();
    exhibitorName = thingDisplay.substring(innerOfIdx + (isES ? 4 : 4)).trim();
  } else {
    thingName = thingDisplay;
  }

  const thingId = ensureThing(ctx, thingName);
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
    const sourceName = match[1]!.trim();
    const targetName = match[2]!.trim();
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
    const sourceName = match[2]!.trim();
    // avoid consuming duration sentence
    if (/\d+(?:\.\d+)?(?:ms|s|min|h|d)$/.test(sourceName)) return null;
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
      sourceSpan: span,
    };
  }

  match = ctx.locale === "es"
    ? line.match(/^(.*?) consume (.*?)\.$/)
    : line.match(/^(.*?) consumes (.*?)\.$/);
  if (match) {
    const targetName = match[1]!.trim();
    const objectPhrase = match[2]!.trim();
    const stateMatch = objectPhrase.match(/^(.*?) (.+)$/);
    let sourceName = objectPhrase;
    let sourceStateName: string | undefined;
    if (stateMatch) {
      const maybeState = stateMatch[1]!.trim();
      const maybeName = stateMatch[2]!.trim();
      if (ctx.thingIdByName.has(maybeName)) {
        sourceName = maybeName;
        sourceStateName = maybeState;
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
    const stateMatch = objectPhrase.match(/^(.*?) (.+)$/);
    let targetName = objectPhrase;
    let targetStateName: string | undefined;
    if (stateMatch) {
      const maybeState = stateMatch[1]!.trim();
      const maybeName = stateMatch[2]!.trim();
      if (ctx.thingIdByName.has(maybeName)) {
        targetName = maybeName;
        targetStateName = maybeState;
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

  match = ctx.locale === "es"
    ? line.match(/^(.*?) cambia (.*?) de (.*?) a (.*?)\.$/)
    : line.match(/^(.*?) changes (.*?) from (.*?) to (.*?)\.$/);
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
      sourceStateName: match[3]!.trim(),
      targetStateName: match[4]!.trim(),
      sourceSpan: span,
    };
  }

  match = ctx.locale === "es"
    ? line.match(/^(.*?) cambia (.*?) de (.*?)\.$/)
    : line.match(/^(.*?) changes (.*?) from (.*?)\.$/);
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
      sourceStateName: match[3]!.trim(),
      sourceSpan: span,
    };
  }

  match = ctx.locale === "es"
    ? line.match(/^(.*?) cambia (.*?) a (.*?)\.$/)
    : line.match(/^(.*?) changes (.*?) to (.*?)\.$/);
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
      targetStateName: match[3]!.trim(),
      sourceSpan: span,
    };
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
  // Aggregation: "X consta de A, B y C." / "X consists of A, B and C."
  let match = isES
    ? line.match(/^(.*?) consta de (.*?)\.$/)
    : line.match(/^(.*?) consists of (.*?)\.$/);
  if (match) {
    const parentName = match[1]!.trim();
    const childNames = parseList(match[2]!.trim(), ctx.locale);
    if (childNames.length === 0) return null;
    return {
      kind: "grouped-structural",
      linkType: "aggregation",
      parentId: ensureThing(ctx, parentName),
      parentName,
      parentKind: "object",
      childIds: childNames.map(n => ensureThing(ctx, n)),
      childNames,
      childKinds: childNames.map(() => "object" as const),
      incomplete: false,
      sourceSpan: span,
    };
  }

  // Exhibition: "X exhibe A y B." / "X exhibits A and B."
  match = isES
    ? line.match(/^(.*?) exhibe (.*?)\.$/)
    : line.match(/^(.*?) exhibits (.*?)\.$/);
  if (match) {
    const parentName = match[1]!.trim();
    const childNames = parseList(match[2]!.trim(), ctx.locale);
    if (childNames.length === 0) return null;
    return {
      kind: "grouped-structural",
      linkType: "exhibition",
      parentId: ensureThing(ctx, parentName),
      parentName,
      parentKind: "object",
      childIds: childNames.map(n => ensureThing(ctx, n)),
      childNames,
      childKinds: childNames.map(() => "object" as const),
      incomplete: false,
      sourceSpan: span,
    };
  }

  // Classification (single): "X es una instancia de Y." / "X is an instance of Y."
  match = isES
    ? line.match(/^(.*?) es una instancia de (.*?)\.$/)
    : line.match(/^(.*?) is an instance of (.*?)\.$/);
  if (match) {
    const childName = match[1]!.trim();
    const parentName = match[2]!.trim();
    return {
      kind: "grouped-structural",
      linkType: "classification",
      parentId: ensureThing(ctx, parentName),
      parentName,
      parentKind: "object",
      childIds: [ensureThing(ctx, childName)],
      childNames: [childName],
      childKinds: ["object"],
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
    const childName = match[1]!.trim();
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
      childIds: [ensureThing(ctx, childName)],
      childNames: [childName],
      childKinds: ["object"],
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
    const childNames = parseList(match[1]!.trim(), ctx.locale);
    const parentName = match[2]!.trim();
    if (childNames.length < 2) return null;
    // Skip thing declarations
    if (["object", "process", "objeto", "proceso"].includes(parentName.toLowerCase())) return null;
    return {
      kind: "grouped-structural",
      linkType: "generalization",
      parentId: ensureThing(ctx, parentName),
      parentName,
      parentKind: "object",
      childIds: childNames.map(n => ensureThing(ctx, n)),
      childNames,
      childKinds: childNames.map(() => "object" as const),
      incomplete: false,
      sourceSpan: span,
    };
  }

  return null;
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

function parseInZoomSequence(line: string, span: OplSourceSpan, ctx: ParseContext): OplInZoomSequence | null {
  const isES = ctx.locale === "es";
  // "Proceso se descompone en P1, P2 y P3, en esa secuencia."
  // "Process zooms into P1, P2 and P3, in that sequence."
  const seqMatch = isES
    ? line.match(/^(.*?) se descompone en (.*?), en esa secuencia\.$/)
    : line.match(/^(.*?) zooms into (.*?), in that sequence\.$/);
  if (seqMatch) {
    const parentName = seqMatch[1]!.trim();
    // Parse mixed object/process list, handling "as well as" separator
    const rawList = seqMatch[2]!.trim();
    const parts = rawList
      .split(isES ? /\s+así como\s+/ : /\s+as well as\s+/);
    const childNames: string[] = [];
    const childKinds: ("object" | "process")[] = [];
    for (const part of parts) {
      const items = parseList(part.trim(), ctx.locale);
      for (const item of items) {
        childNames.push(item);
        childKinds.push("process"); // Default; as well as section contains objects
      }
    }
    return {
      kind: "in-zoom-sequence",
      parentId: ensureThing(ctx, parentName),
      parentName,
      steps: childNames.length > 0
        ? [{ thingIds: childNames.map(n => ensureThing(ctx, n)), thingNames: childNames, parallel: false }]
        : [],
      sourceSpan: span,
    };
  }

  // "SD se refina por descomposición de Proceso en SD1."
  // "SD is refined by in-zooming Process in SD1."
  const refineMatch = isES
    ? line.match(/^(.*?) se refina por descomposici[óo]n de (.*?) en (.*?)\.$/)
    : line.match(/^(.*?) is refined by in-zooming (.*?) in (.*?)\.$/);
  if (refineMatch) {
    // This is a refinement edge label; we record it as metadata but
    // for now return null since we don't have a dedicated sentence type
    // TODO: add OplRefinementEdge sentence type
    return null;
  }

  return null;
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
  // "Temperature of Water is normal." / "Temperatura de Agua es normal."
  const match = isES
    ? line.match(/^(.*?) de (.*?) es (.*?)\.$/)
    : line.match(/^(.*?) of (.*?) is (.*?)\.$/);
  if (!match) return null;
  const thingName = match[1]!.trim();
  const exhibitorName = match[2]!.trim();
  const valueName = match[3]!.trim();
  // NOTE: do NOT reject lines starting with "Estado"/"State" here.
  // State-descriptions with non-standard qualifiers (like "deteriorado")
  // already return null from parseStateDescription, and should fall through
  // to attribute-value parsing. E.g. "Estado de Salud de Paciente Group es deteriorado."
  // is an attribute-value, not a state-description.
  // Disambiguate from thing declaration: "X is an object."
  if (["object", "process", "objeto", "proceso"].includes(valueName.toLowerCase())) return null;
  return {
    kind: "attribute-value",
    thingId: ensureThing(ctx, thingName),
    thingName,
    exhibitorId: ensureThing(ctx, exhibitorName),
    exhibitorName,
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
  const patterns = ctx.locale === "es"
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
  const pathLabeled: ParsedSentenceResult = parsePathLabelLine(line, span, ctx);
  if (pathLabeled) return pathLabeled;

  // Bracketed sentences ([R-01], [correctness], [scenario: ...]) must be tried before generic link parsing
  // because "X requires Y" after [bracket] gets consumed by instrument link parser.
  const bracketed = parseRequirement(line, span, ctx) ?? parseScenario(line, span, ctx) ?? parseAssertion(line, span, ctx);
  if (bracketed) return bracketed;

  return parseThingDeclaration(line, span, ctx)
    ?? parseStateEnumeration(line, span, ctx)
    ?? parseStateDescription(line, span, ctx)
    ?? parseDuration(line, span, ctx)
    ?? parseStructuralSentence(line, span, ctx)
    ?? parseFanSentence(line, span, ctx)
    ?? parseModifierSentence(line, span, ctx)
    ?? parseConditionModifier(line, span, ctx)
    ?? parseInZoomSequence(line, span, ctx)
    ?? parseExceptionLink(line, span, ctx)
    ?? parseAttributeValue(line, span, ctx)
    ?? parseInvocation(line, span, ctx)
    ?? parseLink(line, span, ctx)
    ?? parseTaggedLink(line, span, ctx);
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
