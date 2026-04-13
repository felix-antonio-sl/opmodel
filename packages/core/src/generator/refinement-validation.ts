import { verifyMethodology } from "../methodology";
import type { DraftValidationReport } from "./sd-draft-types";
import type { Model } from "../types";

export function validateRefinedModel(model: Model): DraftValidationReport {
  const checks = verifyMethodology(model).filter((check) => check.level === "SD1" || check.level === "global");

  const issues = checks
    .filter((check) => !check.passed)
    .map((check) => {
      const severity: DraftValidationReport["issues"][number]["severity"] =
        check.severity === "critical" ? "crit" : check.severity === "high" ? "alta" : check.severity === "medium" ? "media" : "baja";

      return {
        severity,
        ruleId: check.id.toUpperCase(),
        message: check.label,
        suggestedFix: check.detail,
      };
    });

  return {
    ok: !issues.some((issue) => issue.severity === "crit" || issue.severity === "alta"),
    issues,
  };
}
