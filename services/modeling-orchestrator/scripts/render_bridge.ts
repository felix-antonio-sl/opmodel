import {
  kernelToVisualRenderSpec,
  loadModel,
  semanticKernelFromModel,
  verifyVisualRenderSpec,
} from "../../../packages/core/src/index.ts";

type BridgeRequest = {
  kind: "render";
  modelSnapshot?: Record<string, unknown> | null;
  visualSpec?: Record<string, unknown> | null;
  opdId?: string | null;
  style?: string | null;
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

  if (request.modelSnapshot) {
    const loaded = loadModel(JSON.stringify(request.modelSnapshot));
    if (!loaded.ok) {
      console.log(JSON.stringify({
        ok: false,
        proposal: {
          summary: "Render proposal needs review before a visual spec can be generated.",
          rationale: "The provided model snapshot could not be loaded by the core serializer.",
          confidence: 0.2,
          requiresHumanReview: true,
          ssotChecksExpected: ["model-snapshot-loadable", "visual-render-spec-verifiable"],
        },
        error: {
          stage: loaded.error.phase,
          message: loaded.error.message,
        },
      }, null, 2));
      return;
    }

    const kernel = semanticKernelFromModel(loaded.value);
    const visualSpec = kernelToVisualRenderSpec(kernel, {
      opdId: request.opdId ?? undefined,
      style: (request.style as any) ?? undefined,
    });
    const verification = verifyVisualRenderSpec(visualSpec);

    console.log(JSON.stringify({
      ok: verification.ok,
      proposal: {
        summary: verification.ok
          ? "Generated VisualRenderSpec from model snapshot through the real core renderer."
          : "Generated VisualRenderSpec but it needs review before renderer handoff.",
        rationale: "Render should converge to a real VisualRenderSpec derived from the core kernel, not a placeholder render intent.",
        confidence: verification.ok ? 0.93 : 0.68,
        requiresHumanReview: !verification.ok,
        ssotChecksExpected: [
          "model-snapshot-loadable",
          "visual-render-spec-verifiable",
          "canonical-opl-preserved",
        ],
      },
      context: {
        source: "modelSnapshot",
        nodeCount: visualSpec.nodes.length,
        edgeCount: visualSpec.edges.length,
        diagramKind: visualSpec.diagramKind,
        verification,
      },
      outputs: {
        visualSpec,
        canonicalOpl: visualSpec.canonicalOpl,
      },
    }, null, 2));
    return;
  }

  if (request.visualSpec) {
    const verification = verifyVisualRenderSpec(request.visualSpec as any);
    console.log(JSON.stringify({
      ok: verification.ok,
      proposal: {
        summary: verification.ok
          ? "Provided VisualRenderSpec passed core verification."
          : "Provided VisualRenderSpec needs review before renderer handoff.",
        rationale: "When a visual spec is already present, the orchestrator should validate it through the core verifier instead of returning a placeholder intent.",
        confidence: verification.ok ? 0.9 : 0.55,
        requiresHumanReview: !verification.ok,
        ssotChecksExpected: ["visual-render-spec-verifiable"],
      },
      context: {
        source: "visualSpec",
        verification,
      },
      outputs: {
        visualSpec: request.visualSpec,
        canonicalOpl: (request.visualSpec as any).canonicalOpl ?? null,
      },
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    ok: false,
    proposal: {
      summary: "Render proposal needs review because no renderable input was provided.",
      rationale: "Render requires either a loadable model snapshot or a VisualRenderSpec to verify.",
      confidence: 0.1,
      requiresHumanReview: true,
      ssotChecksExpected: ["render-input-present"],
    },
    context: {
      source: "none",
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
