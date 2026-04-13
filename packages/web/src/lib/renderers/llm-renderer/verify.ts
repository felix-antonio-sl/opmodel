import type { VisualRenderSpec } from "@opmodel/core";

export interface RenderedSvgVerificationIssue {
  code: "SVG-001" | "SVG-002" | "SVG-003" | "SVG-004" | "SVG-005";
  severity: "error" | "warning";
  message: string;
  refs?: string[];
}

export interface RenderedSvgVerificationReport {
  ok: boolean;
  issues: RenderedSvgVerificationIssue[];
}

function normalizeText(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function includesLabel(haystack: string, needle: string): boolean {
  return haystack.includes(normalizeText(needle));
}

export function verifyRenderedSvg(spec: VisualRenderSpec, svg: string): RenderedSvgVerificationReport {
  const issues: RenderedSvgVerificationIssue[] = [];
  const normalizedSvg = normalizeText(svg);

  if (!normalizedSvg.includes("<svg")) {
    issues.push({
      code: "SVG-001",
      severity: "error",
      message: "Rendered output is not an SVG document.",
    });
  }

  if (!includesLabel(normalizedSvg, spec.title)) {
    issues.push({
      code: "SVG-002",
      severity: "warning",
      message: "Rendered SVG does not visibly include the diagram title.",
      refs: [spec.title],
    });
  }

  for (const node of spec.nodes) {
    if (!includesLabel(normalizedSvg, node.label)) {
      issues.push({
        code: "SVG-003",
        severity: node.importance === 1 ? "error" : "warning",
        message: `Rendered SVG is missing node label \"${node.label}\".`,
        refs: [node.id, node.label],
      });
    }
  }

  for (const edge of spec.edges) {
    const expected = edge.label?.trim() || edge.opmLinkKind;
    if (!includesLabel(normalizedSvg, expected)) {
      issues.push({
        code: "SVG-004",
        severity: edge.routingPriority === "primary" ? "warning" : "warning",
        message: `Rendered SVG is missing edge label \"${expected}\".`,
        refs: [edge.id, expected],
      });
    }
  }

  const mainProcess = spec.nodes.find((node) => node.visualRole === "main-process");
  if (mainProcess && !includesLabel(normalizedSvg, mainProcess.label)) {
    issues.push({
      code: "SVG-005",
      severity: "error",
      message: "Rendered SVG does not include the primary process label.",
      refs: [mainProcess.id, mainProcess.label],
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}
