import { useMemo } from "react";
import type { Model } from "@opmodel/core";
import { findRelatedSentenceRefs, findSentenceForSelection, getActiveSentenceText, getRelatedHighlightNames, parseSentenceRefs } from "../lib/opl-navigation";

interface UseOplContextOptions {
  model: Model;
  opdId: string;
  text: string;
  selectedThing?: string | null;
  selectedLink?: string | null;
  fallbackOpdName?: string;
}

export function useOplContext({ model, opdId, text, selectedThing, selectedLink, fallbackOpdName }: UseOplContextOptions) {
  const currentOpdName = fallbackOpdName ?? model.opds.get(opdId)?.name ?? "SD";

  const sentenceRefs = useMemo(() => parseSentenceRefs(text, currentOpdName), [text, currentOpdName]);
  const relatedSentenceRefs = useMemo(
    () => findRelatedSentenceRefs(sentenceRefs, model, selectedThing ?? null, selectedLink ?? null, opdId),
    [sentenceRefs, model, selectedThing, selectedLink, opdId],
  );
  const activeSentenceRef = useMemo(
    () => relatedSentenceRefs[0] ?? findSentenceForSelection(sentenceRefs, model, selectedThing ?? null, selectedLink ?? null, opdId),
    [relatedSentenceRefs, sentenceRefs, model, selectedThing, selectedLink, opdId],
  );
  const activeSentenceText = useMemo(() => getActiveSentenceText(text, activeSentenceRef), [text, activeSentenceRef]);
  const relatedHighlightNames = useMemo(
    () => getRelatedHighlightNames(model, selectedThing ?? null, selectedLink ?? null),
    [model, selectedThing, selectedLink],
  );

  return {
    currentOpdName,
    sentenceRefs,
    activeSentenceRef,
    activeSentenceText,
    relatedSentenceRefs,
    relatedHighlightNames,
  };
}
