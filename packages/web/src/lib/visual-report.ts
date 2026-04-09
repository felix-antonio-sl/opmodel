import type { Model } from "@opmodel/core";
import {
  auditVisualOpd,
  computeVisualQuality,
  visualFindingSeverity,
  type VisualFinding,
  type VisualQualityScore,
  type VisualSeverity,
} from "./visual-lint";
import { buildPatchableOpdProjectionSlice } from "./projection-view";
import { estimatedStateTextCapacity } from "./visual-rules";

export interface VisualFindingReportItem {
  severity: VisualSeverity;
  kind: VisualFinding["kind"];
  summary: string;
  primaryEntity: string | null;
}

export interface VisualOpdReport {
  opdId: string;
  name: string;
  score: number;
  grade: VisualQualityScore["grade"];
  errors: number;
  warnings: number;
  info: number;
  findings: VisualFindingReportItem[];
}

export interface VisualModelReport {
  modelName: string;
  avgScore: number;
  bestScore: number;
  worstScore: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  opds: VisualOpdReport[];
}

function thingLabel(model: Model, thingId: string): string {
  const thing = model.things.get(thingId);
  return thing ? `${thing.name} (${thing.id})` : thingId;
}

function stateLabel(model: Model, stateId: string): string {
  const state = model.states.get(stateId);
  return state ? `${state.name} (${state.id})` : stateId;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function primaryEntityForFinding(finding: VisualFinding): string | null {
  switch (finding.kind) {
    case "overlap":
      return finding.aThing;
    case "orphan":
      return finding.thing;
    case "truncated-state":
      return finding.thing;
    case "degenerate-bounds":
      return null;
    case "crowded-diagram":
      return null;
    case "tight-spacing":
      return finding.aThing;
    case "link-crossing":
      return finding.aLink;
    case "label-cluster":
      return finding.linkIds[0] ?? null;
  }
}

function summarizeFinding(model: Model, finding: VisualFinding): string {
  switch (finding.kind) {
    case "overlap":
      return `Overlap between ${thingLabel(model, finding.aThing)} and ${thingLabel(model, finding.bThing)} (area ${Math.round(finding.area)}px²).`;
    case "orphan":
      return `Visible orphan ${thingLabel(model, finding.thing)} has no visible links in this OPD.`;
    case "truncated-state":
      return `State ${stateLabel(model, finding.state)} on ${thingLabel(model, finding.thing)} exceeds estimated pill capacity (${finding.capacity} chars).`;
    case "degenerate-bounds":
      return `Diagram bounds look degenerate (${Math.round(finding.width)}×${Math.round(finding.height)}px, aspect ratio ${finding.aspectRatio.toFixed(2)}).`;
    case "crowded-diagram":
      return `Crowded diagram with ${finding.nodeCount} visible nodes and fill ratio ${formatPercent(finding.fillRatio)} inside ${Math.round(finding.width)}×${Math.round(finding.height)}px bounds.`;
    case "tight-spacing":
      return `Tight spacing between ${thingLabel(model, finding.aThing)} and ${thingLabel(model, finding.bThing)}: ${finding.gap}px on ${finding.axis.toUpperCase()} axis.`;
    case "link-crossing":
      return `Visible link crossing between ${finding.aLink} and ${finding.bLink}.`;
    case "label-cluster":
      return `Cluster of ${finding.clusterSize} link labels competing for the same visual area (${finding.linkIds.join(", ")}).`;
  }
}

function projectedTruncatedStateFindings(model: Model, opdId: string): VisualFinding[] {
  const slice = buildPatchableOpdProjectionSlice(model, opdId);
  const findings: VisualFinding[] = [];
  for (const entry of slice.visualGraph.thingsById.values()) {
    if (entry.statePills.length === 0) continue;
    const capacity = estimatedStateTextCapacity(entry.statePills[0]!.w);
    for (const pill of entry.statePills) {
      if (pill.state.name.length > capacity) {
        findings.push({ kind: "truncated-state", thing: entry.thingId, state: pill.state.id, capacity });
      }
    }
  }
  return findings;
}

export function buildVisualReport(model: Model): VisualModelReport {
  const opds: VisualOpdReport[] = [...model.opds.values()].map((opd) => {
    const slice = buildPatchableOpdProjectionSlice(model, opd.id);
    const baseFindings = auditVisualOpd({ appearances: slice.appearances, links: slice.links, things: model.things.values(), states: model.states.values() });
    const findings = [
      ...baseFindings.filter((finding) => finding.kind !== "truncated-state"),
      ...projectedTruncatedStateFindings(model, opd.id),
    ];
    const quality = computeVisualQuality(findings);
    return {
      opdId: opd.id,
      name: opd.name,
      score: quality.score,
      grade: quality.grade,
      errors: findings.filter((f) => visualFindingSeverity(f) === "error").length,
      warnings: findings.filter((f) => visualFindingSeverity(f) === "warning").length,
      info: findings.filter((f) => visualFindingSeverity(f) === "info").length,
      findings: findings.map((finding) => ({
        severity: visualFindingSeverity(finding),
        kind: finding.kind,
        summary: summarizeFinding(model, finding),
        primaryEntity: primaryEntityForFinding(finding),
      })),
    };
  }).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));

  const scores = opds.map((o) => o.score);
  return {
    modelName: model.meta.name,
    avgScore: opds.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / opds.length) : 100,
    bestScore: opds.length ? Math.max(...scores) : 100,
    worstScore: opds.length ? Math.min(...scores) : 100,
    totalErrors: opds.reduce((sum, o) => sum + o.errors, 0),
    totalWarnings: opds.reduce((sum, o) => sum + o.warnings, 0),
    totalInfo: opds.reduce((sum, o) => sum + o.info, 0),
    opds,
  };
}

export function exportVisualReportMarkdown(report: VisualModelReport): string {
  return [
    `# Visual Quality Report — ${report.modelName}`,
    "",
    `- Average score: **${report.avgScore}**`,
    `- Best score: **${report.bestScore}**`,
    `- Worst score: **${report.worstScore}**`,
    `- Total errors: **${report.totalErrors}**`,
    `- Total warnings: **${report.totalWarnings}**`,
    `- Total info: **${report.totalInfo}**`,
    "",
    "| OPD | Grade | Score | Errors | Warnings | Info |",
    "|---|---:|---:|---:|---:|---:|",
    ...report.opds.map((opd) => `| ${opd.name} | ${opd.grade} | ${opd.score} | ${opd.errors} | ${opd.warnings} | ${opd.info} |`),
    "",
    "## Detailed Findings",
    "",
    ...report.opds.flatMap((opd) => [
      `### ${opd.name}`,
      "",
      `- Grade: **${opd.grade}**`,
      `- Score: **${opd.score}**`,
      `- Errors: **${opd.errors}**`,
      `- Warnings: **${opd.warnings}**`,
      `- Info: **${opd.info}**`,
      "",
      ...(opd.findings.length > 0
        ? opd.findings.map((finding, index) => `${index + 1}. [${finding.severity.toUpperCase()}] ${finding.kind} — ${finding.summary}`)
        : ["No findings."]),
      "",
    ]),
  ].join("\n");
}
