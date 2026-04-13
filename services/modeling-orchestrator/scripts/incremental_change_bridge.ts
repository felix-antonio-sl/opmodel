import { compileToKernel, parseOplDocuments } from "../../../packages/core/src/index.ts";

type BridgeRequest = {
  kind: "incremental-change";
  request: string;
  currentOpl?: string | null;
  modelSnapshot?: Record<string, unknown> | null;
};

type ThingRef = {
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
    things: [...kernel.things.values()].map((thing) => ({ name: thing.name, kind: thing.kind })),
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

  const summary = manualOnly
    ? "Incremental request needs manual review before patching."
    : `Proposed ${operations.length} kernel patch operation${operations.length === 1 ? "" : "s"} from incremental request.`;

  const rationaleParts = [
    "Incremental change requests should converge to a stable KernelPatchProposal.",
    context.ok ? "Current OPL context was parsed through the real core." : "No validated OPL context was available, so the proposal is more conservative.",
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
      ...(context.normalizedOpl ? { normalizedOpl: context.normalizedOpl } : {}),
      ...(context.stats ? { kernelStats: context.stats } : {}),
      knownThings: context.things,
      unresolvedReferences: unresolved,
      ...(context.error ? { currentOplError: context.error } : {}),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
