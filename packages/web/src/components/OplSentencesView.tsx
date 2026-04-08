import type { Model } from "@opmodel/core";
import { semanticKernelFromModel, exposeSemanticKernel, exposeFromKernel, render, type OplSentence, type OplDocument } from "@opmodel/core";
import type { Command } from "../lib/commands";

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  selectedLink: string | null;
  onSelectEntity?: (cmd: Command) => void;
}

function getEntityIds(sentence: OplSentence): string[] {
  switch (sentence.kind) {
    case "thing-declaration":
      return [sentence.thingId];
    case "state-enumeration":
      return [sentence.thingId];
    case "duration":
      return [sentence.thingId];
    case "link":
      return [sentence.linkId, sentence.sourceId, sentence.targetId];
    case "modifier":
      return [sentence.modifierId, sentence.linkId];
    case "state-description":
      return [sentence.thingId, sentence.stateId];
    case "grouped-structural":
      return [sentence.parentId, ...sentence.childIds];
    case "in-zoom-sequence":
      return [sentence.parentId, ...sentence.steps.flatMap((s) => s.thingIds)];
    case "attribute-value":
      return [sentence.thingId, sentence.exhibitorId];
    case "fan":
      return [sentence.fanId];
    case "requirement":
      return [sentence.reqId];
    case "assertion":
      return [sentence.assertionId];
    case "scenario":
      return [sentence.scenarioId];
  }
}

function sentenceCategory(sentence: OplSentence): "thing" | "link" | "modifier" | "meta" {
  switch (sentence.kind) {
    case "thing-declaration":
    case "state-enumeration":
    case "duration":
    case "state-description":
    case "attribute-value":
      return "thing";
    case "link":
    case "grouped-structural":
    case "in-zoom-sequence":
    case "fan":
      return "link";
    case "modifier":
      return "modifier";
    case "requirement":
    case "assertion":
    case "scenario":
      return "meta";
  }
}

function renderSentence(sentence: OplSentence, doc: OplDocument): string {
  const { refinementEdge, ...rest } = doc;
  return render({ ...rest, sentences: [sentence] });
}

function isHighlighted(sentence: OplSentence, selectedThing: string | null, selectedLink: string | null): boolean {
  const ids = getEntityIds(sentence);
  return Boolean((selectedThing && ids.includes(selectedThing)) || (selectedLink && ids.includes(selectedLink)));
}

function sentenceClass(sentence: OplSentence, selectedThing: string | null, selectedLink: string | null): string {
  const category = sentenceCategory(sentence);
  const base = `opl-sentence opl-sentence--${category}`;
  if (isHighlighted(sentence, selectedThing, selectedLink)) {
    return `${base} opl-sentence--highlighted`;
  }
  return base;
}

function commandForSentence(sentence: OplSentence): Command | null {
  switch (sentence.kind) {
    case "thing-declaration":
    case "state-enumeration":
    case "duration":
    case "state-description":
    case "attribute-value":
      return { tag: "selectThing", thingId: sentence.thingId };
    case "link":
      return { tag: "selectLink", linkId: sentence.linkId };
    case "modifier":
      return { tag: "selectLink", linkId: sentence.linkId };
    case "grouped-structural":
    case "in-zoom-sequence":
      return { tag: "selectThing", thingId: sentence.parentId };
    case "fan":
      return null;
    case "requirement":
    case "assertion":
    case "scenario":
      return null;
  }
}

export function OplSentencesView({ model, opdId, selectedThing, selectedLink, onSelectEntity }: Props) {
  const kernel = semanticKernelFromModel(model);
  const atlas = exposeSemanticKernel(kernel);
  const doc = exposeFromKernel(kernel, atlas, opdId);

  const thingSentences = doc.sentences.filter(
    (s): s is OplSentence =>
      s.kind === "thing-declaration" ||
      s.kind === "state-enumeration" ||
      s.kind === "duration" ||
      s.kind === "state-description" ||
      s.kind === "attribute-value",
  );
  const linkSentences = doc.sentences.filter(
    (s): s is OplSentence =>
      s.kind === "link" ||
      s.kind === "modifier" ||
      s.kind === "grouped-structural" ||
      s.kind === "in-zoom-sequence" ||
      s.kind === "fan",
  );
  const metaSentences = doc.sentences.filter(
    (s): s is OplSentence =>
      s.kind === "requirement" ||
      s.kind === "assertion" ||
      s.kind === "scenario",
  );

  const edgeLabel = doc.refinementEdge
    ? render({ ...doc, sentences: [] }).trim()
    : null;

  return (
    <div className="opl-panel__content">
      {edgeLabel && (
        <div className="opl-sentence opl-sentence--thing" style={{ fontStyle: "italic" }}>
          {edgeLabel}
        </div>
      )}
      {thingSentences.map((sentence, i) => {
        const cmd = commandForSentence(sentence);
        return (
          <div
            key={`t-${i}`}
            className={sentenceClass(sentence, selectedThing, selectedLink)}
            onClick={cmd && onSelectEntity ? () => onSelectEntity(cmd) : undefined}
            style={cmd && onSelectEntity ? { cursor: "pointer" } : undefined}
          >
            {renderSentence(sentence, doc)}
          </div>
        );
      })}
      {thingSentences.length > 0 && linkSentences.length > 0 && <div className="opl-divider" />}
      {linkSentences.map((sentence, i) => {
        const cmd = commandForSentence(sentence);
        return (
          <div
            key={`l-${i}`}
            className={sentenceClass(sentence, selectedThing, selectedLink)}
            onClick={cmd && onSelectEntity ? () => onSelectEntity(cmd) : undefined}
            style={cmd && onSelectEntity ? { cursor: "pointer" } : undefined}
          >
            {renderSentence(sentence, doc)}
          </div>
        );
      })}
      {metaSentences.length > 0 && <div className="opl-divider" />}
      {metaSentences.map((sentence, i) => (
        <div key={`m-${i}`} className="opl-sentence opl-sentence--meta" style={{ fontSize: "0.85em", opacity: 0.8 }}>
          {renderSentence(sentence, doc)}
        </div>
      ))}
    </div>
  );
}
