export interface DiagramSpecNode {
  id: string;
  label: string;
  kind: "object" | "process" | "state" | "system" | "external";
  lane?: "left" | "center" | "right";
  emphasis?: "primary" | "secondary";
}

export interface DiagramSpecEdge {
  id: string;
  source: string;
  target: string;
  kind: string;
  label?: string;
}

export interface DiagramSpecGroup {
  id: string;
  label: string;
}

export interface DiagramSpec {
  diagramId: string;
  title: string;
  nodes: DiagramSpecNode[];
  edges: DiagramSpecEdge[];
  groups: DiagramSpecGroup[];
  layoutHints?: Record<string, unknown>;
}
