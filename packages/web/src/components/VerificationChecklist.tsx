import type { Model } from "@opmodel/core";
import { verifyMethodology, type CheckResult } from "@opmodel/core";

interface Props {
  model: Model;
  onClose: () => void;
}

const SEVERITY_ICON: Record<string, string> = { critical: "🔴", high: "🟡", medium: "🔵" };
const LEVEL_LABEL: Record<string, string> = { SD: "System Diagram", SD1: "Refinement", global: "Global" };

export function VerificationChecklist({ model, onClose }: Props) {
  const results = verifyMethodology(model);
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;

  const groups: Record<string, CheckResult[]> = {};
  for (const r of results) {
    (groups[r.level] ??= []).push(r);
  }

  return (
    <div className="verification-overlay" onClick={onClose}>
      <div className="verification-panel" onClick={(e) => e.stopPropagation()}>
        <div className="verification-header">
          <span className="verification-title">Methodology Verification</span>
          <span className={`verification-score verification-score--${score >= 80 ? "good" : score >= 50 ? "warn" : "bad"}`}>
            {score}% ({passed}/{total})
          </span>
          <button className="verification-close" onClick={onClose}>✕</button>
        </div>

        {Object.entries(groups).map(([level, checks]) => (
          <div key={level} className="verification-group">
            <div className="verification-group-title">{LEVEL_LABEL[level] ?? level}</div>
            {checks.map(c => (
              <div key={c.id} className={`verification-check ${c.passed ? "verification-check--pass" : "verification-check--fail"}`}>
                <span className="verification-icon">{c.passed ? "✓" : SEVERITY_ICON[c.severity] ?? "✗"}</span>
                <div className="verification-content">
                  <div className="verification-label">{c.label}</div>
                  {c.detail && <div className="verification-detail">{c.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
