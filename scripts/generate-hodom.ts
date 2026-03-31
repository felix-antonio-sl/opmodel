#!/usr/bin/env bun
/**
 * Generate the HODOM HSC .opmodel file from the OPL specification.
 * Run: bun scripts/generate-hodom.ts
 * Output: tests/hodom-hsc.opmodel + packages/web/public/hodom-hsc.opmodel
 */

import { writeFileSync } from "fs";

// ── Helpers ──────────────────────────────────────────────────────────────────

let _linkCounter = 0;
let _modCounter = 0;

function thing(id: string, kind: "object" | "process", name: string, essence: "physical" | "informatical", affiliation: "systemic" | "environmental" = "systemic") {
  return { id, kind, name, essence, affiliation };
}
function obj(id: string, name: string, essence: "physical" | "informatical" = "physical", affiliation: "systemic" | "environmental" = "systemic") {
  return thing(id, "object", name, essence, affiliation);
}
function proc(id: string, name: string, essence: "physical" | "informatical" = "physical", affiliation: "systemic" | "environmental" = "systemic") {
  return thing(id, "process", name, essence, affiliation);
}
function state(id: string, parent: string, name: string, opts: { initial?: boolean; final?: boolean; default?: boolean } = {}) {
  return { id, parent, name, initial: opts.initial ?? false, final: opts.final ?? false, default: opts.default ?? false };
}
function link(type: string, source: string, target: string, opts: { source_state?: string; target_state?: string; tag?: string } = {}) {
  const id = `lnk-${++_linkCounter}`;
  const l: any = { id, type, source, target };
  if (opts.source_state) l.source_state = opts.source_state;
  if (opts.target_state) l.target_state = opts.target_state;
  if (opts.tag) l.tag = opts.tag;
  return l;
}
function modifier(over: string, type: "condition" | "event", negated = false) {
  return { id: `mod-${++_modCounter}`, over, type, negated };
}

// ── Things ───────────────────────────────────────────────────────────────────

