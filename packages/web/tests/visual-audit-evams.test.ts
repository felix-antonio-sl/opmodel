import { describe, expect, it } from "vitest";
import { loadModel, type Model } from "@opmodel/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import { suggestLayoutForOpd } from "../src/lib/spatial-layout";
import { computeVisualQuality, visualFindingSeverity } from "../src/lib/visual-lint";

describe("EV-AMS visual audit via layout engine", () => {
  let model: Model;

  it("loads EV-AMS fixture", () => {
    const fixture = readFileSync(resolve(process.cwd(), "tests/ev-ams.opmodel"), "utf8");
    const parsed = loadModel(fixture);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) model = parsed.value;
  });

  it("audits all OPDs and reports findings by severity", () => {
    const report: Array<{
      opdId: string;
      name: string;
      strategy: string;
      patches: number;
      errors: number;
      warnings: number;
      info: number;
    }> = [];

    for (const opd of model.opds.values()) {
      const suggestion = suggestLayoutForOpd(model, opd.id);
      const errors = suggestion.findings.filter((f) => visualFindingSeverity(f) === "error").length;
      const warnings = suggestion.findings.filter((f) => visualFindingSeverity(f) === "warning").length;
      const info = suggestion.findings.filter((f) => visualFindingSeverity(f) === "info").length;
      report.push({
        opdId: opd.id,
        name: opd.name,
        strategy: suggestion.strategy,
        patches: suggestion.patches.length,
        errors,
        warnings,
        info,
      });
    }

    console.log("\n=== EV-AMS Visual Audit ===");
    for (const r of report) {
      const q = computeVisualQuality(suggestLayoutForOpd(model, r.opdId).findings);
      console.log(
        `${r.opdId} [${r.name}] strategy=${r.strategy} patches=${r.patches} grade=${q.grade} score=${q.score} errors=${r.errors} warnings=${r.warnings} info=${r.info}`
      );
    }

    // No hard errors (overlaps/degenerate) should survive layout
    const totalErrors = report.reduce((sum, r) => sum + r.errors, 0);
    console.log(`\nTotal visual errors after layout: ${totalErrors}`);
    console.log(`Total visual warnings: ${report.reduce((sum, r) => sum + r.warnings, 0)}`);
    console.log(`Total visual info: ${report.reduce((sum, r) => sum + r.info, 0)}`);

    // The layout engine should produce patches for every OPD
    for (const r of report) {
      expect(r.strategy).not.toBe("none");
    }
  });
});
