export type SdSystemType = "artificial" | "natural" | "social" | "socio-technical";

export interface SdDraft {
  systemType: SdSystemType;
  systemName: string;
  mainProcess: string;
  beneficiary: string;
  beneficiaryAttribute: string;
  beneficiaryStateIn: string;
  beneficiaryStateOut: string;
  valueObject: string;
  valueStateIn: string;
  valueStateOut: string;
  agents: string[];
  instruments: string[];
  inputs: string[];
  outputs: string[];
  environment: string[];
  problemOccurrence: string | null;
}

export interface DraftValidationIssue {
  severity: "crit" | "alta" | "media" | "baja";
  ruleId: string;
  message: string;
  field?: keyof SdDraft;
  suggestedFix?: string;
}

export interface DraftValidationReport {
  ok: boolean;
  issues: DraftValidationIssue[];
}

export const EMPTY_SD_DRAFT: SdDraft = {
  systemType: "artificial",
  systemName: "",
  mainProcess: "",
  beneficiary: "",
  beneficiaryAttribute: "",
  beneficiaryStateIn: "",
  beneficiaryStateOut: "",
  valueObject: "",
  valueStateIn: "",
  valueStateOut: "",
  agents: [],
  instruments: [],
  inputs: [],
  outputs: [],
  environment: [],
  problemOccurrence: null,
};