const things = [
  // ── SD ──
  proc("proc-domiciliary-hospitalizing", "Domiciliary Hospitalizing", "physical"),
  obj("obj-patient-group", "Patient Group", "physical"),
  obj("obj-clinical-condition", "Clinical Condition", "informatical"),
  obj("obj-hodom-system", "Domiciliary Hospitalization System", "physical"),
  obj("obj-healthcare-team", "Healthcare Team", "physical"),
  obj("obj-medical-equipment", "Medical Equipment", "physical"),
  obj("obj-communication-system", "Communication System", "physical"),
  obj("obj-transport-vehicle", "Transport Vehicle", "physical"),
  obj("obj-admin-infrastructure", "Administrative Infrastructure", "physical"),
  obj("obj-clinical-supply", "Clinical Supply", "physical"),
  obj("obj-medication", "Medication", "physical"),
  obj("obj-clinical-record", "Clinical Record", "informatical"),
  obj("obj-patient-home", "Patient Home", "physical", "environmental"),
  obj("obj-inpatient-facility", "Inpatient Facility", "physical", "environmental"),
  obj("obj-current-regulation", "Current Regulation", "informatical", "environmental"),
  proc("proc-inpatient-bed-occupying", "Inpatient Bed Occupying", "physical", "environmental"),

  // ── SD1 ──
  proc("proc-eligibility-evaluating", "Eligibility Evaluating", "informatical"),
  proc("proc-patient-admitting", "Patient Admitting", "informatical"),
  proc("proc-care-planning", "Care Planning", "informatical"),
  proc("proc-therapeutic-plan-executing", "Therapeutic Plan Executing", "physical"),
  proc("proc-clinical-evolution-monitoring", "Clinical Evolution Monitoring", "informatical"),
  proc("proc-patient-discharging", "Patient Discharging", "informatical"),
  obj("obj-eligibility-status", "Eligibility Status", "informatical"),
  obj("obj-informed-consent", "Informed Consent", "informatical"),
  obj("obj-therapeutic-plan", "Therapeutic Plan", "informatical"),
  obj("obj-nursing-care-plan", "Nursing Care Plan", "informatical"),
  obj("obj-social-report", "Social Report", "informatical"),
  obj("obj-admission-form", "Admission Form", "informatical"),
  obj("obj-domiciliary-clinical-summary", "Domiciliary Clinical Summary", "informatical"),
  obj("obj-epicrisis", "Epicrisis", "informatical"),
  obj("obj-satisfaction-survey", "Satisfaction Survey", "informatical"),
  obj("obj-continuity-decision", "Continuity Decision", "informatical"),
  obj("obj-hospitalization-status", "Hospitalization Status", "informatical"),
  obj("obj-caregiver", "Caregiver", "physical"),
  obj("obj-support-network", "Support Network", "physical"),

  // ── SD1.1 ──
  proc("proc-clinical-condition-evaluating", "Clinical Condition Evaluating", "informatical"),
  proc("proc-home-condition-evaluating", "Home Condition Evaluating", "informatical"),
  proc("proc-support-network-verifying", "Support Network Verifying", "informatical"),
  proc("proc-informed-consent-obtaining", "Informed Consent Obtaining", "informatical"),
  obj("obj-home-condition", "Home Condition", "informatical"),
  obj("obj-rights-duties-charter", "Rights and Duties Charter", "informatical"),
  // SD1.1 agents
  obj("obj-attending-physician", "Attending Physician", "physical"),
  obj("obj-social-worker", "Social Worker", "physical"),
  obj("obj-clinical-nurse", "Clinical Nurse", "physical"),

  // ── SD1.2 ──
  proc("proc-admission-registering", "Admission Registering", "informatical"),
  proc("proc-social-diagnosis-elaborating", "Social Diagnosis Elaborating", "informatical"),
  proc("proc-patient-documentation-delivering", "Patient Documentation Delivering", "informatical"),
  proc("proc-referral-facility-coordinating", "Referral Facility Coordinating", "informatical"),
  obj("obj-socioeconomic-status", "Socioeconomic Status", "informatical"),
  obj("obj-care-indication-document", "Care Indication Document", "informatical"),
  obj("obj-administrative-staff", "Administrative Staff", "physical"),
  obj("obj-coordination-professional", "Coordination Professional", "physical"),

  // ── SD1.3 ──
  proc("proc-therapeutic-plan-elaborating", "Therapeutic Plan Elaborating", "informatical"),
  proc("proc-nursing-care-plan-elaborating", "Nursing Care Plan Elaborating", "informatical"),
  proc("proc-home-visit-scheduling", "Home Visit Scheduling", "informatical"),
  proc("proc-transport-route-programming", "Transport Route Programming", "informatical"),
  obj("obj-visit-schedule", "Visit Schedule", "informatical"),
  obj("obj-transport-route", "Transport Route", "informatical"),

  // ── SD1.4 ──
  proc("proc-medical-visit-performing", "Medical Visit Performing", "physical"),
  proc("proc-nursing-care-executing", "Nursing Care Executing", "physical"),
  proc("proc-kinesiological-therapy-executing", "Kinesiological Therapy Executing", "physical"),
  proc("proc-medication-administering", "Medication Administering", "physical"),
  proc("proc-remote-care-regulating", "Remote Care Regulating", "informatical"),
  proc("proc-patient-caregiver-educating", "Patient and Caregiver Educating", "informatical"),
  obj("obj-motor-therapy", "Motor Therapy", "informatical"),
  obj("obj-respiratory-therapy", "Respiratory Therapy", "informatical"),
  obj("obj-prescription", "Prescription", "informatical"),
  obj("obj-telehealth-record", "Telehealth Record", "informatical"),
  obj("obj-self-care-knowledge", "Self-Care Knowledge", "informatical"),
  obj("obj-kinesiologist", "Kinesiologist", "physical"),
  obj("obj-nursing-technician", "Nursing Technician", "physical"),
  obj("obj-regulating-physician", "Regulating Physician", "physical"),

  // ── SD1.5 ──
  proc("proc-vital-signs-evaluating", "Vital Signs Evaluating", "informatical"),
  proc("proc-clinical-record-updating", "Clinical Record Updating", "informatical"),
  proc("proc-patient-categorizing", "Patient Categorizing", "informatical"),
  proc("proc-continuity-deciding", "Continuity Deciding", "informatical"),
  obj("obj-vital-signs-data", "Vital Signs Data", "informatical"),
  obj("obj-blood-pressure", "Blood Pressure", "informatical"),
  obj("obj-heart-rate", "Heart Rate", "informatical"),
  obj("obj-respiratory-rate", "Respiratory Rate", "informatical"),
  obj("obj-oxygen-saturation", "Oxygen Saturation", "informatical"),
  obj("obj-patient-category", "Patient Category", "informatical"),

  // ── SD1.6 ──
  proc("proc-medical-discharge", "Medical Discharge", "informatical"),
  proc("proc-hospital-readmission-discharge", "Hospital Readmission Discharge", "informatical"),
  proc("proc-death-discharge", "Death Discharge", "informatical"),
  proc("proc-voluntary-withdrawal-discharge", "Voluntary Withdrawal Discharge", "informatical"),
  proc("proc-disciplinary-discharge", "Disciplinary Discharge", "informatical"),
  obj("obj-clinical-instability", "Clinical Instability", "informatical"),
  obj("obj-death-protocol", "Death Protocol", "informatical"),
  obj("obj-withdrawal-statement", "Withdrawal Statement", "informatical"),
  obj("obj-treatment-adherence", "Treatment Adherence", "informatical"),
  obj("obj-technical-director", "Technical Director", "physical"),

  // ── SD2 (Healthcare Team unfolding) ──
  // Team members already defined above: attending-physician, clinical-nurse, kinesiologist, nursing-technician, social-worker, administrative-staff, coordination-professional, regulating-physician, technical-director
  // Additional attributes
  obj("obj-clinical-experience", "Clinical Experience", "informatical"),
  obj("obj-postgraduate-management-training", "Postgraduate Management Training", "informatical"),
  obj("obj-iaas-prevention-course", "IAAS Prevention Course", "informatical"),
  obj("obj-weekly-dedication", "Weekly Dedication", "informatical"),
  obj("obj-management-training", "Management Training", "informatical"),
  obj("obj-iaas-course", "IAAS Course", "informatical"),
  obj("obj-bls-certification", "BLS Certification", "informatical"),
  obj("obj-regulation-experience", "Regulation Experience", "informatical"),

  // ── SD3 (Administrative Infrastructure unfolding) ──
  obj("obj-telephone-system", "Telephone System", "physical"),
  obj("obj-it-system", "IT System", "informatical"),
  obj("obj-electrical-backup", "Electrical Backup System", "physical"),
  obj("obj-clinical-archive-area", "Clinical Archive Area", "physical"),
  obj("obj-pharmacy", "Pharmacy or Authorized Dispensary", "physical"),
  obj("obj-supply-storage", "Supply Storage", "physical"),
  obj("obj-waste-disposal-area", "Waste Disposal Area", "physical"),
  obj("obj-cleaning-supply-room", "Cleaning Supply Room", "physical"),
  obj("obj-staff-welfare-area", "Staff Welfare Area", "physical"),
  obj("obj-vehicle-parking", "Vehicle Parking", "physical"),
  obj("obj-evacuation-signage", "Evacuation Signage System", "physical"),
  // Attributes
  obj("obj-availability", "Availability", "informatical"),
  obj("obj-internet-connectivity", "Internet Connectivity", "informatical"),
  obj("obj-sec-authorization", "SEC Authorization", "informatical"),
  obj("obj-security-level", "Security Level", "informatical"),
  obj("obj-cold-chain-compliance", "Cold Chain Compliance", "informatical"),
  obj("obj-temperature-control", "Temperature Control", "informatical"),
  obj("obj-reas-compliance", "REAS Compliance", "informatical"),
  obj("obj-dining-access", "Dining Access", "physical"),
  obj("obj-hygiene-facilities", "Hygiene Facilities", "physical"),
  obj("obj-lockers", "Lockers", "physical"),
  obj("obj-break-room", "Break Room", "physical"),

  // ── SD4 (Medical Equipment unfolding) ──
  obj("obj-bp-monitor", "Blood Pressure Monitor", "physical"),
  obj("obj-pulse-oximeter", "Pulse Oximeter", "physical"),
  obj("obj-cardiac-monitor", "Cardiac Monitor", "physical"),
  obj("obj-thermometer", "Thermometer", "physical"),
  obj("obj-defibrillator", "Defibrillator", "physical"),
  obj("obj-specialty-instruments", "Specialty Instrument Set", "physical"),
  obj("obj-maintenance-status", "Maintenance Status", "informatical"),
  obj("obj-sanitary-authorization", "Sanitary Authorization", "informatical"),

  // ── SD5 (Documentation System) ──
  obj("obj-documentation-system", "Documentation System", "informatical"),
  obj("obj-internal-org-manual", "Internal Organization Manual", "informatical"),
  obj("obj-clinical-protocol-set", "Clinical Protocol Set", "informatical"),
  obj("obj-procedures-manual", "Procedures Manual", "informatical"),
  obj("obj-waste-mgmt-protocol", "Waste Management Protocol", "informatical"),
  obj("obj-annual-training-plan", "Annual Training Plan", "informatical"),
  // Sub-components
  obj("obj-organizational-chart", "Organizational Chart", "informatical"),
  obj("obj-role-definition-set", "Role Definition Set", "informatical"),
  obj("obj-schedule-definition", "Schedule Definition", "informatical"),
  obj("obj-hygiene-regulation", "Hygiene Regulation", "informatical"),
  obj("obj-admission-eval-protocol", "Admission Evaluation Protocol", "informatical"),
  obj("obj-visit-route-protocol", "Visit and Route Scheduling Protocol", "informatical"),
  obj("obj-categorization-discharge-protocol", "Categorization and Discharge Protocol", "informatical"),
  obj("obj-prescription-referral-protocol", "Prescription and Referral Management Protocol", "informatical"),
  obj("obj-emergency-response-protocol", "Emergency Response Protocol", "informatical"),
  obj("obj-staff-aggression-protocol", "Staff Aggression Protocol", "informatical"),
  obj("obj-peripheral-venous-proc", "Peripheral Venous Line Procedure", "informatical"),
  obj("obj-central-venous-proc", "Central Venous Line Procedure", "informatical"),
  obj("obj-urinary-catheter-proc", "Urinary Catheter Procedure", "informatical"),
  obj("obj-tracheostomy-proc", "Tracheostomy Procedure", "informatical"),
  obj("obj-sample-collection-proc", "Sample Collection Procedure", "informatical"),
  obj("obj-isolation-precaution-proc", "Isolation Precaution Procedure", "informatical"),
  obj("obj-reas-decree-compliance", "REAS Decree Compliance", "informatical"),
  obj("obj-iaas-training", "IAAS Training", "informatical"),
  obj("obj-bls-training", "BLS Training", "informatical"),
  obj("obj-staff-induction-program", "Staff Induction Program", "informatical"),
  obj("obj-humanized-care-training", "Humanized Care Training", "informatical"),
  obj("obj-minimum-duration", "Minimum Duration", "informatical"),

  // ── SD6 (Governance processes) ──
  proc("proc-sanitary-auth-managing", "Sanitary Authorization Managing", "informatical"),
  proc("proc-quality-safety-managing", "Quality and Safety Managing", "informatical"),
  proc("proc-staff-training-managing", "Staff Training Managing", "informatical"),
  proc("proc-supply-chain-managing", "Supply Chain Managing", "informatical"),
  proc("proc-waste-managing", "Waste Managing", "informatical"),
  proc("proc-equipment-maintenance-managing", "Equipment Maintenance Managing", "informatical"),
  obj("obj-sanitary-auth-status", "Sanitary Authorization Status", "informatical"),
  obj("obj-authorization-validity", "Authorization Validity", "informatical"),
  obj("obj-seremi", "SEREMI", "physical", "environmental"),
  obj("obj-quality-level", "Quality Level", "informatical"),
  obj("obj-adverse-reaction-audit", "Adverse Reaction Audit", "informatical"),
  obj("obj-mortality-audit", "Mortality Audit", "informatical"),
  obj("obj-training-compliance", "Training Compliance", "informatical"),
  obj("obj-biomedical-waste", "Biomedical Waste", "physical"),
  obj("obj-sharps-disposal-protocol", "Sharps Disposal Protocol", "informatical"),
  obj("obj-preventive-maintenance-program", "Preventive Maintenance Program", "informatical"),

  // ── SD7 (Patient Home conditions) ──
  obj("obj-basic-services", "Basic Services", "informatical"),
  obj("obj-telephony-access", "Telephony Access", "informatical"),
  obj("obj-road-access", "Road Access", "informatical"),
  obj("obj-coverage-radius-compliance", "Coverage Radius Compliance", "informatical"),

  // ── SD8 (Exclusions) ──
  obj("obj-exclusion-condition", "Exclusion Condition", "informatical"),
  obj("obj-clinical-instability-exclusion", "Clinical Instability Exclusion", "informatical"),
  obj("obj-unestablished-diagnosis-exclusion", "Unestablished Diagnosis Exclusion", "informatical"),
  obj("obj-decompensated-mental-health-exclusion", "Decompensated Mental Health Exclusion", "informatical"),
  obj("obj-unlisted-service-exclusion", "Unlisted Service Exclusion", "informatical"),
  obj("obj-prior-disciplinary-exclusion", "Prior Disciplinary Discharge Exclusion", "informatical"),

  // ── SD9 (Tagged structural) ──
  obj("obj-continuity-of-care", "Continuity of Care", "informatical"),
];

// ── States ───────────────────────────────────────────────────────────────────

