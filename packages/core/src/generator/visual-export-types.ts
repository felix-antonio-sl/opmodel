export type VisualExportStyle = "flat-icon" | "dark-terminal" | "blueprint" | "notion-clean" | "glassmorphism";

export interface VisualExportPrompt {
  title: string;
  diagramType: "architecture" | "flowchart";
  style: VisualExportStyle;
  intent: string;
  semanticsGuardrails: string[];
  systemSummary: {
    systemName: string;
    mainProcess: string;
    beneficiary?: string;
    valueObject?: string;
  };
  layout: {
    orientation: "left-to-right";
    lanes: string[];
  };
  nodes: Array<{
    id: string;
    label: string;
    kind: string;
    lane?: string;
    emphasis?: "primary" | "secondary";
  }>;
  edges: Array<{
    source: string;
    target: string;
    kind: string;
    label?: string;
  }>;
  opl: string;
  prompt: string;
}
