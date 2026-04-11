import { useMemo, useState } from "react";
import {
  buildArtifactsFromSdDraft,
  kernelToDiagramSpec,
  kernelToOpl,
  kernelToVisualExportPrompt,
  validateSdDraft,
  type Model,
} from "@opmodel/core";
import { renderDiagramSpec } from "../../../lib/svg/render-diagram-spec";
import { StartScreen } from "./StartScreen";
import { SdWizard } from "./SdWizard";
import { ModelWorkspace } from "./ModelWorkspace";
import { useSdWizard } from "../state/useSdWizard";

interface OpmGraphGeneratorPanelProps {
  onClose: () => void;
  onOpenInEditor: (model: Model) => void;
}

export function OpmGraphGeneratorPanel({ onClose, onOpenInEditor }: OpmGraphGeneratorPanelProps) {
  const [mode, setMode] = useState<"start" | "wizard" | "workspace">("start");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [generatedModel, setGeneratedModel] = useState<Model | null>(null);
  const [generatedOpl, setGeneratedOpl] = useState("");
  const [generatedSvg, setGeneratedSvg] = useState("");
  const [generatedVisualExport, setGeneratedVisualExport] = useState<ReturnType<typeof kernelToVisualExportPrompt> | null>(null);
  const wizard = useSdWizard();

  const validation = useMemo(() => validateSdDraft(wizard.draft), [wizard.draft]);

  const handleGenerate = () => {
    const result = buildArtifactsFromSdDraft(wizard.draft);
    if (!result.ok) {
      setApplyError(result.error.message);
      return;
    }
    const opl = kernelToOpl(result.value.kernel);
    const diagram = kernelToDiagramSpec(result.value.kernel);
    const svg = renderDiagramSpec(diagram);

    setGeneratedModel(result.value.model);
    setGeneratedOpl(opl);
    setGeneratedSvg(svg);
    setGeneratedVisualExport(kernelToVisualExportPrompt(result.value.kernel));
    setApplyError(null);
    setMode("workspace");
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(2,6,23,0.82)", backdropFilter: "blur(3px)", padding: 24, overflow: "auto" }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", border: "1px solid var(--code-border)", borderRadius: 18, background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))", padding: 20, boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}>
        {mode === "start" && (
          <StartScreen onUseWizard={() => setMode("wizard")} onClose={onClose} />
        )}

        {mode === "wizard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setMode("start")}>← Back</button>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <SdWizard
              step={wizard.step}
              draft={wizard.draft}
              canGoNext={wizard.canGoNext}
              onChange={wizard.updateDraft}
              onBack={wizard.back}
              onNext={wizard.next}
              onGenerate={handleGenerate}
            />
            {applyError && <div style={{ color: "var(--error)", fontSize: 13 }}>{applyError}</div>}
          </div>
        )}

        {mode === "workspace" && generatedModel && generatedVisualExport && (
          <ModelWorkspace
            model={generatedModel}
            opl={generatedOpl}
            svg={generatedSvg}
            validation={validation}
            visualExport={generatedVisualExport}
            onBackToWizard={() => setMode("wizard")}
            onOpenInEditor={() => onOpenInEditor(generatedModel)}
          />
        )}
      </div>
    </div>
  );
}