const states = [
  // Clinical Condition
  state("state-acute-reacutized", "obj-clinical-condition", "acute/reacutized", { initial: true }),
  state("state-recovered", "obj-clinical-condition", "recovered", { final: true }),
  // Eligibility Status
  state("state-elig-pending", "obj-eligibility-status", "pending", { initial: true }),
  state("state-elig-eligible", "obj-eligibility-status", "eligible", { final: true }),
  state("state-elig-ineligible", "obj-eligibility-status", "ineligible"),
  // Informed Consent
  state("state-consent-unsigned", "obj-informed-consent", "unsigned", { initial: true }),
  state("state-consent-signed", "obj-informed-consent", "signed", { final: true }),
  // Therapeutic Plan
  state("state-tp-draft", "obj-therapeutic-plan", "draft", { initial: true }),
  state("state-tp-active", "obj-therapeutic-plan", "active", { default: true }),
  state("state-tp-completed", "obj-therapeutic-plan", "completed", { final: true }),
  // Nursing Care Plan
  state("state-ncp-draft", "obj-nursing-care-plan", "draft", { initial: true }),
  state("state-ncp-active", "obj-nursing-care-plan", "active"),
  state("state-ncp-completed", "obj-nursing-care-plan", "completed", { final: true }),
  // Continuity Decision
  state("state-cd-continue", "obj-continuity-decision", "continue-treatment"),
  state("state-cd-discharge", "obj-continuity-decision", "proceed-discharge"),
  // Hospitalization Status
  state("state-hs-active", "obj-hospitalization-status", "active", { initial: true }),
  state("state-hs-discharged", "obj-hospitalization-status", "discharged", { final: true }),
  // Caregiver
  state("state-caregiver-available", "obj-caregiver", "available"),
  state("state-caregiver-unavailable", "obj-caregiver", "unavailable"),
  // Support Network
  state("state-sn-verified", "obj-support-network", "verified"),
  state("state-sn-insufficient", "obj-support-network", "insufficient"),
  // Home Condition
  state("state-hc-adequate", "obj-home-condition", "adequate", { final: true }),
  state("state-hc-inadequate", "obj-home-condition", "inadequate"),
  // Self-Care Knowledge
  state("state-sck-insufficient", "obj-self-care-knowledge", "insufficient", { initial: true }),
  state("state-sck-sufficient", "obj-self-care-knowledge", "sufficient"),
  // Clinical Instability (SD1.6)
  state("state-ci-absent", "obj-clinical-instability", "absent"),
  state("state-ci-present", "obj-clinical-instability", "present"),
  // Treatment Adherence
  state("state-ta-adherent", "obj-treatment-adherence", "adherent"),
  state("state-ta-non-adherent", "obj-treatment-adherence", "non-adherent"),
  // Availability (Telephone)
  state("state-avail-24-7", "obj-availability", "24/7", { initial: true }),
  state("state-avail-partial", "obj-availability", "partial"),
  // Security Level
  state("state-sec-secured", "obj-security-level", "secured"),
  state("state-sec-unsecured", "obj-security-level", "unsecured"),
  // Cold Chain
  state("state-cc-compliant", "obj-cold-chain-compliance", "compliant", { initial: true }),
  state("state-cc-non-compliant", "obj-cold-chain-compliance", "non-compliant"),
  // REAS Compliance
  state("state-reas-compliant", "obj-reas-compliance", "compliant"),
  state("state-reas-non-compliant", "obj-reas-compliance", "non-compliant"),
  // Maintenance Status
  state("state-maint-current", "obj-maintenance-status", "current", { initial: true }),
  state("state-maint-overdue", "obj-maintenance-status", "overdue"),
  // Sanitary Authorization (equipment)
  state("state-sa-authorized", "obj-sanitary-authorization", "authorized", { initial: true }),
  state("state-sa-unauthorized", "obj-sanitary-authorization", "unauthorized"),
  // Sanitary Auth Status (SD6)
  state("state-sas-pending", "obj-sanitary-auth-status", "pending", { initial: true }),
  state("state-sas-authorized", "obj-sanitary-auth-status", "authorized"),
  state("state-sas-expired", "obj-sanitary-auth-status", "expired"),
  // Training Compliance
  state("state-tc-compliant", "obj-training-compliance", "compliant"),
  state("state-tc-non-compliant", "obj-training-compliance", "non-compliant"),
  // Basic Services (SD7)
  state("state-bs-available", "obj-basic-services", "available", { initial: true }),
  state("state-bs-unavailable", "obj-basic-services", "unavailable"),
  // Telephony Access
  state("state-tel-available", "obj-telephony-access", "available"),
  state("state-tel-unavailable", "obj-telephony-access", "unavailable"),
  // Road Access
  state("state-ra-within", "obj-road-access", "within-coverage-radius", { initial: true }),
  state("state-ra-outside", "obj-road-access", "outside-coverage-radius"),
  // Coverage Radius
  state("state-cr-compliant", "obj-coverage-radius-compliance", "compliant"),
  state("state-cr-non-compliant", "obj-coverage-radius-compliance", "non-compliant"),
  // Exclusion Condition (SD8)
  state("state-exc-absent", "obj-exclusion-condition", "absent", { initial: true }),
  state("state-exc-present", "obj-exclusion-condition", "present"),
  // Patient Category (SD1.5)
  state("state-pc-stable", "obj-patient-category", "stable", { default: true }),
  state("state-pc-improving", "obj-patient-category", "improving"),
  state("state-pc-deteriorating", "obj-patient-category", "deteriorating"),
];

// ── OPDs ─────────────────────────────────────────────────────────────────────

const opds = [
  { id: "opd-sd", name: "SD", opd_type: "hierarchical" as const, parent_opd: null },
  { id: "opd-sd1", name: "SD1", opd_type: "hierarchical" as const, parent_opd: "opd-sd", refines: "proc-domiciliary-hospitalizing", refinement_type: "in-zoom" as const },
  { id: "opd-sd1-1", name: "SD1.1", opd_type: "hierarchical" as const, parent_opd: "opd-sd1", refines: "proc-eligibility-evaluating", refinement_type: "in-zoom" as const },
  { id: "opd-sd1-2", name: "SD1.2", opd_type: "hierarchical" as const, parent_opd: "opd-sd1", refines: "proc-patient-admitting", refinement_type: "in-zoom" as const },
  { id: "opd-sd1-3", name: "SD1.3", opd_type: "hierarchical" as const, parent_opd: "opd-sd1", refines: "proc-care-planning", refinement_type: "in-zoom" as const },
  { id: "opd-sd1-4", name: "SD1.4", opd_type: "hierarchical" as const, parent_opd: "opd-sd1", refines: "proc-therapeutic-plan-executing", refinement_type: "in-zoom" as const },
  { id: "opd-sd1-5", name: "SD1.5", opd_type: "hierarchical" as const, parent_opd: "opd-sd1", refines: "proc-clinical-evolution-monitoring", refinement_type: "in-zoom" as const },
  { id: "opd-sd1-6", name: "SD1.6", opd_type: "hierarchical" as const, parent_opd: "opd-sd1", refines: "proc-patient-discharging", refinement_type: "unfold" as const },
  { id: "opd-sd2", name: "SD2", opd_type: "hierarchical" as const, parent_opd: "opd-sd", refines: "obj-healthcare-team", refinement_type: "unfold" as const },
  { id: "opd-sd3", name: "SD3", opd_type: "hierarchical" as const, parent_opd: "opd-sd", refines: "obj-admin-infrastructure", refinement_type: "unfold" as const },
  { id: "opd-sd4", name: "SD4", opd_type: "hierarchical" as const, parent_opd: "opd-sd", refines: "obj-medical-equipment", refinement_type: "unfold" as const },
  { id: "opd-sd5", name: "SD5", opd_type: "hierarchical" as const, parent_opd: "opd-sd", refines: "obj-hodom-system", refinement_type: "unfold" as const },
  { id: "opd-sd6", name: "SD6", opd_type: "hierarchical" as const, parent_opd: "opd-sd", refines: "obj-hodom-system", refinement_type: "unfold" as const },
  { id: "opd-sd7", name: "SD7", opd_type: "hierarchical" as const, parent_opd: "opd-sd", refines: "obj-patient-home", refinement_type: "unfold" as const },
  { id: "opd-sd8", name: "SD8", opd_type: "hierarchical" as const, parent_opd: "opd-sd1-1", refines: "obj-exclusion-condition", refinement_type: "unfold" as const },
  { id: "opd-sd9", name: "SD9", opd_type: "hierarchical" as const, parent_opd: "opd-sd" },
];

// ── Links ────────────────────────────────────────────────────────────────────

