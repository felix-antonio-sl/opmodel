import { useMemo, useState } from "react";
import { EMPTY_SD_DRAFT, type SdDraft } from "@opmodel/core";
import type { GeneratorStep } from "../types";

export function useSdWizard(initialDraft?: Partial<SdDraft>) {
  const [step, setStep] = useState<GeneratorStep>(1);
  const [draft, setDraft] = useState<SdDraft>({ ...EMPTY_SD_DRAFT, ...initialDraft });

  const updateDraft = <K extends keyof SdDraft>(key: K, value: SdDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const canGoNext = useMemo(() => {
    if (step === 1) return Boolean(draft.systemName.trim() && draft.mainProcess.trim());
    if (step === 2) return Boolean(draft.valueObject.trim());
    return true;
  }, [draft, step]);

  return {
    step,
    draft,
    setStep,
    updateDraft,
    canGoNext,
    next: () => setStep((current) => Math.min(4, current + 1) as GeneratorStep),
    back: () => setStep((current) => Math.max(1, current - 1) as GeneratorStep),
    reset: () => {
      setDraft({ ...EMPTY_SD_DRAFT, ...initialDraft });
      setStep(1);
    },
  };
}
