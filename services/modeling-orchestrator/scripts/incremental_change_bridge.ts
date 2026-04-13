import {
  addAppearance,
  addLink,
  addState,
  addThing,
  appearanceKey,
  compileToKernel,
  exposeSemanticKernel,
  legacyModelFromSemanticKernel,
  loadModel,
  parseOplDocuments,
  renderAllFromSemanticKernel,
  saveModel,
  semanticKernelFromModel,
  updateThing,
} from "../../../packages/core/src/index.ts";

type BridgeRequest = {
  kind: "incremental-change";
  request: string;
  currentOpl?: string | null;
  modelSnapshot?: Record<string, unknown> | null;
};

type ThingRef = {
  id?: string;
  name: string;
  kind: "object" | "process";
};

type KernelPatchOperation =
  | {
      kind: "add-enabler";
      role: "agent" | "instrument";
      processName: string;
      thingName: string;
      thingKind: "object";
      confidence: number;
    }
  | {
      kind: "add-transforming-link";
      role: "input" | "output";
      processName: string;
      thingName: string;
      linkType: "consumption" | "result";
      thingKind: "object";
      confidence: number;
    }
  | {
      kind: "add-state-transition";
      processName: string;
      objectName: string;
      fromState: string;
      toState: string;
      linkType: "effect";
      confidence: number;
    }
  | {
      kind: "rename-thing";
      fromName: string;
      toName: string;
      confidence: number;
    }
  | {
      kind: "refine-process";
      processName: string;
      refinementKind: "in-zoom";
      confidence: number;
    }
  | {
      kind: "manual-review";
      request: string;
      confidence: number;
    };

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

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slug(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function nextId(existingIds: Set<string>, prefix: string, parts: string[]) {
  const base = `${prefix}-${parts.map((part) => slug(part)).join("-")}`;
  let counter = 1;
  let candidate = `${base}-${counter}`;
  while (existingIds.has(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }
  existingIds.add(candidate);
  return candidate;
}

function parseCurrentOpl(currentOpl?: string | null) {
  if (!currentOpl?.trim()) {
    return {
      ok: false,
      normalizedOpl: null,
      things: [] as ThingRef[],
      stats: null as null | Record<string, number>,
      error: null as null | { stage: string; message: string },
    };
  }

  const normalizedOpl = normalizeOplInput(currentOpl);
  const parsed = parseOplDocuments(normalizedOpl);
  if (!parsed.ok) {
    return {
      ok: false,
      normalizedOpl,
      things: [] as ThingRef[],
      stats: null,
      error: { stage: "parse", message: parsed.error.message },
    };
  }

  const compiled = compileToKernel(parsed.value, { ignoreUnsupported: true });
  if (!compiled.ok) {
    return {
      ok: false,
      normalizedOpl,
      things: [] as ThingRef[],
      stats: null,
      error: { stage: "compile", message: compiled.error.message },
    };
  }

  const kernel = compiled.value;
  return {
    ok: true,
    normalizedOpl,
    kernel,
    things: [...kernel.things.values()].map((thing) => ({ id: thing.id, name: thing.name, kind: thing.kind })),
    stats: {
      things: kernel.things.size,
      states: kernel.states.size,
      links: kernel.links.size,
      refinements: kernel.refinements.size,
      opds: kernel.opds.size,
    },
    error: null,
  };
}

function resolveThing(name: string, kind: "object" | "process" | "any", context: ThingRef[]) {
  const exact = context.find((thing) => thing.name.toLowerCase() === name.trim().toLowerCase() && (kind === "any" || thing.kind === kind));
  if (exact) return exact;

  const escaped = escapeRegExp(name.trim());
  const loose = context.find((thing) => new RegExp(`^${escaped}$`, "i").test(thing.name) && (kind === "any" || thing.kind === kind));
  return loose ?? null;
}

function inferOperations(request: string, context: ThingRef[]) {
  const trimmed = request.trim();
  const operations: KernelPatchOperation[] = [];
  const unresolved: string[] = [];

  const addEnabler = trimmed.match(/^add\s+(agent|instrument)\s+(.+?)\s+(?:to|for)\s+(.+)$/i);
  if (addEnabler) {
    const role = addEnabler[1]!.toLowerCase() as "agent" | "instrument";
    const thingName = addEnabler[2]!.trim();
    const processName = addEnabler[3]!.trim();
    const resolvedProcess = resolveThing(processName, "process", context);
    if (!resolvedProcess && context.length > 0) unresolved.push(`process:${processName}`);
    operations.push({ kind: "add-enabler", role, processName, thingName, thingKind: "object", confidence: resolvedProcess ? 0.94 : 0.72 });
    return { operations, unresolved };
  }

  const addTransforming = trimmed.match(/^add\s+(input|output)\s+(.+?)\s+(?:to|for)\s+(.+)$/i);
  if (addTransforming) {
    const role = addTransforming[1]!.toLowerCase() as "input" | "output";
    const thingName = addTransforming[2]!.trim();
    const processName = addTransforming[3]!.trim();
    const resolvedProcess = resolveThing(processName, "process", context);
    if (!resolvedProcess && context.length > 0) unresolved.push(`process:${processName}`);
    operations.push({
      kind: "add-transforming-link",
      role,
      processName,
      thingName,
      linkType: role === "input" ? "consumption" : "result",
      thingKind: "object",
      confidence: resolvedProcess ? 0.93 : 0.71,
    });
    return { operations, unresolved };
  }

  const stateTransition = trimmed.match(/^change\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+?)\s+(?:in|during|via)\s+(.+)$/i);
  if (stateTransition) {
    const objectName = stateTransition[1]!.trim();
    const fromState = stateTransition[2]!.trim();
    const toState = stateTransition[3]!.trim();
    const processName = stateTransition[4]!.trim();
    const resolvedObject = resolveThing(objectName, "object", context);
    const resolvedProcess = resolveThing(processName, "process", context);
    if (!resolvedObject && context.length > 0) unresolved.push(`object:${objectName}`);
    if (!resolvedProcess && context.length > 0) unresolved.push(`process:${processName}`);
    operations.push({
      kind: "add-state-transition",
      processName,
      objectName,
      fromState,
      toState,
      linkType: "effect",
      confidence: resolvedObject && resolvedProcess ? 0.91 : 0.66,
    });
    return { operations, unresolved };
  }

  const renameThing = trimmed.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
  if (renameThing) {
    const fromName = renameThing[1]!.trim();
    const toName = renameThing[2]!.trim();
    const resolvedThing = resolveThing(fromName, "any", context);
    if (!resolvedThing && context.length > 0) unresolved.push(`thing:${fromName}`);
    operations.push({ kind: "rename-thing", fromName, toName, confidence: resolvedThing ? 0.88 : 0.62 });
    return { operations, unresolved };
  }

  const refineProcess = trimmed.match(/^refine\s+(.+?)(?:\s+into\b.*)?$/i);
  if (refineProcess) {
    const processName = refineProcess[1]!.trim();
    const resolvedProcess = resolveThing(processName, "process", context);
    if (!resolvedProcess && context.length > 0) unresolved.push(`process:${processName}`);
    operations.push({ kind: "refine-process", processName, refinementKind: "in-zoom", confidence: resolvedProcess ? 0.86 : 0.64 });
    return { operations, unresolved };
  }

  operations.push({ kind: "manual-review", request: trimmed, confidence: 0.35 });
  return { operations, unresolved: context.length > 0 ? ["heuristic:request-not-classified"] : [] };
}

function derivePreviewModel(request: BridgeRequest, context: ReturnType<typeof parseCurrentOpl>) {
  let snapshotError: { stage: string; message: string } | null = null;

  if (request.modelSnapshot) {
    const loaded = loadModel(JSON.stringify(request.modelSnapshot));
    if (loaded.ok) {
      return { ok: true as const, model: loaded.value, source: "modelSnapshot", error: null };
    }
    snapshotError = { stage: loaded.error.phase, message: loaded.error.message };
  }

  if (context.ok && context.kernel) {
    return {
      ok: true as const,
      model: legacyModelFromSemanticKernel(context.kernel, exposeSemanticKernel(context.kernel)),
      source: "currentOpl",
      error: snapshotError,
    };
  }

  return { ok: false as const, model: null, source: "none", error: snapshotError };
}

function ensureThing(model: any, existingIds: Set<string>, name: string, kind: "object" | "process") {
  const exact = [...model.things.values()].find((thing: any) => thing.name.toLowerCase() === name.toLowerCase() && thing.kind === kind);
  if (exact) return { ok: true as const, model, thingId: exact.id };

  const id = nextId(existingIds, kind === "process" ? "proc" : "obj", [name]);
  const addedThing = addThing(model, {
    id,
    name,
    kind,
    essence: "physical",
    affiliation: "systemic",
  } as any);
  if (!addedThing.ok) return { ok: false as const, error: addedThing.error.message };

  const sdExists = addedThing.value.opds.has("opd-sd");
  if (!sdExists) return { ok: true as const, model: addedThing.value, thingId: id };
  const appKey = appearanceKey(id, "opd-sd");
  if (addedThing.value.appearances.has(appKey)) return { ok: true as const, model: addedThing.value, thingId: id };

  const addedAppearance = addAppearance(addedThing.value, {
    thing: id,
    opd: "opd-sd",
    x: kind === "process" ? 360 : 720,
    y: kind === "process" ? 280 : 120,
    w: kind === "process" ? 220 : 160,
    h: kind === "process" ? 80 : 50,
  });
  if (!addedAppearance.ok) return { ok: false as const, error: addedAppearance.error.message };
  return { ok: true as const, model: addedAppearance.value, thingId: id };
}

function applyPreviewOperations(baseModel: any, operations: KernelPatchOperation[]) {
  let model = baseModel;
  const existingIds = new Set<string>([
    ...model.things.keys(),
    ...model.links.keys(),
    ...model.states.keys(),
  ]);
  const previewIssues: string[] = [];
  let appliedCount = 0;

  for (const op of operations) {
    if (op.kind === "manual-review" || op.kind === "refine-process") {
      previewIssues.push(`preview-not-supported:${op.kind}`);
      continue;
    }

    if (op.kind === "rename-thing") {
      const thing = [...model.things.values()].find((entry: any) => entry.name.toLowerCase() === op.fromName.toLowerCase());
      if (!thing) {
        previewIssues.push(`thing-not-found:${op.fromName}`);
        continue;
      }
      const updated = updateThing(model, thing.id, { name: op.toName });
      if (!updated.ok) {
        previewIssues.push(`rename-failed:${op.fromName}`);
        continue;
      }
      model = updated.value;
      appliedCount += 1;
      continue;
    }

    const ensuredProcess = ensureThing(model, existingIds, op.processName, "process");
    if (!ensuredProcess.ok) {
      previewIssues.push(`process-ensure-failed:${op.processName}`);
      continue;
    }
    model = ensuredProcess.model;
    const processId = ensuredProcess.thingId;

    if (op.kind === "add-enabler" || op.kind === "add-transforming-link") {
      const thingName = op.thingName;
      const ensuredObject = ensureThing(model, existingIds, thingName, "object");
      if (!ensuredObject.ok) {
        previewIssues.push(`object-ensure-failed:${thingName}`);
        continue;
      }
      model = ensuredObject.model;
      const objectId = ensuredObject.thingId;
      const link = addLink(model, {
        id: nextId(existingIds, "lnk", [op.kind, objectId, processId]),
        type: op.kind === "add-enabler" ? op.role : op.linkType,
        source: op.kind === "add-enabler" || op.role === "input" ? objectId : processId,
        target: op.kind === "add-enabler" || op.role === "input" ? processId : objectId,
      } as any);
      if (!link.ok) {
        previewIssues.push(`link-add-failed:${op.kind}`);
        continue;
      }
      model = link.value;
      appliedCount += 1;
      continue;
    }

    if (op.kind === "add-state-transition") {
      const ensuredObject = ensureThing(model, existingIds, op.objectName, "object");
      if (!ensuredObject.ok) {
        previewIssues.push(`object-ensure-failed:${op.objectName}`);
        continue;
      }
      model = ensuredObject.model;
      const objectId = ensuredObject.thingId;

      const existingStates = [...model.states.values()].filter((state: any) => state.parent === objectId);
      const fromExisting = existingStates.find((state: any) => state.name.toLowerCase() === op.fromState.toLowerCase());
      const toExisting = existingStates.find((state: any) => state.name.toLowerCase() === op.toState.toLowerCase());

      let fromStateId = fromExisting?.id;
      let toStateId = toExisting?.id;
      if (!fromStateId) {
        const added = addState(model, {
          id: nextId(existingIds, "st", [op.objectName, op.fromState]),
          parent: objectId,
          name: op.fromState,
          initial: existingStates.length === 0,
          default: existingStates.length === 0,
          final: false,
        } as any);
        if (!added.ok) {
          previewIssues.push(`from-state-add-failed:${op.objectName}`);
          continue;
        }
        model = added.value;
        fromStateId = [...model.states.values()].find((state: any) => state.parent === objectId && state.name === op.fromState)?.id;
      }
      if (!toStateId) {
        const added = addState(model, {
          id: nextId(existingIds, "st", [op.objectName, op.toState]),
          parent: objectId,
          name: op.toState,
          initial: false,
          default: false,
          final: true,
        } as any);
        if (!added.ok) {
          previewIssues.push(`to-state-add-failed:${op.objectName}`);
          continue;
        }
        model = added.value;
        toStateId = [...model.states.values()].find((state: any) => state.parent === objectId && state.name === op.toState)?.id;
      }

      const link = addLink(model, {
        id: nextId(existingIds, "lnk", ["effect", processId, objectId]),
        type: "effect",
        source: processId,
        target: objectId,
        source_state: fromStateId,
        target_state: toStateId,
      } as any);
      if (!link.ok) {
        previewIssues.push(`effect-add-failed:${op.objectName}`);
        continue;
      }
      model = link.value;
      appliedCount += 1;
    }
  }

  return { model, appliedCount, previewIssues };
}

function buildExpectedChecks(operations: KernelPatchOperation[]) {
  const checks = new Set<string>([
    "ssot-precedence-loaded",
    "agent-means-human-only",
    "every-process-must-transform-an-object",
    "opl-opd-equivalence-required",
  ]);

  for (const op of operations) {
    if (op.kind === "add-enabler" && op.role === "agent") checks.add("agent-role-must-be-human");
    if (op.kind === "add-transforming-link" || op.kind === "add-state-transition") checks.add("transforming-link-endpoints-valid");
    if (op.kind === "rename-thing") checks.add("canonical-naming-reviewed");
    if (op.kind === "refine-process") checks.add("sd-sd1-methodology-required");
  }

  return [...checks];
}

async function main() {
  const raw = await readStdin();
  const request = JSON.parse(raw) as BridgeRequest;
  const context = parseCurrentOpl(request.currentOpl);
  const { operations, unresolved } = inferOperations(request.request, context.things);
  const manualOnly = operations.length === 1 && operations[0]?.kind === "manual-review";
  const confidence = operations.length > 0
    ? Number((operations.reduce((sum, op) => sum + op.confidence, 0) / operations.length).toFixed(2))
    : 0;
  const requiresHumanReview = manualOnly || unresolved.length > 0 || confidence < 0.8;

  const previewBase = derivePreviewModel(request, context);
  const preview = previewBase.ok ? applyPreviewOperations(previewBase.model, operations) : null;
  const previewApplied = Boolean(previewBase.ok && preview && preview.appliedCount > 0);
  const previewKernel = previewApplied && preview ? semanticKernelFromModel(preview.model) : null;

  const summary = manualOnly
    ? "Incremental request needs manual review before patching."
    : `Proposed ${operations.length} kernel patch operation${operations.length === 1 ? "" : "s"} from incremental request.`;

  const rationaleParts = [
    "Incremental change requests should converge to a stable KernelPatchProposal.",
    context.ok ? "Current OPL context was parsed through the real core." : "No validated OPL context was available, so the proposal is more conservative.",
    previewApplied ? "A deterministic preview was generated from the proposal without persisting mutations." : "No deterministic preview was generated for this request.",
    requiresHumanReview ? "Human review is required before application." : "The proposal is concrete enough for downstream validation.",
  ];

  console.log(JSON.stringify({
    ok: !manualOnly,
    proposal: {
      summary,
      rationale: rationaleParts.join(" "),
      operations,
      confidence,
      ssotChecksExpected: buildExpectedChecks(operations),
      requiresHumanReview,
    },
    context: {
      currentOplPresent: Boolean(request.currentOpl?.trim()),
      modelSnapshotPresent: Boolean(request.modelSnapshot),
      currentOplParsed: context.ok,
      previewBaseSource: previewBase.source,
      previewApplied,
      ...(context.normalizedOpl ? { normalizedOpl: context.normalizedOpl } : {}),
      ...(context.stats ? { kernelStats: context.stats } : {}),
      knownThings: context.things,
      unresolvedReferences: unresolved,
      ...(preview ? { previewIssues: preview.previewIssues, appliedOperationCount: preview.appliedCount } : {}),
      ...(context.error ? { currentOplError: context.error } : {}),
      ...(previewBase.error ? { previewBaseError: previewBase.error } : {}),
    },
    outputs: previewApplied && preview && previewKernel ? {
      canonicalOpl: renderAllFromSemanticKernel(previewKernel, exposeSemanticKernel(previewKernel)),
      modelJson: saveModel(preview.model),
    } : {},
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
