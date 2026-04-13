import type { SemanticKernel } from "../semantic-kernel";
import { kernelToVisualRenderSpec } from "./kernel-to-visual-render-spec";
import type { VisualExportPrompt, VisualExportStyle } from "./visual-export-types";

function prettyKind(kind: string) {
  switch (kind) {
    case "agent": return "human enabler";
    case "instrument": return "instrument";
    case "consumption": return "input/consumption";
    case "result": return "result";
    case "effect": return "state change";
    case "invocation": return "invocation";
    case "exhibition": return "exhibition";
    default: return kind;
  }
}

export function kernelToVisualExportPrompt(
  kernel: SemanticKernel,
  options?: { style?: VisualExportStyle; opdId?: string },
): VisualExportPrompt {
  const style = options?.style ?? "dark-terminal";
  const opdId = options?.opdId ?? "opd-sd";
  const spec = kernelToVisualRenderSpec(kernel, { style, opdId });

  const mainProcess = spec.nodes.find((node) => node.visualRole === "main-process")
    ?? spec.nodes.find((node) => node.opmKind === "process");
  const beneficiary = spec.nodes.find((node) => node.visualRole === "beneficiary" || node.affiliation === "environmental");
  const valueObject = spec.nodes.find((node) => node.visualRole === "value-object" || node.visualRole === "system");

  const prompt = [
    `Generate a technical diagram in ${style} style for the OPM model \"${spec.title}\".`,
    `Use a ${spec.diagramKind} architecture layout with lanes ${spec.scene.lanes.map((lane) => lane.label).join(" -> ")}.`,
    mainProcess ? `Center the primary process \"${mainProcess.label}\" as the functional core.` : undefined,
    beneficiary ? `Show beneficiary/context on the left, including \"${beneficiary.label}\".` : undefined,
    valueObject ? `Show the main transformed system-side object \"${valueObject.label}\" on the right.` : undefined,
    "Use the following nodes and relations as the only semantic source for the diagram:",
    ...spec.nodes.map((node) => `- node ${node.id}: ${node.label} [${node.opmKind}, role=${node.visualRole}, lane=${node.laneId}]`),
    ...spec.edges.map((edge) => `- edge ${edge.source} -> ${edge.target}: ${prettyKind(edge.opmLinkKind)}${edge.label ? ` (${edge.label})` : ""}`),
    "Canonical OPL follows. Use it to preserve naming and semantics:",
    spec.canonicalOpl,
  ].filter(Boolean).join("\n");

  return {
    title: spec.title,
    diagramType: "architecture",
    style,
    intent: "Render a polished derived diagram from an already-correct OPM kernel.",
    semanticsGuardrails: spec.guardrails,
    systemSummary: {
      systemName: spec.title,
      ...(mainProcess ? { mainProcess: mainProcess.label } : { mainProcess: "" }),
      ...(beneficiary ? { beneficiary: beneficiary.label } : {}),
      ...(valueObject ? { valueObject: valueObject.label } : {}),
    },
    layout: {
      orientation: "left-to-right",
      lanes: spec.scene.lanes.map((lane) => lane.label),
    },
    nodes: spec.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      kind: node.opmKind,
      lane: node.laneId,
      emphasis: node.importance === 1 ? "primary" : "secondary",
    })),
    edges: spec.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      kind: edge.opmLinkKind,
      label: edge.label,
    })),
    opl: spec.canonicalOpl,
    prompt,
  };
}
