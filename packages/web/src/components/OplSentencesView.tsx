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
  // Strip refinementEdge to avoid prepending it to every individual sentence
  const { refinementEdge, ...rest } = doc;
  return render({ ...rest, sentences: [sentence] });
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
  const metaSentences = doc.sentences.filter(
    (s): s is OplSentence =>
      s.kind === "requirement" ||
      s.kind === "assertion" ||
      s.kind === "scenario"
  );

  // R-OPL-3: Refinement edge label (once at top, not per sentence)
  const edgeLabel = doc.refinementEdge
    ? (() => {
        const e = doc.refinementEdge;
        const verb = e.refinementType === "in-zoom" ? "in-zooming" : "unfolding";
        return `${e.parentOpdName} is refined by ${verb} ${e.refinedThingName} in ${e.childOpdName}.`;
      })()
    : null;

  return (
    <div className="opl-panel__content">
      {edgeLabel && (
        <div className="opl-sentence opl-sentence--thing" style={{ fontStyle: "italic" }}>
          {edgeLabel}
        </div>
      )}
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
      {metaSentences.length > 0 && <div className="opl-divider" />}
      {metaSentences.map((sentence, i) => (
        <div key={`m-${i}`} className="opl-sentence opl-sentence--meta" style={{ fontSize: "0.85em", opacity: 0.8 }}>
          {renderSentence(sentence, doc)}
        </div>
      ))}
    </div>
  );
}
