import type { VisualRenderVerificationReport, VisualRenderVerificationIssue, VisualRenderSpec } from "./visual-render-spec";

export function verifyVisualRenderSpec(spec: VisualRenderSpec): VisualRenderVerificationReport {
  const issues: VisualRenderVerificationIssue[] = [];
  const nodeIds = new Set(spec.nodes.map((node) => node.id));
  const laneIds = new Set(spec.scene.lanes.map((lane) => lane.id));

  if (spec.nodes.length === 0) {
    issues.push({
      code: "VR-001",
      severity: "error",
      message: "VisualRenderSpec must contain at least one node.",
    });
  }

  if (!spec.nodes.some((node) => node.visualRole === "main-process")) {
    issues.push({
      code: "VR-002",
      severity: "error",
      message: "VisualRenderSpec must contain one primary process node.",
    });
  }

  for (const node of spec.nodes) {
    if (!laneIds.has(node.laneId)) {
      issues.push({
        code: "VR-003",
        severity: "error",
        message: `Node ${node.id} references unknown lane ${node.laneId}.`,
        refs: [node.id, node.laneId],
      });
    }
  }

  for (const edge of spec.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        code: "VR-004",
        severity: "error",
        message: `Edge ${edge.id} references missing nodes.`,
        refs: [edge.id, edge.source, edge.target],
      });
    }
    if (!edge.label || edge.label.trim().length === 0) {
      issues.push({
        code: "VR-005",
        severity: "warning",
        message: `Edge ${edge.id} should carry an explicit label for rendering fidelity.`,
        refs: [edge.id],
      });
    }
  }

  if (spec.guardrails.length < 3) {
    issues.push({
      code: "VR-006",
      severity: "warning",
      message: "VisualRenderSpec should declare enough semantic guardrails for the renderer.",
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}
