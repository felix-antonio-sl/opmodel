import type { Model } from "@opmodel/core";
import { expose, render, type OplSentence, type OplDocument } from "@opmodel/core";

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
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
      return [sentence.parentId, ...sentence.steps.flatMap(s => s.thingIds)];
    case "attribute-value":
      return [sentence.thingId, sentence.exhibitorId];
    case "fan":
      return [sentence.fanId];
  }
}

function sentenceCategory(sentence: OplSentence): "thing" | "link" | "modifier" {
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
  }
}

function renderSentence(sentence: OplSentence, doc: OplDocument): string {
  return render({ ...doc, sentences: [sentence] });
}

function sentenceClass(sentence: OplSentence, selectedThing: string | null): string {
  const ids = getEntityIds(sentence);
  const category = sentenceCategory(sentence);
  const base = `opl-sentence opl-sentence--${category}`;
  if (selectedThing && ids.includes(selectedThing)) {
    return `${base} opl-sentence--highlighted`;
  }
  return base;
}

export function OplSentencesView({ model, opdId, selectedThing }: Props) {
  const doc = expose(model, opdId);

  const thingSentences = doc.sentences.filter(
    (s): s is OplSentence =>
      s.kind === "thing-declaration" ||
      s.kind === "state-enumeration" ||
      s.kind === "duration" ||
      s.kind === "state-description" ||
      s.kind === "attribute-value"
  );
  const linkSentences = doc.sentences.filter(
    (s): s is OplSentence =>
      s.kind === "link" ||
      s.kind === "modifier" ||
      s.kind === "grouped-structural" ||
      s.kind === "in-zoom-sequence" ||
      s.kind === "fan"
  );

  return (
    <div className="opl-panel__content">
      {thingSentences.map((sentence, i) => (
        <div key={`t-${i}`} className={sentenceClass(sentence, selectedThing)}>
          {renderSentence(sentence, doc)}
        </div>
      ))}
      {thingSentences.length > 0 && linkSentences.length > 0 && <div className="opl-divider" />}
      {linkSentences.map((sentence, i) => (
        <div key={`l-${i}`} className={sentenceClass(sentence, selectedThing)}>
          {renderSentence(sentence, doc)}
        </div>
      ))}
    </div>
  );
}