const links = [
  // ── SD ──
  link("exhibition", "obj-hodom-system", "proc-domiciliary-hospitalizing"),
  link("exhibition", "obj-patient-group", "obj-clinical-condition"),
  link("effect", "proc-domiciliary-hospitalizing", "obj-clinical-condition", { source_state: "state-acute-reacutized", target_state: "state-recovered" }),
  link("agent", "obj-healthcare-team", "proc-domiciliary-hospitalizing"),
  link("instrument", "proc-domiciliary-hospitalizing", "obj-medical-equipment"),
  link("instrument", "proc-domiciliary-hospitalizing", "obj-communication-system"),
  link("instrument", "proc-domiciliary-hospitalizing", "obj-transport-vehicle"),
  link("instrument", "proc-domiciliary-hospitalizing", "obj-admin-infrastructure"),
  link("consumption", "obj-clinical-supply", "proc-domiciliary-hospitalizing"),
  link("consumption", "obj-medication", "proc-domiciliary-hospitalizing"),
  link("result", "proc-domiciliary-hospitalizing", "obj-clinical-record"),
  link("tagged", "obj-patient-home", "proc-domiciliary-hospitalizing", { tag: "hosts" }),
  link("tagged", "obj-current-regulation", "obj-hodom-system", { tag: "governs" }),
  link("tagged", "obj-inpatient-facility", "proc-domiciliary-hospitalizing", { tag: "refers" }),
  link("effect", "proc-inpatient-bed-occupying", "obj-clinical-condition", { target_state: "state-acute-reacutized" }),

  // ── SD1 ──
  // Eligibility Evaluating
  link("effect", "proc-eligibility-evaluating", "obj-eligibility-status", { source_state: "state-elig-pending", target_state: "state-elig-eligible" }),
  link("instrument", "proc-eligibility-evaluating", "obj-inpatient-facility"),
  link("instrument", "proc-eligibility-evaluating", "obj-caregiver", { source_state: "state-caregiver-available" }),
  link("effect", "proc-eligibility-evaluating", "obj-support-network", { source_state: "state-sn-insufficient", target_state: "state-sn-verified" }),
  // Patient Admitting
  link("effect", "proc-patient-admitting", "obj-informed-consent", { source_state: "state-consent-unsigned", target_state: "state-consent-signed" }),
  link("result", "proc-patient-admitting", "obj-admission-form"),
  link("result", "proc-patient-admitting", "obj-social-report"),
  link("consumption", "obj-clinical-supply", "proc-patient-admitting"),
  // Care Planning
  link("result", "proc-care-planning", "obj-therapeutic-plan", { target_state: "state-tp-draft" }),
  link("result", "proc-care-planning", "obj-nursing-care-plan"),
  // Therapeutic Plan Executing
  link("instrument", "proc-therapeutic-plan-executing", "obj-therapeutic-plan", { source_state: "state-tp-active" }),
  link("instrument", "proc-therapeutic-plan-executing", "obj-nursing-care-plan", { source_state: "state-ncp-active" }),
  link("consumption", "obj-clinical-supply", "proc-therapeutic-plan-executing"),
  link("consumption", "obj-medication", "proc-therapeutic-plan-executing"),
  link("instrument", "proc-therapeutic-plan-executing", "obj-medical-equipment"),
  link("instrument", "proc-therapeutic-plan-executing", "obj-transport-vehicle"),
  // Clinical Evolution Monitoring
  link("effect", "proc-clinical-evolution-monitoring", "obj-clinical-condition", { source_state: "state-acute-reacutized", target_state: "state-recovered" }),
  link("result", "proc-clinical-evolution-monitoring", "obj-domiciliary-clinical-summary"),
  link("result", "proc-clinical-evolution-monitoring", "obj-continuity-decision"),
  // Patient Discharging
  link("effect", "proc-patient-discharging", "obj-hospitalization-status", { source_state: "state-hs-active", target_state: "state-hs-discharged" }),
  link("effect", "proc-patient-discharging", "obj-therapeutic-plan", { source_state: "state-tp-active", target_state: "state-tp-completed" }),
  link("effect", "proc-patient-discharging", "obj-nursing-care-plan", { source_state: "state-ncp-active", target_state: "state-ncp-completed" }),
  link("result", "proc-patient-discharging", "obj-epicrisis"),
  link("result", "proc-patient-discharging", "obj-satisfaction-survey"),
  link("result", "proc-patient-discharging", "obj-clinical-record"),
  // Agent links for all SD1 subprocesses
  link("agent", "obj-healthcare-team", "proc-eligibility-evaluating"),
  link("agent", "obj-healthcare-team", "proc-patient-admitting"),
  link("agent", "obj-healthcare-team", "proc-care-planning"),
  link("agent", "obj-healthcare-team", "proc-therapeutic-plan-executing"),
  link("agent", "obj-healthcare-team", "proc-clinical-evolution-monitoring"),
  link("agent", "obj-healthcare-team", "proc-patient-discharging"),

  // ── SD1.1 ──
  link("effect", "proc-clinical-condition-evaluating", "obj-patient-group"),
  link("effect", "proc-clinical-condition-evaluating", "obj-clinical-condition", { source_state: "state-acute-reacutized" }),
  link("instrument", "proc-clinical-condition-evaluating", "obj-inpatient-facility"),
  link("agent", "obj-attending-physician", "proc-clinical-condition-evaluating"),
  link("result", "proc-home-condition-evaluating", "obj-social-report"),
  link("effect", "proc-home-condition-evaluating", "obj-patient-home"),
  link("agent", "obj-social-worker", "proc-home-condition-evaluating"),
  link("exhibition", "obj-patient-home", "obj-home-condition"),
  link("effect", "proc-home-condition-evaluating", "obj-home-condition", { source_state: "state-hc-inadequate", target_state: "state-hc-adequate" }),
  link("effect", "proc-support-network-verifying", "obj-support-network", { source_state: "state-sn-insufficient", target_state: "state-sn-verified" }),
  link("instrument", "proc-support-network-verifying", "obj-caregiver", { source_state: "state-caregiver-available" }),
  link("agent", "obj-social-worker", "proc-support-network-verifying"),
  link("effect", "proc-informed-consent-obtaining", "obj-informed-consent", { source_state: "state-consent-unsigned", target_state: "state-consent-signed" }),
  link("instrument", "proc-informed-consent-obtaining", "obj-patient-group"),
  link("agent", "obj-clinical-nurse", "proc-informed-consent-obtaining"),
  link("result", "proc-informed-consent-obtaining", "obj-rights-duties-charter"),

  // ── SD1.2 ──
  link("result", "proc-admission-registering", "obj-admission-form"),
  link("instrument", "proc-admission-registering", "obj-communication-system"),
  link("agent", "obj-administrative-staff", "proc-admission-registering"),
  link("result", "proc-social-diagnosis-elaborating", "obj-social-report"),
  link("effect", "proc-social-diagnosis-elaborating", "obj-patient-home"),
  link("agent", "obj-social-worker", "proc-social-diagnosis-elaborating"),
  link("result", "proc-social-diagnosis-elaborating", "obj-socioeconomic-status"),
  link("effect", "proc-patient-documentation-delivering", "obj-patient-group"),
  link("instrument", "proc-patient-documentation-delivering", "obj-informed-consent", { source_state: "state-consent-signed" }),
  link("result", "proc-patient-documentation-delivering", "obj-care-indication-document"),
  link("agent", "obj-clinical-nurse", "proc-patient-documentation-delivering"),
  link("instrument", "proc-referral-facility-coordinating", "obj-inpatient-facility"),
  link("instrument", "proc-referral-facility-coordinating", "obj-communication-system"),
  link("agent", "obj-coordination-professional", "proc-referral-facility-coordinating"),

  // ── SD1.3 ──
  link("result", "proc-therapeutic-plan-elaborating", "obj-therapeutic-plan", { target_state: "state-tp-draft" }),
  link("instrument", "proc-therapeutic-plan-elaborating", "obj-clinical-condition"),
  link("agent", "obj-attending-physician", "proc-therapeutic-plan-elaborating"),
  link("result", "proc-nursing-care-plan-elaborating", "obj-nursing-care-plan", { target_state: "state-ncp-draft" }),
  link("instrument", "proc-nursing-care-plan-elaborating", "obj-therapeutic-plan", { source_state: "state-tp-draft" }),
  link("agent", "obj-clinical-nurse", "proc-nursing-care-plan-elaborating"),
  link("result", "proc-home-visit-scheduling", "obj-visit-schedule"),
  link("instrument", "proc-home-visit-scheduling", "obj-therapeutic-plan", { source_state: "state-tp-draft" }),
  link("agent", "obj-coordination-professional", "proc-home-visit-scheduling"),
  link("result", "proc-transport-route-programming", "obj-transport-route"),
  link("instrument", "proc-transport-route-programming", "obj-visit-schedule"),
  link("instrument", "proc-transport-route-programming", "obj-patient-home"),
  link("agent", "obj-administrative-staff", "proc-transport-route-programming"),

  // ── SD1.4 ──
  link("effect", "proc-medical-visit-performing", "obj-patient-group"),
  link("instrument", "proc-medical-visit-performing", "obj-therapeutic-plan", { source_state: "state-tp-active" }),
  link("instrument", "proc-medical-visit-performing", "obj-medical-equipment"),
  link("instrument", "proc-medical-visit-performing", "obj-transport-vehicle"),
  link("result", "proc-medical-visit-performing", "obj-domiciliary-clinical-summary"),
  link("agent", "obj-attending-physician", "proc-medical-visit-performing"),
  link("effect", "proc-nursing-care-executing", "obj-patient-group"),
  link("instrument", "proc-nursing-care-executing", "obj-nursing-care-plan", { source_state: "state-ncp-active" }),
  link("instrument", "proc-nursing-care-executing", "obj-medical-equipment"),
  link("consumption", "obj-clinical-supply", "proc-nursing-care-executing"),
  link("agent", "obj-clinical-nurse", "proc-nursing-care-executing"),
  link("agent", "obj-nursing-technician", "proc-nursing-care-executing"),
  link("effect", "proc-kinesiological-therapy-executing", "obj-patient-group"),
  link("instrument", "proc-kinesiological-therapy-executing", "obj-therapeutic-plan", { source_state: "state-tp-active" }),
  link("instrument", "proc-kinesiological-therapy-executing", "obj-medical-equipment"),
  link("agent", "obj-kinesiologist", "proc-kinesiological-therapy-executing"),
  link("result", "proc-kinesiological-therapy-executing", "obj-motor-therapy"),
  link("result", "proc-kinesiological-therapy-executing", "obj-respiratory-therapy"),
  link("consumption", "obj-medication", "proc-medication-administering"),
  link("effect", "proc-medication-administering", "obj-patient-group"),
  link("instrument", "proc-medication-administering", "obj-therapeutic-plan", { source_state: "state-tp-active" }),
  link("agent", "obj-clinical-nurse", "proc-medication-administering"),
  link("agent", "obj-nursing-technician", "proc-medication-administering"),
  link("instrument", "proc-medication-administering", "obj-prescription"),
  link("effect", "proc-remote-care-regulating", "obj-patient-group"),
  link("instrument", "proc-remote-care-regulating", "obj-communication-system"),
  link("agent", "obj-regulating-physician", "proc-remote-care-regulating"),
  link("result", "proc-remote-care-regulating", "obj-telehealth-record"),
  link("effect", "proc-patient-caregiver-educating", "obj-patient-group"),
  link("effect", "proc-patient-caregiver-educating", "obj-caregiver"),
  link("instrument", "proc-patient-caregiver-educating", "obj-therapeutic-plan", { source_state: "state-tp-active" }),
  link("agent", "obj-clinical-nurse", "proc-patient-caregiver-educating"),
  link("exhibition", "obj-patient-group", "obj-self-care-knowledge"),
  link("effect", "proc-patient-caregiver-educating", "obj-self-care-knowledge", { source_state: "state-sck-insufficient", target_state: "state-sck-sufficient" }),

  // ── SD1.5 ──
  link("effect", "proc-vital-signs-evaluating", "obj-patient-group"),
  link("instrument", "proc-vital-signs-evaluating", "obj-medical-equipment"),
  link("agent", "obj-clinical-nurse", "proc-vital-signs-evaluating"),
  link("result", "proc-vital-signs-evaluating", "obj-vital-signs-data"),
  link("aggregation", "obj-vital-signs-data", "obj-blood-pressure"),
  link("aggregation", "obj-vital-signs-data", "obj-heart-rate"),
  link("aggregation", "obj-vital-signs-data", "obj-respiratory-rate"),
  link("aggregation", "obj-vital-signs-data", "obj-oxygen-saturation"),
  link("consumption", "obj-vital-signs-data", "proc-clinical-record-updating"),
  link("effect", "proc-clinical-record-updating", "obj-clinical-record"),
  link("instrument", "proc-clinical-record-updating", "obj-communication-system"),
  link("agent", "obj-clinical-nurse", "proc-clinical-record-updating"),
  link("result", "proc-patient-categorizing", "obj-patient-category"),
  link("instrument", "proc-patient-categorizing", "obj-vital-signs-data"),
  link("agent", "obj-attending-physician", "proc-patient-categorizing"),
  link("result", "proc-continuity-deciding", "obj-continuity-decision"),
  link("instrument", "proc-continuity-deciding", "obj-patient-category"),
  link("agent", "obj-attending-physician", "proc-continuity-deciding"),

  // ── SD1.6 ──
  link("generalization", "proc-patient-discharging", "proc-medical-discharge"),
  link("generalization", "proc-patient-discharging", "proc-hospital-readmission-discharge"),
  link("generalization", "proc-patient-discharging", "proc-death-discharge"),
  link("generalization", "proc-patient-discharging", "proc-voluntary-withdrawal-discharge"),
  link("generalization", "proc-patient-discharging", "proc-disciplinary-discharge"),
  link("effect", "proc-medical-discharge", "obj-clinical-condition", { target_state: "state-recovered" }),
  link("effect", "proc-medical-discharge", "obj-hospitalization-status", { source_state: "state-hs-active", target_state: "state-hs-discharged" }),
  link("result", "proc-medical-discharge", "obj-epicrisis"),
  link("agent", "obj-attending-physician", "proc-medical-discharge"),
  link("effect", "proc-hospital-readmission-discharge", "obj-hospitalization-status", { source_state: "state-hs-active", target_state: "state-hs-discharged" }),
  link("instrument", "proc-hospital-readmission-discharge", "obj-inpatient-facility"),
  link("instrument", "proc-hospital-readmission-discharge", "obj-transport-vehicle"),
  link("result", "proc-hospital-readmission-discharge", "obj-epicrisis"),
  link("agent", "obj-attending-physician", "proc-hospital-readmission-discharge"),
  link("effect", "proc-death-discharge", "obj-hospitalization-status", { source_state: "state-hs-active", target_state: "state-hs-discharged" }),
  link("result", "proc-death-discharge", "obj-epicrisis"),
  link("agent", "obj-attending-physician", "proc-death-discharge"),
  link("result", "proc-death-discharge", "obj-death-protocol"),
  link("effect", "proc-voluntary-withdrawal-discharge", "obj-hospitalization-status", { source_state: "state-hs-active", target_state: "state-hs-discharged" }),
  link("instrument", "proc-voluntary-withdrawal-discharge", "obj-informed-consent"),
  link("result", "proc-voluntary-withdrawal-discharge", "obj-epicrisis"),
  link("result", "proc-voluntary-withdrawal-discharge", "obj-withdrawal-statement"),
  link("effect", "proc-disciplinary-discharge", "obj-hospitalization-status", { source_state: "state-hs-active", target_state: "state-hs-discharged" }),
  link("agent", "obj-technical-director", "proc-disciplinary-discharge"),
  link("result", "proc-disciplinary-discharge", "obj-epicrisis"),
  // Condition links for SD1.6 (fix orphan warnings)
  link("instrument", "proc-hospital-readmission-discharge", "obj-clinical-instability", { source_state: "state-ci-present" }),
  link("instrument", "proc-disciplinary-discharge", "obj-treatment-adherence", { source_state: "state-ta-non-adherent" }),

  // ── SD2 (Healthcare Team aggregation) ──
  link("aggregation", "obj-healthcare-team", "obj-technical-director"),
  link("aggregation", "obj-healthcare-team", "obj-coordination-professional"),
  link("aggregation", "obj-healthcare-team", "obj-attending-physician"),
  link("aggregation", "obj-healthcare-team", "obj-regulating-physician"),
  link("aggregation", "obj-healthcare-team", "obj-clinical-nurse"),
  link("aggregation", "obj-healthcare-team", "obj-kinesiologist"),
  link("aggregation", "obj-healthcare-team", "obj-nursing-technician"),
  link("aggregation", "obj-healthcare-team", "obj-social-worker"),
  link("aggregation", "obj-healthcare-team", "obj-administrative-staff"),
  // Exhibitions (attributes)
  link("exhibition", "obj-technical-director", "obj-clinical-experience"),
  link("exhibition", "obj-technical-director", "obj-postgraduate-management-training"),
  link("exhibition", "obj-technical-director", "obj-iaas-prevention-course"),
  link("exhibition", "obj-technical-director", "obj-weekly-dedication"),
  link("exhibition", "obj-coordination-professional", "obj-clinical-experience"),
  link("exhibition", "obj-coordination-professional", "obj-management-training"),
  link("exhibition", "obj-coordination-professional", "obj-iaas-course"),
  link("exhibition", "obj-attending-physician", "obj-clinical-experience"),
  link("exhibition", "obj-attending-physician", "obj-iaas-course"),
  link("exhibition", "obj-attending-physician", "obj-bls-certification"),
  link("exhibition", "obj-regulating-physician", "obj-regulation-experience"),
  link("exhibition", "obj-regulating-physician", "obj-bls-certification"),
  link("exhibition", "obj-clinical-nurse", "obj-clinical-experience"),
  link("exhibition", "obj-clinical-nurse", "obj-bls-certification"),
  link("exhibition", "obj-kinesiologist", "obj-clinical-experience"),
  link("exhibition", "obj-kinesiologist", "obj-bls-certification"),
  link("exhibition", "obj-nursing-technician", "obj-clinical-experience"),
  link("exhibition", "obj-nursing-technician", "obj-bls-certification"),

  // ── SD3 (Admin Infrastructure aggregation) ──
  link("aggregation", "obj-admin-infrastructure", "obj-telephone-system"),
  link("aggregation", "obj-admin-infrastructure", "obj-it-system"),
  link("aggregation", "obj-admin-infrastructure", "obj-electrical-backup"),
  link("aggregation", "obj-admin-infrastructure", "obj-clinical-archive-area"),
  link("aggregation", "obj-admin-infrastructure", "obj-pharmacy"),
  link("aggregation", "obj-admin-infrastructure", "obj-supply-storage"),
  link("aggregation", "obj-admin-infrastructure", "obj-waste-disposal-area"),
  link("aggregation", "obj-admin-infrastructure", "obj-cleaning-supply-room"),
  link("aggregation", "obj-admin-infrastructure", "obj-staff-welfare-area"),
  link("aggregation", "obj-admin-infrastructure", "obj-vehicle-parking"),
  link("aggregation", "obj-admin-infrastructure", "obj-evacuation-signage"),
  link("exhibition", "obj-telephone-system", "obj-availability"),
  link("exhibition", "obj-it-system", "obj-internet-connectivity"),
  link("exhibition", "obj-electrical-backup", "obj-sec-authorization"),
  link("exhibition", "obj-clinical-archive-area", "obj-security-level"),
  link("exhibition", "obj-pharmacy", "obj-cold-chain-compliance"),
  link("exhibition", "obj-supply-storage", "obj-temperature-control"),
  link("exhibition", "obj-waste-disposal-area", "obj-reas-compliance"),
  link("aggregation", "obj-staff-welfare-area", "obj-dining-access"),
  link("aggregation", "obj-staff-welfare-area", "obj-hygiene-facilities"),
  link("aggregation", "obj-staff-welfare-area", "obj-lockers"),
  link("aggregation", "obj-staff-welfare-area", "obj-break-room"),

  // ── SD4 (Medical Equipment aggregation) ──
  link("aggregation", "obj-medical-equipment", "obj-bp-monitor"),
  link("aggregation", "obj-medical-equipment", "obj-pulse-oximeter"),
  link("aggregation", "obj-medical-equipment", "obj-cardiac-monitor"),
  link("aggregation", "obj-medical-equipment", "obj-thermometer"),
  link("aggregation", "obj-medical-equipment", "obj-defibrillator"),
  link("aggregation", "obj-medical-equipment", "obj-specialty-instruments"),
  link("exhibition", "obj-medical-equipment", "obj-maintenance-status"),
  link("exhibition", "obj-medical-equipment", "obj-sanitary-authorization"),

  // ── SD5 (Documentation System) ──
  link("exhibition", "obj-hodom-system", "obj-documentation-system"),
  link("aggregation", "obj-documentation-system", "obj-internal-org-manual"),
  link("aggregation", "obj-documentation-system", "obj-clinical-protocol-set"),
  link("aggregation", "obj-documentation-system", "obj-procedures-manual"),
  link("aggregation", "obj-documentation-system", "obj-waste-mgmt-protocol"),
  link("aggregation", "obj-documentation-system", "obj-annual-training-plan"),
  link("aggregation", "obj-internal-org-manual", "obj-organizational-chart"),
  link("aggregation", "obj-internal-org-manual", "obj-role-definition-set"),
  link("aggregation", "obj-internal-org-manual", "obj-schedule-definition"),
  link("aggregation", "obj-internal-org-manual", "obj-hygiene-regulation"),
  link("aggregation", "obj-clinical-protocol-set", "obj-admission-eval-protocol"),
  link("aggregation", "obj-clinical-protocol-set", "obj-visit-route-protocol"),
  link("aggregation", "obj-clinical-protocol-set", "obj-categorization-discharge-protocol"),
  link("aggregation", "obj-clinical-protocol-set", "obj-prescription-referral-protocol"),
  link("aggregation", "obj-clinical-protocol-set", "obj-emergency-response-protocol"),
  link("aggregation", "obj-clinical-protocol-set", "obj-staff-aggression-protocol"),
  link("aggregation", "obj-procedures-manual", "obj-peripheral-venous-proc"),
  link("aggregation", "obj-procedures-manual", "obj-central-venous-proc"),
  link("aggregation", "obj-procedures-manual", "obj-urinary-catheter-proc"),
  link("aggregation", "obj-procedures-manual", "obj-tracheostomy-proc"),
  link("aggregation", "obj-procedures-manual", "obj-sample-collection-proc"),
  link("aggregation", "obj-procedures-manual", "obj-isolation-precaution-proc"),
  link("exhibition", "obj-waste-mgmt-protocol", "obj-reas-decree-compliance"),
  link("aggregation", "obj-annual-training-plan", "obj-iaas-training"),
  link("aggregation", "obj-annual-training-plan", "obj-bls-training"),
  link("aggregation", "obj-annual-training-plan", "obj-staff-induction-program"),
  link("aggregation", "obj-annual-training-plan", "obj-humanized-care-training"),
  link("exhibition", "obj-staff-induction-program", "obj-minimum-duration"),

  // ── SD6 (Governance processes) ──
  link("exhibition", "obj-hodom-system", "proc-sanitary-auth-managing"),
  link("exhibition", "obj-hodom-system", "proc-quality-safety-managing"),
  link("exhibition", "obj-hodom-system", "proc-staff-training-managing"),
  link("exhibition", "obj-hodom-system", "proc-supply-chain-managing"),
  link("exhibition", "obj-hodom-system", "proc-waste-managing"),
  link("exhibition", "obj-hodom-system", "proc-equipment-maintenance-managing"),
  link("effect", "proc-sanitary-auth-managing", "obj-hodom-system"),
  link("instrument", "proc-sanitary-auth-managing", "obj-current-regulation"),
  link("agent", "obj-technical-director", "proc-sanitary-auth-managing"),
  link("exhibition", "obj-hodom-system", "obj-sanitary-auth-status"),
  link("effect", "proc-sanitary-auth-managing", "obj-sanitary-auth-status", { source_state: "state-sas-pending", target_state: "state-sas-authorized" }),
  link("exhibition", "obj-sanitary-auth-status", "obj-authorization-validity"),
  link("tagged", "obj-seremi", "obj-hodom-system", { tag: "supervises" }),
  link("instrument", "proc-sanitary-auth-managing", "obj-seremi"),
  link("effect", "proc-quality-safety-managing", "obj-hodom-system"),
  link("instrument", "proc-quality-safety-managing", "obj-documentation-system"),
  link("agent", "obj-coordination-professional", "proc-quality-safety-managing"),
  link("exhibition", "obj-hodom-system", "obj-quality-level"),
  link("effect", "proc-quality-safety-managing", "obj-quality-level"),
  link("result", "proc-quality-safety-managing", "obj-adverse-reaction-audit"),
  link("result", "proc-quality-safety-managing", "obj-mortality-audit"),
  link("effect", "proc-staff-training-managing", "obj-healthcare-team"),
  link("instrument", "proc-staff-training-managing", "obj-annual-training-plan"),
  link("agent", "obj-coordination-professional", "proc-staff-training-managing"),
  link("exhibition", "obj-healthcare-team", "obj-training-compliance"),
  link("effect", "proc-staff-training-managing", "obj-training-compliance", { source_state: "state-tc-non-compliant", target_state: "state-tc-compliant" }),
  link("effect", "proc-supply-chain-managing", "obj-clinical-supply"),
  link("effect", "proc-supply-chain-managing", "obj-medication"),
  link("instrument", "proc-supply-chain-managing", "obj-pharmacy"),
  link("agent", "obj-coordination-professional", "proc-supply-chain-managing"),
  link("consumption", "obj-biomedical-waste", "proc-waste-managing"),
  link("instrument", "proc-waste-managing", "obj-waste-disposal-area"),
  link("instrument", "proc-waste-managing", "obj-waste-mgmt-protocol"),
  link("instrument", "proc-waste-managing", "obj-sharps-disposal-protocol"),
  link("effect", "proc-equipment-maintenance-managing", "obj-medical-equipment"),
  link("effect", "proc-equipment-maintenance-managing", "obj-maintenance-status", { source_state: "state-maint-overdue", target_state: "state-maint-current" }),
  link("agent", "obj-technical-director", "proc-equipment-maintenance-managing"),
  link("instrument", "proc-equipment-maintenance-managing", "obj-preventive-maintenance-program"),

  // ── SD7 (Patient Home exhibitions) ──
  link("exhibition", "obj-patient-home", "obj-home-condition"),
  link("exhibition", "obj-patient-home", "obj-basic-services"),
  link("exhibition", "obj-patient-home", "obj-telephony-access"),
  link("exhibition", "obj-patient-home", "obj-road-access"),
  link("exhibition", "obj-patient-home", "obj-coverage-radius-compliance"),

  // ── SD8 (Exclusions generalization) ──
  link("generalization", "obj-exclusion-condition", "obj-clinical-instability-exclusion"),
  link("generalization", "obj-exclusion-condition", "obj-unestablished-diagnosis-exclusion"),
  link("generalization", "obj-exclusion-condition", "obj-decompensated-mental-health-exclusion"),
  link("generalization", "obj-exclusion-condition", "obj-unlisted-service-exclusion"),
  link("generalization", "obj-exclusion-condition", "obj-prior-disciplinary-exclusion"),

  // ── SD9 (Tagged structural links) ──
  link("tagged", "obj-inpatient-facility", "obj-patient-group", { tag: "refers" }),
  link("tagged", "obj-patient-home", "obj-patient-group", { tag: "hosts" }),
  link("tagged", "obj-current-regulation", "obj-hodom-system", { tag: "governs" }),
  link("tagged", "obj-technical-director", "obj-hodom-system", { tag: "represents" }),
  link("tagged", "obj-hodom-system", "obj-continuity-of-care", { tag: "guarantees" }),
  link("tagged", "obj-attending-physician", "obj-inpatient-facility", { tag: "coordinates" }),
  link("tagged", "obj-regulating-physician", "obj-attending-physician", { tag: "supports" }),
  link("tagged", "obj-caregiver", "obj-patient-group", { tag: "cares-for" }),
];

