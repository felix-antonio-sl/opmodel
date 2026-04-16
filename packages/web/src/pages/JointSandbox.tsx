import { useMemo, useState } from "react";
import {
  loadModel,
  isOk,
  semanticKernelFromModel,
  kernelToVisualRenderSpec,
  verifyVisualRenderSpec,
  type VisualRenderSpec,
} from "@opmodel/core";
import coffeeMakingJson from "../../../../tests/coffee-making.opmodel?raw";
import { JointDiagramPreview } from "../components/JointDiagramPreview";

export function JointSandbox() {
  const [error, setError] = useState<string | null>(null);

  const spec = useMemo<VisualRenderSpec | null>(() => {
    const result = loadModel(coffeeMakingJson);
    if (!isOk(result)) {
      setError(result.error.message);
      return null;
    }
    const kernel = semanticKernelFromModel(result.value);
    return kernelToVisualRenderSpec(kernel, { opdId: "opd-sd" });
  }, []);

  const verification = useMemo(() => (spec ? verifyVisualRenderSpec(spec) : null), [spec]);

  if (error) {
    return <div style={{ padding: 20, color: "#b91c1c", fontFamily: "monospace" }}>Error loading fixture: {error}</div>;
  }

  if (!spec) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div style={{ padding: 20, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>JointJS Sandbox — {spec.title}</h1>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
        Fase 6.1 bootstrap · {spec.nodes.length} nodes · {spec.edges.length} edges ·{" "}
        <span style={{ color: verification?.ok ? "#047857" : "#b91c1c" }}>
          verifier: {verification?.ok ? "ok" : `fail (${verification?.issues.length ?? 0} issues)`}
        </span>
      </div>
      <JointDiagramPreview spec={spec} height={640} />
      {verification && verification.issues.length > 0 && (
        <details style={{ marginTop: 12, fontSize: 12 }}>
          <summary>Verifier issues ({verification.issues.length})</summary>
          <ul>
            {verification.issues.map((issue, i) => (
              <li key={i}>
                [{issue.code}/{issue.severity}] {issue.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
