import {
  buildArtifactsFromSdDraft,
  compileToKernel,
  EMPTY_SD_DRAFT,
  loadModel,
  parseOplDocuments,
  refineMainProcess,
  renderAllFromSemanticKernel,
  saveModel,
  validateRefinedModel,
} from "../../../packages/core/src/index.ts";

type BridgeRequest = {
  kind: "refine-process";
  processId: string;
  request?: string | null;
  currentOpl?: string | null;
  modelSnapshot?: Record<string, unknown> | null;
};

type RefinementDraft = {
  subprocesses: string[];
  internalObjects: string[];
};

type LoadedModel = ReturnType<typeof loadModel> extends { ok: true; value: infer T } ? T : never;

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeOplInput(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /^===\s+.+\s+===/m.test(trimmed) ? trimmed : `=== SD ===\n${trimmed}`;
}

function titleCaseFromSlug(input: string) {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultDraftForProcess(processId: string): RefinementDraft {
  const base = titleCaseFromSlug(processId.replace(/^proc-/, "")) || "Main Process";
  return {
    subprocesses: [`Preparing ${base}`, `Executing ${base}`, `Completing ${base}`],
    internalObjects: [],
  };
}

function parseRequest(request?: string | null, processId?: string): RefinementDraft {
  const fallback = defaultDraftForProcess(processId ?? "process");
  if (!request?.trim()) return fallback;

  const subprocessMatch = request.match(/(?:subprocess(?:es)?|steps?)\s*[:=-]\s*(.+?)(?:\s*(?:;|\.|$))/i);
  const internalObjectsMatch = request.match(/(?:internal objects?|internal resources?)\s*[:=-]\s*(.+?)(?:\s*(?:;|\.|$))/i);

  const parseList = (value?: string | null) =>
    (value ?? "")
      .split(/,|\band\b|\by\b/gi)
      .map((item) => item.trim())
      .filter(Boolean);

  const subprocesses = parseList(subprocessMatch?.[1]);
  const internalObjects = parseList(internalObjectsMatch?.[1]);

  return {
    subprocesses: subprocesses.length > 0 ? subprocesses : fallback.subprocesses,
    internalObjects,
  };
}

function deriveModelFromSnapshot(modelSnapshot?: Record<string, unknown> | null) {
  if (!modelSnapshot) return { ok: false as const, source: "none", error: null as null | { stage: string; message: string } };
  const loaded = loadModel(JSON.stringify(modelSnapshot));
  if (!loaded.ok) {
    return { ok: false as const, source: "modelSnapshot", error: { stage: loaded.error.phase, message: loaded.error.message } };
  }
  return { ok: true as const, source: "modelSnapshot", model: loaded.value };
}

function deriveModelFromCurrentOpl(currentOpl: string | null | undefined, requestedProcessId: string) {
  if (!currentOpl?.trim()) return { ok: false as const, source: "none", error: null as null | { stage: string; message: string }, normalizedOpl: null as string | null };
  const normalizedOpl = normalizeOplInput(currentOpl);
  const parsed = parseOplDocuments(normalizedOpl);
  if (!parsed.ok) {
    return { ok: false as const, source: "currentOpl", error: { stage: "parse", message: parsed.error.message }, normalizedOpl };
  }
  const compiled = compileToKernel(parsed.value, { ignoreUnsupported: true });
  if (!compiled.ok) {
    return { ok: false as const, source: "currentOpl", error: { stage: "compile", message: compiled.error.message }, normalizedOpl };
  }

  const processNames = [...compiled.value.things.values()].filter((thing) => thing.kind === "process").map((thing) => thing.name);
  const objectNames = [...compiled.value.things.values()].filter((thing) => thing.kind === "object").map((thing) => thing.name);
  const requestedName = requestedProcessId.trim().toLowerCase();
  const mainProcess = processNames.find((name) => name.toLowerCase() === requestedName) ?? processNames[0] ?? titleCaseFromSlug(requestedProcessId.replace(/^proc-/, "")) ?? "Main Process";
  const valueObject = objectNames[0] ?? "Work Item";
  const built = buildArtifactsFromSdDraft({
    ...EMPTY_SD_DRAFT,
    systemName: `${mainProcess} System`,
    mainProcess,
    beneficiary: "Operator Group",
    beneficiaryAttribute: "Operational Outcome",
    beneficiaryStateIn: "limited",
    beneficiaryStateOut: "improved",
    valueObject,
    valueStateIn: "incoming",
    valueStateOut: "processed",
    inputs: objectNames.slice(0, 2),
    outputs: objectNames.slice(0, 1).map((name) => `Processed ${name}`),
  });
  if (!built.ok) {
    return { ok: false as const, source: "currentOpl", error: { stage: "build-from-opl", message: built.error.message }, normalizedOpl };
  }

  return {
    ok: true as const,
    source: "currentOpl",
    model: built.value.model,
    normalizedOpl,
  };
}

function findProcessId(model: LoadedModel, requestedProcessId: string) {
  if (model.things.has(requestedProcessId)) return requestedProcessId;
  const byName = [...model.things.values()].find((thing) => thing.kind === "process" && thing.name.toLowerCase() === requestedProcessId.trim().toLowerCase());
  return byName?.id ?? null;
}

function buildFallbackBaseModel(processId: string) {
  const systemName = `${titleCaseFromSlug(processId.replace(/^proc-/, "")) || "Process"} System`;
  const mainProcess = titleCaseFromSlug(processId.replace(/^proc-/, "")) || "Main Process";
  const built = buildArtifactsFromSdDraft({
    ...EMPTY_SD_DRAFT,
    systemName,
    mainProcess,
    beneficiary: "Operator Group",
    beneficiaryAttribute: "Operational Outcome",
    beneficiaryStateIn: "limited",
    beneficiaryStateOut: "improved",
    valueObject: "Work Item",
    valueStateIn: "pending",
    valueStateOut: "completed",
    instruments: [systemName],
  });
  if (!built.ok) {
    return { ok: false as const, error: { stage: "fallback-build", message: built.error.message } };
  }
  return { ok: true as const, model: built.value.model };
}

async function main() {
  const raw = await readStdin();
  const request = JSON.parse(raw) as BridgeRequest;

  const snapshotModel = deriveModelFromSnapshot(request.modelSnapshot);
  const oplModel = deriveModelFromCurrentOpl(request.currentOpl, request.processId);

  let baseModelInfo:
    | { source: "modelSnapshot" | "currentOpl" | "fallback"; model: any; normalizedOpl?: string | null }
    | { source: "none"; error?: { stage: string; message: string } | null };

  if (snapshotModel.ok) {
    baseModelInfo = { source: "modelSnapshot", model: snapshotModel.model };
  } else if (oplModel.ok) {
    baseModelInfo = { source: "currentOpl", model: oplModel.model, normalizedOpl: oplModel.normalizedOpl };
  } else {
    const fallback = buildFallbackBaseModel(request.processId);
    if (!fallback.ok) {
      console.log(JSON.stringify({
        ok: false,
        proposal: {
          summary: "Refinement proposal could not be built.",
          rationale: "No valid model context was available and fallback model creation failed.",
          refinementKind: "in-zoom",
          confidence: 0.2,
          requiresHumanReview: true,
          ssotChecksExpected: ["sd-sd1-methodology-required"],
          draft: parseRequest(request.request, request.processId),
        },
        context: {
          processId: request.processId,
          baseModelSource: "none",
          modelSnapshotPresent: Boolean(request.modelSnapshot),
          currentOplPresent: Boolean(request.currentOpl?.trim()),
          snapshotError: snapshotModel.error,
          currentOplError: oplModel.error,
          fallbackError: fallback.error,
        },
      }, null, 2));
      return;
    }
    baseModelInfo = { source: "fallback", model: fallback.model };
  }

  const resolvedProcessId = findProcessId(baseModelInfo.model, request.processId) ?? request.processId;
  const draft = parseRequest(request.request, request.processId);
  const refined = refineMainProcess(baseModelInfo.model, draft, { mainProcessId: resolvedProcessId });

  if (!refined.ok) {
    console.log(JSON.stringify({
      ok: false,
      proposal: {
        summary: "Refinement proposal needs manual review before it can be built.",
        rationale: "The base model was available, but the refinement slice in core rejected the requested refinement.",
        refinementKind: "in-zoom",
        confidence: 0.45,
        requiresHumanReview: true,
        ssotChecksExpected: [
          "sd-sd1-methodology-required",
          "refined-process-must-exist",
          "subprocess-count-reviewed",
        ],
        draft,
      },
      context: {
        processId: request.processId,
        resolvedProcessId,
        baseModelSource: baseModelInfo.source,
        modelSnapshotPresent: Boolean(request.modelSnapshot),
        currentOplPresent: Boolean(request.currentOpl?.trim()),
        ...(baseModelInfo.normalizedOpl ? { normalizedOpl: baseModelInfo.normalizedOpl } : {}),
        snapshotError: snapshotModel.error,
        currentOplError: oplModel.error,
      },
      error: {
        stage: "refine-main-process",
        message: refined.error.message,
      },
    }, null, 2));
    return;
  }

  const methodology = validateRefinedModel(refined.value.model);
  const confidence = methodology.ok ? 0.9 : 0.72;
  const requiresHumanReview = !methodology.ok || baseModelInfo.source === "fallback";

  console.log(JSON.stringify({
    ok: methodology.ok,
    proposal: {
      summary: "Built in-zoom refinement proposal through the real core refinement slice.",
      rationale: [
        "Refine-process should converge to a real refinement proposal, not a placeholder.",
        `Base model source: ${baseModelInfo.source}.`,
        methodology.ok ? "Methodology checks passed for the refined model." : "Methodology checks reported issues that require review.",
      ].join(" "),
      refinementKind: "in-zoom",
      confidence,
      requiresHumanReview,
      ssotChecksExpected: [
        "sd-sd1-methodology-required",
        "process-refinement-kind-reviewed",
        "subprocess-order-and-scope-reviewed",
      ],
      draft,
      childOpdId: refined.value.childOpdId,
      mainProcessId: refined.value.mainProcessId,
    },
    context: {
      processId: request.processId,
      resolvedProcessId,
      baseModelSource: baseModelInfo.source,
      modelSnapshotPresent: Boolean(request.modelSnapshot),
      currentOplPresent: Boolean(request.currentOpl?.trim()),
      ...(baseModelInfo.normalizedOpl ? { normalizedOpl: baseModelInfo.normalizedOpl } : {}),
      snapshotError: snapshotModel.error,
      currentOplError: oplModel.error,
      methodology,
    },
    outputs: {
      canonicalOpl: renderAllFromSemanticKernel(refined.value.kernel),
      modelJson: saveModel(refined.value.model),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
