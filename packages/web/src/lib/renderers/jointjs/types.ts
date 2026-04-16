import { dia } from "@joint/core";

export interface JointGraphBuildResult {
  graph: dia.Graph;
  nodeIdToCell: Map<string, dia.Cell>;
  edgeIdToLink: Map<string, dia.Link>;
}

export interface NodeLayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
  marginX: number;
  marginY: number;
  columns: number;
}

export const DEFAULT_LAYOUT: NodeLayoutOptions = {
  nodeWidth: 140,
  nodeHeight: 60,
  gapX: 60,
  gapY: 60,
  marginX: 40,
  marginY: 40,
  columns: 4,
};