// ── Modifiers ────────────────────────────────────────────────────────────────

// Find link IDs for condition modifiers
function findLink(src: string, tgt: string): string {
  const l = links.find(l => l.source === src && l.target === tgt);
  return l ? l.id : `MISSING-${src}-${tgt}`;
}

const modifiers = [
  // Patient Admitting occurs if Eligibility Status is eligible
  modifier(findLink("proc-patient-admitting", "obj-informed-consent"), "condition"),
  // Patient Discharging occurs if Continuity Decision is proceed-discharge
  modifier(findLink("proc-patient-discharging", "obj-hospitalization-status"), "condition"),
  // Hospital Readmission occurs if Clinical Instability is present
  modifier(findLink("proc-hospital-readmission-discharge", "obj-hospitalization-status"), "condition"),
  // Disciplinary Discharge occurs if Treatment Adherence is non-adherent
  modifier(findLink("proc-disciplinary-discharge", "obj-hospitalization-status"), "condition"),
  // Eligibility Evaluating occurs if Exclusion Condition is absent
  modifier(findLink("proc-eligibility-evaluating", "obj-eligibility-status"), "condition"),
];

// ── Appearances ──────────────────────────────────────────────────────────────

// Map things to their OPDs with auto-layout
type AppearanceEntry = { thing: string; opd: string; x: number; y: number; w: number; h: number; internal?: boolean };

