import type { DraftValidationIssue, DraftValidationReport, SdDraft } from "./sd-draft-types";

function hasProcessLikeName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const firstWord = trimmed.split(/\s+/)[0] ?? "";
  return /ing$/i.test(trimmed) || /(?:ar|er|ir|ando|iendo|ción|miento)$/i.test(firstWord);
}

function isProbablyPluralCollection(name: string) {
  return /(?:Group|Set|Grupo|Conjunto)$/i.test(name.trim());
}

function nonEmpty(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

export function validateSdDraft(draft: SdDraft): DraftValidationReport {
  const issues: DraftValidationIssue[] = [];

  if (!draft.mainProcess.trim()) {
    issues.push({
      severity: "crit",
      ruleId: "SD-001",
      field: "mainProcess",
      message: "El proceso principal es obligatorio.",
      suggestedFix: "Define la función principal del sistema con un nombre de proceso.",
    });
  } else if (!hasProcessLikeName(draft.mainProcess)) {
    issues.push({
      severity: "media",
      ruleId: "SD-002",
      field: "mainProcess",
      message: "El nombre del proceso principal no parece seguir convención OPM.",
      suggestedFix: "Usa una forma tipo -ing en inglés o infinitivo / -ción / -miento en español.",
    });
  }

  if (!draft.systemName.trim()) {
    issues.push({
      severity: "alta",
      ruleId: "SD-003",
      field: "systemName",
      message: "El nombre del sistema es obligatorio.",
      suggestedFix: "Nombra el sistema que exhibe la función principal.",
    });
  }

  if (!draft.beneficiary.trim() && draft.systemType !== "natural") {
    issues.push({
      severity: "alta",
      ruleId: "SD-004",
      field: "beneficiary",
      message: "Falta beneficiario para un sistema no natural.",
      suggestedFix: "Define el stakeholder o grupo que recibe valor.",
    });
  } else if (draft.beneficiary.trim() && !isProbablyPluralCollection(draft.beneficiary)) {
    issues.push({
      severity: "baja",
      ruleId: "SD-005",
      field: "beneficiary",
      message: "El beneficiario no parece nombrado como colección singular OPM.",
      suggestedFix: "Considera usar Group/Set o Grupo/Conjunto cuando aplique.",
    });
  }

  if (!draft.beneficiaryAttribute.trim() && draft.systemType !== "natural") {
    issues.push({
      severity: "media",
      ruleId: "SD-006",
      field: "beneficiaryAttribute",
      message: "Falta atributo de valor del beneficiario.",
      suggestedFix: "Define qué mejora en el beneficiario, por ejemplo Safety Level o Conveniencia.",
    });
  }

  if (draft.beneficiaryAttribute.trim() && (!draft.beneficiaryStateIn.trim() || !draft.beneficiaryStateOut.trim())) {
    issues.push({
      severity: "media",
      ruleId: "SD-007",
      field: "beneficiaryAttribute",
      message: "Si defines atributo de valor, deberías definir estado inicial y final.",
      suggestedFix: "Completa before/after para hacer visible la transformación de valor.",
    });
  }

  if (!draft.valueObject.trim()) {
    issues.push({
      severity: "alta",
      ruleId: "SD-008",
      field: "valueObject",
      message: "Falta el objeto principal transformado por el sistema.",
      suggestedFix: "Define el objeto o atributo cuyo cambio produce valor.",
    });
  }

  if (draft.systemType === "natural" && nonEmpty(draft.agents).length > 0) {
    issues.push({
      severity: "media",
      ruleId: "SD-009",
      field: "agents",
      message: "Un sistema natural no debería declarar agentes humanos.",
      suggestedFix: "Mueve los enablers no humanos a instrumentos o elimina agentes.",
    });
  }

  if (nonEmpty(draft.instruments).length === 0) {
    issues.push({
      severity: "baja",
      ruleId: "SD-010",
      field: "instruments",
      message: "No hay instrumentos declarados.",
      suggestedFix: "Si existen enablers no humanos relevantes, decláralos como instrumentos.",
    });
  }

  if (nonEmpty(draft.inputs).length === 0 && nonEmpty(draft.outputs).length === 0) {
    issues.push({
      severity: "baja",
      ruleId: "SD-011",
      field: "inputs",
      message: "No se declararon inputs ni outputs explícitos.",
      suggestedFix: "Agrega al menos un input, output o ambos si el sistema los tiene.",
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === "crit" || issue.severity === "alta"),
    issues,
  };
}
