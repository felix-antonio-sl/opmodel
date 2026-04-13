import { useEffect, useMemo, useState } from "react";
import type { DraftValidationReport, Model, VisualExportPrompt, VisualRenderSpec } from "@opmodel/core";
import { createDiagramLLMProvider, loadStoredDiagramLLMConfig, verifyRenderedSvg, type RenderedSvgVerificationReport } from "../../../lib/renderers/llm-renderer";
import type { OrchestratorResult, ReviewDecision, ReviewHistoryEntry } from "../types";
import { ProposalReviewPanel } from "./ProposalReviewPanel";
import { DiagramPreview } from "./DiagramPreview";
import { OplPanel } from "./OplPanel";
import { ValidationPanel } from "./ValidationPanel";

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

interface ModelWorkspaceProps {
  model: Model;
  opl: string;
  svg: string;
  validation: DraftValidationReport;
  visualExport: VisualExportPrompt;
  visualSpec: VisualRenderSpec;
  currentViewLabel?: string;
  onOpenInEditor: () => void;
  onBackToWizard: () => void;
  onOpenLlmSettings?: () => void;
  onRefineMainProcess?: (draft: { subprocesses: string[]; internalObjects: string[] }) => void | Promise<void>;
  onReturnToSd?: () => void;
  onRunIncrementalChange?: (request: string) => void | Promise<void>;
  onVerifyRender?: () => void | Promise<void>;
  reviewResult?: OrchestratorResult | null;
  reviewDecision?: ReviewDecision | null;
  reviewBusy?: boolean;
  reviewError?: string | null;
  reviewHistory?: ReviewHistoryEntry[];
  onAcceptReview?: () => void;
  onRejectReview?: () => void;
  onApplySimpleReview?: () => void;
}

