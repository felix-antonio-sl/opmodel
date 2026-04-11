import type { SemanticKernel } from "../semantic-kernel";
import { kernelToDiagramSpec } from "./kernel-to-diagram-spec";
import { kernelToOpl } from "./kernel-to-opl";
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
  const diagram = kernelToDiagramSpec(kernel, opdId);
  const opl = kernelToOpl(kernel);

  const mainProcess = diagram.nodes.find((node) => node.kind === "process" && node.emphasis === "primary")
    ?? diagram.nodes.find((node) => node.kind === "process");
  const beneficiary = diagram.nodes.find((node) => node.kind === "external");
  const valueObject = diagram.nodes.find((node) => node.kind === "object" || node.kind === "system");

  const guardrails = [
    "Do not invent OPM semantics absent from the provided OPL and node/edge set.",
    "Treat OPL as canonical semantics and the diagram as a derived visualization.",
    "Prefer a left-to-right architecture view with three lanes: Context, Function, System.",
    "Preserve process vs object distinction visually.",
    "Label edges using the provided OPM relation names, not generic arrows.",
  ];

  const prompt = [
    `Generate a technical diagram in ${style} style for the OPM model \"${kernel.meta.name}\".`,
    "Use an architecture-diagram layout with lanes Context -> Function -> System.",
    mainProcess ? `Center the primary process \"${mainProcess.label}\" as the functional core.` : undefined,
    beneficiary ? `Show beneficiary/context on the left, including \"${beneficiary.label}\".` : undefined,
    valueObject ? `Show the main transformed system-side object \"${valueObject.label}\" on the right.` : undefined,
    "Use the following nodes and relations as the only semantic source for the diagram:",
    ...diagram.nodes.map((node) => `- node ${node.id}: ${node.label} [${node.kind}${node.lane ? `, lane=${node.lane}` : ""}]`),
    ...diagram.edges.map((edge) => `- edge ${edge.source} -> ${edge.target}: ${prettyKind(edge.kind)}${edge.label ? ` (${edge.label})` : ""}`),
    "Canonical OPL follows. Use it to preserve naming and semantics:",
    opl,
  ].filter(Boolean).join("\n");

  return {
    title: kernel.meta.name,
    diagramType: "architecture",
    style,
    intent: "Render a polished derived diagram from an already-correct OPM kernel.",
    semanticsGuardrails: guardrails,
    systemSummary: {
      systemName: kernel.meta.name,
      ...(mainProcess ? { mainProcess: mainProcess.label } : { mainProcess: "" }),
      ...(beneficiary ? { beneficiary: beneficiary.label } : {}),
      ...(valueObject ? { valueObject: valueObject.label } : {}),
    },
    layout: {
      orientation: "left-to-right",
      lanes: ["Context", "Function", "System"],
    },
    nodes: diagram.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      kind: node.kind,
      lane: node.lane,
      emphasis: node.emphasis,
    })),
    edges: diagram.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      label: edge.label,
    })),
    opl,
    prompt,
  };
}
