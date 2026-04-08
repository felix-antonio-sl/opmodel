import { validate } from "./api";
import { compileOplDocuments } from "./opl-compile";
import { parseOplDocument } from "./opl-parse";
import type { InvariantError } from "./result";
import type {
  Link,
  Model,
  Modifier,
  Thing,
} from "./types";
import type {
  OplDocument,
  OplLinkSentence,
  OplModifierSentence,
  OplSentence,
  OplSourceSpan,
} from "./opl-types";

export type ValidationPhase = "V1-syntax" | "V2-binding" | "V3-semantic" | "V4-canonical";

export interface ValidationIssue {
  phase: ValidationPhase;
  severity: "error" | "warning";
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  sentenceKind?: string;
  opdName?: string;
  code?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  phases: {
    syntax: "pass" | "fail" | "skip";
    binding: "pass" | "fail" | "skip";
    semantic: "pass" | "fail" | "skip";
    canonical: "pass" | "fail" | "skip";
  };
}

type LocationInfo = Pick<
  ValidationIssue,
  "line" | "column" | "endLine" | "endColumn" | "sentenceKind" | "opdName"
>;

type ParsedSection = {
  name: string;
  startLine: number;
  startOffset: number;
  text: string;
};

type ResolutionContext = {
  model: Model;
  thingIdsByName: Map<string, string[]>;
  displayThingIds: Map<string, string[]>;
  stateIdsByParentAndName: Map<string, string[]>;
};

const STRUCTURAL_LINK_TYPES = new Set(["aggregation", "exhibition", "generalization", "classification"]);

export function validateOpl(text: string, options: { modelName?: string } = {}): ValidationResult {
  const syntax = parseOplWithAbsoluteSpans(text);
  if (!syntax.ok) {
    return {
      ok: false,
      issues: syntax.error.issues.map((issue) => ({
        phase: "V1-syntax",
        severity: "error",
        message: issue.message,
        line: issue.line,
        column: issue.column,
        endLine: issue.line,
        endColumn: issue.column + issue.text.length,
      })),
      phases: {
        syntax: "fail",
        binding: "skip",
        semantic: "skip",
        canonical: "skip",
      },
    };
  }

  const docs = syntax.value;
  const compiled = compileOplDocuments(docs, options);
  if (!compiled.ok) {
    return {
      ok: false,
      issues: compiled.error.issues.map((issue) => ({
        phase: "V2-binding",
        severity: "error",
        message: issue.message,
        line: issue.line,
        column: issue.column,
        sentenceKind: issue.sentenceKind,
        opdName: issue.opdName,
      })),
      phases: {
        syntax: "pass",
        binding: "fail",
        semantic: "skip",
        canonical: "skip",
      },
    };
  }

  const model = compiled.value;
  const sourceMap = buildSourceMap(docs, model);
  const semanticIssues = validate(model).map((issue) => mapInvariantIssue(issue, sourceMap));
  const canonicalIssues = collectCanonicalIssues(docs);
  const issues = [...semanticIssues, ...canonicalIssues];

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
    phases: {
      syntax: "pass",
      binding: "pass",
      semantic: semanticIssues.some((issue) => issue.severity === "error") ? "fail" : "pass",
      canonical: canonicalIssues.length > 0 ? "fail" : "pass",
    },
  };
}

function parseOplWithAbsoluteSpans(text: string) {
  const sections = splitSections(text);
  if (!sections) {
    const parsed = parseOplDocument(text, "SD", "opd-sd");
    if (!parsed.ok) return parsed;
    return { ok: true as const, value: [parsed.value] };
  }

  const docs: OplDocument[] = [];
  for (const section of sections) {
    const parsed = parseOplDocument(section.text, section.name, `opd-${slug(section.name) || "section"}`);
    if (!parsed.ok) {
      return {
        ok: false as const,
        error: {
          ...parsed.error,
          issues: parsed.error.issues.map((issue) => ({
            ...issue,
            line: issue.line + section.startLine - 1,
          })),
        },
      };
    }
    docs.push(adjustDocumentSpans(parsed.value, section.startLine - 1, section.startOffset));
  }
  return { ok: true as const, value: docs };
}

