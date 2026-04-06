import type {
  Affiliation,
  Essence,
  OplEssenceVisibility,
  OplUnitsVisibility,
  TimeUnit,
} from "./types";
import type {
  OplDocument,
  OplDuration,
  OplLinkSentence,
  OplRenderSettings,
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

const DEFAULT_RENDER_SETTINGS: OplRenderSettings = {
  essenceVisibility: "all" satisfies OplEssenceVisibility,
  unitsVisibility: "always" satisfies OplUnitsVisibility,
  aliasVisibility: false,
  primaryEssence: "informatical",
  locale: "en",
};

type ParseContext = {
  thingIdByName: Map<string, string>;
  stateIdByThingAndName: Map<string, string>;
  linkCounter: number;
};

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

function parseList(raw: string): string[] {
  return raw
    .split(/,\s*|\s+or\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseThingDeclaration(line: string, span: OplSourceSpan, ctx: ParseContext): OplThingDeclaration | null {
  const match = line.match(/^(.*?) is (a|an) (object|process)(.*)\.$/);
  if (!match) return null;

  const name = match[1]!.trim();
  const thingKind = match[3]! as "object" | "process";
  const tail = match[4] ?? "";
  const tokens = tail.split(",").map((t) => t.trim()).filter(Boolean);

  let essence: Essence = "informatical";
  let affiliation: Affiliation = "systemic";
  let perseverance: "static" | "dynamic" | undefined;

  for (const token of tokens) {
    if (token === "physical" || token === "informatical") essence = token;
    if (token === "environmental" || token === "systemic") affiliation = token;
    if (token === "dynamic") perseverance = "dynamic";
  }

  return {
    kind: "thing-declaration",
    thingId: ensureThing(ctx, name),
    name,
    thingKind,
    essence,
    affiliation,
    ...(perseverance ? { perseverance } : {}),
    sourceSpan: span,
  };
}

function parseStateEnumeration(line: string, span: OplSourceSpan, ctx: ParseContext): OplStateEnumeration | null {
  const match = line.match(/^(.*?) can be (.*?)\.$/);
  if (!match) return null;
  const thingName = match[1]!.trim();
  const stateNames = parseList(match[2]!.trim());
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
  const match = line.match(/^State (.*?) of (.*?) is (.*?)\.$/);
  if (!match) return null;
  const stateName = match[1]!.trim();
  const thingName = match[2]!.trim();
  const qualifiers = match[3]!.split(/\s+and\s+/).map((q) => q.trim());
  const thingId = ensureThing(ctx, thingName);
  const stateIdValue = ctx.stateIdByThingAndName.get(stateKey(thingName, stateName)) ?? stateId(thingName, stateName);
  ctx.stateIdByThingAndName.set(stateKey(thingName, stateName), stateIdValue);
  return {
    kind: "state-description",
    thingId,
    thingName,
    stateId: stateIdValue,
    stateName,
    initial: qualifiers.includes("initial"),
    final: qualifiers.includes("final"),
    default: qualifiers.includes("default"),
    sourceSpan: span,
  };
}

function parseDuration(line: string, span: OplSourceSpan, ctx: ParseContext): OplDuration | null {
  const match = line.match(/^(.*?) requires (\d+(?:\.\d+)?)(ms|s|min|h|d)\.$/);
  if (!match) return null;
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

function parseLink(line: string, span: OplSourceSpan, ctx: ParseContext): OplLinkSentence | null {
  let match = line.match(/^(.*?) handles (.*?)\.$/);
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

  match = line.match(/^(.*?) requires (.*?)\.$/);
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

  match = line.match(/^(.*?) consumes (.*?)\.$/);
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

  match = line.match(/^(.*?) yields (.*?)\.$/);
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

  match = line.match(/^(.*?) changes (.*?) from (.*?) to (.*?)\.$/);
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

  match = line.match(/^(.*?) changes (.*?) from (.*?)\.$/);
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

  match = line.match(/^(.*?) changes (.*?) to (.*?)\.$/);
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

  return null;
}

function parseSentence(line: string, span: OplSourceSpan, ctx: ParseContext) {
  return parseThingDeclaration(line, span, ctx)
    ?? parseStateEnumeration(line, span, ctx)
    ?? parseStateDescription(line, span, ctx)
    ?? parseDuration(line, span, ctx)
    ?? parseLink(line, span, ctx);
}

export function parseOplDocument(text: string, opdName = "SD", opdId = `opd-${oplSlug(opdName) || "sd"}`): Result<OplDocument, OplParseError> {
  const ctx: ParseContext = {
    thingIdByName: new Map(),
    stateIdByThingAndName: new Map(),
    linkCounter: 0,
  };
  const issues: OplParseIssue[] = [];
  const sentences = [] as OplDocument["sentences"];
  const lines = splitLinesWithOffsets(text);

  for (const entry of lines) {
    const raw = entry.text;
    const line = raw.trim();
    if (!line) continue;
    const span = spanForLine(raw, entry.lineNumber, entry.offset);
    const sentence = parseSentence(line, span, ctx);
    if (!sentence) {
      pushIssue(issues, entry.lineNumber, raw, "Unsupported or invalid OPL sentence in current parser subset");
      continue;
    }
    sentences.push(sentence);
  }

  if (issues.length > 0) {
    return err({ message: "Failed to parse OPL document", issues });
  }

  return ok({
    opdId,
    opdName,
    sentences,
    renderSettings: DEFAULT_RENDER_SETTINGS,
    sourceText: text,
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
