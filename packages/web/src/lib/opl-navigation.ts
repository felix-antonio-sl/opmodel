import type { Model, OplDocument, OplSentence, OplSourceSpan } from "@opmodel/core";
import { parseOplDocuments } from "@opmodel/core";

export interface ParsedSentenceRef {
  doc: OplDocument;
  sentence: OplSentence;
  span: OplSourceSpan;
}

function buildSequentialRefs(text: string, docs: OplDocument[]): ParsedSentenceRef[] {
  const lines = text.split("\n");
  const refs: ParsedSentenceRef[] = [];
  let lineIndex = 0;

  const skipBlankLines = () => {
    while (lineIndex < lines.length && lines[lineIndex]!.trim() === "") lineIndex += 1;
  };

  for (const doc of docs) {
    skipBlankLines();
    if (lines[lineIndex]?.startsWith("=== ")) lineIndex += 1;
    skipBlankLines();

    for (const sentence of doc.sentences) {
      while (lineIndex < lines.length && lines[lineIndex]!.trim() === "") lineIndex += 1;
      const line = lineIndex + 1;
      const lineText = lines[lineIndex] ?? "";
      refs.push({
        doc,
        sentence,
        span: {
          line,
          column: 1,
          offset: 0,
          endLine: line,
          endColumn: Math.max(1, lineText.length + 1),
          endOffset: Math.max(0, lineText.length),
        },
      });
      lineIndex += 1;
    }
  }

  return refs;
}

export function parseSentenceRefs(text: string, fallbackOpdName?: string): ParsedSentenceRef[] {
  const parsed = parseOplDocuments(text);
  if (parsed.ok) return buildSequentialRefs(text, parsed.value);
  if (!fallbackOpdName) return [];

  const wrapped = `=== ${fallbackOpdName} ===\n${text}`;
  const reparsed = parseOplDocuments(wrapped);
  if (!reparsed.ok) return [];
  return buildSequentialRefs(text, reparsed.value);
}

export function lineColumnToOffset(text: string, line?: number, column?: number) {
  if (line == null || column == null) return null;
  const lines = text.split("\n");
  if (line < 1 || line > lines.length) return null;
  let offset = 0;
  for (let i = 0; i < line - 1; i++) offset += lines[i]!.length + 1;
  return offset + Math.max(0, column - 1);
}

export function findThingIdByName(model: Model, name?: string | null) {
  if (!name) return null;
  return [...model.things.values()].find((thing) => thing.name === name)?.id ?? null;
}

export function findLinkIdByNames(model: Model, sourceName?: string | null, targetName?: string | null) {
  if (!sourceName || !targetName) return null;
  const sourceId = findThingIdByName(model, sourceName);
  const targetId = findThingIdByName(model, targetName);
  if (!sourceId || !targetId) return null;
  return [...model.links.values()].find((link) => link.source === sourceId && link.target === targetId)?.id ?? null;
}

export function findLinkIdByDisplayName(model: Model, displayName?: string | null) {
  if (!displayName) return null;
  const parts = displayName.split("→").map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  return findLinkIdByNames(model, parts[0], parts[1]);
}

export function findThingOrLinkTarget(model: Model, targetName?: string | null) {
  const thingId = findThingIdByName(model, targetName);
  if (thingId) return { kind: "thing" as const, id: thingId };
  const linkId = findLinkIdByDisplayName(model, targetName);
  if (linkId) return { kind: "link" as const, id: linkId };
  return null;
}

export function findFirstLinkIdByPathLabels(model: Model, pathLabels?: string[] | null) {
  if (!pathLabels?.length) return null;
  return [...model.links.values()].find((link) => link.path_label && pathLabels.includes(link.path_label))?.id ?? null;
}

export function findOpdIdByName(model: Model, name?: string | null) {
  if (!name) return null;
  return [...model.opds.values()].find((opd) => opd.name === name)?.id ?? null;
}

function sentenceScore(sentence: OplSentence, thingName: string, linkNames?: { source: string; target: string }) {
  switch (sentence.kind) {
    case "thing-declaration":
      return sentence.name === thingName ? 100 : 0;
    case "state-enumeration":
    case "state-description":
    case "duration":
      return sentence.thingName === thingName ? 90 : 0;
    case "attribute-value":
      return sentence.thingName === thingName || sentence.exhibitorName === thingName ? 80 : 0;
    case "grouped-structural":
      return sentence.parentName === thingName || sentence.childNames.includes(thingName) ? 70 : 0;
    case "in-zoom-sequence":
      return sentence.parentName === thingName || sentence.steps.some((step) => step.thingNames.includes(thingName)) ? 70 : 0;
    case "link":
      if (linkNames && sentence.sourceName === linkNames.source && sentence.targetName === linkNames.target) return 110;
      return sentence.sourceName === thingName || sentence.targetName === thingName ? 60 : 0;
    case "modifier":
      return sentence.sourceName === thingName || sentence.targetName === thingName ? 50 : 0;
    case "fan":
      return sentence.sharedEndpointName === thingName || sentence.memberNames.includes(thingName) ? 50 : 0;
    case "requirement":
    case "assertion":
      return sentence.targetName === thingName ? 40 : 0;
    case "scenario":
      return 0;
  }
}

export function findSentenceForSelection(
  refs: ParsedSentenceRef[],
  model: Model,
  selectedThingId?: string | null,
  selectedLinkId?: string | null,
  preferredOpdId?: string | null,
): ParsedSentenceRef | null {
  const selectedThing = selectedThingId ? model.things.get(selectedThingId) : null;
  const selectedLink = selectedLinkId ? model.links.get(selectedLinkId) : null;
  const linkNames = selectedLink
    ? {
        source: model.things.get(selectedLink.source)?.name ?? "",
        target: model.things.get(selectedLink.target)?.name ?? "",
      }
    : undefined;
  const thingName = selectedThing?.name ?? linkNames?.source;
  if (!thingName && !linkNames) return null;

  const preferredOpdName = preferredOpdId ? model.opds.get(preferredOpdId)?.name : null;
  let best: { ref: ParsedSentenceRef; score: number } | null = null;

  for (const ref of refs) {
    let score = sentenceScore(ref.sentence, thingName ?? "", linkNames);
    if (score === 0) continue;
    if (preferredOpdName && ref.doc.opdName === preferredOpdName) score += 10;
    if (!best || score > best.score) best = { ref, score };
  }

  return best?.ref ?? null;
}

export function findSentenceAtLine(refs: ParsedSentenceRef[], line: number) {
  return refs.find((ref) => line >= ref.span.line && line <= ref.span.endLine) ?? null;
}
