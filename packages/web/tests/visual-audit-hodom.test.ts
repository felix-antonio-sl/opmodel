import { describe, expect, it } from "vitest";
import { loadModel, type Model } from "@opmodel/core";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { suggestLayoutForOpd } from "../src/lib/spatial-layout";
import { computeVisualQuality, visualFindingSeverity } from "../src/lib/visual-lint";

function auditFixture(name: string, path: string) {
  describe(`${name} visual audit via layout engine`, () => {
    let model: Model;

    it(`loads ${name} fixture`, () => {
      const fullPath = resolve(process.cwd(), path);
      expect(existsSync(fullPath)).toBe(true);
      const fixture = readFileSync(fullPath, "utf8");
      const parsed = loadModel(fixture);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) model = parsed.value;
    });

    it("audits all OPDs and reports findings by severity", () => {
      console.log(`\n=== ${name} Visual Audit ===`);
      let totalErrors = 0;
      let totalWarnings = 0;
      let totalInfo = 0;

      for (const opd of model.opds.values()) {
        const suggestion = suggestLayoutForOpd(model, opd.id);
        const errors = suggestion.findings.filter((f) => visualFindingSeverity(f) === "error").length;
        const warnings = suggestion.findings.filter((f) => visualFindingSeverity(f) === "warning").length;
        const info = suggestion.findings.filter((f) => visualFindingSeverity(f) === "info").length;
        totalErrors += errors;
        totalWarnings += warnings;
        totalInfo += info;
        const q = computeVisualQuality(suggestion.findings);
        console.log(
          `${opd.id} [${opd.name}] strategy=${suggestion.strategy} patches=${suggestion.patches.length} grade=${q.grade} score=${q.score} errors=${errors} warnings=${warnings} info=${info}`
        );
      }

      console.log(`\nTotal visual errors after layout: ${totalErrors}`);
      console.log(`Total visual warnings: ${totalWarnings}`);
      console.log(`Total visual info: ${totalInfo}`);

      for (const opd of model.opds.values()) {
        const suggestion = suggestLayoutForOpd(model, opd.id);
        expect(suggestion.strategy).not.toBe("none");
      }
    });
  });
}

auditFixture("HODOM", "tests/hospitalizacion-domiciliaria.opmodel");
auditFixture("HODOM V2", "tests/hodom-v2.opmodel");
auditFixture("HODOM HSC v0", "tests/hodom-hsc-v0.opmodel");