export function ModelWorkspace({ model, opl, svg, validation, visualExport, visualSpec, currentViewLabel = "SD", onOpenInEditor, onBackToWizard, onOpenLlmSettings, onRefineMainProcess, onReturnToSd, onRunIncrementalChange, onVerifyRender, reviewResult, reviewDecision, reviewBusy = false, reviewError, reviewHistory = [], onAcceptReview, onRejectReview, onApplySimpleReview }: ModelWorkspaceProps) {
  const [premiumSvg, setPremiumSvg] = useState<string | null>(null);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  const [isGeneratingPremium, setIsGeneratingPremium] = useState(false);
  const [premiumVerification, setPremiumVerification] = useState<RenderedSvgVerificationReport | null>(null);
  const [showRefinementForm, setShowRefinementForm] = useState(false);
  const [showIncrementalForm, setShowIncrementalForm] = useState(false);
  const [subprocessesText, setSubprocessesText] = useState("Authorize Charge\nTransfer Energy\nConfirm Completion");
  const [internalObjectsText, setInternalObjectsText] = useState("Charging Session\nCharge Status");
  const [incrementalRequest, setIncrementalRequest] = useState("add instrument Backup Generator to Battery Charging");

  const workspaceKey = useMemo(
    () => `${visualSpec.diagramKind}:${visualSpec.title}:${visualSpec.nodes.length}:${visualSpec.edges.length}:${currentViewLabel}`,
    [visualSpec.diagramKind, visualSpec.title, visualSpec.nodes.length, visualSpec.edges.length, currentViewLabel],
  );

  const generatePremium = async (options?: { silentIfNoConfig?: boolean }) => {
    const config = loadStoredDiagramLLMConfig();
    if (!config) {
      setPremiumSvg(null);
      setPremiumVerification(null);
      if (!options?.silentIfNoConfig) {
        setPremiumError("No LLM config found in localStorage key opmodel:nl-config. Reuse the NL settings first.");
      }
      return;
    }

    setIsGeneratingPremium(true);
    setPremiumError(null);
    setPremiumVerification(null);
    try {
      const provider = createDiagramLLMProvider(config);
      const result = await provider.generateSvg({
        spec: visualSpec,
        stylePack: visualSpec.style,
        systemPrompt: visualExport.prompt,
      });
      const verification = verifyRenderedSvg(visualSpec, result.svg);
      setPremiumSvg(result.svg);
      setPremiumVerification(verification);
      if (!verification.ok) {
        setPremiumError(verification.issues.map((issue) => issue.message).join(" "));
      }
    } catch (error) {
      setPremiumSvg(null);
      setPremiumVerification(null);
      setPremiumError(error instanceof Error ? error.message : "Failed to generate premium diagram.");
    } finally {
      setIsGeneratingPremium(false);
    }
  };

  useEffect(() => {
    setPremiumSvg(null);
    setPremiumVerification(null);
    setPremiumError(null);
    void generatePremium({ silentIfNoConfig: true });
  }, [workspaceKey]);

  const llmConfig = useMemo(() => loadStoredDiagramLLMConfig(), [workspaceKey, premiumSvg, premiumError]);
  const llmConfigLabel = llmConfig
    ? `${llmConfig.provider}${llmConfig.model ? ` / ${llmConfig.model}` : ""}`
    : "not configured";

  const primarySvg = premiumSvg ?? svg;
  const isPremiumPrimary = Boolean(premiumSvg);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--text-primary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--code-text)" }}>{model.meta.name}</div>
          <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 13 }}>
            Current view: <code>{currentViewLabel}</code> · Pipeline: <code>SdDraft -&gt; SemanticKernel -&gt; VisualRenderSpec -&gt; premium SVG</code>
          </div>
          <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>Active LLM: <code>{llmConfigLabel}</code></span>
            {onOpenLlmSettings && <button onClick={onOpenLlmSettings}>Change LLM settings</button>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={onBackToWizard}>Back to wizard</button>
          {onReturnToSd && <button onClick={onReturnToSd}>Return to SD</button>}
          <button onClick={() => downloadText(`${model.meta.name.toLowerCase().replace(/\s+/g, "-")}.opl.txt`, opl, "text/plain")}>Export OPL</button>
          <button onClick={() => downloadText(`${model.meta.name.toLowerCase().replace(/\s+/g, "-")}.svg`, primarySvg, "image/svg+xml")}>Export primary SVG</button>
          {onRefineMainProcess && <button onClick={() => setShowRefinementForm((value) => !value)}>{showRefinementForm ? "Hide SD1 refine" : "Refine main process"}</button>}
          {onRunIncrementalChange && <button onClick={() => setShowIncrementalForm((value) => !value)}>{showIncrementalForm ? "Hide incremental change" : "Run incremental change"}</button>}
          {onVerifyRender && <button onClick={() => void onVerifyRender()} disabled={reviewBusy}>{reviewBusy ? "Checking render..." : "Review render"}</button>}
          <button onClick={() => navigator.clipboard.writeText(visualExport.prompt)}>Copy premium prompt</button>
          <button onClick={() => void generatePremium()} disabled={isGeneratingPremium}>{isGeneratingPremium ? "Generating premium SVG..." : premiumSvg ? "Regenerate premium SVG" : "Generate premium SVG"}</button>
          {premiumSvg && <button onClick={() => downloadText(`${model.meta.name.toLowerCase().replace(/\s+/g, "-")}.premium.svg`, premiumSvg, "image/svg+xml")}>Export premium SVG</button>}
          <button onClick={() => downloadText(`${model.meta.name.toLowerCase().replace(/\s+/g, "-")}.debug.svg`, svg, "image/svg+xml")}>Export fallback SVG</button>
          <button onClick={() => downloadText(`${model.meta.name.toLowerCase().replace(/\s+/g, "-")}.visual-render-spec.json`, JSON.stringify(visualSpec, null, 2), "application/json")}>Export render spec</button>
          <button onClick={() => downloadText(`${model.meta.name.toLowerCase().replace(/\s+/g, "-")}.visual-export.json`, JSON.stringify(visualExport, null, 2), "application/json")}>Export visual adapter</button>
          <button onClick={onOpenInEditor} style={{ background: "#1d4ed8", color: "white", border: "1px solid #2563eb", borderRadius: 10, padding: "10px 14px" }}>
            Open in editor
          </button>
        </div>
      </div>

      {showRefinementForm && onRefineMainProcess && (
        <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 16, background: "rgba(15,23,42,0.55)", display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>SD1 refinement</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Subprocesses, one per line</div>
              <textarea value={subprocessesText} onChange={(event) => setSubprocessesText(event.target.value)} style={{ minHeight: 120, resize: "vertical", background: "#020617", color: "#e2e8f0", border: "1px solid var(--code-border)", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }} />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Internal objects, one per line</div>
              <textarea value={internalObjectsText} onChange={(event) => setInternalObjectsText(event.target.value)} style={{ minHeight: 120, resize: "vertical", background: "#020617", color: "#e2e8f0", border: "1px solid var(--code-border)", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }} />
            </div>
          </div>
          <div>
            <button
              onClick={() => void onRefineMainProcess({
                subprocesses: subprocessesText.split("\n").map((item) => item.trim()).filter(Boolean),
                internalObjects: internalObjectsText.split("\n").map((item) => item.trim()).filter(Boolean),
              })}
              style={{ background: "#7c3aed", color: "white", border: "1px solid #8b5cf6", borderRadius: 10, padding: "10px 14px" }}
            >
              Generate SD1
            </button>
          </div>
        </div>
      )}

      {showIncrementalForm && onRunIncrementalChange && (
        <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 16, background: "rgba(15,23,42,0.55)", display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Incremental change</div>
          <textarea
            value={incrementalRequest}
            onChange={(event) => setIncrementalRequest(event.target.value)}
            style={{ minHeight: 110, resize: "vertical", background: "#020617", color: "#e2e8f0", border: "1px solid var(--code-border)", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}
          />
          <div>
            <button
              onClick={() => void onRunIncrementalChange(incrementalRequest)}
              disabled={reviewBusy || incrementalRequest.trim().length === 0}
              style={{ background: "#0f766e", color: "white", border: "1px solid #14b8a6", borderRadius: 10, padding: "10px 14px" }}
            >
              {reviewBusy ? "Building proposal..." : "Build proposal"}
            </button>
          </div>
        </div>
      )}

      {reviewResult && (
        <ProposalReviewPanel
          result={reviewResult}
          decision={reviewDecision}
          history={reviewHistory}
          busy={reviewBusy}
          error={reviewError}
          onAccept={onAcceptReview}
          onReject={onRejectReview}
          onApplySimple={onApplySimpleReview}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 12, background: "rgba(15,23,42,0.55)", fontSize: 12, color: "var(--text-muted)" }}>
            Primary renderer: <strong style={{ color: isPremiumPrimary ? "#22c55e" : "#f59e0b" }}>{isPremiumPrimary ? "premium LLM" : "deterministic fallback"}</strong>
            <span style={{ marginLeft: 8 }}>· Active config: <code>{llmConfigLabel}</code></span>
            {isGeneratingPremium && <span style={{ marginLeft: 8 }}>Generating premium output...</span>}
            {!isPremiumPrimary && !isGeneratingPremium && <span style={{ marginLeft: 8 }}>Premium output not available yet, showing fallback.</span>}
          </div>
          <DiagramPreview svg={primarySvg} />
          {premiumError && <div style={{ color: "var(--warning)", fontSize: 13 }}>{premiumError}</div>}
          {premiumVerification && (
            <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 12, background: "rgba(15,23,42,0.55)", fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: premiumVerification.ok ? "#22c55e" : "#f59e0b", marginBottom: 8 }}>
                Premium SVG verification: {premiumVerification.ok ? "pass" : "issues found"}
              </div>
              <div style={{ display: "grid", gap: 6, color: "var(--text-muted)" }}>
                {premiumVerification.issues.length === 0 ? (
                  <div>No structural issues detected against VisualRenderSpec.</div>
                ) : premiumVerification.issues.slice(0, 8).map((issue, index) => (
                  <div key={`${issue.code}-${index}`}>{issue.code}: {issue.message}</div>
                ))}
              </div>
            </div>
          )}
          {premiumSvg && (
            <details style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 12, background: "rgba(15,23,42,0.4)" }}>
              <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>Show fallback/debug SVG</summary>
              <div style={{ marginTop: 12 }}>
                <DiagramPreview svg={svg} />
              </div>
            </details>
          )}
        </div>
        <ValidationPanel report={validation} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <OplPanel text={opl} />
        <div style={{ border: "1px solid var(--code-border)", borderRadius: 12, padding: 16, background: "rgba(15,23,42,0.55)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>Model summary</div>
          <div style={{ display: "grid", gap: 8, fontSize: 13, color: "var(--code-text)" }}>
            <div>{model.things.size} things</div>
            <div>{model.states.size} states</div>
            <div>{model.links.size} links</div>
            <div>{model.opds.size} OPDs</div>
            <div>Current slice: {currentViewLabel}</div>
            <div>VisualRenderSpec: {visualSpec.nodes.length} nodes / {visualSpec.edges.length} edges</div>
            <div>Primary renderer: premium LLM</div>
            <div>Active LLM config: {llmConfigLabel}</div>
            <div>Fallback renderer: deterministic debug path</div>
            <div style={{ color: "var(--text-muted)" }}>Premium output is now the canonical delivery target for this slice.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
