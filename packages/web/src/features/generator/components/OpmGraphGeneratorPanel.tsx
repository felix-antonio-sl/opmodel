import { useEffect, useMemo, useState } from "react";
import {
  kernelToOpl,
  kernelToVisualExportPrompt,
  kernelToVisualRenderSpec,
  loadModel,
  saveModel,
  semanticKernelFromModel,
  validateRefinedModel,
  validateSdDraft,
  type Model,
  type VisualRenderSpec,
} from "@opmodel/core";
import { renderVisualRenderSpec } from "../../../lib/svg/render-visual-render-spec";
import { StartScreen } from "./StartScreen";
import { SdWizard } from "./SdWizard";
import { ModelWorkspace } from "./ModelWorkspace";
import { applySimplePreview, runModelingTask } from "../lib/orchestrator-client";
import type { ApplySimplePreviewResult, OrchestratorPayload, OrchestratorResult, ReviewDecision } from "../types";
import { useSdWizard } from "../state/useSdWizard";

interface OpmGraphGeneratorPanelProps {
  onClose: () => void;
  onOpenInEditor: (model: Model) => void;
  onOpenLlmSettings?: () => void;
  initialModel?: Model | null;
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

function parseModelSnapshot(payload: OrchestratorPayload) {
  const modelJson = payload.outputs?.modelJson;
  if (typeof modelJson !== "string" || modelJson.trim().length === 0) return null;
  const loaded = loadModel(modelJson);
  if (!loaded.ok) {
    throw new Error(`Model preview could not be loaded: ${loaded.error.message}`);
  }
  return loaded.value;
}

function snapshotFromModel(model: Model) {
  return JSON.parse(saveModel(model)) as Record<string, unknown>;
}

function workspaceFromAppliedPreview(
  applied: ApplySimplePreviewResult,
  buildWorkspaceState: (model: Model, currentViewLabel: string, opdId?: string) => WorkspaceState,
  fallbackViewLabel: string,
) {
  const loaded = loadModel(applied.modelJson);
  if (!loaded.ok) {
    throw new Error(`Applied preview could not be loaded: ${loaded.error.message}`);
  }
  const nextViewLabel = applied.childOpdId ? "SD1" : fallbackViewLabel;
  return buildWorkspaceState(loaded.value, nextViewLabel, applied.childOpdId ?? undefined);
}

export function OpmGraphGeneratorPanel({ onClose, onOpenInEditor, onOpenLlmSettings, initialModel = null }: OpmGraphGeneratorPanelProps) {
  const [mode, setMode] = useState<"start" | "wizard" | "workspace">("start");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [lastReview, setLastReview] = useState<OrchestratorResult | null>(null);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision | null>(null);
  const [baseWorkspace, setBaseWorkspace] = useState<WorkspaceState | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceState | null>(null);
  const wizard = useSdWizard();

  const validation = useMemo(() => validateSdDraft(wizard.draft), [wizard.draft]);

  const buildWorkspaceState = (model: Model, currentViewLabel: string, opdId?: string): WorkspaceState => {
    const kernel = semanticKernelFromModel(model);
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

  const applyWorkspaceFromReview = (result: OrchestratorResult, options?: { asBase?: boolean; fallbackViewLabel?: string }) => {
    const artifact = result.artifacts[0];
    if (!artifact) return null;
    const model = parseModelSnapshot(artifact.payload);
    if (!model) return null;

    const nextViewLabel = artifact.payload.proposal.childOpdId
      ? "SD1"
      : options?.fallbackViewLabel ?? (result.task_kind === "opl-import" ? "Imported OPL" : "SD");
    const workspace = buildWorkspaceState(model, nextViewLabel, artifact.payload.proposal.childOpdId);

    if (options?.asBase) {
      setBaseWorkspace(workspace);
    }
    setActiveWorkspace(workspace);
    return workspace;
  };

  useEffect(() => {
    if (!initialModel) return;
    const importedWorkspace = buildWorkspaceState(initialModel, "Imported OPL");
    setBaseWorkspace(importedWorkspace);
    setActiveWorkspace(importedWorkspace);
    setApplyError(null);
    setLastReview(null);
    setReviewDecision(null);
    setMode("workspace");
  }, [initialModel]);

  const runReviewTask = async (
    task: Parameters<typeof runModelingTask>[0]["task"],
    options?: { applyWorkspace?: boolean; asBase?: boolean; fallbackViewLabel?: string },
  ) => {
    setReviewBusy(true);
    setReviewError(null);
    try {
      const result = await runModelingTask({ task });
      setLastReview(result);
      setReviewDecision(null);
      if (options?.applyWorkspace) {
        applyWorkspaceFromReview(result, { asBase: options.asBase, fallbackViewLabel: options.fallbackViewLabel });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Modeling orchestrator request failed.";
      setReviewError(message);
      throw error;
    } finally {
      setReviewBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!validation.ok) {
      setApplyError("Wizard draft must pass local validation before orchestrator handoff.");
      return;
    }

    try {
      const result = await runReviewTask(
        {
          kind: "wizard-generate",
          source: "wizard",
          ...wizard.draft,
        },
        { applyWorkspace: true, asBase: true, fallbackViewLabel: "SD" },
      );
      setMode("workspace");
      setApplyError(null);
      if (!result.guardrail.ok) {
        setApplyError(result.guardrail.issues.join(" · "));
      }
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "Wizard generation failed.");
    }
  };

  const handleRefineMainProcess = async (draft: { subprocesses: string[]; internalObjects: string[] }) => {
    if (!baseWorkspace) return;
    const processName = [...baseWorkspace.model.things.values()].find((thing) => thing.kind === "process")?.name;
    if (!processName) {
      setApplyError("No main process found in the current workspace.");
      return;
    }

    const request = [
      `subprocesses: ${draft.subprocesses.join(", ")}`,
      draft.internalObjects.length > 0 ? `internal objects: ${draft.internalObjects.join(", ")}` : null,
    ].filter(Boolean).join("; ");

    try {
      await runReviewTask(
        {
          kind: "refine-process",
          source: "incremental-session",
          processId: processName,
          request,
          modelSnapshot: snapshotFromModel(baseWorkspace.model),
          currentOpl: baseWorkspace.opl,
        },
        { applyWorkspace: true, fallbackViewLabel: "SD1" },
      );
      setApplyError(null);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "Refine-process failed.");
    }
  };

  const handleRunIncrementalChange = async (request: string) => {
    if (!activeWorkspace) return;
    try {
      await runReviewTask({
        kind: "incremental-change",
        source: "incremental-session",
        request,
        modelSnapshot: snapshotFromModel(activeWorkspace.model),
        currentOpl: activeWorkspace.opl,
      });
      setApplyError(null);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "Incremental change failed.");
    }
  };