function splitSections(text: string): ParsedSection[] | null {
  const lines = text.split("\n");
  const entries = [] as Array<{ text: string; lineNumber: number; offset: number }>;
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    entries.push({ text: lines[i]!, lineNumber: i + 1, offset });
    offset += lines[i]!.length + 1;
  }

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  for (const entry of entries) {
    const match = entry.text.trim().match(/^=== (.*?) ===$/);
    if (match) {
      current = {
        name: match[1]!.trim(),
        startLine: entry.lineNumber + 1,
        startOffset: entry.offset + entry.text.length + 1,
        text: "",
      };
      sections.push(current);
      continue;
    }
    if (!current) {
      if (entry.text.trim()) return null;
      continue;
    }
    current.text += current.text ? `\n${entry.text}` : entry.text;
  }

  return sections.length > 0 ? sections : null;
}

function adjustDocumentSpans(doc: OplDocument, lineDelta: number, offsetDelta: number): OplDocument {
  return {
    ...doc,
    sourceSpan: doc.sourceSpan ? shiftSpan(doc.sourceSpan, lineDelta, offsetDelta) : undefined,
    sentences: doc.sentences.map((sentence) => ({
      ...sentence,
      sourceSpan: sentence.sourceSpan ? shiftSpan(sentence.sourceSpan, lineDelta, offsetDelta) : undefined,
    })) as OplDocument["sentences"],
  };
}

function shiftSpan(span: OplSourceSpan, lineDelta: number, offsetDelta: number): OplSourceSpan {
  return {
    ...span,
    line: span.line + lineDelta,
    endLine: span.endLine + lineDelta,
    offset: span.offset + offsetDelta,
    endOffset: span.endOffset + offsetDelta,
  };
}

function buildSourceMap(docs: OplDocument[], model: Model): Map<string, LocationInfo> {
  const map = new Map<string, LocationInfo>();
  const ctx = createResolutionContext(model);

  for (const doc of docs) {
    map.set(doc.opdId, locationForDoc(doc));
    for (const sentence of doc.sentences) {
      registerSentenceLocations(map, ctx, doc, sentence);
    }
  }

  return map;
}

function createResolutionContext(model: Model): ResolutionContext {
  const thingIdsByName = new Map<string, string[]>();
  const displayThingIds = new Map<string, string[]>();
  const stateIdsByParentAndName = new Map<string, string[]>();

  for (const [thingId, thing] of model.things) {
    pushToMap(thingIdsByName, thing.name, thingId);
    pushToMap(displayThingIds, thing.name, thingId);
  }

  for (const link of model.links.values()) {
    if (link.type !== "exhibition") continue;
    const source = model.things.get(link.source);
    const target = model.things.get(link.target);
    if (!source || !target) continue;
    pushToMap(displayThingIds, `${target.name} of ${source.name}`, target.id);
    pushToMap(displayThingIds, `${target.name} de ${source.name}`, target.id);
  }

  for (const [stateId, state] of model.states) {
    pushToMap(stateIdsByParentAndName, `${state.parent}::${state.name}`, stateId);
  }

  return { model, thingIdsByName, displayThingIds, stateIdsByParentAndName };
}

