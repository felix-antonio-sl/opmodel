// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { addAppearance, addThing, buildArtifactsFromSdDraft, createModel, EMPTY_SD_DRAFT, refineMainProcess, saveModel } from "@opmodel/core";
import { OpmGraphGeneratorPanel } from "../src/features/generator/components/OpmGraphGeneratorPanel";

function buildImportedModel() {
  let model = createModel("Imported Coffee");
  const process = { id: "proc-coffee-making", name: "Coffee Making", kind: "process", essence: "physical", affiliation: "system" } as const;
  const water = { id: "obj-water", name: "Water", kind: "object", essence: "physical", affiliation: "system" } as const;
  let result = addThing(model, process); if (!result.ok) throw new Error(result.error.message); model = result.value;
  result = addThing(model, water); if (!result.ok) throw new Error(result.error.message); model = result.value;
  let appearance = addAppearance(model, { thing: process.id, opd: "opd-sd", x: 220, y: 80, w: 180, h: 90 }); if (!appearance.ok) throw new Error(appearance.error.message); model = appearance.value;
  appearance = addAppearance(model, { thing: water.id, opd: "opd-sd", x: 40, y: 80, w: 140, h: 70 }); if (!appearance.ok) throw new Error(appearance.error.message); model = appearance.value;
  return model;
}

function okJson(body: unknown) {
  return Promise.resolve({
    ok: true,
    text: async () => JSON.stringify(body),
  } as Response);
}

function buildApplySimpleResponse() {
  const incremental = buildIncrementalResult();
  return {
    ok: true,
    artifact_kind: "kernel-patch-proposal",
    appliedFromTaskKind: "incremental-change",
    modelJson: incremental.artifacts[0].payload.outputs.modelJson,
    canonicalOpl: incremental.artifacts[0].payload.outputs.canonicalOpl,
    visualSpec: {
      version: "v1",
      diagramKind: "opm-sd",
      title: "Battery Charging System",
      style: "dark-terminal",
      scene: { lanes: [], groups: [] },
      nodes: [{ id: "proc-battery-charging", kind: "process" }],
      edges: [],
      guardrails: [],
      canonicalOpl: incremental.artifacts[0].payload.outputs.canonicalOpl,
    },
  };
}

function buildWizardResult() {
  const built = buildArtifactsFromSdDraft({
    ...EMPTY_SD_DRAFT,
    systemName: "Battery Charging System",
    mainProcess: "Battery Charging",
    beneficiary: "Driver Group",
    beneficiaryAttribute: "Mobility Convenience",
    beneficiaryStateIn: "limited",
    beneficiaryStateOut: "enhanced",
    valueObject: "Battery",
    valueStateIn: "depleted",
    valueStateOut: "charged",
    agents: ["Operator"],
    instruments: ["Charging Station"],
    inputs: ["Electrical Energy"],
    outputs: ["Charged Battery"],
  });
  if (!built.ok) throw new Error(built.error.message);

  return {
    task_kind: "wizard-generate",
    status: "proposed",
    artifacts: [{
      artifact_kind: "sd-draft",
      summary: "Wizard draft validated and compiled into real core artifacts.",
      payload: {
        ok: true,
        proposal: {
          summary: "Wizard draft validated and compiled into real core artifacts.",
          rationale: "Wizard generation should converge to a validated SdDraft and real derived artifacts from the core generator slice.",
          confidence: 0.92,
          requiresHumanReview: false,
          ssotChecksExpected: ["sd-draft-validation-attempted"],
        },
        context: {},
        outputs: {
          modelJson: saveModel(built.value.model),
          canonicalOpl: built.value.opl,
        },
      },
    }],
    guardrail: { ok: true, checks: [], issues: [] },
    trace: ["received-task"],
  };
}

function buildRefineResult() {
  const built = buildArtifactsFromSdDraft({
    ...EMPTY_SD_DRAFT,
    systemName: "Battery Charging System",
    mainProcess: "Battery Charging",
    beneficiary: "Driver Group",
    beneficiaryAttribute: "Mobility Convenience",
    beneficiaryStateIn: "limited",
    beneficiaryStateOut: "enhanced",
    valueObject: "Battery",
    valueStateIn: "depleted",
    valueStateOut: "charged",
  });
  if (!built.ok) throw new Error(built.error.message);
  const refined = refineMainProcess(built.value.model, {
    subprocesses: ["Authorize Charge", "Transfer Energy", "Confirm Completion"],
    internalObjects: ["Charging Session", "Charge Status"],
  });
  if (!refined.ok) throw new Error(refined.error.message);

  return {
    task_kind: "refine-process",
    status: "proposed",
    artifacts: [{
      artifact_kind: "refinement-proposal",
      summary: "Built in-zoom refinement proposal through the real core refinement slice.",
      payload: {
        ok: true,
        proposal: {
          summary: "Built in-zoom refinement proposal through the real core refinement slice.",
          rationale: "Refine-process should converge to a real refinement proposal.",
          confidence: 0.9,
          requiresHumanReview: false,
          ssotChecksExpected: ["sd-sd1-methodology-required"],
          childOpdId: refined.value.childOpdId,
        },
        context: {},
        outputs: {
          modelJson: saveModel(refined.value.model),
          canonicalOpl: built.value.opl,
        },
      },
    }],
    guardrail: { ok: true, checks: [], issues: [] },
    trace: ["received-task"],
  };
}

