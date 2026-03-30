import { describe, expect, it } from "vitest";
import { loadModel } from "@opmodel/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildVisualReport, exportVisualReportMarkdown } from "../src/lib/visual-report";

describe("visual-report", () => {
  it("builds a model-level report for EV-AMS", () => {
    const fixture = readFileSync(resolve(process.cwd(), "tests/ev-ams.opmodel"), "utf8");
    const parsed = loadModel(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const report = buildVisualReport(parsed.value);
    expect(report.modelName).toBeTruthy();
    expect(report.opds.length).toBe(parsed.value.opds.size);
    expect(report.avgScore).toBeGreaterThan(0);
    expect(report.bestScore).toBeGreaterThanOrEqual(report.worstScore);
    expect(report.opds[0].score).toBeLessThanOrEqual(report.opds[report.opds.length - 1].score);
    expect(report.opds.some((opd) => opd.findings.length > 0)).toBe(true);
    for (const opd of report.opds) {
      expect(opd.findings.length).toBe(opd.errors + opd.warnings + opd.info);
    }
  });

  it("exports markdown with detailed findings", () => {
    const fixture = readFileSync(resolve(process.cwd(), "tests/hodom-v2.opmodel"), "utf8");
    const parsed = loadModel(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const md = exportVisualReportMarkdown(buildVisualReport(parsed.value));
    expect(md).toContain("# Visual Quality Report");
    expect(md).toContain("| OPD | Grade | Score | Errors | Warnings | Info |");
    expect(md).toContain("## Detailed Findings");
    expect(md).toContain("[WARNING]");
    expect(md).toContain("—");
    expect(md).toContain("SD");
  });
});