function registerSentenceLocations(
  map: Map<string, LocationInfo>,
  ctx: ResolutionContext,
  doc: OplDocument,
  sentence: OplSentence,
) {
  const location = locationForSentence(doc, sentence);

  switch (sentence.kind) {
    case "thing-declaration": {
      const thingId = resolveThingId(ctx, sentence.name, sentence.exhibitorName, sentence.thingKind);
      if (thingId) map.set(thingId, location);
      break;
    }
    case "state-enumeration":
      for (const stateName of sentence.stateNames) {
        const stateId = resolveStateId(ctx, sentence.thingName, sentence.exhibitorName, stateName);
        if (stateId) map.set(stateId, location);
      }
      break;
    case "state-description": {
      const stateId = resolveStateId(ctx, sentence.thingName, sentence.exhibitorName, sentence.stateName);
      if (stateId) map.set(stateId, location);
      break;
    }
    case "attribute-value": {
      const stateId = resolveStateId(ctx, sentence.thingName, sentence.exhibitorName, sentence.valueName);
      if (stateId) map.set(stateId, location);
      break;
    }
    case "grouped-structural": {
      const parentId = resolveThingId(ctx, sentence.parentName);
      for (const childName of sentence.childNames) {
        const childId = resolveThingId(ctx, childName);
        if (!parentId || !childId) continue;
        const link = findLink(ctx.model, {
          type: sentence.linkType,
          source: parentId,
          target: childId,
        });
        if (link) map.set(link.id, location);
      }
      break;
    }
    case "link": {
      const link = resolveLinkFromSentence(ctx, sentence);
      if (link) map.set(link.id, location);
      break;
    }
    case "modifier": {
      const modifier = resolveModifierFromSentence(ctx, sentence);
      if (modifier) map.set(modifier.id, location);
      break;
    }
    case "fan": {
      const fan = resolveFanFromSentence(ctx, sentence);
      if (fan) map.set(fan.id, location);
      break;
    }
    case "requirement": {
      const requirement = [...ctx.model.requirements.values()].find((candidate) =>
        candidate.req_id === sentence.reqCode &&
        candidate.name === sentence.name &&
        candidate.description === sentence.description,
      );
      if (requirement) map.set(requirement.id, location);
      break;
    }
    case "assertion": {
      const assertion = [...ctx.model.assertions.values()].find((candidate) =>
        candidate.predicate === sentence.predicate &&
        candidate.category === sentence.category &&
        candidate.enabled,
      );
      if (assertion) map.set(assertion.id, location);
      break;
    }
    case "scenario": {
      const scenario = [...ctx.model.scenarios.values()].find((candidate) =>
        candidate.name === sentence.name &&
        candidate.path_labels.join("\u0000") === sentence.pathLabels.join("\u0000"),
      );
      if (scenario) map.set(scenario.id, location);
      break;
    }
    case "in-zoom-sequence": {
      if (sentence.refinementType === "unfold") break;
      for (const step of sentence.steps) {
        if (step.parallel) continue;
        for (let i = 0; i < step.thingNames.length - 1; i++) {
          const sourceId = resolveThingId(ctx, step.thingNames[i]!);
          const targetId = resolveThingId(ctx, step.thingNames[i + 1]!);
          if (!sourceId || !targetId) continue;
          const link = findLink(ctx.model, { type: "invocation", source: sourceId, target: targetId });
          if (link) map.set(link.id, location);
        }
      }
      break;
    }
    case "duration":
      break;
    default:
      sentence satisfies never;
  }
}

function resolveThingId(
  ctx: ResolutionContext,
  name: string,
  exhibitorName?: string,
  kind?: Thing["kind"],
): string | undefined {
  const exact = exhibitorName ? `${name} of ${exhibitorName}` : name;
  const candidates = [
    ...(ctx.displayThingIds.get(exact) ?? []),
    ...(exhibitorName ? ctx.displayThingIds.get(`${name} de ${exhibitorName}`) ?? [] : []),
    ...(ctx.displayThingIds.get(name) ?? []),
    ...(ctx.thingIdsByName.get(name) ?? []),
  ];
  const deduped = [...new Set(candidates)];
  if (kind) {
    return deduped.find((id) => ctx.model.things.get(id)?.kind === kind);
  }
  return deduped[0];
}

function resolveStateId(
  ctx: ResolutionContext,
  thingName: string,
  exhibitorName: string | undefined,
  stateName: string,
): string | undefined {
  const thingId = resolveThingId(ctx, thingName, exhibitorName);
  if (!thingId) return undefined;
  return ctx.stateIdsByParentAndName.get(`${thingId}::${stateName}`)?.[0];
}

