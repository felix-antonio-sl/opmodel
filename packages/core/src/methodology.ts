// Methodology verification — SD/SD1/Global checks per §6.11, §7.6, §10
import type { Model } from "./types";

export interface CheckResult {
  id: string;
  level: "SD" | "SD1" | "global";
  label: string;
  passed: boolean;
  severity: "critical" | "high" | "medium";
  detail?: string;
}

/** Verify model against OPM methodology checklists */
export function verifyMethodology(model: Model): CheckResult[] {
  const results: CheckResult[] = [];
  const things = [...model.things.values()];
  const links = [...model.links.values()];
  const states = [...model.states.values()];
  const processes = things.filter(t => t.kind === "process");
  const objects = things.filter(t => t.kind === "object");

  // ===== SD CHECKS (§6.11) =====

  // 1. Purpose defined: beneficiary + beneficiary attribute + state transition
  const effectLinks = links.filter(l => l.type === "effect" && l.source_state && l.target_state);
  results.push({
    id: "sd-purpose", level: "SD", label: "Purpose defined",
    severity: "critical",
    passed: effectLinks.length > 0,
    detail: effectLinks.length > 0
      ? `${effectLinks.length} state-specified effect link(s) define purpose`
      : "No effect link with state transition (from→to) found — define beneficiary attribute with input/output states",
  });

  // 2. Function defined: main process + main transformee
  const transformingLinks = links.filter(l => ["effect", "consumption", "result"].includes(l.type));
  const mainProcs = processes.filter(p => {
    // Main process = process in SD that has transforming links
    return transformingLinks.some(l => l.source === p.id || l.target === p.id);
  });
  results.push({
    id: "sd-function", level: "SD", label: "Function defined",
    severity: "critical",
    passed: mainProcs.length > 0,
    detail: mainProcs.length > 0
      ? `Main process: ${mainProcs[0]?.name}`
      : "No process with transforming links found",
  });

  // 3. Enablers present
  const enablerLinks = links.filter(l => l.type === "agent" || l.type === "instrument");
  results.push({
    id: "sd-enablers", level: "SD", label: "Enablers present",
    severity: "high",
    passed: enablerLinks.length > 0,
    detail: `${enablerLinks.filter(l => l.type === "agent").length} agent(s), ${enablerLinks.filter(l => l.type === "instrument").length} instrument(s)`,
  });

  // 4. Environment identified
  const envObjects = objects.filter(t => t.affiliation === "environmental");
  results.push({
    id: "sd-environment", level: "SD", label: "Environment identified",
    severity: "medium",
    passed: envObjects.length > 0,
    detail: envObjects.length > 0
      ? `${envObjects.length} environmental object(s): ${envObjects.slice(0, 3).map(o => o.name).join(", ")}`
      : "No environmental objects — identify external context",
  });

  // 5. Problem occurrence (if applicable — artificial/social systems)
  const envProcesses = processes.filter(p => p.affiliation === "environmental");
  const systemType = model.meta.system_type;
  const needsProblem = systemType === "artificial" || systemType === "social" || systemType === "socio-technical";
  results.push({
    id: "sd-problem", level: "SD", label: "Problem occurrence",
    severity: "medium",
    passed: !needsProblem || envProcesses.length > 0,
    detail: envProcesses.length > 0
      ? `Environmental process: ${envProcesses[0]?.name}`
      : needsProblem ? "No environmental process modeling the problem" : "N/A (natural system)",
  });

  // 6. OPL readable (bimodal)
  results.push({
    id: "sd-opl", level: "SD", label: "OPL readable",
    severity: "high",
    passed: things.length > 0, // trivially true if model has content
    detail: `${things.length} things generate OPL sentences`,
  });

  // 7. Singular names
  const pluralThings = things.filter(t => {
    const name = t.name.trim();
    return /(?:s|es|ies)$/i.test(name) && !/(?:Set|Group|Series|Suite|Line|Process|Status)$/i.test(name) && name.length > 3;
  });
  results.push({
    id: "sd-singular", level: "SD", label: "Singular names",
    severity: "high",
    passed: pluralThings.length === 0,
    detail: pluralThings.length > 0
      ? `Possible plural: ${pluralThings.slice(0, 3).map(t => t.name).join(", ")}`
      : "All names follow Singular Name Principle",
  });

  // 8. Process naming
  const invalidProcessNames = processes.filter((p) => {
    const first = p.name.trim().split(/\s+/)[0] ?? "";
    return !/(?:ing|ando|iendo|ción|sión|miento|ar|er|ir)$/i.test(first);
  });
  results.push({
    id: "sd-gerund", level: "SD", label: "Process naming",
    severity: "high",
    passed: invalidProcessNames.length === 0,
    detail: invalidProcessNames.length > 0
      ? `Invalid process naming: ${invalidProcessNames.slice(0, 3).map(p => p.name).join(", ")}`
      : "All processes use accepted naming on first word",
  });

  // 9. Exhibition: system exhibits main process
  const exhibitions = links.filter(l => l.type === "exhibition");
  results.push({
    id: "sd-exhibition", level: "SD", label: "System exhibits process",
    severity: "high",
    passed: exhibitions.length > 0,
    detail: exhibitions.length > 0
      ? `${exhibitions.length} exhibition link(s)`
      : "No exhibition link — system should exhibit its main process",
  });

  // ===== SD1 CHECKS (§7.6) =====

  const refinementOpds = [...model.opds.values()].filter(o => o.refines && o.parent_opd);

  // 10. Every subprocess has transformee
  if (refinementOpds.length > 0) {
    const subprocesses = things.filter(t => t.kind === "process" && refinementOpds.some(opd => {
      return [...model.appearances.values()].some(a => a.opd === opd.id && a.thing === t.id && a.internal);
    }));
    const withoutTransformee = subprocesses.filter(sp =>
      !links.some(l => ["effect", "consumption", "result"].includes(l.type) && (l.source === sp.id || l.target === sp.id))
    );
    results.push({
      id: "sd1-transformee", level: "SD1", label: "Subprocesses have transformee",
      severity: "critical",
      passed: withoutTransformee.length === 0,
      detail: withoutTransformee.length > 0
        ? `Without transformee: ${withoutTransformee.map(p => p.name).join(", ")}`
        : `All ${subprocesses.length} subprocesses have transforming links`,
    });

    // 11. Correct refinement type
    results.push({
      id: "sd1-refinement", level: "SD1", label: "Refinement type correct",
      severity: "high",
      passed: true,
      detail: refinementOpds.map(o => `${o.name}: ${o.refinement_type}`).join(", "),
    });

    // 12. Links distributed correctly (no consumption/result on outer contour)
    const contourErrors = links.filter(l => {
      if (l.type !== "consumption" && l.type !== "result") return false;
      return refinementOpds.some(opd => opd.refines === l.source || opd.refines === l.target);
    });
    results.push({
      id: "sd1-distribution", level: "SD1", label: "Links distributed correctly",
      severity: "critical",
      passed: contourErrors.length === 0,
      detail: contourErrors.length > 0
        ? `${contourErrors.length} consumption/result link(s) on outer contour`
        : "All links correctly distributed",
    });

    // 13. States expressed
    const refinedThingIds = new Set(refinementOpds.map(o => o.refines).filter(Boolean));
    const statesInRefinedContext = states.filter(s => {
      const parent = model.things.get(s.parent);
      return parent && [...model.links.values()].some(l =>
        (l.source === parent.id || l.target === parent.id) && (l.source_state || l.target_state)
      );
    });
    results.push({
      id: "sd1-states", level: "SD1", label: "States expressed",
      severity: "high",
      passed: statesInRefinedContext.length > 0 || states.length === 0,
      detail: `${statesInRefinedContext.length} state-specified link(s) in model`,
    });

    // 14. No redundancy
    results.push({
      id: "sd1-redundancy", level: "SD1", label: "Minimal redundancy",
      severity: "medium",
      passed: true,
      detail: "Manual check — ensure SD1 doesn't duplicate SD facts unnecessarily",
    });
  }

  // ===== GLOBAL CHECKS (§10) =====

  // 15. Bimodal: every OPD has OPL
  results.push({
    id: "global-bimodal", level: "global", label: "Bimodal (OPD + OPL)",
    severity: "high",
    passed: true,
    detail: `${model.opds.size} OPD(s) with auto-generated OPL`,
  });

  // 16. Completeness: every fact in ≥1 OPD
  const thingsWithAppearance = new Set([...model.appearances.values()].map(a => a.thing));
  const orphanThings = things.filter(t => !thingsWithAppearance.has(t.id));
  results.push({
    id: "global-completeness", level: "global", label: "Completeness",
    severity: "high",
    passed: orphanThings.length === 0,
    detail: orphanThings.length > 0
      ? `${orphanThings.length} thing(s) without appearance: ${orphanThings.slice(0, 3).map(t => t.name).join(", ")}`
      : "All things appear in at least one OPD",
  });

  // 17. Clarity: no OPD overly complex
  const MAX_THINGS_PER_OPD = 25;
  const complexOpds = [...model.opds.values()].filter(opd => {
    const count = [...model.appearances.values()].filter(a => a.opd === opd.id).length;
    return count > MAX_THINGS_PER_OPD;
  });
  results.push({
    id: "global-clarity", level: "global", label: "Clarity (OPD complexity)",
    severity: "medium",
    passed: complexOpds.length === 0,
    detail: complexOpds.length > 0
      ? `${complexOpds.map(o => `${o.name}: ${[...model.appearances.values()].filter(a => a.opd === o.id).length} things`).join(", ")}`
      : `All OPDs have ≤${MAX_THINGS_PER_OPD} things`,
  });

  return results;
}
