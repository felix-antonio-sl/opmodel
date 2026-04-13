export type VisualRendererStyle =
  | "flat-icon"
  | "dark-terminal"
  | "blueprint"
  | "notion-clean"
  | "glassmorphism";

export type VisualDiagramKind = "opm-sd" | "opm-sd1";

export type VisualLaneRole = "context" | "function" | "system" | "refinement";

export type VisualNodeRole =
  | "beneficiary"
  | "system"
  | "main-process"
  | "value-object"
  | "agent"
  | "instrument"
  | "input"
  | "output"
  | "environment"
  | "subprocess"
  | "internal-object"
  | "external-object";

export interface VisualRenderLane {
  id: string;
  label: string;
  role: VisualLaneRole;
}

export interface VisualRenderGroup {
  id: string;
  label: string;
  kind: "cluster" | "legend" | "context-box";
}

export interface VisualRenderNode {
  id: string;
  label: string;
  opmKind: "object" | "process";
  visualRole: VisualNodeRole;
  affiliation: "systemic" | "environmental";
  laneId: string;
  groupId?: string;
  importance: 1 | 2 | 3;
}

export interface VisualRenderEdge {
  id: string;
  source: string;
  target: string;
  opmLinkKind: string;
  label?: string;
  semanticRole?: string;
  routingPriority: "primary" | "secondary";
}

export interface VisualRenderSpec {
  version: "v1";
  diagramKind: VisualDiagramKind;
  title: string;
  style: VisualRendererStyle;
  scene: {
    lanes: VisualRenderLane[];
    groups: VisualRenderGroup[];
  };
  nodes: VisualRenderNode[];
  edges: VisualRenderEdge[];
  guardrails: string[];
  canonicalOpl: string;
}

export interface VisualRenderVerificationIssue {
  code:
    | "VR-001"
    | "VR-002"
    | "VR-003"
    | "VR-004"
    | "VR-005"
    | "VR-006";
  severity: "error" | "warning";
  message: string;
  refs?: string[];
}

export interface VisualRenderVerificationReport {
  ok: boolean;
  issues: VisualRenderVerificationIssue[];
}