function resolveLinkFromSentence(ctx: ResolutionContext, sentence: OplLinkSentence): Link | undefined {
  const sourceId = resolveThingId(ctx, sentence.sourceName);
  const targetId = sentence.targetName === "itself" || sentence.targetName === "sí mismo" || sentence.targetName === "si mismo"
    ? sourceId
    : resolveThingId(ctx, sentence.targetName);
  if (!sourceId || !targetId) return undefined;

  const linkType = sentence.exceptionType ? "exception" : sentence.linkType;
  const sourceState = resolveStateForLinkSide(
    ctx,
    linkType,
    "source",
    sourceId,
    targetId,
    sentence.sourceStateName,
  );
  const targetState = resolveStateForLinkSide(
    ctx,
    linkType,
    "target",
    sourceId,
    targetId,
    sentence.targetStateName,
  );

  return findLink(ctx.model, {
    type: linkType,
    source: sourceId,
    target: targetId,
    sourceState,
    targetState,
  });
}

function resolveModifierFromSentence(ctx: ResolutionContext, sentence: OplModifierSentence): Modifier | undefined {
  const sourceId = resolveThingId(ctx, sentence.sourceName);
  const targetId = resolveThingId(ctx, sentence.targetName);
  if (!sourceId || !targetId) return undefined;

  let candidates = [...ctx.model.links.values()].filter((link) => {
    const same = link.source === sourceId && link.target === targetId;
    const reverse = link.source === targetId && link.target === sourceId;
    return same || reverse;
  });
  if (candidates.length === 0) return undefined;

  const hinted = candidates.filter((link) => link.type === sentence.linkType);
  if (hinted.length > 0) candidates = hinted;

  if (sentence.sourceStateName) {
    const sourceState = resolveStateForLinkSide(
      ctx,
      candidates[0]!.type,
      "source",
      sourceId,
      targetId,
      sentence.sourceStateName,
    );
    if (sourceState) {
      const filtered = candidates.filter((link) => link.source_state === sourceState || link.target_state === sourceState);
      if (filtered.length > 0) candidates = filtered;
    }
  }

  if (sentence.targetStateName) {
    const targetState = resolveStateForLinkSide(
      ctx,
      candidates[0]!.type,
      "target",
      sourceId,
      targetId,
      sentence.targetStateName,
    );
    if (targetState) {
      const filtered = candidates.filter((link) => link.source_state === targetState || link.target_state === targetState);
      if (filtered.length > 0) candidates = filtered;
    }
  }

  const over = candidates.find((link) => !STRUCTURAL_LINK_TYPES.has(link.type)) ?? candidates[0];
  if (!over) return undefined;

  return [...ctx.model.modifiers.values()].find((modifier) =>
    modifier.over === over.id &&
    modifier.type === sentence.modifierType &&
    !!modifier.negated === !!sentence.negated &&
    (modifier.condition_mode ?? undefined) === (sentence.conditionMode ?? undefined),
  );
}

function resolveFanFromSentence(
  ctx: ResolutionContext,
  sentence: Extract<OplSentence, { kind: "fan" }>,
) {
  const sharedId = resolveThingId(ctx, sentence.sharedEndpointName);
  if (!sharedId) return undefined;

  const members: string[] = [];
  for (let i = 0; i < sentence.memberNames.length; i++) {
    const memberId = resolveThingId(ctx, sentence.memberNames[i]!);
    if (!memberId) return undefined;
    const sourceId = sentence.direction === "diverging" ? sharedId : memberId;
    const targetId = sentence.direction === "diverging" ? memberId : sharedId;
    const sourceState = sentence.memberSourceStateNames?.[i]
      ? resolveStateForLinkSide(ctx, sentence.linkType, "source", sourceId, targetId, sentence.memberSourceStateNames[i])
      : undefined;
    const targetState = sentence.memberTargetStateNames?.[i]
      ? resolveStateForLinkSide(ctx, sentence.linkType, "target", sourceId, targetId, sentence.memberTargetStateNames[i])
      : undefined;
    const link = findLink(ctx.model, {
      type: sentence.linkType,
      source: sourceId,
      target: targetId,
      sourceState,
      targetState,
    });
    if (!link) return undefined;
    members.push(link.id);
  }

  const memberKey = [...members].sort().join("\u0000");
  return [...ctx.model.fans.values()].find((fan) =>
    fan.type === sentence.fanType &&
    fan.direction === sentence.direction &&
    [...fan.members].sort().join("\u0000") === memberKey,
  );
}

