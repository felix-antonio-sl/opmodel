import { useMemo, useState } from "react";
import {
  buildArtifactsFromSdDraft,
  kernelToOpl,
  kernelToVisualExportPrompt,
  kernelToVisualRenderSpec,
  refineMainProcess,
  validateRefinedModel,
  validateSdDraft,
  type Model,
  type VisualRenderSpec,
} from "@opmodel/core";
import { renderVisualRenderSpec } from "../../../lib/svg/render-visual-render-spec";
import { StartScreen } from "./StartScreen";
import { SdWizard } from "./SdWizard";
import { ModelWorkspace } from "./ModelWorkspace";
import { useSdWizard } from "../state/useSdWizard";

interface OpmGraphGeneratorPanelProps {
  onClose: () => void;
  onOpenInEditor: (model: Model) => void;
  onOpenLlmSettings?: () => void;
}

type WorkspaceState = {
  model: Model;
  opl: string;
  svg: string;
  visualExport: ReturnType<typeof kernelToVisualExportPrompt>;
  visualSpec: VisualRenderSpec;
  currentViewLabel: string;
  validationReport: ReturnType<typeof validateSdDraft>;
};

export function OpmGraphGeneratorPanel({ onClose, onOpenInEditor, onOpenLlmSettings }: OpmGraphGeneratorPanelProps) {
  const [mode, setMode] = useState<"start" | "wizard" | "workspace">("start");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [baseWorkspace, setBaseWorkspace] = useState<WorkspaceState | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceState | null>(null);
  const wizard = useSdWizard();

  const validation = useMemo(() => validateSdDraft(wizard.draft), [wizard.draft]);

  const buildWorkspaceState = (model: Model, kernel: Parameters<typeof kernelToVisualRenderSpec>[0], currentViewLabel: string, opdId?: string): WorkspaceState => {
    const opl = kernelToOpl(kernel);
    const visualSpec = kernelToVisualRenderSpec(kernel, opdId ? { opdId } : undefined);
    const svg = renderVisualRenderSpec(visualSpec);
    return {
      model,
      opl,
      svg,
      visualExport: kernelToVisualExportPrompt(kernel, opdId ? { opdId } : undefined),
      visualSpec,
      currentViewLabel,
      validationReport: currentViewLabel === "SD" ? validation : validateRefinedModel(model),
    };
  };

  const handleGenerate = () => {
    const result = buildArtifactsFromSdDraft(wizard.draft);
    if (!result.ok) {
      setApplyError(result.error.message);
      return;
    }
    const workspace = buildWorkspaceState(result.value.model, result.value.kernel, "SD");

    setBaseWorkspace(workspace);
    setActiveWorkspace(workspace);
    setApplyError(null);
    setMode("workspace");
  };

  const handleRefineMainProcess = (draft: { subprocesses: string[]; internalObjects: string[] }) => {
    if (!baseWorkspace) return;
    const result = refineMainProcess(baseWorkspace.model, draft);
    if (!result.ok) {
      setApplyError(result.error.message);
      return;
    }

    const refinedWorkspace = buildWorkspaceState(result.value.model, result.value.kernel, "SD1", result.value.childOpdId);
    setActiveWorkspace(refinedWorkspace);
    setApplyError(null);
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

        {mode === "workspace" && activeWorkspace && (
          <ModelWorkspace
            model={activeWorkspace.model}
            opl={activeWorkspace.opl}
            svg={activeWorkspace.svg}
            validation={activeWorkspace.validationReport}
            visualExport={activeWorkspace.visualExport}
            visualSpec={activeWorkspace.visualSpec}
            currentViewLabel={activeWorkspace.currentViewLabel}
            onBackToWizard={() => setMode("wizard")}
            onOpenInEditor={() => onOpenInEditor(activeWorkspace.model)}
            onOpenLlmSettings={onOpenLlmSettings}
            onRefineMainProcess={activeWorkspace.currentViewLabel === "SD" ? handleRefineMainProcess : undefined}
            onReturnToSd={activeWorkspace.currentViewLabel === "SD1" && baseWorkspace ? () => setActiveWorkspace(baseWorkspace) : undefined}
          />
        )}
      </div>
    </div>
  );
}
