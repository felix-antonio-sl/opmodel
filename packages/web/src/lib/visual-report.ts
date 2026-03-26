import type { Model } from "@opmodel/core";
import { auditVisualOpd, computeVisualQuality, visualFindingSeverity, type VisualQualityScore } from "./visual-lint";

export interface VisualOpdReport {
  opdId: string;
  name: string;
  score: number;
  grade: VisualQualityScore["grade"];
  errors: number;
  warnings: number;
  info: number;
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

export function buildVisualReport(model: Model): VisualModelReport {
  const opds: VisualOpdReport[] = [...model.opds.values()].map((opd) => {
    const appearances = [...model.appearances.values()].filter((a) => a.opd === opd.id);
    const ids = new Set(appearances.map((a) => a.thing));
    const links = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
    const findings = auditVisualOpd({ appearances, links, things: model.things.values(), states: model.states.values() });
    const quality = computeVisualQuality(findings);
    return {
      opdId: opd.id,
      name: opd.name,
      score: quality.score,
      grade: quality.grade,
      errors: findings.filter((f) => visualFindingSeverity(f) === "error").length,
      warnings: findings.filter((f) => visualFindingSeverity(f) === "warning").length,
      info: findings.filter((f) => visualFindingSeverity(f) === "info").length,
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
  ].join("\n");
}