function resolveStateForLinkSide(
  ctx: ResolutionContext,
  linkType: Link["type"],
  side: "source" | "target",
  sourceThingId: string,
  targetThingId: string,
  stateName: string | undefined,
): string | undefined {
  if (!stateName) return undefined;

  const primaryThingId = (() => {
    if (linkType === "effect" || linkType === "result") return targetThingId;
    if (linkType === "consumption") return sourceThingId;
    return side === "source" ? sourceThingId : targetThingId;
  })();
  const fallbackThingId = primaryThingId === sourceThingId ? targetThingId : sourceThingId;
  return ctx.stateIdsByParentAndName.get(`${primaryThingId}::${stateName}`)?.[0]
    ?? ctx.stateIdsByParentAndName.get(`${fallbackThingId}::${stateName}`)?.[0];
}

function findLink(
  model: Model,
  match: {
    type: Link["type"];
    source: string;
    target: string;
    sourceState?: string;
    targetState?: string;
  },
): Link | undefined {
  return [...model.links.values()].find((link) =>
    link.type === match.type &&
    link.source === match.source &&
    link.target === match.target &&
    (match.sourceState === undefined || link.source_state === match.sourceState) &&
    (match.targetState === undefined || link.target_state === match.targetState),
  );
}

function mapInvariantIssue(issue: InvariantError, sourceMap: Map<string, LocationInfo>): ValidationIssue {
  const location = issue.entity ? sourceMap.get(issue.entity) : undefined;
  return {
    phase: "V3-semantic",
    severity: issue.severity === "warning" || issue.severity === "info" ? "warning" : "error",
    message: issue.message,
    code: issue.code,
    ...location,
  };
}

function collectCanonicalIssues(docs: OplDocument[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const doc of docs) {
    const lines = (doc.sourceText ?? "").split("\n");
    for (const sentence of doc.sentences) {
      const location = locationForSentence(doc, sentence);

      if (sentence.kind === "thing-declaration") {
        const initial = sentence.name.trim().charAt(0);
        if (initial && initial === initial.toLowerCase()) {
          issues.push({
            phase: "V4-canonical",
            severity: "warning",
            message: `Thing names should be capitalized: ${sentence.name}`,
            ...location,
          });
        }
        if (sentence.thingKind === "process" && !/ing\b/i.test(sentence.name.trim())) {
          issues.push({
            phase: "V4-canonical",
            severity: "warning",
            message: `Process names should contain a gerund (-ing): ${sentence.name}`,
            ...location,
          });
        }
      }

      if ((sentence.kind === "state-enumeration" || sentence.kind === "state-description") && sentence.sourceSpan) {
        const names = sentence.kind === "state-enumeration" ? sentence.stateNames : [sentence.stateName];
        for (const name of names) {
          const initial = name.trim().charAt(0);
          if (initial && initial === initial.toUpperCase()) {
            issues.push({
              phase: "V4-canonical",
              severity: "warning",
              message: `State names should not be capitalized: ${name}`,
              ...location,
            });
          }
        }
      }

      if (sentence.sourceSpan && sentence.kind !== "scenario") {
        const lineText = lines[sentence.sourceSpan.line - doc.sourceSpan!.line] ?? "";
        if (lineText.trim() && !lineText.trim().endsWith(".")) {
          issues.push({
            phase: "V4-canonical",
            severity: "warning",
            message: "OPL sentences should end with a period.",
            ...location,
          });
        }
      }
    }
  }

  return issues;
}

function locationForSentence(doc: OplDocument, sentence: OplSentence): LocationInfo {
  return {
    ...(sentence.sourceSpan ? compactSpan(sentence.sourceSpan) : {}),
    sentenceKind: sentence.kind,
    opdName: doc.opdName,
  };
}

function locationForDoc(doc: OplDocument): LocationInfo {
  return {
    ...(doc.sourceSpan ? compactSpan(doc.sourceSpan) : {}),
    opdName: doc.opdName,
  };
}

function compactSpan(span: OplSourceSpan) {
  return {
    line: span.line,
    column: span.column,
    endLine: span.endLine,
    endColumn: span.endColumn,
  };
}

function pushToMap(map: Map<string, string[]>, key: string, value: string) {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
