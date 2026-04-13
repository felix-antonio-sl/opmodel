import {
  buildArtifactsFromSdDraft,
  exposeSemanticKernel,
  renderAllFromSemanticKernel,
  saveModel,
  validateSdDraft,
} from "../../../packages/core/src/index.ts";

type WizardDraft = {
  systemType: "artificial" | "natural" | "social" | "socio-technical";
  systemName: string;
  mainProcess: string;
  beneficiary: string;
  beneficiaryAttribute: string;
  beneficiaryStateIn: string;
  beneficiaryStateOut: string;
  valueObject: string;
  valueStateIn: string;
  valueStateOut: string;
  agents: string[];
  instruments: string[];
  inputs: string[];
  outputs: string[];
  environment: string[];
  problemOccurrence: string | null;
};

type BridgeRequest = {
  kind: "wizard-generate";
  draft: WizardDraft;
};

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = await readStdin();
  const request = JSON.parse(raw) as BridgeRequest;
  const draft = request.draft;
  const validation = validateSdDraft(draft);

  const validationPayload = {
    ok: validation.ok,
    issues: validation.issues,
  };

  if (!validation.ok) {
    console.log(JSON.stringify({
      ok: false,
      draft,
      validation: validationPayload,
      error: {
        stage: "draft-validation",
        message: "SdDraft inválido para construir artefactos reales.",
        issues: validation.issues,
      },
    }, null, 2));
    return;
  }

  const built = buildArtifactsFromSdDraft(draft);
  if (!built.ok) {
    console.log(JSON.stringify({
      ok: false,
      draft,
      validation: validationPayload,
      error: {
        stage: "artifact-build",
        message: built.error.message,
        issues: built.error.issues,
      },
    }, null, 2));
    return;
  }

  const { model, kernel } = built.value;
  const atlas = exposeSemanticKernel(kernel);
  const canonicalOpl = renderAllFromSemanticKernel(kernel, atlas);

  console.log(JSON.stringify({
    ok: true,
    draft,
    validation: validationPayload,
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
      })),
    },
    outputs: {
      canonicalOpl,
      modelJson: saveModel(model),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