  const handleVerifyRender = async () => {
    if (!activeWorkspace) return;
    try {
      await runReviewTask({
        kind: "render",
        source: "system",
        modelSnapshot: snapshotFromModel(activeWorkspace.model),
      });
      setApplyError(null);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "Render verification failed.");
    }
  };

  const handleAcceptReview = () => {
    const taskKind = lastReview?.task_kind ?? "review";
    setReviewDecision({ decision: "accepted", note: `${taskKind} accepted for human review flow.` });
  };

  const handleRejectReview = () => {
    const taskKind = lastReview?.task_kind ?? "review";
    setReviewDecision({ decision: "rejected", note: `${taskKind} rejected for now.` });
  };

  const handleApplySimpleReview = async () => {
    if (!lastReview?.artifacts[0]) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const applied = await applySimplePreview(lastReview.artifacts[0]);
      const fallbackViewLabel = activeWorkspace?.currentViewLabel ?? "SD";
      const workspace = workspaceFromAppliedPreview(applied, buildWorkspaceState, fallbackViewLabel);
      if (lastReview.task_kind === "wizard-generate" || lastReview.task_kind === "opl-import") {
        setBaseWorkspace(workspace);
      }
      if (lastReview.task_kind === "incremental-change" && baseWorkspace?.currentViewLabel === "SD") {
        setBaseWorkspace(workspace);
      }
      setActiveWorkspace(workspace);
      setReviewDecision({ decision: "applied", note: "Backend apply-simple validated and promoted the preview into the workspace." });
      setApplyError(null);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Apply simple preview failed.");
    } finally {
      setReviewBusy(false);
    }
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
              onGenerate={() => void handleGenerate()}
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
            onRunIncrementalChange={handleRunIncrementalChange}
            onVerifyRender={handleVerifyRender}
            reviewResult={lastReview}
            reviewDecision={reviewDecision}
            reviewBusy={reviewBusy}
            reviewError={reviewError ?? applyError}
            onAcceptReview={handleAcceptReview}
            onRejectReview={handleRejectReview}
            onApplySimpleReview={() => void handleApplySimpleReview()}
          />
        )}
      </div>
    </div>
  );
}
