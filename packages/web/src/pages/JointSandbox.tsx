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
import driverRescuingJson from "../../../../tests/driver-rescuing.opmodel?raw";
import hospDomJson from "../../../../tests/hospitalizacion-domiciliaria.opmodel?raw";
import hodomV2Json from "../../../../tests/hodom-v2.opmodel?raw";
import evAmsJson from "../../../../tests/ev-ams.opmodel?raw";
import hodomHscV0Json from "../../../../tests/hodom-hsc-v0.opmodel?raw";
import { JointDiagramPreview } from "../components/JointDiagramPreview";

const FIXTURES: Array<{ id: string; name: string; raw: string }> = [
  { id: "coffee-making", name: "coffee-making", raw: coffeeMakingJson },
  { id: "driver-rescuing", name: "driver-rescuing", raw: driverRescuingJson },
  { id: "hospitalizacion-domiciliaria", name: "hospitalizacion-domiciliaria", raw: hospDomJson },
  { id: "hodom-v2", name: "hodom-v2", raw: hodomV2Json },
  { id: "ev-ams", name: "ev-ams", raw: evAmsJson },
  { id: "hodom-hsc-v0", name: "hodom-hsc-v0", raw: hodomHscV0Json },
];

export function JointSandbox() {
  const [fixtureId, setFixtureId] = useState<string>("coffee-making");
  const [opdId, setOpdId] = useState<string>("opd-sd1");

  const fixture = FIXTURES.find((f) => f.id === fixtureId) ?? FIXTURES[0]!;

  const { error, model } = useMemo(() => {
    const result = loadModel(fixture.raw);
    if (!isOk(result)) return { error: result.error.message, model: null };
    return { error: null, model: result.value };
  }, [fixture]);

  const opdIds = useMemo<string[]>(() => {
    if (!model) return [];
    const opds = (model as any).opds;
    if (opds instanceof Map) return Array.from(opds.keys());
    if (Array.isArray(opds)) return opds.map((o: any) => o.id);
    return [];
  }, [model]);

  const activeOpdId = opdIds.includes(opdId) ? opdId : (opdIds[0] ?? "opd-sd");

  const spec = useMemo<VisualRenderSpec | null>(() => {
    if (!model) return null;
    const kernel = semanticKernelFromModel(model);
    return kernelToVisualRenderSpec(kernel, { opdId: activeOpdId });
  }, [model, activeOpdId]);

  const verification = useMemo(() => (spec ? verifyVisualRenderSpec(spec) : null), [spec]);

  if (error) {
    return <div style={{ padding: 20, color: "#b91c1c", fontFamily: "monospace" }}>Error loading fixture: {error}</div>;
  }

  if (!spec) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div style={{ padding: 20, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>JointJS Sandbox — Fase 1</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12 }}>
          Fixture:{" "}
          <select value={fixtureId} onChange={(e) => setFixtureId(e.target.value)} style={{ padding: 4 }}>
            {FIXTURES.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>
          OPD:{" "}
          <select value={activeOpdId} onChange={(e) => setOpdId(e.target.value)} style={{ padding: 4 }}>
            {opdIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
        <strong>{spec.title}</strong> · {spec.nodes.length} nodes · {spec.edges.length} edges ·{" "}
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

      <details style={{ marginTop: 12, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
        <summary>Spec JSON</summary>
        <pre style={{ background: "#f1f5f9", padding: 12, overflow: "auto", maxHeight: 400 }}>
          {JSON.stringify(spec, null, 2)}
        </pre>
      </details>
    </div>
  );
}