function buildIncrementalResult() {
  const built = buildArtifactsFromSdDraft({
    ...EMPTY_SD_DRAFT,
    systemName: "Battery Charging System",
    mainProcess: "Battery Charging",
    beneficiary: "Driver Group",
    beneficiaryAttribute: "Mobility Convenience",
    beneficiaryStateIn: "limited",
    beneficiaryStateOut: "enhanced",
    valueObject: "Battery",
    valueStateIn: "depleted",
    valueStateOut: "charged",
  });
  if (!built.ok) throw new Error(built.error.message);
  let model = built.value.model;
  const backup = addThing(model, { id: "obj-backup-generator", name: "Backup Generator", kind: "object", essence: "physical", affiliation: "systemic" } as const);
  if (!backup.ok) throw new Error(backup.error.message);
  model = backup.value;
  const appearance = addAppearance(model, { thing: "obj-backup-generator", opd: "opd-sd", x: 650, y: 140, w: 160, h: 50 });
  if (!appearance.ok) throw new Error(appearance.error.message);
  model = appearance.value;

  return {
    task_kind: "incremental-change",
    status: "proposed",
    artifacts: [{
      artifact_kind: "kernel-patch-proposal",
      summary: "Proposed 1 kernel patch operation from incremental request.",
      payload: {
        ok: true,
        proposal: {
          summary: "Proposed 1 kernel patch operation from incremental request.",
          rationale: "Incremental change requests should converge to a stable KernelPatchProposal.",
          confidence: 0.94,
          requiresHumanReview: false,
          ssotChecksExpected: ["kernel-patch-proposal-generated"],
          operations: [{ kind: "add-enabler", role: "instrument", processName: "Battery Charging", thingName: "Backup Generator" }],
        },
        context: { previewApplied: true },
        outputs: {
          modelJson: saveModel(model),
          canonicalOpl: "=== SD ===\nBackup Generator is an object, physical.",
        },
      },
    }],
    guardrail: { ok: true, checks: [], issues: [] },
    trace: ["received-task"],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpmGraphGeneratorPanel", () => {
  it("walks the wizard, refines to SD1, and applies an incremental preview", async () => {
    const onOpenInEditor = vi.fn();
    const onOpenLlmSettings = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const payload = JSON.parse(String(init?.body ?? "{}"));
      if (url.includes("/v1/reviews/apply-simple")) {
        return okJson(buildApplySimpleResponse());
      }
      switch (payload.task?.kind) {
        case "wizard-generate":
          return okJson(buildWizardResult());
        case "refine-process":
          return okJson(buildRefineResult());
        case "incremental-change":
          return okJson(buildIncrementalResult());
        case "render":
          return okJson({
            task_kind: "render",
            status: "proposed",
            artifacts: [{ artifact_kind: "render-intent", summary: "Render verified.", payload: { ok: true, proposal: { summary: "Render verified.", rationale: "ok", confidence: 0.9, requiresHumanReview: false, ssotChecksExpected: [] }, context: {}, outputs: { canonicalOpl: "=== SD ===" } } }],
            guardrail: { ok: true, checks: [], issues: [] },
            trace: ["received-task"],
          });
        default:
          throw new Error(`Unexpected task kind ${payload.task?.kind}`);
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      React.createElement(OpmGraphGeneratorPanel, {
        onClose: vi.fn(),
        onOpenInEditor,
        onOpenLlmSettings,
      }),
    );

    fireEvent.click(screen.getByText("Abrir wizard SD"));

    fireEvent.change(screen.getByPlaceholderText("Battery Charging System"), { target: { value: "Battery Charging System" } });
    fireEvent.change(screen.getByPlaceholderText("Battery Charging"), { target: { value: "Battery Charging" } });
    fireEvent.click(screen.getByText("Next"));

    fireEvent.change(screen.getByPlaceholderText("Driver Group"), { target: { value: "Driver Group" } });
    fireEvent.change(screen.getByPlaceholderText("Mobility Convenience"), { target: { value: "Mobility Convenience" } });
    fireEvent.change(screen.getByPlaceholderText("Battery"), { target: { value: "Battery" } });
    fireEvent.click(screen.getByText("Next"));

    fireEvent.click(screen.getAllByText("+ Add")[0]!);
    fireEvent.change(screen.getByPlaceholderText("Operator"), { target: { value: "Operator" } });
    fireEvent.click(screen.getAllByText("+ Add")[1]!);
    fireEvent.change(screen.getByPlaceholderText("Charging Station"), { target: { value: "Charging Station" } });
    fireEvent.click(screen.getByText("Next"));

    fireEvent.click(screen.getByText("Generate model"));
    await screen.findByText(/Proposal review/i);
    expect(screen.getByText(/Active LLM:/).textContent).toContain("not configured");
    fireEvent.click(screen.getByText("Change LLM settings"));
    expect(onOpenLlmSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Refine main process"));
    fireEvent.click(screen.getByText("Generate SD1"));
    await waitFor(() => expect(screen.getByText(/Current view:/).textContent).toContain("SD1"));

    fireEvent.click(screen.getByText("Return to SD"));
    fireEvent.click(screen.getByText("Run incremental change"));
    fireEvent.change(screen.getByDisplayValue(/add instrument Backup Generator/i), { target: { value: "add instrument Backup Generator to Battery Charging" } });
    fireEvent.click(screen.getByText("Build proposal"));
    await screen.findByText(/Proposed 1 kernel patch operation/i);
    fireEvent.click(screen.getByText("Apply simple preview"));
    await waitFor(() => expect(screen.getByText(/decision: applied/i)).toBeTruthy());

    fireEvent.click(screen.getByText("Open in editor"));
    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
  });

  it("can open directly into workspace from an imported model", () => {
    render(
      React.createElement(OpmGraphGeneratorPanel, {
        onClose: vi.fn(),
        onOpenInEditor: vi.fn(),
        initialModel: buildImportedModel(),
      }),
    );

    expect(screen.getByText(/Current view:/).textContent).toContain("Imported OPL");
    expect(screen.getByText(/Imported Coffee/)).toBeTruthy();
  });
});
