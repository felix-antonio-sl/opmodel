import type { Model } from "@opmodel/core";
import { semanticKernelFromModel, exposeSemanticKernel, exposeFromKernel, render, type OplSentence, type OplDocument } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { findFirstLinkIdByPathLabels, findThingIdByName, findThingOrLinkTarget } from "../lib/opl-navigation";
import { useOplSentenceSelection } from "../hooks/useOplSentenceSelection";

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  selectedLink: string | null;
  onSelectEntity?: (cmd: Command) => void;
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

function sentenceClass(isSentenceSelected: (sentence: OplSentence) => boolean, sentence: OplSentence): string {
  const category = sentenceCategory(sentence);
  const base = `opl-sentence opl-sentence--${category}`;
  if (isSentenceSelected(sentence)) {
    return `${base} opl-sentence--highlighted`;
  }
  return base;
}

function commandForSentence(model: Model, sentence: OplSentence): Command | null {
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
    case "fan": {
      const thingId = findThingIdByName(model, sentence.sharedEndpointName);
      return thingId ? { tag: "selectThing", thingId } : null;
    }
    case "requirement":
    case "assertion": {
      const target = findThingOrLinkTarget(model, sentence.targetName);
      if (!target) return null;
      return target.kind === "thing" ? { tag: "selectThing", thingId: target.id } : { tag: "selectLink", linkId: target.id };
    }
    case "scenario": {
      const linkId = findFirstLinkIdByPathLabels(model, sentence.pathLabels);
      return linkId ? { tag: "selectLink", linkId } : null;
    }
  }
}

export function OplSentencesView({ model, opdId, selectedThing, selectedLink, onSelectEntity }: Props) {
  const { isSentenceSelected } = useOplSentenceSelection(model, selectedThing, selectedLink);
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
        const cmd = commandForSentence(model, sentence);
        return (
          <div
            key={`t-${i}`}
            className={sentenceClass(isSentenceSelected, sentence)}
            onClick={cmd && onSelectEntity ? () => onSelectEntity(cmd) : undefined}
            style={cmd && onSelectEntity ? { cursor: "pointer" } : undefined}
          >
            {renderSentence(sentence, doc)}
          </div>
        );
      })}
      {thingSentences.length > 0 && linkSentences.length > 0 && <div className="opl-divider" />}
      {linkSentences.map((sentence, i) => {
        const cmd = commandForSentence(model, sentence);
        return (
          <div
            key={`l-${i}`}
            className={sentenceClass(isSentenceSelected, sentence)}
            onClick={cmd && onSelectEntity ? () => onSelectEntity(cmd) : undefined}
            style={cmd && onSelectEntity ? { cursor: "pointer" } : undefined}
          >
            {renderSentence(sentence, doc)}
          </div>
        );
      })}
      {metaSentences.length > 0 && <div className="opl-divider" />}
      {metaSentences.map((sentence, i) => {
        const cmd = commandForSentence(model, sentence);
        return (
          <div
            key={`m-${i}`}
            className={sentenceClass(isSentenceSelected, sentence)}
            style={cmd && onSelectEntity ? { fontSize: "0.85em", opacity: 0.8, cursor: "pointer" } : { fontSize: "0.85em", opacity: 0.8 }}
            onClick={cmd && onSelectEntity ? () => onSelectEntity(cmd) : undefined}
          >
            {renderSentence(sentence, doc)}
          </div>
        );
      })}
    </div>
  );
}