function autoLayout(opdId: string, thingIds: string[], opts?: { internal?: boolean; startX?: number; startY?: number; cols?: number }): AppearanceEntry[] {
  const startX = opts?.startX ?? 50;
  const startY = opts?.startY ?? 50;
  const cols = opts?.cols ?? 4;
  const colW = 200;
  const rowH = 100;
  return thingIds.map((id, i) => ({
    thing: id,
    opd: opdId,
    x: startX + (i % cols) * colW,
    y: startY + Math.floor(i / cols) * rowH,
    w: 160,
    h: id.startsWith("proc-") ? 70 : 50,
    ...(opts?.internal !== undefined ? { internal: opts.internal } : {}),
  }));
}

const appearances: AppearanceEntry[] = [
  // SD
  ...autoLayout("opd-sd", [
    "proc-domiciliary-hospitalizing", "obj-patient-group", "obj-clinical-condition", "obj-hodom-system",
    "obj-healthcare-team", "obj-medical-equipment", "obj-communication-system", "obj-transport-vehicle",
    "obj-admin-infrastructure", "obj-clinical-supply", "obj-medication", "obj-clinical-record",
    "obj-patient-home", "obj-inpatient-facility", "obj-current-regulation", "proc-inpatient-bed-occupying",
  ]),
  // SD1
  ...autoLayout("opd-sd1", [
    "proc-domiciliary-hospitalizing",
  ], { internal: true, startX: 100, startY: 0 }).map(a => ({ ...a, w: 800, h: 700 })),
  ...autoLayout("opd-sd1", [
    "proc-eligibility-evaluating", "proc-patient-admitting", "proc-care-planning",
    "proc-therapeutic-plan-executing", "proc-clinical-evolution-monitoring", "proc-patient-discharging",
  ], { internal: true, startX: 150, startY: 80, cols: 2 }),
  ...autoLayout("opd-sd1", [
    "obj-eligibility-status", "obj-informed-consent", "obj-therapeutic-plan", "obj-nursing-care-plan",
    "obj-social-report", "obj-admission-form", "obj-domiciliary-clinical-summary", "obj-epicrisis",
    "obj-satisfaction-survey", "obj-continuity-decision", "obj-hospitalization-status",
    "obj-caregiver", "obj-support-network",
  ], { internal: true, startX: 150, startY: 400, cols: 5 }),
  ...autoLayout("opd-sd1", [
    "obj-healthcare-team", "obj-clinical-supply", "obj-medication", "obj-medical-equipment",
    "obj-transport-vehicle", "obj-clinical-condition", "obj-clinical-record", "obj-inpatient-facility",
  ], { internal: false, startX: 50, startY: 720, cols: 4 }),

  // SD1.1
  ...autoLayout("opd-sd1-1", [
    "proc-eligibility-evaluating",
  ], { internal: true, startX: 100, startY: 0 }).map(a => ({ ...a, w: 700, h: 500 })),
  ...autoLayout("opd-sd1-1", [
    "proc-clinical-condition-evaluating", "proc-home-condition-evaluating",
    "proc-support-network-verifying", "proc-informed-consent-obtaining",
  ], { internal: true, startX: 150, startY: 80, cols: 2 }),
  ...autoLayout("opd-sd1-1", [
    "obj-home-condition", "obj-rights-duties-charter",
    "obj-attending-physician", "obj-social-worker", "obj-clinical-nurse",
    "obj-patient-group", "obj-clinical-condition", "obj-inpatient-facility",
    "obj-social-report", "obj-patient-home", "obj-support-network",
    "obj-caregiver", "obj-informed-consent",
  ], { startX: 50, startY: 520, cols: 5 }),

  // SD1.2
  ...autoLayout("opd-sd1-2", [
    "proc-patient-admitting",
  ], { internal: true, startX: 100, startY: 0 }).map(a => ({ ...a, w: 900, h: 400 })),
  ...autoLayout("opd-sd1-2", [
    "proc-admission-registering", "proc-social-diagnosis-elaborating",
    "proc-patient-documentation-delivering", "proc-referral-facility-coordinating",
  ], { internal: true, startX: 130, startY: 80, cols: 2 }),
  ...autoLayout("opd-sd1-2", [
    "obj-admission-form", "obj-socioeconomic-status", "obj-care-indication-document",
    "obj-administrative-staff", "obj-social-worker", "obj-clinical-nurse", "obj-coordination-professional",
    "obj-communication-system", "obj-patient-home", "obj-social-report",
    "obj-patient-group", "obj-informed-consent", "obj-inpatient-facility",
  ], { startX: 50, startY: 420, cols: 7 }),

  // SD1.3
  ...autoLayout("opd-sd1-3", [
    "proc-care-planning",
  ], { internal: true, startX: 100, startY: 0 }).map(a => ({ ...a, w: 900, h: 400 })),
  ...autoLayout("opd-sd1-3", [
    "proc-therapeutic-plan-elaborating", "proc-nursing-care-plan-elaborating",
    "proc-home-visit-scheduling", "proc-transport-route-programming",
  ], { internal: true, startX: 130, startY: 80, cols: 2 }),
  ...autoLayout("opd-sd1-3", [
    "obj-therapeutic-plan", "obj-nursing-care-plan", "obj-visit-schedule", "obj-transport-route",
    "obj-attending-physician", "obj-clinical-nurse", "obj-coordination-professional",
    "obj-administrative-staff", "obj-clinical-condition", "obj-patient-home",
  ], { startX: 50, startY: 420, cols: 5 }),

  // SD1.4
  ...autoLayout("opd-sd1-4", [
    "proc-therapeutic-plan-executing",
  ], { internal: true, startX: 80, startY: 0 }).map(a => ({ ...a, w: 1300, h: 500 })),
  ...autoLayout("opd-sd1-4", [
    "proc-medical-visit-performing", "proc-nursing-care-executing",
    "proc-kinesiological-therapy-executing", "proc-medication-administering",
    "proc-remote-care-regulating", "proc-patient-caregiver-educating",
  ], { internal: true, startX: 130, startY: 80, cols: 3 }),
  ...autoLayout("opd-sd1-4", [
    "obj-motor-therapy", "obj-respiratory-therapy", "obj-prescription",
    "obj-telehealth-record", "obj-self-care-knowledge",
    "obj-patient-group", "obj-therapeutic-plan", "obj-nursing-care-plan",
    "obj-medical-equipment", "obj-transport-vehicle", "obj-clinical-supply",
    "obj-medication", "obj-communication-system", "obj-domiciliary-clinical-summary",
    "obj-caregiver", "obj-attending-physician", "obj-clinical-nurse",
    "obj-kinesiologist", "obj-nursing-technician", "obj-regulating-physician",
  ], { startX: 50, startY: 520, cols: 7 }),

  // SD1.5
  ...autoLayout("opd-sd1-5", [
    "proc-clinical-evolution-monitoring",
  ], { internal: true, startX: 100, startY: 0 }).map(a => ({ ...a, w: 700, h: 400 })),
  ...autoLayout("opd-sd1-5", [
    "proc-vital-signs-evaluating", "proc-clinical-record-updating",
    "proc-patient-categorizing", "proc-continuity-deciding",
  ], { internal: true, startX: 150, startY: 80, cols: 2 }),
  ...autoLayout("opd-sd1-5", [
    "obj-vital-signs-data", "obj-blood-pressure", "obj-heart-rate",
    "obj-respiratory-rate", "obj-oxygen-saturation", "obj-patient-category",
    "obj-continuity-decision", "obj-patient-group", "obj-medical-equipment",
    "obj-clinical-nurse", "obj-attending-physician", "obj-clinical-record",
    "obj-communication-system",
  ], { startX: 50, startY: 420, cols: 5 }),

  // SD1.6
  ...autoLayout("opd-sd1-6", [
    "proc-patient-discharging",
  ], { internal: true, startX: 100, startY: 0 }).map(a => ({ ...a, w: 1100, h: 450 })),
  ...autoLayout("opd-sd1-6", [
    "proc-medical-discharge", "proc-hospital-readmission-discharge",
    "proc-death-discharge", "proc-voluntary-withdrawal-discharge",
    "proc-disciplinary-discharge",
  ], { internal: true, startX: 130, startY: 80, cols: 5 }),
  ...autoLayout("opd-sd1-6", [
    "obj-clinical-condition", "obj-hospitalization-status", "obj-epicrisis",
    "obj-clinical-instability", "obj-death-protocol", "obj-withdrawal-statement",
    "obj-treatment-adherence", "obj-attending-physician", "obj-technical-director",
    "obj-inpatient-facility", "obj-transport-vehicle", "obj-informed-consent",
  ], { startX: 50, startY: 470, cols: 6 }),

  // SD2
  ...autoLayout("opd-sd2", [
    "obj-healthcare-team",
  ], { internal: true, startX: 80, startY: 0 }).map(a => ({ ...a, w: 1100, h: 500 })),
  ...autoLayout("opd-sd2", [
    "obj-technical-director", "obj-coordination-professional", "obj-attending-physician",
    "obj-regulating-physician", "obj-clinical-nurse", "obj-kinesiologist",
    "obj-nursing-technician", "obj-social-worker", "obj-administrative-staff",
  ], { internal: true, startX: 130, startY: 80, cols: 5 }),
  ...autoLayout("opd-sd2", [
    "obj-clinical-experience", "obj-postgraduate-management-training",
    "obj-iaas-prevention-course", "obj-weekly-dedication",
    "obj-management-training", "obj-iaas-course", "obj-bls-certification",
    "obj-regulation-experience",
  ], { startX: 50, startY: 520, cols: 4 }),

  // SD3
  ...autoLayout("opd-sd3", [
    "obj-admin-infrastructure",
  ], { internal: true, startX: 100, startY: 0 }).map(a => ({ ...a, w: 900, h: 500 })),
  ...autoLayout("opd-sd3", [
    "obj-telephone-system", "obj-it-system", "obj-electrical-backup",
    "obj-clinical-archive-area", "obj-pharmacy", "obj-supply-storage",
    "obj-waste-disposal-area", "obj-cleaning-supply-room", "obj-staff-welfare-area",
    "obj-vehicle-parking", "obj-evacuation-signage",
  ], { internal: true, startX: 150, startY: 80, cols: 4 }),
  ...autoLayout("opd-sd3", [
    "obj-availability", "obj-internet-connectivity", "obj-sec-authorization",
    "obj-security-level", "obj-cold-chain-compliance", "obj-temperature-control",
    "obj-reas-compliance", "obj-dining-access", "obj-hygiene-facilities",
    "obj-lockers", "obj-break-room",
  ], { startX: 50, startY: 520, cols: 4 }),

  // SD4
  ...autoLayout("opd-sd4", [
    "obj-medical-equipment",
  ], { internal: true, startX: 100, startY: 0 }).map(a => ({ ...a, w: 800, h: 300 })),
  ...autoLayout("opd-sd4", [
    "obj-bp-monitor", "obj-pulse-oximeter", "obj-cardiac-monitor",
    "obj-thermometer", "obj-defibrillator", "obj-specialty-instruments",
  ], { internal: true, startX: 150, startY: 80, cols: 3 }),
  ...autoLayout("opd-sd4", [
    "obj-maintenance-status", "obj-sanitary-authorization",
  ], { startX: 50, startY: 320, cols: 2 }),

  // SD5
  ...autoLayout("opd-sd5", [
    "obj-hodom-system",
  ], { internal: true, startX: 50, startY: 0 }).map(a => ({ ...a, w: 1600, h: 800 })),
  ...autoLayout("opd-sd5", [
    "obj-documentation-system",
  ], { internal: true, startX: 100, startY: 80 }).map(a => ({ ...a, w: 1400, h: 700 })),
  ...autoLayout("opd-sd5", [
    "obj-internal-org-manual", "obj-clinical-protocol-set", "obj-procedures-manual",
    "obj-waste-mgmt-protocol", "obj-annual-training-plan",
  ], { internal: true, startX: 130, startY: 160, cols: 5 }),
  ...autoLayout("opd-sd5", [
    "obj-organizational-chart", "obj-role-definition-set", "obj-schedule-definition", "obj-hygiene-regulation",
    "obj-admission-eval-protocol", "obj-visit-route-protocol", "obj-categorization-discharge-protocol",
    "obj-prescription-referral-protocol", "obj-emergency-response-protocol", "obj-staff-aggression-protocol",
    "obj-peripheral-venous-proc", "obj-central-venous-proc", "obj-urinary-catheter-proc",
    "obj-tracheostomy-proc", "obj-sample-collection-proc", "obj-isolation-precaution-proc",
    "obj-reas-decree-compliance", "obj-iaas-training", "obj-bls-training",
    "obj-staff-induction-program", "obj-humanized-care-training", "obj-minimum-duration",
  ], { startX: 50, startY: 820, cols: 8 }),

  // SD6
  ...autoLayout("opd-sd6", [
    "obj-hodom-system",
  ], { internal: true, startX: 50, startY: 0 }).map(a => ({ ...a, w: 1400, h: 500 })),
  ...autoLayout("opd-sd6", [
    "proc-sanitary-auth-managing", "proc-quality-safety-managing", "proc-staff-training-managing",
    "proc-supply-chain-managing", "proc-waste-managing", "proc-equipment-maintenance-managing",
  ], { internal: true, startX: 100, startY: 80, cols: 3 }),
  // SD6 external objects — group by governance process for clarity
  // Row 1: Sanitary auth related
  ...autoLayout("opd-sd6", [
    "obj-sanitary-auth-status", "obj-authorization-validity", "obj-seremi",
    "obj-current-regulation", "obj-technical-director", "obj-coordination-professional",
  ], { startX: 50, startY: 520, cols: 6 }),
  // Row 2: Quality + training related
  ...autoLayout("opd-sd6", [
    "obj-quality-level", "obj-adverse-reaction-audit", "obj-mortality-audit",
    "obj-training-compliance", "obj-annual-training-plan", "obj-documentation-system",
  ], { startX: 50, startY: 620, cols: 6 }),
  // Row 3: Supply + waste + equipment
  ...autoLayout("opd-sd6", [
    "obj-healthcare-team", "obj-clinical-supply", "obj-medication",
    "obj-pharmacy", "obj-biomedical-waste", "obj-waste-disposal-area",
  ], { startX: 50, startY: 720, cols: 6 }),
  // Row 4: Remaining
  ...autoLayout("opd-sd6", [
    "obj-waste-mgmt-protocol", "obj-sharps-disposal-protocol",
    "obj-medical-equipment", "obj-maintenance-status", "obj-preventive-maintenance-program",
  ], { startX: 50, startY: 820, cols: 5 }),

  // SD7 — 5 exhibited attributes, spread wide to avoid link crossing
  ...autoLayout("opd-sd7", [
    "obj-patient-home",
  ], { internal: true, startX: 80, startY: 0 }).map(a => ({ ...a, w: 1100, h: 400 })),
  // Row 1: top 3
  ...autoLayout("opd-sd7", [
    "obj-home-condition", "obj-basic-services", "obj-telephony-access",
  ], { internal: true, startX: 130, startY: 80, cols: 3 }),
  // Row 2: bottom 2 spaced wider
  ...autoLayout("opd-sd7", [
    "obj-road-access", "obj-coverage-radius-compliance",
  ], { internal: true, startX: 200, startY: 220, cols: 2 }),

  // SD8
  ...autoLayout("opd-sd8", [
    "obj-exclusion-condition",
  ], { internal: true, startX: 80, startY: 0 }).map(a => ({ ...a, w: 1200, h: 250 })),
  ...autoLayout("opd-sd8", [
    "obj-clinical-instability-exclusion", "obj-unestablished-diagnosis-exclusion",
    "obj-decompensated-mental-health-exclusion", "obj-unlisted-service-exclusion",
    "obj-prior-disciplinary-exclusion",
  ], { internal: true, startX: 120, startY: 80, cols: 5 }),

  // SD9 (tagged structural overview)
  ...autoLayout("opd-sd9", [
    "obj-inpatient-facility", "obj-patient-group", "obj-patient-home",
    "obj-hodom-system", "obj-current-regulation", "obj-technical-director",
    "obj-continuity-of-care", "obj-attending-physician", "obj-regulating-physician",
    "obj-caregiver",
  ], { startX: 50, startY: 50, cols: 4 }),
];

