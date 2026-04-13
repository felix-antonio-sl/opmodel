import {
  compileToKernel,
  exposeSemanticKernel,
  legacyModelFromSemanticKernel,
  parseOplDocuments,
  renderAllFromSemanticKernel,
  saveModel,
  validateOpl,
} from "../../../packages/core/src/index.ts";

type BridgeRequest = {
  kind: "opl-import";
  oplText: string;
  language?: "en" | "es" | "mixed";
};

function normalizeOplInput(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /^===\s+.+\s+===/m.test(trimmed) ? trimmed : `=== SD ===\n${trimmed}`;
}

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function issueView(issue: Record<string, unknown>) {
  return {
    phase: issue.phase,
    severity: issue.severity,
    message: issue.message,
    ...(issue.line != null ? { line: issue.line } : {}),
    ...(issue.column != null ? { column: issue.column } : {}),
    ...(issue.endLine != null ? { endLine: issue.endLine } : {}),
    ...(issue.endColumn != null ? { endColumn: issue.endColumn } : {}),
    ...(issue.sentenceKind ? { sentenceKind: issue.sentenceKind } : {}),
    ...(issue.opdName ? { opdName: issue.opdName } : {}),
    ...(issue.code ? { code: issue.code } : {}),
    ...(issue.entity ? { entity: issue.entity } : {}),
    ...(issue.focusThingName ? { focusThingName: issue.focusThingName } : {}),
  };
}

async function main() {
  const raw = await readStdin();
  const request = JSON.parse(raw) as BridgeRequest;
  const normalizedOpl = normalizeOplInput(request.oplText);
  const validation = validateOpl(normalizedOpl);
  const parsed = parseOplDocuments(normalizedOpl);

  if (!parsed.ok) {
    console.log(JSON.stringify({
      ok: false,
      normalizedOpl,
      validation: {
        ok: validation.ok,
        phases: validation.phases,
        issues: validation.issues.map((issue) => issueView(issue as unknown as Record<string, unknown>)),
      },
      error: {
        stage: "parse",
        message: parsed.error.message,
        issues: parsed.error.issues,
      },
    }, null, 2));
    return;
  }

  const compiled = compileToKernel(parsed.value, { ignoreUnsupported: true });
  if (!compiled.ok) {
    console.log(JSON.stringify({
      ok: false,
      normalizedOpl,
      validation: {
        ok: validation.ok,
        phases: validation.phases,
        issues: validation.issues.map((issue) => issueView(issue as unknown as Record<string, unknown>)),
      },
      parse: {
        documentCount: parsed.value.length,
        opds: parsed.value.map((doc) => ({
          opdId: doc.opdId,
          opdName: doc.opdName,
          sentenceCount: doc.sentences.length,
        })),
      },
      error: {
        stage: "compile",
        message: compiled.error.message,
        issues: compiled.error.issues,
      },
    }, null, 2));
    return;
  }

  const kernel = compiled.value;
  const atlas = exposeSemanticKernel(kernel);
  const legacyModel = legacyModelFromSemanticKernel(kernel, atlas);
  const canonicalOpl = renderAllFromSemanticKernel(kernel, atlas);

  console.log(JSON.stringify({
    ok: validation.ok,
    normalizedOpl,
    validation: {
      ok: validation.ok,
      phases: validation.phases,
      issues: validation.issues.map((issue) => issueView(issue as unknown as Record<string, unknown>)),
    },
    parse: {
      documentCount: parsed.value.length,
      opds: parsed.value.map((doc) => ({
        opdId: doc.opdId,
        opdName: doc.opdName,
        sentenceCount: doc.sentences.length,
      })),
    },
    kernel: {
      meta: {
        name: kernel.meta.name,
        ...(kernel.meta.system_type ? { system_type: kernel.meta.system_type } : {}),
      },
      stats: {
        things: kernel.things.size,
        states: kernel.states.size,
        links: kernel.links.size,
        refinements: kernel.refinements.size,
        opds: kernel.opds.size,
        modifiers: kernel.modifiers.size,
        fans: kernel.fans.size,
        scenarios: kernel.scenarios.size,
        assertions: kernel.assertions.size,
        requirements: kernel.requirements.size,
      },
      things: [...kernel.things.values()].map((thing) => ({
        id: thing.id,
        name: thing.name,
        kind: thing.kind,
        essence: thing.essence,
        affiliation: thing.affiliation,
      })),
      links: [...kernel.links.values()].map((link) => ({
        id: link.id,
        type: link.type,
        source: link.source,
        target: link.target,
        ...(link.source_state ? { source_state: link.source_state } : {}),
        ...(link.target_state ? { target_state: link.target_state } : {}),
        ...(link.origin ? { origin: link.origin } : {}),
      })),
      opds: [...kernel.opds.values()].map((opd) => ({
        id: opd.id,
        name: opd.name,
        parent_opd: opd.parent_opd ?? null,
        refines: opd.refines ?? null,
        refinement_type: opd.refinement_type ?? null,
      })),
    },
    outputs: {
      canonicalOpl,
      legacyModelJson: saveModel(legacyModel),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
