import { useCallback } from "react";
import type { Model, OplSentence } from "@opmodel/core";
import { matchesSentenceSelection } from "../lib/opl-navigation";

export function useOplSentenceSelection(model: Model, selectedThing: string | null, selectedLink: string | null) {
  const isSentenceSelected = useCallback(
    (sentence: OplSentence) => matchesSentenceSelection(model, sentence, selectedThing, selectedLink),
    [model, selectedThing, selectedLink],
  );

  return { isSentenceSelected };
}