// ── Assemble Model ──────────────────────────────────────────────────────────

const model = {
  opmodel: "1.1.0",
  meta: {
    name: "HODOM HSC — Sistema de Hospitalización Domiciliaria",
    description: "Modelo OPM del Sistema de Hospitalización Domiciliaria (HODOM) conforme a ISO/PAS 19450. Hospital de San Carlos. 16 OPDs, ~235 entidades.",
    system_type: "socio-technical",
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  },
  settings: {
    autosave_interval_s: 300,
    methodology_coaching: true,
    opl_language: "en",
    primary_essence: "physical",
  },
  things,
  states,
  opds,
  links,
  modifiers,
  appearances,
  fans: [],
  scenarios: [],
  assertions: [],
  requirements: [],
  stereotypes: [],
  sub_models: [],
};

// ── Write ────────────────────────────────────────────────────────────────────

const json = JSON.stringify(model, null, 2);
writeFileSync("tests/hodom-hsc.opmodel", json);
writeFileSync("packages/web/public/hodom-hsc.opmodel", json);

console.log(`✅ Generated hodom-hsc.opmodel`);
console.log(`   Things: ${things.length}`);
console.log(`   States: ${states.length}`);
console.log(`   OPDs:   ${opds.length}`);
console.log(`   Links:  ${links.length}`);
console.log(`   Modifiers: ${modifiers.length}`);
console.log(`   Appearances: ${appearances.length}`);
