import { dia, shapes } from "@joint/core";

export interface PaperSetupOptions {
  el: HTMLElement;
  graph: dia.Graph;
  width?: number | string;
  height?: number | string;
  gridSize?: number;
  background?: string;
  interactive?: boolean;
}

export function createPaper(options: PaperSetupOptions): dia.Paper {
  const paper = new dia.Paper({
    el: options.el,
    model: options.graph,
    width: options.width ?? "100%",
    height: options.height ?? "100%",
    gridSize: options.gridSize ?? 10,
    background: { color: options.background ?? "#f8fafc" },
    cellViewNamespace: shapes,
    async: false,
    interactive: options.interactive ?? false,
  });
  return paper;
}
