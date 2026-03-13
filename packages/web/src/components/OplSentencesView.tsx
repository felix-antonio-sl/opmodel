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
  }
}

function sentenceCategory(sentence: OplSentence): "thing" | "link" | "modifier" {
  switch (sentence.kind) {
    case "thing-declaration":
    case "state-enumeration":
    case "duration":
      return "thing";
    case "link":
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
      s.kind === "duration"
  );
  const linkSentences = doc.sentences.filter(
    (s): s is OplSentence => s.kind === "link" || s.kind === "modifier"
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
